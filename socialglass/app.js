/* SocialGlass · logica della pagina. Parla con il server (/api); senza server usa dati di prova nel browser. */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const P = new URLSearchParams(location.search);
const par = k => P.get(k) || P.get(k.toLowerCase()) || "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const euro = v => Number(v || 0).toLocaleString("it-IT", {style: "currency", currency: "EUR"});

/* ---------- immagini mancanti: segnaposto ---------- */
const SVG = {
  simbolo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 120"><g fill="none" stroke="#0A1F5C" stroke-width="12" stroke-linecap="round"><circle cx="70" cy="66" r="42"/><circle cx="190" cy="66" r="42"/><path d="M112 60q18-14 36 0"/></g></svg>`,
  logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 120"><text x="170" y="70" text-anchor="middle" font-family="Arial" font-size="52" fill="#0A1F5C">Social Glasses</text></svg>`
};
document.querySelectorAll("img[data-fallback]").forEach(img => {
  const swap = () => { img.onerror = null; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SVG[img.dataset.fallback] || SVG.logo); };
  img.onerror = swap; if (img.complete && !img.naturalWidth) swap();
});

/* ---------- logo cadente (come nel sito originale) ---------- */
function dropImage(el, startY, endY, done){
  let y = startY;
  const step = () => { y = Math.min(endY, y + Math.max(2, (endY - y)*.06)); el.style.top = y + "px"; if (y < endY) requestAnimationFrame(step); else done && done(); };
  step();
}
window.addEventListener("load", () => {
  if (matchMedia("(max-width:768px)").matches) return;
  const t = $("immagineCadente1"), s = $("immagineCadente2"), end = 140;
  const show2 = () => { if (!s.hasAttribute("data-off")){ s.hidden = false; s.style.top = (end + t.offsetHeight + 10) + "px"; } };
  if (matchMedia("(prefers-reduced-motion: reduce)").matches){ t.style.top = end + "px"; show2(); } else dropImage(t, -200, end, show2);
});

/* ---------- popup ---------- */
function open(id){
  document.querySelectorAll(".popup").forEach(p => p.hidden = p.id !== id);
  const el = $(id); el.hidden = false;
  const f = el.querySelector("input:not([disabled]):not([type=checkbox]):not([type=radio]),select:not([disabled])");
  if (f && !("ontouchstart" in window)) setTimeout(() => f.focus(), 50);
}
function closeAll(){ document.querySelectorAll(".popup").forEach(p => p.hidden = true); }
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]"); if (c){ c.closest(".popup").hidden = true; return; }
  const o = e.target.closest("[data-open]");
  if (o){ if (o.hasAttribute("data-reset-form")) resetForm(); open(o.dataset.open); if (o.dataset.open === "popupForm") loadOttici(); if (o.dataset.open === "ordinePopup") resetOrdine(); return; }
  if (e.target.closest("[data-logout]")){ ["sg_tok","sg_ruolo","sg_id"].forEach(k => sessionStorage.removeItem(k)); closeAll(); return; }
  if (e.target.closest("[data-clienti]")){ apriClienti(); return; }
  if (e.target.classList && e.target.classList.contains("popup")) e.target.hidden = true;
});
document.addEventListener("keydown", e => { if (e.key === "Escape"){ closeAll(); stopScan(); } });
function esito(el, txt, kind){ el.textContent = txt; el.className = "esito " + (kind || "info"); el.hidden = !txt; }

/* ---------- stati ---------- */
const STATI = {REGISTRATO: "IN ATTESA SCELTA MONTATURA", MONTATURA: "MONTATURA SCELTA", PAGAMENTO: "IN ATTESA PAGAMENTO",
  ATTIVO: "ABBONAMENTO ATTIVO - IN LAVORAZIONE", PRONTO: "PRONTO PER IL RITIRO", CONSEGNATO: "CONSEGNATO"};
const ORDINE_STATI = [STATI.REGISTRATO, STATI.MONTATURA, STATI.PAGAMENTO, STATI.ATTIVO, STATI.PRONTO, STATI.CONSEGNATO];
const chip = s => { const i = ORDINE_STATI.indexOf(s); return `<span class="chip s${i < 0 ? 6 : i + 1}">${esc(s || "—")}</span>`; };

/* ---------- server o dati di prova ---------- */
let DEMO = false, STRIPE = false;
const ready = fetch("api/health", {cache: "no-store"}).then(r => r.ok ? r.json() : Promise.reject()).then(j => { DEMO = !!j.demo; STRIPE = !!j.stripe; if (DEMO) notaDemo("Server attivo senza Airtable: dati di prova."); })
  .catch(() => { DEMO = "browser"; notaDemo("Anteprima con dati di prova · CAF: CAF001 / demo · Ottici: OTT07 (Demo Centro) o OTT12 (Demo Mare) / demo · Montature: SG-1042, SG-1043, SG-1044"); });
function notaDemo(t){ const n = $("demoNota"); n.textContent = t; n.hidden = false; }
ready.then(() => {
  if (DEMO !== "browser") return;
  for (const [form, cod] of [["passwordPopup", "CAF001"], ["otticoPopup", "OTT07"], ["otticoPopup", "OTT12"]]){
    const f = $(form).querySelector("form"), b = document.createElement("button");
    b.type = "button"; b.className = "grigio full"; b.textContent = `Entra con i dati di prova (${cod})`;
    b.onclick = () => { const [c, p] = f.querySelectorAll("input"); c.value = cod; p.value = "demo"; f.requestSubmit(); };
    f.appendChild(b);
  }
});

