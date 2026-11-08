// Cliente moroso di prova per provare l'elenco Solleciti (azione: crea | elimina).
// Usa i dati di prova CAF001 / OTT07: «Rimuovi dati di prova» nel pannello lo cancella insieme a loro.
const L = require("../socialglass/api/_lib.js");
const UV = "SGPROVAMOR", azione = process.argv[2] || "crea";
(async () => {
  if (L.MODO !== "firestore") throw new Error("Firestore non configurato");
  if (azione === "elimina"){ await L.DB.elimina("utenti", UV); console.log("eliminato", UV); return; }
  const g = n => new Date(Date.now() - n * 864e5).toISOString();
  const o = await L.DB.ottico("OTT07"); if (!o) throw new Error("Ottica di prova OTT07 non trovata");
  const nome = "MARIA", cognome = "MOROSA", data = "1985-03-12";
  // codice fiscale fittizio ma formalmente valido (carattere di controllo calcolato)
  let cf = "MRSMRA85C52C351"; for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (L.CF.valido(cf + c)){ cf += c; break; }
  const dal = g(12), testo = `SocialGlass: ${nome}, il canone di 9,90 € non risulta pagato. Mancano 30 giorni alla chiusura dell'abbonamento: dopo, l'occhiale andrà restituito. Paga o cambia carta qui: ${L.linkCliente(UV, "OTT07", "CAF001", o.Listino || "")}`;
  const ordine = {montatura: {codice: "SG-1042", modello: "Aurora", colore: "Nero", calibro: "52-18", asse: "145", prezzo: 60},
    lenti: {id: "mono", nome: "Monofocali", prezzo: 96}, trattamenti: [{id: "ar", nome: "Antiriflesso", prezzo: 24}],
    ricetta: {OD: {sf: -1.25, cil: -0.5, ax: 90, add: null}, OS: {sf: -1, cil: null, ax: null, add: null}, pd: 63, note: ""},
    prezzi: {montatura: 60, totale: 180, mesi: 12, rata: 9.9, spedizione: 9.9, riscatto: 27, modello: "abbonamento"},
    pagamento: {stato: "ATTIVO", attivatoIl: g(100), ratePagate: 3, ultimaRata: g(42),
      insoluto: {tipo: "canone", dal, importo: 9.9, tentativi: 3, prossimoTentativo: null, link: "",
        messaggi: [{il: dal, passo: 30, giorni: 30, testo, canale: "whatsapp", inviato: false, motivo: "WhatsApp Business non collegato"}]}},
    prontoIl: g(93), consegnatoIl: g(90), aggiornato: dal, prova: true};
  await L.DB.salva("utenti", UV, {Univoco: UV, Creato: g(105), CAF: "CAF001", Nome: nome, Cognome: cognome, Cellulare: "3330000002", Prefisso: "+39", "Codice Fiscale": cf,
    Ottica1: `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`, "Nato a": "CATANIA", Genere: "F", "Data Nascita": data, Listino: o.Listino || "", Stato: L.STATI.CONSEGNATO,
    Ordine: JSON.stringify(ordine), Blocco: null});
  const u = await L.DB.utente("Univoco", UV), si = L.situazione(u.f);
  console.log("creato", UV, cf, "moroso:", si.moroso, "bloccato:", si.bloccato, "giorni alla chiusura:", L.giorniAllaChiusura(ordine.pagamento.insoluto));
})().catch(e => { console.error(e.message); process.exit(1); });
