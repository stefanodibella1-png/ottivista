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
  // messaggi automatici ai clienti: WhatsApp Business (Cloud API di Meta) oppure SMS (Twilio o un servizio SMS via webhook)
  waToken: E.WHATSAPP_TOKEN || "", waPhone: E.WHATSAPP_PHONE_ID || "", waTemplate: E.WHATSAPP_TEMPLATE || "sollecito_canone", waTemplatePronto: E.WHATSAPP_TEMPLATE_PRONTO || "occhiale_pronto", waLingua: E.WHATSAPP_LANG || "it",
  twSid: E.TWILIO_SID || "", twToken: E.TWILIO_TOKEN || "", twFrom: E.TWILIO_FROM || "",
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
  utenti: [], fornitori: [], ordForn: [],
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
const COL = {caf: "sg_caf", ottLogin: "sg_ottici_login", ottici: "sg_ottici", utenti: "sg_utenti", mont: "sg_montature", meta: "sg_meta", forn: "sg_fornitori", ordForn: "sg_ordini_fornitori", segn: "sg_segnalazioni", registro: "sg_registro", copie: "sg_copie", fatt: "sg_fatture"};
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
  async ultimi(k, n){ return (await (await fdb()).collection(COL[k]).orderBy("il", "desc").limit(n).get()).docs.map(d => Object.assign({_id: d.id}, d.data())); },
  async uno(k, id){ const d = await (await fdb()).collection(COL[k]).doc(String(id)).get(); return d.exists ? Object.assign({_id: d.id}, d.data()) : null; },
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
  async aggiornaMontatura(m, fields){ await (await fdb()).collection(COL.mont).doc(m.id).update(fields); Object.assign(m.f, fields); },
  // lettura e scrittura atomica (due prenotazioni contemporanee non possono prendere lo stesso pezzo)
  async tx(k, id, fn){
    const db = await fdb(), ref = db.collection(COL[k]).doc(String(id));
    return db.runTransaction(async t => { const d = await t.get(ref); if (!d.exists) return null; const out = fn(d.data()); if (out) t.update(ref, out); return out; });
  },
  async nuovaFattura(id, anno, crea){
    const db = await fdb(), ref = db.collection(COL.fatt).doc(String(id)), cnt = db.collection(COL.meta).doc("fatture-" + anno);
    return db.runTransaction(async t => {
      const [d, c] = await Promise.all([t.get(ref), t.get(cnt)]); if (d.exists) return null;
      const n = ((c.exists && c.data().ultimo) || 0) + 1, x = crea(n);
      t.set(cnt, {ultimo: n}, {merge: true}); t.set(ref, x); return x;
    });
  }
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
const DEMOCOL = {caf: () => demo.caf, ottLogin: () => demo.ottLogin, ottici: () => demo.ottici, mont: () => demo.montature, utenti: () => demo.utenti, forn: () => (demo.fornitori = demo.fornitori || []), ordForn: () => (demo.ordForn = demo.ordForn || []),
  segn: () => (demo.segn = demo.segn || []), registro: () => (demo.registro = demo.registro || []), copie: () => (demo.copie = demo.copie || []), fatt: () => (demo.fatt = demo.fatt || [])};