/* anteprima senza server: stesse regole del server, dati nel browser */
const local = {
  load(){ try { const s = JSON.parse(localStorage.getItem("sg_demo")); if (s && s.v === 2){ if (!s.ottLogin.some(o => o.ID === "OTT12")) s.ottLogin.push({ID: "OTT12", Password: "demo"}); return s; } } catch(e){} return {v: 2,
    caf: [{ID: "CAF001", Password: "demo", Nome: "CAF Demo"}], ottLogin: [{ID: "OTT07", Password: "demo"}, {ID: "OTT12", Password: "demo"}],
    ottici: [{ID: "OTT07", Intestatario: "Ottica Demo Centro", Indirizzo: "Via Esempio 12, ", Citta: "Catania", Listino: "A"}, {ID: "OTT12", Intestatario: "Ottica Demo Mare", Indirizzo: "Corso Prova 3, ", Citta: "Acireale", Listino: "B"}],
    utenti: [], montature: [
      {Codice: "SG-1042", Modello: "Aurora", Colore: "Nero", Calibro: "52-18", Asse: "145", Stato: "DISPONIBILE"},
      {Codice: "SG-1043", Modello: "Vela", Colore: "Tartaruga", Calibro: "50-20", Asse: "140", Stato: "DISPONIBILE"},
      {Codice: "SG-1044", Modello: "Brezza", Colore: "Blu", Calibro: "54-17", Asse: "145", Stato: "DISPONIBILE"}]}; },
  save(s){ try { localStorage.setItem("sg_demo", JSON.stringify(s)); } catch(e){} },
  link(u, o, caf){ return `${location.origin}${location.pathname}?Univoco=${u.Univoco}&espositore=${o.ID}&promotore=${caf}&listino=${o.Listino}`; },
  async call(path, opt = {}){
    const s = this.load(), url = new URL(path, location.href), q = k => (url.searchParams.get(k) || "").trim(), b = opt.body ? JSON.parse(opt.body) : {};
    const ok = d => ({ok: true, status: 200, data: d}), ko = (st, m) => ({ok: false, status: st, data: {errore: m}});
    const tok = sessionStorage.getItem("sg_tok"); let sess = null; try { sess = tok ? JSON.parse(atob(tok)) : null; } catch(e){}
    const name = url.pathname.split("/").pop(), post = opt.method === "POST";
    const ord = u => { try { return JSON.parse(u.Ordine || "{}"); } catch(e){ return {}; } };
    const ottOf = u => s.ottici.find(o => String(u.Ottica1).startsWith(o.ID + " "));
    const done = d => { this.save(s); return ok(d); };
    if (name === "login"){
      const norm = c => String(c).toUpperCase().replace(/\s+/g, "").replace(/(?<=\D)O(?=\d)|(?<=\d)O/g, "0");
      const rec = (b.ruolo === "caf" ? s.caf : s.ottLogin).find(r => r.ID === norm(b.codice));
      if (!rec || rec.Password.toLowerCase() !== String(b.password).trim().toLowerCase()) return ko(401, `Codice o password non valida. Per la prova usa ${b.ruolo === "caf" ? "CAF001" : "OTT07"} e demo.`);
      const o = s.ottici.find(x => x.ID === rec.ID);
      return ok({token: btoa(JSON.stringify({ruolo: b.ruolo, id: rec.ID})), nome: b.ruolo === "ottico" ? (o ? o.Intestatario : rec.ID) : rec.Nome, id: rec.ID});
    }
    if (name === "ottici") return ok({ottici: s.ottici.map(f => ({id: f.ID, label: `${f.ID} - ${f.Intestatario} - ${f.Indirizzo}${f.Citta}`, listino: f.Listino}))});
    if (name === "utenti"){
      if (post && b.azione === "rinnovo"){
        const u = s.utenti.find(x => b.univoco ? x.Univoco === String(b.univoco).toUpperCase() : x["Codice Fiscale"] === String(b.cf).toUpperCase()); if (!u) return ko(404, "Cliente non trovato. Controlla il codice fiscale.");
        const o = ord(u);
        if (!LISTINI.rinnovabile(o)){ const p = LISTINI.periodo(o); return ko(409, `Rinnovo possibile dal ${new Date(p.preavviso).toLocaleDateString("it-IT")} (30 giorni prima della scadenza del ${new Date(p.scadenza).toLocaleDateString("it-IT")}).`); }
        if (sess.ruolo === "ottico"){ const no = s.ottici.find(x => x.ID === sess.id); if (no) u.Ottica1 = `${no.ID} - ${no.Intestatario} - ${no.Indirizzo}${no.Citta}`; }
        u.Ordine = JSON.stringify({storico: (o.storico || []).concat(o.montatura ? [{montatura: o.montatura, totale: o.prezzi && o.prezzi.totale}] : [])}); u.Stato = STATI.REGISTRATO;
        const ot = ottOf(u), link = this.link(u, ot, sess.id);
        return done({univoco: u.Univoco, link, whatsapp: `https://wa.me/39${u.Cellulare}?text=${encodeURIComponent("SocialGlass: ecco il tuo link per il rinnovo: " + link)}`});
      }
      if (post){
        const d = b;
        if (!CF.valido(d.cf)) return ko(400, "CODICE FISCALE NON VALIDO");
        if (!CF.coerente(d.cf, d.nome, d.cognome, d.datanascita, d.sesso)) return ko(400, "Codice fiscale non conforme a nome, cognome, data di nascita e sesso.");
        const g = s.utenti.find(u => u["Codice Fiscale"] === d.cf); if (g) return ko(409, `ATTENZIONE ! CODICE FISCALE ${g.Stato}`);
        const o = s.ottici.find(x => x.ID === d.ottica);
        const u = {Univoco: "SG" + Math.random().toString(36).slice(2, 9).toUpperCase(), CAF: sess.id, Nome: d.nome.toUpperCase(), Cognome: d.cognome.toUpperCase(), Cellulare: d.cellulare, "Codice Fiscale": d.cf,
          Ottica1: `${o.ID} - ${o.Intestatario} - ${o.Indirizzo}${o.Citta}`, Listino: o.Listino, Stato: STATI.REGISTRATO, Creato: new Date().toISOString()};
        s.utenti.unshift(u);
        const link = this.link(u, o, sess.id), testo = `SocialGlass: ciao ${u.Nome}, ecco il tuo link personale per scegliere i nuovi occhiali da ${o.Intestatario}: ${link}`;
        return done({univoco: u.Univoco, link, smsInviato: false, whatsapp: `https://wa.me/${(d.prefisso + d.cellulare).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`, ottica: o.Intestatario});
      }
      if (q("cf")){ const cf = q("cf").toUpperCase(); if (!CF.valido(cf)) return ok({valido: false}); const u = s.utenti.find(x => x["Codice Fiscale"] === cf); return ok({valido: true, stato: u ? u.Stato : null, nome: u ? `${u.Nome} ${u.Cognome}` : null, univoco: u ? u.Univoco : null}); }
      if (q("univoco")){ const u = s.utenti.find(x => x.Univoco === q("univoco").toUpperCase()); return ok(u ? {trovato: true, nome: u.Nome, cognome: u.Cognome, stato: u.Stato} : {trovato: false}); }
    }
    if (name === "clienti"){
      const rows = s.utenti.filter(u => sess.ruolo === "caf" ? u.CAF === sess.id : String(u.Ottica1).startsWith(sess.id + " "));
      return ok({clienti: rows.map(u => { const o = ord(u); return {univoco: u.Univoco, nome: u.Nome, cognome: u.Cognome, stato: u.Stato, cf: sess.ruolo === "caf" ? u["Codice Fiscale"] : undefined, cellulare: u.Cellulare,
        montatura: o.montatura ? `${o.montatura.modello} ${o.montatura.colore}` : "", totale: o.prezzi ? o.prezzi.totale : null, rata: o.prezzi ? o.prezzi.rata : null, finePeriodo: o.finePeriodo ? o.finePeriodo.descrizione : "", aggiornato: o.aggiornato || u.Creato, periodo: LISTINI.periodo(o), rinnovabile: LISTINI.rinnovabile(o)}; })
        .sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)))});
    }
    if (name === "benvenuto"){
      const u = s.utenti.find(x => x.Univoco === q("univoco")); if (!u) return ko(404, "Link non valido o scaduto.");
      const o = ottOf(u), od = ord(u);
      return ok({nome: u.Nome, cognome: u.Cognome, stato: u.Stato, ottico: o ? {id: o.ID, nome: o.Intestatario, indirizzo: o.Indirizzo, citta: o.Citta} : null,
        ordine: {montatura: od.montatura || null, lenti: od.lenti || null, trattamenti: od.trattamenti || [], prezzi: od.prezzi || null, pagamento: od.pagamento || null, finePeriodo: od.finePeriodo || null, periodo: LISTINI.periodo(od)}});
    }
    if (name === "montatura"){
      if (post){
        const u = s.utenti.find(x => x.Univoco === b.univoco); if (!u) return ko(404, "Cliente non trovato");
        if (![STATI.REGISTRATO, STATI.MONTATURA].includes(u.Stato)) return ko(409, "La montatura è già confermata: per cambiarla parla con l'ottico.");
        const m = s.montature.find(x => x.Codice === b.codice); if (!m || m.Stato !== "DISPONIBILE") return ko(409, "Montatura non più disponibile.");
        const od = ord(u);
        if (od.montatura){ const prima = s.montature.find(x => x.Codice === od.montatura.codice); if (prima) prima.Stato = "DISPONIBILE"; }
        od.montatura = {codice: m.Codice, modello: m.Modello, colore: m.Colore, calibro: m.Calibro, asse: m.Asse}; od.aggiornato = new Date().toISOString();
        m.Stato = "RISERVATA"; u.Stato = STATI.MONTATURA; u.Ordine = JSON.stringify(od);
        return done({ok: true, descrizione: `${m.Modello} ${m.Colore} ${m.Calibro}-${m.Asse}`});
      }
      const m = s.montature.find(x => x.Codice === q("codice"));
      return ok(m && m.Stato === "DISPONIBILE" ? {disponibile: true, codice: m.Codice, modello: m.Modello, colore: m.Colore, calibro: m.Calibro, asse: m.Asse} : {disponibile: false});
    }
    if (name === "ordine"){
      const u = s.utenti.find(x => x.Univoco === (post ? String(b.univoco) : q("univoco")).toUpperCase());
      if (!u || !String(u.Ottica1).startsWith(sess.id + " ")) return ko(404, "Cliente non trovato tra i clienti della tua ottica.");
      const od = ord(u), conv = LISTINI.conv(u.Listino);
      if (!post) return ok({nome: u.Nome, cognome: u.Cognome, stato: u.Stato, ordine: od, listino: {lenti: conv.lenti, trattamenti: conv.trattamenti, montatura: conv.montatura, mesi: LISTINI.LISTINI.mesi, spedizione: LISTINI.LISTINI.spedizione}});
      if (b.azione === "pronto" || b.azione === "consegnato"){
        u.Stato = b.azione === "pronto" ? STATI.PRONTO : STATI.CONSEGNATO; od.aggiornato = new Date().toISOString(); u.Ordine = JSON.stringify(od);
        const lk = this.link(u, ottOf(u), u.CAF);
        return done({ok: true, stato: u.Stato, avviso: b.azione === "pronto" ? {sms: false, whatsapp: `https://wa.me/39${u.Cellulare}?text=${encodeURIComponent(`SocialGlass: ${u.Nome}, i tuoi occhiali sono pronti! Passa a ritirarli in ottica con il codice ${u.Univoco}. ${lk}`)}`} : null});
      }
      if (![STATI.MONTATURA, STATI.PAGAMENTO].includes(u.Stato) || !od.montatura) return ko(409, "Il cliente deve prima scegliere la montatura con il QR.");
      const r = b.ricetta; if (!r.pd) return ko(400, "Inserisci la distanza pupillare (45-80 mm).");
      const prev = LISTINI.preventivo(u.Listino, b.lente, b.trattamenti); if (!prev) return ko(400, "Scegli il tipo di lenti.");
      Object.assign(od, {lenti: prev.lenti, trattamenti: prev.trattamenti, ricetta: r, prezzi: {montatura: prev.montatura, totale: prev.totale, mesi: prev.mesi, rata: prev.rata, spedizione: prev.spedizione, riscatto: prev.riscatto, modello: prev.modello}, aggiornato: new Date().toISOString()});
      u.Stato = STATI.PAGAMENTO; u.Ordine = JSON.stringify(od);
      const lk = this.link(u, ottOf(u), u.CAF);
      return done({ok: true, prezzi: od.prezzi, avviso: {sms: false, whatsapp: `https://wa.me/39${u.Cellulare}?text=${encodeURIComponent(`SocialGlass: ${u.Nome}, il tuo occhiale è pronto per l'ordine: ${prev.mesi} mesi a ${euro(prev.rata)}/mese. Apri il link, controlla il riepilogo e attiva l'abbonamento: ${lk}`)}`}});
    }
    if (name === "pagamento"){
      const u = s.utenti.find(x => x.Univoco === b.univoco); if (!u || u.Stato !== STATI.PAGAMENTO) return ko(409, "Non c'è un ordine da attivare.");
      const od = ord(u); od.pagamento = {stato: "SIMULATO", attivatoIl: new Date().toISOString(), ratePagate: 1}; od.aggiornato = od.pagamento.attivatoIl; u.Stato = STATI.ATTIVO; u.Ordine = JSON.stringify(od);
      return done({simulato: true});
    }
    if (name === "fine-periodo"){
      const u = s.utenti.find(x => x.Univoco === b.univoco); if (!u) return ko(404, "Cliente non trovato.");
      const D = {rinnova: "Rinnovo con occhiale nuovo", riscatta: "Riscatto: tiene l'occhiale", restituisci: "Restituzione e chiusura"};
      const od = ord(u); od.finePeriodo = {scelta: b.scelta, descrizione: D[b.scelta], il: new Date().toISOString()}; u.Ordine = JSON.stringify(od);
      return done({ok: true, descrizione: D[b.scelta]});
    }
    return ko(404, "Non trovato");
  }
};
async function api(path, opt = {}){
  await ready;
  if (DEMO === "browser") return local.call(path, opt);
  const tok = sessionStorage.getItem("sg_tok");
  const r = await fetch(path, Object.assign({}, opt, {headers: Object.assign({"Content-Type": "application/json"}, tok ? {Authorization: `Bearer ${tok}`} : {})}));
  let data = {}; try { data = await r.json(); } catch(e){}
  return {ok: r.ok, status: r.status, data};
}
const post = (path, body) => api(path, {method: "POST", body: JSON.stringify(body)});

