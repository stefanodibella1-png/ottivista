// Fatture di SocialGlass al cliente: una per ogni incasso (canone, spedizione, acquisto dell'usato).
// Formato FatturaPA 1.2 (FPR12, cliente privato: codice destinatario 0000000). Invio al Sistema di Interscambio
// tramite Aruba quando ci sono le credenziali (secrets ARUBA_USER e ARUBA_PASSWORD); altrimenti restano «da inviare».
const L = require("./_lib");
const E = process.env;
const ARUBA = {
  produzione: {auth: "https://auth.fatturazioneelettronica.aruba.it/auth/signin", ws: "https://ws.fatturazioneelettronica.aruba.it"},
  demo: {auth: "https://demoauth.fatturazioneelettronica.aruba.it/auth/signin", ws: "https://demows.fatturazioneelettronica.aruba.it"}
};
const ARUBA_CF = "01879020517";   // Aruba PEC S.p.A.: deve comparire come trasmittente (IdTrasmittente) quando invia Aruba
const r2 = x => Math.round((Number(x) || 0) * 100) / 100, f2 = x => r2(x).toFixed(2);
const esc = s => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const txt = (s, n) => esc(String(s || "").normalize("NFC").replace(/[^\x20-\x7E -ÿ€]/g, " ").replace(/\s+/g, " ").trim().slice(0, n));
const tag = (t, v) => v === "" || v == null ? "" : `<${t}>${v}</${t}>`;

