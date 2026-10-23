// Clienti: verifica codice fiscale, inserimento e rinnovo (CAF), ricerca (ottico)
const L = require("./_lib");
async function sendSms(to, text){
  if (!L.CFG.smsWebhook) return false;
  try { const r = await fetch(L.CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to, text})}); return r.ok; }
  catch(e){ return false; }
}
function messaggio(nome, ottica, link){ return `SocialGlass: ciao ${nome}, ecco il tuo link personale per scegliere i nuovi occhiali da ${ottica}: ${link}`; }
function wa(numero, testo){ return `https://wa.me/${String(numero).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`; }
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET"){
    const cf = (url.searchParams.get("cf") || "").toUpperCase().trim();
    const uv = (url.searchParams.get("univoco") || "").toUpperCase().trim();
    if (cf){
      if (!L.verify(req, "caf")) return L.send(res, 401, L.NOAUTH);
      if (!L.CF.valido(cf)) return L.send(res, 200, {valido: false});
      const u = await L.DB.utente("Codice Fiscale", cf);
      return L.send(res, 200, {valido: true, stato: u ? u.f.Stato || "REGISTRATO" : null, nome: u ? `${u.f.Nome} ${u.f.Cognome}` : null, univoco: u ? u.f.Univoco : null});
    }
    if (uv){
      const s = L.verify(req, "ottico"); if (!s) return L.send(res, 401, L.NOAUTH);
      const u = await L.DB.utente("Univoco", uv);
      return L.send(res, 200, u ? {trovato: true, nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato || ""} : {trovato: false});
    }
    return L.send(res, 400, {errore: "Parametro mancante"});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const b = await L.readBody(req);

  // rinnovo: dal CAF o direttamente dall'ottico, dai 30 giorni prima della scadenza
  if (b.azione === "rinnovo"){
    const sc = L.verify(req, "caf"), so = sc ? null : L.verify(req, "ottico");
    if (!sc && !so) return L.send(res, 401, L.NOAUTH);
    const u = b.univoco ? await L.DB.utente("Univoco", String(b.univoco).toUpperCase().trim()) : await L.DB.utente("Codice Fiscale", String(b.cf || "").toUpperCase().trim());
    if (!u) return L.send(res, 404, {errore: "Cliente non trovato. Controlla il codice fiscale."});
    // l'ottico può rinnovare per codice univoco solo i propri clienti; per un cliente di un'altra ottica serve il codice fiscale
    if (so && b.univoco && !String(u.f.Ottica1 || "").startsWith(so.id + " ")) return L.send(res, 404, {errore: "Cliente non trovato tra i tuoi clienti."});
    const ord = L.parseOrdine(u.f.Ordine);
    if (![L.STATI.CONSEGNATO, L.STATI.REGISTRATO].includes(u.f.Stato) && ord.pagamento && !ord.pagamento.chiuso)
      return L.send(res, 409, {errore: "Il cliente ha un ordine in corso: il rinnovo si fa dopo la consegna."});
    if (!L.PREZZI.rinnovabile(ord)){
      const p = L.PREZZI.periodo(ord);
      return L.send(res, 409, {errore: `Rinnovo possibile dal ${new Date(p.preavviso).toLocaleDateString("it-IT")} (30 giorni prima della scadenza del ${new Date(p.scadenza).toLocaleDateString("it-IT")}).`});
    }
    // l'ottico che rinnova diventa l'ottica del cliente; il CAF può indicarne un'altra
    const otticoId = so ? so.id : (b.ottica || "");
    return L.send(res, 200, await L.rinnova(u, {otticoId, caf: sc ? sc.id : ""}));
  }

  const s = L.verify(req, "caf"); if (!s) return L.send(res, 401, L.NOAUTH);

  const d = {cf: String(b.cf || "").toUpperCase().trim(), nome: String(b.nome || "").toUpperCase().trim(), cognome: String(b.cognome || "").toUpperCase().trim(),
    prefisso: String(b.prefisso || "+39"), cellulare: String(b.cellulare || "").replace(/\D/g, ""), nato: String(b.nato || "").toUpperCase().trim(),
    sesso: b.sesso === "F" ? "F" : "M", data: String(b.datanascita || ""), ottica: String(b.ottica || ""), gdpr: !!b.gdpr};
  if (!d.cf || !d.nome || !d.cognome || !d.cellulare || !d.nato || !d.data || !d.ottica || !d.gdpr) return L.send(res, 400, {errore: "Per favore, compila tutti i campi obbligatori."});
  if (!L.CF.valido(d.cf)) return L.send(res, 400, {errore: "CODICE FISCALE NON VALIDO"});
  if (!L.CF.coerente(d.cf, d.nome, d.cognome, d.data, d.sesso)) return L.send(res, 400, {errore: "Codice fiscale non conforme a nome, cognome, data di nascita e sesso."});
  if (d.cellulare.length < 6) return L.send(res, 400, {errore: "Numero di cellulare non valido."});
  const gia = await L.DB.utente("Codice Fiscale", d.cf);
  if (gia) return L.send(res, 409, {errore: `ATTENZIONE ! CODICE FISCALE ${gia.f.Stato || "GIÀ REGISTRATO"}`, univoco: gia.f.Univoco});
  const o = await L.DB.ottico(d.ottica);
  if (!o) return L.send(res, 400, {errore: "Ottica non trovata."});
  const fields = {"CAF": s.id, "Nome": d.nome, "Cognome": d.cognome, "Cellulare": d.cellulare, "Codice Fiscale": d.cf,
    "Ottica1": `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`, "Nato a": d.nato, "Genere": d.sesso, "Data Nascita": d.data,
    "Listino": o.Listino || "", "Stato": L.STATI.REGISTRATO};
  const uv = await L.DB.creaUtente(fields);
  const link = L.linkCliente(uv, o.ID, s.id, o.Listino);
  const testo = messaggio(d.nome, o.Intestatario, link);
  L.send(res, 200, {univoco: uv, link, smsInviato: await sendSms(d.prefisso + d.cellulare, testo), whatsapp: wa(d.prefisso + d.cellulare, testo), ottica: o.Intestatario});
});