/* ---------- accesso CAF e ottico ---------- */
const ruolo = () => sessionStorage.getItem("sg_tok") ? sessionStorage.getItem("sg_ruolo") : null;
$("loginButton").addEventListener("click", () => open(ruolo() === "caf" ? "optionsPopup" : "passwordPopup"));
$("otticoButton").addEventListener("click", () => open(ruolo() === "ottico" ? "optionsOtticoPopup" : "otticoPopup"));
$("mCaf").addEventListener("click", () => open(ruolo() === "caf" ? "optionsPopup" : "passwordPopup"));
$("mOtt").addEventListener("click", () => open(ruolo() === "ottico" ? "optionsOtticoPopup" : "otticoPopup"));
// il link del cliente non mostra gli accessi riservati
if (par("Univoco")) $("areaMobile").hidden = true;
document.querySelectorAll("form[data-login]").forEach(f => f.addEventListener("submit", async e => {
  e.preventDefault();
  const r0 = f.dataset.login, [c, p] = f.querySelectorAll("input"), err = f.querySelector("[data-err]"), btn = f.querySelector("button");
  err.hidden = true; btn.disabled = true;
  const r = await post("api/login", {ruolo: r0, codice: c.value, password: p.value});
  btn.disabled = false;
  if (!r.ok){ err.textContent = r.data.errore || "Codice o password non valida."; err.hidden = false; return; }
  sessionStorage.setItem("sg_tok", r.data.token); sessionStorage.setItem("sg_ruolo", r0); sessionStorage.setItem("sg_id", r.data.id); sessionStorage.setItem("sg_nome", r.data.nome);
  p.value = "";
  if (r0 === "caf"){ $("cafNome").textContent = r.data.nome; open("optionsPopup"); }
  else { $("ottNome").textContent = r.data.nome; $("codiceUnivocoContainer").textContent = "Cod.Ottico: " + r.data.id; open("optionsOtticoPopup"); }
}));
if (ruolo()){ $("cafNome").textContent = $("ottNome").textContent = sessionStorage.getItem("sg_nome") || ""; }
function scaduta(r){ if (r.status === 401){ sessionStorage.removeItem("sg_tok"); open(sessionStorage.getItem("sg_ruolo") === "ottico" ? "otticoPopup" : "passwordPopup"); return true; } return false; }

/* ---------- nuovo utente (CAF) ---------- */
const campi = ["nome","cognome","nato","datanascita","sesso","prefisso","cellulare","ottica","gdprAcceptance"];
function resetForm(){
  $("formCliente").reset(); $("codiceFiscale").disabled = false; $("attivaCodiceFiscale").hidden = false; $("segnoDiSpunta").hidden = true;
  campi.forEach(id => $(id).disabled = true); $("listinoTextBox").value = ""; $("inviaLink").disabled = true;
  $("cfEsito").hidden = true; $("formErr").hidden = true; cambiaBandiera();
}
let otticiCaricati = false;
async function loadOttici(){
  if (otticiCaricati) return;
  const r = await api("api/ottici"); if (scaduta(r) || !r.ok) return;
  const sel = $("ottica");
  for (const o of r.data.ottici){ const op = document.createElement("option"); op.value = o.id; op.textContent = o.label; op.dataset.listino = o.listino; sel.appendChild(op); }
  otticiCaricati = true;
}
$("ottica").addEventListener("change", e => { const op = e.target.selectedOptions[0]; $("listinoTextBox").value = op && op.dataset.listino ? "Convenzione " + op.dataset.listino : ""; });
function cambiaBandiera(){ const s = $("prefisso"), f = s.selectedOptions[0].dataset.flag; s.style.backgroundImage = `url('https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/3.5.0/flags/4x3/${f}.svg')`; }
$("prefisso").addEventListener("change", cambiaBandiera); cambiaBandiera();
["codiceFiscale","nome","cognome","nato","cfVerifica","cfRinnovo","utenteCodice","ordineCodice"].forEach(id => $(id).addEventListener("input", e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); try { e.target.setSelectionRange(p, p); } catch(_){} }));
$("attivaCodiceFiscale").addEventListener("click", async () => {
  const cf = $("codiceFiscale").value.trim();
  if (!CF.valido(cf)){ esito($("cfEsito"), "CODICE FISCALE NON VALIDO: controlla le 16 lettere e cifre.", "err"); return; }
  const r = await api(`api/utenti?cf=${encodeURIComponent(cf)}`); if (scaduta(r)) return;
  if (r.ok && r.data.stato){ esito($("cfEsito"), `ATTENZIONE ! CODICE FISCALE ${r.data.stato}${r.data.univoco ? " · codice " + r.data.univoco : ""}. Per un nuovo occhiale usa RINNOVO OCCHIALE.`, "err"); return; }
  esito($("cfEsito"), "", ""); $("attivaCodiceFiscale").hidden = true; $("segnoDiSpunta").hidden = false; $("codiceFiscale").disabled = true;
  campi.forEach(id => $(id).disabled = false); $("inviaLink").disabled = false; $("nome").focus();
});
$("formCliente").addEventListener("submit", async e => {
  e.preventDefault();
  const v = id => $(id).value.trim();
  const d = {cf: v("codiceFiscale"), nome: v("nome"), cognome: v("cognome"), nato: v("nato"), datanascita: v("datanascita"), sesso: v("sesso"), prefisso: v("prefisso"), cellulare: v("cellulare"), ottica: v("ottica"), gdpr: $("gdprAcceptance").checked};
  const manca = [["nome","Nome"],["cognome","Cognome"],["nato","Luogo di nascita"],["datanascita","Data di nascita"],["sesso","Sesso"],["cellulare","Cellulare"],["ottica","Ottica"]].filter(([k]) => !d[k]).map(([, n]) => n);
  if (manca.length || !d.gdpr){ esito($("formErr"), manca.length ? `Mancano: ${manca.join(", ")}.` : "Serve il consenso GDPR del cliente.", "err"); return; }
  if (!CF.coerente(d.cf, d.nome, d.cognome, d.datanascita, d.sesso)){ esito($("formErr"), "Il codice fiscale non corrisponde a nome, cognome, data di nascita e sesso: controlla i dati.", "err"); return; }
  $("inviaLink").disabled = true;
  const r = await post("api/utenti", d);
  $("inviaLink").disabled = false;
  if (scaduta(r)) return;
  if (!r.ok){ esito($("formErr"), r.data.errore || "Si è verificato un errore. Riprova.", "err"); return; }
  mostraLink(r.data, `${d.prefisso} ${d.cellulare}`);
});
function mostraLink(data, numero){
  $("inviatoTesto").textContent = data.smsInviato ? `SMS inviato a ${numero}. Codice del cliente:` : `Invia il link al cliente${numero ? " (" + numero + ")" : ""}. Codice del cliente:`;
  $("inviatoCodice").textContent = data.univoco; $("inviatoLink").textContent = data.link; $("inviatoWa").href = data.whatsapp;
  $("copiaLink").textContent = "Copia link";
  $("copiaLink").onclick = async () => { try { await navigator.clipboard.writeText(data.link); $("copiaLink").textContent = "Copiato"; } catch(_){ const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($("inviatoLink")); s.removeAllRanges(); s.addRange(rg); } };
  open("inviatoPopup");
}

