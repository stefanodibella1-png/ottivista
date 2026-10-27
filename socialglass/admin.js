/* SocialGlass · pannello amministratore (si apre toccando 7 volte il logo) */
(() => {
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const euro = v => Number(v || 0).toLocaleString("it-IT", {style: "currency", currency: "EUR"});
let tok = sessionStorage.getItem("sg_admin") || "", dati = null, scheda = "numeri";
async function call(azione, extra){
  const r = await fetch("api/admin", {method: "POST", headers: Object.assign({"Content-Type": "application/json"}, tok ? {Authorization: "Bearer " + tok} : {}), body: JSON.stringify(Object.assign({azione}, extra || {}))});
  let d = {}; try { d = await r.json(); } catch(e){}
  if (r.status === 401 && tok){ tok = ""; sessionStorage.removeItem("sg_admin"); }
  return {ok: r.ok, status: r.status, data: d};
}
function crea(){
  if ($("adminPopup")) return;
  const d = document.createElement("div"); d.className = "popup"; d.id = "adminPopup"; d.hidden = true;
  d.innerHTML = `<div class="popup-content alto largo" role="dialog" aria-modal="true" aria-labelledby="admTit">
    <h2 id="admTit">Pannello SocialGlass</h2><div id="admCorpo"></div>
    <button class="close-btn" type="button" data-close aria-label="Chiudi">&times;</button></div>`;
  document.body.appendChild(d);
  d.addEventListener("click", clic); d.addEventListener("submit", invio);
}
function mostra(){ document.querySelectorAll(".popup").forEach(p => p.hidden = p.id !== "adminPopup"); $("adminPopup").hidden = false; }
let ultimo = null;
function msg(t, k){ ultimo = t ? {t, k, il: Date.now()} : null; const e = $("admMsg"); if (e){ e.textContent = t; e.className = "esito " + (k || "ok"); e.hidden = !t; e.setAttribute("role", k === "err" ? "alert" : "status"); } }
async function apri(){
  crea(); mostra();
  if (tok){ await carica(); return; }
  const s = await call("stato");
  if (!s.ok){ $("admCorpo").innerHTML = `<div class="esito err">${esc(s.data.errore || "Pannello non disponibile in questa anteprima: si usa sul sito pubblicato.")}</div>`; return; }
  $("admCorpo").innerHTML = s.data.impostata
    ? `<form data-f="accedi"><label class="lbl" for="admPw">Password amministratore</label><input type="password" id="admPw" autocomplete="current-password" required><div class="esito" id="admMsg" hidden></div><button type="submit" class="full">Entra</button></form>`
    : `<p>Primo accesso: scegli la password del pannello (almeno 10 caratteri). Conservala: serve per gestire CAF, ottici e montature.</p>
       <form data-f="imposta"><label class="lbl" for="admPw">Nuova password</label><input type="password" id="admPw" autocomplete="new-password" minlength="10" required>
       <label class="lbl" for="admPw2">Ripeti la password</label><input type="password" id="admPw2" autocomplete="new-password" minlength="10" required><div class="esito" id="admMsg" hidden></div><button type="submit" class="full verde">Salva e entra</button></form>`;
}
async function carica(){
  const r = await call("dati"); if (!r.ok){ if (r.status === 401) return apri(); $("admCorpo").innerHTML = `<div class="esito err">${esc(r.data.errore || "Errore")}</div>`; return; }
  dati = r.data; disegna();
}
const TAB = [["numeri", "Numeri"], ["clienti", "Clienti"], ["caf", "CAF"], ["ottici", "Ottici"], ["montature", "Montature"], ["impostazioni", "Impostazioni"]];
let clientiAdm = null, cercaAdm = "";
function disegna(){
  const d = dati, opt = l => d.listini.map(x => `<option ${x === l ? "selected" : ""}>${esc(x)}</option>`).join("");
  let h = `<div class="riga" role="tablist">${TAB.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === scheda}" class="${k === scheda ? "" : "grigio"}" data-tab="${k}" style="margin:0 0 6px">${t}</button>`).join("")}</div><div class="esito" id="admMsg" hidden></div>`;
  if (d.prova) h += `<div class="esito info">Sono ancora attivi gli accessi di prova (CAF001, OTT07, OTT12 con password «demo»). Prima di aprire il servizio al pubblico rimuovili da <b>Impostazioni</b>.</div>`;
  if (scheda === "numeri"){
    const n = d.numeri;
    h += `<div class="scheda"><div class="date"><span>Clienti <b>${n.clienti}</b></span><span>Abbonamenti attivi <b>${n.abbonamentiAttivi}</b></span><span>Canoni al mese <b>${euro(n.canoniMensili)}</b></span></div></div>
      <div class="scheda"><b>Pronto per il pubblico?</b><ul class="regole" style="list-style:none;padding-left:0">${d.pronto.map(([t, ok]) => `<li>${ok ? "✅" : "⬜"} ${esc(t)}</li>`).join("")}</ul></div>
      <div class="lista">${Object.entries(n.perStato).map(([s, c]) => `<div class="cli"><div class="top"><span>${esc(s)}</span><b>${c}</b></div></div>`).join("") || '<div class="vuoto">Nessun cliente</div>'}</div>`;
  }
  if (scheda === "clienti"){
    if (!clientiAdm){ h += '<div class="vuoto">Caricamento…</div>'; $("admCorpo").innerHTML = h; call("clienti").then(r => { clientiAdm = r.ok ? r.data.clienti : []; disegna(); }); return; }
    const q = cercaAdm.toUpperCase(), l = clientiAdm.filter(c => !q || `${c.nome} ${c.cf} ${c.univoco} ${c.caf} ${c.ottica}`.toUpperCase().includes(q));
    h += `<label class="lbl" for="admCerca">Cerca per nome, codice fiscale o codice cliente</label><input id="admCerca" value="${esc(cercaAdm)}" autocomplete="off">
      <p class="hint" style="margin:4px 0">${l.length} ${l.length === 1 ? "cliente" : "clienti"}. Eliminare un cliente cancella i suoi dati (anche la ricetta), libera la montatura prenotata e, se ha un abbonamento attivo, lo chiude su Stripe.</p>
      <div class="lista">${l.slice(0, 200).map(c => `<div class="cli"><div class="top"><div><b>${esc(c.nome)}</b><div class="cod">${esc(c.univoco)} · ${esc(c.cf)}</div></div><span class="chip">${esc(c.stato)}</span></div>
        <div>CAF ${esc(c.caf)} · ottica ${esc(c.ottica)}${c.abbonamentoAttivo ? ' · <b>abbonamento attivo</b>' : ""}</div>
        <div class="az"><button type="button" class="grigio" data-elimina="cliente" data-id="${esc(c.univoco)}" data-attivo="${c.abbonamentoAttivo ? 1 : ""}">Elimina cliente</button></div></div>`).join("") || '<div class="vuoto">Nessun cliente</div>'}</div>`;
  }
  if (scheda === "caf"){
    h += `<form data-f="salvaCaf" class="scheda"><b>Nuovo CAF o modifica</b>
      <label class="lbl" for="aCafId">Codice CAF</label><input id="aCafId" name="ID" required style="text-transform:uppercase">
      <label class="lbl" for="aCafNome">Nome</label><input id="aCafNome" name="Nome">
      <label class="lbl" for="aCafPw">Password (almeno 8 caratteri; vuota = non cambiare)</label><input id="aCafPw" name="Password" type="text" autocomplete="off">
      <button type="submit" class="verde full">Salva CAF</button></form>
      <div class="lista">${d.caf.map(c => `<div class="cli"><div class="top"><div><b>${esc(c.ID)}</b> ${esc(c.Nome)}${c.prova ? ' <span class="chip">PROVA</span>' : ""}</div></div>
        <div class="az"><button type="button" class="grigio" data-mod-caf="${esc(c.ID)}">Modifica</button><button type="button" class="grigio" data-elimina="caf" data-id="${esc(c.ID)}">Elimina</button></div></div>`).join("")}</div>`;
  }
  if (scheda === "ottici"){
    h += `<form data-f="salvaOttico" class="scheda"><b>Nuova ottica o modifica</b>
      <label class="lbl" for="aOId">Codice ottica (es. OTT20)</label><input id="aOId" name="ID" required style="text-transform:uppercase">
      <label class="lbl" for="aONome">Nome dell'ottica</label><input id="aONome" name="Intestatario" required>
      <label class="lbl" for="aOInd">Indirizzo</label><input id="aOInd" name="Indirizzo">
      <label class="lbl" for="aOCit">Città</label><input id="aOCit" name="Citta">
      <label class="lbl" for="aOTel">Telefono</label><input id="aOTel" name="Telefono" inputmode="tel">
      <label class="lbl" for="aOList">Convenzione (listino)</label><select id="aOList" name="Listino">${opt("A")}</select>
      <label class="lbl" for="aOPw">Password di accesso (almeno 8; vuota = non cambiare)</label><input id="aOPw" name="Password" type="text" autocomplete="off">
      <button type="submit" class="verde full">Salva ottica</button></form>
      <div class="lista">${d.ottici.map(o => `<div class="cli"><div class="top"><div><b>${esc(o.ID)}</b> ${esc(o.Intestatario)}${o.prova ? ' <span class="chip">PROVA</span>' : ""}</div>${o.accesso ? '<span class="chip s4">ACCESSO ATTIVO</span>' : '<span class="chip s3">SENZA PASSWORD</span>'}</div>
        <div>${esc(o.Indirizzo)}${esc(o.Citta)} · listino ${esc(o.Listino)}${o.Telefono ? " · " + esc(o.Telefono) : ""}</div>
        <div class="az"><button type="button" class="grigio" data-mod-ott="${esc(o.ID)}">Modifica</button><button type="button" class="grigio" data-elimina="ottico" data-id="${esc(o.ID)}">Elimina</button></div></div>`).join("")}</div>`;
  }
  if (scheda === "montature"){
    h += `<form data-f="salvaMontatura" class="scheda"><b>Nuova montatura o modifica</b>
      <label class="lbl" for="aMCod">Codice (sul cartellino, es. SG-2001)</label><input id="aMCod" name="Codice" required style="text-transform:uppercase">
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMMod">Modello</label><input id="aMMod" name="Modello"></div><div style="flex:1"><label class="lbl" for="aMCol">Colore</label><input id="aMCol" name="Colore"></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMCal">Calibro (es. 52-18)</label><input id="aMCal" name="Calibro"></div><div style="flex:1"><label class="lbl" for="aMAs">Asta</label><input id="aMAs" name="Asse"></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMPr">Prezzo (vuoto = da listino)</label><input id="aMPr" name="Prezzo" inputmode="decimal"></div>
        <div style="flex:1"><label class="lbl" for="aMSt">Stato</label><select id="aMSt" name="Stato"><option>DISPONIBILE</option><option>RISERVATA</option><option>NON DISPONIBILE</option></select></div></div>
      <button type="submit" class="verde full">Salva montatura</button></form>
      <button type="button" class="full" data-stampa>Stampa i cartellini QR delle montature disponibili</button>
      <div class="lista">${d.montature.map(m => `<div class="cli"><div class="top"><div><b>${esc(m.Codice)}</b> ${esc(m.Modello)} ${esc(m.Colore)}</div><span class="chip ${m.Stato === "DISPONIBILE" ? "s4" : "s2"}">${esc(m.Stato)}</span></div>
        <div>${esc(m.Calibro)}${m.Asse ? "-" + esc(m.Asse) : ""}${m.Prezzo ? " · " + euro(m.Prezzo) : ""}</div>
        <div class="az"><button type="button" class="grigio" data-mod-mon="${esc(m.Codice)}">Modifica</button><button type="button" class="grigio" data-elimina="montatura" data-id="${esc(m.Codice)}">Elimina</button></div></div>`).join("")}</div>`;
  }
  if (scheda === "impostazioni"){
    const t = d.titolare || {};
    h += `<form data-f="salvaTitolare" class="scheda"><b>Titolare del servizio</b><p style="margin:4px 0">Compare nell'informativa privacy e nelle condizioni dell'abbonamento.</p>
      <label class="lbl" for="tRag">Ragione sociale o nome e cognome</label><input id="tRag" name="ragione" value="${esc(t.ragione)}">
      <label class="lbl" for="tPiva">Partita IVA</label><input id="tPiva" name="piva" inputmode="numeric" value="${esc(t.piva)}">
      <label class="lbl" for="tInd">Sede (indirizzo completo)</label><input id="tInd" name="indirizzo" value="${esc(t.indirizzo)}">
      <label class="lbl" for="tMail">Email per i clienti e per la privacy</label><input id="tMail" name="email" type="email" value="${esc(t.email)}">
      <label class="lbl" for="tPec">PEC (facoltativa)</label><input id="tPec" name="pec" value="${esc(t.pec)}">
      <label class="lbl" for="tTel">Telefono (facoltativo)</label><input id="tTel" name="telefono" value="${esc(t.telefono)}">
      <button type="submit" class="verde full">Salva dati del titolare</button></form>
      <form data-f="cambiaPassword" class="scheda"><b>Cambia la password del pannello</b>
      <label class="lbl" for="aNp">Nuova password (almeno 10 caratteri)</label><input id="aNp" name="nuova" type="password" autocomplete="new-password" required>
      <button type="submit" class="full">Cambia password</button></form>
      <div class="scheda"><b>Verifica legale</b><p style="margin:6px 0">Spunta quando un consulente ha controllato condizioni dell'abbonamento e informativa privacy.</p>
      <label class="gdpr"><input type="checkbox" data-legale ${d.pronto.find(x => /consulente/.test(x[0]))[1] ? "checked" : ""}> Verificate</label></div>
      <div class="scheda"><b>Dati di prova</b><p style="margin:6px 0">Rimuove gli accessi CAF001, OTT07, OTT12, le ottiche e montature di prova libere e i clienti creati con quegli accessi. Da fare prima di aprire il servizio al pubblico.</p>
      <button type="button" class="grigio full" data-prova>${d.prova ? "Rimuovi i dati di prova" : "Dati di prova già rimossi"}</button></div>
      <button type="button" class="grigio full" data-esci>Esci dal pannello</button>`;
  }
  $("admCorpo").innerHTML = h;
  if (ultimo && Date.now() - ultimo.il < 8000){ const u = ultimo; msg(u.t, u.k); ultimo.il = u.il; }
}
function riempi(f, o){ for (const [k, v] of Object.entries(o)) if (f.elements[k]) f.elements[k].value = v ?? ""; f.scrollIntoView({behavior: "smooth", block: "start"}); }
document.addEventListener("change", async e => { if (e.target.matches && e.target.matches("[data-legale]")){ await call("legale", {valore: e.target.checked}); await carica(); msg("Salvato."); } });
async function clic(e){
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab){ scheda = b.dataset.tab; disegna(); return; }
  if (b.dataset.modCaf){ riempi(document.querySelector('[data-f="salvaCaf"]'), dati.caf.find(x => x.ID === b.dataset.modCaf)); return; }
  if (b.dataset.modOtt){ riempi(document.querySelector('[data-f="salvaOttico"]'), dati.ottici.find(x => x.ID === b.dataset.modOtt)); return; }
  if (b.dataset.modMon){ riempi(document.querySelector('[data-f="salvaMontatura"]'), dati.montature.find(x => x.Codice === b.dataset.modMon)); return; }
  if (b.dataset.elimina){
    const tipo = b.dataset.elimina;
    if (!b.dataset.ok){
      b.dataset.ok = "1"; b.className = "verde";
      b.textContent = tipo === "cliente" ? (b.dataset.attivo ? "Chiudo l'abbonamento su Stripe ed elimino? Tocca di nuovo" : "Elimino il cliente e i suoi dati? Tocca di nuovo")
        : tipo === "ottico" ? "Elimino l'ottica? Tocca di nuovo" : tipo === "caf" ? "Elimino il CAF? I suoi clienti restano. Tocca di nuovo" : "Confermi? Tocca di nuovo";
      return;
    }
    const extra = {tipo, id: b.dataset.id};
    if (tipo === "cliente" && b.dataset.attivo) extra.chiudiAbbonamento = true;
    if (b.dataset.solo) extra.soloAccesso = true;
    const r = await call("elimina", extra);
    if (!r.ok){
      if (r.data.soloAccesso){ b.dataset.solo = "1"; b.textContent = "Togli solo l'accesso dell'ottica"; return msg(r.data.errore, "err"); }
      return msg(r.data.errore, "err");
    }
    if (tipo === "cliente") clientiAdm = null;
    await carica();
    msg(tipo === "cliente" ? `Cliente eliminato${r.data.abbonamentoChiuso ? " e abbonamento chiuso su Stripe" : ""}.` : r.data.soloAccesso ? "Accesso dell'ottica tolto: i suoi clienti restano visibili." : r.data.clientiRestano ? `Eliminato. I suoi ${r.data.clientiRestano} clienti restano nell'archivio.` : "Eliminato.");
    return;
  }
  if (b.hasAttribute("data-prova")){
    if (!dati.prova) return;
    if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi la rimozione? Tocca di nuovo"; b.className = "verde full"; return; }
    const r = await call("rimuoviProva"); if (!r.ok) return msg(r.data.errore, "err");
    await carica(); msg(`Dati di prova rimossi (${r.data.clientiRimossi} clienti di prova).`); return;
  }
  if (b.hasAttribute("data-esci")){ tok = ""; sessionStorage.removeItem("sg_admin"); $("adminPopup").hidden = true; return; }
  if (b.hasAttribute("data-stampa")) stampa();
}
document.addEventListener("input", e => { if (e.target.id === "admCerca"){ cercaAdm = e.target.value; const pos = e.target.selectionStart; disegna(); const n = $("admCerca"); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch(_){} } } });
async function invio(e){
  e.preventDefault(); const f = e.target, k = f.dataset.f, v = Object.fromEntries(new FormData(f));
  if (k === "imposta" || k === "accedi"){
    const pw = $("admPw").value;
    if (k === "imposta" && pw !== $("admPw2").value) return msg("Le due password non coincidono.", "err");
    const r = await call(k, {password: pw}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    tok = r.data.token; sessionStorage.setItem("sg_admin", tok); await carica(); return;
  }
  const r = await call(k, v); if (!r.ok) return msg(r.data.errore || "Errore", "err");
  await carica(); msg(k === "cambiaPassword" ? "Password cambiata." : "Salvato.");
}
// cartellini da stampare: QR con il codice della montatura, da attaccare sull'espositore
function stampa(){
  const m = dati.montature.filter(x => x.Stato === "DISPONIBILE");
  const w = open("", "_blank"); if (!w) return msg("Il browser ha bloccato la finestra di stampa: consenti i popup.", "err");
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Cartellini QR SocialGlass</title>
    <style>body{font-family:Arial,sans-serif;margin:10mm}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}.c{border:1px dashed #999;padding:4mm;text-align:center;break-inside:avoid}
    .c b{display:block;font-size:13pt;margin-top:2mm}.c small{color:#444}.q{display:flex;justify-content:center}</style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script></head><body>
    <div class="g">${m.map((x, i) => `<div class="c"><div class="q" id="q${i}"></div><b>${esc(x.Codice)}</b><small>${esc(x.Modello)} ${esc(x.Colore)} ${esc(x.Calibro)}</small></div>`).join("")}</div>
    <script>window.onload=function(){${JSON.stringify(m.map(x => x.Codice))}.forEach(function(c,i){new QRCode(document.getElementById("q"+i),{text:c,width:110,height:110});});setTimeout(function(){print()},500)}<\/script></body></html>`);
  w.document.close();
}
window.SG_ADMIN = {apri};
})();
