// Clienti di prova per le funzioni "servizio": recensione, il mio anno, occhiale solidale, laboratorio, porta un amico.
// Azione: crea | elimina. Usano CAF001 / OTT07 (dati di prova): «Rimuovi dati di prova» nel pannello li cancella insieme a loro.
const L = require("../socialglass/api/_lib.js");
const azione = process.argv[2] || "crea";
const CODICI = ["SGPROVAREC", "SGPROVAANN", "SGPROVARIT", "SGPROVALAB", "SGPROVAVOT"];
const g = n => new Date(Date.now() - n * 864e5).toISOString();
function cfValido(base){ for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (L.CF.valido(base + c)) return base + c; throw new Error("CF non calcolabile " + base); }
function ordineBase(attivato, extra){
  return Object.assign({montatura: {codice: "SG-1042", modello: "Aurora", colore: "Nero", calibro: "52-18", asse: "145", prezzo: 60},
    lenti: {id: "mono", nome: "Monofocali", prezzo: 96}, trattamenti: [{id: "ar", nome: "Antiriflesso", prezzo: 24}],
    ricetta: {OD: {sf: -1.25, cil: -0.5, ax: 90, add: null}, OS: {sf: -1, cil: null, ax: null, add: null}, pd: 63, note: ""},
    prezzi: {montatura: 60, totale: 180, mesi: 12, rata: 9.9, spedizione: 9.9, riscatto: 27, modello: "abbonamento"},
    pagamento: {stato: "ATTIVO", attivatoIl: g(attivato), ratePagate: Math.max(1, Math.floor(attivato / 30)), ultimaRata: g(attivato % 30)},
    aggiornato: g(0), prova: true}, extra);
}
(async () => {
  if (L.MODO !== "firestore") throw new Error("Firestore non configurato");
  if (azione === "elimina"){ for (const uv of CODICI){ await L.DB.elimina("utenti", uv); console.log("eliminato", uv); } return; }
  const o = await L.DB.ottico("OTT07"); if (!o) throw new Error("Ottica di prova OTT07 non trovata");
  const ottica = `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`;
  const clienti = [
    // 1) consegnato 8 giorni fa: chiede la recensione, ha tessera, porta un amico, il mio anno
    {uv: "SGPROVAREC", nome: "LUCA", cognome: "RECENSIONE", cf: "RCNLCU80A01C351", gen: "M", nato: "1980-01-01", stato: L.STATI.CONSEGNATO,
      ord: ordineBase(25, {prontoIl: g(10), consegnatoIl: g(8)})},
    // 2) abbonato da quasi un anno, ha scelto di restituire: compare «Dono il mio occhiale»; ha già portato due amici
    {uv: "SGPROVAANN", nome: "GIULIA", cognome: "ANNO", cf: "NNAGLI82B41C351", gen: "F", nato: "1982-02-01", stato: L.STATI.CONSEGNATO,
      ord: ordineBase(345, {prontoIl: g(335), consegnatoIl: g(333), recensione: {voto: 5, testo: "Benissimo, comodissimi.", il: g(320)},
        finePeriodo: {scelta: "restituisci", descrizione: "Restituzione e chiusura", il: g(1)},
        amici: [{univoco: "SGFINTO001", nome: "MARCO", il: g(200), premio: 9.9, stato: "accreditato (prova)"}, {univoco: "SGFINTO002", nome: "ELENA", il: g(60), premio: 9.9, stato: "accreditato (prova)"}]})},
    // 3) abbonamento chiuso, occhiale da riconsegnare in ottica, cliente ha scelto di donarlo
    {uv: "SGPROVARIT", nome: "PAOLO", cognome: "RITIRO", cf: "RTRPLA75C10C351", gen: "M", nato: "1975-03-10", stato: L.STATI.CONSEGNATO,
      ord: ordineBase(372, {prontoIl: g(362), consegnatoIl: g(360), finePeriodo: {scelta: "restituisci", descrizione: "Restituzione e chiusura", il: g(20), eseguita: g(7)},
        ritiro: {daRitirare: true, dal: g(7)}, recensione: {voto: 4, testo: "", il: g(350)}, dona: {si: true, il: g(20)}})},
    // 4) abbonamento attivo, lavorazione da fare: il laboratorio lo porta fino a «pronto»
    {uv: "SGPROVALAB", nome: "SARA", cognome: "LABORATORIO", cf: "LBRSRA90D50C351", gen: "F", nato: "1990-04-10", stato: L.STATI.ATTIVO,
      ord: ordineBase(1, {lab: {stato: "DA FARE", fonte: "OTTICA", sede: "OTT07", creato: g(1)}})},
    // 5) recensione bassa non letta: compare in «Oggi» dell'amministratore
    {uv: "SGPROVAVOT", nome: "ANNA", cognome: "VOTO", cf: "VTONNA70E55C351", gen: "F", nato: "1970-05-15", stato: L.STATI.CONSEGNATO,
      ord: ordineBase(40, {prontoIl: g(25), consegnatoIl: g(22), recensione: {voto: 2, testo: "Le aste mi stringono un po' dietro le orecchie.", il: g(2)}})}
  ];
  const ritirata = clienti[2].ord; ritirata.pagamento.chiuso = g(7); ritirata.pagamento.esito = "CHIUSO: OCCHIALE DA RESTITUIRE";
  clienti[1].ord.storico = [];
  let n = 2;
  for (const c of clienti){
    await L.DB.salva("utenti", c.uv, {Univoco: c.uv, Creato: g(400), CAF: "CAF001", Nome: c.nome, Cognome: c.cognome, Cellulare: "33300000" + String(++n).padStart(2, "0"), Prefisso: "+39",
      "Codice Fiscale": cfValido(c.cf), Ottica1: ottica, "Nato a": "CATANIA", Genere: c.gen, "Data Nascita": c.nato, Listino: o.Listino || "", Stato: c.stato,
      Ordine: JSON.stringify(c.ord), Blocco: null});
    console.log("creato", c.uv, "→ https://socialglass.vercel.app/?Univoco=" + c.uv + "&espositore=OTT07");
  }
})().catch(e => { console.error(e.message); process.exit(1); });
