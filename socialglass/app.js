/* SocialGlass · logica della pagina. Parla con il server (/api); senza server usa dati di prova nel browser. */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const P = new URLSearchParams(location.search);
const par = k => P.get(k) || P.get(k.toLowerCase()) || "";

/* ---------- immagini mancanti: segnaposto nello stesso spirito ---------- */
const SVG = {
  scritta: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 120"><text x="300" y="82" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="78" font-weight="700" fill="#0A1F5C">Social<tspan fill="#0A1F5C">Glass</tspan></text><text x="300" y="112" text-anchor="middle" font-family="Arial" font-size="20" letter-spacing="6" fill="#8a8f98">VISIONE CONDIVISA</text></svg>`,
  simbolo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 120"><g fill="none" stroke="#0A1F5C" stroke-width="12" stroke-linecap="round"><circle cx="70" cy="66" r="42"/><circle cx="190" cy="66" r="42"/><path d="M112 60q18-14 36 0M28 56L8 40M232 56l20-16"/></g></svg>`,
  logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 170"><g fill="none" stroke="#0A1F5C" stroke-width="9" stroke-linecap="round"><circle cx="120" cy="52" r="30"/><circle cx="220" cy="52" r="30"/><path d="M150 48q20-12 40 0"/></g><text x="170" y="132" text-anchor="middle" font-family="Arial" font-size="46" font-weight="700" fill="#0A1F5C">Social<tspan fill="#0A1F5C">Glass</tspan></text><text x="170" y="160" text-anchor="middle" font-family="Arial" font-size="14" letter-spacing="5" fill="#8a8f98">VISIONE CONDIVISA</text></svg>`
};
document.querySelectorAll("img[data-fallback]").forEach(img => {
  const swap = () => { img.onerror = null; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SVG[img.dataset.fallback]); };
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
  const t = $("immagineCadente1"), s = $("immagineCadente2");
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const end = 140;
  const show2 = () => { if (!s.hasAttribute("data-off")){ s.hidden = false; s.style.top = (end + t.offsetHeight + 10) + "px"; } };
  if (reduce){ t.style.top = end + "px"; show2(); } else dropImage(t, -200, end, show2);
});

/* ---------- popup ---------- */
function open(id){ document.querySelectorAll(".popup").forEach(p => p.hidden = p.id !== id); const el = $(id); el.hidden = false; const f = el.querySelector("input:not([disabled]),select:not([disabled])"); if (f) setTimeout(() => f.focus(), 50); }
function closeAll(){ document.querySelectorAll(".popup").forEach(p => p.hidden = true); }
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]"); if (c){ c.closest(".popup").hidden = true; return; }
  const o = e.target.closest("[data-open]"); if (o){ if (o.hasAttribute("data-reset-form")) resetForm(); open(o.dataset.open); if (o.dataset.open === "popupForm") loadOttici(); return; }
  if (e.target.closest("[data-logout]")){ sessionStorage.removeItem("sg_tok"); closeAll(); }
  if (e.target.classList && e.target.classList.contains("popup")) e.target.hidden = true;
});
document.addEventListener("keydown", e => { if (e.key === "Escape"){ closeAll(); stopScan(); } });
function esito(el, txt, kind){ el.textContent = txt; el.className = "esito " + (kind || "info"); el.hidden = !txt; }

/* ---------- server o dati di prova ---------- */
let DEMO = false;
const ready = fetch("api/health", {cache: "no-store"}).then(r => r.ok ? r.json() : Promise.reject()).then(j => { DEMO = !!j.demo; if (DEMO) notaDemo("Server attivo senza Airtable: dati di prova."); })
  .catch(() => { DEMO = "browser"; notaDemo("Anteprima con dati di prova. Accesso CAF: CAF001 / demo · Ottico: OTT07 / demo"); });
function notaDemo(t){ const n = $("demoNota"); n.textContent = t; n.hidden = false; }

