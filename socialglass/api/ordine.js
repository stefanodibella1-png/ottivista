// L'ottico inserisce lenti, trattamenti e ricetta; il prezzo si calcola dal listino della sua convenzione.
const L = require("./_lib");
const num = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) ? x : null; };
// ricetta scritta dall'ottica: si leggono e si controllano i valori (preventivo e correzione)
function leggiRicetta(r, progressive){
  r = r || {};
  // diottrie scritte senza virgola (es. -150 = -1,50): si riportano in diottrie
  const dio = (v, max) => { const x = num(v); return x !== null && Math.abs(x) > max && Number.isInteger(x) ? x / 100 : x; };
  const occhio = e => ({sf: dio(e && e.sf, 30), cil: dio(e && e.cil, 10), ax: num(e && e.ax), add: dio(e && e.add, 4)});
  const ricetta = {OD: occhio(r.OD), OS: occhio(r.OS), pd: num(r.pd), note: String(r.note || "").slice(0, 300)};
  // DP per occhio (facoltativa) e altezza di montaggio (obbligatoria per le progressive), in millimetri
  const mm = v => { const x = num(v); return x === null ? null : Math.round(x * 2) / 2; };
  const pdm = {OD: mm(r.pdm && r.pdm.OD), OS: mm(r.pdm && r.pdm.OS)}, alt = {OD: mm(r.h && r.h.OD), OS: mm(r.h && r.h.OS)};
  if (pdm.OD !== null || pdm.OS !== null) ricetta.pdm = pdm;
  if (alt.OD !== null || alt.OS !== null) ricetta.h = alt;
  for (const x of [pdm.OD, pdm.OS]) if (x !== null && (x < 25 || x > 40)) return ({errore: "La distanza pupillare di un occhio deve essere tra 25 e 40 mm."});
  for (const x of [alt.OD, alt.OS]) if (x !== null && (x < 10 || x > 40)) return ({errore: "L'altezza di montaggio deve essere tra 10 e 40 mm."});
  if (ricetta.OD.sf === null && ricetta.OS.sf === null) return ({errore: "Inserisci almeno lo sfero di un occhio."});
  for (const e of [ricetta.OD, ricetta.OS]){
    for (const [k, max] of [["sf", 30], ["cil", 10], ["add", 4]]) if (e[k] !== null && (Math.abs(e[k]) > max || Math.abs(Math.round(e[k] * 4) - e[k] * 4) > 1e-6)) return ({errore: `Valore non valido (${k === "sf" ? "sfero" : k === "cil" ? "cilindro" : "addizione"} ${e[k]}): usa diottrie a passi di 0,25, es. -1,50.`});
    if (e.ax !== null && (e.ax < 0 || e.ax > 180)) return ({errore: "L'asse deve essere tra 0 e 180."});
    if (e.cil !== null && e.cil !== 0 && e.ax === null) return ({errore: "Con il cilindro serve anche l'asse."});
  }
  if (!ricetta.pd || ricetta.pd < 45 || ricetta.pd > 80) return ({errore: "Inserisci la distanza pupillare (45-80 mm)."});
  if (progressive && ricetta.OD.add === null && ricetta.OS.add === null) return ({errore: "Per le progressive serve l'addizione."});
  if (progressive && (alt.OD === null || alt.OS === null)) return ({errore: "Manca l'altezza di montaggio per le progressive (occhio destro e sinistro, in mm)."});
  return {ricetta};
}
// rifacimento: lenti sbagliate o difettose. Se l'occhiale è in laboratorio si rifà subito; se è in ottica (o dal cliente) l'ottica lo rispedisce
async function rifai(u, ord, motivo, da){
  motivo = String(motivo || "").trim().slice(0, 300);
  if (motivo.length < 3) return {errore: "Scrivi il motivo del rifacimento (es. «potere sbagliato», «lente rigata»)."};
  if (ord.pagamento && ord.pagamento.chiuso) return {errore: "Il contratto di questo cliente è chiuso: contatta SocialGlass."};
  if (u.f.Stato === L.STATI.CONSEGNATO && ord.consegnatoIl && Date.now() - new Date(ord.consegnatoIl) > 90*864e5) return {errore: "Il rifacimento si chiede entro 90 giorni dalla consegna: contatta SocialGlass."};
  if ((ord.rifacimenti || []).length >= 5) return {errore: "Troppi rifacimenti per questo occhiale: contatta SocialGlass."};
  const lab = ord.lab, ora = new Date().toISOString(), ott = String(u.f.Ottica1 || "").split(" - ")[0], inLab = ["IN LAVORAZIONE", "PRONTO"].includes(lab.stato);
  ord.rifacimenti = (ord.rifacimenti || []).concat({il: ora, da, motivo, statoLab: lab.stato, stato: u.f.Stato, consegnatoIl: ord.consegnatoIl || ""});
  for (const k of ["pronto", "spedito", "arrivato", "avvisoCliente"]) delete lab[k];
  if (inLab) lab.stato = "IN LAVORAZIONE";
  else { for (const k of ["spedita", "ritirata"]) delete lab[k]; Object.assign(lab, {stato: "ATTESA MONTATURA", fonte: "OTTICA", sede: ott, richiesta: ora}); }
  lab.rifacimento = {il: ora, motivo, da};
  delete ord.prontoIl; delete ord.consegnatoIl; ord.aggiornato = ora;
  await L.DB.aggiorna(u, {Stato: L.STATI.ATTIVO, Ordine: JSON.stringify(ord)});
  const chi = `${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)} (${u.f.Univoco})`;
  try {
    if (da === "laboratorio") await L.pushPartner("ottico", ott, inLab ? `Il laboratorio rifà le lenti di ${chi}: ${motivo}.` : `Il laboratorio deve rifare le lenti di ${chi} (${motivo}): ritira l'occhiale e spediscilo al laboratorio con la scheda.`, "Occhiale da rifare", "/ottico");
    else await L.pushPartner("lab", "LAB", `Da rifare: occhiale di ${chi} · ${motivo}.${inLab ? "" : " L'ottica ti rispedisce l'occhiale."}`, "Occhiale da rifare", "laboratorio.html");
  } catch(e){ console.error(e); }
  return {ok: true, dove: inLab ? "laboratorio" : "ottica", stato: lab.stato};
}
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req); if (!s || !["ottico", "lab"].includes(s.ruolo)) return L.send(res, 401, L.NOAUTH);
  await L.caricaListini();   // prezzi aggiornati dall'amministratore
  const url = new URL(req.url, "http://x");
  // notifiche sul telefono/computer per laboratorio e ottica
  if (url.searchParams.get("vapid")){ const k = await L.chiaviPushPubblica(); return L.send(res, 200, {vapid: k}); }
  if (req.method === "POST" && url.searchParams.get("push")){
    const b = await L.readBody(req), r = await L.iscriviPartner(s.ruolo, s.id, b.sub); if (r.errore) return L.send(res, 400, r);
    const ok = await L.pushPartner(s.ruolo, s.id, s.ruolo === "lab" ? "Notifiche attive: ti avvisiamo a ogni nuovo ordine pagato." : "Notifiche attive: ti avvisiamo quando il laboratorio chiede una montatura.", "Notifiche attive", s.ruolo === "lab" ? "laboratorio.html" : "/ottico");
    return L.send(res, 200, {ok: true, prova: ok});
  }
  // laboratorio: avanzamento della lavorazione (ritiro montatura, inizio, pronto)
  if (s.ruolo === "lab"){
    if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
    const b = await L.readBody(req), u = await L.DB.utente("Univoco", String(b.univoco || "").toUpperCase().trim());
    if (u && u.f.Archiviato) return L.send(res, 410, {errore: "Pratica scaduta: il cliente non ha attivato l'abbonamento entro 30 giorni. Va registrato di nuovo (dal CAF o con «Nuovo cliente» in ottica)."});
    const ord = u ? L.parseOrdine(u.f.Ordine) : null;
    if (!u || !ord.lab) return L.send(res, 404, {errore: "Lavorazione non trovata."});
    if (b.azione === "annulla"){ L.registraEsito(res, "laboratorio", "ultimo passaggio annullato", u.f.Univoco); const r = await L.annullaUltimo(u); return L.send(res, r.errore ? 409 : 200, r); }
    const no = L.permesso(b.azione === "pronto" ? "prontoLab" : b.azione, "lab", u.f); if (no) return L.send(res, 409, no);
    if (b.azione === "rifare"){ L.registraEsito(res, "laboratorio", "occhiale da rifare", u.f.Univoco, String(b.motivo || "").slice(0, 200)); const r = await rifai(u, ord, b.motivo, "laboratorio"); return L.send(res, r.errore ? 409 : 200, r); }
    if (L.ANNULLABILI.lab.includes(b.azione)) L.segnaAnnullabile(b.azione, {ritirata: "montatura ritirata", inizia: "inizio lavorazione", pronto: b.spedisci ? "pronto e spedito all'ottica" : "occhiale pronto", spedito: "spedito all'ottica"}[b.azione]);
    if (b.azione !== "nota") L.registraEsito(res, "laboratorio", {ritirata: "montatura ritirata", pronto: b.spedisci ? "occhiale pronto e spedito all'ottica" : "occhiale pronto", spedito: "occhiale spedito all'ottica", inizia: "lavorazione iniziata", disponibile: "montatura disponibile", richiedi: "montatura richiesta all'ottica", rifare: "occhiale da rifare", annulla: "ultimo passaggio annullato"}[b.azione] || b.azione, u.f.Univoco, b.motivo ? String(b.motivo).slice(0, 200) : "");
    const ora = new Date().toISOString(), lab = ord.lab;
    if (b.azione === "disponibile" || b.azione === "richiedi"){
      if (u.f.Stato !== L.STATI.ATTIVO) return L.send(res, 409, {errore: "L'ordine non è in lavorazione."});
      // montatura arrivata dall'ottica: si controlla che sia proprio quella del cliente
      if (b.azione === "disponibile" && lab.stato === "ATTESA MONTATURA" && !L.codiceMontatura(b.codice, ord.montatura && ord.montatura.codice))
        return L.send(res, 409, {errore: b.codice ? `Il codice non corrisponde: questa non è la montatura del cliente (attesa ${(ord.montatura || {}).codice} ${(ord.montatura || {}).modello || ""} ${(ord.montatura || {}).colore || ""}). Non montare le lenti e avvisa l'ottica.` : "Scansiona o scrivi il codice della montatura ricevuta.", codice: true});
      const r = await L.labMontatura(u, ord, b.azione); if (r.errore) return L.send(res, 409, r);
      ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); return L.send(res, 200, r);
    }
    if (lab.verifica && !lab.disponibile && ["ritirata", "pronto"].includes(b.azione)) return L.send(res, 409, {errore: "Prima indica se la montatura è disponibile in laboratorio."});
    if (b.azione === "ritirata"){ if (lab.fonte === "LAB") return L.send(res, 409, {errore: "La montatura è già in laboratorio."}); lab.ritirata = ora; }
    else if (b.azione === "inizia"){
      // lenti su misura avviate: da qui il cliente non può più annullare (anche se la montatura è ancora in viaggio)
      lab.iniziato = lab.iniziato || ora; if (lab.stato === "DA FARE") lab.stato = "IN LAVORAZIONE";
      ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
      try { await L.avvisa(u, `SocialGlass: ${L.nm(u.f.Nome)}, il laboratorio sta preparando le tue lenti su misura: da ora l'ordine non si può più annullare. Ti avvisiamo quando gli occhiali sono pronti.`); } catch(e){ console.error(e); }
      return L.send(res, 200, {ok: true, stato: lab.stato});
    }
    else if (b.azione === "nota"){ lab.note = String(b.nota || "").slice(0, 300); }
    else if (b.azione === "pronto" || b.azione === "spedito"){
      // occhiale finito: il cliente NON viene avvisato adesso (l'occhiale è ancora in laboratorio); lo avvisa l'ottica all'arrivo
      if (u.f.Stato !== L.STATI.ATTIVO) return L.send(res, 409, {errore: "L'ordine non è in lavorazione."});
      if (b.azione === "pronto"){ if (!lab.verifica && lab.fonte !== "LAB" && !lab.ritirata) return L.send(res, 409, {errore: "Prima segna la montatura come ritirata."}); lab.stato = "PRONTO"; lab.pronto = ora; }
      if (b.azione === "spedito" || b.spedisci){ lab.stato = "SPEDITO"; lab.spedito = ora; }
      ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
      if (lab.stato === "SPEDITO") try { await L.pushPartner("ottico", String(u.f.Ottica1 || "").split(" - ")[0], `In arrivo dal laboratorio l'occhiale di ${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)} (${u.f.Univoco}): quando lo ricevi tocca «Occhiale arrivato».`, "Occhiale in arrivo", "/ottico"); } catch(e){ console.error(e); }
      return L.send(res, 200, {ok: true, stato: lab.stato});
    } else return L.send(res, 400, {errore: "Operazione non valida."});
    ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {ok: true});
  }
  if (req.method === "GET"){
    const u = await L.DB.utente("Univoco", (url.searchParams.get("univoco") || "").toUpperCase().trim());
    if (!u || !String(u.f.Ottica1 || "").startsWith(s.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i clienti della tua ottica."});
    const o = await L.DB.ottico(s.id);
    const conv = L.PREZZI.conv(u.f.Listino || (o && o.Listino));
    return L.send(res, 200, {nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato, bloccato: L.situazione(u.f).bloccato, consenso: !!(u.f.ConsensoSanitario && u.f.ConsensoSanitario.il), ordine: L.parseOrdine(u.f.Ordine),
      listino: {id: u.f.Listino || (o && o.Listino) || "A", lenti: conv.lenti, trattamenti: conv.trattamenti, montatura: conv.montatura, mesi: L.PREZZI.LISTINI.mesi, spedizione: L.PREZZI.LISTINI.spedizione}});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  { const so = await L.partnerSospeso(s); if (so) return L.send(res, 403, so); }
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
      if (risposta) try { await L.pushCliente(c.f, `SocialGlass: ${L.nm(c.f.Nome)}, l'ottica ha risposto alla tua segnalazione: ${risposta}`, "Risposta dall'ottica"); } catch(_){} }
    await L.registra("ottica " + s.id, "segnalazione risolta", x.univoco, risposta);
    return L.send(res, 200, {ok: true});
  }
  const u = await L.DB.utente("Univoco", String(b.univoco || "").toUpperCase().trim());
  if (u && u.f.Archiviato) return L.send(res, 410, {errore: "Pratica scaduta: il cliente non ha attivato l'abbonamento entro 30 giorni. Va registrato di nuovo (dal CAF o con «Nuovo cliente» in ottica)."});
  if (!u || !String(u.f.Ottica1 || "").startsWith(s.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i clienti della tua ottica."});
  L.registraEsito(res, "ottica " + s.id, {recesso: "recesso", ritirato: "occhiale restituito ritirato", pronto: "occhiale pronto", consegnato: "occhiale consegnato", arrivato: "occhiale arrivato in ottica", montaturaSpedita: "montatura spedita al laboratorio", preventivo: "preventivo inserito", riscatto: "riscatto", rifare: "occhiale da rifare", annulla: "ultimo passaggio annullato", ricetta: "ricetta corretta"}[b.azione] || b.azione || "preventivo inserito", u.f.Univoco, b.motivo ? String(b.motivo).slice(0, 200) : "");
  const ord = L.parseOrdine(u.f.Ordine);
  if (b.azione === "annulla"){ const r = await L.annullaUltimo(u); return L.send(res, r.errore ? 409 : 200, r); }
  if (["recesso", "ritirato", "pronto", "consegnato", "arrivato", "montaturaSpedita", "rifare", "ricetta"].includes(b.azione)){ const no = L.permesso(b.azione, "ottico", u.f); if (no) return L.send(res, 409, no); }
  if (L.ANNULLABILI.ottico.includes(b.azione) && !(b.azione === "pronto" && ord.lab)) L.segnaAnnullabile(b.azione, {arrivato: "occhiale arrivato in ottica", montaturaSpedita: "montatura spedita al laboratorio", pronto: "occhiale pronto"}[b.azione]);
  if (b.azione === "rifare"){ const r = await rifai(u, ord, b.motivo, "ottica " + s.id); return L.send(res, r.errore ? 409 : 200, r); }
  // correzione della ricetta finché il laboratorio non ha iniziato le lenti (stesse lenti: il prezzo non cambia)
  if (b.azione === "ricetta"){
    if (ord.lab && ord.lab.iniziato) return L.send(res, 409, {errore: "Il laboratorio ha già iniziato le lenti: la ricetta non si corregge più, segna «Da rifare»."});
    const ln = ord.lenti || {}, lr = leggiRicetta(b.ricetta, ln.id === "prog" || /progressiv|multifocal|ufficio|office/i.test(ln.nome || ""));
    if (lr.errore) return L.send(res, 400, lr);
    const ora = new Date().toISOString();
    ord.correzioniRicetta = (ord.correzioniRicetta || []).concat({il: ora, da: "ottica " + s.id, prima: ord.ricetta || null}).slice(-10);
    ord.ricetta = lr.ricetta; if (ord.lab) ord.lab.ricettaCorretta = ora; ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    try { await L.pushPartner("lab", "LAB", `L'ottica ${s.id} ha corretto la ricetta di ${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)} (${u.f.Univoco}): usa quella nuova e ristampa la busta.`, "Ricetta corretta", "laboratorio.html"); } catch(e){ console.error(e); }
    return L.send(res, 200, {ok: true, ricetta: ord.ricetta});
  }
  // montatura consegnata al corriere per il laboratorio
  if (b.azione === "montaturaSpedita"){
    const ora = new Date().toISOString(); ord.lab.spedita = ord.lab.spedita || ora; ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    try { await L.pushPartner("lab", "LAB", `L'ottica ${s.id} ha spedito la montatura ${(ord.montatura || {}).codice || ""} di ${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)} (${u.f.Univoco}).`, "Montatura in viaggio", "laboratorio.html"); } catch(e){ console.error(e); }
    return L.send(res, 200, {ok: true});
  }
  // occhiale arrivato in ottica dal laboratorio: solo adesso il cliente viene invitato al ritiro
  if (b.azione === "arrivato"){
    const ora = new Date().toISOString(), lab = ord.lab;
    lab.stato = "ARRIVATO"; lab.arrivato = ora; ord.prontoIl = ora; ord.avvisi = ord.avvisi || {}; ord.aggiornato = ora;
    // cliente moroso: l'occhiale resta in ottica e non lo invitiamo a ritirarlo finché non paga
    if (L.situazione(u.f).bloccato){
      lab.avvisoCliente = {il: ora, inviato: false, motivo: "cliente moroso: consegna bloccata"};
      await L.DB.aggiorna(u, {Stato: L.STATI.PRONTO, Ordine: JSON.stringify(ord)});
      return L.send(res, 200, {ok: true, avviso: {inviato: false, motivo: "cliente moroso: non avvisato finché non paga"}});
    }
    await L.DB.aggiorna(u, {Stato: L.STATI.PRONTO, Ordine: JSON.stringify(ord)});
    const av = await L.avvisaPronto(u), o2 = L.parseOrdine(u.f.Ordine);
    o2.lab.avvisoCliente = {il: ora, canale: av.canale, inviato: av.inviato, motivo: av.motivo};
    if (!av.inviato){ o2.avvisi = o2.avvisi || {}; o2.avvisi["arrivato" + ora.slice(0, 10)] = {il: ora, testo: `Occhiale arrivato: il cliente NON è stato avvisato in automatico, mandagli tu il messaggio.`, whatsapp: av.whatsapp}; }
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(o2)});
    return L.send(res, 200, {ok: true, avviso: av});
  }
  // consegna: controllo del codice del cliente (tessera o ultime 4 cifre)
  if (b.azione === "consegnato" && !L.codiceCliente(b.codice, u.f.Univoco))
    return L.send(res, 409, {errore: b.codice ? "Il codice non corrisponde: controlla la tessera del cliente o chiedigli le ultime 4 cifre del suo codice." : "Scansiona la tessera del cliente o scrivi le ultime 4 cifre del suo codice.", codice: true});
  // recesso entro 14 giorni dall'attivazione (diritto del consumatore): l'abbonamento si chiude subito
  if (b.azione === "recesso"){
    const pg = ord.pagamento;
    if (!pg || !pg.attivatoIl || pg.chiuso || Date.now() - new Date(pg.attivatoIl) > 14*864e5) return L.send(res, 409, {errore: "L'annullamento è possibile solo nei 14 giorni dall'attivazione."});
    if (L.inLavorazione(ord, u.f.Stato)) return L.send(res, 409, {errore: "Il laboratorio ha già iniziato le lenti su misura: l'annullamento non è più possibile."});
    if (L.CFG.stripeKey && pg.abbonamento){ try { await L.stripeApi("DELETE", `subscriptions/${pg.abbonamento}`); } catch(e){ console.error(e); return L.send(res, 502, {errore: "Stripe non risponde: riprova tra poco."}); } }
    const ora = new Date().toISOString();
    pg.chiuso = ora; pg.esito = "RECESSO PRIMA DELLA LAVORAZIONE: RIMBORSO TOTALE DA FARE DA STRIPE"; pg.rimborso = {daFare: ora};
    let mont = ""; try { mont = await L.montaturaDopoRecesso(ord, u.f.Univoco); } catch(e){ console.error(e); }
    if (ord.lab){ ord.lab.annullato = ora; if (mont) ord.lab.montaturaDopo = mont; }
    if (u.f.Stato === L.STATI.CONSEGNATO || u.f.Stato === L.STATI.PRONTO) ord.ritiro = {daRitirare: u.f.Stato === L.STATI.CONSEGNATO, dal: ora};
    ord.aggiornato = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    const av = await L.avvisa(u, `SocialGlass: ${L.nm(u.f.Nome)}, abbiamo registrato il recesso: l'abbonamento è chiuso e non ci saranno altri addebiti. Il rimborso arriva sul metodo di pagamento usato.${ord.ritiro && ord.ritiro.daRitirare ? " Riporta l'occhiale in ottica." : ""}`);
    return L.send(res, 200, {ok: true, avviso: av, montatura: mont});
  }
  if (b.azione === "ritirato"){
    if (!ord.ritiro || !ord.ritiro.daRitirare) return L.send(res, 409, {errore: "Non c'è un occhiale da ritirare."});
    // com'è l'occhiale che torna: se non è integro il caso va all'amministratore
    const cond = ["integro", "rovinato", "incompleto"].includes(b.condizione) ? b.condizione : "", nota = String(b.nota || "").trim().slice(0, 300);
    if (!cond) return L.send(res, 400, {errore: "Indica com'è l'occhiale: integro, rovinato o incompleto.", condizione: true});
    if (cond !== "integro" && nota.length < 3) return L.send(res, 400, {errore: "Scrivi cosa non va (es. lente rotta, manca un'asta).", condizione: true});
    const ora = new Date().toISOString();
    ord.ritiro.condizione = cond; if (nota) ord.ritiro.nota = nota;
    // occhiale vecchio di un rinnovo: l'abbonamento continua, non si chiude niente
    ord.ritiro.ritirato = ora; ord.aggiornato = ora;
    if (!ord.ritiro.rinnovo){ ord.pagamento = ord.pagamento || {}; ord.pagamento.esito = "OCCHIALE RESTITUITO"; }
    // ogni occhiale restituito viene rigenerato e donato a un'associazione benefica
    ord.dona = ord.dona || {}; if (!ord.dona.donato) ord.dona.daDonare = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    if (cond !== "integro") try { await L.registra("ottica " + s.id, "occhiale restituito " + cond, u.f.Univoco, nota); } catch(e){ console.error(e); }
    return L.send(res, 200, {ok: true, daDonare: !!(ord.dona && ord.dona.daDonare), rinnovo: !!ord.ritiro.rinnovo, chiuso: !!(ord.pagamento && ord.pagamento.chiuso), condizione: cond});
  }
  if (b.azione === "pronto" && ord.lab) return L.send(res, 409, {errore: "L'occhiale lo segue il laboratorio: quando arriva in ottica tocca «Occhiale arrivato»."});
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
  if (u.f.Stato === L.STATI.VERIFICA) return L.send(res, 409, L.permesso("preventivo", "ottico", u.f));
  if (![L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato) || !ord.montatura) return L.send(res, 409, {errore: "Il cliente deve prima scegliere la montatura con il QR."});
  // la ricetta è un dato sanitario: serve il consenso che il cliente dà dal suo link
  if (!(u.f.ConsensoSanitario && u.f.ConsensoSanitario.il)) return L.send(res, 409, {errore: "Manca il consenso del cliente per la ricetta. Fallo accettare al cliente dal suo link, anche sul tuo tablet: in alto trova la spunta «Acconsento»."});
  const lenteScelta = (L.PREZZI.conv(u.f.Listino || ((await L.DB.ottico(s.id)) || {}).Listino).lenti || {})[b.lente] || {};
  const lr = leggiRicetta(b.ricetta, b.lente === "prog" || /progressiv|multifocal|ufficio|office/i.test(lenteScelta.nome || ""));
  if (lr.errore) return L.send(res, 400, lr);
  const ricetta = lr.ricetta;
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
  const av = await L.avvisa(u, `SocialGlass: ${L.nm(u.f.Nome)}, ${ord.rinnovo && ord.rinnovo.prosegue ? "il preventivo del tuo occhiale nuovo è pronto" : "il tuo ottico ha preparato il preventivo"}: ${prev.rata.toFixed(2).replace(".", ",")} €/mese, durata minima ${prev.mesi} mesi. Apri il link, controlla il riepilogo e conferma: ${L.linkCliente(u.f.Univoco, s.id)}`);
  L.send(res, 200, {ok: true, prezzi: ord.prezzi, avviso: av});
});
