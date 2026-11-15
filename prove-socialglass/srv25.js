// srv24.js + laboratorio attivo, un ordine pagato senza busta e compensi del CAF001 (punti 5 e 6 nel pannello)
const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const iso = d => new Date(d).toISOString(), ora = Date.now();
L.demo.meta = L.demo.meta || {}; L.demo.meta.laboratorio = {attivo: true, password: "laboratorio1", nome: "Lab Prova"};
L.demo.utenti.push({Univoco: "SGBUSTA01", Nome: "SENZA", Cognome: "BUSTA", "Codice Fiscale": "XXX", CAF: "CAF001", Ottica1: "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania", Listino: "A", Stato: L.STATI.ATTIVO, Creato: iso(ora - 9*864e5),
  Ordine: JSON.stringify({montatura: {codice: "SG-1042", modello: "Aurora", colore: "Nero"}, prezzi: {rata: 10, mesi: 12}, pagamento: {stato: "ATTIVO", attivatoIl: iso(ora - 5*864e5)}})});
require("./srv24.js");
