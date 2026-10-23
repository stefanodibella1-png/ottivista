// Dati pubblici del servizio: titolare (per privacy e condizioni) e modalità dei pagamenti
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const t = L.MODO === "airtable" ? {} : ((await L.DB.meta("titolare")) || {});
  L.send(res, 200, {titolare: {ragione: t.ragione || "", piva: t.piva || "", indirizzo: t.indirizzo || "", email: t.email || "", pec: t.pec || "", telefono: t.telefono || ""},
    pagamenti: /^(sk|rk)_live_/.test(L.CFG.stripeKey) ? "reali" : L.CFG.stripeKey ? "prova" : "simulati"});
});
