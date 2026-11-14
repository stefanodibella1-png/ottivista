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
// acquisto dell'usato: una sola fattura Stripe anche ripetendo (chiavi anti-doppione e ricerca di quella già creata)
async function richiediRiscatto(u, ord){
  const pg = ord.pagamento, r = pg.riscatto; if (!r || r.fattura || r.pagato) return r && r.fattura;
  const meta = {univoco: u.f.Univoco, tipo: "riscatto"};
  let inv = ((await L.stripeApi("GET", "invoices", {customer: pg.cliente, limit: 20})).data || []).find(i => (i.metadata || {}).tipo === "riscatto" && (i.metadata || {}).univoco === u.f.Univoco && i.status !== "void");
  if (!inv){
    const voci = ((await L.stripeApi("GET", "invoiceitems", {customer: pg.cliente, pending: true, limit: 20})).data || []).filter(x => (x.metadata || {}).tipo === "riscatto");
    if (!voci.length) await L.stripeApi("POST", "invoiceitems", {customer: pg.cliente, currency: "eur", amount: Math.round(r.importo*100), description: "Acquisto occhiale usato a fine noleggio", metadata: meta}, r.chiave + "-voce");
    inv = await L.stripeApi("POST", "invoices", {customer: pg.cliente, collection_method: "charge_automatically", pending_invoice_items_behavior: "include", auto_advance: true, metadata: meta}, r.chiave + "-fattura");
  }
  if (inv.status === "draft") inv = await L.stripeApi("POST", `invoices/${inv.id}/finalize`, {}, r.chiave + "-finalizza");
  r.fattura = inv.id;
  // i canoni mensili finiscono qui (l'avviso di chiusura dell'abbonamento non chiude il contratto finché l'acquisto non è pagato)
  if (!r.abbonamentoChiuso){ try { await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`); } catch(e){ if (!/No such subscription|canceled/i.test(e.message)) throw e; } r.abbonamentoChiuso = new Date().toISOString(); }
  ord.aggiornato = new Date().toISOString(); await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  return inv.id;
}
// restituzione mancata (D3): solo se l'amministratore l'ha attivata e il contratto contiene la clausola.
// 7 giorni prima: avviso; al 30° giorno: addebito del prezzo dell'usato una volta sola (mai ripetuto)
async function restituzioneMancata(u, ora){
  const ord = L.parseOrdine(u.f.Ordine), rt = ord.ritiro, pg = ord.pagamento || {}, imp = Number((ord.prezzi || {}).riscatto) || 0;
  if (!rt || !rt.daRitirare || rt.ritirato || rt.rinnovo || !(imp > 0) || pg.riscatto) return null;
  if (!((ord.consensi || {}).versione >= L.CONDIZIONI_VERSIONE)) return null;
  const cfg = (await L.DB.meta("config")) || {}; if (!cfg.addebitoUsato) return null;
  const giorni = (new Date(ora) - new Date(rt.dal)) / 864e5, euro = imp.toFixed(2).replace(".", ",");
  if (giorni >= L.GIORNI_RESTITUZIONE - 7 && giorni < L.GIORNI_RESTITUZIONE && !(ord.avvisi && ord.avvisi.restituzioneMancata)){
    await annota(u, ord, "restituzioneMancata", `SocialGlass: ${L.nm(u.f.Nome)}, l'occhiale non è ancora tornato in ottica. Se non lo riporti entro il ${gg(new Date(rt.dal).getTime() + L.GIORNI_RESTITUZIONE * 864e5)}, come previsto dal contratto ti addebiteremo il prezzo dell'usato (${euro} €) e l'occhiale diventerà tuo.`);
    ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); return "avviso restituzione mancata";
  }
  if (giorni < L.GIORNI_RESTITUZIONE) return null;
  L.chi("controllo notturno", "addebito per restituzione mancata");
  const stripeOk = L.CFG.stripeKey && pg.cliente && pg.stato !== "SIMULATO";
  if (!stripeOk){
    pg.riscatto = {richiesto: ora, importo: imp, pagato: ora, simulato: true, restituzioneMancata: true};
    pg.esito = "OCCHIALE NON RESTITUITO: ADDEBITATO L'USATO, L'OCCHIALE È DEL CLIENTE"; pg.chiuso = pg.chiuso || ora; delete ord.ritiro;
  } else {
    pg.riscatto = {richiesto: ora, importo: imp, chiave: `mancata-${u.f.Univoco}-${String(rt.dal).slice(0, 10)}`, restituzioneMancata: true, abbonamentoChiuso: pg.chiuso || ora};
    pg.esito = "OCCHIALE NON RESTITUITO: ACQUISTO DELL'USATO IN ATTESA DI PAGAMENTO";
    ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    await richiediRiscatto(u, ord);
  }
  await annota(u, ord, "addebitoUsato", `SocialGlass: ${L.nm(u.f.Nome)}, l'occhiale non è stato restituito entro ${L.GIORNI_RESTITUZIONE} giorni: come previsto dal contratto abbiamo ${stripeOk ? "richiesto il pagamento" : "addebitato"} del prezzo dell'usato (${euro} €). L'occhiale ora è tuo.`);
  ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  return "addebito per restituzione mancata";
}
async function esegui(u, ord, p, ora){
  const pg = ord.pagamento, fp = ord.finePeriodo, link = L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino);
  const stripeOk = L.CFG.stripeKey && pg.abbonamento;
  // canone non pagato da oltre 30 giorni: l'abbonamento si chiude e l'occhiale va restituito (o riscattato)
  if (pg.insoluto && pg.insoluto.tipo !== "riscatto" && new Date(ora) - new Date(pg.insoluto.dal) > 30*864e5){
    if (stripeOk) await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`);
    pg.chiuso = ora; pg.esito = u.f.Stato === L.STATI.CONSEGNATO ? "CHIUSO PER MANCATO PAGAMENTO: OCCHIALE DA RESTITUIRE" : "CHIUSO PER MANCATO PAGAMENTO: ORDINE ANNULLATO";
    if (u.f.Stato === L.STATI.CONSEGNATO) ord.ritiro = {daRitirare: true, dal: ora};
    // messaggio di chiusura al cliente con lo stesso canale dei solleciti (resta nell'elenco Solleciti dell'amministratore)
    const testo = `SocialGlass: ${L.nm(u.f.Nome)}, il canone non è stato pagato da oltre 30 giorni e l'abbonamento è stato chiuso.${u.f.Stato === L.STATI.CONSEGNATO ? " Riporta l'occhiale in ottica entro 15 giorni, oppure chiedi all'ottico di comprarlo usato." : " L'ordine non verrà completato."}`;
    const e = await L.inviaCliente(u.f, testo, [u.f.Nome || "", Number(pg.insoluto.importo || 0).toFixed(2).replace(".", ","), "0", u.f.Stato === L.STATI.CONSEGNATO ? "l'occhiale andrà restituito" : "l'ordine sarà annullato", pg.insoluto.link || L.CFG.site]);
    pg.insoluto.messaggi = (pg.insoluto.messaggi || []).concat([Object.assign({il: ora, passo: 0, giorni: 0, testo}, e)]).slice(-20);
    return "chiuso per insoluto";
  }
  // acquisto dell'usato non pagato da oltre 30 giorni: l'occhiale torna a SocialGlass e va restituito
  if (pg.insoluto && pg.insoluto.tipo === "riscatto" && new Date(ora) - new Date(pg.insoluto.dal) > 30*864e5){
    pg.chiuso = ora; pg.esito = "ACQUISTO DELL'USATO NON PAGATO: OCCHIALE DA RESTITUIRE";
    ord.ritiro = {daRitirare: true, dal: ora};
    if (stripeOk && pg.riscatto && pg.riscatto.fattura) try { await L.stripeApi("POST", `invoices/${pg.riscatto.fattura}/void`, {}); } catch(e){ console.error(e); }
    const testo = `SocialGlass: ${L.nm(u.f.Nome)}, il pagamento per l'acquisto dell'usato non è arrivato entro 30 giorni: l'occhiale resta di SocialGlass. Riportalo in ottica entro 15 giorni.`;
    const e = await L.inviaCliente(u.f, testo, [u.f.Nome || "", Number(pg.insoluto.importo || 0).toFixed(2).replace(".", ","), "0", "l'occhiale andrà restituito", pg.insoluto.link || L.CFG.site]);
    pg.insoluto.messaggi = (pg.insoluto.messaggi || []).concat([Object.assign({il: ora, passo: 0, giorni: 0, testo}, e)]).slice(-20);
    return "acquisto dell'usato non pagato: occhiale da restituire";
  }
  // richiesta di acquisto interrotta a metà (Stripe non rispondeva): si riprende senza creare un secondo addebito
  if (stripeOk && pg.riscatto && pg.riscatto.richiesto && !pg.riscatto.fattura && !pg.riscatto.pagato){
    await richiediRiscatto(u, ord);
    if (!(ord.avvisi && ord.avvisi.esito)) await annota(u, ord, "esito", `SocialGlass: ${L.nm(u.f.Nome)}, hai scelto di comprare l'occhiale usato: abbiamo richiesto il pagamento di ${Number(pg.riscatto.importo || 0).toFixed(2).replace(".", ",")} € sul tuo metodo di pagamento. I canoni mensili sono finiti. Ti scriviamo appena il pagamento è confermato.`);
    return "acquisto dell'usato: richiesta ripresa";
  }
  // con un pagamento in sospeso la scelta di fine periodo aspetta
  if (pg.insoluto){
    const e = await L.sollecita(u, ord, ora); if (!e) return null;
    return `sollecito ${e.canale}: ${e.inviato ? "inviato" : "da inviare a mano (" + e.motivo + ")"}`;
  }
  // 30 giorni prima
  if (p.aperto && !p.scaduto && !(ord.avvisi && ord.avvisi.preavviso)){
    await annota(u, ord, "preavviso", `SocialGlass: ${L.nm(u.f.Nome)}, il ${gg(p.scadenza)} finiscono i ${p.mesi} mesi del tuo abbonamento occhiale. Nella tua pagina trovi le montature nuove esposte nella tua ottica. Scegli ora: occhiale nuovo, lo compri usato${ord.prezzi && ord.prezzi.riscatto ? ` (${ord.prezzi.riscatto.toFixed(2).replace(".", ",")} €)` : ""} o lo restituisci. Se non scegli, continua mese per mese e puoi disdire quando vuoi: ${link}`);
    return "preavviso";
  }
  if (!p.scaduto || (fp && fp.eseguita)) return null;
  const scelta = fp && fp.scelta;
  if (scelta === "rinnova"){
    // con una segnalazione aperta il cambio occhiale aspetta (l'abbonamento intanto continua)
    if (L.segnalazioniAperte(u.f).length) return null;
    fp.eseguita = ora; ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    await L.rinnova(u, {otticoId: String(u.f.Ottica1 || "").split(" - ")[0], caf: u.f.CAF});
    return "rinnovato";
  }
  if (scelta === "riscatta"){
    const imp = (ord.prezzi && ord.prezzi.riscatto) || 0;
    fp.eseguita = ora;
    // senza importo (o nelle prove senza Stripe) l'occhiale passa subito al cliente
    if (!(imp > 0) || !stripeOk){
      if (stripeOk) await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`);
      if (imp > 0) pg.riscatto = {richiesto: ora, importo: imp, pagato: ora, simulato: true};
      pg.chiuso = ora; pg.esito = "RISCATTATO: L'OCCHIALE È DEL CLIENTE";
      await annota(u, ord, "esito", `SocialGlass: ${L.nm(u.f.Nome)}, il noleggio è chiuso e l'occhiale ora è tuo. Quando vuoi un occhiale nuovo, chiedi al tuo ottico.`);
      return "riscattato";
    }
    // prima si salva la richiesta (così un'interruzione non porta mai a un secondo addebito), poi si chiede il pagamento
    pg.riscatto = {richiesto: ora, importo: imp, chiave: `riscatto-${u.f.Univoco}-${String(p.scadenza).slice(0, 10)}`};
    pg.esito = "ACQUISTO DELL'USATO: IN ATTESA DI PAGAMENTO";
    ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    await richiediRiscatto(u, ord);
    await annota(u, ord, "esito", `SocialGlass: ${L.nm(u.f.Nome)}, finiti i ${p.mesi} mesi hai scelto di comprare l'occhiale usato: abbiamo richiesto il pagamento di ${imp.toFixed(2).replace(".", ",")} € sul tuo metodo di pagamento. I canoni mensili sono finiti. Ti scriviamo appena il pagamento è confermato.`);
    return "acquisto dell'usato richiesto";
  }
  if (scelta === "restituisci"){
    if (stripeOk) await L.stripeApi("POST", `subscriptions/${pg.abbonamento}`, {cancel_at_period_end: true});
    else pg.chiuso = ora;   // senza Stripe (prove) non arriva l'avviso di fine mese: si chiude adesso
    pg.esito = "DISDETTO: CHIUDE A FINE MESE";
    ord.ritiro = {daRitirare: true, dal: ora};
    fp.eseguita = ora;
    await annota(u, ord, "esito", `SocialGlass: ${L.nm(u.f.Nome)}, abbiamo registrato la restituzione. Riporta l'occhiale in ottica entro 15 giorni: l'abbonamento si chiude a fine mese, senza altri costi.`);
    return "restituzione";
  }
  // nessuna scelta: continua mese per mese, secondo promemoria
  if (!(ord.avvisi && ord.avvisi.scadenza)){
    await annota(u, ord, "scadenza", `SocialGlass: ${L.nm(u.f.Nome)}, la durata minima del tuo abbonamento è finita. Continua mese per mese allo stesso canone e puoi disdire quando vuoi. Se vuoi un occhiale nuovo, comprarlo usato o restituirlo, scegli qui: ${link}`);
    return "continua";
  }
  return null;
}
async function attesa(u, ora){
  const o = L.parseOrdine(u.f.Ordine), da = new Date(ora) - new Date(o.aggiornato || u.f.Creato || ora);
  if (o.pagamento && o.pagamento.stato === "IN CORSO" && da < 30*864e5) return null;
  if (da > 30*864e5 && o.montatura){
    await L.liberaMontatura(o.montatura.codice, u.f.Univoco);
    const prima = o.montatura; delete o.montatura; delete o.prezzi; delete o.lenti; delete o.pagamento;
    o.scaduta = {montatura: prima, il: ora};
    await annota(u, o, "prenotazioneScaduta", `SocialGlass: ${L.nm(u.f.Nome)}, la montatura ${prima.modello} ${prima.colore} era prenotata da oltre 30 giorni senza conferma ed è tornata disponibile. Quando vuoi, torna in ottica e scegline una dal tuo link.`);
    o.aggiornato = ora;
    await L.DB.aggiorna(u, {Stato: L.STATI.REGISTRATO, Ordine: JSON.stringify(o)});
    return "prenotazione scaduta";
  }
  // preventivo pronto ma abbonamento non attivato dopo 3 giorni: un promemoria automatico
  if (u.f.Stato === L.STATI.PAGAMENTO && da > 3*864e5 && !(o.avvisi && (o.avvisi.attivazione || o.avvisi.attesa))){
    const link = L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino);
    await annota(u, o, "attivazione", `SocialGlass: ${L.nm(u.f.Nome)}, il preventivo del tuo occhiale è pronto: attiva l'abbonamento dal tuo link e l'ottica lo prepara subito. ${link}`);
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
    return "promemoria attivazione";
  }
  if (da > 14*864e5 && !(o.avvisi && o.avvisi.attesa)){
    const link = L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino);
    await annota(u, o, "attesa", u.f.Stato === L.STATI.PAGAMENTO
      ? `SocialGlass: ${L.nm(u.f.Nome)}, il preventivo del tuo occhiale ti aspetta: conferma dal tuo link entro 30 giorni dalla scelta, poi la montatura torna disponibile. ${link}`
      : `SocialGlass: ${L.nm(u.f.Nome)}, la montatura che hai scelto è prenotata per te: passa in ottica per lenti e ricetta entro 30 giorni. ${link}`);
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
    return "promemoria attesa";
  }
  return null;
}
// link di chi non ha mai attivato: promemoria, scadenza a 30 giorni dalla registrazione, archivio, cancellazione dei dati
async function archivia(u, ora){
  const o = L.parseOrdine(u.f.Ordine);
  if (o.montatura) try { await L.liberaMontatura(o.montatura.codice, u.f.Univoco); } catch(e){ console.error(e); }
  o.archiviato = {il: ora, stato: u.f.Stato, montatura: o.montatura ? `${o.montatura.codice} ${o.montatura.modello || ""}`.trim() : ""};
  await annota(u, o, "linkScaduto", `SocialGlass: ${L.nm(u.f.Nome)}, il tuo link è scaduto perché sono passati 30 giorni senza attivare l'abbonamento. Se vuoi ancora i tuoi occhiali, torna al CAF: ti registriamo di nuovo in un minuto.`);
  o.aggiornato = ora;
  await L.DB.aggiorna(u, {Stato: L.STATI.SCADUTO, Archiviato: ora, Ordine: JSON.stringify(o)});
  await L.registra("controllo giornaliero", "link scaduto (30 giorni)", u.f.Univoco, o.archiviato.stato);
  return "link scaduto";
}
async function anonimizza(u, ora, perche){
  const o = L.parseOrdine(u.f.Ordine);
  await L.DB.aggiorna(u, {Nome: "", Cognome: "", Cellulare: "", "Codice Fiscale": "", "Nato a": "", Genere: "", "Data Nascita": "", Residenza: null, Push: [],
    Stato: L.STATI.ANONIMO, Anonimizzato: ora, Ordine: JSON.stringify({archiviato: o.archiviato || {il: u.f.Archiviato}, anonimizzato: ora})});
  await L.registra("controllo giornaliero", "dati cancellati", u.f.Univoco, perche || `${L.GIORNI_ARCHIVIO} giorni in archivio`);
  return "dati cancellati";
}
async function linkInScadenza(u, ora){
  if (u.f.Archiviato){
    if (!u.f.Anonimizzato && new Date(ora) - new Date(u.f.Archiviato) >= L.GIORNI_ARCHIVIO * 864e5) return anonimizza(u, ora);
    return null;
  }
  const sc = L.scadenzaLink(u.f); if (!sc) return undefined;          // undefined = non riguarda questo cliente
  const o = L.parseOrdine(u.f.Ordine), pg = o.pagamento || {};
  if (new Date(ora) >= new Date(sc)){
    if (pg.stato === "IN CORSO" && new Date(ora) - new Date(pg.creato || o.aggiornato || ora) < 2 * 864e5) return null;   // pagamento appena avviato: si aspetta l'esito
    return archivia(u, ora);
  }
  const resta = Math.ceil((new Date(sc) - new Date(ora)) / 864e5), fino = L.giornoIt(sc), da = new Date(ora) - new Date(u.f.Creato), av = o.avvisi || {};
  const link = L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino), nome = L.nm(u.f.Nome);
  let chiave = "", testo = "";
  if (resta <= 5 && !av.link5){ chiave = "link5"; testo = `SocialGlass: ${nome}, ultimi giorni: il tuo link scade il ${fino}. Dopo dovrai registrarti di nuovo (al CAF o in ottica). ${link}`; }
  else if (resta <= 16 && !av.link14 && !av.link5){ chiave = "link14";
    testo = u.f.Stato === L.STATI.PAGAMENTO ? `SocialGlass: ${nome}, il preventivo del tuo occhiale ti aspetta: attiva l'abbonamento entro il ${fino}, poi il link scade. ${link}`
      : u.f.Stato === L.STATI.MONTATURA ? `SocialGlass: ${nome}, la montatura che hai scelto è prenotata per te fino al ${fino}: passa in ottica per lenti e ricetta. ${link}`
      : `SocialGlass: ${nome}, il tuo link per scegliere gli occhiali vale fino al ${fino}: passa in ottica e scegli la montatura. ${link}`; }
  else if (u.f.Stato === L.STATI.PAGAMENTO && da > 3 * 864e5 && !av.attivazione && !av.link14 && !av.link5){ chiave = "attivazione";
    testo = `SocialGlass: ${nome}, il preventivo del tuo occhiale è pronto: attiva l'abbonamento dal tuo link entro il ${fino} e l'ottica lo prepara subito. ${link}`; }
  if (!chiave) return null;
  await annota(u, o, chiave, testo); await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
  return chiave === "link5" ? "promemoria scadenza link" : chiave === "link14" ? "promemoria link (14 giorni)" : "promemoria attivazione";
}
// controllo di un cliente (usato dal controllo giornaliero e dalla barra del tempo delle prove)
async function controlla(u, ora, esiti){
  // chi non ha mai attivato: link valido 30 giorni dalla registrazione (poi archivio e, dopo altri 30, dati cancellati)
  try { const r = await linkInScadenza(u, ora); if (r !== undefined){ if (r) esiti.push({univoco: u.f.Univoco, esito: r}); return; } }
  catch(e){ esiti.push({univoco: u.f.Univoco, errore: String(e.message).slice(0, 200)}); return; }
  // confronto con Stripe: recupera pagamenti, canoni e insoluti il cui avviso non è arrivato
  try { const r = await require("./_stripe").riconcilia(u); if (r) esiti.push(Object.assign({univoco: u.f.Univoco}, r)); }
  catch(e){ esiti.push({univoco: u.f.Univoco, errore: "confronto con Stripe: " + String(e.message).slice(0, 180)}); }
  // montatura prenotata ma ordine mai confermato: promemoria a 14 giorni, a 30 la montatura torna disponibile
  if ([L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato)){
    try { const r = await attesa(u, ora); if (r) esiti.push({univoco: u.f.Univoco, esito: r}); } catch(e){ esiti.push({univoco: u.f.Univoco, errore: String(e.message).slice(0, 200)}); }
    return;
  }
  // occhiale da restituire non ancora riportato dopo 15 giorni
  { const o = L.parseOrdine(u.f.Ordine);
    if (o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato && new Date(ora) - new Date(o.ritiro.dal) > 15*864e5 && !(o.avvisi && o.avvisi.ritardoRitiro)){
      await annota(u, o, "ritardoRitiro", `SocialGlass: ${L.nm(u.f.Nome)}, non abbiamo ancora ricevuto l'occhiale da restituire. Riportalo in ottica appena puoi, oppure chiedi all'ottico di comprarlo usato.`);
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)}); esiti.push({univoco: u.f.Univoco, esito: "sollecito restituzione"});
    }
    try { const r = await restituzioneMancata(u, ora); if (r) esiti.push({univoco: u.f.Univoco, esito: r}); } catch(e){ esiti.push({univoco: u.f.Univoco, errore: "restituzione mancata: " + String(e.message).slice(0, 180)}); } }
  if (![L.STATI.ATTIVO, L.STATI.PRONTO, L.STATI.CONSEGNATO].includes(u.f.Stato)) return;
  const ord = L.parseOrdine(u.f.Ordine), p = L.PREZZI.periodo(ord, ora);
  // 7 giorni dopo la consegna: «come ti trovi?» (notifica gratuita; la domanda compare anche nella sua pagina)
  if (ord.consegnatoIl && !ord.recensione && !ord.recensioneChiesta && new Date(ora) - new Date(ord.consegnatoIl) >= 7*864e5){
    ord.recensioneChiesta = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    try { await L.pushCliente(u.f, `SocialGlass: ${L.nm(u.f.Nome)}, come ti trovi con i tuoi occhiali nuovi? Dicci la tua con un tocco.`, "Come ti trovi?"); } catch(e){}
    esiti.push({univoco: u.f.Univoco, esito: "richiesta recensione"});
  }
  // ogni anno dalla consegna: controllo della vista incluso, da prenotare dal link
  if (ord.consegnatoIl && !(ord.pagamento && ord.pagamento.chiuso)){
    const anni = Math.floor((new Date(ora) - new Date(ord.consegnatoIl)) / (365*864e5));
    if (anni >= 1 && (ord.controlloAvvisato || 0) < anni){
      ord.controlloAvvisato = anni;
      await annota(u, ord, "controllo" + anni, `SocialGlass: ${L.nm(u.f.Nome)}, è il momento del controllo della vista, incluso nel tuo abbonamento. Prenota giorno e ora dal tuo link: ${L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino)}`);
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); esiti.push({univoco: u.f.Univoco, esito: "promemoria controllo vista"});
    }
  }
  if (!p || p.chiuso) return;
  try {
    const r = await esegui(u, ord, p, ora);
    if (r){ if (r !== "rinnovato"){ ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); } esiti.push({univoco: u.f.Univoco, esito: r}); }
  } catch(e){ console.error(u.f.Univoco, e); esiti.push({univoco: u.f.Univoco, errore: String(e.message).slice(0, 200)}); }

}
const handler = L.wrap(async (req, res) => {
  const auth = req.headers.authorization || "";
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) return L.send(res, 401, {errore: "Non autorizzato"});
  const url = new URL(req.url, "http://x"), ora = url.searchParams.get("data") ? new Date(url.searchParams.get("data")).toISOString() : new Date().toISOString();
  const tutti = await L.DB.tutti();
  const esiti = [];
  for (const u of tutti) await controlla(u, ora, esiti);
  // differenze con Stripe da far vedere all'amministratore (si rifanno ogni notte)
  if (!url.searchParams.get("data")) try { await L.DB.meta("differenze-stripe", {il: ora, voci: esiti.filter(x => x.differenza).map(x => ({univoco: x.univoco, testo: x.differenza}))}); } catch(e){ console.error(e); }
  // riordino automatico per i fornitori che lo hanno attivo
  try { for (const fo of await L.DB.lista("forn")) if (fo.RiordinoAuto){ const id = await L.riordinoAuto(fo.ID || fo._id); if (id) esiti.push({fornitore: fo.ID || fo._id, esito: "bozza di riordino " + id}); } } catch(e){ esiti.push({errore: "riordino: " + String(e.message).slice(0, 200)}); }
  // fatture non ancora partite verso Aruba (errori di rete, credenziali arrivate dopo)
  try { const inv = await require("./_fattura").inviaInSospeso(); if (inv.length) esiti.push({fatture: inv}); } catch(e){ esiti.push({errore: "fatture: " + String(e.message).slice(0, 200)}); }
  // copia di tutti i dati (si tengono le ultime 7), scaricabile dal pannello
  if (!url.searchParams.get("data")) try { esiti.push({copia: await L.copiaNotturna()}); } catch(e){ esiti.push({errore: "copia dei dati: " + String(e.message).slice(0, 200)}); }
  L.send(res, 200, {ok: true, data: ora, esiti});
});
module.exports = handler;
module.exports.esegui = esegui;
module.exports.controlla = controlla;
module.exports.anonimizza = anonimizza;
