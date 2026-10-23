// Attivazione delle rate: Stripe Checkout in abbonamento (12 rate mensili) + spedizione subito.
const L = require("./_lib");
const stripe = (path, params) => L.stripeApi("POST", path, params);
module.exports = L.wrap(async (req, res) => {
  if (L.bloccato(req)) return L.send(res, 429, L.TROPPI);
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const b = await L.readBody(req);
  const u = await L.DB.utente("Univoco", String(b.univoco || "").trim());
  if (!u){ L.codiceErrato(req); return L.send(res, 404, {errore: "Cliente non trovato."}); }
  if (u.f.Stato !== L.STATI.PAGAMENTO) return L.send(res, 409, {errore: "Non c'è un ordine da attivare."});
  if (!b.consensoContratto || !b.consensoAddebito) return L.send(res, 400, {errore: "Per attivare l'abbonamento servono entrambe le conferme."});
  const ord = L.parseOrdine(u.f.Ordine), p = ord.prezzi;
  const back = `${L.CFG.site}/?Univoco=${encodeURIComponent(u.f.Univoco)}`;
  if (!L.CFG.stripeKey){
    // senza Stripe collegato: attivazione simulata (solo prova)
    ord.pagamento = {stato: "SIMULATO", attivatoIl: new Date().toISOString(), ratePagate: 1}; ord.aggiornato = ord.pagamento.attivatoIl;
    await L.DB.aggiorna(u, {Stato: L.STATI.ATTIVO, Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {simulato: true});
  }
  // rinnovo con abbonamento già attivo: niente nuovo pagamento, cambia solo il canone dal prossimo mese
  const prosegue = ord.rinnovo && ord.rinnovo.prosegue;
  if (prosegue && prosegue.abbonamento){
    try {
      const sub = await L.stripeApi("GET", `subscriptions/${prosegue.abbonamento}`);
      const it = sub.items.data[0];
      await stripe(`subscriptions/${sub.id}`, {proration_behavior: "none",
        items: [{id: it.id, price_data: {currency: "eur", unit_amount: Math.round(p.rata*100), recurring: {interval: "month"}, product: it.price.product}}],
        description: `Abbonamento occhiale ${ord.montatura.modello} ${ord.montatura.colore} con lenti ${ord.lenti.nome} (rinnovo)`});
      if (p.spedizione > 0) await stripe("invoiceitems", {customer: sub.customer, subscription: sub.id, currency: "eur", amount: Math.round(p.spedizione*100), description: "Spedizione occhiale nuovo"});
    } catch(e){ console.error(e); return L.send(res, 502, {errore: "Il rinnovo non si è avviato. Riprova tra poco.", dettaglio: String(e.message).slice(0, 300)}); }
    const ora = new Date().toISOString();
    // nuovo periodo: i mesi si contano da zero (il totale storico resta in "storico")
    ord.pagamento = {stato: "ATTIVO", abbonamento: prosegue.abbonamento, cliente: prosegue.cliente, ratePagate: 0, mesiPrecedenti: prosegue.ratePagate || 0, attivatoIl: ora, rinnovato: true};
    ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Stato: L.STATI.ATTIVO, Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {rinnovato: true});
  }
  // pagamento già aperto: si riusa la stessa pagina Stripe (niente doppi abbonamenti)
  if (ord.pagamento && ord.pagamento.stato === "IN CORSO" && ord.pagamento.sessione){
    try {
      const vecchia = await L.stripeApi("GET", `checkout/sessions/${ord.pagamento.sessione}`);
      if (vecchia.status === "complete") return L.send(res, 409, {errore: "Pagamento già ricevuto: stiamo attivando l'abbonamento, la pagina si aggiorna da sola tra pochi secondi."});
      if (vecchia.status === "open" && vecchia.url) return L.send(res, 200, {url: vecchia.url});
    } catch(e){ console.error(e); }
  }
  const descr = `Abbonamento occhiale ${ord.montatura.modello} ${ord.montatura.colore} con lenti ${ord.lenti.nome} (durata minima ${p.mesi} mesi)`;
  const params = {
    mode: "subscription",
    locale: "it",
    client_reference_id: u.f.Univoco,
    success_url: `${back}&pagamento=ok`,
    cancel_url: `${back}&pagamento=annullato`,
    line_items: [
      {price_data: {currency: "eur", unit_amount: Math.round(p.rata*100), recurring: {interval: "month"}, product_data: {name: "SocialGlass · canone mensile abbonamento occhiale", description: descr}}, quantity: 1},
      {price_data: {currency: "eur", unit_amount: Math.round(p.spedizione*100), product_data: {name: "Spedizione"}}, quantity: 1}
    ],
    custom_text: {submit: {message: `Abbonamento: ${p.rata.toFixed(2).replace(".", ",")} € al mese, durata minima ${p.mesi} mesi. Oggi paghi il primo canone e la spedizione.`}},
    subscription_data: {metadata: {univoco: u.f.Univoco, mesi: p.mesi}, description: descr},
    metadata: {univoco: u.f.Univoco}
  };
  let session;
  try {
    // i metodi di pagamento (carta, SEPA…) si scelgono dalla dashboard Stripe
    // stessa chiave per richieste uguali: due schede aperte insieme ricevono la stessa pagina Stripe
    session = await L.stripeApi("POST", "checkout/sessions", params, `checkout-${u.f.Univoco}-${ord.aggiornato || ""}-${new Date().toISOString().slice(0, 10)}`);
  } catch(e){ console.error(e); return L.send(res, 502, {errore: "Il pagamento non si è avviato. Riprova tra poco.", dettaglio: String(e.message).slice(0, 300)}); }
  ord.pagamento = {stato: "IN CORSO", sessione: session.id}; ord.aggiornato = new Date().toISOString();
  await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  L.send(res, 200, {url: session.url});
});