const local = {
  load(){ try { const s = JSON.parse(localStorage.getItem("sg_demo")); if (s && s.v === 1) return s; } catch(e){} return {v:1,
    caf:[{ID:"CAF001",Password:"demo",Nome:"CAF Demo"}], ottLogin:[{ID:"OTT07",Password:"demo"}],
    ottici:[{ID:"OTT07",Intestatario:"Ottica Demo Centro",Indirizzo:"Via Esempio 12, ",Citta:"Catania",Listino:"A"},{ID:"OTT12",Intestatario:"Ottica Demo Mare",Indirizzo:"Corso Prova 3, ",Citta:"Acireale",Listino:"B"}],
    utenti:[], montature:[{Codice:"SG-1042",Modello:"Aurora",Colore:"Nero",Calibro:"52-18",Asse:"145",Stato:"DISPONIBILE"},{Codice:"SG-1043",Modello:"Vela",Colore:"Tartaruga",Calibro:"50-20",Asse:"140",Stato:"DISPONIBILE"}]}; },
  save(s){ try { localStorage.setItem("sg_demo", JSON.stringify(s)); } catch(e){} },
  async call(path, opt){
    const s = this.load(), url = new URL(path, location.href), q = k => (url.searchParams.get(k) || "").trim(), b = opt && opt.body ? JSON.parse(opt.body) : {};
    const ok = d => ({ok:true, status:200, data:d}), ko = (st, m) => ({ok:false, status:st, data:{errore:m}});
    const tok = sessionStorage.getItem("sg_tok"); const sess = tok ? JSON.parse(atob(tok)) : null;
    const name = url.pathname.split("/").pop();
    if (name === "login"){
      const rec = (b.ruolo === "caf" ? s.caf : s.ottLogin).find(r => r.ID === String(b.codice).trim().toUpperCase());
      if (!rec || rec.Password !== b.password) return ko(401, "Codice o password non valida.");
      const nome = b.ruolo === "ottico" ? (s.ottici.find(o => o.ID === rec.ID) || {}).Intestatario || rec.ID : rec.Nome;
      return ok({token: btoa(JSON.stringify({ruolo:b.ruolo, id:rec.ID})), nome, id: rec.ID});
    }
    if (name === "ottici") return ok({ottici: s.ottici.map(f => ({id:f.ID, label:`${f.ID} - ${f.Intestatario} - ${f.Indirizzo}${f.Citta}`, listino:f.Listino}))});
    if (name === "utenti"){
      if ((opt && opt.method) === "POST"){
        const d = b;
        if (!CF.valido(d.cf)) return ko(400, "CODICE FISCALE NON VALIDO");
        if (!CF.coerente(d.cf, d.nome, d.cognome, d.datanascita, d.sesso)) return ko(400, "Codice fiscale non conforme a nome, cognome, data di nascita e sesso.");
        const g = s.utenti.find(u => u["Codice Fiscale"] === d.cf); if (g) return ko(409, `ATTENZIONE ! CODICE FISCALE ${g.Stato}`);
        const o = s.ottici.find(x => x.ID === d.ottica);
        const uv = "SG" + Math.random().toString(36).slice(2, 9).toUpperCase();
        s.utenti.unshift({Univoco:uv, CAF:sess.id, Nome:d.nome.toUpperCase(), Cognome:d.cognome.toUpperCase(), Cellulare:d.cellulare, "Codice Fiscale":d.cf, Ottica1:o.Intestatario, Listino:o.Listino, Stato:"IN ATTESA SCELTA MONTATURA"});
        this.save(s);
        const link = `${location.origin}${location.pathname}?Univoco=${uv}&espositore=${o.ID}&promotore=${sess.id}&listino=${o.Listino}`;
        const testo = `SocialGlass: ciao ${d.nome.toUpperCase()}, ecco il tuo link per scegliere i nuovi occhiali da ${o.Intestatario}: ${link}`;
        return ok({univoco:uv, link, smsInviato:false, whatsapp:`https://wa.me/${(d.prefisso + d.cellulare).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`, ottica:o.Intestatario});
      }
      if (q("cf")){ const cf = q("cf").toUpperCase(); if (!CF.valido(cf)) return ok({valido:false}); const u = s.utenti.find(x => x["Codice Fiscale"] === cf); return ok({valido:true, stato:u ? u.Stato : null, nome:u ? `${u.Nome} ${u.Cognome}` : null, univoco:u ? u.Univoco : null}); }
      if (q("univoco")){ const u = s.utenti.find(x => x.Univoco === q("univoco").toUpperCase()); return ok(u ? {trovato:true, nome:u.Nome, cognome:u.Cognome, stato:u.Stato} : {trovato:false}); }
    }
    if (name === "benvenuto"){
      const u = s.utenti.find(x => x.Univoco === q("univoco")), o = s.ottici.find(x => x.ID === q("espositore"));
      return u ? ok({nome:u.Nome, cognome:u.Cognome, stato:u.Stato, ottico:o ? {nome:o.Intestatario, indirizzo:o.Indirizzo, citta:o.Citta} : null}) : ko(404, "Link non valido o scaduto.");
    }
    if (name === "montatura"){
      if ((opt && opt.method) === "POST"){
        const m = s.montature.find(x => x.Codice === b.codice), u = s.utenti.find(x => x.Univoco === b.univoco);
        if (!m || m.Stato !== "DISPONIBILE") return ko(409, "Montatura non più disponibile.");
        if (!u) return ko(404, "Cliente non trovato");
        m.Stato = "RISERVATA"; u.Stato = "MONTATURA SCELTA"; this.save(s);
        return ok({ok:true, descrizione:`${m.Modello} ${m.Colore} ${m.Calibro}-${m.Asse}`});
      }
      const m = s.montature.find(x => x.Codice === q("codice"));
      return ok(m && m.Stato === "DISPONIBILE" ? {disponibile:true, codice:m.Codice, modello:m.Modello, colore:m.Colore, calibro:m.Calibro, asse:m.Asse} : {disponibile:false});
    }
    return ko(404, "Non trovato");
  }
};
async function api(path, opt = {}){
  await ready;
  const tok = sessionStorage.getItem("sg_tok");
  if (DEMO === "browser") return local.call(path, opt);
  const r = await fetch(path, Object.assign({}, opt, {headers: Object.assign({"Content-Type": "application/json"}, tok ? {Authorization: `Bearer ${tok}`} : {})}));
  let data = {}; try { data = await r.json(); } catch(e){}
  return {ok: r.ok, status: r.status, data};
}