const DEMOKEY = {caf: "ID", ottLogin: "ID", ottici: "ID", mont: "Codice", utenti: "Univoco", forn: "ID", ordForn: "ID", segn: "ID", registro: "ID", copie: "ID", fatt: "ID"};
const MEM = {
  async lista(k){ return DEMOCOL[k]().map(x => Object.assign({_id: x[DEMOKEY[k]]}, x)); },
  async ultimi(k, n){ return DEMOCOL[k]().slice().sort((a, b) => String(b.il).localeCompare(String(a.il))).slice(0, n).map(x => Object.assign({_id: x[DEMOKEY[k]]}, x)); },
  async uno(k, id){ const x = DEMOCOL[k]().find(r => r[DEMOKEY[k]] === String(id)); return x ? Object.assign({_id: x[DEMOKEY[k]]}, x) : null; },
  async salva(k, id, data){ const a = DEMOCOL[k](), i = a.findIndex(x => x[DEMOKEY[k]] === id); if (i < 0) a.push(Object.assign({[DEMOKEY[k]]: id}, data)); else Object.assign(a[i], data); },
  async elimina(k, id){ const a = DEMOCOL[k](), i = a.findIndex(x => x[DEMOKEY[k]] === id); if (i >= 0) a.splice(i, 1); },
  async meta(id, data){ demo.meta = demo.meta || {}; if (data === undefined) return demo.meta[id] || null; demo.meta[id] = Object.assign(demo.meta[id] || {}, data); },
  async tx(k, id, fn){ const x = DEMOCOL[k]().find(r => r[DEMOKEY[k]] === id); if (!x) return null; const out = fn(JSON.parse(JSON.stringify(x))); if (out) Object.assign(x, out); return out; },
  async nuovaFattura(id, anno, crea){
    const a = DEMOCOL.fatt(); if (a.some(x => x.ID === id)) return null;
    demo.meta = demo.meta || {}; const c = demo.meta["fatture-" + anno] = demo.meta["fatture-" + anno] || {ultimo: 0};
    c.ultimo++; const x = crea(c.ultimo); a.push(x); return x;
  }
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
/* ---------- notifiche push gratuite (app installata o browser che le supporta) ---------- */
let WP = null; try { WP = require("web-push"); } catch(_){}
async function chiaviPush(){
  if (!WP) return null;
  let k = await DB.meta("push");
  if (!k || !k.pubblica){ const v = WP.generateVAPIDKeys(); k = {pubblica: v.publicKey, privata: v.privateKey}; await DB.meta("push", k); }
  return k;
}
// testo del messaggio → notifica: senza il prefisso «SocialGlass:» e senza il link in fondo
function corpoPush(testo){ return String(testo || "").replace(/^SocialGlass:\s*/, "").replace(/\s*https?:\/\/\S+\s*$/, "").slice(0, 220); }
async function pushCliente(f, testo, titolo){
  testo = bel(f, testo);
  const subs = Array.isArray(f.Push) ? f.Push : []; if (!subs.length || !WP) return false;
  const k = await chiaviPush(); if (!k) return false;
  const url = linkCliente(f.Univoco, String(f.Ottica1 || "").split(" - ")[0], f.CAF, f.Listino);
  const dati = JSON.stringify({titolo: titolo || "SocialGlass", testo: corpoPush(testo), url});
  let ok = false; const scadute = [];
  for (const s of subs){
    try { await WP.sendNotification(s, dati, {vapidDetails: {subject: "mailto:assistenza@socialglass.it", publicKey: k.pubblica, privateKey: k.privata}, TTL: 172800}); ok = true; }
    catch(e){ if (e.statusCode === 404 || e.statusCode === 410) scadute.push(s.endpoint); else console.error("push", e.statusCode || e.message); }
  }
  if (scadute.length) try { const u = await DB.utente("Univoco", f.Univoco); if (u) await DB.aggiorna(u, {Push: (u.f.Push || []).filter(x => !scadute.includes(x.endpoint))}); } catch(e){ console.error(e); }
  return ok;
}
/* ---------- porta un amico: un canone gratis a chi ha presentato il nuovo cliente, quando questo attiva ----------
   Regola: può portare un amico solo chi ha un abbonamento attivo (attivato e non chiuso); altrimenti «premio mensile non attivabile». */
const PREMIO_NON_ATTIVABILE = "Premio mensile non attivabile: chi ti ha presentato non ha un abbonamento SocialGlass attivo.";
function abbonamentoAttivo(f){ const pg = parseOrdine(f && f.Ordine).pagamento || {}; return !!(pg.attivatoIl && !pg.chiuso); }
async function premiaAmico(u, ord){
  const cod = String(u.f.PresentatoDa || "").toUpperCase(); if (!cod || u.f.AmicoPremiato) return;
  await DB.aggiorna(u, {AmicoPremiato: new Date().toISOString()});
  const r = await DB.utente("Univoco", cod); if (!r) return;
  const ro = parseOrdine(r.f.Ordine), pg = ro.pagamento || {}, rata = Number((ro.prezzi || {}).rata) || 0, ora = new Date().toISOString();
  const voce = {univoco: u.f.Univoco, nome: u.f.Nome || "", il: ora, premio: rata, stato: "da riconoscere"};
  // nel frattempo l'abbonamento di chi lo ha presentato si è chiuso: niente premio
  if (!abbonamentoAttivo(r.f)){
    voce.stato = "non attivabile"; voce.premio = 0;
    ro.amici = (ro.amici || []).filter(x => x.univoco !== voce.univoco).concat([voce]); ro.aggiornato = ora; await DB.aggiorna(r, {Ordine: JSON.stringify(ro)});
    await registra("porta un amico", "premio mensile non attivabile", r.f.Univoco, `amico ${u.f.Univoco}: abbonamento di chi lo ha presentato non attivo`); return;
  }
  if (pg.cliente && !pg.chiuso && rata && CFG.stripeKey){
    try { await stripeApi("POST", `customers/${pg.cliente}/balance_transactions`, {amount: -Math.round(rata * 100), currency: "eur", description: `SocialGlass: un mese gratis, hai presentato ${u.f.Nome || "un amico"}`}, `amico-${u.f.Univoco}`); voce.stato = "accreditato"; }
    catch(e){ voce.motivo = String(e.message).slice(0, 160); }
  } else if (pg.stato === "SIMULATO" || (!CFG.stripeKey && pg.attivatoIl)) voce.stato = "accreditato (prova)";
  ro.amici = (ro.amici || []).filter(x => x.univoco !== voce.univoco).concat([voce]);
  ro.aggiornato = ora; await DB.aggiorna(r, {Ordine: JSON.stringify(ro)});
  await pushCliente(r.f, `SocialGlass: ${nm(r.f.Nome)}, ${nm(u.f.Nome) || "il tuo amico"} si è abbonato grazie a te: ${voce.stato.startsWith("accreditato") ? "il prossimo canone è gratis" : "ti spetta un mese gratis"}. Grazie!`, "Un mese gratis per te");
}
async function avvisa(u, testo){
  testo = bel(u.f, testo);
  const numero = String(u.f.Prefisso || "+39") + String(u.f.Cellulare || "");
  let sms = false;
  if (CFG.smsWebhook && u.f.Cellulare){
    try { const r = await fetch(CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to: numero, text: testo})}); sms = r.ok; } catch(e){}
  }
  const notifica = await pushCliente(u.f, testo).catch(() => false);
  return {sms: sms || notifica, canale: sms ? "sms" : notifica ? "notifica" : "", whatsapp: `https://wa.me/${numero.replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`};
}
// «occhiali pronti»: parte da solo con il canale scelto nelle impostazioni (WhatsApp o SMS);
// se il canale non è collegato resta il link WhatsApp da inviare a mano
async function avvisaPronto(u){
  const ott = String(u.f.Ottica1 || "").split(" - ")[0], link = linkCliente(u.f.Univoco, ott, u.f.CAF, u.f.Listino);
  const testo = `SocialGlass: ${nm(u.f.Nome)}, i tuoi occhiali sono pronti! Passa a ritirarli in ottica con il codice ${u.f.Univoco}. ${link}`;
  const e = await inviaCliente(u.f, testo, [u.f.Nome || "", u.f.Univoco, link], CFG.waTemplatePronto);
  return {sms: e.inviato, inviato: e.inviato, canale: e.canale, motivo: e.motivo || "", testo, whatsapp: `https://wa.me/${numeroCliente(u.f).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`};
}
/* ---------- solleciti di pagamento al cliente ---------- */
const GIORNI_CHIUSURA = 30, PASSI_SOLLECITO = [30, 20, 10, 5, 3, 1];
const canaliCollegati = () => ({whatsapp: !!(CFG.waToken && CFG.waPhone), sms: !!(CFG.smsWebhook || (CFG.twSid && CFG.twToken && CFG.twFrom))});
const numeroCliente = f => { const n = String(f.Cellulare || "").replace(/[^\d+]/g, ""); return n.startsWith("+") ? n : (String(f.Prefisso || "+39") + n.replace(/^0039/, "")); };
function giorniAllaChiusura(ins, ora){ return Math.max(0, Math.ceil(GIORNI_CHIUSURA - (new Date(ora || Date.now()) - new Date(ins.dal)) / 864e5)); }
function testoSollecito(f, ins, giorni, consegnato){
  const imp = Number(ins.importo || 0).toFixed(2).replace(".", ",");
  return `SocialGlass: ${nm(f.Nome)}, il canone di ${imp} € non risulta pagato. ` + (giorni > 0
    ? `Mancano ${giorni} ${giorni === 1 ? "giorno" : "giorni"} alla chiusura dell'abbonamento: dopo, ${consegnato ? "l'occhiale andrà restituito" : "l'ordine sarà annullato"}. `
    : `Oggi l'abbonamento verrà chiuso. `) + `Paga o cambia carta qui: ${ins.link || linkCliente(f.Univoco, String(f.Ottica1 || "").split(" - ")[0], f.CAF, f.Listino)}`;
}
// invia al cliente con il canale scelto nelle impostazioni; se il canale non è collegato il messaggio resta da inviare a mano
// prima la notifica gratuita (se il cliente l'ha attivata), poi il canale scelto
async function inviaCliente(f, testo, param, modello){
  testo = bel(f, testo); param = (param || []).map(p => bel(f, p));
  const notifica = await pushCliente(f, testo).catch(() => false), e = await inviaCanale(f, testo, param, modello);
  if (!e.inviato && notifica) return {canale: "notifica", inviato: true, motivo: ""};
  return notifica ? Object.assign(e, {notifica: true}) : e;
}
async function inviaCanale(f, testo, param, modello){
  const cfg = (await DB.meta("config")) || {}, canale = cfg.canaleSolleciti || "whatsapp", to = numeroCliente(f), c = canaliCollegati();
  if (canale === "spento") return {canale, inviato: false, motivo: "invio automatico disattivato"};
  if (!f.Cellulare) return {canale, inviato: false, motivo: "cellulare mancante"};
  try {
    if (canale === "whatsapp"){
      if (!c.whatsapp) return {canale, inviato: false, motivo: "WhatsApp Business non collegato"};
      const r = await fetch(`https://graph.facebook.com/v21.0/${CFG.waPhone}/messages`, {method: "POST", headers: {Authorization: `Bearer ${CFG.waToken}`, "Content-Type": "application/json"},
        body: JSON.stringify({messaging_product: "whatsapp", to: to.replace(/\D/g, ""), type: "template", template: {name: modello || CFG.waTemplate, language: {code: CFG.waLingua},
          components: [{type: "body", parameters: param.map(t => ({type: "text", text: String(t)}))}]}})});
      const j = await r.json().catch(() => ({}));
      return {canale, inviato: r.ok, motivo: r.ok ? "" : String((j.error && j.error.message) || r.status).slice(0, 200)};
    }
    if (!c.sms) return {canale, inviato: false, motivo: "SMS non collegato"};
    if (CFG.twSid && CFG.twToken && CFG.twFrom){
      const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${CFG.twSid}/Messages.json`, {method: "POST",
        headers: {Authorization: "Basic " + Buffer.from(`${CFG.twSid}:${CFG.twToken}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams({To: to, From: CFG.twFrom, Body: testo})});
      const j = await r.json().catch(() => ({}));
      return {canale, inviato: r.ok, motivo: r.ok ? "" : String(j.message || r.status).slice(0, 200)};
    }
    const r = await fetch(CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to, text: testo})});
    return {canale, inviato: r.ok, motivo: r.ok ? "" : "servizio SMS: " + r.status};
  } catch(e){ return {canale, inviato: false, motivo: String(e.message).slice(0, 200)}; }
}
// conto alla rovescia: un messaggio a 30, 20, 10, 5, 3 e 1 giorno dalla chiusura (mai due nello stesso giorno, mai lo stesso passo due volte)
async function sollecita(u, ord, ora){
  const pg = ord.pagamento || {}, ins = pg.insoluto; if (!ins || ins.tipo === "riscatto" || pg.chiuso) return null;
  const giorni = giorniAllaChiusura(ins, ora), inviati = ins.messaggi || [];
  const passo = PASSI_SOLLECITO.filter(p => giorni <= p && !inviati.some(m => m.passo === p)).pop(); if (passo === undefined) return null;
  if (inviati.some(m => String(m.il).slice(0, 10) === String(ora).slice(0, 10))) return null;
  const consegnato = !!ord.consegnatoIl || u.f.Stato === STATI.CONSEGNATO, testo = testoSollecito(u.f, ins, giorni, consegnato);
  const imp = Number(ins.importo || 0).toFixed(2).replace(".", ",");
  const esito = await inviaCliente(u.f, testo, [u.f.Nome || "", imp, String(giorni), consegnato ? "l'occhiale andrà restituito" : "l'ordine sarà annullato", ins.link || CFG.site]);
  ins.messaggi = inviati.concat([Object.assign({il: ora, passo, giorni, testo}, esito)]).slice(-20);
  return esito;
}
/* ---------- Stripe (API con parametri form) ---------- */
async function stripeApi(method, path, params, chiave){
  const body = new URLSearchParams();
  const add = (k, v) => { if (v === undefined || v === null) return; if (typeof v === "object" && !Array.isArray(v)) for (const [kk, vv] of Object.entries(v)) add(`${k}[${kk}]`, vv); else if (Array.isArray(v)) v.forEach((x, i) => add(`${k}[${i}]`, x)); else body.append(k, String(v)); };
  for (const [k, v] of Object.entries(params || {})) add(k, v);
  const r = await fetch(`https://api.stripe.com/v1/${path}${method === "GET" && params ? "?" + body : ""}`, {method, headers: Object.assign({Authorization: `Bearer ${CFG.stripeKey}`, "Content-Type": "application/x-www-form-urlencoded"}, chiave ? {"Idempotency-Key": chiave} : {}), body: method === "GET" ? undefined : body});
  const j = await r.json(); if (!r.ok) throw new Error(`Stripe: ${j.error && j.error.message}`); return j;
}

