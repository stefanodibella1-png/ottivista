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
  stripeWebhook: E.STRIPE_WEBHOOK_SECRET || "",
  firebase: E.FIREBASE_SERVICE_ACCOUNT || ""
};
// Database: Firestore se c'è la chiave Firebase, altrimenti Airtable, altrimenti dati di prova
const MODO = CFG.firebase ? "firestore" : CFG.token ? "airtable" : "demo";
const DEMO = MODO === "demo";

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

/* ---------- Firestore ---------- */
let fsDb = null, seeded = null;
function fs(){
  if (fsDb) return fsDb;
  const {initializeApp, cert, getApps} = require("firebase-admin/app");
  const {getFirestore} = require("firebase-admin/firestore");
  const sa = JSON.parse(CFG.firebase);
  const app = getApps()[0] || initializeApp({credential: cert(sa), projectId: sa.project_id});
  fsDb = getFirestore(app);
  return fsDb;
}
const COL = {caf: "sg_caf", ottLogin: "sg_ottici_login", ottici: "sg_ottici", utenti: "sg_utenti", mont: "sg_montature", meta: "sg_meta"};
// al primo avvio carica CAF, ottici e montature di prova (poi si gestiscono dalla console Firebase)
function seed(db){
  if (seeded) return seeded;
  seeded = (async () => {
    const m = db.collection(COL.meta).doc("seed");
    if ((await m.get()).exists) return;
    const b = db.batch();
    demo.caf.forEach(x => b.set(db.collection(COL.caf).doc(x.ID), x));
    demo.ottLogin.forEach(x => b.set(db.collection(COL.ottLogin).doc(x.ID), x));
    demo.ottici.forEach(x => b.set(db.collection(COL.ottici).doc(x.ID), x));
    demo.montature.forEach(x => b.set(db.collection(COL.mont).doc(x.Codice), x));
    b.set(m, {il: new Date().toISOString()});
    await b.commit();
  })().catch(e => { seeded = null; throw e; });
  return seeded;
}
async function fdb(){ const db = fs(); await seed(db); return db; }
const FS = {
  // gestione dal pannello amministratore
  async lista(k){ return (await (await fdb()).collection(COL[k]).get()).docs.map(d => Object.assign({_id: d.id}, d.data())); },
  async salva(k, id, data){ await (await fdb()).collection(COL[k]).doc(String(id)).set(data, {merge: true}); },
  async elimina(k, id){ await (await fdb()).collection(COL[k]).doc(String(id)).delete(); },
  async meta(id, data){ const d = (await fdb()).collection(COL.meta).doc(id); if (data === undefined){ const x = await d.get(); return x.exists ? x.data() : null; } await d.set(data, {merge: true}); },
  async login(ruolo, id){ const d = await (await fdb()).collection(ruolo === "caf" ? COL.caf : COL.ottLogin).doc(String(id).toUpperCase()).get(); return d.exists ? d.data() : null; },
  async ottici(){ return (await (await fdb()).collection(COL.ottici).get()).docs.map(d => d.data()); },
  async ottico(id){ if (!id) return null; const d = await (await fdb()).collection(COL.ottici).doc(id).get(); return d.exists ? d.data() : null; },
  async utente(by, val){
    const db = await fdb();
    if (by === "Univoco"){ const d = await db.collection(COL.utenti).doc(String(val)).get(); return d.exists ? {id: d.id, f: d.data()} : null; }
    const {FieldPath} = require("firebase-admin/firestore");
    const r = await db.collection(COL.utenti).where(new FieldPath(by), "==", val).limit(1).get();
    return r.empty ? null : {id: r.docs[0].id, f: r.docs[0].data()};
  },
  async utenti(filtro){
    const c = (await fdb()).collection(COL.utenti);
    const r = filtro.caf ? await c.where("CAF", "==", filtro.caf).get()
      : await c.where("Ottica1", ">=", filtro.ottico + " ").where("Ottica1", "<", filtro.ottico + " \uf8ff").get();
    return r.docs.map(d => ({id: d.id, f: d.data()})).sort((a, b) => String(b.f.Creato || "").localeCompare(String(a.f.Creato || "")));
  },
  async creaUtente(fields){
    const c = (await fdb()).collection(COL.utenti);
    for (let i = 0; i < 5; i++){
      const uv = nuovoUnivoco();
      try { await c.doc(uv).create(Object.assign({Univoco: uv, Creato: new Date().toISOString()}, fields)); return uv; }
      catch(e){ if (e.code !== 6) throw e; } // 6 = esiste già
    }
    throw new Error("Impossibile creare il codice cliente");
  },
  async tutti(){ return (await (await fdb()).collection(COL.utenti).get()).docs.map(d => ({id: d.id, f: d.data()})); },
  async aggiorna(u, fields){ await (await fdb()).collection(COL.utenti).doc(u.id).update(fields); Object.assign(u.f, fields); },
  async montatura(codice){ const d = await (await fdb()).collection(COL.mont).doc(String(codice)).get(); return d.exists ? {id: d.id, f: d.data()} : null; },
  async aggiornaMontatura(m, fields){ await (await fdb()).collection(COL.mont).doc(m.id).update(fields); Object.assign(m.f, fields); }
};

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
// dati di prova in memoria (server senza database): stesse funzioni del pannello
const DEMOCOL = {caf: () => demo.caf, ottLogin: () => demo.ottLogin, ottici: () => demo.ottici, mont: () => demo.montature, utenti: () => demo.utenti};
const DEMOKEY = {caf: "ID", ottLogin: "ID", ottici: "ID", mont: "Codice", utenti: "Univoco"};
const MEM = {
  async lista(k){ return DEMOCOL[k]().map(x => Object.assign({_id: x[DEMOKEY[k]]}, x)); },
  async salva(k, id, data){ const a = DEMOCOL[k](), i = a.findIndex(x => x[DEMOKEY[k]] === id); if (i < 0) a.push(Object.assign({[DEMOKEY[k]]: id}, data)); else Object.assign(a[i], data); },
  async elimina(k, id){ const a = DEMOCOL[k](), i = a.findIndex(x => x[DEMOKEY[k]] === id); if (i >= 0) a.splice(i, 1); },
  async meta(id, data){ demo.meta = demo.meta || {}; if (data === undefined) return demo.meta[id] || null; demo.meta[id] = Object.assign(demo.meta[id] || {}, data); }
};
const AT = {
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
  async tutti(){
    if (DEMO) return demo.utenti.map(f => ({id: f.Univoco, f}));
    return (await find(CFG.baseMain, CFG.tUtenti, "", 0)).map(r => ({id: r.id, f: r.fields}));
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
const DB = MODO === "firestore" ? FS : AT;
if (MODO !== "firestore") Object.assign(AT, MEM);

/* ---------- password: salvate cifrate (scrypt); le vecchie in chiaro restano valide ---------- */
function hashPw(p){ const salt = crypto.randomBytes(16).toString("hex"); return `scrypt$${salt}$${crypto.scryptSync(String(p), salt, 32).toString("hex")}`; }
function checkPw(stored, p){
  stored = String(stored || "");
  if (stored.startsWith("scrypt$")){ const [, salt, h] = stored.split("$"); return safeEq(crypto.scryptSync(String(p), salt, 32).toString("hex"), h); }
  return !!stored && safeEq(stored, String(p));
}
const PROVA = {caf: ["CAF001"], ottici: ["OTT07", "OTT12"], montature: ["SG-1042", "SG-1043", "SG-1044"]};
/* avvisi al cliente: SMS se configurato, altrimenti link WhatsApp da far inviare a CAF/ottico */
async function avvisa(u, testo){
  const numero = String(u.f.Prefisso || "+39") + String(u.f.Cellulare || "");
  let sms = false;
  if (CFG.smsWebhook && u.f.Cellulare){
    try { const r = await fetch(CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to: numero, text: testo})}); sms = r.ok; } catch(e){}
  }
  return {sms, whatsapp: `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`};
}
/* ---------- Stripe (API con parametri form) ---------- */
async function stripeApi(method, path, params, chiave){
  const body = new URLSearchParams();
  const add = (k, v) => { if (v === undefined || v === null) return; if (typeof v === "object" && !Array.isArray(v)) for (const [kk, vv] of Object.entries(v)) add(`${k}[${kk}]`, vv); else if (Array.isArray(v)) v.forEach((x, i) => add(`${k}[${i}]`, x)); else body.append(k, String(v)); };
  for (const [k, v] of Object.entries(params || {})) add(k, v);
  const r = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && params ? "?" + body : ""}`, {method, headers: Object.assign({Authorization: `Bearer ${CFG.stripeKey}`, "Content-Type": "application/x-www-form-urlencoded"}, chiave ? {"Idempotency-Key": chiave} : {}), body: method === "GET" ? undefined : body});
  const j = await r.json(); if (!r.ok) throw new Error(`Stripe: ${j.error && j.error.message}`); return j;
}

/* ---------- rinnovo (CAF o ottico): nuovo occhiale, l'abbonamento Stripe continua ---------- */
async function rinnova(u, {otticoId, caf} = {}){
  const ord = parseOrdine(u.f.Ordine), pg = ord.pagamento || null;
  const storico = (ord.storico || []).concat(ord.montatura ? [{montatura: ord.montatura, lenti: ord.lenti, totale: ord.prezzi && ord.prezzi.totale, rata: ord.prezzi && ord.prezzi.rata, inizio: pg && pg.attivatoIl, chiuso: new Date().toISOString()}] : []);
  // se l'abbonamento è ancora attivo lo si tiene: al nuovo ordine cambia solo il canone
  // se un rinnovo era già in corso si conserva il suo abbonamento (mai perderlo: si pagherebbe due volte)
  const prosegue = pg && pg.abbonamento && !pg.chiuso ? {abbonamento: pg.abbonamento, cliente: pg.cliente, ratePagate: pg.ratePagate || 0, attivatoIl: pg.attivatoIl}
    : (ord.rinnovo && ord.rinnovo.prosegue) || null;
  const campi = {Stato: STATI.REGISTRATO, Ordine: JSON.stringify({storico, rinnovo: {il: new Date().toISOString(), da: caf ? "CAF " + caf : "ottico " + (otticoId || ""), prosegue}})};
  let o = null;
  if (otticoId){ o = await DB.ottico(otticoId); if (o) campi.Ottica1 = `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`; }
  if (!o) o = await DB.ottico(String(u.f.Ottica1 || "").split(" - ")[0]);
  if (o && o.Listino) campi.Listino = o.Listino;
  await DB.aggiorna(u, campi);
  const link = linkCliente(u.f.Univoco, o && o.ID, caf || u.f.CAF, o && o.Listino);
  const avviso = await avvisa(u, `SocialGlass: ciao ${u.f.Nome}, è il momento del tuo occhiale nuovo! Vai da ${o ? o.Intestatario : "la tua ottica"}, scegli la montatura e conferma il nuovo canone dal tuo link: ${link}`);
  return {univoco: u.f.Univoco, link, avviso, whatsapp: avviso.whatsapp, smsInviato: avviso.sms};
}

/* ---------- attivazione dopo il pagamento Stripe (dal webhook o verificando la sessione) ---------- */
async function attiva(u, sessione){
  const ord = parseOrdine(u.f.Ordine);
  if (u.f.Stato !== STATI.PAGAMENTO){
    // abbonamento in più (es. pagamento fatto due volte da due schede): si chiude subito e si avvisa
    const attuale = ord.pagamento && ord.pagamento.abbonamento;
    if (sessione.subscription && attuale && sessione.subscription !== attuale && CFG.stripeKey){
      try { await stripeApi("DELETE", `subscriptions/${sessione.subscription}`); } catch(e){ console.error(e); }
      const ora = new Date().toISOString();
      ord.avvisi = ord.avvisi || {};
      ord.avvisi["doppio" + ora.slice(0, 16)] = {il: ora, testo: `Pagamento doppio: abbiamo chiuso l'abbonamento in più (${sessione.subscription}). Rimborsa il primo addebito dalla dashboard Stripe.`, whatsapp: "", inviato: false, operatore: true};
      await DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    }
    return false;
  }
  ord.pagamento = Object.assign({}, ord.pagamento, {stato: "ATTIVO", sessione: sessione.id, abbonamento: sessione.subscription || "", cliente: sessione.customer || "", attivatoIl: new Date().toISOString()});
  if (!ord.pagamento.ratePagate && sessione.payment_status === "paid") ord.pagamento.ratePagate = 1;
  ord.aggiornato = ord.pagamento.attivatoIl;
  await DB.aggiorna(u, {Stato: STATI.ATTIVO, Ordine: JSON.stringify(ord)});
  return true;
}
// se la conferma di Stripe non è ancora arrivata, la si chiede direttamente a Stripe
async function verificaPagamento(u){
  if (u.f.Stato !== STATI.PAGAMENTO || !CFG.stripeKey) return false;
  const pg = parseOrdine(u.f.Ordine).pagamento;
  if (!pg || pg.stato !== "IN CORSO" || !pg.sessione) return false;
  try { const s = await stripeApi("GET", `checkout/sessions/${pg.sessione}`); if (s.status === "complete") return await attiva(u, s); }
  catch(e){ console.error(e); }
  return false;
}