// impostazioni della fatturazione (pannello › Impostazioni › Fatturazione)
async function impostazioni(){
  const c = (await L.DB.meta("fatturazione")) || {}, t = (await L.DB.meta("titolare")) || {};
  return {
    regime: c.regime === "RF19" ? "RF19" : "RF01",          // RF01 ordinario, RF19 forfettario
    aliquota: c.aliquota != null && c.aliquota !== "" ? Number(c.aliquota) : 4,
    nome: c.nome || "", cognome: c.cognome || "", denominazione: t.ragione || "", piva: String(t.piva || "").replace(/\D/g, ""), cf: String(c.cf || "").toUpperCase(),
    indirizzo: c.indirizzo || "", cap: c.cap || "", comune: c.comune || "", provincia: String(c.provincia || "").toUpperCase(),
    invio: c.invio === "aruba" ? "aruba" : "spento", ambiente: c.ambiente === "produzione" ? "produzione" : "demo", attiva: !!c.attiva
  };
}
function mancaPerEmettere(s){
  const m = [];
  if (!/^\d{11}$/.test(s.piva)) m.push("partita IVA del titolare");
  if (!/^[A-Z0-9]{11,16}$/.test(s.cf)) m.push("codice fiscale del titolare");
  if (!(s.nome && s.cognome) && !s.denominazione) m.push("nome e cognome del titolare");
  if (!s.indirizzo || !/^\d{5}$/.test(s.cap) || !s.comune || !/^[A-Z]{2}$/.test(s.provincia)) m.push("sede del titolare");
  if (s.regime === "RF01" && !(s.aliquota > 0)) m.push("aliquota IVA");
  return m;
}
// righe della fattura a partire dall'incasso registrato (importi IVA compresa, come li paga il cliente)
function righeDa(inc, ord, mese){
  const out = [];
  if (inc.canone > 0) out.push({descrizione: `Noleggio occhiale da vista (dispositivo medico con marcatura CE) - canone ${mese}`, lordo: r2(inc.canone)});
  if (inc.spedizione > 0) out.push({descrizione: "Spedizione dell'occhiale da vista", lordo: r2(inc.spedizione)});
  if (inc.riscatto > 0) out.push({descrizione: "Cessione dell'occhiale da vista usato (dispositivo medico con marcatura CE) a fine noleggio", lordo: r2(inc.riscatto)});
  return out;
}
// importi: regime ordinario = scorporo dell'IVA riga per riga; forfettario = nessuna IVA (natura N2.2) e bollo oltre 77,47 €
function calcola(righe, s){
  const a = s.regime === "RF19" ? 0 : s.aliquota;
  const l = righe.map((x, i) => ({n: i + 1, descrizione: x.descrizione, prezzo: a ? r2(x.lordo / (1 + a / 100)) : r2(x.lordo), lordo: x.lordo}));
  const imponibile = r2(l.reduce((t, x) => t + x.prezzo, 0)), imposta = r2(imponibile * a / 100), totale = r2(l.reduce((t, x) => t + x.lordo, 0));
  return {aliquota: a, righe: l, imponibile, imposta, totale, bollo: s.regime === "RF19" && totale > 77.47 ? 2 : 0};
}
function xml(f, s){
  const forf = s.regime === "RF19", trasm = s.invio === "aruba" ? ARUBA_CF : s.cf;
  const ced = `<CedentePrestatore><DatiAnagrafici><IdFiscaleIVA><IdPaese>IT</IdPaese><IdCodice>${s.piva}</IdCodice></IdFiscaleIVA>${tag("CodiceFiscale", esc(s.cf))}
<Anagrafica>${s.nome && s.cognome ? `<Nome>${txt(s.nome, 60)}</Nome><Cognome>${txt(s.cognome, 60)}</Cognome>` : `<Denominazione>${txt(s.denominazione, 80)}</Denominazione>`}</Anagrafica><RegimeFiscale>${s.regime}</RegimeFiscale></DatiAnagrafici>
<Sede><Indirizzo>${txt(s.indirizzo, 60)}</Indirizzo><CAP>${s.cap}</CAP><Comune>${txt(s.comune, 60)}</Comune><Provincia>${s.provincia}</Provincia><Nazione>IT</Nazione></Sede></CedentePrestatore>`;
  const c = f.cliente;
  const ces = `<CessionarioCommittente><DatiAnagrafici><CodiceFiscale>${esc(c.cf)}</CodiceFiscale><Anagrafica><Nome>${txt(c.nome, 60)}</Nome><Cognome>${txt(c.cognome, 60)}</Cognome></Anagrafica></DatiAnagrafici>
<Sede><Indirizzo>${txt(c.indirizzo, 60)}</Indirizzo><CAP>${c.cap}</CAP><Comune>${txt(c.comune, 60)}</Comune><Provincia>${c.provincia}</Provincia><Nazione>IT</Nazione></Sede></CessionarioCommittente>`;
  const natura = forf ? "<Natura>N2.2</Natura>" : "";
  const linee = f.righe.map(x => `<DettaglioLinee><NumeroLinea>${x.n}</NumeroLinea><Descrizione>${txt(x.descrizione, 1000)}</Descrizione><Quantita>1.00</Quantita><PrezzoUnitario>${f2(x.prezzo)}</PrezzoUnitario><PrezzoTotale>${f2(x.prezzo)}</PrezzoTotale><AliquotaIVA>${f2(f.aliquota)}</AliquotaIVA>${natura}</DettaglioLinee>`).join("\n");
  const riep = `<DatiRiepilogo><AliquotaIVA>${f2(f.aliquota)}</AliquotaIVA>${natura}<ImponibileImporto>${f2(f.imponibile)}</ImponibileImporto><Imposta>${f2(f.imposta)}</Imposta>${forf ? "" : "<EsigibilitaIVA>I</EsigibilitaIVA>"}${forf ? "<RiferimentoNormativo>Operazione in franchigia da IVA ai sensi dell'art. 1, commi 54-89, L. 190/2014</RiferimentoNormativo>" : ""}</DatiRiepilogo>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<p:FatturaElettronica versione="FPR12" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:p="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://ivaservizi.agenziaentrate.gov.it/docs/xsd/fatture/v1.2 http://www.fatturapa.gov.it/export/fatturazione/sdi/fatturapa/v1.2/Schema_del_file_xml_FatturaPA_versione_1.2.xsd">
<FatturaElettronicaHeader><DatiTrasmissione><IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${trasm}</IdCodice></IdTrasmittente><ProgressivoInvio>${f.progressivo}</ProgressivoInvio><FormatoTrasmissione>FPR12</FormatoTrasmissione><CodiceDestinatario>0000000</CodiceDestinatario></DatiTrasmissione>
${ced}
${ces}</FatturaElettronicaHeader>
<FatturaElettronicaBody><DatiGenerali><DatiGeneraliDocumento><TipoDocumento>TD01</TipoDocumento><Divisa>EUR</Divisa><Data>${f.data}</Data><Numero>${esc(f.numero)}</Numero>${f.bollo ? `<DatiBollo><BolloVirtuale>SI</BolloVirtuale><ImportoBollo>${f2(f.bollo)}</ImportoBollo></DatiBollo>` : ""}<ImportoTotaleDocumento>${f2(f.totale)}</ImportoTotaleDocumento><Causale>${txt(`Spesa sanitaria detraibile: noleggio di occhiale da vista. Contratto SocialGlass ${f.univoco}.`, 200)}</Causale></DatiGeneraliDocumento></DatiGenerali>
<DatiBeniServizi>${linee}
${riep}</DatiBeniServizi>
<DatiPagamento><CondizioniPagamento>TP02</CondizioniPagamento><DettaglioPagamento><ModalitaPagamento>MP08</ModalitaPagamento><DataScadenzaPagamento>${f.data}</DataScadenzaPagamento><ImportoPagamento>${f2(f.totale)}</ImportoPagamento></DettaglioPagamento></DatiPagamento></FatturaElettronicaBody>
</p:FatturaElettronica>`;
}