// indirizzo del sito da cui arriva la richiesta (vercel.app o dominio), per i link di ritorno
function SITO(req){
  const host = String((req && (req.headers["x-forwarded-host"] || req.headers.host)) || "").split(",")[0].trim();
  return /^[a-z0-9.-]+(:\d+)?$/i.test(host) ? `${/^(localhost|127\.)/.test(host) ? "http" : "https"}://${host}` : CFG.site;
}
// portale clienti di Stripe (cambio carta e ricevute): la configurazione si crea una volta e si riusa
async function portaleStripe(){
  const modo = CFG.stripeKey.startsWith("sk_live") ? "live" : "test", m = (await DB.meta("stripePortale")) || {};
  if (m[modo]) return m[modo];
  const c = await stripeApi("POST", "billing_portal/configurations", {business_profile: {headline: "SocialGlass · il tuo abbonamento occhiale"},
    features: {payment_method_update: {enabled: true}, invoice_history: {enabled: true}, customer_update: {enabled: false}, subscription_cancel: {enabled: false}}}, "portale-" + modo);
  await DB.meta("stripePortale", Object.assign({}, m, {[modo]: c.id}));
  return c.id;
}

/* ---------- rinnovo (CAF o ottico): nuovo occhiale, l'abbonamento Stripe continua ---------- */
async function rinnova(u, {otticoId, caf} = {}){
  const ord = parseOrdine(u.f.Ordine), pg = ord.pagamento || null;
  const storico = (ord.storico || []).concat(ord.montatura ? [{montatura: ord.montatura, lenti: ord.lenti, totale: ord.prezzi && ord.prezzi.totale, rata: ord.prezzi && ord.prezzi.rata, spedizione: ord.prezzi && ord.prezzi.spedizione, inizio: pg && pg.attivatoIl, chiuso: new Date().toISOString(), incassi: incassi(Object.assign({}, ord, {storico: []}))}] : []);
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
  const avviso = await avvisa(u, `SocialGlass: ciao ${nm(u.f.Nome)}, è il momento del tuo occhiale nuovo! Vai da ${o ? o.Intestatario : "la tua ottica"}, scegli la montatura e conferma il nuovo canone dal tuo link: ${link}`);
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
  try { await avviaLavorazione(u, ord); } catch(e){ console.error(e); }
  if (!(ord.storico || []).length) try { await premiaAmico(u, ord); } catch(e){ console.error(e); }
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
  CONSEGNATO: "CONSEGNATO",
  SCADUTO: "LINK SCADUTO",                      // 30 giorni senza attivare: pratica in archivio
  ANONIMO: "ARCHIVIATO (DATI CANCELLATI)"       // altri 30 giorni dopo: dati personali cancellati
};
/* ---------- link del cliente: vale 30 giorni dalla registrazione finché l'abbonamento non è attivato ----------
   Alla scadenza la pratica va in archivio (montatura liberata, link non più valido); i dati personali restano
   in archivio altri 30 giorni e poi si cancellano (resta una traccia anonima). Non vale per chi ha già avuto un abbonamento. */
