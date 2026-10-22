// SocialGlass · funzioni comuni del server (Vercel). Le chiavi restano qui, mai nel browser.
const crypto = require("crypto");
const CF = require("../cf.js");
const PREZZI = require("../listini.js");

const E = process.env;
const CFG = {
  token: E.AIRTABLE_TOKEN || "",
  baseMain: E.AIRTABLE_BASE_MAIN || "appelhKxcJDytBRee",
  baseMont: E.AIRTABLE_BASE_MONTATURE || "appLcON9vtvu5Cpj8",
  tOttici: E.T_OTTICI || "Ottici",
  tUtenti: E.T_UTENTI || "Utenti",
  tCaf: E.T_CAF_LOGIN || "tblDPTbLXTeS4rEvL",
  tOttLogin: E.T_OTTICI_LOGIN || "tblnW30eNPuyGYkB4",
  tMont: E.T_MONTATURE || "tbluV4ZA9v244YHp1",
  secret: E.SESSION_SECRET || "solo-per-prova-cambiami",
  site: (E.SITE_URL || "https://www.socialglass.it").replace(/\/$/, ""),
  smsWebhook: E.SMS_WEBHOOK_URL || "",
  stripeKey: E.STRIPE_SECRET_KEY || "",
  stripeWebhook: E.STRIPE_WEBHOOK_SECRET || ""
};
const DEMO = !CFG.token;

/* ---------- dati di prova (quando Airtable non è collegato) ---------- */
const demo = global.__sgDemo || (global.__sgDemo = {
  caf: [{ID: "CAF001", Password: "demo", Nome: "CAF Demo"}],
  ottLogin: [{ID: "OTT07", Password: "demo"}, {ID: "OTT12", Password: "demo"}],
  ottici: [
    {ID: "OTT07", Intestatario: "Ottica Demo Centro", Indirizzo: "Via Esempio 12, ", Citta: "Catania", Listino: "A", Telefono: "390950000000"},
    {ID: "OTT12", Intestatario: "Ottica Demo Mare", Indirizzo: "Corso Prova 3, ", Citta: "Acireale", Listino: "B"}
  ],
  utenti: [],
  montature: [
    {Codice: "SG-1042", Modello: "Aurora", Colore: "Nero", Calibro: "52-18", Asse: "145", Stato: "DISPONIBILE"},
    {Codice: "SG-1043", Modello: "Vela", Colore: "Tartaruga", Calibro: "50-20", Asse: "140", Stato: "DISPONIBILE"},
    {Codice: "SG-1044", Modello: "Brezza", Colore: "Blu", Calibro: "54-17", Asse: "145", Stato: "DISPONIBILE"}
  ]
});

/* ---------- Airtable ---------- */
const q = v => String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
async function at(base, table, opts = {}){
  const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}${opts.id ? "/" + opts.id : ""}`);
  const r = await fetch(url, {method: opts.method || "GET", headers: {Authorization: `Bearer ${CFG.token}`, "Content-Type": "application/json"},
    body: opts.body ? JSON.stringify(opts.body) : undefined});
  if (!r.ok) throw new Error(`Airtable ${r.status}: ${(await r.text()).slice(0, 300)}`);
  return r.json();
}
async function find(base, table, formula, max = 1){
  const all = []; let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    if (formula) url.searchParams.set("filterByFormula", formula);
    if (max) url.searchParams.set("maxRecords", String(max));
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, {headers: {Authorization: `Bearer ${CFG.token}`}});
    if (!r.ok) throw new Error(`Airtable ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = await r.json(); all.push(...j.records); offset = j.offset || "";
  } while (offset && (!max || all.length < max));
  return all;
}