/* ---------- accesso CAF e ottico ---------- */
$("loginButton").addEventListener("click", () => open(sessionStorage.getItem("sg_ruolo") === "caf" && sessionStorage.getItem("sg_tok") ? "optionsPopup" : "passwordPopup"));
$("otticoButton").addEventListener("click", () => open(sessionStorage.getItem("sg_ruolo") === "ottico" && sessionStorage.getItem("sg_tok") ? "optionsOtticoPopup" : "otticoPopup"));
$("areaMobile").addEventListener("click", () => open("passwordPopup"));
document.querySelectorAll("form[data-login]").forEach(f => f.addEventListener("submit", async e => {
  e.preventDefault();
  const ruolo = f.dataset.login, [c, p] = f.querySelectorAll("input"), err = f.querySelector("[data-err]");
  err.hidden = true;
  const btn = f.querySelector("button"); btn.disabled = true;
  const r = await api("api/login", {method: "POST", body: JSON.stringify({ruolo, codice: c.value, password: p.value})});
  btn.disabled = false;
  if (!r.ok){ err.textContent = r.data.errore || "Codice o password non valida."; err.hidden = false; return; }
  sessionStorage.setItem("sg_tok", r.data.token); sessionStorage.setItem("sg_ruolo", ruolo); sessionStorage.setItem("sg_id", r.data.id);
  p.value = "";
  if (ruolo === "caf"){ $("cafNome").textContent = r.data.nome; open("optionsPopup"); }
  else { $("ottNome").textContent = r.data.nome; $("codiceUnivocoContainer").textContent = "Cod.Ottico: " + r.data.id; open("optionsOtticoPopup"); }
}));
function scaduta(r){ if (r.status === 401){ sessionStorage.removeItem("sg_tok"); open(sessionStorage.getItem("sg_ruolo") === "ottico" ? "otticoPopup" : "passwordPopup"); return true; } return false; }

