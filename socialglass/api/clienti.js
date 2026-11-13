// Elenco dei propri clienti: per il CAF quelli registrati, per l'ottico quelli assegnati alla sua ottica
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req); if (!s) return L.send(res, 401, L.NOAUTH);
  // laboratorio: buste di lavoro (solo i dati che servono per montare: niente codice fiscale né telefono del cliente)
  if (s.ruolo === "lab"){
    if (req.method !== "GET") return L.send(res, 405, {errore: "Metodo non consentito"});
    const [tutti, ottici] = await Promise.all([L.DB.tutti(), L.DB.lista("ottici")]);
    // ordini già pagati prima che il laboratorio fosse attivo: diventano buste (la montatura è quella esposta in ottica)
    for (const u of tutti){
      const o = L.parseOrdine(u.f.Ordine);
      if (u.f.Stato === L.STATI.ATTIVO && !o.lab && o.pagamento && !o.pagamento.chiuso){
        o.lab = {stato: "DA FARE", fonte: "OTTICA", sede: String(u.f.Ottica1 || "").split(" - ")[0], creato: o.pagamento.attivatoIl || new Date().toISOString(), precedente: true};
        try { await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)}); } catch(e){ console.error(e); }
      }
    }
    const buste = tutti.map(({f}) => ({f, o: L.parseOrdine(f.Ordine)})).filter(x => x.o.lab).map(({f, o}) => {
      const oid = String(f.Ottica1 || "").split(" - ")[0], ot = ottici.find(x => (x.ID || x._id) === oid) || {};
      return {univoco: f.Univoco, nome: f.Nome || "", cognome: f.Cognome || "", stato: f.Stato || "", inLavorazione: f.Stato === L.STATI.ATTIVO, lab: o.lab, montatura: o.montatura || null, lenti: o.lenti || null,
        trattamenti: (o.trattamenti || []).map(t => t.nome), ricetta: o.ricetta || null, consegnatoIl: o.consegnatoIl || "", chiuso: !!(o.pagamento && o.pagamento.chiuso),
        ottica: {id: oid, nome: ot.Intestatario || "", indirizzo: `${ot.Indirizzo || ""}${ot.Citta || ""}`, telefono: ot.Telefono || ""}};
    }).sort((a, b) => String(a.lab.creato).localeCompare(String(b.lab.creato)));
    const lb = (await L.DB.meta("laboratorio")) || {};
    return L.send(res, 200, {buste, laboratorio: {nome: lb.nome || "Laboratorio"}});
  }
  if (!["caf", "ottico"].includes(s.ruolo)) return L.send(res, 401, L.NOAUTH);
  // segna come inviato su WhatsApp l'ultimo avviso automatico
  if (req.method === "POST"){
    const b = await L.readBody(req);
    const u = await L.DB.utente("Univoco", String(b.univoco || ""));
    const mio = u && (s.ruolo === "caf" ? u.f.CAF === s.id : String(u.f.Ottica1 || "").startsWith(s.id + " "));
    if (!mio) return L.send(res, 404, {errore: "Cliente non trovato."});
    const o = L.parseOrdine(u.f.Ordine); Object.values(o.avvisi || {}).forEach(a => { if (!a.inviato) a.inviato = new Date().toISOString(); });
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
    return L.send(res, 200, {ok: true});
  }
  const rows = (await L.DB.utenti(s.ruolo === "caf" ? {caf: s.id} : {ottico: s.id})).filter(r => !r.f.Archiviato);
  for (const r of rows) if (r.f.Stato === L.STATI.PAGAMENTO) await L.verificaPagamento(r);
  const isOtt = s.ruolo === "ottico";
  const list = rows.map(({f}) => {
    const o = L.parseOrdine(f.Ordine), pg = o.pagamento || {}, m = o.montatura;
    // l'ottico vede anche i dati tecnici dell'occhiale e la ricetta; il CAF no (dati sanitari)
    const tecnico = isOtt ? {montaturaCodice: m ? m.codice : "", calibro: m ? `${m.calibro || ""}${m.asse ? "-" + m.asse : ""}` : "",
      lenti: o.lenti ? o.lenti.nome : "", trattamenti: (o.trattamenti || []).map(t => t.nome), ricetta: o.ricetta || null, riscatto: o.prezzi ? o.prezzi.riscatto : null, prontoIl: o.prontoIl || ""} : {};
    return Object.assign({univoco: f.Univoco, nome: f.Nome, cognome: f.Cognome, stato: f.Stato || "", scadeLink: L.scadenzaLink(f), cf: s.ruolo === "caf" ? f["Codice Fiscale"] : undefined,
      bloccato: L.situazione(f).bloccato, dona: !!(o.dona && o.dona.si && !o.dona.donato), voto: o.recensione ? o.recensione.voto : 0, lab: o.lab ? {stato: o.lab.stato, fonte: o.lab.fonte, ritirata: o.lab.ritirata || "", pronto: o.lab.pronto || "", richiesta: o.lab.richiesta || ""} : null, consegnatoIl: o.consegnatoIl || "", creato: f.Creato || "", attivatoIl: pg.attivatoIl || "", chiuso: pg.chiuso || "",
      ottica: String(f.Ottica1 || "").split(" - ").slice(0, 2).join(" - "), caf: f.CAF || "",
      cellulare: f.Cellulare, montatura: o.montatura ? `${o.montatura.modello} ${o.montatura.colore}` : "", totale: o.prezzi ? o.prezzi.totale : null,
      rata: o.prezzi ? o.prezzi.rata : null, ratePagate: o.pagamento ? o.pagamento.ratePagate || 0 : 0, finePeriodo: o.finePeriodo ? o.finePeriodo.descrizione : "", aggiornato: o.aggiornato || f.Creato || "",
      periodo: L.PREZZI.periodo(o), rinnovabile: L.PREZZI.rinnovabile(o), daRitirare: !!(o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato),
      esito: o.pagamento && o.pagamento.esito || "", rinnovo: !!o.rinnovo,
      link: L.linkCliente(f.Univoco, String(f.Ottica1 || "").split(" - ")[0], f.CAF, f.Listino),
      recedibile: L.annullabile(o, f.Stato),
      ritiroInRitardo: !!(o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato && Date.now() - new Date(o.ritiro.dal) > 15*864e5),
      avviso: (() => { const a = Object.entries(o.avvisi || {}).filter(([k, x]) => !x.inviato && !/^insoluto/.test(k)).map(([, x]) => x).sort((x, y) => String(y.il).localeCompare(String(x.il)))[0]; return a ? {testo: a.testo, whatsapp: a.whatsapp} : null; })()}, tecnico);
  }).sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)));
  // conteggi economici con SocialGlass secondo l'accordo impostato dall'amministratore
  let acc = null; try { acc = isOtt ? await L.DB.ottico(s.id) : await L.DB.login("caf", s.id); } catch(e){ console.error(e); }
  const q = new URL(req.url, "http://x").searchParams, gg = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
  // solo i propri conteggi (compensi secondo l'accordo e pagamenti ricevuti): gli incassi di SocialGlass non si mostrano
  // l'ottico vede anche le montature esposte nella sua ottica
  let esposte; if (isOtt) try { esposte = (await L.DB.lista("mont")).filter(m => !m.Eliminata).map(m => { const {g, r} = L.scorte(m);
    return {codice: m.Codice || m._id, modello: m.Modello || "", colore: m.Colore || "", calibro: m.Calibro || "", asse: m.Asse || "", qta: g[s.id] || 0, prenotate: r.filter(x => x.ottica === s.id).length}; })
    .filter(m => m.qta || m.prenotate).sort((a, b) => a.codice.localeCompare(b.codice)); } catch(e){ console.error(e); }
  // ottica: appuntamenti dei clienti, orari prenotabili e segnalazioni ancora aperte
  let appuntamenti, orari, segnalazioni;
  if (isOtt) try {
    const ag = (await L.DB.meta("agenda-" + s.id)) || {}, oggi = L.oraRoma().slice(0, 10);
    appuntamenti = Object.entries(ag).filter(([k, v]) => v && k >= oggi).map(([k, v]) => ({il: k, univoco: v.u, nome: v.n, tipo: L.TIPI_APP[v.t] || ""})).sort((a, b) => a.il.localeCompare(b.il));
    orari = L.orariDi(acc);
    segnalazioni = (await L.DB.lista("segn")).filter(x => x.ottica === s.id && x.stato === "aperta").map(x => ({id: x.ID || x._id, il: x.il, univoco: x.univoco, nome: x.nome, cellulare: x.cellulare, testo: x.testo, foto: x.foto || ""}))
      .sort((a, b) => String(b.il).localeCompare(String(a.il)));
  } catch(e){ console.error(e); }
  // listini aggiornati: l'ottica vede il suo, il CAF tutti (per il calcolatore del canone)
  const conv = await L.caricaListini(), mioLis = isOtt ? String((acc && acc.Listino) || "A").toUpperCase() : "";
  const listini = isOtt ? {[mioLis]: conv[mioLis] || conv.A} : conv;
  const lb = isOtt ? (await L.DB.meta("laboratorio")) || {} : {};
  L.send(res, 200, {laboratorio: isOtt ? {nome: lb.nome || "Laboratorio", indirizzo: lb.indirizzo || "", telefono: lb.telefono || ""} : undefined, clienti: list, esposte, appuntamenti, orari, segnalazioni, listini, estratto: L.estratto(rows.map(r => r.f), acc, gg(q.get("da")), gg(q.get("a")), isOtt ? "ottica" : "caf")});
});
