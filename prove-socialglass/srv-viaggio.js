// copia di prova + «macchina del tempo»: sposta indietro le date di un cliente (solo per le prove locali)
require("./srv.js");
const http = require("http"), L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const indietro = (v, g) => v && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(new Date(v) - g * 864e5).toISOString() : v;
function sposta(x, g){ if (Array.isArray(x)) return x.map(y => sposta(y, g)); if (x && typeof x === "object"){ for (const k of Object.keys(x)) x[k] = typeof x[k] === "string" ? indietro(x[k], g) : sposta(x[k], g); } return x; }
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), uv = u.searchParams.get("u"), g = +u.searchParams.get("giorni");
  const c = await L.DB.utente("Univoco", uv); if (!c){ res.end("no"); return; }
  if (u.searchParams.get("insoluto")){   // canone non pagato da N giorni (come se Stripe avesse segnalato il mancato pagamento)
    const o = L.parseOrdine(c.f.Ordine), dal = new Date(Date.now() - +u.searchParams.get("insoluto") * 864e5).toISOString();
    o.pagamento.insoluto = {tipo: "canone", importo: 9.9, dal, link: "https://pagamento.esempio/fattura", tentativi: 1}; await L.DB.aggiorna(c, {Ordine: JSON.stringify(o)}); res.end("ok"); return; }
  const o = sposta(L.parseOrdine(c.f.Ordine), g);
  await L.DB.aggiorna(c, {Ordine: JSON.stringify(o), Creato: indietro(c.f.Creato, g)}); res.end("ok");
}).listen(8824);
