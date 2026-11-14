// Stripe conferma il pagamento: l'ordine diventa attivo; poi canoni mensili, insoluti, chiusura.
const crypto = require("crypto");
const L = require("./_lib"), S = require("./_stripe");
function valid(raw, header, secret){
  const parts = Object.fromEntries(String(header || "").split(",").map(x => x.split("=")));
  if (!parts.t || !parts.v1 || Math.abs(Date.now()/1000 - Number(parts.t)) > 600) return false;
  const exp = crypto.createHmac("sha256", secret).update(`${parts.t}.${raw}`).digest("hex");
  return exp.length === parts.v1.length && crypto.timingSafeEqual(Buffer.from(exp), Buffer.from(parts.v1));
}
module.exports = L.wrap(async (req, res) => {
  const raw = await L.readRaw(req);
  if (!L.CFG.stripeWebhook || !valid(raw, req.headers["stripe-signature"], L.CFG.stripeWebhook)) return L.send(res, 400, {errore: "Firma non valida"});
  const ev = JSON.parse(raw);
  // pagamento completato (con IBAN: richiesta inviata, la banca conferma o rifiuta dopo qualche giorno)
  if (["checkout.session.completed", "checkout.session.async_payment_succeeded", "checkout.session.async_payment_failed"].includes(ev.type)){
    const s = ev.data.object, uv = s.client_reference_id || (s.metadata || {}).univoco;
    const u = uv && await L.DB.utente("Univoco", uv);
    if (u) await (ev.type === "checkout.session.async_payment_failed" ? L.rifiutato(u, s) : L.attiva(u, s));
  }
  // canoni, insoluti e chiusure: ogni avviso ha effetto una sola volta (vedi _stripe.js)
  if (["invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"].includes(ev.type)){
    const meta = S.metaDi(ev.data.object);
    const u = meta.univoco && await L.DB.utente("Univoco", meta.univoco);
    if (u) await S.elabora(u, ev);
  }
  L.send(res, 200, {ricevuto: true});
});
