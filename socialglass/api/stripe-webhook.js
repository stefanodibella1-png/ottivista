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
  // rate mensili: pagata / non pagata / interrotta
  if (["invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"].includes(ev.type)){
    const o = ev.data.object;
    const meta = (o.subscription_details && o.subscription_details.metadata) || (o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata) || o.metadata || {};
    const u = meta.univoco && await L.DB.utente("Univoco", meta.univoco);
    if (u){
      const ord = L.parseOrdine(u.f.Ordine); ord.pagamento = ord.pagamento || {};
      const pg = ord.pagamento, ora = new Date().toISOString();
      if (ev.type === "invoice.paid" && o.amount_paid > 0){
        pg.ratePagate = (pg.ratePagate || 0) + (o.billing_reason === "subscription_create" ? 1 : 1);
        pg.ultimaRata = ora; delete pg.insoluto;
      }
      if (ev.type === "invoice.payment_failed"){
        pg.insoluto = {dal: (pg.insoluto && pg.insoluto.dal) || ora, importo: (o.amount_due || 0)/100, tentativi: o.attempt_count || 1,
          prossimoTentativo: o.next_payment_attempt ? new Date(o.next_payment_attempt*1000).toISOString() : null, link: o.hosted_invoice_url || ""};
      }
      if (ev.type === "customer.subscription.deleted"){
        const mesi = (ord.prezzi && ord.prezzi.mesi) || 12;
        pg.chiuso = ora; pg.esito = (pg.ratePagate || 0) >= mesi ? "COMPLETATO" : "INTERROTTO";
      }
      ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    }
  }
  L.send(res, 200, {ricevuto: true});
});
