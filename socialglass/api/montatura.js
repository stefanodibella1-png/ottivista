// Verifica della montatura dal QR dell'espositore e registrazione della scelta
const L = require("./_lib");
async function getMont(codice){
  if (L.DEMO){ const m = L.demo.montature.find(x => x.Codice === codice); return m ? {id: m.Codice, f: m} : null; }
  const r = (await L.find(L.CFG.baseMont, L.CFG.tMont, `{Codice}="${L.q(codice)}"`, 1))[0];
  return r ? {id: r.id, f: r.fields} : null;
}
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET"){
    const codice = (url.searchParams.get("codice") || "").trim();
    if (!codice) return L.send(res, 400, {errore: "Codice mancante"});
    const m = await getMont(codice);
    if (!m || String(m.f.Stato || "").toUpperCase() !== "DISPONIBILE") return L.send(res, 200, {disponibile: false});
    return L.send(res, 200, {disponibile: true, codice, modello: m.f.Modello || "", colore: m.f.Colore || "", calibro: m.f.Calibro || "", asse: m.f.Asse || ""});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const {univoco, codice} = await L.readBody(req);
  if (!univoco || !codice) return L.send(res, 400, {errore: "Dati mancanti"});
  const m = await getMont(String(codice));
  if (!m || String(m.f.Stato || "").toUpperCase() !== "DISPONIBILE") return L.send(res, 409, {errore: "Montatura non più disponibile."});
  const descr = `${m.f.Modello || ""} ${m.f.Colore || ""} ${m.f.Calibro || ""}-${m.f.Asse || ""}`.trim();
  if (L.DEMO){
    const u = L.demo.utenti.find(x => x.Univoco === univoco); if (!u) return L.send(res, 404, {errore: "Cliente non trovato"});
    m.f.Stato = "RISERVATA"; u.Stato = "MONTATURA SCELTA"; u.Montatura = `${codice} ${descr}`;
  } else {
    const ur = (await L.find(L.CFG.baseMain, L.CFG.tUtenti, `{Univoco}="${L.q(univoco)}"`, 1))[0];
    if (!ur) return L.send(res, 404, {errore: "Cliente non trovato"});
    await L.at(L.CFG.baseMont, L.CFG.tMont, {method: "PATCH", id: m.id, body: {fields: {Stato: "RISERVATA"}, typecast: true}});
    await L.at(L.CFG.baseMain, L.CFG.tUtenti, {method: "PATCH", id: ur.id, body: {fields: {Stato: "MONTATURA SCELTA", Montatura: `${codice} ${descr}`}, typecast: true}});
  }
  L.send(res, 200, {ok: true, descrizione: descr});
});