const GIORNI_LINK = 30, GIORNI_ARCHIVIO = 30;
const LINK_SCADUTO = "Il link è scaduto: sono passati 30 giorni dalla registrazione senza attivare l'abbonamento. Se vuoi ancora i tuoi occhiali, torna al CAF: ti registriamo di nuovo in un minuto.";
function maiAttivato(f){ const o = parseOrdine(f && f.Ordine), pg = o.pagamento || {}; return !pg.attivatoIl && !(o.storico || []).length && !o.rinnovo; }
// chi si registra da ora ha la data scritta nella scheda (LinkFino); per chi era già registrato i 30 giorni partono dal 13/11/2026
const INIZIO_REGOLA_LINK = "2026-11-13T00:00:00.000Z";
function scadenzaLink(f){
  if (!f || f.Archiviato || !f.Creato || !maiAttivato(f) || ![STATI.REGISTRATO, STATI.MONTATURA, STATI.PAGAMENTO].includes(f.Stato)) return null;
  if (f.LinkFino) return f.LinkFino;
  const da = Math.max(new Date(f.Creato).getTime(), new Date(INIZIO_REGOLA_LINK).getTime());
  return new Date(da + GIORNI_LINK * 864e5).toISOString();
}
const giornoIt = d => new Date(d).toLocaleDateString("it-IT", {day: "numeric", month: "long", timeZone: "Europe/Rome"});
// residenza del cliente (serve in fattura): controlla e normalizza
function residenza(r){
  r = r || {}; const x = {indirizzo: String(r.indirizzo || "").trim().slice(0, 80), cap: String(r.cap || "").replace(/\D/g, ""), comune: String(r.comune || "").trim().toUpperCase().slice(0, 60), provincia: String(r.provincia || "").trim().toUpperCase()};
  if (x.indirizzo.length < 4 || !/^\d{5}$/.test(x.cap) || !x.comune || !/^[A-Z]{2}$/.test(x.provincia)) return {errore: "Indirizzo di residenza incompleto: via e numero, CAP di 5 cifre, comune e sigla della provincia."};
  return x;
}
// lenti su misura: dopo l'inizio della lavorazione l'annullamento (recesso) non è più possibile
function inLavorazione(o, stato){
  const lab = o && o.lab;
  return !!(lab && (lab.iniziato || lab.ritirata || lab.stato === "IN LAVORAZIONE" || lab.stato === "PRONTO")) || [STATI.PRONTO, STATI.CONSEGNATO].includes(stato);
}
function annullabile(o, stato){
  const pg = (o && o.pagamento) || {};
  return !!(pg.attivatoIl && !pg.chiuso && !pg.rinnovato && Date.now() - new Date(pg.attivatoIl) <= 14*864e5 && !inLavorazione(o, stato));
}
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