// crea la fattura di un incasso (una sola volta per incasso: l'id è quello del pagamento Stripe)
async function emetti(u, inc){
  const s = await impostazioni();
  if (!s.attiva) return {saltata: "fatturazione non attiva"};
  const manca = mancaPerEmettere(s); if (manca.length) return {errore: "Mancano nelle impostazioni: " + manca.join(", ")};
  const res = u.f.Residenza || {};
  if (!res.cap) return {errore: "Manca la residenza del cliente"};
  const ord = L.parseOrdine(u.f.Ordine), quando = inc.il || new Date().toISOString(), data = L.oraRoma(new Date(quando)).slice(0, 10), anno = data.slice(0, 4);
  const mese = new Date(quando).toLocaleDateString("it-IT", {month: "long", year: "numeric", timeZone: "Europe/Rome"});
  const righe = righeDa(inc, ord, mese); if (!righe.length) return {saltata: "importo zero"};
  const conti = calcola(righe, s), id = String(inc.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60); if (!id) return {errore: "Incasso senza identificativo"};
  const f = await L.DB.nuovaFattura(id, anno, n => {
    const numero = `${n}/SG`, prog = (anno.slice(2) + String(n).padStart(8, "0")).slice(-10);
    const x = Object.assign({ID: id, anno, n, numero, data, progressivo: prog, univoco: u.f.Univoco, tipo: inc.riscatto > 0 ? "acquisto usato" : "canone",
      cliente: {cf: u.f["Codice Fiscale"], nome: u.f.Nome, cognome: u.f.Cognome, indirizzo: res.indirizzo, cap: res.cap, comune: res.comune, provincia: res.provincia},
      regime: s.regime, stato: s.invio === "aruba" ? "da inviare" : "da inviare (invio spento)", creata: new Date().toISOString()}, conti);
    x.xml = xml(x, s); return x;
  });
  if (!f) return {gia: true};
  await L.registra("fatturazione", "fattura emessa", u.f.Univoco, `n. ${f.numero} del ${f.data} · ${f2(f.totale)} €`);
  if (s.invio === "aruba" && E.ARUBA_USER && E.ARUBA_PASSWORD) await invia(f.ID).catch(e => console.error(e));
  return {ok: true, numero: f.numero};
}

