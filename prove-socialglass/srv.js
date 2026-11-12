// server locale: file statici + api/* in modalità demo, con clienti di esempio
const http = require("http"), fs = require("fs"), path = require("path");
const ROOT = "/home/claude/ottivista/socialglass";
const L = require(ROOT + "/api/_lib.js");
const ora = Date.now(), iso = d => new Date(d).toISOString();
const ord = o => JSON.stringify(o);
const mont = {codice: "SG-1042", modello: "Aurora", colore: "Nero", calibro: "52-18", asse: "145", prezzo: 60};
const base = (uv, nome, cognome, cf, caf, ott, stato, o, extra) => Object.assign({Univoco: uv, Nome: nome, Cognome: cognome, "Codice Fiscale": cf, Cellulare: "3331234567", CAF: caf,
  Ottica1: ott === "OTT07" ? "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania" : "OTT12 - Ottica Demo Mare - Corso Prova 3, Acireale", Listino: "A", Stato: stato, Creato: iso(ora - 400*864e5), "Nato a": "CATANIA", "Data Nascita": "1974-12-27", Genere: "M", Ordine: ord(o)}, extra || {});
const prezzi = {montatura: 60, totale: 180, mesi: 12, rata: 9.9, spedizione: 9.9, riscatto: 27, modello: "abbonamento"};
const ric = {OD: {sf: -1.25, cil: -0.5, ax: 90, add: null}, OS: {sf: -1, cil: null, ax: null, add: null}, pd: 63, note: ""};
L.demo.utenti.push(
  base("SG8BA2115", "STEFANO", "DI BELLA", "DBLSFN74T27C351U", "CAF001", "OTT12", L.STATI.CONSEGNATO, {montatura: mont, lenti: {id: "mono", nome: "Monofocali", prezzo: 96}, trattamenti: [{id: "ar", nome: "Antiriflesso", prezzo: 24}], ricetta: ric, prezzi,
    pagamento: {stato: "ATTIVO", abbonamento: "sub_1", attivatoIl: iso(ora - 340*864e5), ratePagate: 11}, prontoIl: iso(ora - 330*864e5), consegnatoIl: iso(ora - 328*864e5)}),
  base("SG17897BE", "PROVA", "AUTOMATICA", "TMTPRV80A15C351C", "CAF001", "OTT07", L.STATI.PAGAMENTO, {montatura: mont, prezzi, ricetta: ric}),
  base("SGNUOVO01", "LUCIA", "BIANCHI", "BNCLCU85A41C351K", "CAF001", "OTT07", L.STATI.REGISTRATO, {}),
  base("SGNUOVO02", "ANNA", "VERDI", "VRDNNA85A41C351K", "CAF001", "OTT12", L.STATI.REGISTRATO, {}),
  base("SGMOROSO1", "MARIO", "ROSSI", "RSSMRA80A01C351X", "CAF001", "OTT07", L.STATI.CONSEGNATO, {montatura: mont, prezzi, ricetta: ric,
    pagamento: {stato: "ATTIVO", abbonamento: "sub_2", attivatoIl: iso(ora - 120*864e5), ratePagate: 3, insoluto: {tipo: "canone", dal: iso(ora - 5*864e5), importo: 9.9, tentativi: 2}}, consegnatoIl: iso(ora - 110*864e5)})
);
const TYPES = {".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".json": "application/json"};
http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  if (u.pathname.startsWith("/api/")){
    const f = path.join(ROOT, u.pathname.replace(/\/$/, "") + ".js");
    if (!fs.existsSync(f)){ res.statusCode = 404; return res.end("{}"); }
    return require(f)(req, res);
  }
  let p = path.join(ROOT, decodeURIComponent(u.pathname === "/laboratorio" ? "/laboratorio.html" : /^\/(caf|ottico|admin)$/.test(u.pathname) ? "/index.html" : u.pathname)); if (p.endsWith("/")) p += "index.html";
  fs.readFile(p, (e, d) => { if (e){ res.statusCode = 404; return res.end("not found"); } res.setHeader("Content-Type", TYPES[path.extname(p)] || "application/octet-stream"); res.end(d); });
}).listen(8823, () => console.log("ok 8823"));
