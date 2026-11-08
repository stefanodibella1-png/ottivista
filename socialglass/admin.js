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
let clientiAdm = null, schedaCli = null, filtriAdm = {q: "", caf: "", ottica: "", stato: "", sit: ""};
const SIT = {
  morosi: ["Morosi", c => c.moroso], bloccati: ["Anagrafica bloccata", c => c.bloccato], attivi: ["Abbonamento attivo", c => c.abbonamentoAttivo],
  scadenza: ["In scadenza (30 giorni)", c => c.inScadenza], chiusi: ["Abbonamento chiuso", c => c.chiuso]
};
const dt = d => d ? new Date(d).toLocaleDateString("it-IT") : "—";
const riga = (k, v) => v === "" || v == null ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
function ricettaHtml(r){
  if (!r) return "";
  const n = v => v == null ? "" : (v > 0 ? "+" : "") + String(v).replace(".", ",");
  return `<table class="rx"><tr><th></th><th>Sfero</th><th>Cilindro</th><th>Asse</th><th>Add.</th></tr>${["OD", "OS"].map(e => `<tr><th>${e}</th><td>${n(r[e] && r[e].sf)}</td><td>${n(r[e] && r[e].cil)}</td><td>${r[e] && r[e].ax != null ? r[e].ax + "°" : ""}</td><td>${n(r[e] && r[e].add)}</td></tr>`).join("")}</table>
    ${r.pd ? `<div>Distanza pupillare: <b>${esc(r.pd)} mm</b></div>` : ""}${r.note ? `<div>Note: ${esc(r.note)}</div>` : ""}`;
}
// accordo economico con il CAF o l'ottica e riepilogo dei conti
function campiCompenso(pfx){
  return `<fieldset style="border:1px solid #e3e6ea;border-radius:8px;padding:6px 10px;margin:8px 0"><legend style="font-size:13px;color:#555;padding:0 4px">Accordo economico con SocialGlass</legend>
    <label class="lbl" for="${pfx}CT">Compenso</label><select id="${pfx}CT" name="CompensoTipo"><option value="">Non ancora definito</option><option value="fisso">€ per ogni abbonamento attivato</option><option value="percentuale">% sui canoni incassati</option></select>
    <div class="riga"><div style="flex:1"><label class="lbl" for="${pfx}CV">Valore (€ o %)</label><input id="${pfx}CV" name="CompensoValore" inputmode="decimal"></div>
    <div style="flex:1"><label class="lbl" for="${pfx}CL">Già liquidato (€)</label><input id="${pfx}CL" name="CompensoLiquidato" inputmode="decimal"></div></div></fieldset>`;
}
function contiHtml(k){
  if (!k) return "";
  const acc = k.accordo ? (k.accordo.tipo === "fisso" ? `${euro(k.accordo.valore)} per abbonamento attivato` : `${String(k.accordo.valore).replace(".", ",")}% sui canoni incassati`) : "accordo non ancora definito";
  return `<div class="conti"><div>Clienti<b>${k.clienti}</b></div><div>Abbonamenti attivati<b>${k.attivati}</b></div><div>Attivi ora<b>${k.attivi}</b></div><div>Canoni incassati<b>${euro(k.incassati)}</b></div>
    <div>Compenso maturato<b>${euro(k.maturato)}</b></div><div>Già liquidato<b>${euro(k.liquidato)}</b></div><div>Da liquidare<b>${euro(k.saldo)}</b></div></div><div class="hint" style="font-size:12.5px">Accordo: ${acc}.</div>`;
}
function disegnaScheda(c){
  const o = c.ordine || {}, pg = o.pagamento || {}, pr = o.prezzi || {}, m = o.montatura, p = c.periodo, si = c.situazione, b = si.blocco;
  const ins = pg.insoluto;
  return `<button type="button" class="linkbtn" data-chiudi-scheda style="margin:0 0 6px">← Torna all'elenco</button>
    <div class="scheda"><div class="top" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:17px">${esc(c.nome)} ${esc(c.cognome)}</b><span class="chip">${esc(c.stato)}</span></div>
    ${si.bloccato ? '<span class="chip s3">ANAGRAFICA BLOCCATA</span> ' : ""}${si.moroso ? '<span class="chip s3">MOROSO</span>' : ""}
    <dl class="dl">${riga("Codice cliente", esc(c.univoco))}${riga("Codice fiscale", esc(c.cf))}${riga("Cellulare", esc(c.cellulare))}${riga("Nato a", esc(c.natoA))}${riga("Data di nascita", c.dataNascita ? dt(c.dataNascita) : "")}${riga("Registrato il", dt(c.creato))}
      ${riga("CAF", esc(c.caf))}${riga("Ottica", esc(c.ottica))}${riga("Listino", esc(c.listino))}</dl>
    <a class="btn-link" target="_blank" rel="noopener" href="${esc(c.link)}" style="display:inline-block">Apri la pagina del cliente</a></div>

    <div class="scheda"><b>Anagrafica: blocco</b>
      ${si.motivi.length ? `<ul style="margin:4px 0;padding-left:18px">${si.motivi.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : '<p style="margin:4px 0">Nessuna morosità e nessun blocco.</p>'}
      <p class="hint" style="margin:4px 0">${si.bloccato ? "CAF e ottico vedono solo «anagrafica bloccata, contatta SocialGlass»: non possono rinnovare, inserire un preventivo o consegnare." : "CAF e ottico possono operare normalmente."}${b ? ` Ultima decisione: ${b.stato === "bloccato" ? "bloccata" : "sbloccata"} il ${dt(b.il)}.` : si.moroso ? " Il blocco è automatico per morosità: si toglie da solo quando il cliente paga." : ""}</p>
      <form data-f="blocco" data-id="${esc(c.univoco)}"><label class="lbl" for="admMot">Motivo (resta visibile solo a te)</label><input id="admMot" name="motivo" maxlength="300" value="">
      <div class="riga">${si.bloccato ? `<button type="submit" class="verde" name="stato" value="sbloccato">Sblocca l'anagrafica</button>` : `<button type="submit" class="grigio" name="stato" value="bloccato">Blocca l'anagrafica</button>`}
      ${b ? `<button type="submit" class="grigio" name="stato" value="auto">Torna al controllo automatico</button>` : ""}</div></form></div>

    <div class="scheda"><b>Occhiale</b><dl class="dl">
      ${riga("Montatura", m ? esc(`${m.modello} ${m.colore}`) : "non ancora scelta")}${m ? riga("Codice e calibro", esc(`${m.codice} · ${m.calibro || ""}${m.asse ? "-" + m.asse : ""}`)) : ""}
      ${riga("Lenti", o.lenti ? esc(o.lenti.nome) : "")}${riga("Trattamenti", (o.trattamenti || []).map(t => esc(t.nome)).join(", "))}
      ${riga("Pronto il", o.prontoIl ? dt(o.prontoIl) : "")}${riga("Consegnato il", o.consegnatoIl ? dt(o.consegnatoIl) : "")}
      ${o.ritiro && o.ritiro.daRitirare ? riga("Da restituire", o.ritiro.ritirato ? "restituito il " + dt(o.ritiro.ritirato) : "sì, dal " + dt(o.ritiro.dal)) : ""}</dl>
      ${o.ricetta ? "<b>Ricetta</b>" + ricettaHtml(o.ricetta) : ""}</div>

    <div class="scheda"><b>Abbonamento e pagamenti</b><dl class="dl">
      ${riga("Valore occhiale", pr.totale ? euro(pr.totale) : "")}${riga("Canone", pr.rata ? euro(pr.rata) + "/mese" : "")}${riga("Riscatto", pr.riscatto ? euro(pr.riscatto) : "")}
      ${riga("Attivato il", pg.attivatoIl ? dt(pg.attivatoIl) : "")}${riga("Canoni pagati", pg.attivatoIl ? String(pg.ratePagate || 0) + (pg.mesiPrecedenti ? ` (+${pg.mesiPrecedenti} del periodo precedente)` : "") : "")}
      ${riga("Ultimo pagamento", pg.ultimaRata ? dt(pg.ultimaRata) : "")}${riga("Scadenza durata minima", p ? dt(p.scadenza) + (p.scaduto && !p.chiuso ? " · ora mese per mese" : "") : "")}
      ${riga("Non pagato", ins ? `${euro(ins.importo)} dal ${dt(ins.dal)} · ${ins.tentativi || 1} tentativi` : "")}
      ${riga("Scelta di fine periodo", o.finePeriodo ? esc(o.finePeriodo.descrizione) : "")}${riga("Chiuso il", pg.chiuso ? dt(pg.chiuso) : "")}${riga("Esito", esc(pg.esito || ""))}
      ${riga("Rinnovo", o.rinnovo ? `avviato il ${dt(o.rinnovo.il)} (${esc(o.rinnovo.da)})` : "")}${riga("Abbonamento Stripe", esc(pg.abbonamento || ""))}</dl>
      ${(o.storico || []).length ? `<p class="hint" style="margin:4px 0">${o.storico.length} ${o.storico.length === 1 ? "periodo precedente" : "periodi precedenti"} in archivio.</p>` : ""}</div>

    <div class="az" style="margin-top:6px"><button type="button" class="grigio" data-elimina="cliente" data-id="${esc(c.univoco)}" data-attivo="${pg.abbonamento && !pg.chiuso ? 1 : ""}">Elimina cliente</button></div>`;
}
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
    if (schedaCli){ h += disegnaScheda(schedaCli); $("admCorpo").innerHTML = h; return; }
    const F = filtriAdm, q = F.q.toUpperCase();
    const l = clientiAdm.filter(c => (!q || `${c.nome} ${c.cf} ${c.univoco}`.toUpperCase().includes(q)) && (!F.caf || c.caf === F.caf) && (!F.ottica || c.ottica === F.ottica)
      && (!F.stato || c.stato === F.stato) && (!F.sit || SIT[F.sit][1](c)));
    const uniq = k => [...new Set(clientiAdm.map(c => c[k]).filter(Boolean))].sort();
    const sel = (k, tutti, vals) => `<select data-filtro="${k}" aria-label="${tutti}"><option value="">${tutti}</option>${vals.map(([v, t]) => `<option value="${esc(v)}" ${F[k] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    h += `<div class="filtri"><input id="admCerca" value="${esc(F.q)}" autocomplete="off" placeholder="Nome, codice fiscale o codice" aria-label="Cerca cliente">
      ${sel("caf", "Tutti i CAF", uniq("caf").map(v => [v, v]))}${sel("ottica", "Tutte le ottiche", uniq("ottica").map(v => [v, v]))}
      ${sel("stato", "Tutti gli stati", uniq("stato").map(v => [v, v]))}${sel("sit", "Ogni situazione", Object.entries(SIT).map(([k, v]) => [k, v[0]]))}</div>
      <p class="hint" style="margin:2px 0 4px">${l.length} di ${clientiAdm.length} clienti · tocca un cliente per aprire la scheda</p>
      <div class="lista">${l.slice(0, 300).map(c => `<button type="button" class="riga-cli" data-scheda="${esc(c.univoco)}"><span><span class="nome">${esc(c.nome)}</span><span class="cod">${esc(c.univoco)} · ${esc(c.caf)} · ${esc(c.ottica)}</span></span>
        <span class="bad">${c.bloccato ? '<span class="chip s3">BLOCCATO</span>' : ""}${c.moroso ? '<span class="chip s3">MOROSO</span>' : ""}${c.inScadenza ? '<span class="chip s2">IN SCADENZA</span>' : ""}<span class="chip">${esc(c.stato)}</span></span></button>`).join("") || '<div class="vuoto">Nessun cliente con questi filtri</div>'}</div>`;
  }
  if (scheda === "caf"){
    h += `<form data-f="salvaCaf" class="scheda"><b>Nuovo CAF o modifica</b>
      <label class="lbl" for="aCafId">Codice CAF</label><input id="aCafId" name="ID" required style="text-transform:uppercase">
      <label class="lbl" for="aCafNome">Nome</label><input id="aCafNome" name="Nome">
      <label class="lbl" for="aCafPw">Password (almeno 8 caratteri; vuota = non cambiare)</label><input id="aCafPw" name="Password" type="text" autocomplete="off">
      ${campiCompenso("aCaf")}
      <button type="submit" class="verde full">Salva CAF</button></form>
      <div class="lista">${d.caf.map(c => `<div class="cli"><div class="top"><div><b>${esc(c.ID)}</b> ${esc(c.Nome)}${c.prova ? ' <span class="chip">PROVA</span>' : ""}</div></div>${contiHtml(c.conti)}
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
      ${campiCompenso("aO")}
      <button type="submit" class="verde full">Salva ottica</button></form>
      <div class="lista">${d.ottici.map(o => `<div class="cli"><div class="top"><div><b>${esc(o.ID)}</b> ${esc(o.Intestatario)}${o.prova ? ' <span class="chip">PROVA</span>' : ""}</div>${o.accesso ? '<span class="chip s4">ACCESSO ATTIVO</span>' : '<span class="chip s3">SENZA PASSWORD</span>'}</div>
        <div>${esc(o.Indirizzo)}${esc(o.Citta)} · listino ${esc(o.Listino)}${o.Telefono ? " · " + esc(o.Telefono) : ""}</div>${contiHtml(o.conti)}
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
  if (b.dataset.tab){ scheda = b.dataset.tab; schedaCli = null; if (scheda === "clienti") clientiAdm = null; disegna(); return; }
  if (b.dataset.scheda){ const r = await call("scheda", {id: b.dataset.scheda}); if (!r.ok) return msg(r.data.errore || "Errore", "err"); schedaCli = r.data.cliente; disegna(); $("admCorpo").scrollTop = 0; b.blur(); const t = $("admTit"); if (t) t.scrollIntoView({block: "start"}); return; }
  if (b.hasAttribute("data-chiudi-scheda")){ schedaCli = null; disegna(); return; }
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
    if (tipo === "cliente"){ clientiAdm = null; schedaCli = null; }
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
document.addEventListener("change", e => { const k = e.target.dataset && e.target.dataset.filtro; if (k && $("adminPopup") && $("adminPopup").contains(e.target)){ filtriAdm[k] = e.target.value; disegna(); } });
document.addEventListener("input", e => { if (e.target.id === "admCerca"){ filtriAdm.q = e.target.value; const pos = e.target.selectionStart; disegna(); const n = $("admCerca"); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch(_){} } } });
async function invio(e){
  e.preventDefault(); const f = e.target, k = f.dataset.f, v = Object.fromEntries(new FormData(f));
  if (k === "imposta" || k === "accedi"){
    const pw = $("admPw").value;
    if (k === "imposta" && pw !== $("admPw2").value) return msg("Le due password non coincidono.", "err");
    const r = await call(k, {password: pw}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    tok = r.data.token; sessionStorage.setItem("sg_admin", tok); await carica(); return;
  }
  if (k === "blocco"){
    const st = e.submitter ? e.submitter.value : ""; const r = await call("blocco", {id: f.dataset.id, stato: st, motivo: v.motivo});
    if (!r.ok) return msg(r.data.errore || "Errore", "err");
    const x = await call("scheda", {id: f.dataset.id}); if (x.ok) schedaCli = x.data.cliente; clientiAdm = clientiAdm && (await call("clienti")).data.clienti; disegna();
    return msg(st === "bloccato" ? "Anagrafica bloccata." : st === "sbloccato" ? "Anagrafica sbloccata." : "Torna al controllo automatico della morosità.");
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
