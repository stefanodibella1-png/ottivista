// Stripe conferma il pagamento: l'ordine diventa attivo; poi canoni mensili, insoluti, chiusura.
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
    if (u) await L.attiva(u, s);
  }
  // rate mensili: pagata / non pagata / interrotta
  if (["invoice.paid", "invoice.payment_failed", "customer.subscription.deleted"].includes(ev.type)){
    const o = ev.data.object;
    const meta = (o.subscription_details && o.subscription_details.metadata) || (o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata) || o.metadata || {};
    const u = meta.univoco && await L.DB.utente("Univoco", meta.univoco);
    if (u){
      const ord = L.parseOrdine(u.f.Ordine); ord.pagamento = ord.pagamento || {};
      const pg = ord.pagamento, ora = new Date().toISOString();
      if (ev.type === "invoice.paid" && o.amount_paid > 0 && meta.tipo === "riscatto") pg.riscatto = Object.assign(pg.riscatto || {}, {pagato: ora});
      else if (ev.type === "invoice.paid" && o.amount_paid > 0){
        // il primo canone può essere già stato contato all'attivazione
        pg.ratePagate = o.billing_reason === "subscription_create" ? Math.max(pg.ratePagate || 0, 1) : (pg.ratePagate || 0) + 1;
        pg.ultimaRata = ora; delete pg.insoluto;
      }
      if (ev.type === "invoice.payment_failed"){
        if (!pg.insoluto){
          const av = await L.avvisa(u, `SocialGlass: ${u.f.Nome}, il pagamento del canone (${((o.amount_due || 0)/100).toFixed(2).replace(".", ",")} €) non è riuscito. Riproveremo in automatico; puoi pagare subito o cambiare carta qui: ${o.hosted_invoice_url || L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0])}`);
          ord.avvisi = ord.avvisi || {}; ord.avvisi["insoluto" + ora.slice(0, 10)] = {il: ora, sms: av.sms, testo: "Pagamento del canone non riuscito: avvisa il cliente.", whatsapp: av.whatsapp, inviato: av.sms};
        }
        pg.insoluto = {tipo: meta.tipo || "canone", dal: (pg.insoluto && pg.insoluto.dal) || ora, importo: (o.amount_due || 0)/100, tentativi: o.attempt_count || 1,
          prossimoTentativo: o.next_payment_attempt ? new Date(o.next_payment_attempt*1000).toISOString() : null, link: o.hosted_invoice_url || ""};
      }
      if (ev.type === "customer.subscription.deleted"){
        const mesi = (ord.prezzi && ord.prezzi.mesi) || 12;
        pg.chiuso = pg.chiuso || ora;
        if (!pg.esito || /DISDETTO/.test(pg.esito)){
          if (/DISDETTO/.test(pg.esito || "")) pg.esito = "ABBONAMENTO CHIUSO (RESTITUZIONE)";
          else if (pg.insoluto){ pg.esito = "CHIUSO PER MANCATO PAGAMENTO: OCCHIALE DA RESTITUIRE"; ord.ritiro = ord.ritiro || {daRitirare: true, dal: ora}; }
          else pg.esito = (pg.ratePagate || 0) >= mesi ? "CHIUSO DOPO LA DURATA MINIMA" : "INTERROTTO PRIMA DELLA DURATA MINIMA";
        }
      }
      ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    }
  }
  L.send(res, 200, {ricevuto: true});
});