/* ---------- verifica e rinnovo (CAF) ---------- */
$("formVerifica").addEventListener("submit", e => { e.preventDefault(); const ok = CF.valido($("cfVerifica").value); esito($("verificaEsito"), ok ? "Codice fiscale valido" : "Codice fiscale non valido", ok ? "ok" : "err"); });
$("formRinnovo").addEventListener("submit", async e => {
  e.preventDefault();
  const cf = $("cfRinnovo").value.trim(), box = $("rinnovoEsito");
  if (!CF.valido(cf)){ esito(box, "Codice fiscale non valido", "err"); return; }
  const r = await api(`api/utenti?cf=${encodeURIComponent(cf)}`); if (scaduta(r)) return;
  if (!r.data.stato){ esito(box, "Nessun cliente con questo codice fiscale: inseriscilo come nuovo utente.", "info"); return; }
  esito(box, `${r.data.nome} · codice ${r.data.univoco} · ${r.data.stato}`, "ok");
  if ([STATI.CONSEGNATO, STATI.ATTIVO, STATI.PRONTO].includes(r.data.stato)){
    const b = document.createElement("button"); b.type = "button"; b.className = "verde full"; b.textContent = "Avvia il rinnovo e invia il nuovo link"; b.style.marginTop = "8px";
    b.onclick = async () => { b.disabled = true; const x = await post("api/utenti", {azione: "rinnovo", cf}); if (scaduta(x)) return; if (x.ok) mostraLink(x.data, ""); else esito(box, x.data.errore, "err"); };
    box.appendChild(b);
  }
});

/* ---------- assistenza (ottico) ---------- */
$("formCerca").addEventListener("submit", async e => {
  e.preventDefault();
  const r = await api(`api/utenti?univoco=${encodeURIComponent($("utenteCodice").value.trim())}`); if (scaduta(r)) return;
  esito($("risultatoRicerca"), r.data.trovato ? `Il nome corrispondente è: ${r.data.nome} ${r.data.cognome} · ${r.data.stato}` : "Utente non trovato", r.data.trovato ? "ok" : "err");
});
$("come-funziona").addEventListener("click", () => open("comePopup"));

/* ---------- i miei clienti (CAF e ottico) ---------- */
let clienti = [];
async function apriClienti(){
  open("clientiPopup"); $("clientiLista").innerHTML = '<div class="vuoto">Caricamento…</div>';
  const r = await api("api/clienti"); if (scaduta(r)) return;
  clienti = r.ok ? r.data.clienti : [];
  const sel = $("filtroStato"); sel.length = 1;
  ORDINE_STATI.forEach(s => { if (clienti.some(c => c.stato === s)){ const o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o); } });
  disegnaClienti();
}
function rinnovoBtn(c, attr){
  if (c.stato !== STATI.CONSEGNATO) return "";
  return c.rinnovabile ? `<button type="button" class="verde" ${attr}>Rinnovo: occhiale nuovo</button>`
    : c.periodo ? `<span class="chip">Rinnovo dal ${new Date(c.periodo.preavviso).toLocaleDateString("it-IT")}</span>` : "";
}
function disegnaClienti(){
  const q = $("filtroClienti").value.trim().toUpperCase(), st = $("filtroStato").value, isOtt = ruolo() === "ottico";
  const l = clienti.filter(c => (!st || c.stato === st) && (!q || `${c.nome} ${c.cognome} ${c.univoco} ${c.cf || ""}`.includes(q)));
  $("clientiLista").innerHTML = l.length ? l.map(c => `<div class="cli">
      <div class="top"><div><b>${esc(c.nome)} ${esc(c.cognome)}</b><div class="cod">${esc(c.univoco)}${c.cf ? " · " + esc(c.cf) : ""}</div></div><div>${chip(c.stato)}${c.insoluto ? ' <span class="chip s3">RATA INSOLUTA</span>' : ""}</div></div>
      ${c.montatura ? `<div>Montatura: ${esc(c.montatura)}${c.totale ? ` · valore ${euro(c.totale)} · canone ${euro(c.rata)}/mese` : ""}</div>` : ""}
      ${c.periodo && !c.esito ? `<div>Abbonamento dal ${new Date(c.periodo.inizio).toLocaleDateString("it-IT")} · durata minima fino al <b>${new Date(c.periodo.scadenza).toLocaleDateString("it-IT")}</b>${c.periodo.aperto && !c.periodo.scaduto ? ` <span class="chip s2">SCADE TRA ${c.periodo.giorni} GIORNI</span>` : c.periodo.scaduto ? ' <span class="chip s2">MESE PER MESE</span>' : ""}</div>` : ""}
      ${c.esito ? `<div><span class="chip s4">${esc(c.esito)}</span></div>` : ""}
      ${c.finePeriodo ? `<div><span class="chip s2">SCELTA DEL CLIENTE: ${esc(c.finePeriodo)}</span></div>` : ""}
      ${c.daRitirare ? `<div><span class="chip s3">OCCHIALE DA RITIRARE</span></div>` : ""}
      ${c.avviso ? `<div class="avviso-cli">Avviso da inviare: ${esc(c.avviso.testo)}<br><a class="btn-link" target="_blank" rel="noopener" data-avvisato="${esc(c.univoco)}" href="${esc(c.avviso.whatsapp)}">Invia su WhatsApp</a></div>` : ""}
      <div class="az">${isOtt
        ? (c.stato === STATI.MONTATURA || c.stato === STATI.PAGAMENTO ? `<button type="button" data-ord="${esc(c.univoco)}">Inserisci lenti e ricetta</button>` : "")
          + (c.stato === STATI.ATTIVO ? `<button type="button" class="verde" data-azione="pronto" data-u="${esc(c.univoco)}">Segna pronto</button>` : "")
          + (c.stato === STATI.PRONTO ? `<button type="button" class="verde" data-azione="consegnato" data-u="${esc(c.univoco)}">Segna consegnato</button>` : "")
          + (c.daRitirare ? `<button type="button" data-azione="ritirato" data-u="${esc(c.univoco)}">Occhiale ritirato</button>` : "")
          + rinnovoBtn(c, `data-rinnovo-uv="${esc(c.univoco)}"`)
        : rinnovoBtn(c, `data-rinnovo="${esc(c.cf)}"`)
          + `<a class="btn-link" style="flex:0 0 auto" target="_blank" rel="noopener" href="https://wa.me/39${esc(String(c.cellulare || "").replace(/\D/g, ""))}">WhatsApp</a>`}</div>
    </div>`).join("") : `<div class="vuoto">Nessun cliente${isOtt ? " assegnato a questa ottica. Il cliente vede l'ottica scelta dal CAF nella sua pagina: se è un'altra, accedi con quel codice ottico." : "."}</div>`;
}
$("filtroClienti").addEventListener("input", disegnaClienti);
$("filtroStato").addEventListener("change", disegnaClienti);
$("clientiLista").addEventListener("click", async e => {
  const av = e.target.closest("[data-avvisato]");
  if (av){ post("api/clienti", {univoco: av.dataset.avvisato}).then(() => setTimeout(apriClienti, 1500)); return; }
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ord){ open("ordinePopup"); resetOrdine(); $("ordineCodice").value = b.dataset.ord; caricaOrdine(b.dataset.ord); return; }
  if (b.dataset.azione){
    b.disabled = true; const r = await post("api/ordine", {univoco: b.dataset.u, azione: b.dataset.azione}); if (scaduta(r)) return;
    if (!r.ok) alertBox(r.data.errore);
    await apriClienti();
    if (r.ok && r.data.avviso) avvisoCliente(r.data.avviso, "Occhiali segnati come pronti.");
    if (r.ok && b.dataset.azione === "ritirato") alertBox("Occhiale restituito: abbonamento chiuso.");
    return;
  }
  if (b.dataset.rinnovo || b.dataset.rinnovoUv){
    b.disabled = true; const x = await post("api/utenti", b.dataset.rinnovoUv ? {azione: "rinnovo", univoco: b.dataset.rinnovoUv} : {azione: "rinnovo", cf: b.dataset.rinnovo}); if (scaduta(x)) return;
    if (!x.ok){ b.disabled = false; alertBox(x.data.errore); return; }
    await apriClienti(); avvisoCliente(x.data.avviso || {whatsapp: x.data.whatsapp, sms: x.data.smsInviato}, "Rinnovo avviato: il cliente sceglie la nuova montatura e conferma il nuovo canone dal suo link.");
  }
});
function alertBox(t){ notaDemo(t); }
// avviso al cliente dopo un'azione dell'ottico: SMS automatico oppure WhatsApp con un tocco
function avvisoCliente(av, titolo){
  const box = document.createElement("div"); box.className = "esito ok";
  box.innerHTML = `${esc(titolo)} ${av.sms ? "Il cliente ha ricevuto un SMS." : `Avvisa il cliente: <a class="btn-link" style="display:inline-block;margin:6px 0 0" target="_blank" rel="noopener" href="${esc(av.whatsapp)}">Invia su WhatsApp</a>`}`;
  const host = $("clientiPopup").hidden ? $("ordineEsito") : $("clientiLista");
  if (host === $("ordineEsito")){ host.hidden = false; host.className = "esito ok"; host.innerHTML = box.innerHTML; } else host.prepend(box);
}

