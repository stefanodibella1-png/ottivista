// punti 1-3: privacy tra CAF, cambio CAF/ottica con consenso, compensi per occhiale (API, server srv24.js)
const B = "http://localhost:8823", ok = (c, m) => { console.log((c ? "OK  " : "NO  ") + m); if (!c) process.exitCode = 1; };
const j = async (p, o = {}) => { const r = await fetch(B + p, o); let d = {}; try { d = await r.json(); } catch(e){} return {s: r.status, d}; };
const tok = async (ruolo, codice, password) => (await j("/api/login", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({ruolo, codice, password})})).d.token;
const H = t => ({Authorization: "Bearer " + t, "Content-Type": "application/json"});
(async () => {
  const c1 = await tok("caf", "CAF001", "demo"), c2 = await tok("caf", "CAF002", "demo2"), o7 = await tok("ottico", "OTT07", "demo"), o12 = await tok("ottico", "OTT12", "demo");
  ok(c1 && c2 && o7 && o12, "accessi");
  // 1. privacy
  let r = await j("/api/utenti?cf=RSSMRA80A01C351O", {headers: H(c1)}); ok(r.d.nome && r.d.univoco === "SGP24A001", "CAF001 vede il suo cliente");
  r = await j("/api/utenti?cf=RSSMRA80A01C351O", {headers: H(c2)}); console.log("    CAF002:", JSON.stringify(r.d));
  ok(r.d.altroCaf && r.d.cafNome === "CAF Demo" && !r.d.nome && !r.d.univoco && r.d.moroso === undefined && r.d.attivatoIl === undefined && r.d.scadenza === undefined && r.d.rinnovabile === true, "CAF002: solo «già registrato presso CAF Demo», niente dati");
  r = await j("/api/utenti?cf=BNCLGU75B12C351C", {headers: H(c2)}); ok(r.d.altroCaf && r.d.inCorso && !r.d.rinnovabile, "CAF002: pratica in corso, nessun dato");
  r = await j("/api/utenti?univoco=SGP24C003", {headers: H(o7)}); ok(!r.d.trovato, "OTT07 non trova per codice un cliente di OTT12");
  r = await j("/api/utenti?univoco=SGP24A001", {headers: H(o7)}); ok(r.d.trovato, "OTT07 trova il suo cliente");
  r = await j("/api/utenti", {method: "POST", headers: H(c2), body: JSON.stringify({cf: "RSSMRA80A01C351O", nome: "MARIO", cognome: "ROSSI", cellulare: "3330000000", nato: "CATANIA", datanascita: "1980-01-01", sesso: "M", ottica: "OTT07", gdpr: true, documento: true, residenza: {indirizzo: "Via 1", cap: "95100", comune: "CATANIA", provincia: "CT"}})});
  ok(r.s === 409 && !r.d.univoco, "registrazione doppia da CAF002: 409 senza codice cliente (" + r.s + ")");
  // 2. cambio CAF: senza codice no, codice sbagliato no, codice giusto sì
  r = await j("/api/utenti", {method: "POST", headers: H(c2), body: JSON.stringify({azione: "rinnovo", cf: "RSSMRA80A01C351O", ottica: "OTT12"})});
  ok(r.s === 403 && r.d.serveCodice && !r.d.univoco, "rinnovo da CAF002 senza codice: 403");
  r = await j("/api/utenti", {method: "POST", headers: H(c2), body: JSON.stringify({azione: "rinnovo", cf: "RSSMRA80A01C351O", ottica: "OTT12", codice: "A001"})});
  ok(r.s === 403, "solo le ultime 4 cifre: rifiutato");
  r = await j("/api/utenti", {method: "POST", headers: H(c2), body: JSON.stringify({azione: "rinnovo", cf: "RSSMRA80A01C351O", ottica: "OTT12", codice: "sgp24a001"})});
  ok(r.s === 200 && r.d.univoco === "SGP24A001", "rinnovo da CAF002 con il codice: ok (" + r.s + " " + (r.d.errore || "") + ")");
  r = await j("/api/utenti?cf=RSSMRA80A01C351O", {headers: H(c2)}); ok(r.d.mio === true && !r.d.altroCaf, "ora è cliente di CAF002");
  r = await j("/api/utenti?cf=RSSMRA80A01C351O", {headers: H(c1)}); ok(r.d.altroCaf && r.d.cafNome === "CAF Due", "CAF001 ora vede solo «presso CAF Due»");
  // 3. compensi: l'occhiale vecchio resta a CAF001 e OTT07
  let cl = await j("/api/clienti", {headers: H(c1)}); const e1 = cl.d.estratto;
  ok(!cl.d.clienti.some(x => x.univoco === "SGP24A001"), "CAF001: il cliente non è più nel suo elenco");
  ok(e1.righe.some(x => x.univoco === "SGP24A001" && x.tipo === "compenso"), "CAF001: tiene il compenso dell'occhiale che ha commissionato");
  cl = await j("/api/clienti", {headers: H(c2)}); ok(!cl.d.estratto.righe.some(x => x.univoco === "SGP24A001"), "CAF002: nessun compenso per l'occhiale di prima");
  ok(cl.d.clienti.some(x => x.univoco === "SGP24A001"), "CAF002: il cliente è nel suo elenco");
  cl = await j("/api/clienti", {headers: H(o7)}); ok(cl.d.estratto.righe.some(x => x.univoco === "SGP24A001" && x.tipo === "compenso"), "OTT07: tiene il compenso dell'occhiale consegnato");
  cl = await j("/api/clienti", {headers: H(o12)}); ok(!cl.d.estratto.righe.some(x => x.univoco === "SGP24A001"), "OTT12: nessun compenso per l'occhiale consegnato da OTT07");
  // ottica: rinnovo di un cliente di un'altra ottica con il codice
  r = await j("/api/utenti", {method: "POST", headers: H(o7), body: JSON.stringify({azione: "rinnovo", cf: "VRDNNA90C41C351H"})}); ok(r.s === 403 && r.d.serveCodice, "OTT07: cliente di OTT12 senza codice: 403");
  r = await j("/api/utenti", {method: "POST", headers: H(o7), body: JSON.stringify({azione: "rinnovo", cf: "VRDNNA90C41C351H", codice: "http://x/?Univoco=SGP24C003&espositore=OTT12"})}); ok(r.s === 200, "OTT07: con il link della tessera: ok");
  r = await j("/api/utenti?cf=VRDNNA90C41C351H", {headers: H(c2)}); ok(r.d.mio, "il CAF resta CAF002 quando cambia solo l'ottica");
  cl = await j("/api/clienti", {headers: H(o12)}); ok(cl.d.estratto.righe.some(x => x.univoco === "SGP24C003"), "OTT12 tiene il compenso dell'occhiale consegnato prima");
  // admin
  const ad = await j("/api/admin", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({azione: "login", password: "passwordlunga1"})});
  console.log("fine");
})();
