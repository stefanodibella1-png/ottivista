// srv.js + clienti per la verifica anagrafica del CAF: in corso, moroso, rinnovabile, non ancora rinnovabile
const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const iso = d => new Date(d).toISOString(), ora = Date.now();
const base = (uv, cf, nome, stato, o, caf) => ({Univoco: uv, Nome: nome, Cognome: "PROVA", "Codice Fiscale": cf, Cellulare: "3331234567", CAF: caf || "CAF001", Ottica1: "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania", Listino: "A", Stato: stato, Creato: iso(ora - 400*864e5), Ordine: JSON.stringify(o)});
const pr = {rata: 11.9, totale: 180, mesi: 12, spedizione: 5};
const pg = (giorni, x) => Object.assign({stato: "ATTIVO", abbonamento: "sub_x", attivatoIl: iso(ora - giorni*864e5), ratePagate: Math.floor(giorni / 30)}, x);
L.demo.utenti.push(
  base("SGV20A", "RSSMRA80A01C351O", "MARIO", L.STATI.ATTIVO, {montatura: {modello: "A"}, prezzi: pr, pagamento: pg(5)}),
  base("SGV20B", "BNCLGU75B12C351C", "LUIGI", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 90*864e5), pagamento: pg(100, {insoluto: {tipo: "canone", importo: 11.9, dal: iso(ora - 8*864e5)}})}),
  base("SGV20C", "VRDNNA90C41C351H", "ANNA", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 350*864e5), pagamento: pg(360)}, "CAF009"),
  base("SGV20D", "NREPLA85D15C351U", "PAOLA", L.STATI.CONSEGNATO, {montatura: {modello: "A"}, prezzi: pr, consegnatoIl: iso(ora - 100*864e5), pagamento: pg(110)}));
require("./srv.js");
