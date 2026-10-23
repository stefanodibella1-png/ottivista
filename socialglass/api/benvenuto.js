// Pagina personale del cliente (link ricevuto via SMS o WhatsApp)
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const uv = (url.searchParams.get("univoco") || "").trim();
  if (!uv) return L.send(res, 400, {errore: "Codice mancante"});
  const u = await L.DB.utente("Univoco", uv);
  if (!u) return L.send(res, 404, {errore: "Link non valido o scaduto."});
  await L.verificaPagamento(u);
  const idOtt = String(u.f.Ottica1 || "").split(" - ")[0] || url.searchParams.get("espositore");
  const o = await L.DB.ottico(idOtt);
  const ord = L.parseOrdine(u.f.Ordine);
  L.send(res, 200, {nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato || "",
    ottico: o ? {id: o.ID, nome: o.Intestatario, indirizzo: o.Indirizzo || "", citta: o.Citta || "", telefono: o.Telefono || ""} : null,
    ordine: {montatura: ord.montatura || null, lenti: ord.lenti || null, trattamenti: ord.trattamenti || [], prezzi: ord.prezzi || null,
      finePeriodo: ord.finePeriodo || null, periodo: L.PREZZI.periodo(ord), rinnovo: ord.rinnovo ? {prosegue: !!(ord.rinnovo.prosegue)} : null,
      ritiro: ord.ritiro || null, storico: (ord.storico || []).length,
      pagamento: ord.pagamento ? {stato: ord.pagamento.stato, attivatoIl: ord.pagamento.attivatoIl, ratePagate: ord.pagamento.ratePagate || 0, insoluto: ord.pagamento.insoluto || null, esito: ord.pagamento.esito || null, chiuso: ord.pagamento.chiuso || null} : null}});
});
