// punto 5: il laboratorio che apre l'elenco non crea buste; l'amministratore le crea da «Da risolvere»
process.env.SESSION_SECRET = "w".repeat(40);
const D = "/home/claude/ottivista/socialglass/api/", L = require(D + "_lib.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const iso = d => new Date(d).toISOString(), ora = Date.now();
const run = (h, method, body, tok, url) => new Promise(res => { const {Readable} = require("stream"); const req = Readable.from([]); if (body) req.body = body;
  req.method = method; req.url = url; req.headers = {authorization: "Bearer " + tok, "x-forwarded-for": "1.2.3.5"};
  const out = {statusCode: 200, h: {}, setHeader(k, v){ this.h[k] = v; }, getHeader(k){ return this.h[k]; }, end(x){ let d = {}; try { d = JSON.parse(x); } catch(e){} res({s: this.statusCode, d}); }}; h(req, out); });
(async () => {
  await L.DB.meta("laboratorio", {attivo: true, password: "x"});
  for (const i of [1, 2]) L.demo.utenti.push({Univoco: "SGLB" + i, Nome: "C", Cognome: "L" + i, CAF: "CAF001", Ottica1: "OTT07 - x - y", Stato: L.STATI.ATTIVO,
    Ordine: JSON.stringify({montatura: {codice: "SG-1042"}, prezzi: {rata: 10}, pagamento: {stato: "ATTIVO", attivatoIl: iso(ora - 3 * 864e5)}})});
  const lab = L.sign({ruolo: "lab"}), adm = L.sign({ruolo: "admin"});
  let r = await run(require(D + "clienti.js"), "GET", null, lab, "/api/clienti");
  ok(r.s === 200 && !r.d.buste.some(x => /^SGLB/.test(x.univoco)), "il laboratorio apre l'elenco: nessuna busta creata");
  ok(!L.demo.utenti.filter(u => /^SGLB/.test(u.Univoco)).some(u => JSON.parse(u.Ordine).lab), "nessuna scrittura sugli ordini");
  r = await run(require(D + "admin.js"), "POST", {azione: "dati"}, adm, "/api/admin");
  const coda = (r.d.coda || []).filter(x => x.tipo === "busta"); ok(coda.length === 2, "«Da risolvere»: 2 ordini pagati senza busta (" + coda.length + ")");
  r = await run(require(D + "admin.js"), "POST", {azione: "busta", univoco: "SGLB1", op: "crea"}, adm, "/api/admin"); ok(r.s === 200, "crea la busta");
  const o1 = JSON.parse(L.demo.utenti.find(u => u.Univoco === "SGLB1").Ordine); ok(o1.lab && o1.lab.stato === "DA VERIFICARE" && o1.lab.verifica, "busta nata «da verificare»");
  r = await run(require(D + "admin.js"), "POST", {azione: "busta", univoco: "SGLB1", op: "crea"}, adm, "/api/admin"); ok(r.s === 409, "seconda volta: rifiutato");
  r = await run(require(D + "admin.js"), "POST", {azione: "busta", univoco: "SGLB2", op: "ottica"}, adm, "/api/admin"); ok(r.s === 200, "l'altro lo segue l'ottica");
  r = await run(require(D + "admin.js"), "POST", {azione: "dati"}, adm, "/api/admin"); ok(!(r.d.coda || []).some(x => x.tipo === "busta"), "«Da risolvere» vuoto");
  r = await run(require(D + "clienti.js"), "GET", null, lab, "/api/clienti"); ok(r.d.buste.some(x => x.univoco === "SGLB1") && !r.d.buste.some(x => x.univoco === "SGLB2"), "il laboratorio vede solo la busta creata");
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
