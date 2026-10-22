// Verifica della montatura dal QR dell'espositore e registrazione della scelta del cliente
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET"){
    const codice = (url.searchParams.get("codice") || "").trim();
    if (!codice) return L.send(res, 400, {errore: "Codice mancante"});
    const m = await L.DB.montatura(codice);
    if (!m || String(m.f.Stato || "").toUpperCase() !== "DISPONIBILE") return L.send(res, 200, {disponibile: false});
    return L.send(res, 200, {disponibile: true, codice, modello: m.f.Modello || "", colore: m.f.Colore || "", calibro: m.f.Calibro || "", asse: m.f.Asse || ""});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const {univoco, codice} = await L.readBody(req);
  if (!univoco || !codice) return L.send(res, 400, {errore: "Dati mancanti"});
  const u = await L.DB.utente("Univoco", String(univoco));
  if (!u) return L.send(res, 404, {errore: "Cliente non trovato"});
  if (![L.STATI.REGISTRATO, L.STATI.MONTATURA].includes(u.f.Stato)) return L.send(res, 409, {errore: "La montatura è già confermata: per cambiarla parla con l'ottico."});
  const m = await L.DB.montatura(String(codice));
  if (!m || String(m.f.Stato || "").toUpperCase() !== "DISPONIBILE") return L.send(res, 409, {errore: "Montatura non più disponibile."});
  const ord = L.parseOrdine(u.f.Ordine);
  // se aveva già scelto un'altra montatura, la rimette a disposizione
  if (ord.montatura && ord.montatura.codice !== m.f.Codice){
    const prima = await L.DB.montatura(ord.montatura.codice); if (prima) await L.DB.aggiornaMontatura(prima, {Stato: "DISPONIBILE"});
  }
  ord.montatura = {codice: m.f.Codice || String(codice), modello: m.f.Modello || "", colore: m.f.Colore || "", calibro: m.f.Calibro || "", asse: m.f.Asse || "", prezzo: Number(m.f.Prezzo) || null};
  ord.aggiornato = new Date().toISOString();
  await L.DB.aggiornaMontatura(m, {Stato: "RISERVATA"});
  await L.DB.aggiorna(u, {Stato: L.STATI.MONTATURA, Ordine: JSON.stringify(ord)});
  L.send(res, 200, {ok: true, descrizione: `${ord.montatura.modello} ${ord.montatura.colore} ${ord.montatura.calibro}-${ord.montatura.asse}`});
});
