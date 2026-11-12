// Stripe conferma il pagamento: l'ordine diventa attivo; poi canoni mensili, insoluti, chiusura.
const crypto = require("crypto");
const L = require("./_lib"), F = require("./_fattura");
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
      if (ev.type === "invoice.paid" && o.amount_paid > 0 && meta.tipo === "riscatto"){ pg.riscatto = Object.assign(pg.riscatto || {}, {pagato: ora});
        pg.pagamenti = (pg.pagamenti || []).filter(x => x.id !== o.id).concat([{id: o.id, il: ora, canone: 0, spedizione: 0, riscatto: (o.amount_paid || 0) / 100}]).slice(-60); }
      else if (ev.type === "invoice.paid" && o.amount_paid > 0){
        // il primo canone può essere già stato contato all'attivazione
        pg.ratePagate = o.billing_reason === "subscription_create" ? Math.max(pg.ratePagate || 0, 1) : (pg.ratePagate || 0) + 1;
        pg.ultimaRata = ora; delete pg.insoluto;
        // storico dei pagamenti (per i conteggi per periodo): la parte oltre il canone è spedizione
        const imp = (o.amount_paid || 0) / 100, rata = Number((ord.prezzi || {}).rata) || imp, sped = Math.max(0, Math.round((imp - rata) * 100) / 100);
        pg.pagamenti = (pg.pagamenti || []).filter(x => x.id !== o.id).concat([{id: o.id, il: ora, canone: Math.round((imp - sped) * 100) / 100, spedizione: sped, riscatto: 0}]).slice(-60);
      }
      if (ev.type === "invoice.payment_failed"){
        // morosità: compare nell'elenco Solleciti dell'amministratore; al cliente parte il primo messaggio del conto alla rovescia
        const prima = pg.insoluto || {};
        pg.insoluto = Object.assign({}, prima, {tipo: meta.tipo || "canone", dal: prima.dal || ora, importo: (o.amount_due || 0)/100, tentativi: o.attempt_count || 1,
          prossimoTentativo: o.next_payment_attempt ? new Date(o.next_payment_attempt*1000).toISOString() : null, link: o.hosted_invoice_url || prima.link || ""});
        try { await L.sollecita(u, ord, ora); } catch(e){ console.error(e); }
      }
      if (ev.type === "customer.subscription.deleted"){
        const mesi = (ord.prezzi && ord.prezzi.mesi) || 12;
        pg.chiuso = pg.chiuso || ora;
        if (!pg.esito || /DISDETTO/.test(pg.esito)){
          if (/DISDETTO/.test(pg.esito || "")) pg.esito = "ABBONAMENTO CHIUSO (RESTITUZIONE)";
          else if (pg.insoluto){ pg.esito = u.f.Stato === L.STATI.CONSEGNATO ? "CHIUSO PER MANCATO PAGAMENTO: OCCHIALE DA RESTITUIRE" : "CHIUSO PER MANCATO PAGAMENTO: ORDINE ANNULLATO"; if (u.f.Stato === L.STATI.CONSEGNATO) ord.ritiro = ord.ritiro || {daRitirare: true, dal: ora}; }
          else pg.esito = (pg.ratePagate || 0) >= mesi ? "CHIUSO DOPO LA DURATA MINIMA" : "INTERROTTO PRIMA DELLA DURATA MINIMA";
        }
      }
      ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
      // fattura dell'incasso (una sola anche se Stripe ripete l'avviso)
      if (ev.type === "invoice.paid" && o.amount_paid > 0){
        const inc = (pg.pagamenti || []).find(x => x.id === o.id);
        if (inc) try { const e = await F.emetti(u, inc); if (e.errore) await L.registra("fatturazione", "fattura NON emessa", u.f.Univoco, e.errore); } catch(e){ console.error(e); }
      }
    }
  }
  L.send(res, 200, {ricevuto: true});
});
