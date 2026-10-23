// Elenco dei propri clienti: per il CAF quelli registrati, per l'ottico quelli assegnati alla sua ottica
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req); if (!s) return L.send(res, 401, L.NOAUTH);
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
  const rows = await L.DB.utenti(s.ruolo === "caf" ? {caf: s.id} : {ottico: s.id});
  const list = rows.map(({f}) => {
    const o = L.parseOrdine(f.Ordine);
    return {univoco: f.Univoco, nome: f.Nome, cognome: f.Cognome, stato: f.Stato || "", cf: s.ruolo === "caf" ? f["Codice Fiscale"] : undefined,
      cellulare: f.Cellulare, montatura: o.montatura ? `${o.montatura.modello} ${o.montatura.colore}` : "", totale: o.prezzi ? o.prezzi.totale : null,
      rata: o.prezzi ? o.prezzi.rata : null, ratePagate: o.pagamento ? o.pagamento.ratePagate || 0 : 0, insoluto: !!(o.pagamento && o.pagamento.insoluto), finePeriodo: o.finePeriodo ? o.finePeriodo.descrizione : "", aggiornato: o.aggiornato || f.Creato || "",
      periodo: L.PREZZI.periodo(o), rinnovabile: L.PREZZI.rinnovabile(o), daRitirare: !!(o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato),
      esito: o.pagamento && o.pagamento.esito || "", rinnovo: !!o.rinnovo,
      link: L.linkCliente(f.Univoco, String(f.Ottica1 || "").split(" - ")[0], f.CAF, f.Listino),
      recedibile: !!(o.pagamento && o.pagamento.attivatoIl && !o.pagamento.chiuso && !o.pagamento.rinnovato && Date.now() - new Date(o.pagamento.attivatoIl) <= 14*864e5),
      ritiroInRitardo: !!(o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato && Date.now() - new Date(o.ritiro.dal) > 15*864e5),
      avviso: (() => { const a = Object.values(o.avvisi || {}).filter(x => !x.inviato).sort((x, y) => String(y.il).localeCompare(String(x.il)))[0]; return a ? {testo: a.testo, whatsapp: a.whatsapp} : null; })()};
  }).sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)));
  L.send(res, 200, {clienti: list});
});
