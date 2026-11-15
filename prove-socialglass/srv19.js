// srv.js + tre clienti del CAF001: appena registrato, attivo con un avviso da mandare, moroso
const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const iso = d => new Date(d).toISOString(), ora = Date.now();
const base = (uv, nome, stato, o) => ({Univoco: uv, Nome: nome, Cognome: "PROVA", "Codice Fiscale": "PRVXXX80A01C351" + uv.slice(-1), Cellulare: "3331234567", CAF: "CAF001", Ottica1: "OTT07 - Ottica Demo Centro - Via Esempio 12, Catania", Listino: "A", Stato: stato, Creato: iso(ora - 40*864e5), Ordine: JSON.stringify(o)});
const pg = x => Object.assign({stato: "ATTIVO", abbonamento: "sub_x", attivatoIl: iso(ora - 30*864e5), ratePagate: 1}, x);
L.demo.utenti.push(
  base("SGCAF19A", "ANNA", L.STATI.REGISTRATO, {}),
  base("SGCAF19B", "BRUNO", L.STATI.PRONTO, {montatura: {modello: "Aurora", colore: "Nero"}, prezzi: {rata: 11.9, totale: 180, mesi: 12}, pagamento: pg({}), avvisi: {arrivato2026: {il: iso(ora - 864e5), testo: "SocialGlass: BRUNO, i tuoi occhiali sono arrivati in ottica.", whatsapp: "https://wa.me/393331234567?text=prova"}}}),
  base("SGCAF19C", "CARLA", L.STATI.CONSEGNATO, {montatura: {modello: "Aurora", colore: "Blu"}, prezzi: {rata: 11.9, totale: 180, mesi: 12}, consegnatoIl: iso(ora - 20*864e5), pagamento: pg({insoluto: {tipo: "canone", importo: 11.9, dal: iso(ora - 9*864e5)}})}));
require("./srv.js");