// Aruba: un accesso al minuto al massimo, il token dura 30 minuti: lo teniamo da parte
async function tokenAruba(s){
  if (!E.ARUBA_USER || !E.ARUBA_PASSWORD) throw new Error("Credenziali Aruba non impostate (secrets ARUBA_USER e ARUBA_PASSWORD).");
  const t = (await L.DB.meta("aruba-token")) || {};
  if (t.token && t.ambiente === s.ambiente && t.scade > Date.now() + 60e3) return t.token;
  const r = await fetch(ARUBA[s.ambiente].auth, {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"},
    body: new URLSearchParams({grant_type: "password", username: E.ARUBA_USER, password: E.ARUBA_PASSWORD}).toString()});
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`Accesso ad Aruba non riuscito (${r.status}): ${String(j.error_description || j.error || "").slice(0, 150)}`);
  await L.DB.meta("aruba-token", {token: j.access_token, ambiente: s.ambiente, scade: Date.now() + (Number(j.expires_in) || 1800) * 1000});
  return j.access_token;
}
async function invia(id){
  const s = await impostazioni(), f = (await L.DB.lista("fatt")).find(x => (x.ID || x._id) === id);
  if (!f) return {errore: "Fattura non trovata"};
  if (/^inviata/.test(f.stato)) return {gia: true};
  if (s.invio !== "aruba") return {errore: "Invio ad Aruba spento nelle impostazioni"};
  if (!E.ARUBA_USER || !E.ARUBA_PASSWORD) return {errore: "Credenziali Aruba non ancora impostate: la fattura resta da inviare."};
  try {
    const tok = await tokenAruba(s);
    // il trasmittente deve essere Aruba: se la fattura è stata creata con l'invio spento, si rigenera l'intestazione
    const x = f.xml.replace(/<IdTrasmittente><IdPaese>IT<\/IdPaese><IdCodice>[^<]*<\/IdCodice>/, `<IdTrasmittente><IdPaese>IT</IdPaese><IdCodice>${ARUBA_CF}</IdCodice>`);
    const r = await fetch(ARUBA[s.ambiente].ws + "/services/invoice/upload", {method: "POST", headers: {"Content-Type": "application/json;charset=UTF-8", Authorization: "Bearer " + tok, Accept: "application/json"},
      body: JSON.stringify({dataFile: Buffer.from(x, "utf8").toString("base64")})});
    const j = await r.json().catch(() => ({}));
    if (r.ok && j.errorCode === "0000"){ await L.DB.salva("fatt", id, {stato: "inviata ad Aruba", file: j.uploadFileName || "", inviata: new Date().toISOString(), xml: x, ambiente: s.ambiente, errore: ""}); return {ok: true, file: j.uploadFileName}; }
    const m = `${j.errorCode || r.status} ${String(j.errorDescription || "").slice(0, 200)}`.trim();
    await L.DB.salva("fatt", id, {stato: "errore di invio", errore: m, tentativo: new Date().toISOString()}); return {errore: m};
  } catch(e){ await L.DB.salva("fatt", id, {stato: "errore di invio", errore: String(e.message).slice(0, 200), tentativo: new Date().toISOString()}); return {errore: String(e.message)}; }
}
// controllo del mattino: rimanda quelle non ancora partite
async function inviaInSospeso(){
  const s = await impostazioni(); if (s.invio !== "aruba" || !E.ARUBA_USER) return [];
  const l = (await L.DB.lista("fatt")).filter(x => !/^inviata/.test(x.stato)).slice(0, 25), out = [];
  for (const f of l) out.push(Object.assign({numero: f.numero}, await invia(f.ID || f._id)));
  return out;
}
// copia di cortesia per il cliente (la fattura valida è quella elettronica nel suo cassetto fiscale)
function cortesia(f){
  const { numero, data, totale, imponibile, imposta, aliquota, righe, bollo, regime } = f;
  return {numero, data, totale, imponibile, imposta, aliquota, bollo, regime, righe: (righe || []).map(x => ({descrizione: x.descrizione, importo: x.lordo})), stato: f.stato};
}
module.exports = {impostazioni, mancaPerEmettere, emetti, invia, inviaInSospeso, cortesia, calcola, xml, ARUBA_CF, credenziali: () => !!(E.ARUBA_USER && E.ARUBA_PASSWORD)};