/* ---------- nomi delle persone: «Luca De Rosa» invece di «LUCA DE ROSA» (solo in uscita, i dati salvati non cambiano) ---------- */
const nm = s => String(s == null ? "" : s).toLowerCase().replace(/(^|[\s'’\-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
const bel = (f, s) => typeof s === "string" && f && f.Nome && s.includes(f.Nome) ? s.split(f.Nome).join(nm(f.Nome)) : s;
// in uscita (senza toccare gli oggetti): nome e cognome degli oggetti che rappresentano una persona
const CHIAVI_NOME = new Set(["nome", "cognome", "Nome", "Cognome"]);
function belli(k, v){
  return typeof v === "string" && CHIAVI_NOME.has(k) && this && ("univoco" in this || "Univoco" in this || "cognome" in this || "Cognome" in this) ? nm(v) : v;
}
/* ---------- risposta ---------- */
function send(res, code, data){
  res.statusCode = code;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data, belli));
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
// solo controllo, senza contare un nuovo tentativo
function giaTroppi(key, max, windowMs = 10*60e3){ return (hits.get(key) || []).filter(t => Date.now() - t < windowMs).length >= max; }
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
/* ---------- magazzino montature ----------
   Giacenze: pezzi disponibili per sede ("MAG" = magazzino, oppure il codice dell'ottica dove sono esposte).
   Riservate: pezzi prenotati dai clienti (tolti dalla sede finché l'ordine non è pagato o la prenotazione scade).
   Le schede clienti conservano una copia dei dati della montatura: archiviare un articolo non le tocca. */
const MAG = "MAG";
function scorte(f){
  let g = f.Giacenze, r = f.Riservate;
  if (!g){ const st = String(f.Stato || "DISPONIBILE").toUpperCase(); g = st === "DISPONIBILE" ? {[MAG]: 1} : {}; if (!r) r = st === "RISERVATA" ? [{univoco: "?", ottica: MAG, il: ""}] : []; }
  g = Object.fromEntries(Object.entries(g).map(([k, n]) => [k, Math.max(0, Math.floor(Number(n) || 0))]).filter(([, n]) => n > 0));
  r = Array.isArray(r) ? r.slice() : [];
  return {g, r, tot: Object.values(g).reduce((a, b) => a + b, 0)};
}
function statoMont(f, g, r){ const t = Object.values(g).reduce((a, b) => a + b, 0); return f.Eliminata ? "ARCHIVIATA" : t > 0 ? "DISPONIBILE" : r.length ? "RISERVATA" : "NON DISPONIBILE"; }
function campiScorte(f, g, r, m){
  const tot = Object.values(g).reduce((a, b) => a + b, 0), sotto = tot <= (Number(f.ScortaMinima) || 0);
  return {Giacenze: g, Riservate: r, Stato: statoMont(f, g, r), Movimenti: [Object.assign({il: new Date().toISOString()}, m)].concat(f.Movimenti || []).slice(0, 80),
    // l'avviso di scorta riparte quando la giacenza torna sopra il minimo
    SottoScortaDal: sotto && Number(f.ScortaMinima) > 0 ? (f.SottoScortaDal || new Date().toISOString()) : null};
}
function infoMont(f){
  const {g, r, tot} = scorte(f), min = Number(f.ScortaMinima) || 0;
  return {tot, giacenze: g, riservate: r, esaurita: !f.Eliminata && tot === 0, sottoScorta: !f.Eliminata && min > 0 && tot <= min, avviso: !!f.AvvisoScorta, archiviata: !!f.Eliminata};
}
function disponibile(f, ottica){ if (!f || f.Eliminata) return false; const {g, tot} = scorte(f); return ottica ? (g[ottica] > 0 || g[MAG] > 0) : tot > 0; }
async function riservaMontatura(codice, univoco, ottica){
  let ok = false, sotto = null;
  await DB.tx("mont", codice, f => {
    ok = false; if (f.Eliminata) return null;
    const {g, r} = scorte(f);
    if (r.some(x => x.univoco === univoco)){ ok = true; return null; }
    const da = g[ottica] > 0 ? ottica : g[MAG] > 0 ? MAG : null; if (!da) return null;
    g[da]--; r.push({univoco, ottica: da, il: new Date().toISOString()}); ok = true;
    const out = campiScorte(f, g, r, {tipo: "prenotata", qta: -1, dove: da, cliente: univoco});
    sotto = !f.SottoScortaDal && out.SottoScortaDal ? Object.assign({}, f, out) : null;
    return out;
  });
  if (ok && sotto) await sottoScorta(sotto).catch(e => console.error(e));
  return ok;
}
/* ---------- laboratorio (uno solo, sede "LAB" nel magazzino) ----------
   Quando l'ordine è pagato nasce la lavorazione. Montatura: se il laboratorio ne ha una copia usa quella (e il pezzo
   esposto torna disponibile in ottica); altrimenti il pezzo prenotato dal cliente va ritirato in ottica (o in magazzino). */
const LAB = "LAB";
async function labAttivo(){ const l = (await DB.meta("laboratorio")) || {}; return !!(l.attivo && l.password); }
async function avviaLavorazione(u, ord){
  const codice = ord.montatura && ord.montatura.codice, univoco = u.f.Univoco, ora = new Date().toISOString();
  if (!(await labAttivo())){ if (codice) await liberaMontatura(codice, univoco, true); return; }
  if (ord.lab) return;
  let fonte = "OTTICA", sede = String(u.f.Ottica1 || "").split(" - ")[0];
  if (codice) await DB.tx("mont", codice, f => {
    const {g, r} = scorte(f);
    let i = r.findIndex(x => x.univoco === univoco); if (i < 0) i = r.findIndex(x => x.univoco === "?");
    const x = i >= 0 ? r.splice(i, 1)[0] : null;
    if ((g[LAB] || 0) > 0){
      g[LAB]--; if (x) g[x.ottica] = (g[x.ottica] || 0) + 1; fonte = "LAB"; sede = LAB;
      return campiScorte(f, g, r, {tipo: "uscita cliente (copia del laboratorio)", qta: -1, dove: LAB, cliente: univoco});
    }
    if (!x) return null;
    fonte = x.ottica === MAG ? "MAG" : "OTTICA"; sede = x.ottica;
    return campiScorte(f, g, r, {tipo: "uscita cliente (da ritirare per il laboratorio)", qta: 0, dove: x.ottica, cliente: univoco});
  });
  ord.lab = {stato: "DA FARE", fonte, sede, creato: ora};
  if (fonte === "OTTICA"){ ord.avvisi = ord.avvisi || {}; ord.avvisi["lab" + ora.slice(0, 10)] = {il: ora, testo: `Il laboratorio ritirerà la montatura ${codice} esposta in ottica: mettila da parte con il codice cliente ${univoco}.`}; }
  ord.aggiornato = ora;
  await DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
}
// rilascia: il pezzo torna nella sede da cui era stato preso; scarica: esce dal magazzino (ordine pagato)
async function liberaMontatura(codice, univoco, scarico){
  if (!codice) return;
  await DB.tx("mont", codice, f => {
    const {g, r} = scorte(f);
    let i = r.findIndex(x => x.univoco === univoco); if (i < 0) i = r.findIndex(x => x.univoco === "?"); if (i < 0) return null;
    const [x] = r.splice(i, 1);
    if (!scarico) g[x.ottica] = (g[x.ottica] || 0) + 1;
    return campiScorte(f, g, r, {tipo: scarico ? "uscita cliente" : "prenotazione annullata", qta: scarico ? 0 : 1, dove: x.ottica, cliente: univoco});
  });
}
// avviso di esaurimento (SMS al titolare se l'invio SMS è collegato) e riordino automatico se attivo sul fornitore
async function sottoScorta(f){
  if (f.AvvisoScorta && CFG.smsWebhook){
    const t = (await DB.meta("titolare")) || {};
    if (t.telefono) try { await fetch(CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to: t.telefono, text: `SocialGlass magazzino: ${f.Codice} ${f.Modello || ""} ${f.Colore || ""} sotto la scorta minima (${scorte(f).tot} rimasti).`})}); } catch(e){}
  }
  if (f.Fornitore) await riordinoAuto(f.Fornitore);
}
// proposta di riordino per un fornitore: articoli sotto scorta, meno quanto è già in bozza o in arrivo
function proposta(articoli, ordini, fornitore){
  const aperti = ordini.filter(o => o.Fornitore === fornitore && ["BOZZA", "INVIATO"].includes(o.Stato));
  const inArrivo = c => aperti.reduce((s, o) => s + (o.Righe || []).filter(x => x.codice === c).reduce((a, x) => a + (Number(x.qta) || 0), 0), 0);
  const out = [];
  for (const f of articoli){
    if (f.Fornitore !== fornitore || f.Eliminata) continue;
    const min = Number(f.ScortaMinima) || 0, {tot} = scorte(f); if (!min || tot > min) continue;
    const serve = Number(f.RiordinoQta) > 0 ? Number(f.RiordinoQta) : Math.max(1, min * 2 - tot), gia = inArrivo(f.Codice);
    if (gia >= serve) continue;
    out.push({codice: f.Codice, codiceFornitore: f.CodiceFornitore || "", descrizione: `${f.Modello || ""} ${f.Colore || ""} ${f.Calibro || ""}`.trim(), qta: serve - gia, costo: Number(f.Costo) || 0, giacenza: tot, minimo: min, inArrivo: gia});
  }
  return out;
}
async function riordinoAuto(fornitore){
  const fo = (await DB.lista("forn")).find(x => (x.ID || x._id) === fornitore); if (!fo || !fo.RiordinoAuto) return null;
  const ordini = await DB.lista("ordForn"), righe = proposta(await DB.lista("mont"), ordini, fornitore); if (!righe.length) return null;
  const bozza = ordini.find(o => o.Fornitore === fornitore && o.Stato === "BOZZA"), ora = new Date().toISOString();
  if (bozza){
    const r = (bozza.Righe || []).slice();
    for (const x of righe){ const y = r.find(z => z.codice === x.codice); if (y) y.qta = (Number(y.qta) || 0) + x.qta; else r.push(x); }
    await DB.salva("ordForn", bozza.ID || bozza._id, {Righe: r, Aggiornato: ora, Auto: true}); return bozza.ID || bozza._id;
  }
  const id = `RO-${ora.slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;
  await DB.salva("ordForn", id, {ID: id, Fornitore: fornitore, Stato: "BOZZA", Righe: righe, Creato: ora, Aggiornato: ora, Auto: true});
  return id;
}
// Situazione dell'anagrafica: morosità (canone non pagato o chiusura per mancato pagamento) e blocco.
// Blocco.stato: "bloccato" (deciso dall'amministratore), "sbloccato" (sblocco forzato nonostante la morosità), assente = automatico.
const dataIt = d => d ? new Date(d).toLocaleDateString("it-IT", {timeZone: "Europe/Rome"}) : "";
function situazione(f){
  const o = parseOrdine(f.Ordine), pg = o.pagamento || {}, b = f.Blocco || {};
  const chiusoMoroso = /MANCATO PAGAMENTO/.test(pg.esito || "");
  const moroso = !!pg.insoluto || chiusoMoroso, motivi = [];
  if (pg.insoluto) motivi.push(`${pg.insoluto.tipo === "riscatto" ? "Riscatto" : "Canone"} non pagato dal ${dataIt(pg.insoluto.dal)}${pg.insoluto.importo ? ` (${Number(pg.insoluto.importo).toFixed(2).replace(".", ",")} €)` : ""}`);
  if (chiusoMoroso) motivi.push(pg.esito);
  if (b.stato === "bloccato") motivi.push("Blocco dell'amministratore: " + (b.motivo || "senza motivo indicato"));
  if (b.stato === "sbloccato" && moroso) motivi.push("Sbloccato dall'amministratore: " + (b.motivo || "senza nota"));
  return {moroso, bloccato: b.stato === "bloccato" || (moroso && b.stato !== "sbloccato"), motivi, blocco: b.stato ? b : null};
}
const BLOCCATO = {errore: "Anagrafica bloccata: nessuna operazione è possibile. Contatta l'amministratore di SocialGlass.", bloccato: true};
// Incassi di un ordine (pagati dal cliente a SocialGlass tramite Stripe): dallo storico dei pagamenti se c'è,
// altrimenti ricostruiti dai canoni pagati (un canone al mese dall'attivazione, la spedizione con il primo)
function incassi(o){
  const pg = o.pagamento || {}, pr = o.prezzi || {}, rata = Number(pr.rata) || 0, out = [];
  for (const s of o.storico || []) for (const x of s.incassi || []) out.push(x);
  if (!pg.attivatoIl || pg.stato === "SIMULATO") return out;
  const reali = Array.isArray(pg.pagamenti) ? pg.pagamenti : [];
  // canoni pagati prima che esistesse lo storico: ricostruiti
  const mancanti = Math.max(0, (pg.ratePagate || 0) - reali.filter(x => x.canone > 0).length);
  for (let i = 0; i < mancanti; i++) out.push({il: PREZZI.addMesi(pg.attivatoIl, i).toISOString(), canone: rata, spedizione: i === 0 ? Number(pr.spedizione) || 0 : 0, riscatto: 0, stima: true});
  if (reali.length) return out.concat(reali.map(x => ({il: x.il, canone: x.canone || 0, spedizione: x.spedizione || 0, riscatto: x.riscatto || 0})));
  for (let i = mancanti; i < (pg.ratePagate || 0); i++) out.push({il: PREZZI.addMesi(pg.attivatoIl, i).toISOString(), canone: rata, spedizione: i === 0 ? Number(pr.spedizione) || 0 : 0, riscatto: 0, stima: true});
  if (pg.riscatto && pg.riscatto.pagato) out.push({il: pg.riscatto.pagato, canone: 0, spedizione: 0, riscatto: Number(pr.riscatto) || 0, stima: true});
  return out;
}
/* ---------- estratto conto di CAF e ottiche verso SocialGlass ----------
   Movimenti a credito del partner: compensi secondo l'accordo (fisso per abbonamento attivato, oppure % su ogni canone pagato).
   Movimenti a debito: pagamenti di SocialGlass al partner (acconti, saldi), registrati dall'amministratore. */
const e2 = x => Number(x || 0).toFixed(2).replace(".", ",") + " €";
function liquidazioniDi(acc){
  const l = Array.isArray(acc && acc.Liquidazioni) ? acc.Liquidazioni.slice() : [];
  const vecchio = Number(((acc && acc.Compenso) || {}).liquidato) || 0;
  if (!l.length && vecchio > 0) l.push({id: "precedenti", il: "2000-01-01", importo: vecchio, causale: "pagamenti precedenti", metodo: "", nota: ""});
  return l;
}
// storico degli accordi: ogni accordo vale dal giorno in cui è stato impostato, quelli vecchi restano per i movimenti precedenti
// compenso di base quando l'amministratore non ha impostato un accordo (importi IVA compresa):
// ottica = una rata + la spedizione del cliente per ogni abbonamento attivato; CAF = 3 € per ogni abbonamento attivato
const COMPENSO_BASE = {ottica: {tipo: "rata", valore: 0}, caf: {tipo: "fisso", valore: 3}};
function accordiDi(acc, ruolo){
  let l = Array.isArray(acc && acc.Accordi) ? acc.Accordi.slice() : [];
  const c = (acc && acc.Compenso) || {};
  if (!l.length && c.tipo) l = [{dal: "2000-01-01", tipo: c.tipo, valore: Number(c.valore) || 0}];
  if (!l.length && COMPENSO_BASE[ruolo]) l = [Object.assign({dal: "2000-01-01", base: true}, COMPENSO_BASE[ruolo])];
  return l.sort((x, y) => String(x.dal).localeCompare(String(y.dal)));
}
function accordoAl(l, d){ const g = String(d || "").slice(0, 10); let r = null; for (const x of l) if (String(x.dal) <= g) r = x; return r && r.tipo && (Number(r.valore) || r.tipo === "rata") ? r : null; }
function righeCompenso(utenti, acc, ruolo){
  const l = accordiDi(acc, ruolo), out = []; if (!l.length) return out;
  const pc = v => String(v).replace(".", ",");
  for (const f of utenti){
    const o = parseOrdine(f.Ordine), pg = o.pagamento || {}, base = {univoco: f.Univoco, cliente: `${nm(f.Nome)} ${nm(f.Cognome)}`.trim()};
    const pr = o.prezzi || {};
    const attivazioni = (o.storico || []).filter(st => st.inizio).map(st => ({il: st.inizio, prec: true, rata: Number(st.rata) || 0, sped: st.spedizione != null ? Number(st.spedizione) || 0 : Number(pr.spedizione) || 0}))
      .concat(pg.attivatoIl && pg.stato !== "SIMULATO" ? [{il: pg.attivatoIl, rata: Number(pr.rata) || 0, sped: Number(pr.spedizione) || 0}] : []);
    for (const x of attivazioni){ const ac = accordoAl(l, x.il), dopo = x.prec ? " (periodo precedente)" : "";
      if (ac && ac.tipo === "fisso") out.push(Object.assign({il: x.il, descrizione: `Abbonamento attivato${dopo} · ${e2(ac.valore)}`, importo: Number(ac.valore)}, base));
      if (ac && ac.tipo === "rata") out.push(Object.assign({il: x.il, descrizione: `Abbonamento attivato${dopo} · una rata ${e2(x.rata)} + spedizione ${e2(x.sped)}`, importo: Math.round((x.rata + x.sped) * 100) / 100}, base)); }
    for (const x of incassi(o)) if (x.canone > 0){ const ac = accordoAl(l, x.il); if (ac && ac.tipo === "percentuale") out.push(Object.assign({il: x.il, descrizione: `Canone pagato ${e2(x.canone)} × ${pc(ac.valore)}%`, importo: Math.round(x.canone * ac.valore) / 100, stima: !!x.stima}, base)); }
  }
  return out;
}
function estratto(utenti, acc, da, a, ruolo){
  const g = d => String(d || "").slice(0, 10), r2 = x => Math.round(x * 100) / 100, c = (acc && acc.Compenso) || {};
  const tutte = righeCompenso(utenti, acc, ruolo).map(x => Object.assign({tipo: "compenso"}, x))
    .concat(liquidazioniDi(acc).map(x => ({tipo: "pagamento", id: x.id, il: x.il, descrizione: [x.causale || "pagamento", x.metodo, x.nota].filter(Boolean).join(" · "), importo: Number(x.importo) || 0})))
    .sort((x, y) => g(x.il).localeCompare(g(y.il)) || (x.tipo === "pagamento") - (y.tipo === "pagamento"));
  let saldoIniziale = 0, maturato = 0, pagato = 0, maturatoTot = 0, pagatoTot = 0, stima = false; const righe = [];
  for (const x of tutte){
    const segno = x.tipo === "compenso" ? 1 : -1;
    if (x.tipo === "compenso") maturatoTot += x.importo; else pagatoTot += x.importo;
    if (da && g(x.il) < da){ saldoIniziale += segno * x.importo; continue; }
    if (a && g(x.il) > a) continue;
    if (x.tipo === "compenso") maturato += x.importo; else pagato += x.importo;
    if (x.stima) stima = true;
    righe.push(Object.assign({}, x, {importo: r2(x.importo)}));
  }
  let prog = saldoIniziale; righe.forEach(x => { prog += (x.tipo === "compenso" ? 1 : -1) * x.importo; x.saldo = r2(prog); });
  const storia = accordiDi(acc, ruolo), att = storia[storia.length - 1];
  return {accordo: att && att.tipo ? {tipo: att.tipo, valore: Number(att.valore) || 0, dal: att.dal, base: !!att.base} : null, accordi: storia, periodo: {da: da || "", a: a || ""}, righe, stima,
    saldoIniziale: r2(saldoIniziale), maturato: r2(maturato), pagato: r2(pagato), saldoFinale: r2(saldoIniziale + maturato - pagato),
    maturatoTot: r2(maturatoTot), pagatoTot: r2(pagatoTot), saldoAttuale: r2(maturatoTot - pagatoTot)};
}
/* ---------- previsione incassi: canoni ancora da ricevere fino alla fine della durata minima di ogni abbonamento ----------
   Per mese: numero di canoni, importo, quota di clienti morosi (a rischio), compensi % previsti con gli accordi in vigore oggi. */
function previsione(utenti, cafs, ottici, ora){
  const now = ora ? new Date(ora) : new Date(), mesi = [], r2 = x => Math.round(x * 100) / 100;
  for (let i = 0; i < 12; i++){ const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + i, 1)); mesi.push({mese: d.toISOString().slice(0, 7), canoni: 0, importo: 0, rischio: 0, compensi: 0, clienti: new Set()}); }
  const acc = (l, id) => { const x = l.find(y => (y.ID || y._id) === id), a = x ? accordiDi(x) : []; const u = a[a.length - 1]; return u && u.tipo === "percentuale" ? Number(u.valore) || 0 : 0; };
  let oltre = 0, ultimo = "";
  for (const f of utenti){
    const o = parseOrdine(f.Ordine), pg = o.pagamento || {}, pr = o.prezzi || {};
    if (!pg.attivatoIl || pg.chiuso || pg.stato === "SIMULATO" || !pr.rata) continue;
    const n = Number(pr.mesi) || 12, rata = Number(pr.rata), moroso = !!pg.insoluto, perc = acc(cafs, f.CAF) + acc(ottici, String(f.Ottica1 || "").split(" - ")[0]);
    for (let k = pg.ratePagate || 0; k < n; k++){
      let d = PREZZI.addMesi(pg.attivatoIl, k); if (d < now) d = now;   // canone già scaduto e non pagato: va nel mese corrente
      const m = mesi.find(x => x.mese === d.toISOString().slice(0, 7));
      if (!m){ oltre += rata; continue; }
      m.canoni++; m.importo += rata; if (moroso) m.rischio += rata; m.compensi += rata * perc / 100; m.clienti.add(f.Univoco);
      if (d.toISOString() > ultimo) ultimo = d.toISOString();
    }
  }
  return {mesi: mesi.map(m => ({mese: m.mese, canoni: m.canoni, clienti: m.clienti.size, importo: r2(m.importo), rischio: r2(m.rischio), compensi: r2(m.compensi), netto: r2(m.importo - m.compensi)})), oltre: r2(oltre), ultimo};
}
// Conteggi con CAF e ottiche, filtrabili per periodo (da/a = AAAA-MM-GG, inclusi).
// Compenso secondo l'accordo: fisso per abbonamento attivato nel periodo, oppure percentuale sui canoni incassati nel periodo.
function conteggi(utenti, acc, da, a, ruolo){
  const dentro = d => d && (!da || String(d).slice(0, 10) >= da) && (!a || String(d).slice(0, 10) <= a);
  const c = (acc && acc.Compenso) || {}, v = Number(c.valore) || 0, r2 = x => Math.round(x * 100) / 100;
  let clienti = 0, attivati = 0, attivi = 0, consegnati = 0, canoni = 0, spedizioni = 0, riscatti = 0, stima = false, attTot = 0, canTot = 0;
  for (const f of utenti){
    const o = parseOrdine(f.Ordine), pg = o.pagamento || {};
    if (dentro(f.Creato) || (!da && !a)) clienti++;
    const reale = pg.attivatoIl && pg.stato !== "SIMULATO";
    if (reale){ attTot++; if (dentro(pg.attivatoIl)) attivati++; if (!pg.chiuso) attivi++; }
    if (o.consegnatoIl ? dentro(o.consegnatoIl) : (!da && !a && f.Stato === STATI.CONSEGNATO)) consegnati++;
    for (const x of incassi(o)){ canTot += x.canone || 0; if (!dentro(x.il)) continue; canoni += x.canone || 0; spedizioni += x.spedizione || 0; riscatti += x.riscatto || 0; if (x.stima) stima = true; }
  }
  const righe = righeCompenso(utenti, acc, ruolo), st = accordiDi(acc, ruolo), ult = st[st.length - 1];
  const maturatoTot = righe.reduce((t, x) => t + x.importo, 0), liquidato = liquidazioniDi(acc).reduce((t, x) => t + (Number(x.importo) || 0), 0);
  return {periodo: {da: da || "", a: a || ""}, clienti, attivati, attivi, consegnati, canoni: r2(canoni), spedizioni: r2(spedizioni), riscatti: r2(riscatti),
    incassati: r2(canoni + spedizioni + riscatti), stima, accordo: ult && ult.tipo ? {tipo: ult.tipo, valore: Number(ult.valore) || 0, base: !!ult.base} : null,
    maturato: r2(righe.filter(x => dentro(x.il)).reduce((t, x) => t + x.importo, 0)), maturatoTotale: r2(maturatoTot), liquidato: r2(liquidato), saldo: r2(maturatoTot - liquidato)};
}

/* ---------- listini modificabili dall'amministratore (sostituiscono quelli di listini.js) ---------- */
const LISTINI_BASE = JSON.parse(JSON.stringify(PREZZI.LISTINI.convenzioni));
async function caricaListini(){
  let m = null; try { m = await DB.meta("listini"); } catch(e){ console.error(e); }
  let c = null; try { c = m && m.json ? JSON.parse(m.json) : null; } catch(_){}
  const conv = PREZZI.LISTINI.convenzioni;
  for (const k of Object.keys(conv)) delete conv[k];
  // una volta salvati dal pannello valgono solo quelli (così un listino cancellato non ritorna)
  Object.assign(conv, c && Object.keys(c).length ? c : JSON.parse(JSON.stringify(LISTINI_BASE)));
  return conv;
}
async function salvaListini(conv){ await DB.meta("listini", {json: JSON.stringify(conv), il: new Date().toISOString()}); return caricaListini(); }

/* ---------- appuntamenti in ottica (scelta, ritiro, controllo vista) ---------- */
const ORARI_BASE = {giorni: [1, 2, 3, 4, 5, 6], fasce: ["09:30-12:30", "16:00-19:30"], durata: 30};
// data e ora di Roma come testo «AAAA-MM-GGTHH:MM» (si confrontano come stringhe)
const oraRoma = d => new Intl.DateTimeFormat("sv-SE", {timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false}).format(d || new Date()).replace(" ", "T");
const orariDi = o => { const x = (o && o.Orari) || {}; return {giorni: Array.isArray(x.giorni) && x.giorni.length ? x.giorni.map(Number) : ORARI_BASE.giorni,
  fasce: Array.isArray(x.fasce) && x.fasce.length ? x.fasce : ORARI_BASE.fasce, durata: [15, 20, 30, 45, 60].includes(Number(x.durata)) ? Number(x.durata) : ORARI_BASE.durata}; };
const FASCIA = /^([01]\d|2[0-3]):([0-5]\d)-([01]\d|2[0-3]):([0-5]\d)$/;
function slotLiberi(o, agenda, giorni){
  const or = orariDi(o), presto = oraRoma(new Date(Date.now() + 2 * 3600e3)), out = [], oggi = oraRoma().slice(0, 10);
  for (let i = 0; i < (giorni || 14); i++){
    const g = new Date(Date.parse(oggi + "T12:00:00Z") + i * 864e5), data = g.toISOString().slice(0, 10);
    if (!or.giorni.includes(g.getUTCDay())) continue;
    const slot = [];
    for (const f of or.fasce){ const m = FASCIA.exec(f); if (!m) continue;
      for (let t = +m[1] * 60 + +m[2]; t + or.durata <= +m[3] * 60 + +m[4]; t += or.durata){
        const s = `${data}T${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
        if (s > presto && !(agenda && agenda[s])) slot.push(s.slice(11)); } }
    if (slot.length) out.push({data, slot});
  }
  return out;
}
const TIPI_APP = {scelta: "Scelta della montatura", ritiro: "Ritiro degli occhiali", controllo: "Controllo della vista", altro: "Assistenza"};

