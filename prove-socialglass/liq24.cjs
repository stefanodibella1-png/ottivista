// punto 6: pagamenti ai partner (saldo, blocco, occhiali coperti, Stripe in corso, controllo notturno) con Stripe simulato
process.env.SESSION_SECRET = "q".repeat(40);
const D = "/home/claude/ottivista/socialglass/api/", L = require(D + "_lib.js"), admin = require(D + "admin.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const iso = d => new Date(d).toISOString(), ora = Date.now();
const call = (body) => new Promise(res => { const { Readable } = require("stream"); const req = Readable.from([]); req.body = body;
  req.method = "POST"; req.url = "/api/admin"; req.headers = {authorization: "Bearer " + L.sign({ruolo: "admin"}), "content-type": "application/json", "x-forwarded-for": "1.2.3.4"};
  const out = {statusCode: 200, h: {}, setHeader(k, v){ this.h[k] = v; }, getHeader(k){ return this.h[k]; }, end(x){ let d = {}; try { d = JSON.parse(x); } catch(e){} res({s: this.statusCode, d}); }}; admin(req, out); });
(async () => {
  // CAF001 compenso fisso 3 € per occhiale consegnato: tre clienti consegnati = 9 €
  const c = L.demo.caf.find(x => x.ID === "CAF001"); c.Accordi = [{dal: "2000-01-01", tipo: "fisso", valore: 3}];
  for (const [i, g] of [[1, 90], [2, 60], [3, 30]]) L.demo.utenti.push({Univoco: "SGLQ" + i, Nome: "CLIENTE", Cognome: "N" + i, CAF: "CAF001", Ottica1: "OTT07 - x - y", Stato: L.STATI.CONSEGNATO,
    Ordine: JSON.stringify({prezzi: {rata: 10, mesi: 12}, pagamento: {stato: "ATTIVO", attivatoIl: iso(ora - (g + 10) * 864e5)}, consegnatoIl: iso(ora - g * 864e5)})});
  let r = await call({azione: "liquidazione", tipo: "caf", id: "CAF001", importo: "10", data: "2026-11-15", causale: "saldo"});
  ok(r.s === 409 && /al massimo 9,00/.test(r.d.errore), "oltre il maturato: rifiutato (" + r.d.errore + ")");
  r = await call({azione: "liquidazione", tipo: "caf", id: "CAF001", importo: "4", data: "2026-11-15", causale: "acconto", metodo: "bonifico"});
  ok(r.s === 200 && r.d.ordini === 2, "acconto 4 €: copre 2 occhiali (" + r.d.ordini + ")");
  let l = L.liquidazioniDi(c); ok(l[0].ordini[0].univoco === "SGLQ1" && l[0].ordini[1].importo === 1, "il più vecchio per primo: SGLQ1 3 €, SGLQ2 1 €");
  r = await call({azione: "liquidazione", tipo: "caf", id: "CAF001", importo: "5,01", data: "2026-11-15", causale: "saldo"}); ok(r.s === 409, "secondo pagamento oltre il resto (5 €): rifiutato");
  r = await call({azione: "liquidazione", tipo: "caf", id: "CAF001", importo: "50", data: "2026-11-15", causale: "rettifica"}); ok(r.s === 400, "rettifica senza nota: rifiutata");
  // Stripe
  L.CFG.stripeKey = "sk_test_finto"; c[L.campoConto()] = "acct_1"; let trasferimenti = [], conta = 0, guasto = null;
  global.fetch = async (url, o) => { const u = String(url);
    if (/accounts\/acct_1/.test(u)) return {ok: true, json: async () => ({id: "acct_1", capabilities: {transfers: "active"}, details_submitted: true})};
    if (/\/transfers/.test(u) && o.method === "POST"){ conta++; if (guasto === "prima") throw new Error("rete giù");
      const p = new URLSearchParams(o.body), key = o.headers["Idempotency-Key"]; let t = trasferimenti.find(x => x.key === key);
      if (!t){ t = {id: "tr_" + (trasferimenti.length + 1), key, amount: +p.get("amount"), metadata: {socialglass: p.get("metadata[socialglass]"), id: p.get("metadata[id]"), liquidazione: p.get("metadata[liquidazione]")}, created: Math.floor(Date.now() / 1000)}; trasferimenti.push(t); }
      if (guasto === "dopo") throw new Error("risposta persa"); return {ok: true, json: async () => t}; }
    if (/\/transfers/.test(u)) return {ok: true, json: async () => ({data: trasferimenti.slice().reverse(), has_more: false})};
    throw new Error("rete: " + u); };
  // due clic insieme: uno solo passa
  const [a1, a2] = await Promise.all([call({azione: "stripePartner", tipo: "caf", id: "CAF001", op: "paga", importo: "5", causale: "saldo"}), call({azione: "stripePartner", tipo: "caf", id: "CAF001", op: "paga", importo: "5", causale: "saldo"})]);
  ok([a1.s, a2.s].sort().join() === "200,409" && trasferimenti.length === 1, `due clic insieme: ${a1.s}/${a2.s}, trasferimenti ${trasferimenti.length}`);
  l = L.liquidazioniDi(c); ok(l.length === 2 && l[1].stripe === "tr_1" && !l[1].stato && l[1].ordini.length === 2, "pagamento Stripe registrato con gli occhiali coperti");
  r = await call({azione: "stripePartner", tipo: "caf", id: "CAF001", op: "paga", importo: "1", causale: "saldo"}); ok(r.s === 409 && /niente da pagare/.test(r.d.errore), "tutto pagato: niente altri pagamenti");
  r = await call({azione: "liquidazione", tipo: "caf", id: "CAF001", op: "elimina", rid: l[1].id}); ok(r.s === 409, "pagamento Stripe non eliminabile");
  // nuovo maturato e guasti
  L.demo.utenti.push({Univoco: "SGLQ4", Nome: "C", Cognome: "4", CAF: "CAF001", Ottica1: "OTT07 - x", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({prezzi: {rata: 10}, pagamento: {stato: "ATTIVO", attivatoIl: iso(ora - 20 * 864e5)}, consegnatoIl: iso(ora - 10 * 864e5)})});
  guasto = "dopo"; r = await call({azione: "stripePartner", tipo: "caf", id: "CAF001", op: "paga", importo: "3"});
  l = L.liquidazioniDi(c); ok(r.s === 200 && l.length === 3 && l[2].stripe === "tr_2", "risposta di Stripe persa: trovato il trasferimento e registrato (" + r.s + ")");
  L.demo.utenti.push({Univoco: "SGLQ5", Nome: "C", Cognome: "5", CAF: "CAF001", Ottica1: "OTT07 - x", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({prezzi: {rata: 10}, pagamento: {stato: "ATTIVO", attivatoIl: iso(ora - 20 * 864e5)}, consegnatoIl: iso(ora - 9 * 864e5)})});
  guasto = "prima"; r = await call({azione: "stripePartner", tipo: "caf", id: "CAF001", op: "paga", importo: "3"});
  l = L.liquidazioniDi(c); console.log(r); ok(r.s >= 400 && l.length === 3 && trasferimenti.length === 2, "Stripe guasto prima del trasferimento: errore, niente registrato (" + r.s + ")");
  guasto = null;
  // in corso rimasto a metà + trasferimento non registrato: il controllo notturno
  const vecchio = new Date(Date.now() - 20 * 60e3).toISOString();
  c.Liquidazioni.push({id: "pend1", il: "2026-11-15", importo: 3, stato: "in corso", registrato: vecchio, metodo: "Stripe"});
  trasferimenti.push({id: "tr_9", key: "x", amount: 300, metadata: {socialglass: "caf", id: "CAF001", liquidazione: "pend1"}, created: Math.floor(Date.now() / 1000)});
  trasferimenti.push({id: "tr_10", key: "y", amount: 700, metadata: {socialglass: "caf", id: "CAF001", liquidazione: "boh"}, created: Math.floor(Date.now() / 1000)});
  const diff = []; const es = await L.controllaTrasferimenti(diff, new Date().toISOString());
  l = L.liquidazioniDi(c); ok(l.find(x => x.id === "pend1").stripe === "tr_9" && !l.find(x => x.id === "pend1").stato, "notte: «in corso» con trasferimento → confermato");
  console.log(diff); ok(diff.length === 1 && /tr_10/.test(diff[0].testo), "notte: trasferimento non registrato segnalato: " + (diff[0] || {}).testo);
  c.Liquidazioni.push({id: "pend2", il: "2026-11-15", importo: 3, stato: "in corso", registrato: vecchio, metodo: "Stripe"});
  await L.controllaTrasferimenti([], new Date().toISOString()); ok(!L.liquidazioniDi(c).some(x => x.id === "pend2"), "notte: «in corso» senza trasferimento → tolto");
  const e = L.estratto(L.demo.utenti.filter(u => u.CAF === "CAF001"), c, "", "", "caf", L.demo.utenti);
  ok(e.righe.some(x => x.tipo === "pagamento" && x.stripe && x.ordini.length), "estratto: pagamenti con gli occhiali coperti");
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