/* ---------- archivio: stesse funzioni con Airtable o con i dati di prova ---------- */
const parseOrdine = s => { try { return s ? JSON.parse(s) : {}; } catch(e){ return {}; } };
const DB = {
  async login(ruolo, id){
    if (DEMO) return (ruolo === "caf" ? demo.caf : demo.ottLogin).find(r => r.ID === id) || null;
    const r = await find(CFG.baseMain, ruolo === "caf" ? CFG.tCaf : CFG.tOttLogin, `UPPER({ID})="${q(id)}"`, 1);
    return r[0] ? r[0].fields : null;
  },
  async ottici(){ return DEMO ? demo.ottici : (await find(CFG.baseMain, CFG.tOttici, "", 0)).map(r => r.fields); },
  async ottico(id){
    if (!id) return null;
    if (DEMO) return demo.ottici.find(x => x.ID === id) || null;
    const r = await find(CFG.baseMain, CFG.tOttici, `{ID}="${q(id)}"`, 1); return r[0] ? r[0].fields : null;
  },
  async utente(by, val){ // by: "Univoco" | "Codice Fiscale"
    if (DEMO){ const u = demo.utenti.find(x => x[by] === val); return u ? {id: u.Univoco, f: u} : null; }
    const r = await find(CFG.baseMain, CFG.tUtenti, `{${by}}="${q(val)}"`, 1);
    return r[0] ? {id: r[0].id, f: r[0].fields} : null;
  },
  async utenti(filtro){ // {caf} oppure {ottico}
    let rows;
    if (DEMO) rows = demo.utenti.map(f => ({id: f.Univoco, f}));
    else {
      const formula = filtro.caf ? `{CAF}="${q(filtro.caf)}"` : `LEFT({Ottica1},${String(filtro.ottico).length + 1})="${q(filtro.ottico)} "`;
      rows = (await find(CFG.baseMain, CFG.tUtenti, formula, 300)).map(r => ({id: r.id, f: r.fields}));
    }
    return rows.filter(r => filtro.caf ? r.f.CAF === filtro.caf : String(r.f.Ottica1 || "").startsWith(filtro.ottico + " "));
  },
  async creaUtente(fields){
    if (DEMO){ const uv = nuovoUnivoco(); demo.utenti.unshift(Object.assign({Univoco: uv, Creato: new Date().toISOString()}, fields)); return uv; }
    const r = await at(CFG.baseMain, CFG.tUtenti, {method: "POST", body: {fields, typecast: true}});
    let uv = r.fields && r.fields.Univoco;
    if (!uv){ uv = nuovoUnivoco(); await at(CFG.baseMain, CFG.tUtenti, {method: "PATCH", id: r.id, body: {fields: {Univoco: uv}, typecast: true}}); }
    return uv;
  },
  async aggiorna(u, fields){
    if (DEMO){ Object.assign(u.f, fields); return; }
    await at(CFG.baseMain, CFG.tUtenti, {method: "PATCH", id: u.id, body: {fields, typecast: true}});
    Object.assign(u.f, fields);
  },
  async montatura(codice){
    if (DEMO){ const m = demo.montature.find(x => x.Codice === codice); return m ? {id: m.Codice, f: m} : null; }
    const r = (await find(CFG.baseMont, CFG.tMont, `{Codice}="${q(codice)}"`, 1))[0];
    return r ? {id: r.id, f: r.fields} : null;
  },
  async aggiornaMontatura(m, fields){
    if (DEMO){ Object.assign(m.f, fields); return; }
    await at(CFG.baseMont, CFG.tMont, {method: "PATCH", id: m.id, body: {fields, typecast: true}});
  }
};
function nuovoUnivoco(){ return "SG" + crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 7); }

/* ---------- stati del percorso ---------- */
const STATI = {
  REGISTRATO: "IN ATTESA SCELTA MONTATURA",
  MONTATURA: "MONTATURA SCELTA",
  PAGAMENTO: "IN ATTESA PAGAMENTO",
  ATTIVO: "RATE ATTIVE - IN LAVORAZIONE",
  PRONTO: "PRONTO PER IL RITIRO",
  CONSEGNATO: "CONSEGNATO"
};
function linkCliente(uv, ottica, caf, listino){
  return `${CFG.site}/?Univoco=${encodeURIComponent(uv)}&espositore=${encodeURIComponent(ottica || "")}&promotore=${encodeURIComponent(caf || "")}&listino=${encodeURIComponent(listino || "")}`;
}

/* ---------- sessioni firmate ---------- */
function sign(payload){
  const body = Buffer.from(JSON.stringify(Object.assign({exp: Date.now() + 10*3600e3}, payload))).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url")}`;
}
function verify(req, ruolo){
  const h = req.headers.authorization || "", t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [body, mac] = t.split(".");
  if (!body || !mac) return null;
  const good = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  if (p.exp < Date.now() || (ruolo && p.ruolo !== ruolo)) return null;
  return p;
}
function safeEq(a, b){ const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); }

/* ---------- risposta ---------- */
function send(res, code, data){
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
async function readRaw(req){
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString();
  if (req.body && typeof req.body === "object") return JSON.stringify(req.body);
  const chunks = []; for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks).toString();
}
async function readBody(req){ try { return JSON.parse(await readRaw(req) || "{}"); } catch(e){ return {}; } }
const hits = global.__sgHits || (global.__sgHits = new Map());
function tooMany(key, max = 8, windowMs = 10*60e3){
  const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  arr.push(now); hits.set(key, arr); return arr.length > max;
}
function wrap(fn){
  return async (req, res) => {
    try { await fn(req, res); }
    catch(e){ console.error(e); send(res, 500, {errore: "Errore del server. Riprova tra poco."}); }
  };
}
const NOAUTH = {errore: "Sessione scaduta: accedi di nuovo."};
module.exports = {CFG, DEMO, demo, DB, STATI, parseOrdine, linkCliente, nuovoUnivoco, sign, verify, safeEq, send, readRaw, readBody, tooMany, wrap, CF, PREZZI, NOAUTH};
