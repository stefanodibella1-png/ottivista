// Stato del servizio e dati pubblici: titolare (privacy e condizioni) e modalità dei pagamenti
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  let t = {};
  if (L.MODO !== "airtable") try { t = (await L.DB.meta("titolare")) || {}; } catch(e){ console.error(e); }
  // stato del controllo notturno per l'allarme del mattino (solo numeri, nessun dato dei clienti)
  let notte = null, copia = null;
  if (L.MODO !== "airtable") try { const n = (await L.DB.meta("notte")) || {}, b = (await L.DB.meta("backup-esterno")) || {};
    notte = {giorno: n.giorno || "", fatto: !!n.fatto, fine: n.fine || "", controllati: n.controllati || 0, errori: (n.errori || []).length, lotti: n.lotti || 0};
    copia = {il: b.il || "", stato: b.stato || ""}; } catch(e){ console.error(e); }
  L.send(res, 200, {ok: true, notte, copiaEsterna: copia, demo: L.DEMO, db: L.MODO, stripe: !!L.CFG.stripeKey,
    pagamenti: /^(sk|rk)_live_/.test(L.CFG.stripeKey) ? "reali" : L.CFG.stripeKey ? "prova" : "simulati",
    titolare: {ragione: t.ragione || "", piva: t.piva || "", indirizzo: t.indirizzo || "", email: t.email || "", pec: t.pec || "", telefono: t.telefono || ""}});
});