/* ---------- ordine cliente (ottico) ---------- */
let ordCorrente = null;
function resetOrdine(){ $("formOrdine").hidden = true; $("ordineEsito").hidden = true; $("ordineAzioni").hidden = true; $("formOrdine").reset(); ordCorrente = null; }
$("formOrdineCerca").addEventListener("submit", e => { e.preventDefault(); caricaOrdine($("ordineCodice").value.trim()); });
$("formRinnovoCf").addEventListener("submit", async e => {
  e.preventDefault(); const cf = $("rinnovoCf").value.trim().toUpperCase();
  if (!CF.valido(cf)){ esito($("ordineEsito"), "Codice fiscale non valido.", "err"); return; }
  const x = await post("api/utenti", {azione: "rinnovo", cf}); if (scaduta(x)) return;
  if (!x.ok){ esito($("ordineEsito"), x.data.errore, "err"); return; }
  $("rinnovoCf").value = "";
  avvisoCliente(x.data.avviso || {whatsapp: x.data.whatsapp, sms: x.data.smsInviato}, `Rinnovo avviato (codice ${x.data.univoco}): ora il cliente è della tua ottica. Fagli scegliere la montatura con il QR, poi inserisci lenti e ricetta.`);
});
async function caricaOrdine(cod){
  resetOrdine(); if (!cod) return;
  const r = await api(`api/ordine?univoco=${encodeURIComponent(cod.toUpperCase())}`); if (scaduta(r)) return;
  if (!r.ok){ esito($("ordineEsito"), r.data.errore, "err"); return; }
  const d = r.data, o = d.ordine || {}; ordCorrente = Object.assign({univoco: cod.toUpperCase()}, d);
  const m = o.montatura;
  if (!m || ![STATI.MONTATURA, STATI.PAGAMENTO].includes(d.stato)){
    esito($("ordineEsito"), `${d.nome} ${d.cognome} · ${d.stato}. ` + (!m ? "Il cliente deve prima scegliere la montatura con il QR (pulsante «Ho scelto la montatura» sul suo link)." : "L'ordine è già confermato."), m ? "ok" : "info");
    return;
  }
  $("ordineCliente").innerHTML = `<b>${esc(d.nome)} ${esc(d.cognome)}</b> · ${chip(d.stato)}<br>Montatura: <b>${esc(m.modello)} ${esc(m.colore)}</b> · calibro ${esc(m.calibro)}-${esc(m.asse)} · cod. ${esc(m.codice)}`;
  const L = d.listino;
  $("ordineLenti").innerHTML = Object.entries(L.lenti).map(([id, l], i) => `<label class="scelta"><input type="radio" name="lente" value="${id}" ${(o.lenti ? o.lenti.id === id : i === 0) ? "checked" : ""}><span class="t">${esc(l.nome)}<small>${esc(l.desc || "")}</small></span><span class="p">${euro(l.prezzo)}</span></label>`).join("");
  $("ordineTratt").innerHTML = Object.entries(L.trattamenti).map(([id, t]) => `<label class="scelta"><input type="checkbox" name="tratt" value="${id}" ${(o.trattamenti || []).some(x => x.id === id) ? "checked" : ""}><span class="t">${esc(t.nome)}</span><span class="p">+${euro(t.prezzo)}</span></label>`).join("");
  const f = $("formOrdine"), rc = o.ricetta;
  if (rc){ for (const e of ["OD","OS"]) for (const k of ["sf","cil","ax","add"]) if (rc[e] && rc[e][k] != null) f[`${e}_${k}`].value = String(rc[e][k]).replace(".", ","); if (rc.pd) f.pd.value = rc.pd; if (rc.note) f.note.value = rc.note; }
  else { try { const pd = JSON.parse(localStorage.getItem("ov_pd") || "null"); if (pd) f.pd.value = pd; } catch(e){} }
  f.hidden = false; calcolaOrdine();
}
function sceltaOrdine(){
  const f = $("formOrdine");
  return {lente: (f.querySelector("[name=lente]:checked") || {}).value, trattamenti: [...f.querySelectorAll("[name=tratt]:checked")].map(x => x.value)};
}
function calcolaOrdine(){
  if (!ordCorrente) return;
  const s = sceltaOrdine(), L = ordCorrente.listino;
  const lente = L.lenti[s.lente]; if (!lente) return;
  const tot = L.montatura + lente.prezzo + s.trattamenti.reduce((a, t) => a + L.trattamenti[t].prezzo, 0);
  const rata = Math.ceil(tot / L.mesi * 100) / 100;
  const canone = Math.max(LISTINI.LISTINI.abbonamento.minimoMensile, Math.ceil(tot * LISTINI.LISTINI.abbonamento.quotaAnnua / 12 * 10) / 10);
  $("ordineTotale").innerHTML = `Valore occhiale <b>${euro(tot)}</b> (montatura ${euro(L.montatura)} + lenti ${euro(lente.prezzo)}${s.trattamenti.length ? " + trattamenti" : ""})<br>Abbonamento <b>${euro(canone)}/mese</b> · durata minima ${L.mesi} mesi · spedizione ${euro(L.spedizione)}`;
  $("formOrdine").querySelectorAll("[name$=_add]").forEach(x => { x.disabled = s.lente !== "prog"; if (x.disabled) x.value = ""; });
}
$("formOrdine").addEventListener("change", calcolaOrdine);
$("formOrdine").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, v = n => f[n].value.trim().replace(",", ".");
  const s = sceltaOrdine();
  const ricetta = {OD: {sf: v("OD_sf"), cil: v("OD_cil"), ax: v("OD_ax"), add: v("OD_add")}, OS: {sf: v("OS_sf"), cil: v("OS_cil"), ax: v("OS_ax"), add: v("OS_add")}, pd: v("pd"), note: f.note.value.trim()};
  if (!ricetta.OD.sf && !ricetta.OS.sf){ esito($("ordineErr"), "Inserisci almeno lo sfero di un occhio (0 se neutro).", "err"); return; }
  if (!ricetta.pd){ esito($("ordineErr"), "Inserisci la distanza pupillare.", "err"); return; }
  $("ordineErr").hidden = true; $("ordineInvia").disabled = true;
  const r = await post("api/ordine", Object.assign({univoco: ordCorrente.univoco, ricetta}, s));
  $("ordineInvia").disabled = false;
  if (scaduta(r)) return;
  if (!r.ok){ esito($("ordineErr"), r.data.errore, "err"); return; }
  f.hidden = true;
  avvisoCliente(r.data.avviso || {sms: false, whatsapp: ""}, `Ordine inviato a ${ordCorrente.nome}: abbonamento ${euro(r.data.prezzi.rata)}/mese (valore occhiale ${euro(r.data.prezzi.totale)}). Il cliente vede il riepilogo sul suo link e attiva l'abbonamento dal telefono.`);
});

