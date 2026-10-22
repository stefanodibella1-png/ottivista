// Pagina personale del cliente (link ricevuto via SMS)
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  const uv = (url.searchParams.get("univoco") || "").trim(), esp = (url.searchParams.get("espositore") || "").trim();
  if (!uv) return L.send(res, 400, {errore: "Codice mancante"});
  let u, o;
  if (L.DEMO){
    u = L.demo.utenti.find(x => x.Univoco === uv); o = L.demo.ottici.find(x => x.ID === esp);
  } else {
    u = ((await L.find(L.CFG.baseMain, L.CFG.tUtenti, `{Univoco}="${L.q(uv)}"`, 1))[0] || {}).fields;
    if (esp) o = ((await L.find(L.CFG.baseMain, L.CFG.tOttici, `{ID}="${L.q(esp)}"`, 1))[0] || {}).fields;
  }
  if (!u) return L.send(res, 404, {errore: "Link non valido o scaduto."});
  L.send(res, 200, {nome: u.Nome, cognome: u.Cognome, stato: u.Stato || "",
    ottico: o ? {nome: o.Intestatario, indirizzo: o.Indirizzo || "", citta: o.Citta || ""} : null});
});
