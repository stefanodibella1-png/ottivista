// Stato del servizio e dati pubblici: titolare (privacy e condizioni) e modalità dei pagamenti
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  let t = {};
  if (L.MODO !== "airtable") try { t = (await L.DB.meta("titolare")) || {}; } catch(e){ console.error(e); }
  L.send(res, 200, {ok: true, demo: L.DEMO, db: L.MODO, stripe: !!L.CFG.stripeKey,
    pagamenti: /^(sk|rk)_live_/.test(L.CFG.stripeKey) ? "reali" : L.CFG.stripeKey ? "prova" : "simulati",
    titolare: {ragione: t.ragione || "", piva: t.piva || "", indirizzo: t.indirizzo || "", email: t.email || "", pec: t.pec || "", telefono: t.telefono || ""}});
});