/* ---------- pagina personale del cliente ---------- */
const UNIVOCO = par("Univoco"), ESPOSITORE = par("espositore");
let mio = null, pollT = 0;
if (UNIVOCO || ESPOSITORE) $("scan-btn").hidden = false;
const TAPPE = [
  ["Registrato dal CAF", STATI.REGISTRATO],
  ["Montatura scelta", STATI.MONTATURA],
  ["Lenti e ricetta inserite", STATI.PAGAMENTO],
  ["Abbonamento attivato · occhiali in lavorazione", STATI.ATTIVO],
  ["Pronti per il ritiro", STATI.PRONTO],
  ["Consegnati", STATI.CONSEGNATO]
];
async function caricaMio(apri){
  const r = await api(`api/benvenuto?univoco=${encodeURIComponent(UNIVOCO)}&espositore=${encodeURIComponent(ESPOSITORE)}`);
  if (!r.ok){ if (apri){ $("mpTitolo").textContent = "Link non valido"; $("mpTappe").innerHTML = ""; $("mpAzione").innerHTML = `<div class="esito err">${esc(r.data.errore || "Link non valido o scaduto.")} Contatta il tuo CAF.</div>`; open("miaPagina"); } return null; }
  mio = r.data; $("mio-ordine").hidden = false; disegnaMio(); return mio;
}
const dt = d => new Date(d).toLocaleDateString("it-IT");
// regole di fine periodo spiegate al cliente, con le sue date
function regoleFine(p, per){
  const sc = per ? `il ${dt(per.scadenza)}` : `dopo ${p.mesi || 12} mesi`;
  return `<ul class="regole">
    <li><b>Occhiale nuovo:</b> vai dal tuo ottico (o da un altro ottico SocialGlass), scegli la nuova montatura e confermi il nuovo canone. L'abbonamento continua senza interruzioni.</li>
    <li><b>Lo tengo:</b> paghi una volta ${p.riscatto ? euro(p.riscatto) : "il riscatto"}, l'abbonamento si chiude e l'occhiale diventa tuo.</li>
    <li><b>Lo restituisco:</b> riporti l'occhiale in ottica entro 15 giorni; l'abbonamento si chiude a fine mese, senza altri costi.</li>
    <li><b>Se non scegli niente:</b> ${sc} l'abbonamento continua mese per mese allo stesso canone, con lo stesso occhiale, e puoi disdire quando vuoi.</li></ul>`;
}
function boxAbbonamento(od){
  const p = od.prezzi || {}, per = od.periodo, pg = od.pagamento || {};
  if (!per) return "";
  if (pg.chiuso || pg.esito) return `<div class="scheda"><b>Abbonamento</b><br>${esc(pg.esito || "Chiuso")}${pg.chiuso ? ` il ${dt(pg.chiuso)}` : ""}.${od.ritiro && od.ritiro.daRitirare && !od.ritiro.ritirato ? `<br><b>Riporta l'occhiale in ottica entro 15 giorni.</b>` : ""}</div>`;
  const fp = od.finePeriodo;
  const stato = per.scaduto ? `La durata minima è finita il ${dt(per.scadenza)}: l'abbonamento continua mese per mese.`
    : per.aperto ? `<b>Mancano ${per.giorni} giorni</b> alla fine della durata minima (${dt(per.scadenza)}). Scegli cosa fare:`
    : `Dal ${dt(per.preavviso)} ti scriviamo e puoi scegliere cosa fare. Puoi anche scegliere fin d'ora.`;
  return `<div class="scheda"><b>Il tuo abbonamento</b>
      <div class="date"><span>Inizio <b>${dt(per.inizio)}</b></span><span>Durata minima fino al <b>${dt(per.scadenza)}</b></span><span>Canone <b>${euro(p.rata)}/mese</b></span></div>
      <p style="margin:8px 0 4px">${stato}</p>${regoleFine(p, per)}
      ${fp ? `<div class="esito ok" style="margin-top:8px">Hai scelto: <b>${esc(fp.descrizione)}</b>.${fp.eseguita ? "" : per.scaduto ? " La eseguiamo a breve." : ` Vale dal ${dt(per.scadenza)}: puoi cambiare idea fino ad allora.`}</div>` : ""}
      ${fp && fp.eseguita ? "" : `<div class="scelte">
        <button type="button" class="${fp && fp.scelta === "rinnova" ? "verde" : "grigio"} full" data-fine="rinnova">Occhiale nuovo</button>
        <button type="button" class="${fp && fp.scelta === "riscatta" ? "verde" : "grigio"} full" data-fine="riscatta">Lo tengo${p.riscatto ? ` (${euro(p.riscatto)})` : ""}</button>
        <button type="button" class="${fp && fp.scelta === "restituisci" ? "verde" : "grigio"} full" data-fine="restituisci">Lo restituisco e chiudo</button></div>`}
    </div>`;
}
function disegnaMio(){
  const u = mio, o = u.ottico, od = u.ordine || {}, i = ORDINE_STATI.indexOf(u.stato);
  $("mpTitolo").textContent = `Ciao ${u.nome}`;
  $("mpTappe").innerHTML = TAPPE.map(([t], k) => `<li class="${k < i ? "fatto" : k === i ? "ora" : ""}">${t}${k === 1 && od.montatura ? `<br><small>${esc(od.montatura.modello)} ${esc(od.montatura.colore)}</small>` : ""}</li>`).join("");
  let a = "";
  const dove = o ? `<b>${esc(o.nome)}</b><br>${esc(o.indirizzo)}${esc(o.citta)}` : "";
  if (u.stato === STATI.REGISTRATO){
    a = `<div class="scheda">1) Vai dall'ottico:<br>${dove}<br>2) Mostra il tuo codice <b>${esc(UNIVOCO)}</b><br>3) Scegli la montatura e premi <b>«Ho scelto la montatura»</b> per inquadrare il QR sull'espositore.</div>
      <button type="button" class="verde full" id="mpScan">Ho scelto la montatura</button>`;
  } else if (u.stato === STATI.MONTATURA){
    a = `<div class="esito ok">Montatura scelta: <b>${esc(od.montatura.modello)} ${esc(od.montatura.colore)}</b>.</div><p style="margin:0 0 10px">Ora l'ottico inserisce le lenti e la tua ricetta. Questa pagina si aggiorna da sola e ti mandiamo un messaggio: tra poco vedrai il riepilogo con il canone mensile.</p>
      <button type="button" class="grigio full" id="mpScan">Ho cambiato idea: scansiona un'altra montatura</button>`;
  } else if (u.stato === STATI.PAGAMENTO && od.rinnovo && od.rinnovo.prosegue){
    const p = od.prezzi;
    a = `<div class="rata">Il tuo occhiale nuovo<b>${euro(p.rata)}/mese</b>l'abbonamento continua · nessun nuovo contratto</div>
      <div class="riepilogo">
        <div class="r"><span>Montatura ${esc(od.montatura.modello)} ${esc(od.montatura.colore)}</span><span>${euro(p.montatura)}</span></div>
        <div class="r"><span>Lenti ${esc(od.lenti.nome)}</span><span>${euro(od.lenti.prezzo)}</span></div>
        ${(od.trattamenti || []).map(t => `<div class="r"><span>${esc(t.nome)}</span><span>${euro(t.prezzo)}</span></div>`).join("")}
        <div class="r tot"><span>Valore dell'occhiale</span><span>${euro(p.totale)}</span></div>
        <div class="r"><span>Nuovo canone dal prossimo addebito</span><span>${euro(p.rata)}</span></div>
        <div class="r"><span>Spedizione, con il prossimo addebito</span><span>${euro(p.spedizione)}</span></div>
      </div>
      <div class="scheda"><b>Cosa succede adesso</b><ol class="passi-ora">
        <li>Confermi qui: non serve inserire di nuovo carta o IBAN.</li>
        <li>Dal prossimo mese paghi il nuovo canone; riparte la durata minima di ${p.mesi} mesi.</li>
        <li>L'ottico prepara il nuovo occhiale e ti avvisiamo quando è pronto. Il vecchio puoi tenerlo.</li></ol></div>
      <label class="consenso" for="c1"><input type="checkbox" id="c1"><span>Ho letto le <button type="button" class="linkbtn" id="mpCond">condizioni dell'abbonamento</button>: nuovo canone ${euro(p.rata)} al mese, durata minima ${p.mesi} mesi da oggi.</span></label>
      <label class="consenso" for="c2"><input type="checkbox" id="c2"><span>Confermo l'addebito mensile sul metodo di pagamento già registrato.</span></label>
      <div class="esito err" id="mpErr" hidden></div>
      <button type="button" class="verde full" id="mpPaga" data-rinnovo="1">Conferma l'occhiale nuovo</button>`;
  } else if (u.stato === STATI.PAGAMENTO){
    const p = od.prezzi;
    a = `<div class="rata">Abbonamento occhiale<b>${euro(p.rata)}/mese</b>durata minima ${p.mesi} mesi · niente interessi</div>
      <div class="scheda"><b>Cosa è incluso</b><ul class="servizi">${LISTINI.LISTINI.abbonamento.servizi.map(x => `<li>${esc(x)}</li>`).join("")}</ul></div>
      <div class="riepilogo">
        <div class="r"><span>Montatura ${esc(od.montatura.modello)} ${esc(od.montatura.colore)}</span><span>${euro(p.montatura)}</span></div>
        <div class="r"><span>Lenti ${esc(od.lenti.nome)}</span><span>${euro(od.lenti.prezzo)}</span></div>
        ${(od.trattamenti || []).map(t => `<div class="r"><span>${esc(t.nome)}</span><span>${euro(t.prezzo)}</span></div>`).join("")}
        <div class="r tot"><span>Valore dell'occhiale</span><span>${euro(p.totale)}</span></div>
        <div class="r"><span>Oggi paghi: primo mese + spedizione</span><span>${euro(p.rata + p.spedizione)}</span></div>
        <div class="r"><span>Poi ogni mese</span><span>${euro(p.rata)}</span></div>
        ${p.riscatto ? `<div class="r"><span>Dopo ${p.mesi} mesi, se vuoi tenerlo</span><span>${euro(p.riscatto)}</span></div>` : ""}
      </div>
      <div class="scheda"><b>Cosa succede adesso</b><ol class="passi-ora">
        <li>Premi il pulsante: si apre la pagina sicura di pagamento (Stripe).</li>
        <li>Inserisci carta o IBAN: paghi il primo mese e la spedizione.</li>
        <li>L'ottico riceve la conferma e prepara gli occhiali. Ti avvisiamo quando sono pronti.</li>
        <li>Dopo ${p.mesi} mesi scegli tu (ti avvisiamo 30 giorni prima):</li></ol>${regoleFine(p, null)}</div>
      <label class="consenso" for="c1"><input type="checkbox" id="c1"><span>Ho letto le <button type="button" class="linkbtn" id="mpCond">condizioni dell'abbonamento</button>: ${euro(p.rata)} al mese, durata minima ${p.mesi} mesi. L'occhiale resta dell'ottica finché non lo riscatto.</span></label>
      <label class="consenso" for="c2"><input type="checkbox" id="c2"><span>Autorizzo l'addebito mensile automatico su carta o conto (SEPA).</span></label>
      <div class="esito err" id="mpErr" hidden></div>
      <button type="button" class="verde full" id="mpPaga">Attiva l'abbonamento</button>
      <p class="nota-sicura">Pagamento gestito da Stripe. SocialGlass e l'ottico non vedono i dati della carta.</p>`;
  } else if (u.stato === STATI.ATTIVO){
    a = `<div class="esito ok"><b>Abbonamento attivo</b>${od.pagamento && od.pagamento.attivatoIl ? " dal " + dt(od.pagamento.attivatoIl) : ""}. ${od.pagamento && od.pagamento.rinnovato ? "Occhiale nuovo confermato." : "Pagamento ricevuto."}</div>
      <div class="scheda"><b>Cosa succede adesso</b><br>L'ottico ha ricevuto la conferma e sta preparando i tuoi occhiali (di solito 5-10 giorni). Quando sono pronti ti arriva un messaggio e questa pagina cambia.${o ? `<br><br>Ritiro presso ${dove}` : ""}</div>${boxAbbonamento(od)}`;
  } else if (u.stato === STATI.PRONTO){
    a = `<div class="esito ok"><b>I tuoi occhiali sono pronti!</b> Passa a ritirarli mostrando il codice <b>${esc(UNIVOCO)}</b>. L'ottico li regola sul tuo viso.</div>${o ? `<div class="scheda">${dove}</div>` : ""}${boxAbbonamento(od)}`;
  } else if (u.stato === STATI.CONSEGNATO){
    a = `<div class="esito ok">Occhiali consegnati. Buona visione! Controllo della vista e una sostituzione all'anno in caso di rottura sono inclusi: chiedi al tuo ottico.</div>${boxAbbonamento(od)}`;
  }
  const ins = od.pagamento && od.pagamento.insoluto;
  if (ins) a = `<div class="esito err"><b>Pagamento del mese non riuscito</b> (${euro(ins.importo)}). Riproveremo in automatico${ins.prossimoTentativo ? " il " + new Date(ins.prossimoTentativo).toLocaleDateString("it-IT") : ""}: controlla che la carta o il conto abbiano disponibilità.${ins.link ? `<br><a href="${esc(ins.link)}" target="_blank" rel="noopener">Paga ora o cambia metodo di pagamento</a>` : ""}</div>` + a;
  if (od.pagamento && od.pagamento.ratePagate && od.prezzi) a += `<p style="margin:8px 0 0;font-size:13px;color:#555">Mesi pagati: ${od.pagamento.ratePagate} (minimo ${od.prezzi.mesi})</p>`;
  $("mpAzione").innerHTML = a;
  const sc = $("mpScan"); if (sc) sc.onclick = startScan;
  const pc = $("mpPaga"); if (pc) pc.onclick = attivaRate;
  const cc = $("mpCond"); if (cc) cc.onclick = mostraCondizioni;
  $("mpAzione").querySelectorAll("[data-fine]").forEach(b => b.onclick = async () => {
    const T = {rinnova: "Vuoi un occhiale nuovo alla scadenza?", riscatta: "Vuoi tenere l'occhiale pagando il riscatto? L'abbonamento si chiude.", restituisci: "Vuoi restituire l'occhiale? L'abbonamento si chiude a fine mese."};
    if (!b.dataset.ok){ $("mpAzione").querySelectorAll("[data-fine]").forEach(x => { delete x.dataset.ok; x.textContent = x.dataset.t || x.textContent; }); b.dataset.t = b.textContent; b.dataset.ok = "1"; b.textContent = T[b.dataset.fine] + " Tocca di nuovo per confermare"; return; }
    b.disabled = true; const r = await post("api/fine-periodo", {univoco: UNIVOCO, scelta: b.dataset.fine});
    if (!r.ok){ b.disabled = false; notaDemo(r.data.errore || "Riprova."); return; }
    await caricaMio(false); disegnaMio();
  });
  clearTimeout(pollT);
  if (u.stato === STATI.MONTATURA || (u.stato === STATI.PAGAMENTO && od.pagamento && od.pagamento.stato === "IN CORSO")) pollT = setTimeout(async () => { const prima = mio && mio.stato; await caricaMio(false); if (mio && mio.stato !== prima && $("miaPagina").hidden === false) disegnaMio(); }, 15000);
}
async function attivaRate(){
  if (!$("c1").checked || !$("c2").checked){ esito($("mpErr"), "Per attivare l'abbonamento spunta entrambe le conferme.", "err"); return; }
  const rinnovo = !!$("mpPaga").dataset.rinnovo;
  if (!rinnovo && (DEMO === "browser" || (DEMO && !STRIPE))){ if (!(await checkoutProva())) return; }
  $("mpPaga").disabled = true; $("mpPaga").textContent = "Apro la pagina di pagamento…";
  const r = await post("api/pagamento", {univoco: UNIVOCO, consensoContratto: true, consensoAddebito: true});
  if (r.ok && r.data.url){ location.href = r.data.url; return; }
  $("mpPaga").disabled = false; $("mpPaga").textContent = rinnovo ? "Conferma l'occhiale nuovo" : "Attiva l'abbonamento";
  if (!r.ok){ esito($("mpErr"), r.data.errore || "Pagamento non riuscito. Riprova.", "err"); return; }
  await caricaMio(false); open("miaPagina");
}
// Pagina di pagamento di prova (stessi passaggi di Stripe Checkout) quando Stripe non è collegato
function checkoutProva(){
  return new Promise(res => {
    const p = mio.ordine.prezzi, d = document.createElement("div");
    d.className = "stripe-sim";
    d.innerHTML = `<div class="ss-box">
      <div class="ss-top"><span>← SocialGlass</span><span class="ss-test">MODALITÀ PROVA</span></div>
      <div class="ss-cols"><div class="ss-sx">
        <div class="ss-l">Abbonamento occhiale SocialGlass</div>
        <div class="ss-big">${euro(p.rata)} <small>al mese</small></div>
        <div class="ss-r"><span>Abbonamento mensile</span><span>${euro(p.rata)}</span></div>
        <div class="ss-r"><span>Spedizione (una volta)</span><span>${euro(p.spedizione)}</span></div>
        <div class="ss-r ss-t"><span>Totale dovuto oggi</span><span>${euro(p.rata + p.spedizione)}</span></div>
        <p class="ss-n">Durata minima ${p.mesi} mesi. Poi rinnovi, riscatti o restituisci.</p>
      </div><div class="ss-dx">
        <label>Email<input value="cliente@esempio.it"></label>
        <div class="ss-tab"><button type="button" class="on" data-m="card">Carta</button><button type="button" data-m="sepa">Addebito SEPA</button></div>
        <div data-p="card"><label>Dati della carta<input value="4242 4242 4242 4242" inputmode="numeric"></label>
          <div class="ss-2"><input value="12 / 34"><input value="123"></div></div>
        <div data-p="sepa" hidden><label>IBAN<input value="IT60 X054 2811 1010 0000 0123 456"></label>
          <p class="ss-n">Autorizzi SocialGlass e Stripe ad addebitare il conto secondo il mandato SEPA. Puoi chiedere il rimborso alla banca entro 8 settimane.</p></div>
        <label>Nome<input value="${esc(mio.nome)} ${esc(mio.cognome || "")}"></label>
        <button type="button" class="ss-pay">Abbonati</button>
        <button type="button" class="ss-ann">Annulla</button>
        <p class="ss-n">Questa è una simulazione: nessun addebito reale. Con Stripe collegato si apre la vera pagina di Stripe con gli stessi campi.</p>
      </div></div></div>`;
    document.body.appendChild(d);
    d.querySelectorAll(".ss-tab button").forEach(b => b.onclick = () => { d.querySelectorAll(".ss-tab button").forEach(x => x.classList.toggle("on", x === b)); d.querySelectorAll("[data-p]").forEach(x => x.hidden = x.dataset.p !== b.dataset.m); });
    d.querySelector(".ss-ann").onclick = () => { d.remove(); res(false); };
    d.querySelector(".ss-pay").onclick = e => { e.target.disabled = true; e.target.textContent = "Elaborazione…"; setTimeout(() => { e.target.textContent = "✓ Pagamento riuscito"; setTimeout(() => { d.remove(); res(true); }, 900); }, 1300); };
  });
}
function mostraCondizioni(){
  const p = mio.ordine.prezzi;
  const o = mio.ottico;
  $("condizioniTesto").innerHTML = `<p><b>Bozza da far verificare a un consulente legale.</b></p>
    <p><b>1. Cosa ricevi.</b> ${o ? esc(o.nome) : "L'ottica"} ti dà in uso un occhiale da vista con le tue lenti (valore ${euro(p.totale)}). L'occhiale resta di proprietà dell'ottica: non lo stai comprando a rate e non c'è nessun obbligo di acquisto.</p>
    <p><b>2. Quanto paghi.</b> ${euro(p.rata)} al mese, senza interessi né altri costi, più la spedizione (${euro(p.spedizione)}) una sola volta. Il primo mese si paga alla conferma, poi ogni mese nello stesso giorno con addebito automatico su carta o conto (SEPA).</p>
    <p><b>3. Durata e scadenza.</b> Minimo ${p.mesi} mesi. 30 giorni prima della scadenza ti avvisiamo con un messaggio e puoi scegliere:</p>${regoleFine(p, mio.ordine.periodo)}
    <p><b>Rinnovo.</b> Lo puoi fare dal tuo ottico, da un altro ottico SocialGlass o dal CAF, a partire da 30 giorni prima della scadenza. Non si possono avere due abbonamenti insieme.</p>
    <p><b>4. Servizi inclusi.</b> Controllo della vista ogni anno, una sostituzione all'anno in caso di rottura (escluso smarrimento), cambio occhiale ogni ${p.mesi} mesi.</p>
    <p><b>5. Se un pagamento non riesce.</b> Ti avvisiamo e riproviamo in automatico per circa 2 settimane. Puoi pagare subito dal link che ricevi. Se il pagamento resta non saldato per oltre 30 giorni, l'abbonamento si chiude e l'occhiale va restituito all'ottica (o riscattato pagando la differenza).</p>
    <p><b>6. Recesso.</b> Puoi ripensarci entro 14 giorni dalla conferma: restituisci l'occhiale integro e ti rimborsiamo quanto pagato, tranne la spedizione e le lenti già fatte su misura.</p>
    <p><b>7. Dati.</b> La ricetta è un dato sanitario: la vedono solo l'ottica e SocialGlass per preparare l'occhiale. I dati di pagamento li gestisce Stripe.</p>
    <p><b>8. Detrazione.</b> Per la detrazione fiscale chiedi all'ottica il documento fiscale dei canoni pagati (da verificare con il tuo CAF).</p>`;
  open("condizioniPopup");
}
$("mio-ordine").addEventListener("click", async () => { await caricaMio(true); open("miaPagina"); });
if (UNIVOCO){
  caricaMio(true).then(u => {
    if (!u) return;
    if (par("pagamento") === "ok"){ open("miaPagina"); return; }
    if (u.stato === STATI.REGISTRATO){
      const o = u.ottico;
      $("welcome-message").innerHTML = `Benvenuto da SocialGlass<br><span style="font-size:16px;color:darkgreen">${esc(u.nome)} ${esc(u.cognome)}</span><br><br>
        <div class="passi">1) Vai dall'ottico:<br><br><span style="color:darkgreen">${o ? esc(o.nome) + "<br>" + esc(o.indirizzo) + esc(o.citta) : ""}</span><br><br>2) Mostra questo codice:</div>
        <div class="codice-grande">${esc(UNIVOCO)}</div>
        <div class="passi">3) Scegli la montatura e le lenti<br>4) Attiva l'abbonamento mensile dal telefono<br>5) Paga solo il primo mese e la spedizione<br>6) Ogni anno un occhiale nuovo</div>`;
      setTimeout(() => { $("my-popup").hidden = false; }, 1200);
    } else setTimeout(() => open("miaPagina"), 600);
  });
}
$("continue-button").addEventListener("click", () => { $("my-popup").hidden = true; open("miaPagina"); });

