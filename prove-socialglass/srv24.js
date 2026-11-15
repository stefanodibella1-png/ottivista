// srv.js + secondo CAF (CAF002/demo2) e clienti per privacy tra CAF, cambio CAF e compensi per occhiale
const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const iso = d => new Date(d).toISOString(), ora = Date.now();
L.demo.caf.push({ID: "CAF002", Password: "demo2", Nome: "CAF Due"});
const pr = {rata: 10, totale: 180, mesi: 12, spedizione: 5};
const base = (uv, cf, nome, stato, o, caf, ott) => ({Univoco: uv, Nome: nome, Cognome: "PROVA", "Codice Fiscale": cf, Cellulare: "3331234567", CAF: caf, "Data Nascita": "1980-01-01",
  Ottica1: (ott || "OTT07") === "OTT07" ? "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania" : "OTT12 - Ottica Demo Mare - Corso Prova 3, Acireale", Listino: "A", Stato: stato, Creato: iso(ora - 400*864e5), Ordine: JSON.stringify(o)});
const pg = (giorni, x) => Object.assign({stato: "ATTIVO", abbonamento: "sub_x", attivatoIl: iso(ora - giorni*864e5), ratePagate: 11, pagamenti: []}, x);
// rinnovabile (consegnato 350 giorni fa), di CAF001 e OTT07
L.demo.utenti.push(base("SGP24A001", "RSSMRA80A01C351O", "MARIO", L.STATI.CONSEGNATO, {montatura: {modello: "A", codice: "SG-1042"}, prezzi: pr, consegnatoIl: iso(ora - 350*864e5), pagamento: pg(360)}, "CAF001", "OTT07"),
  // in corso, di CAF001
  base("SGP24B002", "BNCLGU75B12C351C", "LUIGI", L.STATI.ATTIVO, {montatura: {modello: "A"}, prezzi: pr, pagamento: pg(5)}, "CAF001", "OTT07"),
  // di CAF002, rinnovabile
  base("SGP24C003", "VRDNNA90C41C351H", "ANNA", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 350*864e5), pagamento: pg(360)}, "CAF002", "OTT12"));
require("./srv.js");
