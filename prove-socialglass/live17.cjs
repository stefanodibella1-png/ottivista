// Modifica 17, punto 2: con la chiave live accessi e barra di prova si spengono; pulizia con anteprima
process.env.SESSION_SECRET = "y".repeat(40);
const D = "/home/claude/ottivista/socialglass/api/";
const L = require(D + "_lib.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const res = () => ({statusCode: 200, setHeader(){}, end(x){ this.body = JSON.parse(x || "{}"); }});
const req = (url, body, tok) => ({method: body ? "POST" : "GET", url, body, headers: Object.assign({"x-forwarded-for": "10.1.1." + Math.floor(Math.random()*250)}, tok ? {authorization: "Bearer " + tok} : {}), socket: {}});
const go = async (f, body, tok) => { const r = res(); await require(D + f + ".js")(req("/api/" + f, body, tok), r); return r; };
(async () => {
  L.demo.utenti.push({Univoco: "SGLIVEP1", Nome: "TEST", Cognome: "PROVA", CAF: "CAF001", Ottica1: "OTT07 - Ottica Demo", Stato: L.STATI.REGISTRATO, Ordine: "{}"},
    {Univoco: "SGLIVEV1", Nome: "VERA", Cognome: "CLIENTE", CAF: "", Ottica1: "OTT07 - Ottica Demo", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({pagamento: {stato: "ATTIVO", abbonamento: "sub_v"}})},
    {Univoco: "SGALTRO1", Nome: "ALTRA", Cognome: "OTTICA", CAF: "", Ottica1: "OTT99 - Vera", Stato: L.STATI.REGISTRATO, Ordine: "{}"});
  // in prova: CAF001 entra
  let r = await go("login", {ruolo: "caf", codice: "CAF001", password: "demo"}); const tok = r.body.token;
  ok(r.statusCode === 200 && tok, "in prova CAF001 entra");
  ok((await go("health")).body.pagamenti === "simulati", "health in prova: simulati");
  // anteprima pulizia (admin)
  const adm = L.sign({ruolo: "admin", id: "admin"});
  r = await go("admin", {azione: "rimuoviProva", anteprima: true}, adm);
  const cl = r.body.clienti || []; ok(r.statusCode === 200 && cl.length > 0, `anteprima: ${cl.length} clienti (${cl.map(c => c.univoco + (c.prova ? "" : "*")).join(", ")}) · nessuno rimosso`);
  const prima = (await L.DB.tutti()).length;
  const tieni = "SGLIVEV1"; ok(cl.find(c => c.univoco === tieni).pagato && !cl.some(c => c.univoco === "SGALTRO1"), "il cliente vero con abbonamento è segnalato, quello di un'altra ottica non c'è");
  r = await go("admin", {azione: "rimuoviProva", tieni: [tieni]}, adm);
  const dopo = await L.DB.tutti();
  ok(r.body.ok && r.body.tenuti === 1 && dopo.some(u => u.f.Univoco === tieni) && dopo.length === prima - cl.length + 1, `rimossi ${r.body.clientiRimossi}, tenuto ${tieni}`);
  // passaggio a live (stessa sessione: il server riparte con la chiave nuova)
  L.CFG.stripeKey = "sk_live_finto";
  ok((await go("health")).body.pagamenti === "reali", "health con la chiave live: reali");
  L.demo.caf = L.demo.caf || [];
  r = await go("login", {ruolo: "caf", codice: "CAF001", password: "demo"}); ok(r.statusCode === 401, "con i pagamenti veri CAF001 non entra (" + r.statusCode + ")");
  r = await go("login", {ruolo: "ottico", codice: "OTT07", password: "demo"}); ok(r.statusCode === 401, "con i pagamenti veri OTT07 non entra");
  r = await go("clienti", null, tok); ok(r.statusCode === 401, "una sessione CAF001 già aperta non vale più (" + r.statusCode + ")");
  ok(L.campoConto() === "StripeAccountLive", "conti dei partner separati da quelli di prova");
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
