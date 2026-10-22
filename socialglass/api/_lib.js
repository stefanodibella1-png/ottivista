// SocialGlass · funzioni comuni del server (Vercel). Le chiavi restano qui, mai nel browser.
const crypto = require("crypto");
const CF = require("../cf.js");

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
  site: E.SITE_URL || "https://www.socialglass.it",
  smsWebhook: E.SMS_WEBHOOK_URL || ""
};
const DEMO = !CFG.token;

/* ---------- dati di prova (quando Airtable non è collegato) ---------- */
const demo = global.__sgDemo || (global.__sgDemo = {
  caf: [{ID: "CAF001", Password: "demo", Nome: "CAF Demo"}],
  ottLogin: [{ID: "OTT07", Password: "demo"}],
  ottici: [
    {ID: "OTT07", Intestatario: "Ottica Demo Centro", Indirizzo: "Via Esempio 12, ", Citta: "Catania", Listino: "A"},
    {ID: "OTT12", Intestatario: "Ottica Demo Mare", Indirizzo: "Corso Prova 3, ", Citta: "Acireale", Listino: "B"}
  ],
  utenti: [],
  montature: [
    {Codice: "SG-1042", Modello: "Aurora", Colore: "Nero", Calibro: "52-18", Asse: "145", Stato: "DISPONIBILE"},
    {Codice: "SG-1043", Modello: "Vela", Colore: "Tartaruga", Calibro: "50-20", Asse: "140", Stato: "DISPONIBILE"}
  ]
});

/* ---------- Airtable ---------- */
const q = v => String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
async function at(base, table, opts = {}){
  const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}${opts.id ? "/" + opts.id : ""}`);
  if (opts.formula) url.searchParams.set("filterByFormula", opts.formula);
  if (opts.max) url.searchParams.set("maxRecords", String(opts.max));
  const r = await fetch(url, {method: opts.method || "GET", headers: {Authorization: `Bearer ${CFG.token}`, "Content-Type": "application/json"},
    body: opts.body ? JSON.stringify(opts.body) : undefined});
  if (!r.ok) throw new Error(`Airtable ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}
async function find(base, table, formula, max = 1){
  if (DEMO) return null;
  const all = []; let offset = "";
  do {
    const url = new URL(`https://api.airtable.com/v0/${base}/${encodeURIComponent(table)}`);
    if (formula) url.searchParams.set("filterByFormula", formula);
    if (max) url.searchParams.set("maxRecords", String(max));
    if (offset) url.searchParams.set("offset", offset);
    const r = await fetch(url, {headers: {Authorization: `Bearer ${CFG.token}`}});
    if (!r.ok) throw new Error(`Airtable ${r.status}`);
    const j = await r.json(); all.push(...j.records); offset = j.offset || "";
  } while (offset && (!max || all.length < max));
  return all;
}

/* ---------- sessioni firmate ---------- */
function sign(payload){
  const body = Buffer.from(JSON.stringify(Object.assign({exp: Date.now() + 8*3600e3}, payload))).toString("base64url");
  const mac = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  return `${body}.${mac}`;
}
function verify(req, ruolo){
  const h = req.headers.authorization || "";
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [body, mac] = t.split(".");
  if (!body || !mac) return null;
  const good = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  if (p.exp < Date.now() || (ruolo && p.ruolo !== ruolo)) return null;
  return p;
}
function safeEq(a, b){
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

/* ---------- risposta ---------- */
function send(res, code, data){
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}
async function readBody(req){
  if (req.body && typeof req.body === "object") return req.body;
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString() || "{}"); } catch(e){ return {}; }
}
// limite semplice di tentativi per i login (per istanza)
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
module.exports = {CFG, DEMO, demo, at, find, q, sign, verify, safeEq, send, readBody, tooMany, wrap, CF};
