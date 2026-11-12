/* SocialGlass · logica della pagina. Parla con il server (/api); senza server usa dati di prova nel browser. */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const P = new URLSearchParams(location.search);
const par = k => P.get(k) || P.get(k.toLowerCase()) || "";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const euro = v => Number(v || 0).toLocaleString("it-IT", {style: "currency", currency: "EUR"});
// stampa: apre un foglio pulito (senza pulsanti né campi) e lancia la stampa; da lì si può anche salvare in PDF
function pulisciStampa(nodo){
  const c = nodo.cloneNode(true);
  c.querySelectorAll("button,form,input,select,textarea,a.btn-link,.no-stampa,script").forEach(x => x.remove());
  c.querySelectorAll("details").forEach(d => d.setAttribute("open", ""));
  c.querySelectorAll("[style]").forEach(x => { x.style.maxHeight = ""; x.style.overflow = ""; });
  return c.innerHTML;
}
function stampaDoc(titolo, corpo, pubblico){
  const w = window.open("", "_blank");
  if (!w){ alertStampa(); return false; }
  const t = (window.SG_INFO && SG_INFO.titolare) || {}, ora = new Date().toLocaleString("it-IT", {dateStyle: "short", timeStyle: "short"});
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>${esc(titolo)} · SocialGlass</title><style>
    @page{margin:12mm}body{font-family:Arial,Helvetica,sans-serif;font-size:10.5pt;color:#111;margin:0}
    header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0069D9;padding-bottom:4px;margin-bottom:10px}
    header b{font-size:15pt;color:#0069D9}header small{color:#555}h1{font-size:13pt;margin:0 0 8px}h2,h3{font-size:11.5pt;margin:12px 0 4px}
    table{border-collapse:collapse;width:100%;margin:4px 0 8px;page-break-inside:auto}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eef2f7}tr{page-break-inside:avoid}
    td.n,th.n{text-align:right}.dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:4px 0}.dl dt{color:#555}.dl dd{margin:0;font-weight:600}
    .scheda,.cli{border:1px solid #ccc;border-radius:6px;padding:6px 10px;margin:0 0 8px;page-break-inside:avoid}.chip{border:1px solid #888;border-radius:10px;padding:0 6px;font-size:8.5pt;margin-right:3px;white-space:nowrap}
    .conti{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:4px 0}.conti div{border:1px solid #ccc;border-radius:5px;padding:3px 6px;font-size:9pt}.conti b{display:block;font-size:11pt}
    .blocco{border:1px solid #c00;padding:4px 8px;border-radius:5px}.hint{color:#555;font-size:9pt}ul{margin:4px 0;padding-left:18px}summary{list-style:none;font-weight:600}
    footer{margin-top:14px;color:#777;font-size:8.5pt;border-top:1px solid #ddd;padding-top:4px}
  </style></head><body><header><b>SocialGlass</b><small>${esc(t.ragione || "")}${pubblico ? "" : (t.ragione ? " · " : "") + "stampato il " + ora}</small></header><h1>${esc(titolo)}</h1>${corpo}
  ${pubblico ? "" : "<footer>Documento riservato: contiene dati personali, da conservare e distruggere secondo il GDPR.</footer>"}
  <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
  w.document.close(); return true;
}
function alertStampa(){ const e = document.querySelector(".popup:not([hidden]) .esito") ; if (e){ e.hidden = false; e.className = "esito err"; e.textContent = "Il browser ha bloccato la finestra di stampa: consenti le finestre popup per questo sito."; } }
// periodi per i conteggi
function periodoDa(p, da, a){
  const o = new Date(), y = o.getFullYear(), m = o.getMonth(), f = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  if (p === "mese") return [f(new Date(y, m, 1)), f(new Date(y, m + 1, 0))];
  if (p === "mesePrec") return [f(new Date(y, m - 1, 1)), f(new Date(y, m, 0))];
  if (p === "tre") return [f(new Date(y, m - 2, 1)), f(new Date(y, m + 1, 0))];
  if (p === "anno") return [f(new Date(y, 0, 1)), f(new Date(y, 11, 31))];
  if (p === "annoPrec") return [f(new Date(y - 1, 0, 1)), f(new Date(y - 1, 11, 31))];
  if (p === "libero") return [da || "", a || ""];
  return ["", ""];
}
const PERIODI = [["", "Da sempre"], ["mese", "Questo mese"], ["mesePrec", "Mese scorso"], ["tre", "Ultimi 3 mesi"], ["anno", "Quest'anno"], ["annoPrec", "Anno scorso"], ["libero", "Dal… al…"]];
function campiPeriodo(pfx, st){
  return `<div class="filtri no-stampa" style="margin:4px 0 8px"><select id="${pfx}P" aria-label="Periodo">${PERIODI.map(([v, t]) => `<option value="${v}" ${st.p === v ? "selected" : ""}>${t}</option>`).join("")}</select>
    <input type="date" id="${pfx}Da" aria-label="Dal" value="${esc(st.da)}" ${st.p === "libero" ? "" : "hidden"} style="grid-column:auto"><input type="date" id="${pfx}A" aria-label="Al" value="${esc(st.a)}" ${st.p === "libero" ? "" : "hidden"} style="grid-column:auto"></div>`;
}
const testoPeriodo = k => k && k.periodo && (k.periodo.da || k.periodo.a) ? `dal ${k.periodo.da ? new Date(k.periodo.da).toLocaleDateString("it-IT") : "inizio"} al ${k.periodo.a ? new Date(k.periodo.a).toLocaleDateString("it-IT") : "oggi"}` : "da sempre";
// estratto conto del CAF o dell'ottica verso SocialGlass: compensi secondo l'accordo e pagamenti ricevuti
const dataIt = d => d ? new Date(d).toLocaleDateString("it-IT") : "";
function testoAccordo(acc){ return acc ? (acc.tipo === "fisso" ? `${euro(acc.valore)} per ogni abbonamento attivato` : `${String(acc.valore).replace(".", ",")}% su ogni canone pagato dai clienti`) : ""; }
function estrattoCorpo(e, conCliente){
  if (!e.accordo && !e.righe.length) return `<p class="hint">L'accordo economico con SocialGlass non è ancora stato impostato: chiedi all'amministratore.</p>`;
  return `<div class="conti"><div>Saldo a inizio periodo<b>${euro(e.saldoIniziale)}</b></div><div>Compensi maturati<b>${euro(e.maturato)}</b></div><div>Pagamenti ricevuti<b>${euro(e.pagato)}</b></div><div>Saldo a fine periodo<b>${euro(e.saldoFinale)}</b></div></div>
    <div class="hint" style="font-size:12.5px">Periodo: ${testoPeriodo(e)}. ${e.accordo ? "Accordo in vigore: " + testoAccordo(e.accordo) + (e.accordo.dal > "2000-01-01" ? ` (dal ${dataIt(e.accordo.dal)})` : "") + "." : ""}
      ${(e.accordi || []).length > 1 ? "Accordi precedenti: " + e.accordi.slice(0, -1).map((x, i) => `${x.tipo ? testoAccordo(x) : "nessun compenso"} ${x.dal > "2000-01-01" ? "dal " + dataIt(x.dal) : "dall'inizio"} al ${dataIt(new Date(new Date(e.accordi[i + 1].dal) - 864e5))}`).join("; ") + ". Ogni movimento usa l'accordo in vigore nel suo giorno." : ""} Da sempre: maturati ${euro(e.maturatoTot)}, ricevuti ${euro(e.pagatoTot)}, <b>da ricevere ${euro(e.saldoAttuale)}</b>.${e.stima ? " Le date dei canoni pagati prima del 9/11/2026 sono ricostruite (un canone al mese dall'attivazione)." : ""}</div>
    ${e.righe.length ? `<div style="overflow-x:auto"><table class="rx estr" style="width:100%;margin-top:6px"><tr><th style="text-align:left">Data</th><th style="text-align:left">Movimento</th>${conCliente ? '<th style="text-align:left">Cliente</th>' : ""}<th>Compenso</th><th>Pagamento</th><th>Saldo</th></tr>
      ${e.righe.map(x => `<tr><td style="text-align:left">${dataIt(x.il)}</td><td style="text-align:left">${esc(x.descrizione)}</td>${conCliente ? `<td style="text-align:left">${esc(x.cliente || "")}${x.univoco ? `<br><small>${esc(x.univoco)}</small>` : ""}</td>` : ""}
        <td>${x.tipo === "compenso" ? euro(x.importo) : ""}</td><td>${x.tipo === "pagamento" ? euro(x.importo) : ""}</td><td>${euro(x.saldo)}</td></tr>`).join("")}</table></div>` : '<p class="hint">Nessun movimento nel periodo.</p>'}`;
}
window.SG_STAMPA = {stampaDoc, pulisciStampa, periodoDa, campiPeriodo, estrattoCorpo, testoPeriodo, testoAccordo};

/* ---------- immagini mancanti: segnaposto ---------- */
const SVG = {
  simbolo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 260 120"><g fill="none" stroke="#0A1F5C" stroke-width="12" stroke-linecap="round"><circle cx="70" cy="66" r="42"/><circle cx="190" cy="66" r="42"/><path d="M112 60q18-14 36 0"/></g></svg>`,
  logo: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 120"><text x="170" y="70" text-anchor="middle" font-family="Arial" font-size="52" fill="#0A1F5C">Social Glasses</text></svg>`
};
document.querySelectorAll("img[data-fallback]").forEach(img => {
  const swap = () => { img.onerror = null; img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(SVG[img.dataset.fallback] || SVG.logo); };
  img.onerror = swap; if (img.complete && !img.naturalWidth) swap();
});

/* ---------- pannello amministratore: 7 tocchi sul logo, oppure indirizzo /admin ---------- */
function apriAdmin(){
  const go = () => window.SG_ADMIN && window.SG_ADMIN.apri();
  if (window.SG_ADMIN) return go();
  const sc = document.createElement("script"); sc.src = "admin.js?v=" + Date.now(); sc.onload = go; document.head.appendChild(sc);
}
{ let n = 0, t = 0;
  document.querySelectorAll("#mobile-image,#immagineCadente1").forEach(img => img.addEventListener("click", () => {
    clearTimeout(t); t = setTimeout(() => { n = 0; }, 2500);
    if (++n < 7) return; n = 0; apriAdmin();
  })); }

/* ---------- popup ---------- */
// accessibilità: ogni finestra è un dialogo modale con titolo, il focus resta dentro e torna dove era
document.querySelectorAll(".popup").forEach((p, i) => {
  const c = p.querySelector(".popup-content"), h = c && c.querySelector("h2");
  if (!c) return; c.setAttribute("role", "dialog"); c.setAttribute("aria-modal", "true");
  if (h){ h.id = h.id || "tit" + i; c.setAttribute("aria-labelledby", h.id); }
});
document.querySelectorAll(".esito").forEach(e => { e.setAttribute("role", e.classList.contains("err") ? "alert" : "status"); e.setAttribute("aria-live", "polite"); });
let primaDelPopup = null;
document.addEventListener("keydown", e => {
  if (e.key !== "Tab") return;
  const p = [...document.querySelectorAll(".popup")].find(x => !x.hidden); if (!p) return;
  const f = [...p.querySelectorAll("button,a[href],input,select,textarea,summary,[tabindex]:not([tabindex='-1'])")].filter(x => !x.disabled && x.offsetParent !== null);
  if (!f.length) return;
  if (!p.contains(document.activeElement)){ e.preventDefault(); f[0].focus(); return; }
  if (e.shiftKey && document.activeElement === f[0]){ e.preventDefault(); f[f.length - 1].focus(); }
  else if (!e.shiftKey && document.activeElement === f[f.length - 1]){ e.preventDefault(); f[0].focus(); }
});
// "Indietro": si torna alla finestra precedente (es. dal modulo cliente al menu del CAF o dell'ottico)
const NON_IN_STORIA = ["passwordPopup", "otticoPopup"];
let storia = [];
document.querySelectorAll(".popup .popup-content").forEach(c => {
  const b = document.createElement("button"); b.type = "button"; b.className = "back-btn"; b.hidden = true; b.textContent = "← Indietro"; b.setAttribute("aria-label", "Torna alla finestra precedente");
  b.addEventListener("click", indietro); c.prepend(b);
});
function aggiornaIndietro(){
  document.querySelectorAll(".popup").forEach(p => { const b = p.querySelector(".back-btn"), c = p.querySelector(".popup-content"); if (!b) return; const si = !p.hidden && storia.length > 0; b.hidden = !si; if (c) c.classList.toggle("con-indietro", si); });
}
// cronologia del browser allineata alle finestre aperte
let nStati = 0, ignoraPop = false;
const spingi = () => { try { history.pushState({sg: 1}, ""); nStati++; } catch(_){} };
const scarica = n => { n = Math.min(n, nStati); if (n > 0){ nStati -= n; ignoraPop = true; try { history.go(-n); } catch(_){ ignoraPop = false; } } };
function indietro(daPop){
  const prev = storia.pop(); if (!prev) return closeAll(daPop);
  if (daPop !== true) scarica(1);
  open(prev, true);
  if (prev === "optionsPopup" || prev === "optionsOtticoPopup") apriCruscotto(prev === "optionsPopup" ? "caf" : "ottico", true);   // numeri aggiornati al ritorno
}
// tasto «indietro» del telefono o del browser: chiude la finestra aperta invece di uscire dal sito
window.addEventListener("popstate", () => {
  if (ignoraPop){ ignoraPop = false; return; }
  nStati = Math.max(0, nStati - 1);
  if (!$("video-container").hidden){ stopScan(); return; }
  const aperta = [...document.querySelectorAll(".popup")].find(x => !x.hidden); if (!aperta) return;
  if (storia.length) indietro(true); else closeAll(true);
});
function open(id, daIndietro){
  const aperta = [...document.querySelectorAll(".popup")].find(x => !x.hidden);
  if (!aperta){ primaDelPopup = document.activeElement; spingi(); }
  else if (!daIndietro && aperta.id !== id) spingi();
  if (!daIndietro){ if (aperta && aperta.id !== id && !NON_IN_STORIA.includes(aperta.id)) storia.push(aperta.id); else if (!aperta) storia = []; }
  setTimeout(aggiornaIndietro, 0);
  document.querySelectorAll(".popup").forEach(p => p.hidden = p.id !== id);
  const el = $(id); el.hidden = false;
  setTimeout(() => { if (!el.contains(document.activeElement)){ const t = el.querySelector("h2"); if (t){ t.tabIndex = -1; t.focus({preventScroll: true}); } } }, 60);
  const f = el.querySelector("input:not([disabled]):not([type=checkbox]):not([type=radio]),select:not([disabled])");
  if (f && !("ontouchstart" in window)) setTimeout(() => f.focus(), 50);
}
function closeAll(daPop){ document.querySelectorAll(".popup").forEach(p => p.hidden = true); storia = []; if (daPop !== true) scarica(nStati); else nStati = 0; ritornaFocus(); }
function ritornaFocus(){ if (primaDelPopup && document.contains(primaDelPopup)) try { primaDelPopup.focus(); } catch(_){} primaDelPopup = null; }
document.addEventListener("click", e => {
  const c = e.target.closest("[data-close]");
  // le finestre aperte dalla pagina del cliente (tessera, prenota…) con la X tornano all'ordine
  if (c && c.closest("#extraPopup") && storia.length){ indietro(); return; }
  if (c){ c.closest(".popup").hidden = true; storia = []; scarica(nStati); ritornaFocus(); return; }
  const o = e.target.closest("[data-open]");
  if (o){ if (o.hasAttribute("data-reset-form")) resetForm(); open(o.dataset.open); if (o.dataset.open === "popupForm") loadOttici(); if (o.dataset.open === "ordinePopup") resetOrdine(); return; }
  if (e.target.closest("[data-logout]")){ ["sg_tok","sg_ruolo","sg_id","sg_listino"].forEach(k => sessionStorage.removeItem(k)); cruDati = null; closeAll(); return; }
  if (e.target.closest("[data-clienti]")){ apriClienti({}); return; }
  if (e.target.classList && e.target.classList.contains("popup") && !e.target.classList.contains("pagina")){ e.target.hidden = true; storia = []; scarica(nStati); }
});
document.addEventListener("keydown", e => { if (e.key === "Escape"){ closeAll(); stopScan(); } });
function esito(el, txt, kind){ el.textContent = txt; el.className = "esito " + (kind || "info"); el.setAttribute("role", kind === "err" ? "alert" : "status"); el.hidden = !txt; }

/* ---------- stati ---------- */
const STATI = {REGISTRATO: "IN ATTESA SCELTA MONTATURA", MONTATURA: "MONTATURA SCELTA", PAGAMENTO: "IN ATTESA PAGAMENTO",
  ATTIVO: "ABBONAMENTO ATTIVO - IN LAVORAZIONE", PRONTO: "PRONTO PER IL RITIRO", CONSEGNATO: "CONSEGNATO"};
const ORDINE_STATI = [STATI.REGISTRATO, STATI.MONTATURA, STATI.PAGAMENTO, STATI.ATTIVO, STATI.PRONTO, STATI.CONSEGNATO];
const chip = s => { const i = ORDINE_STATI.indexOf(s); return `<span class="chip s${i < 0 ? 6 : i + 1}">${esc(s || "—")}</span>`; };

/* ---------- server o dati di prova ---------- */
let DEMO = false, STRIPE = false;
const ready = fetch("api/health", {cache: "no-store"}).then(r => r.ok ? r.json() : Promise.reject()).then(j => { window.SG_INFO = j; DEMO = !!j.demo; STRIPE = !!j.stripe; if (DEMO) notaDemo("Server attivo senza Airtable: dati di prova."); })
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
    if (name === "utenti" && q("ottici")) return ok({ottici: s.ottici.map(f => ({id: f.ID, label: `${f.ID} - ${f.Intestatario} - ${f.Indirizzo}${f.Citta}`, listino: f.Listino}))});
    if (name === "utenti"){
      if (post && b.azione === "rinnovo"){
        const u = s.utenti.find(x => b.univoco ? x.Univoco === String(b.univoco).toUpperCase() : x["Codice Fiscale"] === String(b.cf).toUpperCase()); if (!u) return ko(404, "Cliente non trovato. Controlla il codice fiscale.");
        const o = ord(u);
        if (!LISTINI.rinnovabile(o)){ const p = LISTINI.periodo(o); return ko(409, `Rinnovo possibile dal ${new Date(p.preavviso).toLocaleDateString("it-IT")} (30 giorni prima della scadenza del ${new Date(p.scadenza).toLocaleDateString("it-IT")}).`); }
        const nuova = sess.ruolo === "ottico" ? sess.id : b.ottica; const no = s.ottici.find(x => x.ID === nuova); if (no){ u.Ottica1 = `${no.ID} - ${no.Intestatario} - ${no.Indirizzo}${no.Citta}`; u.Listino = no.Listino; }
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
      if (q("cf")){ const cf = q("cf").toUpperCase(); if (!CF.valido(cf)) return ok({valido: false}); const u = s.utenti.find(x => x["Codice Fiscale"] === cf); const o = u ? ord(u) : null, per = o ? LISTINI.periodo(o) : null;
        return ok({valido: true, stato: u ? u.Stato : null, nome: u ? `${u.Nome} ${u.Cognome}` : null, univoco: u ? u.Univoco : null, ottica: u ? String(u.Ottica1).split(" - ")[0] : null, rinnovabile: u ? u.Stato === STATI.CONSEGNATO && LISTINI.rinnovabile(o) : false, rinnovoDal: per ? per.preavviso : null}); }
      if (q("univoco")){ const u = s.utenti.find(x => x.Univoco === q("univoco").toUpperCase()); return ok(u ? {trovato: true, nome: u.Nome, cognome: u.Cognome, stato: u.Stato} : {trovato: false}); }
    }
    if (name === "clienti"){
      const rows = s.utenti.filter(u => sess.ruolo === "caf" ? u.CAF === sess.id : String(u.Ottica1).startsWith(sess.id + " "));
      return ok({clienti: rows.map(u => { const o = ord(u); return {univoco: u.Univoco, nome: u.Nome, cognome: u.Cognome, stato: u.Stato, cf: sess.ruolo === "caf" ? u["Codice Fiscale"] : undefined, cellulare: u.Cellulare,
        montatura: o.montatura ? `${o.montatura.modello} ${o.montatura.colore}` : "", totale: o.prezzi ? o.prezzi.totale : null, rata: o.prezzi ? o.prezzi.rata : null, finePeriodo: o.finePeriodo ? o.finePeriodo.descrizione : "", aggiornato: o.aggiornato || u.Creato, periodo: LISTINI.periodo(o), rinnovabile: LISTINI.rinnovabile(o), link: this.link(u, ottOf(u) || s.ottici[0], u.CAF)}; })
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
      if (!post) return ok({nome: u.Nome, cognome: u.Cognome, stato: u.Stato, ordine: od, listino: {id: u.Listino, lenti: conv.lenti, trattamenti: conv.trattamenti, montatura: conv.montatura, mesi: LISTINI.LISTINI.mesi, spedizione: LISTINI.LISTINI.spedizione}});
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
const entra = r0 => ruolo() === r0 ? apriCruscotto(r0) : open(r0 === "caf" ? "passwordPopup" : "otticoPopup");
$("loginButton").addEventListener("click", () => entra("caf")); $("mCaf").addEventListener("click", () => entra("caf"));
$("otticoButton").addEventListener("click", () => entra("ottico")); $("mOtt").addEventListener("click", () => entra("ottico"));
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
  if (r.data.listino) sessionStorage.setItem("sg_listino", r.data.listino);
  p.value = ""; cruDati = null;
  if (r0 === "ottico") $("codiceUnivocoContainer").textContent = "Cod.Ottico: " + r.data.id;
  apriCruscotto(r0);
}));
function scaduta(r){ if (r.status === 401){ sessionStorage.removeItem("sg_tok"); open(sessionStorage.getItem("sg_ruolo") === "ottico" ? "otticoPopup" : "passwordPopup"); return true; } return false; }

/* ---------- cruscotti CAF e ottico ---------- */
const ICO = {
  agenda: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h2M8 18h2M14 14h2"/>',
  segn: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  nuovo: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/>',
  cf: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 10h5M7 14h3M15 13l2 2 3-4"/>',
  rinnovo: '<path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/>',
  clienti: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  conti: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  stampa: '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  chiave: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 21 2M16 7l3 3"/>',
  aiuto: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  ordine: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M10 15h4M2.5 13 5 5M21.5 13 19 5"/>',
  esposte: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  listino: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1"/>',
  cerca: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>'
};
const ico = k => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICO[k]}</svg>`;
const tessera = (k, titolo, sotto, attr, primo) => `<button type="button" ${attr}${primo ? ' class="primo"' : ""}>${ico(k)}<span>${titolo}</span><small>${sotto}</small></button>`;
const giorniDa = d => d ? (Date.now() - new Date(d)) / 864e5 : 0;
let cruDati = null;
async function apriCruscotto(r0, silenzioso){
  const isOtt = r0 === "ottico";
  if (!silenzioso){ open(isOtt ? "optionsOtticoPopup" : "optionsPopup"); disegnaCruscotto(isOtt, cruDati); }
  const r = await api("api/clienti"); if (scaduta(r)) return;
  cruDati = r.ok ? r.data : {clienti: []}; clienti = cruDati.clienti || [];
  if (cruDati.listini) Object.assign(LISTINI.LISTINI.convenzioni, cruDati.listini);
  if (ruolo() === r0) disegnaCruscotto(isOtt, cruDati);
}
function disegnaCruscotto(isOtt, d){
  const box = $(isOtt ? "cruOtt" : "cruCaf"), nome = sessionStorage.getItem("sg_nome") || "", id = sessionStorage.getItem("sg_id") || "";
  const oggi = new Date().toLocaleDateString("it-IT", {weekday: "long", day: "numeric", month: "long"});
  const testa = `<div class="cru-top"><div><span class="cru-ruolo">${isOtt ? "OTTICA" : "CAF"} · ${esc(id)}</span><div class="cru-nome">${esc(nome)}</div><p>${oggi}</p></div><button type="button" class="grigio" data-logout style="margin:0">Esci</button></div>`;
  if (!d){ box.innerHTML = testa + `<div class="cru-kpi">${'<div class="scheletro"></div>'.repeat(4)}</div><div class="scheletro" style="height:160px"></div>`; return; }
  const l = d.clienti || [], n = f => l.filter(f).length, e = d.estratto, attivi = n(c => c.attivatoIl && !c.chiuso);
  const kpi = (v, t, attr, cl) => `<button type="button" ${attr}${cl ? ` class="${cl}"` : ""}><b>${v}</b>${t}</button>`;
  const fare = [], f = (num, t, sotto, attr, urg) => { if (num) fare.push(`<button type="button" ${attr}${urg ? ' class="urg"' : ""}><span class="n">${num}</span><span>${t}<small>${sotto}</small></span><span class="va">Apri ›</span></button>`); };
  let k, tess;
  if (isOtt){
    const esp = (d.esposte || []).reduce((t, m) => t + m.qta, 0);
    const oggiR = new Date().toLocaleDateString("sv-SE"), appOggi = (d.appuntamenti || []).filter(a => a.il.slice(0, 10) === oggiR).length;
    f((d.segnalazioni || []).length, "Segnalazioni dei clienti", "Un problema con l'occhiale: rispondi o fissa un appuntamento", "data-segn", true);
    f(appOggi, "Appuntamenti di oggi", "Clienti che hanno prenotato dal loro link", "data-agenda");
    f(n(c => c.avviso), "Avvisi da inviare ai clienti", "Messaggio già pronto: basta un tocco", 'data-vai="sit:avvisi"', true);
    f(n(c => c.stato === STATI.MONTATURA), "Preventivi da inserire", "Il cliente ha scelto la montatura: inserisci lenti e ricetta", `data-vai="stato:${STATI.MONTATURA}"`);
    f(n(SIT_P.lab), "Montature da dare al laboratorio", "Mettile da parte con il codice del cliente", 'data-vai="sit:lab"');
    f(n(c => c.stato === STATI.PRONTO), "Occhiali pronti da consegnare", "Quando il cliente li ritira, segna «consegnato»", `data-vai="stato:${STATI.PRONTO}"`);
    f(n(c => c.daRitirare), "Occhiali da ritirare dal cliente", "Fine abbonamento, recesso o rinnovo", 'data-vai="sit:ritiro"', l.some(c => c.ritiroInRitardo));
    f(n(c => c.stato === STATI.PAGAMENTO), "Clienti che devono attivare l'abbonamento", "Preventivo inviato: ricordaglielo", `data-vai="stato:${STATI.PAGAMENTO}"`);
    f(n(c => c.rinnovabile && c.stato === STATI.CONSEGNATO && !c.bloccato), "Clienti che possono rinnovare", "Proponi l'occhiale nuovo", 'data-vai="sit:rinnovabili"');
    f(n(c => c.bloccato), "Anagrafiche bloccate", "Contatta SocialGlass prima di operare", 'data-vai="sit:bloccati"', true);
    tess = tessera("clienti", "I miei clienti", `${l.length} in elenco`, "data-clienti")
      + tessera("agenda", "Appuntamenti", `${(d.appuntamenti || []).length} in agenda · orari`, "data-agenda")
      + tessera("esposte", "Montature esposte", "Cosa hai in negozio", "data-esposte") + tessera("listino", "Listino e canoni", "Calcola il canone al cliente", "data-listino")
      + tessera("cerca", "Assistenza cliente", "Cerca per codice", 'data-open="popupAssistenza"') + tessera("conti", "I miei conteggi", "Compensi e pagamenti", "data-conti")
      + tessera("chiave", "Cambia password", "Del tuo accesso", 'data-open="passwordCambioPopup"') + tessera("aiuto", "Contatta SocialGlass", "Telefono ed email", "data-contatti");
  } else {
    f(n(SIT_P.fermi), "Non hanno ancora scelto la montatura", "Registrati da più di 3 giorni: reinvia il link", 'data-vai="sit:fermi"');
    f(n(c => c.stato === STATI.PAGAMENTO), "Devono attivare l'abbonamento", "Hanno il preventivo: un promemoria aiuta", `data-vai="stato:${STATI.PAGAMENTO}"`);
    f(n(SIT_P.scadenza), "Abbonamenti in scadenza", "Proponi il rinnovo con un occhiale nuovo", 'data-vai="sit:scadenza"');
    f(n(c => c.avviso), "Avvisi da inviare ai clienti", "Messaggio già pronto: basta un tocco", 'data-vai="sit:avvisi"', true);
    f(n(c => c.bloccato), "Anagrafiche bloccate", "Contatta SocialGlass prima di operare", 'data-vai="sit:bloccati"', true);
    tess = tessera("cf", "Verifica codice fiscale", "È già cliente?", 'data-open="codiceFiscalePopup"')
      + tessera("rinnovo", "Rinnovo occhiale", "Per chi è a fine periodo", 'data-open="rinnovoPopup"') + tessera("clienti", "I miei clienti", `${l.length} in elenco`, "data-clienti")
      + tessera("conti", "I miei conteggi", "Compensi e pagamenti", "data-conti") + tessera("stampa", "Locandina da appendere", "Stampa la locandina A4", "data-volantino")
      + tessera("chiave", "Cambia password", "Del tuo accesso", 'data-open="passwordCambioPopup"') + tessera("aiuto", "Contatta SocialGlass", "Telefono ed email", "data-contatti");
  }
  // solo due numeri che non compaiono altrove; un'azione principale ben visibile
  k = kpi(attivi, "Abbonamenti attivi", 'data-vai="sit:attivi"', "ok") + (e && e.accordo ? kpi(euro(e.saldoAttuale), "Compensi da ricevere", "data-conti") : "");
  const principale = isOtt ? tessera("ordine", "Ordine cliente", "Inserisci lenti, ricetta e preventivo", 'data-open="ordinePopup"', true)
    : tessera("nuovo", "Nuovo cliente", "Registra il cliente e invia il suo link", 'data-open="popupForm" data-reset-form', true);
  // il CAF non ha «Da fare oggi»: quei compiti li segue l'amministratore di SocialGlass
  const daFare = isOtt ? `<div class="cru-box"><h3>Da fare oggi</h3>${fare.length ? `<div class="fare">${fare.join("")}</div>` : '<div class="fare-vuoto"><b>✓</b> Tutto in ordine: non hai niente in sospeso.</div>'}</div>` : "";
  box.innerHTML = testa + `<div class="cru-principale">${principale}</div><div class="cru-kpi due">${k}</div><div class="cru-griglia${isOtt ? "" : " solo"}">${daFare}
    <div class="cru-box"><h3>${isOtt ? "Strumenti dell'ottica" : "Strumenti del CAF"}</h3><div class="tessere">${tess}</div></div></div>`;
}
// clic nei cruscotti
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b || !b.closest("#cruCaf,#cruOtt")) return;
  if (b.dataset.vai){ const [tipo, v] = [b.dataset.vai.slice(0, b.dataset.vai.indexOf(":")), b.dataset.vai.slice(b.dataset.vai.indexOf(":") + 1)]; apriClienti(tipo === "stato" ? {stato: v} : {sit: v}); return; }
  if (b.hasAttribute("data-conti")){ apriClienti({conti: true}); return; }
  if (b.hasAttribute("data-esposte")){ apriEsposte(); return; }
  if (b.hasAttribute("data-listino")){ apriListino(); return; }
  if (b.hasAttribute("data-contatti")){ apriContatti(); return; }
  if (b.hasAttribute("data-volantino")){ stampaVolantino(); return; }
  if (b.hasAttribute("data-agenda")){ apriAgenda(); return; }
  if (b.hasAttribute("data-segn")){ apriSegnOtt(); return; }
});
// ottica: agenda degli appuntamenti e orari prenotabili
function apriAgenda(){
  const d = cruDati || {}, l = d.appuntamenti || [], or = d.orari || {giorni: [1, 2, 3, 4, 5, 6], fasce: ["09:30-12:30", "16:00-19:30"], durata: 30};
  const G = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"], perGiorno = {};
  l.forEach(a => (perGiorno[a.il.slice(0, 10)] = perGiorno[a.il.slice(0, 10)] || []).push(a));
  apriExtra("Appuntamenti", `${l.length ? Object.entries(perGiorno).map(([g, x]) => `<h3 style="margin:10px 0 6px;text-transform:capitalize">${esc(new Date(g + "T12:00:00").toLocaleDateString("it-IT", {weekday: "long", day: "numeric", month: "long"}))}</h3>
      ${x.map(a => `<div class="ric"><span><b>${esc(a.il.slice(11))} · ${esc(a.nome)}</b><small>${esc(a.tipo)} · ${esc(a.univoco)}</small></span></div>`).join("")}`).join("")
      : '<div class="vuoto">Nessun appuntamento in agenda. I clienti prenotano dal loro link («Prenota in ottica»).</div>'}
    <form id="fOrari" class="scheda" style="margin-top:14px"><b>Orari prenotabili</b>
      <div class="giorni-sel">${[1, 2, 3, 4, 5, 6, 0].map(g => `<label><input type="checkbox" name="g" value="${g}" ${or.giorni.includes(g) ? "checked" : ""}> ${G[g]}</label>`).join("")}</div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="orM">Mattina</label><input id="orM" placeholder="09:30-12:30" value="${esc(or.fasce[0] || "")}"></div><div style="flex:1"><label class="lbl" for="orP">Pomeriggio</label><input id="orP" placeholder="16:00-19:30" value="${esc(or.fasce[1] || "")}"></div></div>
      <label class="lbl" for="orD">Durata di ogni appuntamento</label><select id="orD">${[15, 20, 30, 45, 60].map(x => `<option value="${x}" ${x === or.durata ? "selected" : ""}>${x} minuti</option>`).join("")}</select>
      <div class="esito" id="orEsito" hidden></div><button type="submit" class="verde full">Salva gli orari</button></form>`);
  $("fOrari").onsubmit = async e => { e.preventDefault();
    const giorni = [...$("fOrari").querySelectorAll("[name=g]:checked")].map(x => +x.value), fasce = [$("orM").value.trim(), $("orP").value.trim()].filter(Boolean);
    const r = await api("api/ordine", {method: "POST", body: JSON.stringify({azione: "orari", giorni, fasce, durata: +$("orD").value})});
    esito($("orEsito"), r.ok ? "Orari salvati: i clienti vedono subito i nuovi orari." : (r.data.errore || "Errore"), r.ok ? "ok" : "err");
    if (r.ok && cruDati) cruDati.orari = {giorni, fasce, durata: +$("orD").value}; };
}
// ottica: segnalazioni dei clienti da gestire
function apriSegnOtt(){
  const l = (cruDati || {}).segnalazioni || [];
  apriExtra("Segnalazioni dei clienti", l.length ? l.map(x => `<div class="scheda" style="margin:0 0 10px" data-sg="${esc(x.id)}"><small>${dt(x.il)} · <b>${esc(x.univoco)}</b> ${esc(x.nome)}</small>
      <p style="margin:6px 0">${esc(x.testo)}</p>${x.foto ? `<img src="${esc(x.foto)}" alt="Foto del cliente" style="max-width:100%;border-radius:10px">` : ""}
      <div class="riga" style="margin-top:6px">${x.cellulare ? `<a class="btn-link" href="https://wa.me/39${esc(String(x.cellulare).replace(/\D/g, ""))}" target="_blank" rel="noopener">WhatsApp</a><a class="btn-link grigio" href="tel:+39${esc(String(x.cellulare).replace(/\D/g, ""))}">Chiama</a>` : ""}</div>
      <input placeholder="Risposta al cliente (facoltativa, gli arriva come notifica)" data-risp maxlength="300" style="margin-top:8px"><button type="button" class="verde full" data-risolta="${esc(x.id)}">Segna come risolta</button></div>`).join("")
    : '<div class="vuoto">Nessuna segnalazione aperta.</div>');
  $("extraCorpo").querySelectorAll("[data-risolta]").forEach(b => b.onclick = async () => { b.disabled = true;
    const box = b.closest("[data-sg]"), r = await api("api/ordine", {method: "POST", body: JSON.stringify({azione: "segnalazioneRisolta", id: b.dataset.risolta, risposta: box.querySelector("[data-risp]").value})});
    if (!r.ok){ b.disabled = false; return alert(r.data.errore || "Errore"); }
    box.innerHTML = '<div class="esito ok">Segnalazione risolta.</div>'; cruDati.segnalazioni = (cruDati.segnalazioni || []).filter(x => x.id !== b.dataset.risolta); });
}
function apriContatti(){
  const t = (window.SG_INFO && SG_INFO.titolare) || {}, tel = String(t.telefono || "").replace(/[^\d+]/g, "");
  $("contattiCorpo").innerHTML = (t.telefono || t.email) ? `<p style="margin:0 0 10px;color:var(--tenue)">Per anagrafiche bloccate, compensi, problemi con un ordine o con l'accesso.</p>
    <div class="scheda"><b>${esc(t.ragione || "SocialGlass")}</b></div><div class="riga">${t.telefono ? `<a class="btn-link" href="tel:${esc(tel)}">Chiama ${esc(t.telefono)}</a>` : ""}${t.email ? `<a class="btn-link" style="background:var(--blu)" href="mailto:${esc(t.email)}">Scrivi un'email</a>` : ""}</div>`
    : `<p>I contatti dell'amministratore non sono ancora stati inseriti. Rivolgiti a chi ti ha dato l'accesso.</p>`;
  open("contattiPopup");
}
// locandina A4 da appendere al CAF: titolo grande, 3 passi, cosa è incluso, QR al sito e nome del CAF
async function stampaVolantino(){
  const A = LISTINI.LISTINI.abbonamento, nome = sessionStorage.getItem("sg_nome") || "", base = location.origin;
  // la finestra si apre subito al tocco (dopo un'attesa i browser la bloccano), poi si riempie
  const w = window.open("", "_blank"); if (!w){ alertStampa(); return; }
  w.document.write('<p style="font-family:Arial;padding:20px">Preparo la locandina…</p>');
  let qr = ""; try { await caricaQr(); const d = document.createElement("div"); new QRCode(d, {text: base + "/", width: 360, height: 360, correctLevel: QRCode.CorrectLevel.M}); const c = d.querySelector("canvas"); qr = c ? c.toDataURL("image/png") : ""; } catch(_){}
  // logo e illustrazione dentro la pagina: la finestra di stampa non deve scaricare niente
  const dati = async u => { try { const b = await (await fetch(u)).blob(); return await new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(u); f.readAsDataURL(b); }); } catch(_){ return u; } };
  const [logo, ill] = await Promise.all([dati(base + "/assets/logo-social-glass.png"), dati(base + "/assets/sfondo-mobile-socialglass.jpg")]);
  w.document.open();
  const ok = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  const passi = [["Ti registri qui", "Bastano pochi minuti: ricevi sul cellulare il tuo link personale."],
    ["Scegli in ottica", "Nell'ottica convenzionata scegli la montatura; l'ottico prepara le lenti per te."],
    ["Attivi dal telefono", "Paghi solo il primo mese. Ti avvisiamo quando gli occhiali sono pronti."]];
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Locandina SocialGlass</title><style>
  @page{size:A4;margin:0}*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{margin:0;background:#fff}body{font-family:"Helvetica Neue",Arial,sans-serif;color:#0A1F5C}
  .foglio{width:210mm;height:297mm;overflow:hidden;display:flex;flex-direction:column;position:relative}
  .alto{display:flex;justify-content:space-between;align-items:center;padding:10mm 14mm 4mm}.alto img{height:15mm}
  .alto span{font-size:12pt;font-weight:700;color:#0069D9;border:2px solid #0069D9;border-radius:30px;padding:2.5mm 6mm}
  .hero{margin:0 10mm;border-radius:9mm;background:linear-gradient(135deg,#E8F1FF 0%,#D6E7FF 100%);display:flex;align-items:center;padding:7mm 4mm 7mm 11mm;gap:2mm;height:88mm}
  .hero .t{flex:2}.hero h1{font-size:42pt;line-height:1;margin:0 0 4mm;letter-spacing:-.02em;font-weight:900}.hero h1 em{font-style:normal;color:#0069D9}
  .hero p{font-size:15.5pt;line-height:1.35;margin:0;color:#1d3470}.hero p b{color:#2E7D32}
  .hero .ill{flex:1;height:100%;display:flex;align-items:flex-end;justify-content:center}.hero .ill img{height:100%;mix-blend-mode:multiply}
  h2{font-size:17pt;margin:7mm 14mm 3.5mm;letter-spacing:-.01em}
  .passi{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;margin:0 14mm}
  .passo{border:1.6px solid #c9d9f5;border-radius:6mm;padding:4mm 5mm 5mm}.passo i{display:flex;align-items:center;justify-content:center;width:13mm;height:13mm;border-radius:50%;background:#0069D9;color:#fff;font-style:normal;font-weight:900;font-size:20pt;margin-bottom:3mm}
  .passo b{display:block;font-size:15pt;margin-bottom:1.5mm}.passo span{font-size:12pt;line-height:1.35;color:#33456f}
  .incl{display:grid;grid-template-columns:1fr 1fr;gap:3mm 7mm;margin:0 14mm 7mm}.incl div{display:flex;align-items:center;gap:3mm;font-size:13pt;line-height:1.3}
  .incl div em{flex:0 0 auto;width:9mm;height:9mm;border-radius:50%;background:#2E7D32;display:flex;align-items:center;justify-content:center}
  .basso{margin-top:auto;background:#0A1F5C;color:#fff;display:flex;align-items:center;gap:8mm;padding:7mm 14mm 8mm}
  .basso .t{flex:1}.basso small{display:block;font-size:12pt;opacity:.8;margin-bottom:1.5mm;text-transform:uppercase;letter-spacing:.08em}
  .basso b{display:block;font-size:24pt;line-height:1.1;margin-bottom:3mm}.basso p{margin:0;font-size:12.5pt;line-height:1.4;opacity:.95}
  .qr{background:#fff;border-radius:4mm;padding:3mm;text-align:center;color:#0A1F5C;font-size:9pt;font-weight:700}.qr img{width:28mm;height:28mm;display:block;margin:0 auto 1.5mm}
  @media screen{body{background:#e9edf4}.foglio{margin:10mm auto;background:#fff;box-shadow:0 10px 40px rgba(0,0,0,.18)}}
  </style></head><body><div class="foglio">
    <div class="alto"><img src="${logo}" alt="SocialGlass"><span>Ti aiutiamo noi del CAF</span></div>
    <div class="hero"><div class="t"><h1>Occhiali nuovi<br><em>ogni anno</em></h1><p>Montatura e lenti graduate in abbonamento.<br><b>Paghi un mese alla volta, senza pensieri.</b></p></div>
      <div class="ill"><img src="${ill}" alt=""></div></div>
    <h2>Come funziona</h2>
    <div class="passi">${passi.map(([t, d], i) => `<div class="passo"><i>${i + 1}</i><b>${t}</b><span>${d}</span></div>`).join("")}</div>
    <h2>Cosa è incluso</h2>
    <div class="incl">${A.servizi.map(x => `<div><em>${ok}</em>${esc(x)}</div>`).join("")}</div>
    <div class="basso"><div class="t"><small>Chiedi qui</small><b>${esc(nome || "Il tuo CAF")}</b><p>Porta la tessera sanitaria e il cellulare: ti registriamo in pochi minuti.</p></div>
      ${qr ? `<div class="qr"><img src="${qr}" alt="">Scopri di più</div>` : ""}</div>
  </div><script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
  w.document.close();
}
function apriEsposte(){
  const l = (cruDati && cruDati.esposte) || [];
  $("esposteCorpo").innerHTML = l.length ? `<p class="hint" style="margin:0 0 8px">${l.reduce((t, m) => t + m.qta, 0)} pezzi disponibili in ${l.length} modelli · <button type="button" class="linkbtn" id="stampaEsposte">Stampa elenco</button></p>
    <div class="lista">${l.map(m => `<div class="riga-cli" style="cursor:default"><span><span class="nome">${esc(m.codice)}</span> ${esc(m.modello)} ${esc(m.colore)}<span class="cod">${esc(m.calibro)}${m.asse ? "-" + esc(m.asse) : ""}</span></span>
      <span class="bad">${m.prenotate ? `<span class="chip s2">PRENOTATE ${m.prenotate}</span>` : ""}<span class="chip ${m.qta ? "s4" : "s3"}">${m.qta ? "DISPONIBILI " + m.qta : "NESSUNA DISPONIBILE"}</span></span></div>`).join("")}</div>
    <p class="hint" style="margin-top:10px">Per avere altre montature o segnalarne una rotta o mancante, contatta SocialGlass.</p>`
    : `<div class="vuoto">${cruDati && cruDati.esposte ? "Non risultano montature esposte nella tua ottica. Se le hai in negozio, chiedi a SocialGlass di registrarle." : "Elenco non disponibile in questa anteprima."}</div>`;
  open("espostePopup");
  const s = $("stampaEsposte"); if (s) s.onclick = () => stampaDoc(`Montature esposte · ${sessionStorage.getItem("sg_id") || ""}`, `<table><tr><th>Codice</th><th>Modello</th><th>Colore</th><th>Calibro</th><th class="n">Disponibili</th><th class="n">Prenotate</th><th>Controllo</th></tr>${l.map(m => `<tr><td>${esc(m.codice)}</td><td>${esc(m.modello)}</td><td>${esc(m.colore)}</td><td>${esc(m.calibro)}${m.asse ? "-" + esc(m.asse) : ""}</td><td class="n">${m.qta}</td><td class="n">${m.prenotate}</td><td></td></tr>`).join("")}</table>`);
}
function apriListino(){
  const lis = sessionStorage.getItem("sg_listino") || "A", c = LISTINI.conv(lis), A = LISTINI.LISTINI.abbonamento;
  $("listinoCorpo").innerHTML = `<p class="hint" style="margin:-6px 0 8px">Convenzione ${esc(lis)} · prezzi IVA inclusa. Scegli lenti e trattamenti per vedere il canone.</p>
    <div class="scelte" id="lisLenti">${Object.entries(c.lenti).map(([k, v], i) => `<label class="scelta"><input type="radio" name="lisL" value="${k}" ${i ? "" : "checked"}><span class="t">${esc(v.nome)}<small>${esc(v.desc || "")}</small></span><span class="p">${euro(v.prezzo)}</span></label>`).join("")}</div>
    <h3>Trattamenti</h3><div class="scelte">${Object.entries(c.trattamenti).map(([k, v]) => `<label class="scelta"><input type="checkbox" name="lisT" value="${k}"><span class="t">${esc(v.nome)}</span><span class="p">${euro(v.prezzo)}</span></label>`).join("")}</div>
    <div class="totale" id="lisTot" aria-live="polite"></div>
    <p class="hint">Montatura ${euro(c.montatura)} (se non ha un prezzo suo). Canone = ${Math.round(A.quotaAnnua * 100)}% del valore all'anno diviso 12, minimo ${euro(A.minimoMensile)}. Riscatto a fine periodo: ${Math.round(A.riscatto * 100)}% del valore.</p>`;
  const calc = () => { const p = LISTINI.preventivo(lis, $("listinoCorpo").querySelector("[name=lisL]:checked").value, [...$("listinoCorpo").querySelectorAll("[name=lisT]:checked")].map(x => x.value));
    $("lisTot").innerHTML = `Canone <b>${euro(p.rata)}</b> al mese · valore occhiale ${euro(p.totale)}<br>Primo pagamento ${euro(p.rata + p.spedizione)} (canone + spedizione) · riscatto ${euro(p.riscatto)}`; };
  $("listinoCorpo").onchange = calc; calc(); open("listinoPopup");
}
// recupero della password con il codice personale (senza passare dall'amministratore)
let recRuolo = "caf";
document.addEventListener("click", e => { const b = e.target.closest("[data-recupero]"); if (!b) return; recRuolo = b.dataset.recupero;
  $("recCodice").value = $(recRuolo === "caf" ? "codice" : "codiceOttico").value; $("recRis").hidden = true; open("recuperoPopup"); });
$("formRecupero").addEventListener("submit", async e => { e.preventDefault();
  const r = await post("api/login", {azione: "recupera", ruolo: recRuolo, codice: $("recCodice").value, recupero: $("recCod").value, nuova: $("recNuova").value});
  if (!r.ok) return esito($("recRis"), r.data.errore || "Errore", "err");
  $("recRis").hidden = false; $("recRis").className = "esito ok";
  $("recRis").innerHTML = `Password cambiata: ora entra con la nuova. Il codice di recupero usato non vale più: quello <b>nuovo</b> è<div class="codice-grande" style="font-size:20px;margin:8px 0">${esc(r.data.codice)}</div>Scrivilo e conservalo.`;
  $("recCod").value = $("recNuova").value = ""; });
$("recCrea").addEventListener("click", async () => { const b = $("recCrea");
  if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Il codice precedente non varrà più: tocca di nuovo per confermare"; return; }
  b.disabled = true; const r = await api("api/login", {method: "POST", body: JSON.stringify({azione: "codiceRecupero"})}); b.disabled = false; b.dataset.ok = ""; b.textContent = "Crea un nuovo codice di recupero";
  if (!r.ok) return esito($("recEsito"), r.data.errore || "Errore", "err");
  $("recEsito").hidden = false; $("recEsito").className = "esito ok"; $("recEsito").innerHTML = `Il tuo codice di recupero:<div class="codice-grande" style="font-size:20px;margin:8px 0">${esc(r.data.codice)}</div>Scrivilo e conservalo: non lo vedrai più.`; });
$("formCambioPw").addEventListener("submit", async e => {
  e.preventDefault(); const es = $("pwEsito");
  if ($("pwNuo").value !== $("pwNuo2").value) return esito(es, "Le due nuove password non coincidono.", "err");
  const r = await post("api/login", {azione: "cambiaPassword", attuale: $("pwAtt").value, nuova: $("pwNuo").value});
  if (r.status === 401 && !r.data.errore) return scaduta(r);
  if (!r.ok) return esito(es, r.data.errore || "Non è stato possibile cambiare la password.", "err");
  e.target.reset(); esito(es, "Password cambiata. Dal prossimo accesso usa quella nuova.", "ok");
});
// "Ho già il mio codice": apre la pagina personale del cliente
$("hoCodice").addEventListener("click", () => open("codicePopup"));
$("formCodice").addEventListener("submit", async e => {
  e.preventDefault(); const c = $("codiceCliente").value.trim().toUpperCase(); if (!c) return;
  const r = await api(`api/benvenuto?univoco=${encodeURIComponent(c)}&espositore=`);
  if (!r.ok) return esito($("codiceErr"), "Codice non trovato. Controlla il messaggio che hai ricevuto dal CAF.", "err");
  location.href = `${location.pathname.replace(/\/(caf|ottico|admin)\/?$/, "/")}?Univoco=${encodeURIComponent(c)}`;
});

/* ---------- app installabile, notifiche, porta un amico, tessera, il mio anno ---------- */
let promptInstalla = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); promptInstalla = e; if (mio && !$("miaPagina").hidden) disegnaMio(); });
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw-sg.js").catch(() => {});
const iOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const installata = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const pushPossibile = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
// l'app installata dal cliente si apre sulla sua pagina (chiamata dopo la lettura del link)
function avvioApp(){
  if (UNIVOCO){ try { localStorage.setItem("sg_univoco", UNIVOCO); } catch(_){} if ($("manifestLink")) $("manifestLink").href = `api/benvenuto?manifest=1&univoco=${encodeURIComponent(UNIVOCO)}`; }
  else if (par("app")){ let u = ""; try { u = localStorage.getItem("sg_univoco") || ""; } catch(_){} if (u) location.replace(`./?Univoco=${encodeURIComponent(u)}&app=1`); }
  linkAmico();
}
const svgI = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
function bannerApp(u){
  if (DEMO === "browser") return "";
  // un solo invito: installa l'app e attiva gli avvisi con lo stesso tocco
  const inst = !installata() && (promptInstalla || iOS), notif = pushPossibile() && u.vapid && !u.notifiche && Notification.permission !== "denied";
  if (!inst && !notif) return "";
  return `<div class="banner-app">${svgI('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>').replace("<svg", '<svg style="width:30px;height:30px;flex:0 0 auto"')}<div><b>${inst ? "Installa e ricevi gli avvisi" : "Ricevi gli avvisi sul telefono"}</b><span>${inst ? "Un'icona per aprire subito il tuo ordine e una notifica gratis quando gli occhiali sono pronti." : "Una notifica gratis quando gli occhiali sono pronti e prima delle scadenze."}</span></div><button type="button" id="mpApp">Attiva</button></div>`;
}
async function attivaApp(){
  // prima le notifiche (sul browser funzionano già), poi l'installazione; su iPhone servono prima l'icona sulla Home
  if (pushPossibile() && mio.vapid && !mio.notifiche && Notification.permission !== "denied") await attivaNotifiche();
  if (!installata() && (promptInstalla || iOS)) await installa();
}
async function installa(){
  if (promptInstalla){ promptInstalla.prompt(); const r = await promptInstalla.userChoice.catch(() => ({})); promptInstalla = null; if (r.outcome === "accepted") notaDemo("App installata: la trovi tra le icone del telefono."); disegnaMio(); return; }
  apriExtra("Metti SocialGlass sul telefono", `<ol class="passi-ora"><li>Tocca il pulsante <b>Condividi</b> di Safari (il quadrato con la freccia in su).</li><li>Scegli <b>«Aggiungi alla schermata Home»</b> e poi <b>Aggiungi</b>.</li><li>Apri SocialGlass dalla nuova icona e tocca <b>«Attiva»</b> per ricevere gli avvisi.</li></ol><p class="hint">Su iPhone le notifiche funzionano solo dall'icona sulla schermata Home (iOS 16.4 o successivo).</p>`);
}
const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
async function attivaNotifiche(){
  const btn = $("mpApp"); if (btn){ btn.disabled = true; btn.textContent = "Attendi…"; }
  try {
    if (await Notification.requestPermission() !== "granted") throw new Error("Hai negato il permesso: puoi riattivarlo dalle impostazioni del browser.");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64(mio.vapid)});
    const r = await post("api/benvenuto", {azione: "push", univoco: UNIVOCO, sub: sub.toJSON()});
    if (!r.ok) throw new Error(r.data.errore || "Non è stato possibile attivarle.");
    mio.notifiche = true; disegnaMio();
  } catch(e){ if (btn){ btn.disabled = false; btn.textContent = "Attiva"; } notaDemo(e.message || "Notifiche non disponibili su questo browser."); }
}
function apriExtra(titolo, html){ $("extraTitolo").textContent = titolo; $("extraCorpo").innerHTML = html; open("extraPopup"); }
// coriandoli quando gli occhiali sono pronti o consegnati (una volta per stato)
function coriandoli(){
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas"); c.className = "coriandoli"; c.width = innerWidth * devicePixelRatio; c.height = innerHeight * devicePixelRatio; document.body.appendChild(c);
  const x = c.getContext("2d"), col = ["#0069D9", "#2E7D32", "#F5B301", "#E5484D", "#0A1F5C", "#7FB8FF"], P = [];
  for (let i = 0; i < 140; i++) P.push({x: c.width / 2 + (Math.random() - .5) * c.width * .3, y: c.height * .35, vx: (Math.random() - .5) * 16 * devicePixelRatio, vy: (-Math.random() * 15 - 6) * devicePixelRatio, r: (4 + Math.random() * 5) * devicePixelRatio, a: Math.random() * 6, va: (Math.random() - .5) * .3, c: col[i % col.length]});
  let t = 0; (function f(){ x.clearRect(0, 0, c.width, c.height); P.forEach(p => { p.vy += .45 * devicePixelRatio; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r, -p.r / 2, p.r * 2, p.r); x.restore(); });
    if (++t < 170) requestAnimationFrame(f); else c.remove(); })();
}
function festeggia(u){
  if (![STATI.PRONTO, STATI.CONSEGNATO].includes(u.stato)) return;
  const k = `sg_festa_${UNIVOCO}_${u.stato}`; try { if (localStorage.getItem(k)) return; localStorage.setItem(k, "1"); } catch(_){ return; }
  setTimeout(coriandoli, 350);
}
// tracciamento: le tappe del suo occhiale, con il laboratorio
function traccia(u){
  const od = u.ordine || {}, i = ORDINE_STATI.indexOf(u.stato), m = od.montatura, lab = u.lab;
  const fatte = u.stato === STATI.CONSEGNATO ? TAPPE.length : i + 1;
  const dettaglio = k => k === 1 && m ? `${esc(m.modello)} ${esc(m.colore)}` : k === 3 && od.pagamento && od.pagamento.attivatoIl ? dt(od.pagamento.attivatoIl)
    : k === 4 && u.stato === STATI.ATTIVO && lab ? (lab.stato === "IN LAVORAZIONE" ? "Il laboratorio sta montando le lenti" : lab.fonte !== "LAB" && !lab.ritirata ? "Il laboratorio sta prendendo la montatura" : "In coda in laboratorio")
    : k === 4 && u.prontoIl ? dt(u.prontoIl) : k === 5 && u.consegnatoIl ? dt(u.consegnatoIl) : "";
  const pct = Math.round(Math.min(fatte, TAPPE.length) / TAPPE.length * 100);
  return `<div class="barra-av" aria-hidden="true"><i style="width:${pct}%"></i></div><ol class="traccia">${TAPPE.map(([t, prossima], k) => `<li class="${k < fatte ? "fatto" : k === fatte ? "ora" : ""}"><span class="pt">${k < fatte ? "✓" : k + 1}</span><span class="tt">${k < fatte ? t : prossima}${dettaglio(k) && k <= fatte ? `<small>${dettaglio(k)}</small>` : ""}</span></li>`).join("")}</ol>`;
}
function boxRecensione(u){
  if (u.recensione || !u.chiediRecensione) return "";
  return `<div class="scheda" id="mpRec" style="text-align:center"><b>Come ti trovi con i tuoi occhiali?</b><div class="stelle" role="radiogroup" aria-label="Voto">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-stella="${n}" aria-label="${n} stelle">★</button>`).join("")}</div>
    <textarea id="mpRecTesto" rows="2" maxlength="600" placeholder="Vuoi dirci qualcosa? (facoltativo)" style="width:100%"></textarea><button type="button" class="full" id="mpRecInvia" disabled>Invia</button></div>`;
}
function boxDona(u){
  const od = u.ordine || {}, d = u.dona || {}, fp = od.finePeriodo;
  if (d.donato) return `<div class="dona"><span style="font-size:26px">💚</span><div><b>Il tuo occhiale ha aiutato qualcuno.</b><br>Grazie: l'abbiamo donato a chi non può permetterselo.</div></div>`;
  if (d.daDonare) return `<div class="dona"><span style="font-size:26px">💚</span><div><b>Grazie!</b> Il tuo occhiale restituito verrà donato a chi ne ha bisogno.</div></div>`;
  const restituisce = (od.ritiro && od.ritiro.daRitirare && !od.ritiro.ritirato) || (fp && ["restituisci", "rinnova"].includes(fp.scelta) && !fp.eseguita);
  if (!restituisce) return "";
  return `<label class="dona" for="mpDona"><input type="checkbox" id="mpDona" ${d.si ? "checked" : ""} style="width:22px;height:22px;margin:2px 0 0;box-shadow:none;flex:0 0 auto"><div><b>Dono il mio occhiale</b><br>Quando lo riconsegni, lo doniamo a chi non può permettersi un paio di occhiali.</div></label>`;
}
function strumentiCli(u){
  // «Il mio anno» ha senso dopo almeno 10 mesi di abbonamento
  const anno = u.primaAttivazione && u.consegnatoIl && Date.now() - new Date(u.primaAttivazione) > 300 * 864e5, od = u.ordine || {}, pg = od.pagamento || {}, st = u.stato;
  const B = (id, ic, t) => `<button type="button" id="${id}">${svgI(ic)}${t}</button>`;
  const I = {tes: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/>', amico: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    anno: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5L12 17l-6.5 4 2-7.5L2 9h7z"/>', tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>', occ: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M10 15h4M2 15l2-8h3M22 15l-2-8h-3"/>',
    carta: '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22M5 15h4"/>', ric: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2-3-2z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>', aiuto: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>'};
  const scegli = [STATI.REGISTRATO, STATI.MONTATURA].includes(st) || (od.periodo && od.periodo.aperto && !od.periodo.chiuso);
  return `<div class="extra-cli">${B("mpTessera", I.tes, "La mia tessera")}${B("mpPrenota", I.cal, u.appuntamento ? "Il mio appuntamento" : "Prenota in ottica")}
    ${scegli ? B("mpCatalogo", I.occ, "Montature in ottica") : ""}${B("mpAmico", I.amico, "Porta un amico")}
    ${anno ? B("mpAnno", I.anno, "Il mio anno") : B("mpChiama", I.tel, "La mia ottica")}
    ${[STATI.ATTIVO, STATI.PRONTO, STATI.CONSEGNATO].includes(st) && !pg.chiuso ? B("mpSegnala", I.aiuto, "Segnala un problema") : ""}
    ${u.haCarta ? B("mpCarta", I.carta, "Cambia carta") : ""}${pg.attivatoIl ? B("mpRicevute", I.ric, "Ricevute") : ""}${u.contratto ? B("mpContratto", I.doc, "Il mio contratto") : ""}</div>`;
}
const fData = d => new Date(d + (d.length <= 10 ? "T12:00:00" : "")).toLocaleDateString("it-IT", {weekday: "long", day: "numeric", month: "long"});
// appuntamento in vista, in cima alla pagina
function boxAppuntamento(u){
  const a = u.appuntamento; if (!a) return "";
  return `<div class="esito ok app-box"><b>${esc(a.descrizione || "Appuntamento")}</b><br>${esc(fData(a.il))} alle <b>${esc(a.il.slice(11))}</b>${u.ottico ? ` · ${esc(u.ottico.nome)}` : ""}</div>`;
}
// montature esposte nella sua ottica (con foto se caricate)
async function apriCatalogo(){
  apriExtra("Montature nella tua ottica", '<div class="vuoto">Caricamento…</div>');
  const r = await api(`api/benvenuto?catalogo=1&univoco=${encodeURIComponent(UNIVOCO)}`);
  const l = r.ok ? r.data.montature || [] : [];
  $("extraCorpo").innerHTML = l.length ? `<p class="hint" style="margin:0 0 10px">${l.length} montature esposte${r.data.ottica ? " da " + esc(r.data.ottica) : ""}. Provale in negozio e scansiona il cartellino di quella che scegli.</p>
    <div class="catalogo">${l.map(m => `<div class="cat">${m.foto ? `<img src="${esc(m.foto)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="cat-ph">${svgI('<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M10 15h4M2 15l2-8h3M22 15l-2-8h-3"/>')}</div>`}
      <b>${esc(m.modello)}</b><span>${esc(m.colore)}${m.calibro ? ` · ${esc(m.calibro)}${m.asse ? "-" + esc(m.asse) : ""}` : ""}</span><small>${esc(m.codice)}</small></div>`).join("")}</div>`
    : `<div class="vuoto">${r.ok ? "La tua ottica non ha ancora caricato le montature esposte: le vedi direttamente in negozio." : esc(r.data.errore || "Non disponibile ora.")}</div>`;
}
// prenotazione: tipo, giorno e ora tra quelli liberi
async function apriPrenota(){
  const u = mio, a = u.appuntamento;
  const tipoBase = [STATI.REGISTRATO, STATI.MONTATURA].includes(u.stato) ? "scelta" : u.stato === STATI.PRONTO ? "ritiro" : u.stato === STATI.CONSEGNATO ? "controllo" : "altro";
  const tipi = {scelta: "Scelta della montatura", ritiro: "Ritiro degli occhiali", controllo: "Controllo della vista", altro: "Assistenza"};
  apriExtra(a ? "Il mio appuntamento" : "Prenota in ottica", '<div class="vuoto">Caricamento degli orari…</div>');
  const r = await api(`api/benvenuto?slot=1&univoco=${encodeURIComponent(UNIVOCO)}`), g = r.ok ? r.data.giorni || [] : [];
  let giorno = g.length ? g[0].data : "", ora = "";
  const disegna = () => {
    $("extraCorpo").innerHTML = `${a ? `<div class="esito ok" style="margin:0 0 12px"><b>${esc(a.descrizione || "")}</b><br>${esc(fData(a.il))} alle <b>${esc(a.il.slice(11))}</b>
        <div style="margin-top:8px"><button type="button" class="grigio" id="apAnnulla" style="margin:0">Annulla l'appuntamento</button></div></div><p class="hint" style="margin:0 0 8px">Oppure scegli un altro orario:</p>` : ""}
      ${g.length ? `<label class="lbl" for="apTipo">Per cosa?</label><select id="apTipo">${Object.entries(tipi).map(([k, t]) => `<option value="${k}" ${k === ((a && a.tipo) || tipoBase) ? "selected" : ""}>${t}</option>`).join("")}</select>
      <div class="giorni">${g.map(x => `<button type="button" data-g="${x.data}" class="${x.data === giorno ? "on" : ""}">${esc(new Date(x.data + "T12:00:00").toLocaleDateString("it-IT", {weekday: "short"}))}<b>${+x.data.slice(8)}</b>${esc(new Date(x.data + "T12:00:00").toLocaleDateString("it-IT", {month: "short"}))}</button>`).join("")}</div>
      <div class="orari">${(g.find(x => x.data === giorno) || {slot: []}).slot.map(h => `<button type="button" data-h="${h}" class="${h === ora ? "on" : ""}">${h}</button>`).join("")}</div>
      <div class="esito err" id="apErr" hidden></div><button type="button" class="verde full" id="apOk" ${ora ? "" : "disabled"}>${ora ? `Prenota ${esc(fData(giorno))} alle ${ora}` : "Scegli un orario"}</button>`
      : `<div class="vuoto">${r.ok ? "Nessun orario libero nei prossimi 14 giorni: chiama la tua ottica." : esc(r.data.errore || "Non disponibile ora.")}</div>`}`;
    const c = $("extraCorpo");
    c.querySelectorAll("[data-g]").forEach(x => x.onclick = () => { giorno = x.dataset.g; ora = ""; disegna(); });
    c.querySelectorAll("[data-h]").forEach(x => x.onclick = () => { ora = x.dataset.h; disegna(); });
    const ok = $("apOk"); if (ok) ok.onclick = async () => { ok.disabled = true; ok.textContent = "Attendi…";
      const q = await post("api/benvenuto", {azione: "appuntamento", univoco: UNIVOCO, quando: `${giorno}T${ora}`, tipo: $("apTipo").value});
      if (!q.ok){ $("apErr").hidden = false; $("apErr").textContent = q.data.errore || "Riprova."; ok.disabled = false; ok.textContent = "Riprova"; return; }
      await caricaMio(false); apriExtra("Appuntamento confermato", `<div class="esito ok"><b>${esc(tipi[q.data.appuntamento.tipo] || "")}</b><br>${esc(fData(giorno))} alle <b>${ora}</b>${mio.ottico ? `<br>${esc(mio.ottico.nome)}, ${esc(mio.ottico.indirizzo)}${esc(mio.ottico.citta)}` : ""}</div><p class="hint">L'ottica lo vede subito. Se non puoi venire, annullalo da qui.</p>`); };
    const an = $("apAnnulla"); if (an) an.onclick = async () => { an.disabled = true; const q = await post("api/benvenuto", {azione: "annullaAppuntamento", univoco: UNIVOCO});
      if (!q.ok) return notaDemo(q.data.errore || "Riprova."); await caricaMio(false); apriExtra("Appuntamento annullato", '<div class="esito ok">Fatto: l\'orario è di nuovo libero per altri.</div>'); };
  };
  disegna();
}
// carta e ricevute: pagina sicura di Stripe
async function apriCarta(){
  const b = $("mpCarta"); if (b){ b.disabled = true; }
  const r = await post("api/pagamento", {azione: "carta", univoco: UNIVOCO});
  if (b) b.disabled = false;
  if (r.ok && r.data.url){ location.href = r.data.url; return; }
  apriExtra("Cambia carta", `<div class="esito ${r.ok ? "info" : "err"}">${esc((r.data && r.data.errore) || "Non disponibile ora: riprova tra poco.")}</div>`);
}
async function apriRicevute(){
  apriExtra("Ricevute dei pagamenti", '<div class="vuoto">Caricamento…</div>');
  const r = await post("api/pagamento", {azione: "ricevute", univoco: UNIVOCO}), l = r.ok ? r.data.ricevute || [] : [];
  $("extraCorpo").innerHTML = l.length ? `<div class="ricevute">${l.map(x => `<div class="ric"><span><b>${euro(x.importo)}</b><small>${dt(x.il)}${x.numero ? " · n. " + esc(x.numero) : ""}</small></span>
      ${x.pdf ? `<a class="btn-link" href="${esc(x.pdf)}" target="_blank" rel="noopener">PDF</a>` : ""}${x.url ? `<a class="btn-link grigio" href="${esc(x.url)}" target="_blank" rel="noopener">Apri</a>` : ""}</div>`).join("")}</div>
      <p class="hint" style="margin-top:10px">Le ricevute le emette Stripe, che gestisce i pagamenti. Per la detrazione chiedi all'ottica il documento fiscale dei canoni.</p>`
    : `<div class="vuoto">${r.ok ? (r.data.prova ? "Le ricevute compaiono qui dopo il primo pagamento con carta." : "Nessun pagamento ancora registrato.") : esc(r.data.errore || "Non disponibile ora.")}</div>`;
}
// copia del contratto in PDF: condizioni con i dati del cliente e la data delle conferme
const caricaPdf = () => window.jspdf ? Promise.resolve() : new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
async function apriContratto(){
  const u = mio, od = u.ordine || {}, c = u.contratto || {}, p = od.prezzi || {}, T = (window.SG_INFO && SG_INFO.titolare) || {};
  const quando = d => d ? new Date(d).toLocaleString("it-IT", {dateStyle: "long", timeStyle: "short"}) : "—";
  const righe = [["Cliente", `${u.nome} ${u.cognome || ""}`.trim()], ["Codice cliente", UNIVOCO], ["Ottica", u.ottico ? `${u.ottico.nome}, ${u.ottico.indirizzo}${u.ottico.citta}` : ""],
    ["Occhiale", od.montatura ? `${od.montatura.modello} ${od.montatura.colore} con lenti ${od.lenti ? od.lenti.nome : ""}` : ""], ["Valore dell'occhiale", euro(p.totale)],
    ["Canone mensile", euro(p.rata)], ["Durata minima", `${p.mesi || 12} mesi`], ["Abbonamento attivato il", quando(c.attivatoIl)],
    ["Condizioni accettate", c.consensi ? quando(c.consensi.contratto) : "all'attivazione (obbligatorie per attivare)"], ["Addebito automatico autorizzato", c.consensi ? quando(c.consensi.addebito) : "all'attivazione (obbligatorio per attivare)"]];
  apriExtra("Il mio contratto", `<div class="scheda">${righe.map(([k, v]) => `<div class="r-c"><span>${esc(k)}</span><b>${esc(v || "—")}</b></div>`).join("")}</div>
    <button type="button" class="verde full" id="ctPdf">Scarica il PDF</button><p class="hint">Il PDF contiene questi dati e le condizioni complete dell'abbonamento.</p>`);
  $("ctPdf").onclick = async () => {
    const b = $("ctPdf"); b.disabled = true; b.textContent = "Preparo il PDF…";
    try {
      await caricaPdf(); const doc = new window.jspdf.jsPDF({unit: "mm", format: "a4"}), W = 180; let y = 18;
      const riga = (t, sz, bold) => { doc.setFont("helvetica", bold ? "bold" : "normal"); doc.setFontSize(sz); for (const l of doc.splitTextToSize(t, W)){ if (y > 282){ doc.addPage(); y = 18; } doc.text(l, 15, y); y += sz * 0.45; } };
      riga("SocialGlass · Contratto di abbonamento occhiale", 16, true); y += 2;
      if (T.ragione) riga(`${T.ragione}${T.piva ? " · P.IVA " + T.piva : ""}${T.indirizzo ? " · " + T.indirizzo : ""}`, 9);
      y += 3; for (const [k, v] of righe) riga(`${k}: ${v || "—"}`, 10.5); y += 4;
      riga("Condizioni dell'abbonamento", 13, true); y += 1;
      const tmp = document.createElement("div"); tmp.innerHTML = testoCondizioni();
      for (const el of tmp.querySelectorAll("p, li")) { riga((el.tagName === "LI" ? "• " : "") + el.textContent.replace(/\s+/g, " ").trim(), 9.5); y += 1.5; }
      y += 4; riga(`Copia generata il ${new Date().toLocaleString("it-IT")} dal link personale del cliente.`, 8);
      await salvaFile(doc.output("blob"), `contratto-socialglass-${UNIVOCO}.pdf`);
    } catch(e){ notaDemo("Non è stato possibile creare il PDF: riprova con la connessione attiva."); }
    b.disabled = false; b.textContent = "Scarica il PDF";
  };
}
// segnalo un problema: testo e foto (rimpicciolita sul telefono prima dell'invio)
function fotoPiccola(file){
  return new Promise((ok, ko) => { const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1000 / Math.max(img.width, img.height)), c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url); let q = 0.8, d = c.toDataURL("image/jpeg", q); while (d.length > 550000 && q > 0.3){ q -= 0.15; d = c.toDataURL("image/jpeg", q); } ok(d); };
    img.onerror = () => ko(new Error("Foto non leggibile")); img.src = url; });
}
function apriSegnala(){
  const l = mio.segnalazioni || [];
  apriExtra("Segnala un problema", `<p class="hint" style="margin:0 0 8px">Aste che stringono, una vite allentata, una lente graffiata, un occhiale rotto: scrivici e, se vuoi, aggiungi una foto. La ricevono la tua ottica e SocialGlass.</p>
    <textarea id="sgTesto" rows="4" maxlength="600" placeholder="Cosa è successo?"></textarea>
    <label class="btn-foto"><input type="file" id="sgFoto" accept="image/*" capture="environment" hidden>${svgI('<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>')}<span id="sgFotoT">Aggiungi una foto</span></label>
    <img id="sgAnteprima" alt="" hidden style="max-width:100%;border-radius:12px;margin:8px 0">
    <div class="esito err" id="sgErr" hidden></div><button type="button" class="verde full" id="sgInvia">Invia la segnalazione</button>
    ${l.length ? `<h3 style="margin:16px 0 6px">Le tue segnalazioni</h3>${l.map(x => `<div class="scheda" style="margin:0 0 8px"><small>${dt(x.il)} · ${x.stato === "risolta" ? "✓ risolta" : "in attesa di risposta"}</small><br>${esc(x.testo)}${x.risposta ? `<br><b>Risposta:</b> ${esc(x.risposta)}` : ""}</div>`).join("")}` : ""}`);
  let foto = "";
  $("sgFoto").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { foto = await fotoPiccola(f); $("sgAnteprima").src = foto; $("sgAnteprima").hidden = false; $("sgFotoT").textContent = "Cambia foto"; } catch(err){ notaDemo(err.message); } };
  $("sgInvia").onclick = async () => { const b = $("sgInvia"); b.disabled = true; b.textContent = "Invio…";
    const r = await post("api/benvenuto", {azione: "segnala", univoco: UNIVOCO, testo: $("sgTesto").value, foto});
    if (!r.ok){ $("sgErr").hidden = false; $("sgErr").textContent = r.data.errore || "Riprova."; b.disabled = false; b.textContent = "Invia la segnalazione"; return; }
    await caricaMio(false); apriExtra("Segnalazione inviata", '<div class="esito ok"><b>Grazie, l\'abbiamo ricevuta.</b><br>La tua ottica ti contatta al più presto. Se serve, prenota un appuntamento dalla tua pagina.</div>'); };
}
const caricaQr = () => window.QRCode ? Promise.resolve() : new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
async function apriTessera(){
  const u = mio, nome = `${u.nome} ${u.cognome || ""}`.trim();
  apriExtra("La mia tessera", `<div class="tessera" id="tesCard"><div class="marchio">SocialGlass</div><div class="qr" id="tesQr"></div><div><div class="nome">${esc(nome)}</div><div class="cod">${esc(UNIVOCO)}</div></div></div>
    <p class="hint" style="margin:12px 0">Mostrala in ottica: l'ottico trova subito il tuo ordine.${!installata() ? " Installa SocialGlass sul telefono per averla sempre a portata di mano." : ""}</p>
    <button type="button" class="full" id="tesSalva">Salva come immagine</button>`);
  try { await caricaQr(); new QRCode($("tesQr"), {text: UNIVOCO, width: 192, height: 192, correctLevel: QRCode.CorrectLevel.M}); } catch(_){ $("tesQr").hidden = true; }
  $("tesSalva").onclick = () => {
    const W = 1012, H = 638, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0A1F5C"); g.addColorStop(.6, "#0069D9"); g.addColorStop(1, "#2E7D32"); x.fillStyle = g;
    x.beginPath(); x.roundRect ? x.roundRect(0, 0, W, H, 48) : x.rect(0, 0, W, H); x.fill();
    x.fillStyle = "#fff"; x.font = "800 52px system-ui,Arial"; x.fillText("SocialGlass", 56, 104);
    x.font = "700 52px system-ui,Arial"; x.fillText(nome.slice(0, 24), 56, 500); x.font = "700 56px 'Courier New',monospace"; x.fillText(UNIVOCO, 56, 576);
    const q = $("tesQr").querySelector("canvas"); if (q){ x.fillStyle = "#fff"; x.fillRect(W - 336, 150, 280, 280); x.drawImage(q, W - 316, 170, 240, 240); }
    salvaImmagine(c, `tessera-socialglass-${UNIVOCO}.png`);
  };
}
// scarica (o condivide sul telefono) un file già pronto
async function salvaFile(b, nome){
  const f = new File([b], nome, {type: b.type || "application/octet-stream"});
  if (navigator.canShare && navigator.canShare({files: [f]})){ try { await navigator.share({files: [f], title: "SocialGlass"}); return; } catch(e){ if (e.name === "AbortError") return; } }
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function salvaImmagine(c, nome){
  c.toBlob(async b => {
    const f = new File([b], nome, {type: "image/png"});
    if (navigator.canShare && navigator.canShare({files: [f]})){ try { await navigator.share({files: [f], title: "SocialGlass"}); return; } catch(e){ if (e.name === "AbortError") return; } }
    const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
}
function amico(){
  const u = mio, testo = `Io ho gli occhiali nuovi con SocialGlass: montatura e lenti graduate pagate un mese alla volta. Porta al CAF il mio codice amico ${UNIVOCO}: ${u.linkAmico}`;
  const ok = (u.amici || []).filter(a => /^accreditato/.test(a.stato)).length;
  apriExtra("Porta un amico", `<p style="margin:0 0 10px">Consiglia SocialGlass: quando un tuo amico attiva l'abbonamento, <b>a te un mese di canone gratis</b>.</p>
    <div class="codice-grande">${esc(UNIVOCO)}</div><p class="hint" style="margin:-4px 0 12px;text-align:center">Il tuo codice amico: va detto al CAF quando si registra.</p>
    <div class="riga"><a class="btn-link" target="_blank" rel="noopener" href="https://wa.me/?text=${encodeURIComponent(testo)}">Invia su WhatsApp</a><button type="button" id="amCondividi" style="flex:1">Condividi</button></div>
    ${(u.amici || []).length ? `<div class="scheda"><b>I tuoi amici (${u.amici.length})</b>${u.amici.map(a => `<div style="display:flex;justify-content:space-between;gap:8px"><span>${esc(a.nome.charAt(0) + a.nome.slice(1).toLowerCase())} · ${dt(a.il)}</span><span>${/^accreditato/.test(a.stato) ? "✅ mese gratis" : "⏳ in verifica"}</span></div>`).join("")}${ok ? `<p class="hint" style="margin:6px 0 0">${ok} ${ok === 1 ? "mese gratis" : "mesi gratis"}: li vedi scalati dai prossimi canoni.</p>` : ""}</div>` : ""}
    <p class="hint">Il mese gratis vale quando l'amico attiva l'abbonamento e il tuo è attivo.</p>`);
  $("amCondividi").onclick = async () => { if (navigator.share){ try { await navigator.share({title: "SocialGlass", text: testo}); } catch(_){} } else { try { await navigator.clipboard.writeText(testo); notaDemo("Messaggio copiato: incollalo dove vuoi."); } catch(_){} } };
}
function mioAnno(){
  const u = mio, od = u.ordine || {}, mesi = Math.max(1, Math.round((Date.now() - new Date(u.primaAttivazione)) / (30.44 * 864e5)));
  const titolo = mesi >= 11 ? "Il mio anno con SocialGlass" : "Il mio SocialGlass finora", m = od.montatura, amici = (u.amici || []).length;
  const voci = [[`${mesi}`, mesi === 1 ? "mese insieme" : "mesi insieme"], [m ? `${m.modello}` : "—", m ? `montatura ${m.colore}` : "montatura"], [od.lenti ? od.lenti.nome : "—", "le mie lenti"]];
  if (amici) voci.push([`${amici}`, amici === 1 ? "amico portato" : "amici portati"]);
  if (u.dona && (u.dona.donato || u.dona.daDonare)) voci.push(["💚", "occhiale donato"]);
  apriExtra(titolo, `<div class="tessera" style="aspect-ratio:auto;display:block;padding:22px"><div class="marchio">SocialGlass</div><div style="font-size:22px;font-weight:800;margin:10px 0 14px">${esc(titolo)}</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">${voci.map(([v, t]) => `<div><div style="font-size:24px;font-weight:800;line-height:1.1">${esc(v)}</div><div style="opacity:.85;font-size:13px">${esc(t)}</div></div>`).join("")}</div></div>
    <button type="button" class="full" id="annoCondividi" style="margin-top:14px">Condividi l'immagine</button>`);
  $("annoCondividi").onclick = () => {
    const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#0A1F5C"); g.addColorStop(.65, "#0069D9"); g.addColorStop(1, "#2E7D32"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.fillStyle = "rgba(255,255,255,.08)"; for (let i = 0; i < 7; i++){ x.beginPath(); x.arc(W * (i / 6), H * .12 + (i % 2) * 60, 120 + i * 18, 0, 7); x.fill(); }
    x.fillStyle = "#fff"; x.font = "800 64px system-ui,Arial"; x.fillText("SocialGlass", 90, 170);
    x.font = "800 84px system-ui,Arial"; titolo.split(" con ").forEach((r, i, a) => x.fillText(i < a.length - 1 ? r + " con" : r, 90, 360 + i * 96));
    voci.forEach(([v, t], i) => { const y = 640 + i * 130; x.font = "800 72px system-ui,Arial"; x.fillText(String(v).slice(0, 18), 90, y); x.font = "500 36px system-ui,Arial"; x.globalAlpha = .85; x.fillText(t, 90, y + 46); x.globalAlpha = 1; });
    x.font = "600 34px system-ui,Arial"; x.globalAlpha = .9; x.fillText("Occhiali nuovi ogni anno, un mese alla volta", 90, H - 90); x.globalAlpha = 1;
    salvaImmagine(c, "il-mio-anno-socialglass.png");
  };
}
// home aperta dal link di un amico
function linkAmico(){
  const am = par("amico");
  if (am && !UNIVOCO) ready.finally(async () => {
    const r = await api(`api/benvenuto?amico=${encodeURIComponent(am)}`); if (!r.ok) return;
    const o = document.querySelector(".occhiello"); if (o){ o.innerHTML = `💙 ${esc(r.data.nome)} ti consiglia SocialGlass · codice amico <b>${esc(r.data.codice)}</b>`; o.title = "Dillo al CAF quando ti registri"; }
  });
}

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
  const r = await api("api/utenti?ottici=1"); if (scaduta(r) || !r.ok) return;
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
  if (r.ok && r.data.stato){ esito($("cfEsito"), `Questo cliente è già registrato${r.data.nome ? " (" + r.data.nome + ")" : ""}${r.data.univoco ? ", codice " + r.data.univoco : ""}. Stato: ${r.data.stato.toLowerCase()}. Per un occhiale nuovo usa RINNOVO OCCHIALE.`, "err"); return; }
  esito($("cfEsito"), "", ""); $("attivaCodiceFiscale").hidden = true; $("segnoDiSpunta").hidden = false; $("codiceFiscale").disabled = true;
  campi.forEach(id => $(id).disabled = false); $("inviaLink").disabled = false; $("nome").focus();
  // data di nascita e sesso si leggono dal codice fiscale (restano modificabili)
  const dc = CF.dati(cf); if (dc){ if (!$("datanascita").value) $("datanascita").value = dc.data; if (!$("sesso").value) $("sesso").value = dc.sesso; }
});
$("formCliente").addEventListener("submit", async e => {
  e.preventDefault();
  const v = id => $(id).value.trim();
  const d = {cf: v("codiceFiscale"), nome: v("nome"), cognome: v("cognome"), nato: v("nato"), datanascita: v("datanascita"), sesso: v("sesso"), prefisso: v("prefisso"), cellulare: v("cellulare"), ottica: v("ottica"), amico: v("amico").toUpperCase(), gdpr: $("gdprAcceptance").checked};
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
  const cf = $("cfRinnovo").value.trim(), box = $("rinnovoEsito"); $("rinnovoScelta").hidden = true;
  if (!CF.valido(cf)){ esito(box, "Codice fiscale non valido", "err"); return; }
  const r = await api(`api/utenti?cf=${encodeURIComponent(cf)}`); if (scaduta(r)) return;
  if (!r.data.stato){ esito(box, "Nessun cliente con questo codice fiscale: inseriscilo come nuovo utente.", "info"); return; }
  const d = r.data;
  if (d.bloccato){ box.hidden = false; box.className = "esito"; box.removeAttribute("role"); box.innerHTML = `${esc(d.nome)} · codice ${esc(d.univoco)}` + contattoAdmin(); return; }
  if (!d.rinnovabile){
    const perche = d.stato !== STATI.CONSEGNATO ? "ha un ordine in corso: il rinnovo si fa dopo la consegna degli occhiali."
      : d.rinnovoDal ? `il rinnovo è possibile dal ${new Date(d.rinnovoDal).toLocaleDateString("it-IT")} (30 giorni prima della scadenza).` : "il rinnovo non è ancora possibile.";
    esito(box, `${d.nome} · codice ${d.univoco} · ${d.stato}: ${perche}`, "info"); return;
  }
  esito(box, `${d.nome} · codice ${d.univoco} · ${d.stato}. Scegli l'ottica (anche diversa dalla precedente) e avvia il rinnovo.`, "ok");
  await loadOttici();
  const sel = $("rinnovoOttica"); sel.innerHTML = $("ottica").innerHTML; [...sel.options].forEach(op => { if (!op.value) op.remove(); }); sel.value = d.ottica || "";
  $("rinnovoScelta").hidden = false;
  $("rinnovoAvvia").onclick = async () => {
    $("rinnovoAvvia").disabled = true;
    const x = await post("api/utenti", {azione: "rinnovo", cf, ottica: sel.value}); $("rinnovoAvvia").disabled = false; if (scaduta(x)) return;
    if (x.ok){ $("rinnovoScelta").hidden = true; mostraLink(x.data, ""); } else esito(box, x.data.errore, "err");
  };
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
async function apriClienti(pre){
  pre = pre && !pre.target ? pre : {};
  $("filtroClienti").value = ""; $("filtroSit").value = pre.sit || "";
  open("clientiPopup"); $("clientiLista").innerHTML = '<div class="vuoto">Caricamento…</div>';
  const [da, a] = periodoDa(perCli.p, perCli.da, perCli.a);
  const r = await api(`api/clienti${da || a ? `?da=${da}&a=${a}` : ""}`); if (scaduta(r)) return;
  clienti = r.ok ? r.data.clienti : [];
  // i conteggi hanno la loro pagina («I miei conteggi»): nell'elenco clienti non si ripetono
  const conti = !!pre.conti; $("clientiTitolo").textContent = conti ? "I miei conteggi" : "I miei clienti";
  ["clientiFiltri", "clientiNum", "clientiLista"].forEach(id => { $(id).hidden = conti; });
  disegnaConti(conti && r.ok ? r.data.estratto : null);
  const sel = $("filtroStato"); sel.length = 1;
  ORDINE_STATI.forEach(s => { if (clienti.some(c => c.stato === s)){ const o = document.createElement("option"); o.value = s; o.textContent = s; sel.appendChild(o); } });
  sel.value = pre.stato && [...sel.options].some(o => o.value === pre.stato) ? pre.stato : "";
  cruDati = r.ok ? r.data : cruDati;
  disegnaClienti();
  $("clientiConti").open = conti;
  if (conti && !(r.ok && r.data.estratto)){ $("clientiLista").hidden = false; $("clientiLista").innerHTML = '<div class="vuoto">Non c\'è ancora un accordo economico registrato: contatta SocialGlass.</div>'; }
}
function rinnovoBtn(c, attr){
  if (c.stato !== STATI.CONSEGNATO) return "";
  return c.rinnovabile ? `<button type="button" class="verde" ${attr}>Rinnovo: occhiale nuovo</button>`
    : c.periodo ? `<span class="chip">Rinnovo dal ${new Date(c.periodo.preavviso).toLocaleDateString("it-IT")}</span>` : "";
}
// prima dell'attivazione serve rimandare il link; dopo basta un messaggio
// reinvia al cliente il link della sua scheda personale (WhatsApp)
function linkBtn(c){
  const n = String(c.cellulare || "").replace(/\D/g, ""); if (!n || !c.link) return "";
  const testo = `SocialGlass: ciao ${c.nome}, ecco il link della tua scheda personale: ${c.link}`;
  return `<a class="btn-link" style="flex:0 0 auto" target="_blank" rel="noopener" href="https://wa.me/39${esc(n)}?text=${encodeURIComponent(testo)}">Reinvia link</a>`;
}
const SIT_P = {
  bloccati: c => c.bloccato, scadenza: c => c.periodo && !c.esito && c.periodo.aperto && !c.periodo.scaduto,
  ultimati: c => c.periodo && c.periodo.scaduto, consegnati: c => !!c.consegnatoIl || c.stato === STATI.CONSEGNATO, avvisi: c => !!c.avviso,
  attivi: c => c.attivatoIl && !c.chiuso, inattesa: c => !c.attivatoIl && !c.esito, mese: c => String(c.creato).slice(0, 7) === new Date().toISOString().slice(0, 7),
  fermi: c => c.stato === STATI.REGISTRATO && giorniDa(c.creato) > 3, ritiro: c => !!c.daRitirare, rinnovabili: c => c.rinnovabile && c.stato === STATI.CONSEGNATO && !c.bloccato,
  lab: c => c.lab && c.lab.fonte === "OTTICA" && !c.lab.ritirata && c.lab.stato !== "PRONTO"
};
const dIt = d => d ? new Date(d).toLocaleDateString("it-IT") : "";
const voce = (k, v) => v ? `<dt>${k}</dt><dd>${v}</dd>` : "";
function contattoAdmin(){
  const t = (window.SG_INFO && SG_INFO.titolare) || {};
  const c = [t.telefono ? `<a href="tel:${esc(t.telefono)}">${esc(t.telefono)}</a>` : "", t.email ? `<a href="mailto:${esc(t.email)}">${esc(t.email)}</a>` : ""].filter(Boolean).join(" · ");
  return `<div class="blocco"><b>Anagrafica bloccata.</b> Non è possibile fare operazioni per questo cliente (rinnovo, preventivo, consegna). Contatta l'amministratore di SocialGlass${c ? ": " + c : ""}.</div>`;
}
function ricettaCli(r){
  if (!r) return "";
  const n = (v, max) => { if (v == null || v === "") return ""; let x = Number(v); if (Math.abs(x) > max && Number.isInteger(x)) x /= 100; return (x > 0 ? "+" : "") + x.toFixed(2).replace(".", ","); };
  return `<table class="rx"><tr><th></th><th>Sf</th><th>Cil</th><th>Asse</th><th>Add</th></tr>${["OD", "OS"].map(e => `<tr><th>${e}</th><td>${n(r[e] && r[e].sf, 30)}</td><td>${n(r[e] && r[e].cil, 10)}</td><td>${r[e] && r[e].ax != null ? r[e].ax + "°" : ""}</td><td>${n(r[e] && r[e].add, 4)}</td></tr>`).join("")}</table>${r.pd ? `<div>DP ${esc(r.pd)} mm${r.note ? " · " + esc(r.note) : ""}</div>` : ""}`;
}
let perCli = {p: "", da: "", a: ""};
function disegnaConti(k){
  const box = $("clientiConti"); if (!k){ box.hidden = true; return; }
  $("clientiContiCorpo").innerHTML = campiPeriodo("pc", perCli) + estrattoCorpo(k, true) + `<button type="button" class="no-stampa" data-stampa-estratto style="margin-top:6px">Stampa estratto conto</button>`;
  box.hidden = false;
}
$("clientiConti").addEventListener("change", e => {
  if (e.target.id === "pcP"){ perCli.p = e.target.value; if (perCli.p === "libero"){ $("pcDa").hidden = $("pcA").hidden = false; return; } }
  else if (e.target.id === "pcDa") perCli.da = e.target.value; else if (e.target.id === "pcA") perCli.a = e.target.value; else return;
  if (perCli.p === "libero" && !(perCli.da || perCli.a)) return;
  apriClienti({conti: true});
});
let clientiVisti = [];
function stampaElencoClienti(){
  const isOtt = ruolo() === "ottico", sel = $("filtroStato").value, sit = $("filtroSit");
  const filtri = [sel, sit.value ? sit.options[sit.selectedIndex].text : "", $("filtroClienti").value.trim()].filter(Boolean).join(" · ");
  const conti = "";
  stampaDoc(`Clienti ${isOtt ? "dell'ottica" : "del CAF"} ${sessionStorage.getItem("sg_id") || ""} ${sessionStorage.getItem("sg_nome") || ""}`.trim(), `${filtri ? `<p class="hint">Filtri: ${esc(filtri)}</p>` : ""}${conti}
    <h2>${clientiVisti.length} clienti</h2><table><tr><th>Codice</th><th>Cliente</th>${isOtt ? "<th>CAF</th>" : "<th>Codice fiscale</th>"}<th>Stato</th><th>Montatura</th><th>Abbonamento dal</th><th>Scadenza</th><th>Consegnato</th><th>Note</th></tr>
    ${clientiVisti.map(c => `<tr><td>${esc(c.univoco)}</td><td>${esc(c.nome)} ${esc(c.cognome)}<br><small>${esc(c.cellulare)}</small></td><td>${esc(isOtt ? c.caf : c.cf)}</td><td>${esc(c.stato)}</td><td>${esc(c.montatura || "")}</td>
      <td>${dIt(c.attivatoIl)}</td><td>${c.periodo ? dIt(c.periodo.scadenza) : ""}</td><td>${dIt(c.consegnatoIl)}</td><td>${c.bloccato ? "ANAGRAFICA BLOCCATA" : ""}${c.esito ? esc(c.esito) : ""}</td></tr>`).join("")}</table>`);
}
function disegnaClienti(){
  const q = $("filtroClienti").value.trim().toUpperCase(), st = $("filtroStato").value, sit = $("filtroSit").value, isOtt = ruolo() === "ottico";
  const aperti = new Set([...document.querySelectorAll("#clientiLista details[open]")].map(d => d.dataset.u));
  const l = clienti.filter(c => (!st || c.stato === st) && (!sit || SIT_P[sit](c)) && (!q || `${c.nome} ${c.cognome} ${c.univoco} ${c.cf || ""}`.includes(q)));
  clientiVisti = l;
  $("clientiNum").innerHTML = clienti.length ? `${l.length} di ${clienti.length} clienti · tocca un cliente per aprire la scheda · <button type="button" class="linkbtn" data-stampa-elenco>Stampa elenco</button>` : "";
  $("clientiLista").innerHTML = l.length ? l.map(c => {
    const p = c.periodo, sc = p && !c.esito ? (p.scaduto ? '<span class="chip s2">MESE PER MESE</span>' : p.aperto ? `<span class="chip s2">SCADE TRA ${p.giorni} GG</span>` : "") : "";
    const ultimato = p ? (p.scaduto ? `sì, il ${dIt(p.scadenza)}` : `no, scade il ${dIt(p.scadenza)}`) : "";
    const az = c.bloccato ? linkBtn(c) : isOtt
      ? (c.stato === STATI.MONTATURA || c.stato === STATI.PAGAMENTO ? `<button type="button" data-ord="${esc(c.univoco)}">Inserisci lenti e ricetta</button>` : "")
        + (c.stato === STATI.ATTIVO && !c.lab ? `<button type="button" class="verde" data-azione="pronto" data-u="${esc(c.univoco)}">Segna pronto</button>` : "")
        + (c.stato === STATI.PRONTO ? `<button type="button" class="verde" data-azione="consegnato" data-u="${esc(c.univoco)}">Segna consegnato</button>` : "")
        + (c.daRitirare ? `<button type="button" data-azione="ritirato" data-u="${esc(c.univoco)}">Occhiale ritirato</button>` : "")
        + rinnovoBtn(c, `data-rinnovo-uv="${esc(c.univoco)}"`)
        + (c.recedibile ? `<button type="button" class="grigio" data-recesso="${esc(c.univoco)}">Recesso (14 giorni)</button>` : "")
        + linkBtn(c)
      : rinnovoBtn(c, `data-rinnovo="${esc(c.cf)}"`) + linkBtn(c);
    // ritiro e recesso restano possibili anche con l'anagrafica bloccata
    const azBlocco = c.bloccato && isOtt ? (c.daRitirare ? `<button type="button" data-azione="ritirato" data-u="${esc(c.univoco)}">Occhiale ritirato</button>` : "") + (c.recedibile ? `<button type="button" class="grigio" data-recesso="${esc(c.univoco)}">Recesso (14 giorni)</button>` : "") : "";
    return `<details class="cli" data-u="${esc(c.univoco)}" ${aperti.has(c.univoco) ? "open" : ""}><summary><div class="top"><div><b>${esc(c.nome)} ${esc(c.cognome)}</b><div class="cod">${esc(c.univoco)}${c.cf ? " · " + esc(c.cf) : ""}</div></div>
        <div class="bad" style="display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end">${c.bloccato ? '<span class="chip s3">BLOCCATO</span>' : ""}${c.avviso ? '<span class="chip s1">AVVISO</span>' : ""}${c.dona && c.daRitirare ? '<span class="chip s4">DA DONARE</span>' : ""}${c.voto ? `<span class="chip" title="Recensione del cliente">${"★".repeat(c.voto)}</span>` : ""}${sc}${chip(c.stato)}</div></div></summary>
      <div class="corpo">
      ${c.bloccato ? contattoAdmin() : ""}
      <dl class="dl">${voce("Cellulare", esc(c.cellulare))}${voce(isOtt ? "CAF" : "Ottica", esc(isOtt ? c.caf : c.ottica))}${voce("Registrato il", dIt(c.creato))}
        ${voce("Montatura", esc(c.montatura))}${isOtt ? voce("Codice e calibro", esc([c.montaturaCodice, c.calibro].filter(Boolean).join(" · "))) + voce("Lenti", esc(c.lenti)) + voce("Trattamenti", esc((c.trattamenti || []).join(", "))) : ""}
        ${voce("Valore occhiale", c.totale ? euro(c.totale) : "")}${voce("Canone", c.rata ? euro(c.rata) + "/mese" : "")}${isOtt ? voce("Riscatto", c.riscatto ? euro(c.riscatto) : "") : ""}
        ${voce("Abbonamento dal", dIt(c.attivatoIl))}${voce("Canoni pagati", c.attivatoIl ? String(c.ratePagate) : "")}${voce("Durata minima completata", c.esito ? "" : ultimato)}
        ${c.lab && c.lab.stato !== "PRONTO" ? voce("Laboratorio", c.lab.stato === "DA FARE" ? "in attesa di lavorazione" : "in lavorazione") + (isOtt && c.lab.fonte === "OTTICA" ? voce("Montatura esposta", c.lab.ritirata ? "ritirata dal laboratorio il " + dIt(c.lab.ritirata) : "da consegnare al laboratorio") : "") : ""}
        ${isOtt ? voce("Pronto il", dIt(c.prontoIl)) : ""}${voce("Occhiale ricevuto", c.consegnatoIl ? "sì, il " + dIt(c.consegnatoIl) : c.attivatoIl ? "non ancora" : "")}
        ${voce("Chiuso il", dIt(c.chiuso))}</dl>
      ${isOtt && c.ricetta ? "<b>Ricetta</b>" + ricettaCli(c.ricetta) : ""}
      ${c.esito ? `<div><span class="chip s4">${esc(c.esito)}</span></div>` : ""}
      ${c.finePeriodo ? `<div><span class="chip s2">SCELTA DEL CLIENTE: ${esc(c.finePeriodo)}</span></div>` : ""}
      ${c.daRitirare ? `<div><span class="chip s3">OCCHIALE DA RITIRARE${c.ritiroInRitardo ? " · IN RITARDO" : ""}</span></div>` : ""}
      ${c.dona && c.daRitirare ? `<div class="avviso-cli">💚 Il cliente ha scelto di <b>donare</b> l'occhiale restituito: mettilo da parte per SocialGlass.</div>` : ""}
      ${c.rinnovo && [STATI.ATTIVO, STATI.PRONTO].includes(c.stato) ? `<div class="avviso-cli">Rinnovo: alla consegna del nuovo occhiale riprendi quello precedente.</div>` : ""}
      ${c.avviso ? (c.avviso.whatsapp ? `<div class="avviso-cli">Avviso da inviare al cliente: ${esc(c.avviso.testo)}<br><a class="btn-link" target="_blank" rel="noopener" data-avvisato="${esc(c.univoco)}" href="${esc(c.avviso.whatsapp)}">Invia su WhatsApp</a></div>`
        : `<div class="avviso-cli"><b>Da fare:</b> ${esc(c.avviso.testo)} <button type="button" class="linkbtn" data-avvisato="${esc(c.univoco)}">Fatto</button></div>`) : ""}
      <div class="az">${az}${azBlocco}<button type="button" class="grigio" data-stampa-cli="${esc(c.univoco)}">Stampa scheda</button></div></div></details>`;
  }).join("") : `<div class="vuoto">${clienti.length ? "Nessun cliente con questi filtri." : `Nessun cliente${isOtt ? " assegnato a questa ottica. Il cliente vede l'ottica scelta dal CAF nella sua pagina: se è un'altra, accedi con quel codice ottico." : "."}`}</div>`;
}
$("filtroClienti").addEventListener("input", disegnaClienti);
$("filtroStato").addEventListener("change", disegnaClienti);
$("filtroSit").addEventListener("change", disegnaClienti);
$("clientiPopup").addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-stampa-elenco")) stampaElencoClienti();
  if (b.hasAttribute("data-stampa-estratto")) stampaDoc(`Estratto conto con SocialGlass · ${sessionStorage.getItem("sg_id") || ""} ${sessionStorage.getItem("sg_nome") || ""}`, pulisciStampa($("clientiContiCorpo")));
  if (b.dataset.stampaCli){ const d = document.querySelector(`#clientiLista details[data-u="${CSS.escape(b.dataset.stampaCli)}"]`); if (d) stampaDoc("Scheda cliente", `<div class="cli">${pulisciStampa(d)}</div>`); }
});
$("clientiLista").addEventListener("click", async e => {
  const av = e.target.closest("[data-avvisato]");
  if (av){ post("api/clienti", {univoco: av.dataset.avvisato}).then(() => setTimeout(apriClienti, av.tagName === "A" ? 1500 : 100)); return; }
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.ord){ open("ordinePopup"); resetOrdine(); $("ordineCodice").value = b.dataset.ord; caricaOrdine(b.dataset.ord); return; }
  if (b.dataset.azione){
    b.disabled = true; const r = await post("api/ordine", {univoco: b.dataset.u, azione: b.dataset.azione}); if (scaduta(r)) return;
    if (!r.ok) alertBox(r.data.errore);
    await apriClienti();
    if (r.ok && r.data.avviso) avvisoCliente(r.data.avviso, "Occhiali segnati come pronti.");
    if (r.ok && b.dataset.azione === "ritirato") alertBox(r.data.rinnovo ? "Occhiale vecchio ritirato: il cambio è completo, l'abbonamento continua con quello nuovo."
      : r.data.chiuso ? `Occhiale restituito registrato: l'abbonamento era già chiuso.${r.data.daDonare ? " Il cliente ha scelto di donarlo: tienilo da parte per SocialGlass." : ""}`
      : `Occhiale restituito registrato: l'abbonamento si chiude da solo alla fine del mese in corso.${r.data.daDonare ? " Il cliente ha scelto di donarlo: tienilo da parte per SocialGlass." : ""}`);
    return;
  }
  if (b.dataset.recesso){
    if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi il recesso? Tocca di nuovo"; b.className = "verde"; return; }
    b.disabled = true; const r = await post("api/ordine", {univoco: b.dataset.recesso, azione: "recesso"}); if (scaduta(r)) return;
    if (!r.ok){ b.disabled = false; alertBox(r.data.errore); return; }
    await apriClienti(); avvisoCliente(r.data.avviso || {}, "Recesso registrato: abbonamento chiuso, niente altri addebiti. Fai il rimborso dalla dashboard Stripe (Pagamenti → rimborsa).");
    return;
  }
  if (b.dataset.rinnovo || b.dataset.rinnovoUv){
    if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi il rinnovo? Il cliente sceglie la nuova montatura: tocca di nuovo"; return; }
    b.disabled = true; const x = await post("api/utenti", b.dataset.rinnovoUv ? {azione: "rinnovo", univoco: b.dataset.rinnovoUv} : {azione: "rinnovo", cf: b.dataset.rinnovo}); if (scaduta(x)) return;
    if (!x.ok){ b.disabled = false; alertBox(x.data.errore); return; }
    await apriClienti(); avvisoCliente(x.data.avviso || {whatsapp: x.data.whatsapp, sms: x.data.smsInviato}, "Rinnovo avviato: il cliente sceglie la nuova montatura e conferma il nuovo canone dal suo link.");
  }
});
function alertBox(t){ notaDemo(t); }
// avviso al cliente dopo un'azione dell'ottico: SMS automatico oppure WhatsApp con un tocco
function avvisoCliente(av, titolo){
  const box = document.createElement("div"); box.className = "esito ok";
  box.innerHTML = `${esc(titolo)} ${av.sms ? (av.canale === "whatsapp" ? "Il cliente è stato avvisato su WhatsApp." : av.canale === "notifica" ? "Il cliente ha ricevuto una notifica sul telefono." : "Il cliente ha ricevuto un SMS.") : `Avvisa il cliente: <a class="btn-link" style="display:inline-block;margin:6px 0 0" target="_blank" rel="noopener" href="${esc(av.whatsapp)}">Invia su WhatsApp</a>`}`;
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
  if (d.bloccato){ const e = $("ordineEsito"); e.hidden = false; e.className = "esito"; e.removeAttribute("role"); e.innerHTML = `${esc(d.nome)} ${esc(d.cognome)}` + contattoAdmin(); return; }
  const m = o.montatura;
  if (!m || ![STATI.MONTATURA, STATI.PAGAMENTO].includes(d.stato)){
    esito($("ordineEsito"), `${d.nome} ${d.cognome} · ${d.stato}. ` + (!m ? "Il cliente deve prima scegliere la montatura con il QR (pulsante «Ho scelto la montatura» sul suo link)." : "L'ordine è già confermato."), m ? "ok" : "info");
    return;
  }
  $("ordineCliente").innerHTML = `<b>${esc(d.nome)} ${esc(d.cognome)}</b> · ${chip(d.stato)}<br>Montatura: <b>${esc(m.modello)} ${esc(m.colore)}</b> · calibro ${esc(m.calibro)}-${esc(m.asse)} · cod. ${esc(m.codice)}`;
  const L = d.listino;
  // i prezzi arrivano dal server (listini aggiornati dall'amministratore): il calcolo qui usa gli stessi
  if (L && L.lenti) LISTINI.LISTINI.convenzioni[String(L.id || "A").toUpperCase()] = {montatura: L.montatura, lenti: L.lenti, trattamenti: L.trattamenti};
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
  // stesso calcolo del server (anche il prezzo della singola montatura, se indicato)
  const m = ordCorrente.ordine && ordCorrente.ordine.montatura;
  const pv = LISTINI.preventivo(L.id || "A", s.lente, s.trattamenti, m && m.prezzo);
  if (!pv) return;
  $("ordineTotale").innerHTML = `Valore occhiale <b>${euro(pv.totale)}</b> (montatura ${euro(pv.montatura)} + lenti ${euro(pv.lenti.prezzo)}${s.trattamenti.length ? " + trattamenti" : ""})<br>Abbonamento <b>${euro(pv.rata)}/mese</b> · durata minima ${pv.mesi} mesi · spedizione ${euro(pv.spedizione)} · riscatto a fine periodo ${euro(pv.riscatto)}`;
  $("formOrdine").querySelectorAll("[name$=_add]").forEach(x => { x.disabled = !(s.lente === "prog" || /progressiv|multifocal/i.test(((L.lenti || {})[s.lente] || {}).nome || "")); if (x.disabled) x.value = ""; });
}
$("formOrdine").addEventListener("change", calcolaOrdine);
$("formOrdine").addEventListener("input", () => { $("ordineErr").hidden = true; });
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
avvioApp();
if (UNIVOCO) document.body.classList.add("cliente");
let mio = null, pollT = 0;
if (!UNIVOCO && ESPOSITORE){ $("scan-btn").hidden = false; document.body.classList.add("con-scan"); }
// [testo quando la tappa è fatta, testo quando è la prossima da fare]
const TAPPE = [
  ["Registrazione", "Registrazione"],
  ["Montatura scelta", "Scegli la montatura in ottica"],
  ["Lenti e ricetta inserite", "L'ottico inserisce lenti e ricetta"],
  ["Abbonamento attivato", "Attiva l'abbonamento"],
  ["Occhiali pronti", "Occhiali in lavorazione"],
  ["Occhiali consegnati", "Ritiro in ottica"]
];
async function caricaMio(apri){
  const r = await api(`api/benvenuto?univoco=${encodeURIComponent(UNIVOCO)}&espositore=${encodeURIComponent(ESPOSITORE)}`);
  if (!r.ok){ if (apri){ $("mpTitolo").textContent = "Link non valido"; $("mpTappe").innerHTML = ""; $("mpAzione").innerHTML = `<div class="esito err">${esc(r.data.errore || "Link non valido o scaduto.")} Contatta il tuo CAF.</div>`; open("miaPagina"); } return null; }
  mio = r.data; $("mio-ordine").hidden = false;
  disegnaMio(); return mio;
}
window.SG_PROVE = {mio: () => mio, ricarica: () => caricaMio(false)};   // PROVE TECNICHE: aggancio della barra del tempo (prove-tempo.js), da togliere con lei
const dt = d => new Date(d).toLocaleDateString("it-IT");
// regole di fine periodo spiegate al cliente, con le sue date
function regoleFine(p, per){
  const sc = per ? `il ${dt(per.scadenza)}` : `dopo ${p.mesi || 12} mesi`;
  return `<ul class="regole">
    <li><b>Occhiale nuovo:</b> vai dal tuo ottico (o da un altro ottico SocialGlass), scegli la nuova montatura e confermi il nuovo canone. L'abbonamento continua senza interruzioni; quando ritiri il nuovo riconsegni il vecchio.</li>
    <li><b>Lo tengo:</b> paghi una volta ${p.riscatto ? euro(p.riscatto) : "il riscatto"}, l'abbonamento si chiude e l'occhiale diventa tuo.</li>
    <li><b>Lo restituisco:</b> riporti l'occhiale in ottica entro 15 giorni; l'abbonamento si chiude a fine mese, senza altri costi.</li>
    <li><b>Se non scegli niente:</b> ${sc} l'abbonamento continua mese per mese allo stesso canone, con lo stesso occhiale, e puoi disdire quando vuoi.</li></ul>`;
}
// come spiegare al cliente la chiusura (i codici interni restano per ottica e amministratore)
const entro15 = d => new Date(new Date(d).getTime() + 15 * 864e5).toLocaleDateString("it-IT", {day: "numeric", month: "long"});
function testoEsito(pg, od){
  const e = String(pg.esito || ""), rit = od.ritiro && od.ritiro.daRitirare && !od.ritiro.ritirato && !od.ritiro.rinnovo, quando = rit ? ` entro il <b>${entro15(od.ritiro.dal)}</b>` : "";
  if (/RISCATTAT/.test(e)) return `<b>L'occhiale ora è tuo.</b> L'abbonamento è chiuso${pg.chiuso ? ` dal ${dt(pg.chiuso)}` : ""}: niente più canoni. Quando vuoi un occhiale nuovo, chiedi al tuo ottico.`;
  if (/RESTITUITO/.test(e)) return `<b>Occhiale restituito, grazie.</b> L'abbonamento è chiuso${pg.chiuso ? ` dal ${dt(pg.chiuso)}` : " a fine mese"}, senza altri costi.`;
  if (/DISDETTO|RESTITUZIONE/.test(e)) return `<b>Hai scelto di restituire l'occhiale.</b> Riportalo in ottica${quando}: l'abbonamento si chiude a fine mese, senza altri costi.`;
  if (/MANCATO PAGAMENTO/.test(e)) return `<b>L'abbonamento è stato chiuso</b> perché un canone non è stato pagato per oltre 30 giorni.${rit ? ` Riporta l'occhiale in ottica${quando}, oppure chiedi all'ottico di riscattarlo.` : ""}`;
  if (/RECESSO/.test(e)) return `<b>Hai esercitato il recesso:</b> l'abbonamento è chiuso e non ci saranno altri addebiti. Il rimborso arriva sul metodo di pagamento usato.${rit ? ` Riporta l'occhiale in ottica${quando}.` : ""}`;
  return `<b>Abbonamento chiuso</b>${pg.chiuso ? ` dal ${dt(pg.chiuso)}` : ""}.${rit ? ` Riporta l'occhiale in ottica${quando}.` : ""}`;
}
function boxAbbonamento(od){
  const p = od.prezzi || {}, per = od.periodo, pg = od.pagamento || {};
  if (!per) return "";
  if (pg.chiuso || pg.esito) return "";   // la chiusura si spiega nel messaggio in alto (testoEsito)
  const fp = od.finePeriodo;
  const stato = per.scaduto ? `La durata minima è finita il ${dt(per.scadenza)}: l'abbonamento continua mese per mese.`
    : per.aperto ? `<b>Mancano ${per.giorni} giorni</b> alla fine della durata minima (${dt(per.scadenza)}). Scegli cosa fare:`
    : `Dal ${dt(per.preavviso)} ti scriviamo e scegli cosa fare. Se vuoi, puoi scegliere già adesso.`;
  const aperte = per.aperto || per.scaduto || !!fp;
  const bottoni = fp && fp.eseguita ? "" : `<div class="scelte" style="margin-top:8px">
        <button type="button" class="${fp && fp.scelta === "rinnova" ? "verde" : "grigio"} full" data-fine="rinnova">Occhiale nuovo</button>
        <button type="button" class="${fp && fp.scelta === "riscatta" ? "verde" : "grigio"} full" data-fine="riscatta">Lo tengo${p.riscatto ? ` (${euro(p.riscatto)})` : ""}</button>
        <button type="button" class="${fp && fp.scelta === "restituisci" ? "verde" : "grigio"} full" data-fine="restituisci">Lo restituisco e chiudo</button></div><div id="fineConferma"></div>`;
  return `<div class="scheda"><b>Il tuo abbonamento</b>
      <div class="date"><span>Inizio <b>${dt(per.inizio)}</b></span><span>Durata minima fino al <b>${dt(per.scadenza)}</b></span><span>Canone <b>${euro(p.rata)}/mese</b></span></div>
      <p style="margin:8px 0 4px">${stato}</p>
      ${fp ? `<div class="esito ok" style="margin-top:8px">Hai scelto: <b>${esc(fp.descrizione)}</b>.${fp.eseguita ? "" : per.scaduto ? " La eseguiamo a breve." : ` Vale dal ${dt(per.scadenza)}: puoi cambiare idea fino ad allora.`}</div>` : ""}
      ${per.aperto && !per.chiuso && !(fp && fp.eseguita) && !(fp && fp.scelta !== "rinnova") ? `<button type="button" class="grigio full" id="mpRinnovaCat" style="margin:6px 0">Guarda le montature nuove nella tua ottica</button>` : ""}
      ${aperte ? regoleFine(p, per) + bottoni
        : `<details class="regole-box"><summary>Cosa succede alla scadenza</summary>${regoleFine(p, per)}${bottoni}</details>`}
    </div>`;
}
function disegnaMio(){
  const u = mio, o = u.ottico, od = u.ordine || {}, i = ORDINE_STATI.indexOf(u.stato);
  const rinnovo = (od.storico || 0) > 0;
  $("mpTitolo").textContent = u.stato === STATI.REGISTRATO && !rinnovo ? `Benvenuto in SocialGlass, ${u.nome}` : rinnovo && [STATI.REGISTRATO, STATI.MONTATURA, STATI.PAGAMENTO].includes(u.stato) ? `Il tuo occhiale nuovo, ${u.nome}` : `Ciao ${u.nome}`;
  // tracciamento: tappe fatte in verde, quella in corso in blu che pulsa
  $("mpTappe").outerHTML = `<div id="mpTappe">${traccia(u)}</div>`;
  let a = "";
  const dove = o ? `<b>${esc(o.nome)}</b><br>${esc(o.indirizzo)}${esc(o.citta)}` : "";
  if (u.stato === STATI.REGISTRATO){
    a = `${rinnovo ? `<div class="esito info" style="margin-bottom:10px"><b>Cambio occhiale:</b> scegli la nuova montatura in ottica. Fino al ritiro del nuovo continui a usare quello che hai.</div>` : ""}<div class="scheda">1) Vai dall'ottico:<br>${dove}<br>2) All'ottico mostra il codice <b>${esc(UNIVOCO)}</b>: così trova il tuo ordine<br>3) Scegli la montatura, poi premi <b>«Ho scelto la montatura»</b> e inquadra il quadratino QR sul cartellino della montatura (o scrivi il codice che c'è sotto).</div>
      <button type="button" class="verde full" id="mpScan">Ho scelto la montatura</button>`;
  } else if (u.stato === STATI.MONTATURA){
    a = `<div class="esito ok">Montatura scelta: <b>${esc(od.montatura.modello)} ${esc(od.montatura.colore)}</b>.</div><p style="margin:0 0 10px">Ora l'ottico inserisce le lenti e la tua ricetta. Questa pagina si aggiorna da sola e ti mandiamo un messaggio: tra poco vedrai il riepilogo con il canone mensile.</p>
      <button type="button" class="grigio full" id="mpScan">Ho cambiato idea: scansiona un'altra montatura</button>`;
  } else if (u.stato === STATI.PAGAMENTO && par("pagamento") === "ok" && od.pagamento && od.pagamento.stato === "IN CORSO"){
    a = `<div class="esito ok"><b>Pagamento inviato.</b> Stripe ci sta confermando l'attivazione: di solito bastano pochi secondi e questa pagina si aggiorna da sola. Non ripetere il pagamento.</div>`;
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
        <li>L'ottico prepara il nuovo occhiale e ti avvisiamo quando è pronto. Quando ritiri il nuovo, riconsegni quello vecchio (resta dell'ottica).</li></ol></div>
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
        <div class="r"><span>Poi ogni mese, il giorno ${new Date().getDate()}</span><span>${euro(p.rata)}</span></div>
        <div class="r"><span>Impegno minimo: ${p.mesi} canoni + spedizione</span><span>${euro(p.rata * p.mesi + p.spedizione)}</span></div>
        ${p.riscatto ? `<div class="r"><span>Dopo ${p.mesi} mesi, se vuoi tenerlo</span><span>${euro(p.riscatto)}</span></div>` : ""}
      </div>
      <div class="scheda"><b>Cosa succede adesso</b><ol class="passi-ora">
        <li>Premi il pulsante: si apre la pagina sicura di pagamento (Stripe).</li>
        <li>Inserisci carta o IBAN: paghi il primo mese e la spedizione.</li>
        <li>L'ottico riceve la conferma e prepara gli occhiali. Ti avvisiamo quando sono pronti.</li>
        <li>Dopo ${p.mesi} mesi scegli tu (ti avvisiamo 30 giorni prima).</li></ol>
        <details class="regole-box"><summary>Cosa succede dopo ${p.mesi} mesi</summary>${regoleFine(p, null)}</details></div>
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
    const per = od.periodo, fp = od.finePeriodo, pgx = od.pagamento || {};
    a = (pgx.chiuso || pgx.esito ? `<div class="esito ${/MANCATO/.test(pgx.esito || "") ? "err" : "ok"}">${testoEsito(pgx, od)}</div>`
      : per && per.aperto && !per.chiuso && !fp ? `<div class="esito info"><b>${per.scaduto ? "I 12 mesi minimi sono finiti" : `Tra ${per.giorni} giorni finiscono i ${per.mesi} mesi minimi`}</b>: scegli qui sotto se vuoi un occhiale nuovo, tenerlo o restituirlo.</div>`
      : od.ritiro && od.ritiro.daRitirare && !od.ritiro.ritirato && od.ritiro.rinnovo ? `<div class="esito info"><b>Ricordati di riconsegnare il vecchio occhiale</b> in ottica: resta dell'ottica e serve per chiudere il cambio.</div>`
      : `<div class="esito ok">Occhiali consegnati. Buona visione! Controllo della vista e una sostituzione all'anno in caso di rottura sono inclusi: chiedi al tuo ottico.</div>`) + boxAbbonamento(od);
  }
  const pgr = od.pagamento || {};
  // chiusura negli altri stati (recesso prima della consegna, ordine annullato…): stesso messaggio chiaro in alto
  if ((pgr.chiuso || pgr.esito) && u.stato !== STATI.CONSEGNATO && od.prezzi) a = `<div class="esito ${/MANCATO/.test(pgr.esito || "") ? "err" : "info"}">${testoEsito(pgr, od)}</div>` + a;
  if ((u.stato === STATI.CONSEGNATO || u.stato === STATI.PRONTO) && !pgr.chiuso && !pgr.insoluto) a = boxRecensione(u) + a;
  a = boxAppuntamento(u) + a;
  a += boxDona(u);
  if (u.stato === STATI.PAGAMENTO && par("pagamento") === "annullato") a = `<div class="esito info">Pagamento annullato: non ti è stato addebitato nulla. Quando vuoi, riprova da qui.</div>` + a;
  const ins = od.pagamento && !od.pagamento.chiuso && od.pagamento.insoluto;
  if (ins) a = `<div class="esito err"><b>${ins.tipo === "riscatto" ? "Pagamento del riscatto non riuscito" : "Pagamento del canone non riuscito"}</b> (${euro(ins.importo)}).
    ${ins.tipo !== "riscatto" && ins.giorni != null ? `<div style="font-size:18px;font-weight:700;margin:6px 0">${ins.giorni > 0 ? `Mancano ${ins.giorni} ${ins.giorni === 1 ? "giorno" : "giorni"} alla chiusura dell'abbonamento` : "L'abbonamento si chiude oggi"}</div>` : ""}
    Riproveremo in automatico${ins.prossimoTentativo ? " il " + new Date(ins.prossimoTentativo).toLocaleDateString("it-IT") : ""}: controlla che la carta o il conto abbiano disponibilità.${ins.tipo !== "riscatto" ? " Se non paghi, alla chiusura l'occhiale va restituito." : ""}
    ${ins.link ? `<a class="btn-link" style="display:block;margin-top:8px;text-align:center" href="${esc(ins.link)}" target="_blank" rel="noopener">Paga ora o cambia carta</a>` : ""}</div>` + a;
  if (od.pagamento && od.pagamento.ratePagate && od.prezzi && !od.pagamento.chiuso) a += `<p style="margin:8px 0 0;font-size:13px;color:#555">Mesi pagati in questo periodo: ${od.pagamento.ratePagate} su ${od.prezzi.mesi} minimi</p>`;
  if (od.prezzi && !a.includes(`id="mpCond"`)) a += `<p class="piede-cli"><button type="button" class="linkbtn" id="mpCond">Condizioni dell'abbonamento</button></p>`;
  a += bannerApp(u) + strumentiCli(u);
  a += `<p class="piede-cli"><a href="privacy.html" target="_blank" rel="noopener">Informativa privacy</a></p>`;
  if (o && o.telefono) a += `<p class="piede-cli">Domande? <a href="tel:+${esc(String(o.telefono).replace(/\D/g, ""))}">Chiama ${esc(o.nome)}</a></p>`;
  $("mpAzione").innerHTML = a;
  const sc = $("mpScan"); if (sc) sc.onclick = startScan;
  const on = (id, f) => { const el = $(id); if (el) el.onclick = f; };
  on("mpApp", attivaApp); on("mpTessera", apriTessera); on("mpAmico", amico); on("mpAnno", mioAnno);
  on("mpPrenota", apriPrenota); on("mpCatalogo", apriCatalogo); on("mpCarta", apriCarta); on("mpRicevute", apriRicevute); on("mpContratto", apriContratto); on("mpSegnala", apriSegnala); on("mpRinnovaCat", apriCatalogo);
  on("mpChiama", () => apriExtra("La mia ottica", o ? `<div class="scheda"><b>${esc(o.nome)}</b><br>${esc(o.indirizzo)}${esc(o.citta)}</div><div class="riga">${o.telefono ? `<a class="btn-link" href="tel:+${esc(String(o.telefono).replace(/\D/g, ""))}">Chiama</a>` : ""}<a class="btn-link" style="background:var(--blu)" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(o.nome + " " + o.indirizzo + " " + o.citta)}">Indicazioni</a></div>` : "<p>Ottica non ancora assegnata.</p>"));
  const dn = $("mpDona"); if (dn) dn.onchange = async () => { const r = await post("api/benvenuto", {azione: "dona", univoco: UNIVOCO, si: dn.checked}); if (!r.ok){ dn.checked = !dn.checked; notaDemo(r.data.errore || "Riprova."); } else { mio.dona = Object.assign({}, mio.dona, {si: dn.checked}); if (dn.checked) notaDemo("Grazie! Lo doneremo a chi ne ha bisogno."); } };
  const rec = $("mpRec"); if (rec){ let voto = 0;
    rec.querySelectorAll("[data-stella]").forEach(b => b.onclick = () => { voto = +b.dataset.stella; rec.querySelectorAll("[data-stella]").forEach(x => x.classList.toggle("on", +x.dataset.stella <= voto)); $("mpRecInvia").disabled = false; });
    $("mpRecInvia").onclick = async () => { $("mpRecInvia").disabled = true; const r = await post("api/benvenuto", {azione: "recensione", univoco: UNIVOCO, voto, testo: $("mpRecTesto").value});
      if (!r.ok){ $("mpRecInvia").disabled = false; return notaDemo(r.data.errore || "Riprova."); }
      mio.recensione = {voto}; rec.innerHTML = voto >= 4 ? `<b>Grazie! 🎉</b>${r.data.google ? `<p style="margin:6px 0 10px">Ci aiuti a farci conoscere? Bastano 30 secondi.</p><a class="btn-link" target="_blank" rel="noopener" href="${esc(r.data.google)}">Scrivilo anche su Google</a>` : ""}` : `<b>Grazie per la sincerità.</b><p style="margin:6px 0 0">Ti contattiamo presto per capire cosa possiamo migliorare.</p>`; }; }
  festeggia(u);
  const pc = $("mpPaga"); if (pc) pc.onclick = attivaRate;
  const cc = $("mpCond"); if (cc) cc.onclick = mostraCondizioni;
  $("mpAzione").querySelectorAll("[data-fine]").forEach(b => b.onclick = async () => {
    const T = {rinnova: "Vuoi un occhiale nuovo? Passa dal tuo ottico (puoi prenotare da questa pagina): scegli la montatura e l'abbonamento continua con il nuovo canone. Il vecchio lo riconsegni quando ritiri il nuovo.",
      riscatta: `Vuoi tenere l'occhiale? Alla scadenza paghi ${euro((mio.ordine.prezzi || {}).riscatto)} una volta e l'abbonamento si chiude.`,
      restituisci: "Vuoi restituire l'occhiale? Alla scadenza lo riporti in ottica entro 15 giorni e l'abbonamento si chiude a fine mese."};
    const box = $("fineConferma");
    if (box && !b.dataset.ok){
      box.innerHTML = `<div class="conferma">${esc(T[b.dataset.fine])}<div class="riga"><button type="button" class="verde" id="fineSi">Confermo</button><button type="button" class="grigio" id="fineNo">Annulla</button></div></div>`;
      $("fineNo").onclick = () => { box.innerHTML = ""; };
      $("fineSi").onclick = () => { b.dataset.ok = "1"; box.innerHTML = ""; b.click(); };
      box.scrollIntoView({block: "nearest", behavior: "smooth"}); return;
    }
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
function testoCondizioni(){
  const p = mio.ordine.prezzi;
  const o = mio.ottico;
  const T = (window.SG_INFO && SG_INFO.titolare) || {};
  return `${T.ragione ? `<p>Contratto di abbonamento con <b>${esc(T.ragione)}</b>${T.piva ? `, P.IVA ${esc(T.piva)}` : ""}${T.indirizzo ? `, ${esc(T.indirizzo)}` : ""}.</p>` : ""}
    <p><b>1. Cosa ricevi.</b> ${o ? esc(o.nome) : "L'ottica"} ti dà in uso un occhiale da vista con le tue lenti (valore ${euro(p.totale)}). L'occhiale resta di proprietà dell'ottica: non lo stai comprando a rate e non c'è nessun obbligo di acquisto.</p>
    <p><b>2. Quanto paghi.</b> ${euro(p.rata)} al mese, senza interessi né altri costi, più la spedizione (${euro(p.spedizione)}) una sola volta. Il primo mese si paga alla conferma, poi ogni mese nello stesso giorno con addebito automatico su carta o conto (SEPA).</p>
    <p><b>3. Durata e scadenza.</b> Minimo ${p.mesi} mesi. 30 giorni prima della scadenza ti avvisiamo con un messaggio e puoi scegliere:</p>${regoleFine(p, mio.ordine.periodo)}
    <p><b>Rinnovo.</b> Lo puoi fare dal tuo ottico, da un altro ottico SocialGlass o dal CAF, a partire da 30 giorni prima della scadenza. L'abbonamento continua con il nuovo canone e, quando ritiri l'occhiale nuovo, riconsegni quello vecchio. Non si possono avere due abbonamenti insieme.</p>
    <p><b>4. Servizi inclusi.</b> Controllo della vista ogni anno, una sostituzione all'anno in caso di rottura (escluso smarrimento), cambio occhiale ogni ${p.mesi} mesi.</p>
    <p><b>5. Se un pagamento non riesce.</b> Ti avvisiamo e riproviamo in automatico per circa 2 settimane. Puoi pagare subito dal link che ricevi. Se il pagamento resta non saldato per oltre 30 giorni, l'abbonamento si chiude e l'occhiale va restituito all'ottica (o riscattato pagando la differenza).</p>
    <p><b>6. Recesso.</b> Puoi ripensarci entro 14 giorni dall'attivazione: dillo al tuo ottico, che chiude subito l'abbonamento. Restituisci l'occhiale integro e ti rimborsiamo quanto pagato, tranne la spedizione e le lenti già fatte su misura.</p>
    <p><b>Montatura prenotata.</b> La montatura che scegli resta prenotata per te 30 giorni: se in quel tempo non confermi l'ordine, torna disponibile e puoi sceglierne un'altra dal tuo link.</p>
    <p><b>7. Dati.</b> La ricetta è un dato sanitario: la vedono solo l'ottica e SocialGlass per preparare l'occhiale. I dati di pagamento li gestisce Stripe. Leggi l'<a href="privacy.html" target="_blank" rel="noopener">informativa privacy</a>.</p>
    <p><b>8. Detrazione.</b> Per la detrazione fiscale chiedi all'ottica il documento fiscale dei canoni pagati (da verificare con il tuo CAF).</p>`;
}
function mostraCondizioni(){
  $("condizioniTesto").innerHTML = testoCondizioni();
  open("condizioniPopup");
}
$("mio-ordine").addEventListener("click", async () => { await caricaMio(true); open("miaPagina"); });
if (UNIVOCO){
  // il link personale apre subito la pagina dell'ordine, con il saluto dentro
  caricaMio(true).then(u => { if (u) open("miaPagina"); });
}

/* ---------- scanner QR ---------- */
let stream = null, scanning = false, detector = null;
async function startScan(){
  closeAll(); $("video-container").hidden = false; $("video-container").querySelector("p").textContent = "Inquadra il quadratino QR sul cartellino della montatura";
  try { stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: "environment"}, audio: false}); }
  catch(e){ $("video-container").classList.add("senza-video"); $("video-container").querySelector(".mirino").hidden = true; $("preview").hidden = true; $("video-container").querySelector("p").textContent = "Fotocamera non disponibile: scrivi il codice che trovi sull'etichetta della montatura."; return; }
  $("video-container").classList.remove("senza-video"); $("video-container").querySelector(".mirino").hidden = false; $("preview").hidden = false;
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
  const codice = codiceDa(raw), r = await api(`api/montatura?codice=${encodeURIComponent(codice)}${UNIVOCO ? "&univoco=" + encodeURIComponent(UNIVOCO) : ""}`);
  const t = $("qr-text"), b = $("qr-btn");
  if (r.ok && r.data.disponibile){
    const m = r.data;
    t.innerHTML = `<b>MONTATURA DISPONIBILE</b><br>Modello: ${esc(m.modello)}<br>Colore: ${esc(m.colore)}<br>Calibro: ${esc(m.calibro)}${m.asse ? `<br>Asta: ${esc(m.asse)}` : ""}`;
    b.hidden = !UNIVOCO; b.textContent = "Scelgo questa montatura";
    b.onclick = async () => {
      b.disabled = true; const s = await post("api/montatura", {univoco: UNIVOCO, codice: m.codice}); b.disabled = false;
      if (!s.ok){ t.textContent = s.data.errore || "Si è verificato un errore. Riprova."; b.hidden = true; return; }
      await caricaMio(false); open("miaPagina");
    };
    if (!UNIVOCO) t.insertAdjacentHTML("beforeend", "<br><br>Per sceglierla apri il link personale che hai ricevuto via SMS o WhatsApp.");
  } else { t.innerHTML = `<b>MONTATURA NON DISPONIBILE</b><br>Il codice «${esc(codice)}» non esiste o la montatura è già stata scelta da un altro cliente. Controlla l'etichetta o scegline un'altra.`; b.hidden = true; }
  open("popup");
}
$("scan-btn").addEventListener("click", startScan);
$("close-video-btn").addEventListener("click", () => { stopScan(); if (mio) open("miaPagina"); });
$("qr-riprova").addEventListener("click", () => { $("popup").hidden = true; startScan(); });
// indirizzi diretti: /caf, /ottico e /admin aprono subito l'accesso giusto
{ const m = location.pathname.match(/\/(caf|ottico|admin)\/?$/);
  if (m && !UNIVOCO) ready.finally(() => m[1] === "admin" ? apriAdmin() : entra(m[1])); }
$("formManuale").addEventListener("submit", e => { e.preventDefault(); const c = $("codiceManuale").value.trim(); if (!c) return; stopScan(); verificaQR(c); });
})();
