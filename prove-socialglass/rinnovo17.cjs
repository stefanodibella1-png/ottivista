// Modifica 17, punto 1: canoni e insoluti durante il cambio occhiale (rinnovo non ancora confermato)
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "x".repeat(40);
const D = "/home/claude/ottivista/socialglass/api/";
const L = require(D + "_lib.js"), S = require(D + "_stripe.js"), SC = require(D + "scadenze.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const uv = "SGRIN17A", sub = "sub_R17";
const meta = {subscription_details: {metadata: {univoco: uv}}, subscription: sub};
const inv = (id, cent, extra) => Object.assign({id, amount_paid: cent, amount_due: cent, billing_reason: "subscription_cycle", created: Math.floor(Date.now()/1000)}, meta, extra || {});
const ev = (type, o, id) => ({id: id || "ev_" + type + o.id, type, data: {object: o}});
const u = () => L.DB.utente("Univoco", uv);
const O = async () => L.parseOrdine((await u()).f.Ordine);
const res = () => { const r = {statusCode: 200, h: {}, setHeader(k, v){ this.h[k] = v; }, end(x){ this.body = JSON.parse(x || "{}"); }}; return r; };
const req = (body) => ({method: "POST", url: "/api/pagamento", body, headers: {"x-forwarded-for": "10.9.9." + Math.floor(Math.random()*200)}, socket: {}});
(async () => {
  const vecchi = Array.from({length: 11}, (_, i) => ({id: "in_v" + i, il: new Date(Date.now() - (12 - i) * 30 * 864e5).toISOString(), canone: 20, spedizione: 0, riscatto: 0}));
  L.demo.utenti.push({Univoco: uv, Nome: "RINNOVO", Cognome: "PROVA", Cellulare: "3330000000", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({
    montatura: {modello: "VECCHIO", colore: "NERO"}, lenti: {nome: "L"}, prezzi: {rata: 20, mesi: 12, totale: 240}, consegnatoIl: new Date(Date.now() - 300*864e5).toISOString(),
    pagamento: {stato: "ATTIVO", abbonamento: sub, cliente: "cus_R17", attivatoIl: new Date(Date.now() - 360*864e5).toISOString(), ratePagate: 11, pagamenti: vecchi}})});
  await L.rinnova(await u(), {otticoId: ""});
  let o = await O(), p = o.rinnovo.prosegue;
  ok((await u()).f.Stato === L.STATI.REGISTRATO && !o.pagamento && p.abbonamento === sub && p.ratePagate === 11 && p.idPrecedenti.length === 11, "rinnovo aperto: abbonamento che prosegue con 11 mesi e 11 fatture già contate");
  // 1 canone del vecchio occhiale pagato durante la finestra
  let r = await S.elabora(await u(), ev("invoice.paid", inv("in_12", 2000)));
  o = await O(); p = o.rinnovo.prosegue;
  ok(r.ok && p.ratePagate === 12 && p.pagamenti.length === 1 && p.pagamenti[0].canone === 20 && !o.pagamento, "canone pagato nella finestra: contato (12 mesi), nessun pagamento nuovo creato");
  // 2 una fattura vecchia ripetuta (o recuperata di notte) non si riconta
  r = await S.elabora(await u(), ev("invoice.paid", inv("in_v3", 2000), "notte-in_v3"));
  ok(r.vecchia && (await O()).rinnovo.prosegue.ratePagate === 12, "fattura del periodo precedente ignorata");
  // 3 canone non pagato nella finestra → insoluto sul rinnovo, sollecito, coda dell'amministratore
  r = await S.elabora(await u(), ev("invoice.payment_failed", inv("in_13", 0, {amount_due: 2000, attempt_count: 1, hosted_invoice_url: "https://pay.example/in_13"})));
  o = await O(); p = o.rinnovo.prosegue;
  ok(r.ok && p.insoluto && p.insoluto.importo === 20 && (p.insoluto.messaggi || []).length === 1, "insoluto nella finestra registrato, sollecito partito (" + ((p.insoluto.messaggi || [])[0] || {}).canale + ")");
  ok(/restituito/.test(((p.insoluto.messaggi || [])[0] || {}).testo || ""), "il sollecito dice che l'occhiale va restituito (il vecchio è dal cliente)");
  const coda = L.codaEccezioni([await u()], [], [], {}, new Date().toISOString(), []);
  ok(coda.some(x => x.tipo === "insoluto" && x.univoco === uv), "nella coda dell'amministratore");
  // 4 conferma del nuovo occhiale bloccata finché non paga
  { const x = await u(), oo = L.parseOrdine(x.f.Ordine); oo.montatura = {modello: "NUOVO", colore: "BLU"}; oo.lenti = {nome: "L2"}; oo.prezzi = {rata: 25, mesi: 12, totale: 300, spedizione: 0};
    await L.DB.aggiorna(x, {Stato: L.STATI.PAGAMENTO, Residenza: {cap: "00100", via: "Via Prova 1", comune: "Roma", provincia: "RM"}, Ordine: JSON.stringify(oo)}); }
  const rs = res(); await require(D + "pagamento.js")(req({univoco: uv, consensoContratto: true, consensoAddebito: true, consensoSuMisura: true}), rs);
  ok(rs.statusCode === 409 && rs.body.insoluto, "conferma bloccata: " + (rs.body.errore || "").slice(0, 70));
  // 5 il canone arriva → insoluto chiuso, 13 mesi; ora la conferma passa (senza Stripe: simulata)
  r = await S.elabora(await u(), ev("invoice.paid", inv("in_13", 2000)));
  o = await O(); p = o.rinnovo.prosegue;
  ok(!p.insoluto && p.ratePagate === 13, "canone pagato: insoluto chiuso, 13 mesi");
  // 6 attivazione del rinnovo come fa pagamento.js con Stripe, poi una fattura della finestra ripetuta non va nel periodo nuovo
  { const x = await u(), oo = L.parseOrdine(x.f.Ordine); oo.pagamento = {stato: "ATTIVO", abbonamento: sub, cliente: "cus_R17", ratePagate: 0, mesiPrecedenti: oo.rinnovo.prosegue.ratePagate, attivatoIl: new Date().toISOString(), rinnovato: true};
    await L.DB.aggiorna(x, {Stato: L.STATI.ATTIVO, Ordine: JSON.stringify(oo)}); }
  r = await S.elabora(await u(), ev("invoice.paid", inv("in_12", 2000), "notte-in_12"));
  o = await O(); ok(r.vecchia && (o.pagamento.ratePagate || 0) === 0 && o.pagamento.mesiPrecedenti === 13, "dopo la conferma: fattura della finestra non ricontata, mesi precedenti 13");
  r = await S.elabora(await u(), ev("invoice.paid", inv("in_14", 2500)));
  o = await O(); ok(o.pagamento.ratePagate === 1 && o.pagamento.pagamenti[0].canone === 25, "primo canone nuovo (25 €) contato nel periodo nuovo");
  // 7 controllo notturno dopo un rinnovo: le fatture vecchie su Stripe non diventano canoni nuovi
  L.CFG.stripeKey = "sk_test_finto"; const vera = L.stripeApi;
  const vecchio = Math.floor(Date.now()/1000) - 200*86400;
  L.stripeApi = async (m, path) => {
    if (path.startsWith("subscriptions/")) return {id: sub, status: "active"};
    if (path === "invoices") return {data: [inv("in_14", 2500), inv("in_13", 2000, {created: vecchio}), inv("in_v1", 2000, {created: vecchio}), inv("in_x", 2000, {created: vecchio})].map(i => Object.assign(i, {status: "paid"}))};
    throw new Error("chiamata inattesa " + m + " " + path);
  };
  r = await S.riconcilia(await u()); o = await O();
  ok(!r && o.pagamento.ratePagate === 1, "notte dopo il rinnovo: nessuna fattura vecchia ricontata (" + JSON.stringify(r) + ")");
  // 8 secondo cliente: insoluto nella finestra non pagato per 31 giorni → chiusura come per gli altri
  const uv2 = "SGRIN17B";
  L.demo.utenti.push({Univoco: uv2, Nome: "MOROSO", Cognome: "PROVA", Cellulare: "3330000001", Stato: L.STATI.MONTATURA, Ordine: JSON.stringify({storico: [{rata: 20}], montatura: {modello: "N", colore: "B"},
    rinnovo: {il: new Date(Date.now() - 40*864e5).toISOString(), prosegue: {abbonamento: "sub_B", cliente: "cus_B", ratePagate: 12, idPrecedenti: [],
      insoluto: {tipo: "canone", importo: 20, dal: new Date(Date.now() - 31*864e5).toISOString(), tentativi: 3}}}})});
  const cancellati = [];
  L.stripeApi = async (m, path) => { if (m === "DELETE"){ cancellati.push(path); return {id: "sub_B", status: "canceled"}; } if (path.startsWith("subscriptions/")) return {id: "sub_B", status: "past_due"}; if (path === "invoices") return {data: []}; throw new Error(path); };
  const esiti = []; await SC.controlla(await L.DB.utente("Univoco", uv2), new Date().toISOString(), esiti);
  const o2 = L.parseOrdine((await L.DB.utente("Univoco", uv2)).f.Ordine);
  ok(cancellati.includes("subscriptions/sub_B") && o2.rinnovo.prosegue.chiuso && /MANCATO PAGAMENTO/.test(o2.rinnovo.prosegue.esito) && o2.ritiro && o2.ritiro.daRitirare, "31 giorni senza pagare: abbonamento chiuso, occhiale da restituire (" + esiti.map(x => x.esito || x.errore).join("; ") + ")");
  // 9 in quel caso la conferma resta bloccata e l'abbonamento chiuso non si riusa
  { const x = await L.DB.utente("Univoco", uv2), oo = L.parseOrdine(x.f.Ordine); oo.prezzi = {rata: 25, mesi: 12, totale: 300}; oo.lenti = {nome: "L"}; await L.DB.aggiorna(x, {Stato: L.STATI.PAGAMENTO, Residenza: {cap: "00100", via: "V", comune: "Roma", provincia: "RM"}, Ordine: JSON.stringify(oo)}); }
  const rs2 = res(); await require(D + "pagamento.js")(req({univoco: uv2, consensoContratto: true, consensoAddebito: true, consensoSuMisura: true}), rs2);
  ok(rs2.statusCode === 409, "moroso chiuso: conferma ancora bloccata");
  // 10 chi chiede la pagina vede il canone in sospeso
  L.stripeApi = vera; L.CFG.stripeKey = "";
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