/* ---------- registro delle operazioni: chi ha fatto cosa e quando ---------- */
async function registra(chi, azione, rif, dettaglio){
  const il = new Date().toISOString(), id = il.replace(/\D/g, "") + "-" + crypto.randomBytes(3).toString("hex");
  try { await DB.salva("registro", id, {ID: id, il, chi: String(chi || "").slice(0, 60), azione: String(azione || "").slice(0, 80), rif: String(rif || "").slice(0, 60), dettaglio: String(dettaglio || "").slice(0, 300)}); }
  catch(e){ console.error("registro", e); }
}
// registra l'operazione solo se è andata a buon fine, prima che la risposta parta
function registraEsito(res, chi, azione, rif, dettaglio){
  const fine = res.end.bind(res);
  res.end = body => { if (res.statusCode < 300) registra(chi, azione, rif, dettaglio).finally(() => fine(body)); else fine(body); };
}

/* ---------- copia dei dati ogni notte (ultime 7), scaricabile dal pannello ---------- */
const RACCOLTE_COPIA = ["utenti", "caf", "ottLogin", "ottici", "mont", "forn", "ordForn", "segn"];
async function datiCompleti(){
  const out = {creata: new Date().toISOString(), raccolte: {}};
  for (const k of RACCOLTE_COPIA) try { out.raccolte[k] = k === "utenti" ? (await DB.tutti()).map(u => Object.assign({_id: u.id}, u.f)) : await DB.lista(k); } catch(e){ out.raccolte[k] = {errore: String(e.message).slice(0, 200)}; }
  for (const m of ["config", "push", "stripePortale"]) try { (out.meta = out.meta || {})[m] = await DB.meta(m); } catch(_){}
  return out;
}
async function copiaNotturna(){
  const data = oraRoma().slice(0, 10), idx = (await DB.meta("copie")) || {}, elenco = (idx.elenco || []).filter(x => x.data !== data);
  const testo = JSON.stringify(await datiCompleti()), PEZZO = 300000, n = Math.ceil(testo.length / PEZZO);
  for (let i = 0; i < n; i++) await DB.salva("copie", `${data}-${i}`, {ID: `${data}-${i}`, data, parte: i, di: n, testo: testo.slice(i * PEZZO, (i + 1) * PEZZO)});
  elenco.unshift({data, parti: n, byte: testo.length});
  for (const v of elenco.slice(7)) for (let i = 0; i < v.parti; i++) try { await DB.elimina("copie", `${v.data}-${i}`); } catch(_){}
  await DB.meta("copie", {elenco: elenco.slice(0, 7)});
  return {data, parti: n, byte: testo.length};
}
async function leggiCopia(data){
  const idx = (await DB.meta("copie")) || {}, v = (idx.elenco || []).find(x => x.data === data); if (!v) return null;
  let t = ""; for (let i = 0; i < v.parti; i++){ const p = await DB.uno("copie", `${data}-${i}`); if (!p) return null; t += p.testo; }
  return t;
}