function nuovoUnivoco(){ return "SG" + crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 7); }

/* ---------- stati del percorso ---------- */
const STATI = {
  REGISTRATO: "IN ATTESA SCELTA MONTATURA",
  MONTATURA: "MONTATURA SCELTA",
  PAGAMENTO: "IN ATTESA PAGAMENTO",
  ATTIVO: "ABBONAMENTO ATTIVO - IN LAVORAZIONE",
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
// tentativi con codici cliente inesistenti: al massimo 10 ogni 10 minuti per indirizzo
function ipDi(req){ return String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim(); }
function bloccato(req){ const a = (hits.get("cod:" + ipDi(req)) || []).filter(t => Date.now() - t < 10*60e3); return a.length >= 10; }
function codiceErrato(req){ tooMany("cod:" + ipDi(req), 1e9); }
const TROPPI = {errore: "Troppi codici sbagliati. Riprova tra 10 minuti."};
function wrap(fn){
  return async (req, res) => {
    try { await fn(req, res); }
    catch(e){ console.error(e); send(res, 500, {errore: "Errore del server. Riprova tra poco."}); }
  };
}
const NOAUTH = {errore: "Sessione scaduta: accedi di nuovo."};
module.exports = {hashPw, checkPw, PROVA, ipDi, bloccato, codiceErrato, TROPPI, avvisa, stripeApi, rinnova, attiva, verificaPagamento, CFG, MODO, DEMO, demo, DB, STATI, parseOrdine, linkCliente, nuovoUnivoco, sign, verify, safeEq, send, readRaw, readBody, tooMany, wrap, CF, PREZZI, NOAUTH};
