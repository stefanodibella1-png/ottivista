// regole dei compensi e del cambio ottica (15/11 sera): rinnovo in ottica o automatico → niente al CAF; ottica mai cambiata con l'occhiale ordinato
process.env.SESSION_SECRET = "k".repeat(40);
const D = "/home/claude/ottivista/socialglass/api/", L = require(D + "_lib.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const iso = d => new Date(d).toISOString(), ora = Date.now();
const run = (h, body, tok) => new Promise(res => { const {Readable} = require("stream"); const req = Readable.from([]); req.body = body;
  req.method = "POST"; req.url = "/api/x"; req.headers = {authorization: "Bearer " + tok, "x-forwarded-for": "1.2.3." + Math.floor(Math.random() * 200)};
  const out = {statusCode: 200, h: {}, setHeader(k, v){ this.h[k] = v; }, getHeader(k){ return this.h[k]; }, end(x){ let d = {}; try { d = JSON.parse(x); } catch(e){} res({s: this.statusCode, d}); }}; h(req, out); });
const OTT = "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania";
const cli = (uv, stato, o) => { const f = {Univoco: uv, Nome: "C", Cognome: uv, CAF: "CAF001", Ottica1: OTT, Listino: "A", Stato: stato, Ordine: JSON.stringify(o)}; L.demo.utenti.push(f); return f; };
const pr = {rata: 10, mesi: 12, spedizione: 5}, pg = g => ({stato: "ATTIVO", abbonamento: "sub_x", attivatoIl: iso(ora - g * 864e5), ratePagate: 11});
const righe = (ruolo, id) => L.righeCompenso(L.demo.utenti, {ID: id, Accordi: [{dal: "2000-01-01", tipo: "fisso", valore: 3}]}, ruolo, id);
(async () => {
  const ott = L.sign({ruolo: "ottico", id: "OTT07"}), adm = L.sign({ruolo: "admin"});
  // 1. rinnovo fatto dall'ottica: al CAF niente, all'ottica sì
  cli("SGR1", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 340 * 864e5), pagamento: pg(350)});
  let r = await run(require(D + "utenti.js"), {azione: "rinnovo", univoco: "SGR1"}, ott); ok(r.s === 200, "rinnovo dall'ottica");
  let u = await L.DB.utente("Univoco", "SGR1"), o = L.parseOrdine(u.f.Ordine); ok(o.caf === "", "ordine nuovo senza CAF");
  o.montatura = {modello: "B"}; o.prezzi = pr; o.pagamento = pg(10); await L.DB.aggiorna(u, {Stato: L.STATI.PRONTO, Ordine: JSON.stringify(o)});
  r = await run(require(D + "ordine.js"), {azione: "consegnato", univoco: "SGR1", codice: "SGR1"}, ott); ok(r.s === 200, "consegna in ottica (" + (r.d.errore || r.s) + ")");
  ok(righe("caf", "CAF001").filter(x => x.univoco === "SGR1").length === 1, "CAF001: compenso solo del primo occhiale (commissionato da lui)");
  ok(righe("ottica", "OTT07").filter(x => x.univoco === "SGR1").length === 2, "OTT07: compenso di entrambi gli occhiali");
  // 2. il cliente sceglie «occhiale nuovo»: rinnovo automatico, al CAF niente
  cli("SGR2", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 370 * 864e5), pagamento: pg(375)});
  u = await L.DB.utente("Univoco", "SGR2"); o = L.parseOrdine(u.f.Ordine); const p = L.PREZZI.periodo(o);
  o.finePeriodo = {scelta: "rinnova", il: iso(ora)}; await require(D + "scadenze.js").esegui(u, o, p, iso(ora));
  u = await L.DB.utente("Univoco", "SGR2"); ok(L.parseOrdine(u.f.Ordine).caf === "" && u.f.CAF === "CAF001", "rinnovo automatico: ordine senza CAF, il cliente resta del CAF");
  // 3. rinnovo dal CAF: compenso al CAF
  const caf = L.sign({ruolo: "caf", id: "CAF001"});
  cli("SGR3", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 340 * 864e5), pagamento: pg(350)});
  r = await run(require(D + "utenti.js"), {azione: "rinnovo", univoco: "SGR3"}, caf); u = await L.DB.utente("Univoco", "SGR3"); ok(r.s === 200 && L.parseOrdine(u.f.Ordine).caf === "CAF001", "rinnovo dal CAF: ordine del CAF");
  // 4. cambio ottica dal pannello
  cli("SGL1", L.STATI.ATTIVO, {montatura: {modello: "A"}, prezzi: pr, pagamento: pg(3), lab: {stato: "IN LAVORAZIONE"}});
  r = await run(require(D + "admin.js"), {azione: "cambiaOttica", id: "SGL1", ottica: "OTT12"}, adm); ok(r.s === 409, "occhiale in laboratorio: ottica non cambiabile (" + (r.d.errore || "").slice(0, 60) + ")");
  cli("SGL2", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 30 * 864e5), pagamento: pg(40)});
  r = await run(require(D + "admin.js"), {azione: "cambiaOttica", id: "SGL2", ottica: "OTT12"}, adm); ok(r.s === 409, "dopo la consegna con l'ottica aperta: no");
  L.demo.ottici.find(x => x.ID === "OTT07").Disattivato = {il: iso(ora)};
  r = await run(require(D + "admin.js"), {azione: "cambiaOttica", id: "SGL2", ottica: "OTT12"}, adm); ok(r.s === 200, "dopo la consegna con l'ottica chiusa: sì");
  ok(righe("ottica", "OTT07").some(x => x.univoco === "SGL2") && !righe("ottica", "OTT12").some(x => x.univoco === "SGL2"), "il compenso dell'occhiale consegnato resta a OTT07");
  delete L.demo.ottici.find(x => x.ID === "OTT07").Disattivato;
  cli("SGL3", L.STATI.MONTATURA, {montatura: {modello: "A", codice: "SG-1042"}});
  r = await run(require(D + "admin.js"), {azione: "cambiaOttica", id: "SGL3", ottica: "OTT12"}, adm); ok(r.s === 200 && r.d.ripartito, "prima del pagamento (correzione): sì, riparte dalla scelta");
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
