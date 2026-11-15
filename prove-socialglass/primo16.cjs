// Prova generale, correzione: la fattura del primo pagamento arriva prima dell'attivazione (ordine reale degli avvisi di Stripe)
const L = require("/home/claude/ottivista/socialglass/api/_lib.js"), S = require("/home/claude/ottivista/socialglass/api/_stripe.js");
(async () => {
  const uv = "SGPRIMO01";
  L.demo.utenti.push({Univoco: uv, Nome: "PRIMO", Cognome: "PROVA", Stato: L.STATI.PAGAMENTO, Ordine: JSON.stringify({prezzi: {rata: 9.9, spedizione: 9.9, mesi: 12}, pagamento: {stato: "IN CORSO", sessione: "cs_1"}})});
  const u = () => L.DB.utente("Univoco", uv);
  const inv = (id, cent, reason) => ({id: "ev_" + id, type: "invoice.paid", data: {object: {id, amount_paid: cent, billing_reason: reason, subscription_details: {metadata: {univoco: uv}}}}});
  let r = await S.elabora(await u(), inv("in_1", 1980, "subscription_create")); let x = await u(), p = L.parseOrdine(x.f.Ordine).pagamento;
  console.log("1 fattura prima dell'attivazione:", JSON.stringify(r), "| stato", x.f.Stato, "| canoni", p.ratePagate, "| pagamenti", p.pagamenti.map(y => y.canone + "+" + y.spedizione));
  await L.attiva(await u(), {id: "cs_1", subscription: "sub_1", customer: "cus_1", payment_status: "paid", status: "complete"});
  x = await u(); p = L.parseOrdine(x.f.Ordine).pagamento; console.log("2 attivazione:", x.f.Stato, "| canoni", p.ratePagate, "| primaRata", p.primaRata, "| pagamenti", p.pagamenti.length);
  await S.elabora(await u(), inv("in_2", 990, "subscription_cycle")); x = await u(); p = L.parseOrdine(x.f.Ordine).pagamento; console.log("3 secondo canone:", p.ratePagate);
  await S.elabora(await u(), inv("in_2", 990, "subscription_cycle")); x = await u(); p = L.parseOrdine(x.f.Ordine).pagamento; console.log("  stesso avviso ripetuto:", p.ratePagate);
  // ordine non ancora pagato: un rifiuto non diventa insoluto
  L.demo.utenti.push({Univoco: "SGPRIMO02", Nome: "X", Cognome: "PROVA", Stato: L.STATI.PAGAMENTO, Ordine: JSON.stringify({pagamento: {stato: "IN CORSO", sessione: "cs_2"}})});
  r = await S.elabora(await L.DB.utente("Univoco", "SGPRIMO02"), {id: "ev_f", type: "invoice.payment_failed", data: {object: {id: "in_9", amount_due: 990, subscription_details: {metadata: {univoco: "SGPRIMO02"}}}}});
  console.log("4 rifiuto prima dell'attivazione:", JSON.stringify(r));
  process.exit(0);
})();
