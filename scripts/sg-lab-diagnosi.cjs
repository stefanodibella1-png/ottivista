// Sola lettura: stato delle buste del laboratorio (codice, stato ordine, stato lavorazione, pagamento)
const L = require("../socialglass/api/_lib.js");
(async () => {
  const lab = (await L.DB.meta("laboratorio")) || {};
  console.log("laboratorio attivo:", !!lab.attivo, "password:", !!lab.password);
  for (const {f} of await L.DB.tutti()){
    const o = L.parseOrdine(f.Ordine), pg = o.pagamento || {};
    console.log([f.Univoco, f.Stato, o.lab ? JSON.stringify(o.lab) : "nessuna busta", "pagamento:" + (pg.stato || "-"), pg.chiuso ? "CHIUSO " + (pg.esito || "") : ""].join(" | "));
  }
})().catch(e => { console.error(e.message); process.exit(1); });
