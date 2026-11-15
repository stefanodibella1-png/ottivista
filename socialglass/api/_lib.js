// SocialGlass · funzioni comuni del server (Vercel). Le chiavi restano qui, mai nel browser.
const crypto = require("crypto");
const CF = require("../cf.js");
/* ---------- codice fiscale falso o «di comodo» ----------
   Oltre a controllo e coerenza con nome, cognome, data e sesso: il comune (o stato estero) di nascita nel codice deve esistere
   e corrispondere al luogo di nascita dichiarato; la stessa persona non può avere due codici (varianti con omocodia o con un altro comune). */
const COMUNI = require("./_comuni");
const normLuogo = s => String(s || "").toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
const normNome = s => String(s || "").toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
const chiavePersona = (nome, cognome, data) => `${normNome(cognome)}|${normNome(nome)}|${String(data || "").slice(0, 10)}`;
function luoghiCF(cf){ const c = CF.canonico(cf), v = COMUNI[c.slice(11, 15)]; return v ? v.split(";").map(x => { const [nome, prov] = x.split("|"); return {nome, prov}; }) : []; }
function controlloCF(d){
  if (!CF.valido(d.cf)) return "CODICE FISCALE NON VALIDO";
  if (!CF.coerente(d.cf, d.nome, d.cognome, d.data, d.sesso)) return "Codice fiscale non conforme a nome, cognome, data di nascita e sesso.";
  const luoghi = luoghiCF(d.cf), cod = CF.canonico(d.cf).slice(11, 15);
  if (!luoghi.length) return `Il codice fiscale indica un luogo di nascita che non esiste (${cod}): controlla il codice sulla tessera sanitaria.`;
  if (d.nato && !luoghi.some(x => normLuogo(x.nome) === normLuogo(d.nato)))
    return `Il luogo di nascita non corrisponde al codice fiscale: il codice indica ${luoghi.map(x => x.nome + (x.prov !== "EE" ? ` (${x.prov})` : "")).join(" o ")}. Controlla sul documento.`;
  return null;
}
// cliente già registrato con lo stesso codice (anche scritto con l'omocodia)
async function clientePerCF(cf){
  const c = CF.canonico(cf); if (!c) return null;
  return (await DB.utente("CFBase", c)) || (await DB.utente("Codice Fiscale", c)) || (c !== String(cf).toUpperCase().trim() ? await DB.utente("Codice Fiscale", String(cf).toUpperCase().trim()) : null);
}
// stessa persona (nome, cognome e data di nascita) già registrata con un codice fiscale diverso
async function stessaPersona(nome, cognome, data, cf, escludi){
  const u = await DB.utente("Persona", chiavePersona(nome, cognome, data));
  return u && !u.f.Archiviato && u.id !== escludi && CF.canonico(u.f["Codice Fiscale"]) !== CF.canonico(cf) ? u : null;
}
const campiCF = (cf, nome, cognome, data) => ({CFBase: CF.canonico(cf), Persona: chiavePersona(nome, cognome, data)});
const PREZZI = require("../listini.js");
const {AsyncLocalStorage} = require("async_hooks");

/* ---------- fondamenta dei passaggi (mappa approvata il 14/11/2026) ----------
   Ogni scrittura del cliente: 1) controlla la versione letta (se nel frattempo qualcuno ha cambiato l'ordine → Conflitto),
   2) scrive tutto insieme, 3) aumenta la versione, 4) aggiunge una riga allo storico «Passi» se cambia uno stato. */
const contesto = new AsyncLocalStorage();
const chiAgisce = () => (contesto.getStore() || {}).chi || "sistema";
function chi(nome, azione){ const s = contesto.getStore(); if (s){ if (nome) s.chi = nome; if (azione) s.az = azione; } }
class Conflitto extends Error { constructor(){ super("L'ordine è appena cambiato: ricarica la pagina e riprova."); this.conflitto = true; } }
const versioneDi = f => Number((f && f.Versione) || 0);
function riassunto(f){
  const o = parseOrdine(f.Ordine), pg = o.pagamento || {};
  return {stato: f.Stato || "", lab: (o.lab && o.lab.stato) || "", pag: o.pagamento ? (pg.chiuso ? "CHIUSO" : pg.insoluto ? "INSOLUTO" : String(pg.stato || "")) : ""};
}
const testoRiassunto = r => [r.stato, r.lab && "lab " + r.lab, r.pag && "pagamento " + r.pag].filter(Boolean).join(" · ");
// prepara la scrittura: stato CHIUSO quando il contratto è finito, versione +1, riga di storico se cambia qualcosa
function preparaScrittura(cur, fields){
  const out = Object.assign({}, fields), dopo = Object.assign({}, cur, out);
  const o = parseOrdine(dopo.Ordine), pg = o.pagamento || {};
  if (pg.chiuso && [STATI.ATTIVO, STATI.PRONTO, STATI.CONSEGNATO].includes(dopo.Stato)){ out.Stato = dopo.Stato = STATI.CHIUSO; }
  out.Versione = versioneDi(cur) + 1;
  // annullo dell'ultimo passaggio (D6): si tiene la fotografia di prima; le altre scritture della stessa richiesta la portano avanti
  const st = contesto.getStore() || {};
  if (st.ann && !st.annId){
    st.annId = crypto.randomBytes(6).toString("hex");
    out.Annullabile = {id: st.annId, il: new Date().toISOString(), chi: st.chi || "sistema", az: st.ann.az, testo: st.ann.testo, versione: out.Versione, prima: {Stato: cur.Stato || "", Ordine: cur.Ordine || "{}"}};
  } else if (st.annId && cur.Annullabile && cur.Annullabile.id === st.annId) out.Annullabile = Object.assign({}, cur.Annullabile, {versione: out.Versione});
  const a = riassunto(cur), b = riassunto(dopo);
  if (a.stato !== b.stato || a.lab !== b.lab || a.pag !== b.pag){
    const s = contesto.getStore() || {};
    const riga = {il: new Date().toISOString(), chi: s.chi || "sistema", da: testoRiassunto(a), a: testoRiassunto(b)};
    if (s.az) riga.az = s.az;
    out.Passi = (Array.isArray(cur.Passi) ? cur.Passi : []).concat(riga).slice(-300);
  }
  return out;
}

