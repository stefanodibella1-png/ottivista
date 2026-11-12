// L'ottico inserisce lenti, trattamenti e ricetta; il prezzo si calcola dal listino della sua convenzione.
const L = require("./_lib");
const num = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) ? x : null; };
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req); if (!s || !["ottico", "lab"].includes(s.ruolo)) return L.send(res, 401, L.NOAUTH);
  await L.caricaListini();   // prezzi aggiornati dall'amministratore
  const url = new URL(req.url, "http://x");
  // laboratorio: avanzamento della lavorazione (ritiro montatura, inizio, pronto)
  if (s.ruolo === "lab"){
    if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
    const b = await L.readBody(req), u = await L.DB.utente("Univoco", String(b.univoco || "").toUpperCase().trim());
    const ord = u ? L.parseOrdine(u.f.Ordine) : null;
    if (!u || !ord.lab) return L.send(res, 404, {errore: "Lavorazione non trovata."});
    if (b.azione !== "nota") L.registraEsito(res, "laboratorio", {ritirata: "montatura ritirata", pronto: "occhiale pronto", inizia: "lavorazione iniziata"}[b.azione] || b.azione, u.f.Univoco);
    const ora = new Date().toISOString(), lab = ord.lab;
    if (b.azione === "ritirata"){ if (lab.fonte === "LAB") return L.send(res, 409, {errore: "La montatura è già in laboratorio."}); lab.ritirata = ora; }
    else if (b.azione === "inizia"){ if (lab.stato === "PRONTO") return L.send(res, 409, {errore: "Già pronto."}); lab.stato = "IN LAVORAZIONE"; lab.iniziato = lab.iniziato || ora; }
    else if (b.azione === "nota"){ lab.note = String(b.nota || "").slice(0, 300); }
    else if (b.azione === "pronto"){
      if (u.f.Stato !== L.STATI.ATTIVO) return L.send(res, 409, {errore: "L'ordine non è in lavorazione."});
      if (lab.fonte !== "LAB" && !lab.ritirata) return L.send(res, 409, {errore: "Prima segna la montatura come ritirata."});
      lab.stato = "PRONTO"; lab.pronto = ora; ord.prontoIl = ora;
      // il cliente viene avvisato in automatico; se il canale non è collegato, il messaggio lo manda l'ottica
      ord.avvisi = ord.avvisi || {};
      // cliente moroso: l'occhiale resta in ottica e non lo invitiamo a ritirarlo finché non paga
      if (L.situazione(u.f).bloccato){
        lab.avvisoCliente = {il: ora, inviato: false, motivo: "cliente moroso: consegna bloccata"};
        ord.avvisi["labpronto" + ora.slice(0, 10)] = {il: ora, testo: "Il laboratorio ha finito l'occhiale: arriva in ottica. Il cliente ha un canone non pagato: non può ritirarlo finché non paga (l'amministratore lo sta sollecitando)."};
        ord.aggiornato = ora; await L.DB.aggiorna(u, {Stato: L.STATI.PRONTO, Ordine: JSON.stringify(ord)});
        return L.send(res, 200, {ok: true, avviso: {inviato: false, motivo: "cliente moroso: non avvisato"}});
      }
      const av = await L.avvisaPronto(u); lab.avvisoCliente = {il: ora, canale: av.canale, inviato: av.inviato, motivo: av.motivo};
      ord.avvisi["labpronto" + ora.slice(0, 10)] = av.inviato
        ? {il: ora, testo: `Il laboratorio ha finito l'occhiale: arriva in ottica. Il cliente è già stato avvisato (${({sms: "SMS", notifica: "notifica sul telefono"})[av.canale] || "WhatsApp"}). Quando lo ritira, segna «consegnato».`}
        : {il: ora, testo: `Il laboratorio ha finito l'occhiale: arriva in ottica. Il cliente NON è stato avvisato in automatico: mandagli tu il messaggio. ${av.testo}`, whatsapp: av.whatsapp};
      ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Stato: L.STATI.PRONTO, Ordine: JSON.stringify(ord)});
      return L.send(res, 200, {ok: true, avviso: {inviato: av.inviato, canale: av.canale, motivo: av.motivo}});
    } else return L.send(res, 400, {errore: "Operazione non valida."});
    ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {ok: true});
  }
  if (req.method === "GET"){
    const u = await L.DB.utente("Univoco", (url.searchParams.get("univoco") || "").toUpperCase().trim());
    if (!u || !String(u.f.Ottica1 || "").startsWith(s.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i clienti della tua ottica."});
    const o = await L.DB.ottico(s.id);
    const conv = L.PREZZI.conv(u.f.Listino || (o && o.Listino));
    return L.send(res, 200, {nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato, bloccato: L.situazione(u.f).bloccato, ordine: L.parseOrdine(u.f.Ordine),
      listino: {id: u.f.Listino || (o && o.Listino) || "A", lenti: conv.lenti, trattamenti: conv.trattamenti, montatura: conv.montatura, mesi: L.PREZZI.LISTINI.mesi, spedizione: L.PREZZI.LISTINI.spedizione}});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const b = await L.readBody(req);
  // orari in cui i clienti possono prenotare un appuntamento
  if (b.azione === "orari"){
    const giorni = (Array.isArray(b.giorni) ? b.giorni : []).map(Number).filter(g => g >= 0 && g <= 6), fasce = (Array.isArray(b.fasce) ? b.fasce : []).map(String).filter(f => L.FASCIA.test(f)).slice(0, 4);
    if (!giorni.length || !fasce.length) return L.send(res, 400, {errore: "Scegli almeno un giorno e una fascia oraria (es. 09:30-12:30)."});
    await L.DB.salva("ottici", s.id, {Orari: {giorni, fasce, durata: [15, 20, 30, 45, 60].includes(Number(b.durata)) ? Number(b.durata) : 30}});
    await L.registra("ottica " + s.id, "orari appuntamenti", s.id, `${giorni.join(",")} · ${fasce.join(" ")}`);
    return L.send(res, 200, {ok: true});
  }
  // segnalazione del cliente risolta dall'ottica
  if (b.azione === "segnalazioneRisolta"){
    const x = await L.DB.uno("segn", String(b.id || "")); if (!x || x.ottica !== s.id) return L.send(res, 404, {errore: "Segnalazione non trovata."});
    const ora = new Date().toISOString(), risposta = String(b.risposta || "").trim().slice(0, 300);
    await L.DB.salva("segn", x.ID || x._id, {stato: "risolta", risolta: ora, da: "ottica " + s.id, risposta});
    const c = await L.DB.utente("Univoco", x.univoco);
    if (c){ const o = L.parseOrdine(c.f.Ordine); (o.segnalazioni || []).forEach(y => { if (y.id === (x.ID || x._id)){ y.stato = "risolta"; y.risposta = risposta; y.risolta = ora; } }); await L.DB.aggiorna(c, {Ordine: JSON.stringify(o)});
      if (risposta) try { await L.pushCliente(c.f, `SocialGlass: ${c.f.Nome}, l'ottica ha risposto alla tua segnalazione: ${risposta}`, "Risposta dall'ottica"); } catch(_){} }
    await L.registra("ottica " + s.id, "segnalazione risolta", x.univoco, risposta);
    return L.send(res, 200, {ok: true});
  }
  const u = await L.DB.utente("Univoco", String(b.univoco || "").toUpperCase().trim());
  if (!u || !String(u.f.Ottica1 || "").startsWith(s.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i clienti della tua ottica."});
  L.registraEsito(res, "ottica " + s.id, {recesso: "recesso", ritirato: "occhiale restituito ritirato", pronto: "occhiale pronto", consegnato: "occhiale consegnato", preventivo: "preventivo inserito", riscatto: "riscatto"}[b.azione] || b.azione || "preventivo inserito", u.f.Univoco);
  const ord = L.parseOrdine(u.f.Ordine);
  // recesso entro 14 giorni dall'attivazione (diritto del consumatore): l'abbonamento si chiude subito
  if (b.azione === "recesso"){
    const pg = ord.pagamento;
    if (!pg || !pg.attivatoIl || pg.chiuso || Date.now() - new Date(pg.attivatoIl) > 14*864e5) return L.send(res, 409, {errore: "Il recesso è possibile solo nei 14 giorni dall'attivazione."});
    if (L.CFG.stripeKey && pg.abbonamento){ try { await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`); } catch(e){ console.error(e); return L.send(res, 502, {errore: "Stripe non risponde: riprova tra poco."}); } }
    const ora = new Date().toISOString();
    pg.chiuso = ora; pg.esito = "RECESSO ENTRO 14 GIORNI: RIMBORSO DA FARE DA STRIPE";
    if (u.f.Stato === L.STATI.CONSEGNATO || u.f.Stato === L.STATI.PRONTO) ord.ritiro = {daRitirare: u.f.Stato === L.STATI.CONSEGNATO, dal: ora};
    ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    const av = await L.avvisa(u, `SocialGlass: ${u.f.Nome}, abbiamo registrato il recesso: l'abbonamento è chiuso e non ci saranno altri addebiti. Il rimborso arriva sul metodo di pagamento usato.${ord.ritiro && ord.ritiro.daRitirare ? " Riporta l'occhiale in ottica." : ""}`);
    return L.send(res, 200, {ok: true, avviso: av});
  }
  if (b.azione === "ritirato"){
    if (!ord.ritiro || !ord.ritiro.daRitirare) return L.send(res, 409, {errore: "Non c'è un occhiale da ritirare."});
    const ora = new Date().toISOString();
    // occhiale vecchio di un rinnovo: l'abbonamento continua, non si chiude niente
    ord.ritiro.ritirato = ora; ord.aggiornato = ora;
    if (!ord.ritiro.rinnovo){ ord.pagamento = ord.pagamento || {}; ord.pagamento.esito = "OCCHIALE RESTITUITO"; }
    if (ord.dona && ord.dona.si && !ord.dona.donato) ord.dona.daDonare = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {ok: true, daDonare: !!(ord.dona && ord.dona.si)});
  }
  if ((b.azione === "pronto" || b.azione === "consegnato") && ord.lab && ord.lab.stato !== "PRONTO") return L.send(res, 409, {errore: "L'occhiale è ancora in laboratorio: lo segna pronto il laboratorio quando ha finito."});
  if (b.azione === "pronto" || b.azione === "consegnato"){
    if (b.azione === "consegnato" && L.situazione(u.f).bloccato) return L.send(res, 423, L.BLOCCATO);
    if (![L.STATI.ATTIVO, L.STATI.PRONTO].includes(u.f.Stato)) return L.send(res, 409, {errore: "L'ordine non è ancora attivo."});
    ord.aggiornato = new Date().toISOString(); ord[b.azione === "pronto" ? "prontoIl" : "consegnatoIl"] = ord.aggiornato;
    if (b.azione === "consegnato" && (ord.storico || []).length && !(ord.ritiro && ord.ritiro.daRitirare && !ord.ritiro.ritirato))
      ord.ritiro = {daRitirare: true, dal: ord.aggiornato, rinnovo: true, montatura: ((ord.storico[ord.storico.length - 1] || {}).montatura) || null};
    await L.DB.aggiorna(u, {Stato: b.azione === "pronto" ? L.STATI.PRONTO : L.STATI.CONSEGNATO, Ordine: JSON.stringify(ord)});
    const link = L.linkCliente(u.f.Univoco, s.id);
    const av = b.azione === "pronto" ? await L.avvisaPronto(u) : null;
    return L.send(res, 200, {ok: true, stato: u.f.Stato, avviso: av});
  }
  if (L.situazione(u.f).bloccato) return L.send(res, 423, L.BLOCCATO);
  if (![L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato) || !ord.montatura) return L.send(res, 409, {errore: "Il cliente deve prima scegliere la montatura con il QR."});
  const r = b.ricetta || {};
  // diottrie scritte senza virgola (es. -150 = -1,50): si riportano in diottrie
  const dio = (v, max) => { const x = num(v); return x !== null && Math.abs(x) > max && Number.isInteger(x) ? x / 100 : x; };
  const occhio = e => ({sf: dio(e && e.sf, 30), cil: dio(e && e.cil, 10), ax: num(e && e.ax), add: dio(e && e.add, 4)});
  const ricetta = {OD: occhio(r.OD), OS: occhio(r.OS), pd: num(r.pd), note: String(r.note || "").slice(0, 300)};
  if (ricetta.OD.sf === null && ricetta.OS.sf === null) return L.send(res, 400, {errore: "Inserisci almeno lo sfero di un occhio."});
  for (const e of [ricetta.OD, ricetta.OS]){
    for (const [k, max] of [["sf", 30], ["cil", 10], ["add", 4]]) if (e[k] !== null && (Math.abs(e[k]) > max || Math.abs(Math.round(e[k] * 4) - e[k] * 4) > 1e-6)) return L.send(res, 400, {errore: `Valore non valido (${k === "sf" ? "sfero" : k === "cil" ? "cilindro" : "addizione"} ${e[k]}): usa diottrie a passi di 0,25, es. -1,50.`});
    if (e.ax !== null && (e.ax < 0 || e.ax > 180)) return L.send(res, 400, {errore: "L'asse deve essere tra 0 e 180."});
    if (e.cil !== null && e.cil !== 0 && e.ax === null) return L.send(res, 400, {errore: "Con il cilindro serve anche l'asse."});
  }
  if (!ricetta.pd || ricetta.pd < 45 || ricetta.pd > 80) return L.send(res, 400, {errore: "Inserisci la distanza pupillare (45-80 mm)."});
  const lenteScelta = (L.PREZZI.conv(u.f.Listino || ((await L.DB.ottico(s.id)) || {}).Listino).lenti || {})[b.lente] || {};
  if ((b.lente === "prog" || /progressiv|multifocal/i.test(lenteScelta.nome || "")) && ricetta.OD.add === null && ricetta.OS.add === null) return L.send(res, 400, {errore: "Per le progressive serve l'addizione."});
  // se il cliente aveva già aperto il pagamento con il vecchio prezzo, quella pagina Stripe viene chiusa
  if (ord.pagamento && ord.pagamento.stato === "IN CORSO" && ord.pagamento.sessione && L.CFG.stripeKey){
    try { await L.stripeApi("POST", `checkout/sessions/${ord.pagamento.sessione}/expire`, {}); } catch(e){ console.error(e); }
    delete ord.pagamento;
  }
  // stesso listino mostrato all'ottico: quello del cliente, altrimenti quello dell'ottica
  const lisOtt = u.f.Listino || ((await L.DB.ottico(s.id)) || {}).Listino || "A";
  const prev = L.PREZZI.preventivo(lisOtt, b.lente, b.trattamenti, ord.montatura.prezzo);
  if (!prev) return L.send(res, 400, {errore: "Scegli il tipo di lenti."});
  Object.assign(ord, {lenti: prev.lenti, trattamenti: prev.trattamenti, ricetta, prezzi: {montatura: prev.montatura, totale: prev.totale, mesi: prev.mesi, rata: prev.rata, spedizione: prev.spedizione, riscatto: prev.riscatto, modello: prev.modello},
    ottico: s.id, aggiornato: new Date().toISOString()});
  await L.DB.aggiorna(u, {Stato: L.STATI.PAGAMENTO, Ordine: JSON.stringify(ord)});
  const av = await L.avvisa(u, `SocialGlass: ${u.f.Nome}, ${ord.rinnovo && ord.rinnovo.prosegue ? "il preventivo del tuo occhiale nuovo è pronto" : "il tuo ottico ha preparato il preventivo"}: ${prev.rata.toFixed(2).replace(".", ",")} €/mese, durata minima ${prev.mesi} mesi. Apri il link, controlla il riepilogo e conferma: ${L.linkCliente(u.f.Univoco, s.id)}`);
  L.send(res, 200, {ok: true, prezzi: ord.prezzi, avviso: av});
});
