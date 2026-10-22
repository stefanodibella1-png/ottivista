// Clienti: verifica codice fiscale, inserimento (CAF) e ricerca (ottico)
const L = require("./_lib");
function univoco(){ return "SG" + require("crypto").randomBytes(4).toString("hex").toUpperCase().slice(0, 7); }
async function byCF(cf){
  if (L.DEMO) return L.demo.utenti.find(u => u["Codice Fiscale"] === cf) || null;
  const r = await L.find(L.CFG.baseMain, L.CFG.tUtenti, `{Codice Fiscale}="${L.q(cf)}"`, 1);
  return r[0] ? r[0].fields : null;
}
async function byUnivoco(u){
  if (L.DEMO) return L.demo.utenti.find(x => x.Univoco === u) || null;
  const r = await L.find(L.CFG.baseMain, L.CFG.tUtenti, `{Univoco}="${L.q(u)}"`, 1);
  return r[0] ? Object.assign({_id: r[0].id}, r[0].fields) : null;
}
async function sendSms(to, text){
  if (!L.CFG.smsWebhook) return {inviato: false};
  try {
    const r = await fetch(L.CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to, text})});
    return {inviato: r.ok};
  } catch(e){ return {inviato: false}; }
}
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET"){
    const cf = (url.searchParams.get("cf") || "").toUpperCase().trim();
    const uv = (url.searchParams.get("univoco") || "").toUpperCase().trim();
    if (cf){
      if (!L.verify(req, "caf")) return L.send(res, 401, {errore: "Sessione scaduta: accedi di nuovo."});
      if (!L.CF.valido(cf)) return L.send(res, 200, {valido: false});
      const u = await byCF(cf);
      return L.send(res, 200, {valido: true, stato: u ? u.Stato || "REGISTRATO" : null, nome: u ? `${u.Nome} ${u.Cognome}` : null, univoco: u ? u.Univoco : null});
    }
    if (uv){
      if (!L.verify(req, "ottico")) return L.send(res, 401, {errore: "Sessione scaduta: accedi di nuovo."});
      const u = await byUnivoco(uv);
      return L.send(res, 200, u ? {trovato: true, nome: u.Nome, cognome: u.Cognome, stato: u.Stato || ""} : {trovato: false});
    }
    return L.send(res, 400, {errore: "Parametro mancante"});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const s = L.verify(req, "caf");
  if (!s) return L.send(res, 401, {errore: "Sessione scaduta: accedi di nuovo."});
  const b = await L.readBody(req);
  const d = {cf: String(b.cf || "").toUpperCase().trim(), nome: String(b.nome || "").toUpperCase().trim(), cognome: String(b.cognome || "").toUpperCase().trim(),
    prefisso: String(b.prefisso || "+39"), cellulare: String(b.cellulare || "").replace(/\D/g, ""), nato: String(b.nato || "").toUpperCase().trim(),
    sesso: b.sesso === "F" ? "F" : "M", data: String(b.datanascita || ""), ottica: String(b.ottica || ""), gdpr: !!b.gdpr};
  if (!d.cf || !d.nome || !d.cognome || !d.cellulare || !d.nato || !d.data || !d.ottica || !d.gdpr) return L.send(res, 400, {errore: "Per favore, compila tutti i campi obbligatori."});
  if (!L.CF.valido(d.cf)) return L.send(res, 400, {errore: "CODICE FISCALE NON VALIDO"});
  if (!L.CF.coerente(d.cf, d.nome, d.cognome, d.data, d.sesso)) return L.send(res, 400, {errore: "Codice fiscale non conforme a nome, cognome, data di nascita e sesso."});
  if (d.cellulare.length < 6) return L.send(res, 400, {errore: "Numero di cellulare non valido."});
  const gia = await byCF(d.cf);
  if (gia) return L.send(res, 409, {errore: `ATTENZIONE ! CODICE FISCALE ${gia.Stato || "GIÀ REGISTRATO"}`});
  // ottica scelta
  const o = L.DEMO ? L.demo.ottici.find(x => x.ID === d.ottica) : ((await L.find(L.CFG.baseMain, L.CFG.tOttici, `{ID}="${L.q(d.ottica)}"`, 1))[0] || {}).fields;
  if (!o) return L.send(res, 400, {errore: "Ottica non trovata."});
  const otticaTesto = `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`;
  const fields = {"CAF": s.id, "Nome": d.nome, "Cognome": d.cognome, "Cellulare": d.cellulare, "Codice Fiscale": d.cf, "Ottica1": otticaTesto,
    "Nato a": d.nato, "Genere": d.sesso, "Data Nascita": d.data, "Listino": o.Listino || "", "Stato": "IN ATTESA SCELTA MONTATURA"};
  let uv;
  if (L.DEMO){
    uv = univoco(); L.demo.utenti.unshift(Object.assign({Univoco: uv}, fields));
  } else {
    const r = await L.at(L.CFG.baseMain, L.CFG.tUtenti, {method: "POST", body: {fields, typecast: true}});
    uv = r.fields && r.fields.Univoco;
    if (!uv){ // se in Airtable "Univoco" non è un campo calcolato, lo genera il server
      uv = univoco();
      await L.at(L.CFG.baseMain, L.CFG.tUtenti, {method: "PATCH", id: r.id, body: {fields: {Univoco: uv}, typecast: true}});
    }
  }
  const link = `${L.CFG.site}/?Univoco=${encodeURIComponent(uv)}&espositore=${encodeURIComponent(o.ID)}&promotore=${encodeURIComponent(s.id)}&listino=${encodeURIComponent(o.Listino || "")}`;
  const testo = `SocialGlass: ciao ${d.nome}, ecco il tuo link per scegliere i nuovi occhiali da ${o.Intestatario}: ${link}`;
  const sms = await sendSms(d.prefisso + d.cellulare, testo);
  const wa = `https://wa.me/${(d.prefisso + d.cellulare).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`;
  L.send(res, 200, {univoco: uv, link, smsInviato: sms.inviato, whatsapp: wa, ottica: o.Intestatario});
});