// passaggi annullabili entro 30 minuti da chi li ha fatti (D6): non la consegna con codice, non i pagamenti, non i movimenti di magazzino
const ANNULLABILI = {lab: ["ritirata", "inizia", "pronto", "spedito"], ottico: ["arrivato", "montaturaSpedita", "pronto"]};
const MIN_ANNULLA = 30;
function segnaAnnullabile(az, testo){ const s = contesto.getStore(); if (s) s.ann = {az, testo}; }
function annullabileDa(f, nome){
  const a = f && f.Annullabile; if (!a || !a.prima || a.chi !== nome) return null;
  const fino = new Date(a.il).getTime() + MIN_ANNULLA * 60e3;
  if (Date.now() > fino || Number(a.versione) !== versioneDi(f)) return null;
  return {az: a.az, testo: a.testo, fino: new Date(fino).toISOString()};
}
async function annullaUltimo(u){
  const nome = chiAgisce(), a = annullabileDa(u.f, nome);
  if (!a) return {errore: `Non c'è niente da annullare: si annulla solo il tuo ultimo passaggio, entro ${MIN_ANNULLA} minuti e se nel frattempo non è cambiato altro.`};
  const prima = u.f.Annullabile.prima;
  chi(null, "annullato: " + a.testo);
  await DB.aggiorna(u, {Stato: prima.Stato, Ordine: prima.Ordine, Annullabile: null});
  return {ok: true, annullato: a.testo, stato: u.f.Stato};
}

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
  secret: E.SESSION_SECRET || "solo-per-prova-cambiami",   // in produzione è obbligatoria: senza, wrap() risponde 503
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
    if (by === "Univoco"){ const d = await db.collection(COL.utenti).doc(String(val)).get(); return d.exists ? {id: d.id, f: d.data(), v: versioneDi(d.data())} : null; }
    const {FieldPath} = require("firebase-admin/firestore");
    const r = await db.collection(COL.utenti).where(new FieldPath(by), "==", val).limit(1).get();
    return r.empty ? null : {id: r.docs[0].id, f: r.docs[0].data(), v: versioneDi(r.docs[0].data())};
  },
  async utenti(filtro){
    const c = (await fdb()).collection(COL.utenti);
    const r = filtro.caf ? await c.where("CAF", "==", filtro.caf).get()
      : await c.where("Ottica1", ">=", filtro.ottico + " ").where("Ottica1", "<", filtro.ottico + " \uf8ff").get();
    return r.docs.map(d => ({id: d.id, f: d.data(), v: versioneDi(d.data())})).sort((a, b) => String(b.f.Creato || "").localeCompare(String(a.f.Creato || "")));
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
  async tutti(){ return (await (await fdb()).collection(COL.utenti).get()).docs.map(d => ({id: d.id, f: d.data(), v: versioneDi(d.data())})); },
  // campi che non riguardano l'ordine (iscrizioni alle notifiche): niente versione, così non fanno scattare conflitti
  async campi(u, fields){ await (await fdb()).collection(COL.utenti).doc(u.id).update(fields); Object.assign(u.f, fields); },
  // scrittura protetta: se la versione salvata non è quella letta, qualcuno ha cambiato il cliente nel frattempo
  async aggiorna(u, fields){
    const db = await fdb(), ref = db.collection(COL.utenti).doc(u.id);
    const out = await db.runTransaction(async t => {
      const d = await t.get(ref); if (!d.exists) throw new Error("Cliente non trovato");
      const cur = d.data(); if (u.v !== undefined && versioneDi(cur) !== u.v) throw new Conflitto();
      const x = preparaScrittura(cur, fields); t.update(ref, x); return x;
    });
    Object.assign(u.f, out); u.v = out.Versione;
  },
  async montatura(codice){ const d = await (await fdb()).collection(COL.mont).doc(String(codice)).get(); return d.exists ? {id: d.id, f: d.data()} : null; },
  async aggiornaMontatura(m, fields){ await (await fdb()).collection(COL.mont).doc(m.id).update(fields); Object.assign(m.f, fields); },
  // lettura e scrittura atomica (due prenotazioni contemporanee non possono prendere lo stesso pezzo)
  // tentativi sbagliati (login, codici cliente): contati nel database, così valgono per tutte le copie del server
  async conta(id, aggiungi, finestra){
    const db = await fdb(), ref = db.collection("sg_tentativi").doc(id), now = Date.now();
    if (!aggiungi){ const d = await ref.get(); return d.exists ? (d.data().h || []).filter(x => now - x < finestra).length : 0; }
    return db.runTransaction(async t => { const d = await t.get(ref); const h = (d.exists ? d.data().h || [] : []).filter(x => now - x < finestra).concat(now).slice(-200);
      t.set(ref, {h, il: new Date(now).toISOString()}); return h.length; });
  },
  async pulisciTentativi(){ const db = await fdb(), r = await db.collection("sg_tentativi").where("il", "<", new Date(Date.now() - 864e5).toISOString()).limit(400).get(); for (const d of r.docs) await d.ref.delete(); return r.size; },
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
    if (DEMO){ const u = demo.utenti.find(x => x[by] === val); return u ? {id: u.Univoco, f: u, v: versioneDi(u)} : null; }
    const r = await find(CFG.baseMain, CFG.tUtenti, `{${by}}="${q(val)}"`, 1);
    return r[0] ? {id: r[0].id, f: r[0].fields, v: versioneDi(r[0].fields)} : null;
  },
  async utenti(filtro){ // {caf} oppure {ottico}
    let rows;
    if (DEMO) rows = demo.utenti.map(f => ({id: f.Univoco, f, v: versioneDi(f)}));
    else {
      const formula = filtro.caf ? `{CAF}="${q(filtro.caf)}"` : `LEFT({Ottica1},${String(filtro.ottico).length + 1})="${q(filtro.ottico)} "`;
      rows = (await find(CFG.baseMain, CFG.tUtenti, formula, 300)).map(r => ({id: r.id, f: r.fields}));
    }
    return rows.filter(r => filtro.caf ? r.f.CAF === filtro.caf : String(r.f.Ottica1 || "").startsWith(filtro.ottico + " "));
  },
  async tutti(){
    if (DEMO) return demo.utenti.map(f => ({id: f.Univoco, f, v: versioneDi(f)}));
    return (await find(CFG.baseMain, CFG.tUtenti, "", 0)).map(r => ({id: r.id, f: r.fields}));
  },
  async creaUtente(fields){
    if (DEMO){ const uv = nuovoUnivoco(); demo.utenti.unshift(Object.assign({Univoco: uv, Creato: new Date().toISOString()}, fields)); return uv; }
    const r = await at(CFG.baseMain, CFG.tUtenti, {method: "POST", body: {fields, typecast: true}});
    let uv = r.fields && r.fields.Univoco;
    if (!uv){ uv = nuovoUnivoco(); await at(CFG.baseMain, CFG.tUtenti, {method: "PATCH", id: r.id, body: {fields: {Univoco: uv}, typecast: true}}); }
    return uv;
  },
  async campi(u, fields){
    if (DEMO){ const rec = demo.utenti.find(x => x.Univoco === u.id) || u.f; Object.assign(rec, fields); if (u.f !== rec) Object.assign(u.f, fields); return; }
    await at(CFG.baseMain, CFG.tUtenti, {method: "PATCH", id: u.id, body: {fields, typecast: true}}); Object.assign(u.f, fields);
  },
  async aggiorna(u, fields){
    if (DEMO){
      // in prova il cliente è l'oggetto in memoria: la versione salvata è quella dell'archivio di prova
      const rec = demo.utenti.find(x => x.Univoco === u.id) || u.f;
      if (u.v !== undefined && versioneDi(rec) !== u.v) throw new Conflitto();
      const x = preparaScrittura(rec, fields); Object.assign(rec, x); if (u.f !== rec) Object.assign(u.f, x); u.v = x.Versione; return;
    }
    const x = preparaScrittura(u.f, fields);
    await at(CFG.baseMain, CFG.tUtenti, {method: "PATCH", id: u.id, body: {fields: Object.assign({}, x, {Passi: JSON.stringify(x.Passi || u.f.Passi || [])}), typecast: true}});
    Object.assign(u.f, x); u.v = x.Versione;
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
const inChiaro = stored => !!stored && !String(stored).startsWith("scrypt$");
function checkPw(stored, p){
  stored = String(stored || "");
  if (stored.startsWith("scrypt$")){ const [, salt, h] = stored.split("$"); return safeEq(crypto.scryptSync(String(p), salt, 32).toString("hex"), h); }
  return !!stored && safeEq(stored, String(p));
}
const PROVA = {caf: ["CAF001"], ottici: ["OTT07", "OTT12"], montature: ["SG-1042", "SG-1043", "SG-1044"]};
const accessoDiProva = (ruolo, id) => stripeLive() && ((ruolo === "caf" && PROVA.caf.includes(id)) || (ruolo === "ottico" && PROVA.ottici.includes(id)));
/* avvisi al cliente: SMS se configurato, altrimenti link WhatsApp da far inviare a CAF/ottico */
/* ---------- notifiche push gratuite (app installata o browser che le supporta) ---------- */
let WP = null; try { WP = require("web-push"); } catch(_){}
async function chiaviPush(){
  if (!WP) return null;
  let k = await DB.meta("push");
  if (!k || !k.pubblica){ const v = WP.generateVAPIDKeys(); k = {pubblica: v.publicKey, privata: v.privateKey}; await DB.meta("push", k); }
  return k;
}
async function chiaviPushPubblica(){ const k = await chiaviPush(); return k ? k.pubblica : ""; }
// notifiche push ai partner: laboratorio (meta «push-lab») e ottiche (campo Push della scheda dell'ottica)
async function iscriviPartner(ruolo, id, sub){
  if (!sub || !/^https:\/\//.test(sub.endpoint || "") || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return {errore: "Iscrizione non valida."};
  const x = {endpoint: sub.endpoint, keys: {p256dh: String(sub.keys.p256dh), auth: String(sub.keys.auth)}};
  if (ruolo === "lab"){ const m = (await DB.meta("push-lab")) || {}; await DB.meta("push-lab", {subs: (m.subs || []).filter(y => y.endpoint !== x.endpoint).concat([x]).slice(-10)}); }
  else { const o = await DB.ottico(id); if (!o) return {errore: "Ottica non trovata."}; await DB.salva("ottici", id, {Push: (Array.isArray(o.Push) ? o.Push : []).filter(y => y.endpoint !== x.endpoint).concat([x]).slice(-10)}); }
  return {ok: true};
}
async function pushPartner(ruolo, id, testo, titolo, url){
  try {
    if (!WP) return false; const k = await chiaviPush(); if (!k) return false;
    const subs = ruolo === "lab" ? ((await DB.meta("push-lab")) || {}).subs || [] : ((await DB.ottico(id)) || {}).Push || [];
    if (!subs.length) return false;
    const dati = JSON.stringify({titolo: titolo || "SocialGlass", testo: corpoPush(testo), url: url || "./"}), scadute = []; let ok = false;
    for (const s of subs){
      try { await WP.sendNotification(s, dati, {vapidDetails: {subject: "mailto:assistenza@socialglass.it", publicKey: k.pubblica, privateKey: k.privata}, TTL: 172800}); ok = true; }
      catch(e){ if (e.statusCode === 404 || e.statusCode === 410) scadute.push(s.endpoint); else console.error("push partner", e.statusCode || e.message); }
    }
    if (scadute.length){ const rest = subs.filter(x => !scadute.includes(x.endpoint)); if (ruolo === "lab") await DB.meta("push-lab", {subs: rest}); else await DB.salva("ottici", id, {Push: rest}); }
    return ok;
  } catch(e){ console.error("push partner", e.message); return false; }
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
  if (scadute.length) try { const u = await DB.utente("Univoco", f.Univoco); if (u) await DB.campi(u, {Push: (u.f.Push || []).filter(x => !scadute.includes(x.endpoint))}); } catch(e){ console.error(e); }
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
// consegna: il codice del cliente (scansione della tessera, codice intero o ultime 4 cifre) deve corrispondere
function codiceCliente(inserito, univoco){
  const n = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), x = n(inserito), uv = n(univoco);
  return x.length >= 4 && (x === uv || x.includes(uv) || (x.length < uv.length && uv.endsWith(x)));
}
// codice cliente intero o link della tessera: vale come autorizzazione del cliente (cambio CAF/ottica)
function codiceIntero(inserito, univoco){
  const n = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), x = n(inserito), uv = n(univoco);
  return !!uv && (x === uv || x.endsWith(uv) || x.includes("UNIVOCO" + uv));
}
// arrivo della montatura in laboratorio: il codice scansionato o scritto deve essere quello della montatura del cliente
function codiceMontatura(inserito, codice){
  const n = s => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, ""), x = n(inserito), c = n(codice);
  return !!c && x.length >= 3 && (x === c || x.includes(c));
}
async function avvisaPronto(u){
  const ott = String(u.f.Ottica1 || "").split(" - ")[0], link = linkCliente(u.f.Univoco, ott, u.f.CAF, u.f.Listino);
  const testo = `SocialGlass: ${nm(u.f.Nome)}, i tuoi occhiali sono pronti e ti aspettano in ottica! Passa a ritirarli con il codice ${u.f.Univoco}. ${link}`;
  const e = await inviaCliente(u.f, testo, [u.f.Nome || "", u.f.Univoco, link], CFG.waTemplatePronto);
  return {sms: e.inviato, inviato: e.inviato, canale: e.canale, motivo: e.motivo || "", testo, whatsapp: `https://wa.me/${numeroCliente(u.f).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`};
}
/* ---------- solleciti di pagamento al cliente ---------- */
const GIORNI_CHIUSURA = 30, PASSI_SOLLECITO = [30, 20, 10, 5, 3, 1];
const canaliCollegati = () => ({whatsapp: !!(CFG.waToken && CFG.waPhone), sms: !!(CFG.smsWebhook || (CFG.twSid && CFG.twToken && CFG.twFrom))});
const numeroCliente = f => { const n = String(f.Cellulare || "").replace(/[^\d+]/g, ""); return n.startsWith("+") ? n : (String(f.Prefisso || "+39") + n.replace(/^0039/, "")); };
// rinnovo non ancora confermato: i canoni del vecchio occhiale continuano sull'abbonamento che prosegue (ord.pagamento non c'è ancora)
function inRinnovo(ord){ const p = ord && ord.rinnovo && ord.rinnovo.prosegue; return ord && !ord.pagamento && p && p.abbonamento ? p : null; }
// pagamento «vivo»: quello del contratto in corso, anche durante la finestra del rinnovo
function pgVivo(ord){ return (ord && ord.pagamento) || inRinnovo(ord) || {}; }
// fatture già contate in un periodo precedente: mai ricontarle nel periodo nuovo
function fattureVecchie(ord){ const p = ord && ord.rinnovo && ord.rinnovo.prosegue; if (!p) return new Set(); return new Set([...(p.idPrecedenti || []), ...(ord.pagamento ? (p.pagamenti || []).map(x => x.id) : [])]); }
function giorniAllaChiusura(ins, ora){ return Math.max(0, Math.ceil(GIORNI_CHIUSURA - (new Date(ora || Date.now()) - new Date(ins.dal)) / 864e5)); }
function testoSollecito(f, ins, giorni, consegnato){
  const imp = Number(ins.importo || 0).toFixed(2).replace(".", ",");
  // acquisto dell'usato non pagato: senza pagamento l'occhiale torna a SocialGlass
  if (ins.tipo === "riscatto") return `SocialGlass: ${nm(f.Nome)}, il pagamento di ${imp} € per l'acquisto dell'usato non è andato a buon fine. ` + (giorni > 0
    ? `Hai ancora ${giorni} ${giorni === 1 ? "giorno" : "giorni"}: dopo, l'occhiale andrà restituito in ottica. `
    : `Oggi scade il tempo per pagarlo: l'occhiale andrà restituito in ottica. `) + `Paga qui: ${ins.link || linkCliente(f.Univoco, String(f.Ottica1 || "").split(" - ")[0], f.CAF, f.Listino)}`;
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
  const pg = pgVivo(ord), ins = pg.insoluto; if (!ins || pg.chiuso) return null;
  const giorni = giorniAllaChiusura(ins, ora), inviati = ins.messaggi || [];
  const passo = PASSI_SOLLECITO.filter(p => giorni <= p && !inviati.some(m => m.passo === p)).pop(); if (passo === undefined) return null;
  if (inviati.some(m => String(m.il).slice(0, 10) === String(ora).slice(0, 10))) return null;
  const consegnato = !!ord.consegnatoIl || u.f.Stato === STATI.CONSEGNATO || !!inRinnovo(ord), testo = testoSollecito(u.f, ins, giorni, consegnato);
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
// pagamenti veri: chiave Stripe live (sk_live_ o rk_live_). Con questa i dati e gli accessi di prova non funzionano più
const stripeLive = () => /^(sk|rk)_live_/.test(CFG.stripeKey || "");
// conto Stripe del partner: quelli creati in prova non esistono nell'account vero, quindi si tengono separati
const campoConto = () => stripeLive() ? "StripeAccountLive" : "StripeAccount";
async function portaleStripe(){
  const modo = stripeLive() ? "live" : "test", m = (await DB.meta("stripePortale")) || {};
  if (m[modo]) return m[modo];
  const c = await stripeApi("POST", "billing_portal/configurations", {business_profile: {headline: "SocialGlass · il tuo abbonamento occhiale"},
    features: {payment_method_update: {enabled: true}, invoice_history: {enabled: true}, customer_update: {enabled: false}, subscription_cancel: {enabled: false}}}, "portale-" + modo);
  await DB.meta("stripePortale", Object.assign({}, m, {[modo]: c.id}));
  return c.id;
}

/* ---------- rinnovo (CAF o ottico): nuovo occhiale, l'abbonamento Stripe continua ---------- */
async function rinnova(u, {otticoId, caf, cambioCaf} = {}){
  const ord = parseOrdine(u.f.Ordine), pg = ord.pagamento || null;
  const storico = (ord.storico || []).concat(ord.montatura ? [{montatura: ord.montatura, lenti: ord.lenti, totale: ord.prezzi && ord.prezzi.totale, rata: ord.prezzi && ord.prezzi.rata, spedizione: ord.prezzi && ord.prezzi.spedizione, inizio: pg && pg.attivatoIl, consegnato: ord.consegnatoIl || "", mesi: ord.prezzi && ord.prezzi.mesi, caf: ord.caf || u.f.CAF || "", ottica: ord.ottica || String(u.f.Ottica1 || "").split(" - ")[0], chiuso: new Date().toISOString(), incassi: incassi(Object.assign({}, ord, {storico: []}))}] : []);
  // se l'abbonamento è ancora attivo lo si tiene: al nuovo ordine cambia solo il canone
  // se un rinnovo era già in corso si conserva il suo abbonamento (mai perderlo: si pagherebbe due volte)
  // le fatture già contate restano segnate: i canoni del vecchio periodo non si ricontano mai in quello nuovo
  const prima = ord.rinnovo && ord.rinnovo.prosegue;
  const idPrecedenti = [...new Set([...((prima && prima.idPrecedenti) || []), ...((prima && prima.pagamenti) || []).map(x => x.id), ...((pg && pg.pagamenti) || []).map(x => x.id)])].filter(Boolean).slice(-200);
  const prosegue = pg && pg.abbonamento && !pg.chiuso ? {abbonamento: pg.abbonamento, cliente: pg.cliente, ratePagate: pg.ratePagate || 0, attivatoIl: pg.attivatoIl, idPrecedenti, ...(pg.insoluto ? {insoluto: pg.insoluto} : {})}
    : (!pg && prima) || null;   // rinnovo già in corso (ordine non ancora confermato): stesso abbonamento, stessi canoni e insoluti
  const campi = {Stato: STATI.REGISTRATO, Ordine: JSON.stringify({storico, rinnovo: {il: new Date().toISOString(), da: caf ? "CAF " + caf : "ottico " + (otticoId || ""), prosegue}})};
  // cambio CAF autorizzato dal cliente (codice cliente mostrato allo sportello): da questo occhiale il cliente è del nuovo CAF;
  // gli occhiali di prima restano al CAF che li ha commissionati (storico.caf)
  if (cambioCaf && caf && caf !== u.f.CAF){ campi.CAF = caf; campi.CambiCaf = (u.f.CambiCaf || []).concat([{il: new Date().toISOString(), da: u.f.CAF || "", a: caf}]).slice(-20); }
  let o = null;
  if (otticoId){ o = await DB.ottico(otticoId); if (o) campi.Ottica1 = `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`; }
  if (!o) o = await DB.ottico(String(u.f.Ottica1 || "").split(" - ")[0]);
  if (o && o.Listino) campi.Listino = o.Listino;
  await DB.aggiorna(u, campi);
  const link = linkCliente(u.f.Univoco, o && o.ID, caf || u.f.CAF, o && o.Listino);
  if (campi.CAF) await registra("CAF " + caf, "cambio CAF autorizzato dal cliente", u.f.Univoco, `da ${campi.CambiCaf[campi.CambiCaf.length - 1].da || "nessun CAF"} a ${caf}`);
  const avviso = await avvisa(u, `SocialGlass: ciao ${nm(u.f.Nome)}, è il momento del tuo occhiale nuovo! Vai da ${o ? o.Intestatario : "la tua ottica"}, scegli la montatura e conferma il nuovo canone dal tuo link: ${link}`);
  return {univoco: u.f.Univoco, link, avviso, whatsapp: avviso.whatsapp, smsInviato: avviso.sms};
}

/* ---------- attivazione dopo il pagamento Stripe (dal webhook o verificando la sessione) ---------- */
// pagamento con IBAN (SEPA): Stripe conferma la richiesta ma la banca risponde dopo qualche giorno.
// Finché non è pagato davvero l'ordine resta «PAGAMENTO IN VERIFICA» e il laboratorio non riceve niente.
const pagato = s => s && (s.payment_status === "paid" || s.payment_status === "no_payment_required");
async function attiva(u, sessione){
  const ord = parseOrdine(u.f.Ordine);
  if (u.f.Stato === STATI.PAGAMENTO && sessione && !pagato(sessione)){
    const ora = new Date().toISOString();
    ord.pagamento = Object.assign({}, ord.pagamento, {stato: "IN VERIFICA", sessione: sessione.id, abbonamento: sessione.subscription || "", cliente: sessione.customer || "", inviatoIl: ora});
    ord.aggiornato = ora;
    await DB.aggiorna(u, {Stato: STATI.VERIFICA, Ordine: JSON.stringify(ord)});
    try { await pushCliente(u.f, `SocialGlass: ${nm(u.f.Nome)}, abbiamo ricevuto la tua richiesta di pagamento con l'IBAN. Aspettiamo la conferma della tua banca (di solito pochi giorni): poi l'ottica prepara i tuoi occhiali.`, "Pagamento in verifica"); } catch(e){}
    return "verifica";
  }
  if (u.f.Stato === STATI.VERIFICA && !pagato(sessione)) return false;
  if (u.f.Stato !== STATI.PAGAMENTO && u.f.Stato !== STATI.VERIFICA){
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
  delete (ord.pagamento || {}).inviatoIl;
  ord.pagamento = Object.assign({}, ord.pagamento, {stato: "ATTIVO", sessione: sessione.id, abbonamento: sessione.subscription || "", cliente: sessione.customer || "", attivatoIl: new Date().toISOString()});
  if (!ord.pagamento.ratePagate && pagato(sessione)){ ord.pagamento.ratePagate = 1; ord.pagamento.primaRata = true; }
  ord.aggiornato = ord.pagamento.attivatoIl;
  await DB.aggiorna(u, {Stato: STATI.ATTIVO, Ordine: JSON.stringify(ord)});
  try { await avviaLavorazione(u, ord); } catch(e){ console.error(e); }
  if (!(ord.storico || []).length) try { await premiaAmico(u, ord); } catch(e){ console.error(e); }
  return true;
}
// la banca ha rifiutato l'addebito con IBAN: l'abbonamento su Stripe si chiude e il cliente può pagare di nuovo
async function rifiutato(u, sessione){
  if (u.f.Stato !== STATI.VERIFICA) return false;
  const ord = parseOrdine(u.f.Ordine), pg = ord.pagamento || {}, ora = new Date().toISOString();
  if (sessione && pg.sessione && sessione.id !== pg.sessione) return false;
  if (pg.abbonamento && CFG.stripeKey){ try { await stripeApi("DELETE", `subscriptions/${pg.abbonamento}`); } catch(e){ if (!/No such subscription/i.test(e.message)) throw e; } }
  ord.pagamento = {stato: "RIFIUTATO", rifiutatoIl: ora, sessioneRifiutata: pg.sessione || "", abbonamentoChiuso: pg.abbonamento || ""};
  const link = linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino);
  const testo = `SocialGlass: ${nm(u.f.Nome)}, la tua banca non ha confermato l'addebito con l'IBAN, quindi l'abbonamento non è partito e non ti addebitiamo niente. Puoi riprovare dal tuo link, meglio con la carta: ${link}`;
  ord.avvisi = ord.avvisi || {};
  const av = await avvisa(u, testo);
  ord.avvisi["iban" + ora.slice(0, 16)] = {il: ora, testo: `Pagamento con IBAN rifiutato dalla banca: l'ordine è tornato in attesa di pagamento. Avvisa il cliente.`, whatsapp: av.whatsapp, inviato: !!av.sms};
  ord.aggiornato = ora;
  await DB.aggiorna(u, {Stato: STATI.PAGAMENTO, Ordine: JSON.stringify(ord)});
  return true;
}
// se la conferma di Stripe non è ancora arrivata, la si chiede direttamente a Stripe
async function verificaPagamento(u){
  if (![STATI.PAGAMENTO, STATI.VERIFICA].includes(u.f.Stato) || !CFG.stripeKey) return false;
  const pg = parseOrdine(u.f.Ordine).pagamento;
  if (!pg || !["IN CORSO", "IN VERIFICA"].includes(pg.stato) || !pg.sessione) return false;
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
  VERIFICA: "PAGAMENTO IN VERIFICA",            // pagato con IBAN: si aspetta la conferma della banca
  ATTIVO: "ABBONAMENTO ATTIVO - IN LAVORAZIONE",
  PRONTO: "PRONTO PER IL RITIRO",
  CONSEGNATO: "CONSEGNATO",
  CHIUSO: "CHIUSO",                             // contratto finito (recesso, restituzione, acquisto dell'usato, insoluto)
  SCADUTO: "LINK SCADUTO",                      // 30 giorni senza attivare: pratica in archivio
  ANONIMO: "ARCHIVIATO (DATI CANCELLATI)"       // altri 30 giorni dopo: dati personali cancellati
};
/* ---------- mappa dei passaggi permessi: chi può fare cosa, da quale stato (vedi «Mappa dei passaggi dell'ordine») ---------- */
const S_ = STATI;
const MAPPA = {
  scegliMontatura: {ruoli: ["cliente"], stati: [S_.REGISTRATO, S_.MONTATURA]},
  preventivo:      {ruoli: ["ottico"], stati: [S_.MONTATURA, S_.PAGAMENTO]},
  paga:            {ruoli: ["cliente"], stati: [S_.PAGAMENTO]},
  disponibile:     {ruoli: ["lab"], stati: [S_.ATTIVO], lab: ["DA VERIFICARE", "ATTESA MONTATURA"]},
  richiedi:        {ruoli: ["lab"], stati: [S_.ATTIVO], lab: ["DA VERIFICARE"]},
  ritirata:        {ruoli: ["lab"], stati: [S_.ATTIVO]},
  inizia:          {ruoli: ["lab"], stati: [S_.ATTIVO], lab: ["DA FARE", "ATTESA MONTATURA"]},
  nota:            {ruoli: ["lab"], stati: [S_.ATTIVO, S_.PRONTO, S_.CONSEGNATO, S_.CHIUSO]},
  prontoLab:       {ruoli: ["lab"], stati: [S_.ATTIVO], lab: ["IN LAVORAZIONE"]},
  spedito:         {ruoli: ["lab"], stati: [S_.ATTIVO], lab: ["PRONTO"]},
  montaturaSpedita:{ruoli: ["ottico"], stati: [S_.ATTIVO], lab: ["ATTESA MONTATURA"]},
  arrivato:        {ruoli: ["ottico"], stati: [S_.ATTIVO], lab: ["SPEDITO", "PRONTO"]},
  pronto:          {ruoli: ["ottico"], stati: [S_.ATTIVO]},
  consegnato:      {ruoli: ["ottico"], stati: [S_.PRONTO]},
  recesso:         {ruoli: ["ottico"], stati: [S_.ATTIVO, S_.PRONTO, S_.CONSEGNATO]},
  ritirato:        {ruoli: ["ottico"], stati: [S_.ATTIVO, S_.PRONTO, S_.CONSEGNATO, S_.CHIUSO]},
  finePeriodo:     {ruoli: ["cliente"], stati: [S_.ATTIVO, S_.PRONTO, S_.CONSEGNATO]},
  rinnovo:         {ruoli: ["caf", "ottico"], stati: [S_.CONSEGNATO, S_.CHIUSO, S_.REGISTRATO]},
  rifare:          {ruoli: ["lab", "ottico"], stati: [S_.ATTIVO, S_.PRONTO, S_.CONSEGNATO], lab: ["IN LAVORAZIONE", "PRONTO", "SPEDITO", "ARRIVATO"]},
  ricetta:         {ruoli: ["ottico"], stati: [S_.ATTIVO], lab: ["DA VERIFICARE", "ATTESA MONTATURA", "DA FARE"]}
};
const PERCHE_STATO = {
  [S_.REGISTRATO]: "Il cliente non ha ancora scelto la montatura.", [S_.MONTATURA]: "L'ottica non ha ancora inviato il preventivo.",
  [S_.PAGAMENTO]: "Il cliente non ha ancora attivato l'abbonamento.", [S_.VERIFICA]: "Il pagamento con IBAN è in verifica: aspettiamo la conferma della banca.", [S_.ATTIVO]: "L'ordine è ancora in lavorazione.",
  [S_.PRONTO]: "L'occhiale è già pronto per il ritiro.", [S_.CONSEGNATO]: "L'occhiale è già stato consegnato.",
  [S_.CHIUSO]: "Il contratto di questo cliente è chiuso.", [S_.SCADUTO]: "Il link del cliente è scaduto.", [S_.ANONIMO]: "La pratica è archiviata."
};
// null = permesso; altrimenti {errore} con una frase chiara
function permesso(azione, ruolo, f){
  const m = MAPPA[azione]; if (!m) return {errore: "Operazione non prevista."};
  if (!m.ruoli.includes(ruolo)) return {errore: "Operazione non permessa per il tuo ruolo."};
  if (!m.stati.includes(f.Stato)) return {errore: PERCHE_STATO[f.Stato] || "Operazione non possibile in questo stato."};
  if (m.lab){ const o = parseOrdine(f.Ordine), st = (o.lab && o.lab.stato) || ""; if (!m.lab.includes(st)) return {errore: azione === "rifare" ? "Il laboratorio non ha ancora lavorato le lenti: non c'è niente da rifare." : st === "DA VERIFICARE" ? "Prima indica se la montatura è disponibile in laboratorio."
    : azione === "prontoLab" ? (["PRONTO", "SPEDITO", "ARRIVATO"].includes(st) ? "L'occhiale è già segnato pronto." : "Prima tocca «Inizio lavorazione».")
    : azione === "spedito" ? (st === "SPEDITO" || st === "ARRIVATO" ? "L'occhiale risulta già spedito." : "Prima segna l'occhiale pronto.")
    : azione === "arrivato" ? (st === "ARRIVATO" ? "L'arrivo è già stato registrato." : "Il laboratorio non ha ancora finito l'occhiale.")
    : azione === "montaturaSpedita" ? "Il laboratorio non sta aspettando questa montatura." : azione === "inizia" ? "La lavorazione è già iniziata."
    : azione === "rifare" ? "Il laboratorio non ha ancora lavorato le lenti: non c'è niente da rifare." : azione === "ricetta" ? "Il laboratorio ha già iniziato le lenti: la ricetta non si corregge più, segna «Da rifare»." : "La montatura è già stata gestita: aggiorna la pagina."}; }
  return null;
}

/* ---------- link del cliente: vale 30 giorni dalla registrazione finché l'abbonamento non è attivato ----------
   Alla scadenza la pratica va in archivio (montatura liberata, link non più valido); i dati personali restano
   in archivio altri 30 giorni e poi si cancellano (resta una traccia anonima). Non vale per chi ha già avuto un abbonamento. */
const GIORNI_LINK = 30, GIORNI_ARCHIVIO = 30;
// versione delle condizioni del contratto: dalla 2026-11-15 c'è la clausola dell'addebito dell'usato se l'occhiale non torna (D3)
const CONDIZIONI_VERSIONE = "2026-11-15";
const GIORNI_RESTITUZIONE = 30;
// coda dei casi da risolvere per l'amministratore, con la scadenza di ognuno (la più vicina prima)
function codaEccezioni(utenti, segn, diff, cfg, ora, mont, labOn){
  const now = ora ? new Date(ora) : new Date(), coda = [], piu = (d, g) => new Date(new Date(d).getTime() + g * 864e5).toISOString();
  const add = (x) => coda.push(Object.assign(x, {scaduto: x.scadenza < now.toISOString()}));
  const d3 = !!(cfg && cfg.addebitoUsato);
  for (const {f} of utenti){
    if (f.Archiviato) continue;
    const o = parseOrdine(f.Ordine), pg = pgVivo(o), nome = `${nm(f.Nome)} ${nm(f.Cognome)}`.trim(), base = {univoco: f.Univoco, nome, ottica: String(f.Ottica1 || "").split(" - ")[0]};
    if (pg.rimborso && pg.rimborso.daFare && !pg.rimborso.fatto) add(Object.assign({tipo: "rimborso", titolo: "Rimborso del recesso da controllare e fare", dal: pg.rimborso.daFare, scadenza: piu(pg.rimborso.daFare, 14), dettaglio: "Per legge entro 14 giorni dal recesso."}, base));
    if (pg.insoluto && (!pg.chiuso || pg.insoluto.tipo === "riscatto")) add(Object.assign({tipo: "insoluto", titolo: pg.insoluto.tipo === "riscatto" ? "Acquisto dell'usato non pagato" : "Canone non pagato", dal: pg.insoluto.dal, scadenza: piu(pg.insoluto.dal, 30),
      dettaglio: `${Number(pg.insoluto.importo || 0).toFixed(2).replace(".", ",")} € · ${pg.insoluto.tipo === "riscatto" ? "dopo 30 giorni l'occhiale va restituito" : "dopo 30 giorni l'abbonamento si chiude da solo; i canoni restanti non si chiedono in automatico (D4)"}`}, base));
    const rt = o.ritiro;
    if (rt && rt.daRitirare && !rt.ritirato){
      const giorni = Math.floor((now - new Date(rt.dal)) / 864e5);
      if (giorni >= 15){
        const clausola = !rt.rinnovo && (o.consensi || {}).versione >= CONDIZIONI_VERSIONE && Number((o.prezzi || {}).riscatto) > 0;
        add(Object.assign({tipo: giorni >= GIORNI_RESTITUZIONE ? "nonRestituito" : "restituzione", titolo: giorni >= GIORNI_RESTITUZIONE ? "Occhiale non restituito" : "Occhiale da restituire in ritardo", dal: rt.dal, scadenza: piu(rt.dal, GIORNI_RESTITUZIONE),
          dettaglio: `${giorni} giorni · ${rt.rinnovo ? "occhiale vecchio di un rinnovo: contatta il cliente" : !clausola ? "contratto senza clausola di addebito: contatta il cliente" : d3 ? "addebito dell'usato automatico dopo 30 giorni (con avviso 7 giorni prima)" : "addebito dell'usato spento: decidi tu"}${pg.riscatto && pg.riscatto.restituzioneMancata ? " · addebito già richiesto" : ""}`}, base));
      }
    }
    if (rt && rt.ritirato && rt.condizione && rt.condizione !== "integro" && !rt.verificato) add(Object.assign({tipo: "condizione", titolo: `Occhiale restituito ${rt.condizione}`, dal: rt.ritirato, scadenza: piu(rt.ritirato, 7), dettaglio: rt.nota || "Nessuna nota dell'ottica."}, base));
    const lab = o.lab;
    // ordine pagato che il laboratorio non ha ricevuto (pagato prima che il laboratorio fosse attivo, o busta non creata): decide l'amministratore
    if (labOn && f.Stato === STATI.ATTIVO && !lab && pg.attivatoIl && !pg.chiuso && !o.labNo) add(Object.assign({tipo: "busta", titolo: "Ordine pagato senza busta del laboratorio", dal: pg.attivatoIl, scadenza: piu(pg.attivatoIl, 1),
      dettaglio: "Il laboratorio non l'ha ricevuto. Tocca per scegliere: crea la busta (il laboratorio verifica la montatura) oppure lo segue l'ottica da sola."}, base));
    if (lab && lab.rifacimento && !["PRONTO", "SPEDITO", "ARRIVATO"].includes(lab.stato) && !pg.chiuso) add(Object.assign({tipo: "rifacimento", titolo: "Occhiale in rifacimento", dal: lab.rifacimento.il, scadenza: piu(lab.rifacimento.il, 10), dettaglio: `${lab.rifacimento.da}: ${lab.rifacimento.motivo}`}, base));
  }
  for (const x of segn || []) if (x.stato === "aperta") add({tipo: "segnalazione", titolo: "Segnalazione del cliente", univoco: x.univoco, nome: x.nome || "", ottica: x.ottica || "", dal: x.il, scadenza: piu(x.il, 3), dettaglio: String(x.testo || "").slice(0, 120), id: x.ID || x._id});
  for (const m of mont || []){ if (m.Eliminata) continue; const {r} = scorte(m);
    for (const x of r.filter(x => x.mancante && !x.vista)) add({tipo: "giacenza", titolo: "Giacenza dell'ottica da correggere", univoco: x.univoco, nome: "", ottica: x.ottica, codice: m.Codice || m._id, dal: x.il, scadenza: piu(x.il, 7),
      dettaglio: `${m.Codice || m._id} ${m.Modello || ""} ${m.Colore || ""}: prenotata in ${x.ottica}, dove il magazzino non registrava pezzi. Carica la giacenza giusta (Magazzino → rettifica).`}); }
  for (const x of (diff && diff.voci) || []) add({tipo: "stripe", titolo: "Differenza con Stripe", univoco: x.univoco, nome: "", dal: diff.il, scadenza: piu(diff.il, 1), dettaglio: x.testo});
  return coda.sort((a, b) => String(a.scadenza).localeCompare(String(b.scadenza)));
}
// segnalazioni aperte del cliente: finché non sono risolte il rinnovo aspetta
const segnalazioniAperte = f => (parseOrdine(f.Ordine).segnalazioni || []).filter(x => x.stato === "aperta");
// versione dell'informativa privacy (privacy.html): si salva con il consenso del cliente; cambiarla se cambia il testo
const INFORMATIVA_VERSIONE = "2026-11-14";
const LINK_SCADUTO = "Il link è scaduto: sono passati 30 giorni dalla registrazione senza attivare l'abbonamento. Se vuoi ancora i tuoi occhiali, torna al CAF o in ottica: ti registriamo di nuovo in un minuto.";
function maiAttivato(f){ const o = parseOrdine(f && f.Ordine), pg = o.pagamento || {}; return !pg.attivatoIl && pg.stato !== "IN VERIFICA" && !(o.storico || []).length && !o.rinnovo; }
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
  // il cliente perde il diritto di annullare solo quando il laboratorio tocca «Inizio lavorazione» (lenti su misura)
  return !!(lab && (lab.iniziato || ["IN LAVORAZIONE", "PRONTO", "SPEDITO", "ARRIVATO"].includes(lab.stato))) || [STATI.PRONTO, STATI.CONSEGNATO].includes(stato);
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
// conferma del cliente con la data di nascita (consenso, ricevute, carta, attivazione, scelte del contratto): vale 90 giorni sul suo dispositivo.
// Firmata con una chiave diversa da quella degli accessi: non vale mai come accesso di CAF, ottica, laboratorio o pannello.
const chiaveCliente = () => crypto.createHash("sha256").update(String(CFG.secret) + ":conferma-cliente").digest();
const GIORNI_CONFERMA = 90;
function firmaCliente(univoco){
  const body = Buffer.from(JSON.stringify({id: univoco, exp: Date.now() + GIORNI_CONFERMA * 864e5})).toString("base64url");
  return `${body}.${crypto.createHmac("sha256", chiaveCliente()).update(body).digest("base64url")}`;
}
function confermaCliente(t, f){
  if (!f || !f["Data Nascita"]) return true;   // senza data di nascita in anagrafica non si può chiedere
  const [body, mac] = String(t || "").split("."); if (!body || !mac) return false;
  const good = crypto.createHmac("sha256", chiaveCliente()).update(body).digest("base64url");
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return false;
  try { const p = JSON.parse(Buffer.from(body, "base64url").toString()); return p.id === f.Univoco && p.exp > Date.now(); } catch(e){ return false; }
}
const SERVE_CONFERMA = {errore: "Per sicurezza conferma la tua data di nascita.", serveConferma: true};
const stessaData = (a, b) => { const n = s => String(s || "").trim().slice(0, 10); return !!n(a) && n(a) === n(b); };
function verify(req, ruolo){
  const h = req.headers.authorization || "", t = h.startsWith("Bearer ") ? h.slice(7) : "";
  const [body, mac] = t.split(".");
  if (!body || !mac) return null;
  const good = crypto.createHmac("sha256", CFG.secret).update(body).digest("base64url");
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString());
  if (p.exp < Date.now() || (ruolo && p.ruolo !== ruolo)) return null;
  // con i pagamenti veri gli accessi di prova (password «demo» nel codice pubblico) non valgono più
  if (accessoDiProva(p.ruolo, p.id)) return null;
  chi({ottico: "ottica " + p.id, lab: "laboratorio", caf: "CAF " + p.id, admin: "amministratore"}[p.ruolo] || p.ruolo);
  return p;
}
// partner disattivato dall'amministratore: non entra e non opera più (i token già dati smettono di valere qui)
const SOSPESO = {errore: "Accesso sospeso da SocialGlass: contatta l'amministratore.", sospeso: true};
async function partnerSospeso(s){
  if (!s || !["caf", "ottico"].includes(s.ruolo)) return null;
  const r = s.ruolo === "caf" ? await DB.login("caf", s.id) : await DB.ottico(s.id);
  return r && r.Disattivato ? SOSPESO : null;
}
const totp = {
  B32: "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",
  nuovo(){ const b = crypto.randomBytes(20); let bits = "", out = ""; for (const x of b) bits += x.toString(2).padStart(8, "0"); for (let i = 0; i + 5 <= bits.length; i += 5) out += this.B32[parseInt(bits.slice(i, i + 5), 2)]; return out; },
  bytes(s){ let bits = ""; for (const c of String(s).toUpperCase().replace(/[^A-Z2-7]/g, "")) bits += this.B32.indexOf(c).toString(2).padStart(5, "0"); const o = []; for (let i = 0; i + 8 <= bits.length; i += 8) o.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(o); },
  codice(seg, passo){ const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(passo)); const h = crypto.createHmac("sha1", this.bytes(seg)).update(c).digest(), o = h[h.length - 1] & 15;
    return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0"); },
  // accetta il codice di adesso e quelli di 30 secondi prima e dopo (orologio del telefono un po' avanti o indietro); restituisce il passo usato
  verifica(seg, cod, ultimo){ cod = String(cod || "").replace(/\D/g, ""); if (cod.length !== 6) return 0; const ora = Math.floor(Date.now() / 30000);
    for (const d of [0, -1, 1]){ const p = ora + d; if (p > (ultimo || 0) && safeEq(this.codice(seg, p), cod)) return p; } return 0; },
  link(seg, nome){ return `otpauth://totp/${encodeURIComponent("SocialGlass:" + nome)}?secret=${seg}&issuer=SocialGlass&algorithm=SHA1&digits=6&period=30`; }
};
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
// la chiave si salva cifrata (sha256): niente indirizzi IP in chiaro nel database
const chiaveTent = k => crypto.createHash("sha256").update(CFG.secret + ":" + k).digest("hex").slice(0, 40);
const SU_DB = () => MODO === "firestore" && typeof DB.conta === "function";
function memConta(key, aggiungi, windowMs){ const now = Date.now(), arr = (hits.get(key) || []).filter(t => now - t < windowMs); if (aggiungi){ arr.push(now); hits.set(key, arr); } return arr.length; }
async function conta(key, aggiungi, windowMs){
  const m = memConta(key, aggiungi, windowMs);
  if (!SU_DB()) return m;
  try { return Math.max(m, await DB.conta(chiaveTent(key), aggiungi, windowMs)); } catch(e){ console.error("tentativi:", e.message); return m; }
}
async function tooMany(key, max = 8, windowMs = 10*60e3){ return (await conta(key, true, windowMs)) > max; }
// tentativi con codici cliente inesistenti: al massimo 10 ogni 10 minuti per indirizzo
function ipDi(req){ return String(req.headers["x-forwarded-for"] || (req.socket && req.socket.remoteAddress) || "").split(",")[0].trim(); }
// solo controllo, senza contare un nuovo tentativo
async function giaTroppi(key, max, windowMs = 10*60e3){ return (await conta(key, false, windowMs)) >= max; }
async function bloccato(req){ return giaTroppi("cod:" + ipDi(req), 10); }
async function codiceErrato(req){ await conta("cod:" + ipDi(req), true, 10*60e3); }
const TROPPI = {errore: "Troppi codici sbagliati. Riprova tra 10 minuti."};
// chi agisce, in base alla funzione chiamata (poi verify() lo precisa con il ruolo di chi ha fatto l'accesso)
const CHI_DEFAULT = {"stripe-webhook": "stripe", scadenze: "sistema", benvenuto: "cliente", montatura: "cliente", pagamento: "cliente", "fine-periodo": "cliente"};
// fuori dai dati di prova la chiave delle sessioni deve esserci ed essere lunga: con quella di prova si falsificherebbero gli accessi
const CHIAVE_OK = DEMO || (!!E.SESSION_SECRET && E.SESSION_SECRET.length >= 32 && E.SESSION_SECRET !== "solo-per-prova-cambiami");
function wrap(fn){
  return async (req, res) => {
    if (!CHIAVE_OK){ console.error("SESSION_SECRET mancante o troppo corta"); res.statusCode = 503; res.setHeader("Content-Type", "application/json; charset=utf-8"); return res.end(JSON.stringify({errore: "Servizio non configurato: manca la chiave delle sessioni. Avvisa l'amministratore."})); }
    const nome = String(req.url || "").split("?")[0].split("/").pop();
    return contesto.run({chi: CHI_DEFAULT[nome] || nome || "sistema"}, async () => {
      try { await fn(req, res); }
      catch(e){
        if (e && e.conflitto){ if (!res.headersSent) send(res, 409, {errore: e.message, conflitto: true}); return; }
        console.error(e); if (!res.headersSent) send(res, 500, {errore: "Errore del server. Riprova tra poco."});
      }
    });
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
// modifica 12: il cliente scansiona il QR della montatura esposta nella sua ottica → il pezzo è lì.
// Disponibile se l'ottica ne ha in giacenza, oppure (giacenza non caricata) se nessun altro cliente l'ha già prenotata in quell'ottica.
function disponibile(f, ottica, univoco){
  if (!f || f.Eliminata) return false; const {g, r, tot} = scorte(f);
  if (!ottica) return tot > 0;
  return g[ottica] > 0 || !r.some(x => x.ottica === ottica && x.univoco !== univoco);
}
async function riservaMontatura(codice, univoco, ottica){
  let ok = false, sotto = null;
  await DB.tx("mont", codice, f => {
    ok = false; if (f.Eliminata) return null;
    const {g, r} = scorte(f);
    if (r.some(x => x.univoco === univoco)){ ok = true; return null; }
    let da = null, mancante = false;
    if (ottica){ if (g[ottica] > 0) da = ottica; else if (!r.some(x => x.ottica === ottica)){ da = ottica; mancante = true; } }
    else da = g[MAG] > 0 ? MAG : null;
    if (!da) return null;
    if (!mancante) g[da]--;
    r.push(Object.assign({univoco, ottica: da, il: new Date().toISOString()}, mancante ? {mancante: true} : {})); ok = true;
    const out = campiScorte(f, g, r, {tipo: mancante ? "prenotata (giacenza dell'ottica non caricata: da correggere)" : "prenotata", qta: mancante ? 0 : -1, dove: da, cliente: univoco});
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
  // il laboratorio riceve la busta «da verificare»: controlla se ha la montatura in magazzino e sceglie
  // «montatura disponibile» oppure «ritira la montatura dall'ottico» (azioni in api/ordine.js → labMontatura)
  const sede = String(u.f.Ottica1 || "").split(" - ")[0]; let labHa = false;
  if (codice) await DB.tx("mont", codice, f => { const {g} = scorte(f); labHa = (g[LAB] || 0) > 0; return null; });
  ord.lab = {stato: "DA VERIFICARE", verifica: true, fonte: "", sede, labHa, creato: ora};
  ord.aggiornato = ora;
  await DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  const m = ord.montatura || {};
  await pushPartner("lab", null, `Nuovo ordine pagato (${univoco}): verifica se hai in magazzino la montatura ${codice || ""} ${m.modello || ""} ${m.colore || ""}.`.replace(/\s+/g, " "), "Nuovo ordine da verificare", "laboratorio.html");
}
// scelta del laboratorio sulla montatura di una busta «da verificare»
async function labMontatura(u, ord, azione){
  const lab = ord.lab, codice = ord.montatura && ord.montatura.codice, univoco = u.f.Univoco, ora = new Date().toISOString(), ott = String(u.f.Ottica1 || "").split(" - ")[0];
  if (azione === "richiedi"){
    if (lab.stato !== "DA VERIFICARE") return {errore: "Hai già scelto per questa montatura."};
    // la montatura si chiede sempre all'ottica del cliente, dove l'ha provata e scansionata
    const fonte = "OTTICA", sede = ott || lab.sede;
    if (codice) await DB.tx("mont", codice, f => {
      const {g, r} = scorte(f); let i = r.findIndex(x => x.univoco === univoco); if (i < 0) i = r.findIndex(x => x.univoco === "?");
      const x = i >= 0 ? r.splice(i, 1)[0] : null;
      // prenotata sul magazzino centrale (giacenza dell'ottica non caricata): il pezzo che parte è quello dell'ottica
      if (x && x.ottica !== sede){ g[x.ottica] = (g[x.ottica] || 0) + 1; if ((g[sede] || 0) > 0) g[sede]--; }
      return campiScorte(f, g, r, {tipo: "uscita cliente (da inviare al laboratorio)", qta: 0, dove: sede, cliente: univoco});
    });
    Object.assign(lab, {stato: "ATTESA MONTATURA", fonte, sede, richiesta: ora});
    const nomeLab = ((await DB.meta("laboratorio")) || {}).nome || "Laboratorio";
    if (fonte === "OTTICA"){
      // in ottica l'avviso compare nella scheda del cliente e tra le cose da fare (SIT_P.lab)
      await pushPartner("ottico", sede, `Metti da parte la montatura ${codice} (cliente ${univoco}) e allega la scheda per il laboratorio ${nomeLab}: passa il corriere.`, "Montatura da inviare al laboratorio", "/ottico");
    }
    return {ok: true, fonte};
  }
  if (azione === "disponibile"){
    if (!["DA VERIFICARE", "ATTESA MONTATURA"].includes(lab.stato)) return {errore: "La montatura risulta già disponibile."};
    if (lab.stato === "DA VERIFICARE"){
      // copia del laboratorio: la prenotazione torna all'ottica (che tiene il suo pezzo esposto) e si scarica la giacenza del laboratorio
      if (codice) await DB.tx("mont", codice, f => {
        const {g, r} = scorte(f); let i = r.findIndex(x => x.univoco === univoco); if (i < 0) i = r.findIndex(x => x.univoco === "?");
        const x = i >= 0 ? r.splice(i, 1)[0] : null; if (x) g[x.ottica] = (g[x.ottica] || 0) + 1;
        const c = (g[LAB] || 0) > 0; if (c) g[LAB]--;
        return campiScorte(f, g, r, {tipo: c ? "uscita cliente (copia del laboratorio)" : "uscita cliente (copia del laboratorio non registrata in giacenza)", qta: c ? -1 : 0, dove: LAB, cliente: univoco});
      });
      Object.assign(lab, {fonte: "LAB", sede: LAB});
    } else lab.ritirata = ora;   // arrivata dall'ottica con il corriere
    // lenti già avviate mentre la montatura viaggiava: si va direttamente a «in lavorazione»
    Object.assign(lab, {stato: lab.iniziato ? "IN LAVORAZIONE" : "DA FARE", disponibile: ora});
    return {ok: true};
  }
  return {errore: "Operazione non valida."};
}
// annullamento (recesso): la montatura torna dov'è fisicamente
async function montaturaDopoRecesso(ord, univoco){
  const lab = ord.lab, codice = ord.montatura && ord.montatura.codice; if (!codice) return "";
  // ancora prenotata (laboratorio non ancora passato, o nessun laboratorio): torna disponibile dove era
  if (!lab || lab.stato === "DA VERIFICARE" || (!lab.verifica && !lab.ritirata && lab.fonte !== "LAB")){ await liberaMontatura(codice, univoco); return "montatura di nuovo disponibile"; }
  // chiesta all'ottica ma non ancora arrivata: resta (o torna) in ottica
  const dove = lab.stato === "ATTESA MONTATURA" ? (lab.sede || "") : LAB; if (!dove) return "";
  await DB.tx("mont", codice, f => { const {g, r} = scorte(f); g[dove] = (g[dove] || 0) + 1; return campiScorte(f, g, r, {tipo: "rientro dopo annullamento", qta: 1, dove, cliente: univoco}); });
  return dove === LAB ? "montatura rientrata nel magazzino del laboratorio" : "montatura di nuovo disponibile in ottica: non va più spedita";
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
  const o = parseOrdine(f.Ordine), pg = pgVivo(o), b = f.Blocco || {};
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
// ottica = una rata + la spedizione del cliente per ogni occhiale consegnato; CAF = 3 € per ogni occhiale consegnato
const COMPENSO_BASE = {ottica: {tipo: "rata", valore: 0}, caf: {tipo: "fisso", valore: 3}};
function accordiDi(acc, ruolo){
  let l = Array.isArray(acc && acc.Accordi) ? acc.Accordi.slice() : [];
  const c = (acc && acc.Compenso) || {};
  if (!l.length && c.tipo) l = [{dal: "2000-01-01", tipo: c.tipo, valore: Number(c.valore) || 0}];
  if (!l.length && COMPENSO_BASE[ruolo]) l = [Object.assign({dal: "2000-01-01", base: true}, COMPENSO_BASE[ruolo])];
  return l.sort((x, y) => String(x.dal).localeCompare(String(y.dal)));
}
function accordoAl(l, d){ const g = String(d || "").slice(0, 10); let r = null; for (const x of l) if (String(x.dal) <= g) r = x; return r && r.tipo && (Number(r.valore) || r.tipo === "rata") ? r : null; }
// periodi di abbonamento del cliente (quelli prima dei rinnovi più quello in corso), ognuno con la sua consegna e i suoi canoni
function periodiCliente(f){
  const o = parseOrdine(f.Ordine), pg = o.pagamento || {}, pr = o.prezzi || {}, ottOra = String(f.Ottica1 || "").split(" - ")[0];
  const l = (o.storico || []).filter(st => st.inizio).map(st => ({inizio: st.inizio, consegnato: st.consegnato || "", prec: true, caf: st.caf != null ? st.caf : f.CAF || "", ottica: st.ottica || ottOra, rata: Number(st.rata) || 0,
    sped: st.spedizione != null ? Number(st.spedizione) || 0 : Number(pr.spedizione) || 0, mesi: Number(st.mesi) || 12, incassi: st.incassi || []}));
  if (pg.attivatoIl && pg.stato !== "SIMULATO") l.push({inizio: pg.attivatoIl, consegnato: o.consegnatoIl || "", caf: o.caf != null ? o.caf : f.CAF || "", ottica: o.ottica || ottOra, rata: Number(pr.rata) || 0, sped: Number(pr.spedizione) || 0, mesi: Number(pr.mesi) || 12,
    incassi: incassi(Object.assign({}, o, {storico: []})), chiuso: !!pg.chiuso});
  return {o, pg, pr, periodi: l};
}
// Il compenso matura solo quando l'occhiale è consegnato al cliente (data di consegna):
// fisso o «una rata + spedizione» alla consegna; a percentuale, ogni canone del periodo dalla consegna in poi (quelli pagati prima maturano il giorno della consegna).
// id = CAF o ottica: conta solo gli occhiali commissionati da quel CAF / consegnati da quell'ottica (anche se oggi il cliente è di un altro)
function righeCompenso(utenti, acc, ruolo, id){
  const l = accordiDi(acc, ruolo), out = []; if (!l.length) return out;
  const pc = v => String(v).replace(".", ",");
  for (const f of utenti){
    const base = {univoco: f.Univoco, cliente: `${nm(f.Nome)} ${nm(f.Cognome)}`.trim()};
    for (const x of periodiCliente(f).periodi){
      if (!x.consegnato) continue;
      if (id && (ruolo === "caf" ? x.caf : x.ottica) !== id) continue;
      const ac = accordoAl(l, x.consegnato), dopo = x.prec ? " (periodo precedente)" : "";
      if (ac && ac.tipo === "fisso") out.push(Object.assign({il: x.consegnato, descrizione: `Occhiale consegnato${dopo} · ${e2(ac.valore)}`, importo: Number(ac.valore)}, base));
      if (ac && ac.tipo === "rata") out.push(Object.assign({il: x.consegnato, descrizione: `Occhiale consegnato${dopo} · una rata ${e2(x.rata)} + spedizione ${e2(x.sped)}`, importo: Math.round((x.rata + x.sped) * 100) / 100}, base));
      for (const y of x.incassi) if (y.canone > 0){
        const il = String(y.il) < String(x.consegnato) ? x.consegnato : y.il, ap = accordoAl(l, il);
        if (ap && ap.tipo === "percentuale") out.push(Object.assign({il, descrizione: `Canone pagato ${e2(y.canone)} × ${pc(ap.valore)}%${il !== y.il ? " (pagato prima della consegna)" : ""}`, importo: Math.round(y.canone * ap.valore) / 100, stima: !!y.stima}, base));
      }
    }
  }
  return out;
}
/* ---------- pagamenti ai partner (CAF e ottiche) ----------
   Mai oltre il maturato non ancora pagato, uno alla volta (transazione sull'anagrafica del partner),
   ognuno con gli occhiali che copre (in ordine di maturazione). Il pagamento Stripe nasce «in corso» prima del trasferimento,
   così un secondo clic o una seconda finestra non possono pagare di nuovo; poi diventa definitivo o sparisce. */
async function compensiPartner(k, id, acc){ const tutti = (await DB.tutti()).map(u => u.f); return righeCompenso(tutti, Object.assign({}, acc, {ID: id}), k === "caf" ? "caf" : "ottica", id); }
function coperturaPagamento(righe, pagatoPrima, imp){
  const r2 = x => Math.round(x * 100) / 100, out = []; let gia = pagatoPrima, resto = imp;
  for (const r of righe.slice().sort((x, y) => String(x.il).localeCompare(String(y.il)))){
    let v = r.importo; const usa = Math.min(v, Math.max(0, gia)); gia -= usa; v -= usa;
    if (v <= 0.004) continue;
    const q = Math.min(v, resto); if (q <= 0.004) break;
    out.push({univoco: r.univoco, cliente: r.cliente, il: String(r.il).slice(0, 10), importo: r2(q)}); resto -= q;
    if (resto <= 0.004) break;
  }
  return out;
}
const euroIt = x => (Math.round(x * 100) / 100).toFixed(2).replace(".", ",") + " €";
async function nuovaLiquidazione(k, id, acc, voce, {oltreSaldo} = {}){
  const righe = await compensiPartner(k, id, acc), maturato = righe.reduce((t, x) => t + x.importo, 0);
  let errore = null, fatta = null;
  await DB.tx(k, id, f => {
    const l = liquidazioniDi(f);
    if (l.some(x => x.stato === "in corso")){ errore = "C'è un pagamento Stripe in corso per questo partner: aspetta qualche secondo e ricarica la pagina."; return null; }
    const pagato = l.reduce((t, x) => t + (Number(x.importo) || 0), 0), saldo = Math.round((maturato - pagato) * 100) / 100;
    if (!oltreSaldo && voce.importo > saldo + 0.005){ errore = saldo > 0 ? `L'importo supera quanto maturato e non ancora pagato: al massimo ${euroIt(saldo)}.` : "Non c'è niente da pagare: tutto il maturato è già stato pagato."; return null; }
    fatta = Object.assign({id: crypto.randomBytes(4).toString("hex"), registrato: new Date().toISOString(), saldoPrima: saldo, ordini: coperturaPagamento(righe, pagato, voce.importo)}, voce);
    return {Liquidazioni: l.concat([fatta])};
  });
  return errore ? {errore} : fatta ? {voce: fatta} : {errore: "Partner non trovato."};
}
// cambia (fn → voce) o toglie (fn → null) un pagamento registrato
async function aggiornaLiquidazione(k, id, lid, fn){
  let out = null;
  await DB.tx(k, id, f => { const l = liquidazioniDi(f), i = l.findIndex(x => x.id === lid); if (i < 0) return null; out = fn(Object.assign({}, l[i])); if (out === null) l.splice(i, 1); else l[i] = out; return {Liquidazioni: l}; });
  return out;
}
// trasferimento Stripe di un pagamento (cercato per id del pagamento): oggetto, null se non c'è
async function trasferimentoDi(conto, lid){
  const l = await stripeApi("GET", "transfers", {destination: conto, limit: 100});
  return (l.data || []).find(t => t.metadata && t.metadata.liquidazione === lid) || null;
}
// controllo notturno: pagamenti rimasti «in corso» e trasferimenti Stripe ai partner non registrati (o registrati ma non su Stripe)
async function controllaTrasferimenti(differenze, ora){
  if (!CFG.stripeKey) return [];
  const esiti = [], conto = campoConto(), da = Math.floor((new Date(ora || Date.now()) - 35 * 864e5) / 1000);
  const leggi = async () => [].concat((await DB.lista("caf")).map(x => ["caf", x]), (await DB.lista("ottici")).map(x => ["ottici", x])).filter(([, x]) => x[conto]);
  let partner = await leggi();
  for (const [k, x] of partner){
    const id = x.ID || x._id;
    for (const v of liquidazioniDi(x).filter(v => v.stato === "in corso" && Date.now() - new Date(v.registrato) > 15 * 60e3)){
      const t = await trasferimentoDi(x[conto], v.id);
      if (t){ await aggiornaLiquidazione(k, id, v.id, y => { delete y.stato; return Object.assign(y, {stripe: t.id, nota: [y.nota, t.id].filter(Boolean).join(" · ")}); }); esiti.push({esito: `pagamento a ${id} confermato da Stripe (${t.id})`}); }
      else { await aggiornaLiquidazione(k, id, v.id, () => null); await registra("controllo notturno", "pagamento a partner non partito", id, `${euroIt(v.importo)}: nessun trasferimento su Stripe, tolto dall'estratto`); esiti.push({esito: `pagamento a ${id} non partito: tolto`}); }
    }
  }
  // tutti i trasferimenti degli ultimi 35 giorni contro i pagamenti registrati
  partner = await leggi();
  const tr = []; let dopo = "";
  for (let i = 0; i < 10; i++){ const p = await stripeApi("GET", "transfers", Object.assign({limit: 100, created: {gte: da}}, dopo ? {starting_after: dopo} : {})); tr.push(...(p.data || [])); if (!p.has_more || !p.data.length) break; dopo = p.data[p.data.length - 1].id; }
  const reg = new Map(); for (const [k, x] of partner) for (const v of liquidazioniDi(x)) if (v.stripe) reg.set(v.stripe, {k, id: x.ID || x._id, v});
  for (const t of tr.filter(t => t.metadata && t.metadata.socialglass)){
    const r = reg.get(t.id);
    if (!r) differenze.push({univoco: "", testo: `Trasferimento Stripe ${t.id} di ${euroIt(t.amount / 100)} a ${t.metadata.socialglass === "caf" ? "CAF" : "ottica"} ${t.metadata.id} non registrato nell'estratto conto`});
    else if (Math.abs(r.v.importo - t.amount / 100) > 0.009) differenze.push({univoco: "", testo: `Pagamento a ${r.id}: ${euroIt(r.v.importo)} nell'estratto, ${euroIt(t.amount / 100)} su Stripe (${t.id})`});
    if (t.reversed || t.amount_reversed) differenze.push({univoco: "", testo: `Trasferimento Stripe ${t.id} a ${t.metadata.id} stornato su Stripe: controlla l'estratto conto`});
  }
  const visti = new Set(tr.map(t => t.id));
  for (const [s1, r] of reg) if (!visti.has(s1) && new Date(r.v.registrato || r.v.il) / 1000 > da + 864e2) differenze.push({univoco: "", testo: `Pagamento Stripe a ${r.id} (${euroIt(r.v.importo)}, ${s1}) registrato ma non trovato su Stripe`});
  return esiti;
}
// Compensi previsti: quelli che matureranno dai clienti di oggi se l'occhiale verrà consegnato e i canoni pagati fino alla durata minima (con l'accordo in vigore oggi).
function compensoPrevisto(utenti, acc, ruolo){
  const l = accordiDi(acc, ruolo), ac = accordoAl(l, new Date().toISOString()), r2 = x => Math.round(x * 100) / 100;
  const out = {totale: 0, clienti: 0, senzaPreventivo: 0, righe: []}; if (!ac) return out;
  for (const f of utenti){
    if (f.Archiviato) continue;
    const {o, pg, pr, periodi} = periodiCliente(f), cur = pg.attivatoIl && pg.stato !== "SIMULATO" ? periodi[periodi.length - 1] : null;
    if (pg.chiuso || pg.esito || f.Stato === STATI.CHIUSO) continue;
    const consegnato = !!(cur && cur.consegnato), rata = Number(pr.rata) || 0, mesi = Number(pr.mesi) || 12;
    let imp = null;
    if (ac.tipo === "fisso") imp = consegnato ? 0 : Number(ac.valore);
    else if (ac.tipo === "rata") imp = consegnato ? 0 : (rata ? rata + (Number(pr.spedizione) || 0) : null);
    else { const pagati = cur ? cur.incassi.filter(x => x.canone > 0).length : 0, maturati = consegnato ? pagati : 0;
      imp = rata ? Math.max(0, mesi - maturati) * rata * ac.valore / 100 : null; }
    if (imp === null){ out.senzaPreventivo++; continue; }
    if (imp <= 0) continue;
    out.clienti++; out.totale += imp; out.righe.push({univoco: f.Univoco, cliente: `${nm(f.Nome)} ${nm(f.Cognome)}`.trim(), stato: f.Stato || "", importo: r2(imp)});
  }
  out.totale = r2(out.totale); return out;
}
// tutti = tutti i clienti (per i compensi degli occhiali fatti prima di un cambio CAF/ottica); senza id del partner si usano solo i suoi clienti di oggi
const idPartner = acc => acc && (acc.ID || acc._id) || "";
const righePartner = (utenti, acc, ruolo, tutti) => idPartner(acc) && tutti ? righeCompenso(tutti, acc, ruolo, idPartner(acc)) : righeCompenso(utenti, acc, ruolo);
function estratto(utenti, acc, da, a, ruolo, tutti){
  const g = d => String(d || "").slice(0, 10), r2 = x => Math.round(x * 100) / 100, c = (acc && acc.Compenso) || {};
  const tutte = righePartner(utenti, acc, ruolo, tutti).map(x => Object.assign({tipo: "compenso"}, x))
    .concat(liquidazioniDi(acc).map(x => ({tipo: "pagamento", id: x.id, il: x.il, descrizione: [x.causale || "pagamento", x.metodo, x.stato === "in corso" ? "IN CORSO" : "", x.nota, (x.ordini || []).length ? `copre ${x.ordini.length} ${x.ordini.length === 1 ? "occhiale" : "occhiali"}` : ""].filter(Boolean).join(" · "), importo: Number(x.importo) || 0,
      stripe: !!x.stripe, inCorso: x.stato === "in corso", ordini: (x.ordini || []).map(o => ({univoco: o.univoco, cliente: o.cliente, il: o.il, importo: o.importo}))})))
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
  const prev = compensoPrevisto(utenti, acc, ruolo);
  return {accordo: att && att.tipo ? {tipo: att.tipo, valore: Number(att.valore) || 0, dal: att.dal, base: !!att.base} : null, accordi: storia, periodo: {da: da || "", a: a || ""}, righe, stima, previsto: prev.totale, previstoClienti: prev.clienti, previstoSenzaPreventivo: prev.senzaPreventivo, previstoRighe: prev.righe,
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
// Compenso secondo l'accordo: matura alla consegna dell'occhiale (fisso o una rata + spedizione), oppure percentuale sui canoni dalla consegna in poi.
function conteggi(utenti, acc, da, a, ruolo, tutti){
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
  const righe = righePartner(utenti, acc, ruolo, tutti), st = accordiDi(acc, ruolo), ult = st[st.length - 1];
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
function registraEsito(res, chiE, azione, rif, dettaglio){
  chi(null, azione);
  const fine = res.end.bind(res);
  res.end = body => { if (res.statusCode < 300) registra(chiE, azione, rif, dettaglio).finally(() => fine(body)); else fine(body); };
}

/* ---------- copia dei dati ogni notte (ultime 7), scaricabile dal pannello ---------- */
const RACCOLTE_COPIA = ["utenti", "caf", "ottLogin", "ottici", "mont", "forn", "ordForn", "segn"];
/* ---------- pilota (modifica 18): incassi su Stripe e nell'app devono coincidere, fattura per fattura ----------
   Si lancia per un periodo (di solito l'ultima settimana). Esito «ok» solo con zero differenze. */
const CORREZIONI = /dati cliente corretti|cambio ottica|eliminazione|blocco anagrafica|annull/i;
async function controlloPilota(da, a){
  const r2 = x => Math.round(x * 100) / 100, dentro = t => t >= da && t <= a;
  const out = {da, a, il: new Date().toISOString(), stripe: {fatture: 0, importo: 0, canoniMensili: 0}, app: {incassi: 0, importo: 0}, differenze: [], altre: [], interventi: [], erroriNotte: 0, differenzeNotte: 0};
  // nell'app: ogni incasso con la sua fattura Stripe (anche quelli del periodo prima di un rinnovo)
  const app = new Map(), noti = new Set();
  for (const u of await DB.tutti()){
    const o = parseOrdine(u.f.Ordine), p = o.rinnovo && o.rinnovo.prosegue;
    for (const l of [(o.pagamento || {}).pagamenti, p && p.pagamenti]) for (const x of l || []) if (x && x.id){
      noti.add(x.id); app.set(x.id, {univoco: u.f.Univoco, il: x.il, importo: r2((x.canone || 0) + (x.spedizione || 0) + (x.riscatto || 0))});
    }
    for (const id of (p && p.idPrecedenti) || []) noti.add(id);
  }
  for (const [id, x] of app) if (/^in_/.test(id) && x.importo > 0 && dentro(String(x.il || ""))){ out.app.incassi++; out.app.importo = r2(out.app.importo + x.importo); }
  if (!CFG.stripeKey) out.stripe = null;
  else {
    // fatture pagate su Stripe nel periodo (si parte 45 giorni prima: la data di pagamento può essere successiva alla creazione)
    const visti = new Set(); let dopo = null;
    for (let pag = 0; pag < 30; pag++){
      const l = await stripeApi("GET", "invoices", Object.assign({status: "paid", limit: 100, created: {gte: Math.floor(new Date(da) / 1000) - 45 * 86400, lte: Math.floor(new Date(a) / 1000)}}, dopo ? {starting_after: dopo} : {}));
      for (const inv of l.data || []){
        const pagata = new Date(((inv.status_transitions || {}).paid_at || inv.created) * 1000).toISOString();
        if (!dentro(pagata) || !(inv.amount_paid > 0)) continue;
        visti.add(inv.id); const imp = r2(inv.amount_paid / 100), uv = (require("./_stripe").metaDi(inv)).univoco || "";
        out.stripe.fatture++; out.stripe.importo = r2(out.stripe.importo + imp); if (inv.billing_reason === "subscription_cycle") out.stripe.canoniMensili++;
        if (!uv){ out.altre.push({fattura: inv.id, importo: imp, il: pagata, nota: "fattura Stripe senza cliente SocialGlass"}); continue; }
        const x = app.get(inv.id);
        if (!x) out.differenze.push({univoco: uv, fattura: inv.id, importo: imp, il: pagata, problema: noti.has(inv.id) ? "pagata su Stripe, contata nel periodo prima del rinnovo" : "pagata su Stripe ma non registrata nell'app"});
        else if (Math.abs(x.importo - imp) > 0.009) out.differenze.push({univoco: uv, fattura: inv.id, importo: imp, app: x.importo, il: pagata, problema: "importo diverso"});
      }
      if (!l.has_more || !(l.data || []).length) break; dopo = l.data[l.data.length - 1].id;
    }
    for (const [id, x] of app) if (/^in_/.test(id) && x.importo > 0 && dentro(String(x.il || "")) && !visti.has(id))
      out.differenze.push({univoco: x.univoco, fattura: id, importo: x.importo, il: x.il, problema: "registrata nell'app ma non risulta pagata su Stripe nel periodo"});
  }
  // interventi a mano non previsti e problemi del controllo notturno nello stesso periodo
  try { out.interventi = (await DB.ultimi("registro", 500)).filter(x => dentro(String(x.il || "")) && CORREZIONI.test(x.azione || "")).map(({il, chi, azione, rif}) => ({il, chi, azione, rif})); } catch(e){ console.error(e); }
  try { const n = (await DB.meta("notte")) || {}; out.erroriNotte = (n.errori || []).length; const d = (await DB.meta("differenze-stripe")) || {}; out.differenzeNotte = (d.voci || []).length; } catch(_){}
  out.ok = !!out.stripe && !out.differenze.length && !out.erroriNotte && !out.differenzeNotte;
  return out;
}
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

module.exports = {firmaCliente, confermaCliente, SERVE_CONFERMA, stessaData, GIORNI_CONFERMA, nuovaLiquidazione, aggiornaLiquidazione, trasferimentoDi, controllaTrasferimenti, compensiPartner, codiceIntero, righeCompenso, periodiCliente, INFORMATIVA_VERSIONE, inChiaro, totp, CHIAVE_OK, CONDIZIONI_VERSIONE, GIORNI_RESTITUZIONE, codaEccezioni, segnalazioniAperte, SOSPESO, partnerSospeso, ANNULLABILI, segnaAnnullabile, annullabileDa, annullaUltimo, codiceCliente, codiceMontatura, montaturaDopoRecesso, rifiutato, pagato, Conflitto, chi, chiAgisce, preparaScrittura, versioneDi, permesso, MAPPA, chiaviPushPubblica, labMontatura, iscriviPartner, pushPartner, GIORNI_LINK, GIORNI_ARCHIVIO, LINK_SCADUTO, maiAttivato, scadenzaLink, giornoIt, PREMIO_NON_ATTIVABILE, abbonamentoAttivo, residenza, inLavorazione, annullabile, COMPENSO_BASE, giaTroppi, caricaListini, salvaListini, inviaCanale, nm, SITO, portaleStripe, oraRoma, orariDi, slotLiberi, TIPI_APP, FASCIA, registra, registraEsito, datiCompleti, copiaNotturna, leggiCopia, incassi, chiaviPush, pushCliente, premiaAmico, avvisaPronto, LAB, labAttivo, avviaLavorazione, previsione, accordiDi, estratto, liquidazioniDi, incassi, canaliCollegati, numeroCliente, stripeLive, campoConto, accessoDiProva, controlloPilota, controlloCF, clientePerCF, stessaPersona, campiCF, luoghiCF, inRinnovo, pgVivo, fattureVecchie, giorniAllaChiusura, testoSollecito, inviaCliente, sollecita, GIORNI_CHIUSURA, MAG, scorte, infoMont, disponibile, riservaMontatura, liberaMontatura, campiScorte, proposta, riordinoAuto, sottoScorta, situazione, BLOCCATO, conteggi, dataIt, hashPw, checkPw, PROVA, ipDi, bloccato, codiceErrato, TROPPI, avvisa, stripeApi, rinnova, attiva, verificaPagamento, CFG, MODO, DEMO, demo, DB, STATI, parseOrdine, linkCliente, nuovoUnivoco, sign, verify, safeEq, send, readRaw, readBody, tooMany, wrap, CF, PREZZI, NOAUTH};
