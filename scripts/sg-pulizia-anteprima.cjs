// Sola lettura: quali clienti toglierebbe «Rimuovi i dati di prova» (stessa regola del pannello).
// Nel registro pubblico del workflow escono solo codici e stati, mai nomi o altri dati personali.
const L = require("../socialglass/api/_lib.js");
(async () => {
  if (L.MODO !== "firestore") throw new Error("Firestore non configurato");
  const tutti = await L.DB.tutti();
  const di = tutti.filter(u => L.PROVA.caf.includes(u.f.CAF) || L.PROVA.ottici.some(o => String(u.f.Ottica1 || "").startsWith(o + " ")));
  const righe = di.map(u => { const o = L.parseOrdine(u.f.Ordine), pg = L.pgVivo(o);
    return `${u.f.Univoco} · ${u.f.Stato || "-"} · ${o.prova ? "di prova" : "NON segnato di prova"} · ${pg.abbonamento || (pg.pagamenti || []).length ? "con abbonamento" : "senza abbonamento"}`; });
  console.log(`clienti totali ${tutti.length} · creati con accessi di prova ${di.length} · altri ${tutti.length - di.length}`);
  for (const r of righe) console.log("  " + r);
  console.log(`::notice title=Anteprima pulizia::${di.length} clienti con accessi di prova su ${tutti.length}: ${di.map(u => u.f.Univoco).join(", ")}`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
