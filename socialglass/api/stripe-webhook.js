// Stripe conferma il pagamento: l'ordine diventa attivo e le rate si fermano da sole dopo 12 mesi.
const crypto = require("crypto");
const L = require("./_lib");
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
  if (ev.type === "checkout.session.completed"){
    const s = ev.data.object, uv = s.client_reference_id || (s.metadata || {}).univoco;
    const u = uv && await L.DB.utente("Univoco", uv);
    if (u){
      const ord = L.parseOrdine(u.f.Ordine), mesi = (ord.prezzi && ord.prezzi.mesi) || 12;
      if (s.subscription){
        const fine = Math.floor(Date.now()/1000) + mesi*30.44*86400;
        await fetch(`https://api.stripe.com/v1/subscriptions/${s.subscription}`, {method: "POST", headers: {Authorization: `Bearer ${L.CFG.stripeKey}`, "Content-Type": "application/x-www-form-urlencoded"}, body: new URLSearchParams({cancel_at: String(Math.round(fine))})});
      }
      ord.pagamento = {stato: "ATTIVO", sessione: s.id, abbonamento: s.subscription || "", cliente: s.customer || "", attivatoIl: new Date().toISOString()};
      ord.aggiornato = ord.pagamento.attivatoIl;
      await L.DB.aggiorna(u, {Stato: L.STATI.ATTIVO, Ordine: JSON.stringify(ord)});
    }
  }
  if (ev.type === "invoice.payment_failed"){
    const sub = ev.data.object.subscription, inv = ev.data.object;
    console.warn("Rata non pagata", sub, inv.customer_email || "");
  }
  L.send(res, 200, {ricevuto: true});
});