/* ---------- nuovo utente ---------- */
const campi = ["nome","cognome","nato","datanascita","sesso","prefisso","cellulare","ottica","gdprAcceptance"];
function resetForm(){
  $("formCliente").reset(); $("codiceFiscale").disabled = false; $("attivaCodiceFiscale").hidden = false; $("segnoDiSpunta").hidden = true;
  campi.forEach(id => $(id).disabled = true); $("listinoTextBox").value = ""; $("inviaLink").disabled = true;
  $("cfEsito").hidden = true; $("formErr").hidden = true; cambiaBandiera();
}
let otticiCaricati = false;
async function loadOttici(){
  if (otticiCaricati) return;
  const r = await api("api/ottici"); if (scaduta(r)) return;
  if (!r.ok) return;
  const sel = $("ottica");
  for (const o of r.data.ottici){ const op = document.createElement("option"); op.value = o.id; op.textContent = o.label; op.dataset.listino = o.listino; sel.appendChild(op); }
  otticiCaricati = true;
}
$("ottica").addEventListener("change", e => { const op = e.target.selectedOptions[0]; $("listinoTextBox").value = op ? op.dataset.listino || "" : ""; });
function cambiaBandiera(){ const s = $("prefisso"), f = s.selectedOptions[0].dataset.flag; s.style.backgroundImage = `url('https://cdnjs.cloudflare.com/ajax/libs/flag-icon-css/3.5.0/flags/4x3/${f}.svg')`; }
$("prefisso").addEventListener("change", cambiaBandiera); cambiaBandiera();
["codiceFiscale","nome","cognome","nato","cfVerifica","cfRinnovo","utenteCodice"].forEach(id => $(id).addEventListener("input", e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); try { e.target.setSelectionRange(p, p); } catch(_){} }));
$("attivaCodiceFiscale").addEventListener("click", async () => {
  const cf = $("codiceFiscale").value.trim();
  if (!CF.valido(cf)){ esito($("cfEsito"), "CODICE FISCALE NON VALIDO", "err"); return; }
  const r = await api(`api/utenti?cf=${encodeURIComponent(cf)}`); if (scaduta(r)) return;
  if (r.ok && r.data.stato){ esito($("cfEsito"), `ATTENZIONE ! CODICE FISCALE ${r.data.stato}${r.data.univoco ? " · codice " + r.data.univoco : ""}`, "err"); return; }
  esito($("cfEsito"), "", ""); $("attivaCodiceFiscale").hidden = true; $("segnoDiSpunta").hidden = false; $("codiceFiscale").disabled = true;
  campi.forEach(id => $(id).disabled = false); $("inviaLink").disabled = false; $("nome").focus();
});
$("formCliente").addEventListener("submit", async e => {
  e.preventDefault();
  const v = id => $(id).value.trim();
  const d = {cf: v("codiceFiscale"), nome: v("nome"), cognome: v("cognome"), nato: v("nato"), datanascita: v("datanascita"), sesso: v("sesso"), prefisso: v("prefisso"), cellulare: v("cellulare"), ottica: v("ottica"), gdpr: $("gdprAcceptance").checked};
  if (!d.nome || !d.cognome || !d.nato || !d.datanascita || !d.sesso || !d.cellulare || !d.ottica || !d.gdpr){ esito($("formErr"), "Per favore, compila tutti i campi obbligatori.", "err"); return; }
  if (!CF.coerente(d.cf, d.nome, d.cognome, d.datanascita, d.sesso)){ esito($("formErr"), "Codice fiscale non conforme a nome, cognome, data di nascita e sesso.", "err"); return; }
  $("inviaLink").disabled = true;
  const r = await api("api/utenti", {method: "POST", body: JSON.stringify(d)});
  $("inviaLink").disabled = false;
  if (scaduta(r)) return;
  if (!r.ok){ esito($("formErr"), r.data.errore || "Si è verificato un errore. Riprova.", "err"); return; }
  $("inviatoTesto").textContent = r.data.smsInviato ? `SMS inviato a ${d.prefisso} ${d.cellulare}. Codice del cliente:` : `Invia il link al cliente (${d.prefisso} ${d.cellulare}). Codice del cliente:`;
  $("inviatoCodice").textContent = r.data.univoco;
  $("inviatoLink").textContent = r.data.link;
  $("inviatoWa").href = r.data.whatsapp;
  $("copiaLink").onclick = async () => { try { await navigator.clipboard.writeText(r.data.link); $("copiaLink").textContent = "Copiato"; } catch(_){ const s = getSelection(), rg = document.createRange(); rg.selectNodeContents($("inviatoLink")); s.removeAllRanges(); s.addRange(rg); } };
  open("inviatoPopup");
});

