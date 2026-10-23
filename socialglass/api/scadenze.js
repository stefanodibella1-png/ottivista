// Controllo giornaliero delle scadenze (Vercel Cron, ogni mattina).
// 30 giorni prima: promemoria al cliente. Alla scadenza: si esegue la scelta del cliente
// (occhiale nuovo, riscatto, restituzione); senza scelta l'abbonamento continua mese per mese.
const L = require("./_lib");
const gg = d => new Date(d).toLocaleDateString("it-IT", {timeZone: "Europe/Rome"});
async function annota(u, ord, chiave, testo){
  const av = await L.avvisa(u, testo);
  ord.avvisi = ord.avvisi || {};
  ord.avvisi[chiave] = {il: new Date().toISOString(), sms: av.sms, testo, whatsapp: av.whatsapp, inviato: av.sms};
  return av;
}
async function esegui(u, ord, p, ora){
  const pg = ord.pagamento, fp = ord.finePeriodo, link = L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino);
  const stripeOk = L.CFG.stripeKey && pg.abbonamento;
  // canone non pagato da oltre 30 giorni: l'abbonamento si chiude e l'occhiale va restituito (o riscattato)
  if (pg.insoluto && pg.insoluto.tipo !== "riscatto" && new Date(ora) - new Date(pg.insoluto.dal) > 30*864e5){
    if (stripeOk) await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`);
    pg.chiuso = ora; pg.esito = u.f.Stato === L.STATI.CONSEGNATO ? "CHIUSO PER MANCATO PAGAMENTO: OCCHIALE DA RESTITUIRE" : "CHIUSO PER MANCATO PAGAMENTO: ORDINE ANNULLATO";
    if (u.f.Stato === L.STATI.CONSEGNATO) ord.ritiro = {daRitirare: true, dal: ora};
    await annota(u, ord, "chiusuraInsoluto", `SocialGlass: ${u.f.Nome}, il canone non è stato pagato da oltre 30 giorni e l'abbonamento è stato chiuso.${u.f.Stato === L.STATI.CONSEGNATO ? " Riporta l'occhiale in ottica entro 15 giorni, oppure chiedi all'ottico di riscattarlo." : " L'ordine non verrà completato."}`);
    return "chiuso per insoluto";
  }
  // con un pagamento in sospeso la scelta di fine periodo aspetta
  if (pg.insoluto) return null;
  // 30 giorni prima
  if (p.aperto && !p.scaduto && !(ord.avvisi && ord.avvisi.preavviso)){
    await annota(u, ord, "preavviso", `SocialGlass: ${u.f.Nome}, il ${gg(p.scadenza)} finiscono i ${p.mesi} mesi del tuo abbonamento occhiale. Scegli ora: occhiale nuovo, lo tieni${ord.prezzi && ord.prezzi.riscatto ? ` (${ord.prezzi.riscatto.toFixed(2).replace(".", ",")} €)` : ""} o lo restituisci. Se non scegli, continua mese per mese e puoi disdire quando vuoi: ${link}`);
    return "preavviso";
  }
  if (!p.scaduto || (fp && fp.eseguita)) return null;
  const scelta = fp && fp.scelta;
  if (scelta === "rinnova"){
    fp.eseguita = ora; ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    await L.rinnova(u, {otticoId: String(u.f.Ottica1 || "").split(" - ")[0], caf: u.f.CAF});
    return "rinnovato";
  }
  if (scelta === "riscatta"){
    const imp = (ord.prezzi && ord.prezzi.riscatto) || 0;
    if (stripeOk){
      if (imp > 0){
        await L.stripeApi("POST", "invoiceitems", {customer: pg.cliente, currency: "eur", amount: Math.round(imp*100), description: "Riscatto occhiale a fine abbonamento"});
        const inv = await L.stripeApi("POST", "invoices", {customer: pg.cliente, collection_method: "charge_automatically", pending_invoice_items_behavior: "include", auto_advance: true, metadata: {univoco: u.f.Univoco, tipo: "riscatto"}});
        await L.stripeApi("POST", `invoices/${inv.id}/finalize`, {});
        pg.riscatto = {fattura: inv.id, importo: imp};
      }
      await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`);
    }
    pg.chiuso = ora; pg.esito = "RISCATTATO: L'OCCHIALE È DEL CLIENTE";
    fp.eseguita = ora;
    await annota(u, ord, "esito", `SocialGlass: ${u.f.Nome}, il tuo abbonamento è chiuso e l'occhiale ora è tuo. ${imp ? `Abbiamo addebitato il riscatto di ${imp.toFixed(2).replace(".", ",")} €. ` : ""}Quando vuoi un occhiale nuovo, chiedi al tuo ottico.`);
    return "riscattato";
  }
  if (scelta === "restituisci"){
    if (stripeOk) await L.stripeApi("POST", `subscriptions/${pg.abbonamento}`, {cancel_at_period_end: true});
    pg.esito = "DISDETTO: CHIUDE A FINE MESE";
    ord.ritiro = {daRitirare: true, dal: ora};
    fp.eseguita = ora;
    await annota(u, ord, "esito", `SocialGlass: ${u.f.Nome}, abbiamo registrato la restituzione. Riporta l'occhiale in ottica entro 15 giorni: l'abbonamento si chiude a fine mese, senza altri costi.`);
    return "restituzione";
  }
  // nessuna scelta: continua mese per mese, secondo promemoria
  if (!(ord.avvisi && ord.avvisi.scadenza)){
    await annota(u, ord, "scadenza", `SocialGlass: ${u.f.Nome}, la durata minima del tuo abbonamento è finita. Continua mese per mese allo stesso canone e puoi disdire quando vuoi. Se vuoi un occhiale nuovo, tenerlo o restituirlo, scegli qui: ${link}`);
    return "continua";
  }
  return null;
}
async function attesa(u, ora){
  const o = L.parseOrdine(u.f.Ordine), da = new Date(ora) - new Date(o.aggiornato || u.f.Creato || ora);
  if (o.pagamento && o.pagamento.stato === "IN CORSO" && da < 30*864e5) return null;
  if (da > 30*864e5 && o.montatura){
    const m = await L.DB.montatura(o.montatura.codice); if (m) await L.DB.aggiornaMontatura(m, {Stato: "DISPONIBILE"});
    const prima = o.montatura; delete o.montatura; delete o.prezzi; delete o.lenti; delete o.pagamento;
    o.scaduta = {montatura: prima, il: ora};
    await annota(u, o, "prenotazioneScaduta", `SocialGlass: ${u.f.Nome}, la montatura ${prima.modello} ${prima.colore} era prenotata da oltre 30 giorni senza conferma ed è tornata disponibile. Quando vuoi, torna in ottica e scegline una dal tuo link.`);
    o.aggiornato = ora;
    await L.DB.aggiorna(u, {Stato: L.STATI.REGISTRATO, Ordine: JSON.stringify(o)});
    return "prenotazione scaduta";
  }
  if (da > 14*864e5 && !(o.avvisi && o.avvisi.attesa)){
    const link = L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino);
    await annota(u, o, "attesa", u.f.Stato === L.STATI.PAGAMENTO
      ? `SocialGlass: ${u.f.Nome}, il preventivo del tuo occhiale ti aspetta: conferma dal tuo link entro 30 giorni dalla scelta, poi la montatura torna disponibile. ${link}`
      : `SocialGlass: ${u.f.Nome}, la montatura che hai scelto è prenotata per te: passa in ottica per lenti e ricetta entro 30 giorni. ${link}`);
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
    return "promemoria attesa";
  }
  return null;
}
const handler = L.wrap(async (req, res) => {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return L.send(res, 401, {errore: "Non autorizzato"});
  const url = new URL(req.url, "http://x"), ora = url.searchParams.get("data") ? new Date(url.searchParams.get("data")).toISOString() : new Date().toISOString();
  const tutti = await L.DB.tutti();
  const esiti = [];
  for (const u of tutti){
    // montatura prenotata ma ordine mai confermato: promemoria a 14 giorni, a 30 la montatura torna disponibile
    if ([L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato)){
      try { const r = await attesa(u, ora); if (r) esiti.push({univoco: u.f.Univoco, esito: r}); } catch(e){ esiti.push({univoco: u.f.Univoco, errore: String(e.message).slice(0, 200)}); }
      continue;
    }
    // occhiale da restituire non ancora riportato dopo 15 giorni
    { const o = L.parseOrdine(u.f.Ordine);
      if (o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato && new Date(ora) - new Date(o.ritiro.dal) > 15*864e5 && !(o.avvisi && o.avvisi.ritardoRitiro)){
        await annota(u, o, "ritardoRitiro", `SocialGlass: ${u.f.Nome}, non abbiamo ancora ricevuto l'occhiale da restituire. Riportalo in ottica appena puoi, oppure chiedi all'ottico di riscattarlo.`);
        await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)}); esiti.push({univoco: u.f.Univoco, esito: "sollecito restituzione"});
      } }
    if (![L.STATI.ATTIVO, L.STATI.PRONTO, L.STATI.CONSEGNATO].includes(u.f.Stato)) continue;
    const ord = L.parseOrdine(u.f.Ordine), p = L.PREZZI.periodo(ord, ora);
    if (!p || p.chiuso) continue;
    try {
      const r = await esegui(u, ord, p, ora);
      if (r){ if (r !== "rinnovato"){ ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); } esiti.push({univoco: u.f.Univoco, esito: r}); }
    } catch(e){ console.error(u.f.Univoco, e); esiti.push({univoco: u.f.Univoco, errore: String(e.message).slice(0, 200)}); }
  }
  L.send(res, 200, {ok: true, data: ora, esiti});
});
module.exports = handler;
module.exports.esegui = esegui;
