// Elenco dei propri clienti: per il CAF quelli registrati, per l'ottico quelli assegnati alla sua ottica
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req); if (!s) return L.send(res, 401, L.NOAUTH);
  const rows = await L.DB.utenti(s.ruolo === "caf" ? {caf: s.id} : {ottico: s.id});
  const list = rows.map(({f}) => {
    const o = L.parseOrdine(f.Ordine);
    return {univoco: f.Univoco, nome: f.Nome, cognome: f.Cognome, stato: f.Stato || "", cf: s.ruolo === "caf" ? f["Codice Fiscale"] : undefined,
      cellulare: f.Cellulare, montatura: o.montatura ? `${o.montatura.modello} ${o.montatura.colore}` : "", totale: o.prezzi ? o.prezzi.totale : null,
      rata: o.prezzi ? o.prezzi.rata : null, ratePagate: o.pagamento ? o.pagamento.ratePagate || 0 : 0, insoluto: !!(o.pagamento && o.pagamento.insoluto), finePeriodo: o.finePeriodo ? o.finePeriodo.descrizione : "", aggiornato: o.aggiornato || f.Creato || ""};
  }).sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)));
  L.send(res, 200, {clienti: list});
});
