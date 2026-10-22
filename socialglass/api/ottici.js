// Elenco ottiche convenzionate (solo per il CAF collegato)
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  if (!L.verify(req, "caf")) return L.send(res, 401, {errore: "Sessione scaduta: accedi di nuovo."});
  const rows = L.DEMO ? L.demo.ottici : (await L.find(L.CFG.baseMain, L.CFG.tOttici, "", 0)).map(r => r.fields);
  const list = rows.filter(f => f.ID).sort((a, b) => parseInt(a.ID.replace(/\D/g, "") || 0) - parseInt(b.ID.replace(/\D/g, "") || 0))
    .map(f => ({id: f.ID, label: `${f.ID} - ${f.Intestatario || ""} - ${f.Indirizzo || ""}${f.Citta || ""}`, listino: f.Listino || ""}));
  L.send(res, 200, {ottici: list});
});
