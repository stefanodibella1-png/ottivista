// SocialGlass · avvisi di Stripe su canoni, insoluti e chiusure (modifica 3).
// Usato dal webhook e dal controllo notturno: ogni avviso ha effetto una sola volta, i canoni si contano dalle fatture.
const L = require("./_lib"), F = require("./_fattura");

const metaDi = o => (o.subscription_details && o.subscription_details.metadata) || (o.parent && o.parent.subscription_details && o.parent.subscription_details.metadata) || o.metadata || {};
// canoni pagati = fatture di canone diverse registrate (mai +1 a ogni avviso); il primo può essere contato all'attivazione
const canoniPagati = pg => Math.max((pg.pagamenti || []).filter(x => !x.riscatto && (x.canone > 0 || x.gratis)).length, pg.primaRata ? 1 : 0);

async function elabora(u, ev){
  if (ev.id && (u.f.EventiStripe || []).includes(ev.id)) return {gia: true};
  const o = ev.data.object, meta = metaDi(o);
  const ord = L.parseOrdine(u.f.Ordine); ord.pagamento = ord.pagamento || {};
  const pg = ord.pagamento, ora = new Date().toISOString(), giaPagata = (pg.pagamenti || []).some(x => x.id === o.id);
  // clienti già attivi: il primo canone contato all'attivazione (prima che arrivasse la fattura) resta contato
  if (pg.primaRata === undefined && !(pg.pagamenti || []).length && (pg.ratePagate || 0) >= 1) pg.primaRata = true;
  let sollecito = false;
  if (ev.type === "invoice.paid" && o.amount_paid > 0 && meta.tipo === "riscatto"){
    pg.riscatto = Object.assign(pg.riscatto || {}, {pagato: pg.riscatto && pg.riscatto.pagato || ora});
    pg.pagamenti = (pg.pagamenti || []).filter(x => x.id !== o.id).concat([{id: o.id, il: ora, canone: 0, spedizione: 0, riscatto: (o.amount_paid || 0) / 100}]).slice(-60);
    if (pg.insoluto && pg.insoluto.tipo === "riscatto") delete pg.insoluto;
  }
  else if (ev.type === "invoice.paid" && o.amount_paid > 0){
    // storico dei pagamenti (per i conteggi per periodo): la parte oltre il canone è spedizione
    const imp = (o.amount_paid || 0) / 100, rata = Number((ord.prezzi || {}).rata) || imp, sped = Math.max(0, Math.round((imp - rata) * 100) / 100);
    const prima = (pg.pagamenti || []).find(x => x.id === o.id);
    pg.pagamenti = (pg.pagamenti || []).filter(x => x.id !== o.id).concat([{id: o.id, il: prima ? prima.il : ora, canone: Math.round((imp - sped) * 100) / 100, spedizione: sped, riscatto: 0}]).slice(-60);
    pg.ratePagate = canoniPagati(pg); if (!prima) pg.ultimaRata = ora;
    if (pg.insoluto && pg.insoluto.tipo !== "riscatto") delete pg.insoluto;
  }
  // canone a 0 € pagato dal credito «porta un amico» (saldo cliente Stripe): è un mese che conta, ma non è un incasso (niente fattura)
  if (ev.type === "invoice.paid" && !(o.amount_paid > 0) && meta.tipo !== "riscatto" && o.billing_reason === "subscription_cycle" && Number(o.starting_balance) < 0 && !giaPagata){
    pg.pagamenti = (pg.pagamenti || []).concat([{id: o.id, il: ora, canone: 0, spedizione: 0, riscatto: 0, gratis: Math.min(-Number(o.starting_balance), Number(o.total) || 0) / 100}]).slice(-60);
    pg.ratePagate = canoniPagati(pg); pg.ultimaRata = ora; if (pg.insoluto && pg.insoluto.tipo !== "riscatto") delete pg.insoluto;
    const v = (ord.amici || []).find(x => x.stato === "accreditato" && !x.usato); if (v) v.usato = ora;
  }
  // fattura non pagata: se nel frattempo risulta già pagata è un avviso vecchio e si ignora
  if (ev.type === "invoice.payment_failed" && !giaPagata && !pg.chiuso){
    const prima = pg.insoluto || {};
    pg.insoluto = Object.assign({}, prima, {tipo: meta.tipo || "canone", dal: prima.dal || ora, importo: (o.amount_due || 0)/100, tentativi: o.attempt_count || 1,
      prossimoTentativo: o.next_payment_attempt ? new Date(o.next_payment_attempt*1000).toISOString() : null, link: o.hosted_invoice_url || prima.link || ""});
    sollecito = true;
  }
  if (ev.type === "customer.subscription.deleted" && (!pg.abbonamento || !o.id || o.id === pg.abbonamento)){
    const mesi = (ord.prezzi && ord.prezzi.mesi) || 12, consegnato = u.f.Stato === L.STATI.CONSEGNATO || !!ord.consegnatoIl;
    pg.chiuso = pg.chiuso || ora;
    if (!pg.esito || /DISDETTO/.test(pg.esito)){
      if (/DISDETTO/.test(pg.esito || "")) pg.esito = "ABBONAMENTO CHIUSO (RESTITUZIONE)";
      else if (pg.insoluto){ pg.esito = consegnato ? "CHIUSO PER MANCATO PAGAMENTO: OCCHIALE DA RESTITUIRE" : "CHIUSO PER MANCATO PAGAMENTO: ORDINE ANNULLATO"; if (consegnato) ord.ritiro = ord.ritiro || {daRitirare: true, dal: ora}; }
      else pg.esito = (pg.ratePagate || 0) >= mesi ? "CHIUSO DOPO LA DURATA MINIMA" : "INTERROTTO PRIMA DELLA DURATA MINIMA";
    }
  }
  ord.aggiornato = ora;
  const campi = {Ordine: JSON.stringify(ord)};
  if (ev.id) campi.EventiStripe = (u.f.EventiStripe || []).concat(ev.id).slice(-60);
  // prima si salva (avviso segnato come fatto), poi messaggi e fattura: se la scrittura fallisce non parte niente
  await L.DB.aggiorna(u, campi);
  if (sollecito) try {
    const o2 = L.parseOrdine(u.f.Ordine);
    if (await L.sollecita(u, o2, ora)){ o2.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(o2)}); }
  } catch(e){ console.error(e); }
  // fattura dell'incasso (una sola anche se Stripe ripete l'avviso)
  if (ev.type === "invoice.paid" && o.amount_paid > 0){
    const inc = (L.parseOrdine(u.f.Ordine).pagamento.pagamenti || []).find(x => x.id === o.id);
    if (inc) try { const e = await F.emetti(u, inc); if (e.errore) await L.registra("fatturazione", "fattura NON emessa", u.f.Univoco, e.errore); } catch(e){ console.error(e); }
  }
  return {ok: true};
}

