// Prova generale: aiuti che lavorano direttamente sul database (solo sui clienti di prova passati per codice).
// Comandi: leggi UV | sposta UV GIORNI | controlla UV | riserve UV1,UV2,...
const L = require("../socialglass/api/_lib.js");
const [cmd, uv, arg] = process.argv.slice(2);
const indietro = (v, g) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(new Date(v) - g * 864e5).toISOString() : v;
const sposta = (x, g) => Array.isArray(x) ? x.map(y => sposta(y, g)) : x && typeof x === "object" ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, typeof v === "string" ? indietro(v, g) : sposta(v, g)])) : x;
(async () => {
  if (L.MODO !== "firestore") throw new Error("Firestore non configurato");
  if (cmd === "riserve"){
    const lista = new Set(String(uv).split(",")); let n = 0;
    for (const m of await L.DB.lista("mont")) await L.DB.tx("mont", m.Codice || m._id, f => { const {g, r} = L.scorte(f); const r2 = r.filter(x => !lista.has(x.univoco)); if (r2.length === r.length) return null; n += r.length - r2.length; return L.campiScorte(f, g, r2, {tipo: "prenotazioni della prova generale tolte", qta: 0, dove: ""}); });
    console.log(JSON.stringify({tolte: n})); return;
  }
  const u = await L.DB.utente("Univoco", uv); if (!u) throw new Error("cliente non trovato " + uv);
  if (!/^PROVA GENERALE$/.test(`${u.f.Cognome}`) && u.f.Cognome !== "PROVA") throw new Error("non è un cliente di prova: " + uv);
  if (cmd === "leggi"){ console.log(JSON.stringify({stato: u.f.Stato, ordine: L.parseOrdine(u.f.Ordine)})); return; }
  if (cmd === "sposta"){ const g = Number(arg); await L.DB.aggiorna(u, {Ordine: JSON.stringify(sposta(L.parseOrdine(u.f.Ordine), g)), Creato: indietro(u.f.Creato, g)}); console.log(JSON.stringify({ok: true})); return; }
  if (cmd === "controlla"){ const esiti = []; await require("../socialglass/api/scadenze.js").controlla(u, new Date().toISOString(), esiti); console.log(JSON.stringify({esiti})); return; }
  throw new Error("comando sconosciuto");
})().then(() => process.exit(0), e => { console.error(e.message); process.exit(1); });