/* ---------- verifica e rinnovo ---------- */
$("formVerifica").addEventListener("submit", e => { e.preventDefault(); const ok = CF.valido($("cfVerifica").value); esito($("verificaEsito"), ok ? "Codice fiscale valido" : "Codice fiscale non valido", ok ? "ok" : "err"); });
$("formRinnovo").addEventListener("submit", async e => {
  e.preventDefault();
  const cf = $("cfRinnovo").value.trim();
  if (!CF.valido(cf)){ esito($("rinnovoEsito"), "Codice fiscale non valido", "err"); return; }
  const r = await api(`api/utenti?cf=${encodeURIComponent(cf)}`); if (scaduta(r)) return;
  esito($("rinnovoEsito"), r.data.stato ? `${r.data.nome} · codice ${r.data.univoco} · ${r.data.stato}` : "Nessun cliente con questo codice fiscale: inseriscilo come nuovo utente.", r.data.stato ? "ok" : "info");
});
$("formCerca").addEventListener("submit", async e => {
  e.preventDefault();
  const r = await api(`api/utenti?univoco=${encodeURIComponent($("utenteCodice").value.trim())}`); if (scaduta(r)) return;
  esito($("risultatoRicerca"), r.data.trovato ? `Il nome corrispondente è: ${r.data.nome} ${r.data.cognome} · ${r.data.stato}` : "Utente non trovato", r.data.trovato ? "ok" : "err");
});
$("come-funziona").addEventListener("click", () => open("comePopup"));

