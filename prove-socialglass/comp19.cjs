// Compenso solo a occhiale consegnato, più il previsto
process.env.SESSION_SECRET = "c".repeat(40);
const L = require("/home/claude/ottivista/socialglass/api/_lib.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const iso = d => new Date(d).toISOString(), ora = Date.now();
const pr = {rata: 10, spedizione: 5, mesi: 12, totale: 120};
const pg = (x) => Object.assign({stato: "ATTIVO", attivatoIl: iso(ora - 20*864e5), ratePagate: 1, pagamenti: [{id: "in_1", il: iso(ora - 20*864e5), canone: 10, spedizione: 5, riscatto: 0}]}, x);
const U = [
  {Univoco: "A", Nome: "ATTIVO", Cognome: "NON CONSEGNATO", Stato: L.STATI.ATTIVO, Ordine: JSON.stringify({montatura: {modello: "M"}, prezzi: pr, pagamento: pg({})})},
  {Univoco: "B", Nome: "CONSEGNATO", Cognome: "", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({montatura: {modello: "M"}, prezzi: pr, consegnatoIl: iso(ora - 10*864e5), pagamento: pg({})})},
  {Univoco: "C", Nome: "REGISTRATO", Cognome: "", Stato: L.STATI.REGISTRATO, Ordine: "{}"},
  {Univoco: "D", Nome: "PREVENTIVO", Cognome: "", Stato: L.STATI.PAGAMENTO, Ordine: JSON.stringify({prezzi: pr})}];
const acc = t => ({Accordi: [{dal: "2000-01-01", tipo: t[0], valore: t[1]}]});
(async () => {
  // rinnovo: B chiede il rinnovo (periodo vecchio consegnato), E rinnova senza aver mai ricevuto l'occhiale
  const uB2 = JSON.parse(JSON.stringify(U[1])); uB2.Univoco = "B2"; L.demo.utenti.push(uB2); await L.rinnova(await L.DB.utente("Univoco", "B2"), {otticoId: "", caf: "CAF001"});   // rinnovo dal CAF (dall'ottica: niente al CAF)
  const B2 = (await L.DB.utente("Univoco", "B2")).f;
  const uE = JSON.parse(JSON.stringify(U[0])); uE.Univoco = "E"; L.demo.utenti.push(uE); await L.rinnova(await L.DB.utente("Univoco", "E"), {otticoId: "", caf: "CAF001"});
  const E = (await L.DB.utente("Univoco", "E")).f;
  const tutti = U.concat([B2, E]);
  let e = L.estratto(tutti, acc(["fisso", 3]), "", "", "caf");
  ok(e.righe.length === 2 && e.righe.every(x => ["B", "B2"].includes(x.univoco)) && e.maturato === 6, `fisso 3 €: maturano solo i consegnati (B e il periodo vecchio di B2) = ${e.maturato} €; attivo non consegnato e rinnovo senza consegna: niente`);
  ok(e.previsto === 15 && e.previstoClienti === 5, `previsto: A, C, D e i due rinnovi (5 × 3 €) = ${e.previsto} €, poi B2/E in rinnovo? clienti ${e.previstoClienti}`);
  e = L.estratto(tutti, acc(["rata"]), "", "", "ottica");
  ok(e.maturato === 30 && e.previsto === 30 && e.previstoSenzaPreventivo === 3, `rata + spedizione: maturato ${e.maturato} € · previsto ${e.previsto} € (A e D) · senza preventivo ${e.previstoSenzaPreventivo}`);
  e = L.estratto(tutti, acc(["percentuale", 10]), "", "", "caf");
  const rB = e.righe.filter(x => x.univoco === "B");
  ok(rB.length === 1 && rB[0].il.slice(0, 10) === iso(ora - 10*864e5).slice(0, 10) && rB[0].importo === 1, "percentuale: il canone pagato prima della consegna matura il giorno della consegna (1 €)");
  ok(!e.righe.some(x => x.univoco === "A" || x.univoco === "E"), "percentuale: niente per chi non ha ricevuto l'occhiale");
  console.log("  previsto %:", e.previsto, "clienti", e.previstoClienti);
  process.exit(process.exitCode || 0);
})().catch(x => { console.error(x); process.exit(1); });
