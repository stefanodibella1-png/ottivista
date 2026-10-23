// Attivazione delle rate: Stripe Checkout in abbonamento (12 rate mensili) + spedizione subito.
const L = require("./_lib");
async function stripe(path, params){
  const body = new URLSearchParams();
  const add = (k, v) => { if (v === undefined || v === null) return; if (typeof v === "object" && !Array.isArray(v)) for (const [kk, vv] of Object.entries(v)) add(`${k}[${kk}]`, vv); else if (Array.isArray(v)) v.forEach((x, i) => add(`${k}[${i}]`, x)); else body.append(k, String(v)); };
  for (const [k, v] of Object.entries(params)) add(k, v);
  const r = await fetch(`https://api.stripe.com/v1/${path}`, {method: "POST", headers: {Authorization: `Bearer ${L.CFG.stripeKey}`, "Content-Type": "application/x-www-form-urlencoded"}, body});
  const j = await r.json(); if (!r.ok) throw new Error(`Stripe: ${j.error && j.error.message}`); return j;
}
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const b = await L.readBody(req);
  const u = await L.DB.utente("Univoco", String(b.univoco || "").trim());
  if (!u) return L.send(res, 404, {errore: "Cliente non trovato."});
  if (u.f.Stato !== L.STATI.PAGAMENTO) return L.send(res, 409, {errore: "Non c'è un ordine da attivare."});
  if (!b.consensoContratto || !b.consensoAddebito) return L.send(res, 400, {errore: "Per attivare l'abbonamento servono entrambe le conferme."});
  const ord = L.parseOrdine(u.f.Ordine), p = ord.prezzi;
  const back = `${L.CFG.site}/?Univoco=${encodeURIComponent(u.f.Univoco)}`;
  if (!L.CFG.stripeKey){
    // senza Stripe collegato: attivazione simulata (solo prova)
    ord.pagamento = {stato: "SIMULATO", attivatoIl: new Date().toISOString()}; ord.aggiornato = ord.pagamento.attivatoIl;
    await L.DB.aggiorna(u, {Stato: L.STATI.ATTIVO, Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {simulato: true});
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
    session = await stripe("checkout/sessions", params);
  } catch(e){ console.error(e); return L.send(res, 502, {errore: "Il pagamento non si è avviato. Riprova tra poco.", dettaglio: String(e.message).slice(0, 300)}); }
  ord.pagamento = {stato: "IN CORSO", sessione: session.id}; ord.aggiornato = new Date().toISOString();
  await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  L.send(res, 200, {url: session.url});
});