/* ---------- controllo notturno: confronta l'ordine con Stripe e recupera gli avvisi persi ----------
   Restituisce {esito} se ha recuperato qualcosa, {differenza} se c'è una differenza da guardare, null se tutto torna. */
async function riconcilia(u){
  if (!L.CFG.stripeKey) return null;
  if (u.f.Stato === L.STATI.PAGAMENTO){
    const pg = L.parseOrdine(u.f.Ordine).pagamento || {};
    if (pg.stato === "IN CORSO" && pg.sessione && await L.verificaPagamento(u)) return {esito: "pagamento recuperato da Stripe: abbonamento attivato"};
    return null;
  }
  const ord = L.parseOrdine(u.f.Ordine), pg = ord.pagamento || {};
  if (!pg.abbonamento || pg.chiuso) return null;
  let sub;
  try { sub = await L.stripeApi("GET", `subscriptions/${pg.abbonamento}`); }
  catch(e){ return /No such subscription/i.test(e.message) ? {differenza: `l'abbonamento ${pg.abbonamento} non esiste su Stripe ma qui risulta attivo`} : null; }
  const recuperati = [];
  const fatture = ((await L.stripeApi("GET", "invoices", {subscription: pg.abbonamento, limit: 24})).data || []).slice().reverse();
  for (const inv of fatture){
    const pagate = (L.parseOrdine(u.f.Ordine).pagamento || {}).pagamenti || [];
    if (inv.status === "paid" && !pagate.some(x => x.id === inv.id) && (inv.amount_paid > 0 || (inv.billing_reason === "subscription_cycle" && Number(inv.starting_balance) < 0))){
      const r = await elabora(u, {id: "notte-" + inv.id, type: "invoice.paid", data: {object: inv}}); if (r.ok) recuperati.push("canone pagato " + inv.id);
    }
  }
  const ins = (L.parseOrdine(u.f.Ordine).pagamento || {}).insoluto;
  const aperta = fatture.filter(i => i.status === "open" && (i.attempt_count || 0) > 0).pop();
  if (aperta && !ins){ const r = await elabora(u, {id: `notte-${aperta.id}-${aperta.attempt_count}`, type: "invoice.payment_failed", data: {object: aperta}}); if (r.ok) recuperati.push("canone non pagato " + aperta.id); }
  if (sub.status === "canceled"){ const r = await elabora(u, {id: "notte-chiuso-" + sub.id, type: "customer.subscription.deleted", data: {object: sub}}); if (r.ok) recuperati.push("abbonamento chiuso su Stripe"); }
  if (recuperati.length) return {esito: "recuperato da Stripe: " + recuperati.join(", ")};
  if (["past_due", "unpaid"].includes(sub.status) && !ins) return {differenza: `su Stripe l'abbonamento risulta «${sub.status}» ma qui non c'è un canone non pagato`};
  return null;
}

module.exports = {elabora, riconcilia, canoniPagati, metaDi};
