// Modifica 3: controllo notturno con Stripe simulato. Uso: node prove-socialglass/notte3.cjs (dalla radice del repo, senza chiavi)
const L = require("../socialglass/api/_lib"), S = require("../socialglass/api/_stripe");
(async () => {
  const id = await L.DB.creaUtente({Nome: "PROVA", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({prezzi: {rata: 9.9, mesi: 12}, consegnatoIl: "2026-10-01", pagamento: {stato: "ATTIVO", abbonamento: "sub_1", attivatoIl: "2026-09-01", ratePagate: 1, primaRata: true}})});
  const pg = async () => L.parseOrdine((await L.DB.utente("Univoco", id)).f.Ordine).pagamento;
  let subStato = "active", fatture = [{id: "in_1", status: "paid", amount_paid: 1980, billing_reason: "subscription_create"}, {id: "in_2", status: "paid", amount_paid: 990, billing_reason: "subscription_cycle"}, {id: "in_3", status: "open", amount_due: 990, attempt_count: 1}];
  L.CFG.stripeKey = "sk_test_finto"; L.stripeApi = async (m, p) => p.startsWith("subscriptions/") ? {id: "sub_1", status: subStato} : {data: fatture.slice().reverse()};
  const u = async () => L.DB.utente("Univoco", id);
  console.log("1 abbonamento doppio chiuso → stato", (await S.elabora(await u(), {id: "evt_x", type: "customer.subscription.deleted", data: {object: {id: "sub_altro"}}}), (await u()).f.Stato));
  console.log("2 notte:", JSON.stringify(await S.riconcilia(await u())), "canoni", (await pg()).ratePagate);
  console.log("3 notte dopo:", JSON.stringify(await S.riconcilia(await u())));
  fatture[2] = {id: "in_3", status: "paid", amount_paid: 990, billing_reason: "subscription_cycle"};
  console.log("4 pagamento perso:", JSON.stringify(await S.riconcilia(await u())), "canoni", (await pg()).ratePagate);
  subStato = "past_due"; console.log("5 differenza:", JSON.stringify(await S.riconcilia(await u())));
  subStato = "canceled"; console.log("6 chiuso su Stripe:", JSON.stringify(await S.riconcilia(await u())), "→", (await u()).f.Stato);
})();