module.exports = {GIORNI_LINK, GIORNI_ARCHIVIO, LINK_SCADUTO, maiAttivato, scadenzaLink, giornoIt, PREMIO_NON_ATTIVABILE, abbonamentoAttivo, residenza, inLavorazione, annullabile, COMPENSO_BASE, giaTroppi, caricaListini, salvaListini, inviaCanale, nm, SITO, portaleStripe, oraRoma, orariDi, slotLiberi, TIPI_APP, FASCIA, registra, registraEsito, datiCompleti, copiaNotturna, leggiCopia, incassi, chiaviPush, pushCliente, premiaAmico, avvisaPronto, LAB, labAttivo, avviaLavorazione, previsione, accordiDi, estratto, liquidazioniDi, incassi, canaliCollegati, numeroCliente, giorniAllaChiusura, testoSollecito, inviaCliente, sollecita, GIORNI_CHIUSURA, MAG, scorte, infoMont, disponibile, riservaMontatura, liberaMontatura, campiScorte, proposta, riordinoAuto, sottoScorta, situazione, BLOCCATO, conteggi, dataIt, hashPw, checkPw, PROVA, ipDi, bloccato, codiceErrato, TROPPI, avvisa, stripeApi, rinnova, attiva, verificaPagamento, CFG, MODO, DEMO, demo, DB, STATI, parseOrdine, linkCliente, nuovoUnivoco, sign, verify, safeEq, send, readRaw, readBody, tooMany, wrap, CF, PREZZI, NOAUTH};
