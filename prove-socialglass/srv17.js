// srv.js + due clienti nel cambio occhiale con un canone del vecchio occhiale non pagato (modifica 17)
const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const iso = d => new Date(d).toISOString(), ora = Date.now();
const base = (uv, nome, stato, o) => ({Univoco: uv, Nome: nome, Cognome: "PROVA", "Codice Fiscale": "PRVXXX80A01C351X", Cellulare: "3331234567", CAF: "CAF001", Ottica1: "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania", Listino: "A", Stato: stato, Creato: iso(ora - 400*864e5), Ordine: JSON.stringify(o), Residenza: {cap: "95124", indirizzo: "Via Etnea 1", comune: "CATANIA", provincia: "CT"}});
const mont = {codice: "SG-1042", modello: "Aurora", colore: "Nero", calibro: "52-18", asse: "145", prezzo: 60};
const prezzi = {montatura: 60, totale: 180, mesi: 12, rata: 11.9, spedizione: 0, riscatto: 27, modello: "abbonamento"};
const rin = (ins, extra) => ({il: iso(ora - 10*864e5), da: "ottico OTT07", prosegue: Object.assign({abbonamento: "sub_x", cliente: "cus_x", ratePagate: 12, idPrecedenti: [], insoluto: ins}, extra || {})});
L.demo.utenti.push(
  base("SGRIN17P1", "GIULIA", L.STATI.PAGAMENTO, {storico: [{rata: 9.9}], montatura: mont, lenti: {id: "mono", nome: "Monofocali", prezzi: 96, prezzo: 96}, trattamenti: [], prezzi, ricetta: {}, rinnovo: rin({tipo: "canone", importo: 9.9, dal: iso(ora - 4*864e5), tentativi: 2, prossimoTentativo: iso(ora + 3*864e5), link: "https://invoice.stripe.com/i/prova", simulato: true})}),
  base("SGRIN17P2", "PAOLO", L.STATI.REGISTRATO, {storico: [{rata: 9.9}], rinnovo: rin({tipo: "canone", importo: 9.9, dal: iso(ora - 35*864e5), tentativi: 4}, {chiuso: iso(ora - 4*864e5), esito: "CHIUSO PER MANCATO PAGAMENTO: OCCHIALE DA RESTITUIRE"}), ritiro: {daRitirare: true, dal: iso(ora - 4*864e5)}})
);
require("./srv.js");
