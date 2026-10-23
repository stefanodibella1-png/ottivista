// L'ottico inserisce lenti, trattamenti e ricetta; il prezzo si calcola dal listino della sua convenzione.
const L = require("./_lib");
const num = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) ? x : null; };
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req, "ottico"); if (!s) return L.send(res, 401, L.NOAUTH);
  const url = new URL(req.url, "http://x");
  if (req.method === "GET"){
    const u = await L.DB.utente("Univoco", (url.searchParams.get("univoco") || "").toUpperCase().trim());
    if (!u || !String(u.f.Ottica1 || "").startsWith(s.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i clienti della tua ottica."});
    const o = await L.DB.ottico(s.id);
    const conv = L.PREZZI.conv(u.f.Listino || (o && o.Listino));
    return L.send(res, 200, {nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato, ordine: L.parseOrdine(u.f.Ordine),
      listino: {id: u.f.Listino || "", lenti: conv.lenti, trattamenti: conv.trattamenti, montatura: conv.montatura, mesi: L.PREZZI.LISTINI.mesi, spedizione: L.PREZZI.LISTINI.spedizione}});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const b = await L.readBody(req);
  const u = await L.DB.utente("Univoco", String(b.univoco || "").toUpperCase().trim());
  if (!u || !String(u.f.Ottica1 || "").startsWith(s.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i clienti della tua ottica."});
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
    ord.ritiro.ritirato = ora; ord.pagamento = ord.pagamento || {}; ord.pagamento.esito = "OCCHIALE RESTITUITO"; ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {ok: true});
  }
  if (b.azione === "pronto" || b.azione === "consegnato"){
    if (![L.STATI.ATTIVO, L.STATI.PRONTO].includes(u.f.Stato)) return L.send(res, 409, {errore: "L'ordine non è ancora attivo."});
    ord.aggiornato = new Date().toISOString(); ord[b.azione === "pronto" ? "prontoIl" : "consegnatoIl"] = ord.aggiornato;
    await L.DB.aggiorna(u, {Stato: b.azione === "pronto" ? L.STATI.PRONTO : L.STATI.CONSEGNATO, Ordine: JSON.stringify(ord)});
    const link = L.linkCliente(u.f.Univoco, s.id);
    const av = b.azione === "pronto" ? await L.avvisa(u, `SocialGlass: ${u.f.Nome}, i tuoi occhiali sono pronti! Passa a ritirarli in ottica con il codice ${u.f.Univoco}. ${link}`) : null;
    return L.send(res, 200, {ok: true, stato: u.f.Stato, avviso: av});
  }
  if (![L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato) || !ord.montatura) return L.send(res, 409, {errore: "Il cliente deve prima scegliere la montatura con il QR."});
  const r = b.ricetta || {};
  const occhio = e => ({sf: num(e && e.sf), cil: num(e && e.cil), ax: num(e && e.ax), add: num(e && e.add)});
  const ricetta = {OD: occhio(r.OD), OS: occhio(r.OS), pd: num(r.pd), note: String(r.note || "").slice(0, 300)};
  if (ricetta.OD.sf === null && ricetta.OS.sf === null) return L.send(res, 400, {errore: "Inserisci almeno lo sfero di un occhio."});
  for (const e of [ricetta.OD, ricetta.OS]){
    if (e.ax !== null && (e.ax < 0 || e.ax > 180)) return L.send(res, 400, {errore: "L'asse deve essere tra 0 e 180."});
    if (e.cil !== null && e.cil !== 0 && e.ax === null) return L.send(res, 400, {errore: "Con il cilindro serve anche l'asse."});
  }
  if (!ricetta.pd || ricetta.pd < 45 || ricetta.pd > 80) return L.send(res, 400, {errore: "Inserisci la distanza pupillare (45-80 mm)."});
  if (b.lente === "prog" && ricetta.OD.add === null && ricetta.OS.add === null) return L.send(res, 400, {errore: "Per le progressive serve l'addizione."});
  // se il cliente aveva già aperto il pagamento con il vecchio prezzo, quella pagina Stripe viene chiusa
  if (ord.pagamento && ord.pagamento.stato === "IN CORSO" && ord.pagamento.sessione && L.CFG.stripeKey){
    try { await L.stripeApi("POST", `checkout/sessions/${ord.pagamento.sessione}/expire`, {}); } catch(e){ console.error(e); }
    delete ord.pagamento;
  }
  const prev = L.PREZZI.preventivo(u.f.Listino, b.lente, b.trattamenti, ord.montatura.prezzo);
  if (!prev) return L.send(res, 400, {errore: "Scegli il tipo di lenti."});
  Object.assign(ord, {lenti: prev.lenti, trattamenti: prev.trattamenti, ricetta, prezzi: {montatura: prev.montatura, totale: prev.totale, mesi: prev.mesi, rata: prev.rata, spedizione: prev.spedizione, riscatto: prev.riscatto, modello: prev.modello},
    ottico: s.id, aggiornato: new Date().toISOString()});
  await L.DB.aggiorna(u, {Stato: L.STATI.PAGAMENTO, Ordine: JSON.stringify(ord)});
  const av = await L.avvisa(u, `SocialGlass: ${u.f.Nome}, ${ord.rinnovo && ord.rinnovo.prosegue ? "il preventivo del tuo occhiale nuovo è pronto" : "il tuo ottico ha preparato il preventivo"}: ${prev.rata.toFixed(2).replace(".", ",")} €/mese, durata minima ${prev.mesi} mesi. Apri il link, controlla il riepilogo e conferma: ${L.linkCliente(u.f.Univoco, s.id)}`);
  L.send(res, 200, {ok: true, prezzi: ord.prezzi, avviso: av});
});
