// Elenco ottiche convenzionate (solo per il CAF collegato)
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  if (!L.verify(req, "caf")) return L.send(res, 401, L.NOAUTH);
  const list = (await L.DB.ottici()).filter(f => f.ID).sort((a, b) => parseInt(String(a.ID).replace(/\D/g, "") || 0) - parseInt(String(b.ID).replace(/\D/g, "") || 0))
    .map(f => ({id: f.ID, label: `${f.ID} - ${f.Intestatario || ""} - ${f.Indirizzo || ""}${f.Citta || ""}`, listino: f.Listino || ""}));
  L.send(res, 200, {ottici: list});
});