/* ---------- link personale del cliente ---------- */
const UNIVOCO = par("Univoco"), ESPOSITORE = par("espositore");
if (UNIVOCO || ESPOSITORE) $("scan-btn").hidden = false;
if (UNIVOCO){
  api(`api/benvenuto?univoco=${encodeURIComponent(UNIVOCO)}&espositore=${encodeURIComponent(ESPOSITORE)}`).then(r => {
    if (!r.ok) return;
    const u = r.data, o = u.ottico;
    const h = $("welcome-message"); h.textContent = "";
    const esc = s => String(s || "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
    h.innerHTML = `Benvenuto da SocialGlass<br><span style="font-size:16px;color:darkgreen">${esc(u.nome)} ${esc(u.cognome)}</span><br><br>
      <div class="passi">1) Vai dall'ottico:<br><br><span style="color:darkgreen">${o ? esc(o.nome) + "<br>" + esc(o.indirizzo) + esc(o.citta) : ""}</span><br><br>2) Mostra questo codice:</div>
      <div class="codice-grande">${esc(UNIVOCO)}</div>
      <div class="passi">3) Scegli la montatura e le lenti<br>4) Attiva le mini rate mensili<br>5) Paga il costo della spedizione<br>6) Cambia gli occhiali ogni anno</div>`;
    if (u.stato === "MONTATURA SCELTA") h.insertAdjacentHTML("beforeend", `<div class="esito ok" style="margin-top:12px">Hai già scelto la montatura: l'ottico ti contatterà per le lenti.</div>`);
    setTimeout(() => { $("my-popup").hidden = false; }, 1500);
  });
}
$("continue-button").addEventListener("click", () => { $("my-popup").hidden = true; });

/* ---------- scanner QR ---------- */
let stream = null, scanning = false, detector = null;
async function startScan(){
  $("video-container").hidden = false;
  try {
    stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false});
  } catch(e){ $("video-container").querySelector("p").textContent = "Fotocamera non disponibile: scrivi il codice qui sotto."; return; }
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
      else if (window.jsQR){
        const w = 480, h = Math.round(w*v.videoHeight/v.videoWidth); cvs.width = w; cvs.height = h; cx.drawImage(v, 0, 0, w, h);
        const r = jsQR(cx.getImageData(0, 0, w, h).data, w, h); if (r) txt = r.data;
      }
    } catch(e){}
    if (txt){ stopScan(); return verifica(txt); }
  }
  setTimeout(loop, 120);
}
function stopScan(){ scanning = false; if (stream) stream.getTracks().forEach(t => t.stop()); stream = null; $("video-container").hidden = true; }
function codiceDa(txt){ try { const u = new URL(txt); return u.searchParams.get("id") || u.searchParams.get("codice") || u.pathname.split("/").pop(); } catch(e){ return String(txt).trim(); } }
async function verifica(raw){
  const codice = codiceDa(raw);
  const r = await api(`api/montatura?codice=${encodeURIComponent(codice)}`);
  const t = $("qr-text"), b = $("qr-btn");
  if (r.ok && r.data.disponibile){
    const m = r.data;
    t.innerHTML = `<b>MONTATURA DISPONIBILE</b><br>Modello: ${m.modello}<br>Colore: ${m.colore}<br>Calibro: ${m.calibro}<br>Asse: ${m.asse}`;
    b.hidden = !UNIVOCO; b.textContent = "CONTINUA";
    b.onclick = async () => {
      b.disabled = true;
      const s = await api("api/montatura", {method: "POST", body: JSON.stringify({univoco: UNIVOCO, codice: m.codice})});
      b.disabled = false;
      if (!s.ok){ t.textContent = s.data.errore || "Si è verificato un errore. Riprova."; b.hidden = true; return; }
      t.innerHTML = `<b>Montatura scelta!</b><br>${s.data.descrizione}<br><br>Mostra il tuo codice <b>${UNIVOCO}</b> all'ottico per scegliere le lenti e attivare le rate.`;
      b.hidden = true;
    };
    if (!UNIVOCO) t.insertAdjacentHTML("beforeend", "<br><br>Per sceglierla apri il link personale che hai ricevuto via SMS.");
  } else {
    t.innerHTML = "CODICE NON VALIDO<br>MONTATURA NON DISPONIBILE"; b.hidden = true;
  }
  open("popup");
}
$("scan-btn").addEventListener("click", startScan);
$("close-video-btn").addEventListener("click", stopScan);
$("qr-riprova").addEventListener("click", () => { $("popup").hidden = true; startScan(); });
$("formManuale").addEventListener("submit", e => { e.preventDefault(); const c = $("codiceManuale").value.trim(); if (!c) return; stopScan(); verifica(c); });

/* ---------- ripristino della sessione ---------- */
if (sessionStorage.getItem("sg_tok")){ /* resta collegato finché la scheda è aperta */ }
})();
