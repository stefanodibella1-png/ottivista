// A fine periodo il cliente sceglie: nuovo occhiale, tenere l'occhiale (riscatto) o restituirlo
const L = require("./_lib");
const SCELTE = {rinnova: "Rinnovo con occhiale nuovo", riscatta: "Riscatto: tiene l'occhiale", restituisci: "Restituzione e chiusura"};
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const b = await L.readBody(req);
  if (!SCELTE[b.scelta]) return L.send(res, 400, {errore: "Scelta non valida"});
  const u = await L.DB.utente("Univoco", String(b.univoco || "").trim());
  if (!u) return L.send(res, 404, {errore: "Cliente non trovato."});
  const ord = L.parseOrdine(u.f.Ordine);
  if (![L.STATI.ATTIVO, L.STATI.PRONTO, L.STATI.CONSEGNATO].includes(u.f.Stato)) return L.send(res, 409, {errore: "L'abbonamento non è attivo."});
  if (ord.finePeriodo && ord.finePeriodo.eseguita) return L.send(res, 409, {errore: "La scelta è già stata eseguita."});
  const ora = new Date().toISOString();
  ord.finePeriodo = {scelta: b.scelta, descrizione: SCELTE[b.scelta], il: ora};
  ord.aggiornato = ora;
  // a durata minima già finita la scelta si esegue subito
  const p = L.PREZZI.periodo(ord, ora);
  if (p && p.scaduto && !p.chiuso){
    const r = await require("./scadenze").esegui(u, ord, p, ora);
    if (r !== "rinnovato") await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
    return L.send(res, 200, {ok: true, descrizione: SCELTE[b.scelta], eseguita: r});
  }
  await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  L.send(res, 200, {ok: true, descrizione: SCELTE[b.scelta], valeDal: p ? p.scadenza : null});
});
