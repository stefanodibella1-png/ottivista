const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const iso = d => new Date(d).toISOString(), ora = Date.now();
L.demo.utenti.push({Univoco: "SGPAG23", Nome: "PROVA", Cognome: "PROVA", "Codice Fiscale": "RSSMRA80A01C351O", Cellulare: "3331234567", CAF: "CAF001", Ottica1: "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania", Listino: "A", Stato: L.STATI.PAGAMENTO, Creato: iso(ora - 2*864e5), LinkFino: iso(ora + 28*864e5),
  Ordine: JSON.stringify({prova: true, montatura: {codice: "SG-1042", modello: "Aurora", colore: "Nero", prezzo: 60}, lenti: {id: "mono", nome: "Monofocali", prezzo: 96}, trattamenti: [{nome: "Antiriflesso", prezzo: 24}], prezzi: {montatura: 60, totale: 180, mesi: 12, rata: 9.9, spedizione: 9.9, riscatto: 27}, ricetta: {}})});
require("./srv.js");