/* ---------- scanner QR ---------- */
let stream = null, scanning = false, detector = null;
async function startScan(){
  closeAll(); $("video-container").hidden = false; $("video-container").querySelector("p").textContent = "Inquadra il QR code sulla montatura";
  try { stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false}); }
  catch(e){ $("video-container").querySelector("p").textContent = "Fotocamera non disponibile: scrivi il codice qui sotto."; return; }
  const v = $("preview"); v.srcObject = stream; await v.play();
  if ("BarcodeDetector" in window){ try { detector = new BarcodeDetector({formats: ["qr_code"]}); } catch(e){ detector = null; } }
  if (!detector && !window.jsQR) await new Promise(res => { const s = document.createElement("script"); s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js"; s.onload = res; s.onerror = res; document.head.appendChild(s); });
  scanning = true; loop();
}
const cvs = document.createElement("canvas"), cx = cvs.getContext("2d", {willReadFrequently: true});
async function loop(){
  if (!scanning) return;
  const v = $("preview");
  if (v.readyState >= 2){
    let txt = null;
    try {
      if (detector){ const r = await detector.detect(v); if (r.length) txt = r[0].rawValue; }
      else if (window.jsQR){ const w = 480, h = Math.round(w*v.videoHeight/v.videoWidth); cvs.width = w; cvs.height = h; cx.drawImage(v, 0, 0, w, h); const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h); if (r) txt = r.data; }
    } catch(e){}
    if (txt){ if (navigator.vibrate) navigator.vibrate(60); stopScan(); return verificaQR(txt); }
  }
  setTimeout(loop, 120);
}
function stopScan(){ scanning = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; $("video-container").hidden = true; }
function codiceDa(txt){ try { const u = new URL(txt); return u.searchParams.get("id") || u.searchParams.get("codice") || u.pathname.split("/").pop(); } catch(e){ return String(txt).trim(); } }
async function verificaQR(raw){
  const codice = codiceDa(raw), r = await api(`api/montatura?codice=${encodeURIComponent(codice)}`);
  const t = $("qr-text"), b = $("qr-btn");
  if (r.ok && r.data.disponibile){
    const m = r.data;
    t.innerHTML = `<b>MONTATURA DISPONIBILE</b><br>Modello: ${esc(m.modello)}<br>Colore: ${esc(m.colore)}<br>Calibro: ${esc(m.calibro)}<br>Asse: ${esc(m.asse)}`;
    b.hidden = !UNIVOCO; b.textContent = "CONTINUA";
    b.onclick = async () => {
      b.disabled = true; const s = await post("api/montatura", {univoco: UNIVOCO, codice: m.codice}); b.disabled = false;
      if (!s.ok){ t.textContent = s.data.errore || "Si è verificato un errore. Riprova."; b.hidden = true; return; }
      await caricaMio(false); open("miaPagina");
    };
    if (!UNIVOCO) t.insertAdjacentHTML("beforeend", "<br><br>Per sceglierla apri il link personale che hai ricevuto via SMS o WhatsApp.");
  } else { t.innerHTML = "CODICE NON VALIDO<br>MONTATURA NON DISPONIBILE"; b.hidden = true; }
  open("popup");
}
$("scan-btn").addEventListener("click", startScan);
$("close-video-btn").addEventListener("click", () => { stopScan(); if (mio) open("miaPagina"); });
$("qr-riprova").addEventListener("click", () => { $("popup").hidden = true; startScan(); });
$("formManuale").addEventListener("submit", e => { e.preventDefault(); const c = $("codiceManuale").value.trim(); if (!c) return; stopScan(); verificaQR(c); });
})();
