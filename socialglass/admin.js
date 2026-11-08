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
const TAB = [["numeri", "Numeri"], ["clienti", "Clienti"], ["caf", "CAF"], ["ottici", "Ottici"], ["magazzino", "Magazzino"], ["fornitori", "Fornitori"], ["impostazioni", "Impostazioni"]];
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
  return `<div class="riga" style="justify-content:space-between;align-items:center"><button type="button" class="linkbtn" data-chiudi-scheda style="margin:0">← Torna all'elenco</button><button type="button" data-stampa-scheda="cliente" style="margin:0">Stampa scheda</button></div>
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
    if (n.sottoScorta) h += `<div class="esito err" style="display:block">Magazzino: <b>${n.sottoScorta}</b> ${n.sottoScorta === 1 ? "montatura sotto scorta o esaurita" : "montature sotto scorta o esaurite"}. <button type="button" class="linkbtn" data-tab="magazzino">Apri il magazzino</button></div>`;
    h += `<div class="scheda"><div class="date"><span>Clienti <b>${n.clienti}</b></span><span>Abbonamenti attivi <b>${n.abbonamentiAttivi}</b></span><span>Canoni al mese <b>${euro(n.canoniMensili)}</b></span></div></div>
      <div class="scheda"><b>Pronto per il pubblico?</b><ul class="regole" style="list-style:none;padding-left:0">${d.pronto.map(([t, ok]) => `<li>${ok ? "✅" : "⬜"} ${esc(t)}</li>`).join("")}</ul></div>
      <div class="lista">${Object.entries(n.perStato).map(([s, c]) => `<div class="cli"><div class="top"><span>${esc(s)}</span><b>${c}</b></div></div>`).join("") || '<div class="vuoto">Nessun cliente</div>'}</div>`;
  }
  if (scheda === "clienti"){
    if (!clientiAdm){ h += '<div class="vuoto">Caricamento…</div>'; $("admCorpo").innerHTML = h; call("clienti").then(r => { clientiAdm = r.ok ? r.data.clienti : []; disegna(); }); return; }
    if (schedaCli){ h += disegnaScheda(schedaCli); $("admCorpo").innerHTML = h; return; }
    const F = filtriAdm, q = F.q.toUpperCase();
    const l = clientiVisti = clientiAdm.filter(c => (!q || `${c.nome} ${c.cf} ${c.univoco}`.toUpperCase().includes(q)) && (!F.caf || c.caf === F.caf) && (!F.ottica || c.ottica === F.ottica)
      && (!F.stato || c.stato === F.stato) && (!F.sit || SIT[F.sit][1](c)));
    const uniq = k => [...new Set(clientiAdm.map(c => c[k]).filter(Boolean))].sort();
    const sel = (k, tutti, vals) => `<select data-filtro="${k}" aria-label="${tutti}"><option value="">${tutti}</option>${vals.map(([v, t]) => `<option value="${esc(v)}" ${F[k] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
    h += `<div class="filtri"><input id="admCerca" value="${esc(F.q)}" autocomplete="off" placeholder="Nome, codice fiscale o codice" aria-label="Cerca cliente">
      ${sel("caf", "Tutti i CAF", uniq("caf").map(v => [v, v]))}${sel("ottica", "Tutte le ottiche", uniq("ottica").map(v => [v, v]))}
      ${sel("stato", "Tutti gli stati", uniq("stato").map(v => [v, v]))}${sel("sit", "Ogni situazione", Object.entries(SIT).map(([k, v]) => [k, v[0]]))}</div>
      <p class="hint" style="margin:2px 0 4px">${l.length} di ${clientiAdm.length} clienti · tocca un cliente per aprire la scheda · <button type="button" class="linkbtn" data-stampa-cli-elenco>Stampa elenco</button></p>
      <div class="lista">${l.slice(0, 300).map(c => `<button type="button" class="riga-cli" data-scheda="${esc(c.univoco)}"><span><span class="nome">${esc(c.nome)}</span><span class="cod">${esc(c.univoco)} · ${esc(c.caf)} · ${esc(c.ottica)}</span></span>
        <span class="bad">${c.bloccato ? '<span class="chip s3">BLOCCATO</span>' : ""}${c.moroso ? '<span class="chip s3">MOROSO</span>' : ""}${c.inScadenza ? '<span class="chip s2">IN SCADENZA</span>' : ""}<span class="chip">${esc(c.stato)}</span></span></button>`).join("") || '<div class="vuoto">Nessun cliente con questi filtri</div>'}</div>`;
  }
  if (scheda === "caf"){
    h += `<button type="button" data-stampa-conti="caf" style="margin:0 0 6px">Stampa conteggi dei CAF</button>`;
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
    h += `<button type="button" data-stampa-conti="ottici" style="margin:0 0 6px">Stampa conteggi ed esposizione delle ottiche</button>`;
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
        <div>${esc(o.Indirizzo)}${esc(o.Citta)} · listino ${esc(o.Listino)}${o.Telefono ? " · " + esc(o.Telefono) : ""}</div>
        <div>Montature esposte: <b>${d.montature.filter(m => !m.archiviata).reduce((t, m) => t + (m.giacenze[o.ID] || 0), 0)}</b> pezzi · <button type="button" class="linkbtn" data-esposte="${esc(o.ID)}">vedi</button></div>${contiHtml(o.conti)}
        <div class="az"><button type="button" class="grigio" data-mod-ott="${esc(o.ID)}">Modifica</button><button type="button" class="grigio" data-elimina="ottico" data-id="${esc(o.ID)}">Elimina</button></div></div>`).join("")}</div>`;
  }
  if (scheda === "magazzino") h += vistaMagazzino();
  if (scheda === "fornitori") h += vistaFornitori();
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
function inCima(){ const t = $("admTit"); if (t) t.scrollIntoView({block: "start"}); }
function riempi(f, o){ for (const [k, v] of Object.entries(o)) if (f.elements[k]) f.elements[k].value = v ?? ""; f.scrollIntoView({behavior: "smooth", block: "start"}); }
document.addEventListener("change", async e => { if (e.target.matches && e.target.matches("[data-legale]")){ await call("legale", {valore: e.target.checked}); await carica(); msg("Salvato."); } });
async function clic(e){
  const inv = e.target.closest("[data-invia-ord]");
  // email o WhatsApp aperti: l'ordine si segna come inviato
  if (inv){ setTimeout(async () => { const r = await call("ordineFornitore", {op: "invia", id: inv.dataset.inviaOrd}); if (r.ok){ await carica(); msg("Ordine segnato come inviato. Se non l'hai spedito davvero, annullalo e ricrealo."); } }, 400); return; }
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab){ scheda = b.dataset.tab; schedaCli = null; if (scheda === "clienti") clientiAdm = null; disegna(); return; }
  if (b.dataset.scheda){ const r = await call("scheda", {id: b.dataset.scheda}); if (!r.ok) return msg(r.data.errore || "Errore", "err"); schedaCli = r.data.cliente; disegna(); $("admCorpo").scrollTop = 0; b.blur(); const t = $("admTit"); if (t) t.scrollIntoView({block: "start"}); return; }
  if (b.hasAttribute("data-chiudi-scheda")){ schedaCli = null; disegna(); return; }
  if (b.dataset.modCaf){ riempi(document.querySelector('[data-f="salvaCaf"]'), dati.caf.find(x => x.ID === b.dataset.modCaf)); return; }
  if (b.dataset.modOtt){ riempi(document.querySelector('[data-f="salvaOttico"]'), dati.ottici.find(x => x.ID === b.dataset.modOtt)); return; }
  if (b.dataset.art || b.dataset.artDaForn){ artAperto = b.dataset.art || b.dataset.artDaForn; if (b.dataset.artDaForn) scheda = "magazzino"; disegna(); inCima(); return; }
  if (b.hasAttribute("data-art-nuovo")){ artAperto = "nuovo"; disegna(); inCima(); return; }
  if (b.hasAttribute("data-chiudi-art")){ artAperto = null; disegna(); return; }
  if (b.hasAttribute("data-stampa-mag")) return stampaMagazzino();
  if (b.dataset.stampaOrd) return stampaOrdine(b.dataset.stampaOrd);
  if (b.dataset.stampaConti) return stampaConti(b.dataset.stampaConti);
  if (b.hasAttribute("data-stampa-cli-elenco")) return stampaElencoAdm();
  if (b.dataset.stampaScheda){ const blocchi = [...$("admCorpo").querySelectorAll(".scheda")].filter(x => !x.matches("form")).map(x => `<div class="scheda">${ST().pulisciStampa(x)}</div>`).join("");
    return ST().stampaDoc(b.dataset.stampaScheda === "cliente" ? `Scheda cliente ${schedaCli.nome} ${schedaCli.cognome}` : `Scheda montatura ${artAperto}`, blocchi); }
  if (b.hasAttribute("data-stampa-forn")){ const f = dati.fornitori.find(x => x.ID === fornAperto), blocchi = [...$("admCorpo").querySelectorAll(".scheda")].filter(x => !x.matches("form")).map(x => `<div class="scheda">${ST().pulisciStampa(x)}</div>`).join("");
    return ST().stampaDoc(`Fornitore ${f.Nome}`, blocchi); }
  if (b.dataset.esposte){ scheda = "magazzino"; artAperto = null; magF = {q: "", forn: "", dove: b.dataset.esposte, stato: "attive"}; disegna(); return; }
  if (b.dataset.forn){ fornAperto = b.dataset.forn; disegna(); inCima(); return; }
  if (b.hasAttribute("data-forn-nuovo")){ fornAperto = "nuovo"; disegna(); inCima(); return; }
  if (b.hasAttribute("data-chiudi-forn")){ fornAperto = null; disegna(); return; }
  if (b.dataset.qr){ const m = dati.montature.find(x => x.Codice === b.dataset.qr); stampa([Object.assign({}, m, {copie: Number(($("qrCopie") || {}).value) || 1})]); return; }
  if (b.hasAttribute("data-qr-sel")){ stampa(dati.montature.filter(m => magSel.has(m.Codice)).map(m => Object.assign({}, m, {copie: Math.max(1, m.tot)}))); return; }
  if (b.hasAttribute("data-sel-tutti")){ const vis = [...document.querySelectorAll("[data-selart]")].map(x => x.dataset.selart); const tutti = vis.length && vis.every(c => magSel.has(c)); vis.forEach(c => tutti ? magSel.delete(c) : magSel.add(c)); disegna(); return; }
  if (b.dataset.ripristina){ const r = await call("elimina", {tipo: "montatura", id: b.dataset.ripristina, ripristina: true}); if (!r.ok) return msg(r.data.errore, "err"); await carica(); msg("Montatura ripristinata."); return; }
  if (b.dataset.ordOp){
    if (b.dataset.ordOp === "annulla" && !b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi l'annullamento? Tocca di nuovo"; return; }
    const r = await call("ordineFornitore", {op: b.dataset.ordOp, id: b.dataset.id}); if (!r.ok) return msg(r.data.errore, "err");
    await carica(); msg(b.dataset.ordOp === "invia" ? "Ordine segnato come inviato." : "Ordine annullato."); return;
  }
  if (b.dataset.elimina){
    const tipo = b.dataset.elimina;
    if (!b.dataset.ok){
      b.dataset.ok = "1"; b.className = "verde";
      b.textContent = tipo === "cliente" ? (b.dataset.attivo ? "Chiudo l'abbonamento su Stripe ed elimino? Tocca di nuovo" : "Elimino il cliente e i suoi dati? Tocca di nuovo")
        : tipo === "ottico" ? "Elimino l'ottica? Tocca di nuovo" : tipo === "caf" ? "Elimino il CAF? I suoi clienti restano. Tocca di nuovo"
        : tipo === "montatura" ? "Archivio la montatura? Le schede clienti restano. Tocca di nuovo" : tipo === "fornitore" ? "Elimino il fornitore? Le montature restano. Tocca di nuovo" : "Confermi? Tocca di nuovo";
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
    if (tipo === "montatura") artAperto = null; if (tipo === "fornitore") fornAperto = null;
    await carica();
    if (tipo === "montatura") return msg(`Montatura archiviata${r.data.prenotate ? `: ${r.data.prenotate} ${r.data.prenotate === 1 ? "cliente l'aveva" : "clienti l'avevano"} già prenotata, i loro ordini proseguono normalmente` : ""}. La trovi in «Archiviate».`);
    if (tipo === "fornitore") return msg(`Fornitore eliminato${r.data.articoli ? `: ${r.data.articoli} montature restano in magazzino senza fornitore` : ""}.`);
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
}
document.addEventListener("change", e => {
  const t = e.target; if (!t.dataset || !$("adminPopup") || !$("adminPopup").contains(t)) return;
  if (t.dataset.magf){ magF[t.dataset.magf] = t.value; disegna(); }
  if (t.dataset.selart){ t.checked ? magSel.add(t.dataset.selart) : magSel.delete(t.dataset.selart); const q = document.querySelector("[data-qr-sel]"); if (q){ q.disabled = !magSel.size; q.textContent = `Stampa QR selezionati (${magSel.size})`; } }
});
document.addEventListener("change", e => { const k = e.target.dataset && e.target.dataset.filtro; if (k && $("adminPopup") && $("adminPopup").contains(e.target)){ filtriAdm[k] = e.target.value; disegna(); } });
document.addEventListener("input", e => { if (e.target.id === "magCerca"){ magF.q = e.target.value; const pos = e.target.selectionStart; disegna(); const n = $("magCerca"); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch(_){} } return; }
  if (e.target.id === "admCerca"){ filtriAdm.q = e.target.value; const pos = e.target.selectionStart; disegna(); const n = $("admCerca"); if (n){ n.focus(); try { n.setSelectionRange(pos, pos); } catch(_){} } } });
async function invio(e){
  e.preventDefault(); const f = e.target, k = f.dataset.f, v = Object.fromEntries(new FormData(f));
  if (k === "imposta" || k === "accedi"){
    const pw = $("admPw").value;
    if (k === "imposta" && pw !== $("admPw2").value) return msg("Le due password non coincidono.", "err");
    const r = await call(k, {password: pw}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    tok = r.data.token; sessionStorage.setItem("sg_admin", tok); await carica(); return;
  }
  if (k === "creaOrdine"){
    const fo = dati.fornitori.find(x => x.ID === f.dataset.forn), righe = fo.proposta.map(p => Object.assign({}, p, {qta: Number(v["q_" + p.codice]) || 0})).filter(p => p.qta > 0);
    const r = await call("ordineFornitore", {op: "crea", fornitore: fo.ID, righe}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    await carica(); return msg(`Bozza ${r.data.id} creata: controllala e inviala al fornitore.`);
  }
  if (k === "riceviOrdine"){
    const r = await call("ordineFornitore", {op: "ricevi", id: f.dataset.id, dove: v.dove}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    await carica(); return msg(`Merce caricata in ${v.dove === "MAG" ? "magazzino" : v.dove}${r.data.mancanti.length ? `. Articoli non trovati (archiviati o eliminati): ${r.data.mancanti.join(", ")}` : ""}.`);
  }
  if (k === "salvaFornitore" && fornAperto === "nuovo"){
    const r = await call(k, v); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    fornAperto = String(v.ID).trim().toUpperCase(); await carica(); return msg("Fornitore creato. Ora collega le montature scegliendolo nella loro scheda.");
  }
  if (k === "salvaMontatura" && v.nuova){
    const r = await call(k, v); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    artAperto = String(v.Codice).trim().toUpperCase(); await carica(); return msg("Montatura creata.");
  }
  if (k === "blocco"){
    const st = e.submitter ? e.submitter.value : ""; const r = await call("blocco", {id: f.dataset.id, stato: st, motivo: v.motivo});
    if (!r.ok) return msg(r.data.errore || "Errore", "err");
    const x = await call("scheda", {id: f.dataset.id}); if (x.ok) schedaCli = x.data.cliente; clientiAdm = clientiAdm && (await call("clienti")).data.clienti; disegna();
    return msg(st === "bloccato" ? "Anagrafica bloccata." : st === "sbloccato" ? "Anagrafica sbloccata." : "Torna al controllo automatico della morosità.");
  }
  const r = await call(k, v); if (!r.ok) return msg(r.data.errore || "Errore", "err");
  await carica(); msg(k === "cambiaPassword" ? "Password cambiata." : k === "magazzino" ? "Movimento registrato." : "Salvato.");
}
/* ---------- magazzino montature e fornitori ---------- */
let magVisti = [], clientiVisti = [];
const ST = () => window.SG_STAMPA;
const n2 = v => Number(v || 0).toLocaleString("it-IT", {maximumFractionDigits: 2});
function stampaMagazzino(){
  const l = magVisti, filtri = [magF.q, magF.forn ? nomeForn(magF.forn) : "", magF.dove ? (magF.dove === "MAG" ? "in magazzino" : "esposte da " + nomeSede(magF.dove)) : "", MAG_STATI[magF.stato][0]].filter(Boolean).join(" · ");
  const tot = l.reduce((s, m) => s + m.tot, 0), pren = l.reduce((s, m) => s + m.riservate.length, 0), val = l.reduce((s, m) => s + (m.tot + m.riservate.length) * (Number(m.Costo) || 0), 0);
  ST().stampaDoc("Report di magazzino", `<p class="hint">Filtri: ${esc(filtri)}</p>
    <div class="conti"><div>Articoli<b>${l.length}</b></div><div>Pezzi disponibili<b>${tot}</b></div><div>Pezzi prenotati<b>${pren}</b></div><div>Valore a costo<b>${euro(val)}</b></div></div>
    <table><tr><th>Codice</th><th>Articolo</th><th>Fornitore</th><th>Dove</th><th class="n">Disp.</th><th class="n">Pren.</th><th class="n">Min.</th><th class="n">Costo</th><th class="n">Valore</th><th>Note</th></tr>
    ${l.map(m => `<tr><td>${esc(m.Codice)}</td><td>${esc(m.Modello)} ${esc(m.Colore)}<br><small>${esc(m.Calibro)}${m.Asse ? "-" + esc(m.Asse) : ""}</small></td><td>${esc(nomeForn(m.Fornitore))}${m.CodiceFornitore ? "<br><small>" + esc(m.CodiceFornitore) + "</small>" : ""}</td>
      <td>${Object.entries(m.giacenze).map(([k, n]) => `${esc(k === "MAG" ? "Magazzino" : k)}: ${n}`).join("<br>") || "—"}</td><td class="n">${m.tot}</td><td class="n">${m.riservate.length}</td><td class="n">${m.ScortaMinima || ""}</td>
      <td class="n">${m.Costo ? euro(m.Costo) : ""}</td><td class="n">${m.Costo ? euro((m.tot + m.riservate.length) * m.Costo) : ""}</td><td>${m.archiviata ? "ARCHIVIATA" : m.esaurita ? "ESAURITA" : m.sottoScorta ? "SOTTO SCORTA" : ""}</td></tr>`).join("")}</table>`);
}
function stampaOrdine(id){
  const o = dati.ordiniFornitori.find(x => x.ID === id), f = dati.fornitori.find(x => x.ID === o.Fornitore) || {Nome: o.Fornitore}, t = dati.titolare || {};
  const tot = o.Righe.reduce((s, r) => s + r.qta * (r.costo || 0), 0);
  ST().stampaDoc(`Ordine ${o.ID}`, `<div class="dl"><dt>Fornitore</dt><dd>${esc(f.Nome)}${f.Referente ? " · " + esc(f.Referente) : ""}</dd>${f.Email ? `<dt>Email</dt><dd>${esc(f.Email)}</dd>` : ""}${f.Telefono ? `<dt>Telefono</dt><dd>${esc(f.Telefono)}</dd>` : ""}
      <dt>Ordinante</dt><dd>${esc(t.ragione || "SocialGlass")}${t.piva ? " · P.IVA " + esc(t.piva) : ""}${t.indirizzo ? " · " + esc(t.indirizzo) : ""}</dd><dt>Data</dt><dd>${dt(o.Creato)}</dd><dt>Stato</dt><dd>${esc(o.Stato)}</dd></div>
    <table><tr><th>Codice fornitore</th><th>Nostro codice</th><th>Descrizione</th><th class="n">Quantità</th><th class="n">Costo unit.</th><th class="n">Totale</th></tr>
    ${o.Righe.map(r => `<tr><td>${esc(r.codiceFornitore)}</td><td>${esc(r.codice)}</td><td>${esc(r.descrizione)}</td><td class="n">${r.qta}</td><td class="n">${r.costo ? euro(r.costo) : ""}</td><td class="n">${r.costo ? euro(r.qta * r.costo) : ""}</td></tr>`).join("")}
    <tr><th colspan="3">Totale</th><th class="n">${o.Righe.reduce((s, r) => s + r.qta, 0)}</th><th></th><th class="n">${tot ? euro(tot) : ""}</th></tr></table>${o.Note ? `<p>Note: ${esc(o.Note)}</p>` : ""}`);
}
function stampaConti(tipo){
  const caf = tipo === "caf", l = caf ? dati.caf : dati.ottici;
  const accordo = x => x.CompensoTipo === "fisso" ? `${euro(x.CompensoValore)} per abbonamento` : x.CompensoTipo === "percentuale" ? `${n2(x.CompensoValore)}% sui canoni` : "non definito";
  ST().stampaDoc(caf ? "Conteggi CAF" : "Conteggi ed esposizione ottiche", `<table><tr><th>Codice</th><th>Nome</th>${caf ? "" : "<th class=\"n\">Montature esposte</th>"}<th class="n">Clienti</th><th class="n">Attivati</th><th class="n">Attivi</th><th class="n">Canoni incassati</th><th>Accordo</th><th class="n">Maturato</th><th class="n">Liquidato</th><th class="n">Da liquidare</th></tr>
    ${l.map(x => { const k = x.conti || {}; return `<tr><td>${esc(x.ID)}</td><td>${esc(caf ? x.Nome : x.Intestatario)}</td>${caf ? "" : `<td class="n">${dati.montature.filter(m => !m.archiviata).reduce((t, m) => t + (m.giacenze[x.ID] || 0), 0)}</td>`}
      <td class="n">${k.clienti || 0}</td><td class="n">${k.attivati || 0}</td><td class="n">${k.attivi || 0}</td><td class="n">${euro(k.incassati)}</td><td>${accordo(x)}</td><td class="n">${euro(k.maturato)}</td><td class="n">${euro(k.liquidato)}</td><td class="n">${euro(k.saldo)}</td></tr>`; }).join("")}</table>
    <p class="hint">Canoni incassati = canoni pagati × importo mensile.</p>`);
}
function stampaElencoAdm(){
  const F = filtriAdm, filtri = [F.q, F.caf, F.ottica, F.stato, F.sit ? SIT[F.sit][0] : ""].filter(Boolean).join(" · ");
  ST().stampaDoc("Elenco clienti", `${filtri ? `<p class="hint">Filtri: ${esc(filtri)}</p>` : ""}<table><tr><th>Codice</th><th>Cliente</th><th>Codice fiscale</th><th>CAF</th><th>Ottica</th><th>Stato</th><th>Scadenza</th><th>Situazione</th></tr>
    ${clientiVisti.map(c => `<tr><td>${esc(c.univoco)}</td><td>${esc(c.nome)}</td><td>${esc(c.cf)}</td><td>${esc(c.caf)}</td><td>${esc(c.ottica)}</td><td>${esc(c.stato)}</td><td>${c.scadenza ? dt(c.scadenza) : ""}</td>
      <td>${[c.bloccato ? "bloccato" : "", c.moroso ? "moroso" : "", c.chiuso ? "chiuso" : c.abbonamentoAttivo ? "attivo" : ""].filter(Boolean).join(", ")}</td></tr>`).join("")}</table><p class="hint">${clientiVisti.length} clienti.</p>`);
}
let artAperto = null, fornAperto = null, magSel = new Set(), magF = {q: "", forn: "", dove: "", stato: "attive"};
const sedi = () => [["MAG", "Magazzino"]].concat(dati.ottici.map(o => [o.ID, `${o.ID} · ${o.Intestatario}`]));
const nomeSede = id => id === "MAG" ? "Magazzino" : ((dati.ottici.find(o => o.ID === id) || {}).Intestatario ? `${id} · ${dati.ottici.find(o => o.ID === id).Intestatario}` : id);
const nomeForn = id => id ? ((dati.fornitori.find(f => f.ID === id) || {}).Nome || id + " (eliminato)") : "—";
const optSedi = (v, vuota) => (vuota ? `<option value="">${vuota}</option>` : "") + sedi().map(([k, t]) => `<option value="${esc(k)}" ${k === v ? "selected" : ""}>${esc(t)}</option>`).join("");
const optForn = v => `<option value="">Nessun fornitore</option>` + dati.fornitori.map(f => `<option value="${esc(f.ID)}" ${f.ID === v ? "selected" : ""}>${esc(f.Nome)}</option>`).join("");
const MAG_STATI = {attive: ["Tutte (non archiviate)", m => !m.archiviata], disponibili: ["Disponibili", m => !m.archiviata && m.tot > 0], sotto: ["Sotto scorta o esaurite", m => m.sottoScorta || m.esaurita],
  prenotate: ["Con prenotazioni", m => m.riservate.length > 0], archiviate: ["Archiviate", m => m.archiviata]};
function badgeMont(m){
  return (m.archiviata ? '<span class="chip s6">ARCHIVIATA</span>' : "") + (m.esaurita ? '<span class="chip s3">ESAURITA</span>' : m.sottoScorta ? '<span class="chip s3">SOTTO SCORTA</span>' : "")
    + (m.riservate.length ? `<span class="chip s2">PRENOTATE ${m.riservate.length}</span>` : "") + (!m.archiviata ? `<span class="chip s4">DISP. ${m.tot}</span>` : "");
}
const esposta = m => Object.entries(m.giacenze).filter(([k]) => k !== "MAG").map(([k, n]) => `${k} (${n})`).join(", ");
function vistaMagazzino(){
  const d = dati;
  if (artAperto) return schedaArticolo(artAperto === "nuovo" ? null : d.montature.find(m => m.Codice === artAperto));
  const avvisi = d.montature.filter(m => m.sottoScorta || m.esaurita);
  const q = magF.q.toUpperCase(), l = magVisti = d.montature.filter(m => MAG_STATI[magF.stato][1](m) && (!magF.forn || m.Fornitore === magF.forn) && (!magF.dove || (m.giacenze[magF.dove] || 0) > 0)
    && (!q || `${m.Codice} ${m.Modello} ${m.Colore} ${m.Calibro} ${m.CodiceFornitore}`.toUpperCase().includes(q)));
  const sel = (k, vals) => `<select data-magf="${k}" aria-label="${k}">${vals.map(([v, t]) => `<option value="${esc(v)}" ${magF[k] === v ? "selected" : ""}>${esc(t)}</option>`).join("")}</select>`;
  return `${avvisi.length ? `<div class="esito err" style="display:block"><b>${avvisi.length} ${avvisi.length === 1 ? "articolo sotto scorta o esaurito" : "articoli sotto scorta o esauriti"}</b>: ${avvisi.slice(0, 8).map(m => `<button type="button" class="linkbtn" data-art="${esc(m.Codice)}">${esc(m.Codice)}</button>`).join(" ")}${avvisi.length > 8 ? " …" : ""}
      <br><span style="font-size:13px">Il riordino si prepara nella pagina del fornitore (scheda <b>Fornitori</b>).</span></div>` : ""}
    <div class="riga"><button type="button" class="verde" data-art-nuovo style="margin:0">+ Nuova montatura</button>
      <button type="button" data-qr-sel style="margin:0" ${magSel.size ? "" : "disabled"}>Stampa QR selezionati (${magSel.size})</button>
      <button type="button" data-stampa-mag style="margin:0">Stampa report</button></div>
    <div class="filtri"><input id="magCerca" value="${esc(magF.q)}" placeholder="Codice, modello, colore, calibro" aria-label="Cerca montatura" autocomplete="off">
      ${sel("forn", [["", "Tutti i fornitori"]].concat(d.fornitori.map(f => [f.ID, f.Nome])))}${sel("dove", [["", "Ogni sede"]].concat(sedi().map(([k, t]) => [k, k === "MAG" ? "In magazzino" : "Esposte da " + t])))}
      ${sel("stato", Object.entries(MAG_STATI).map(([k, v]) => [k, v[0]]))}</div>
    <p class="hint" style="margin:2px 0 4px">${l.length} articoli · ${l.reduce((s, m) => s + m.tot, 0)} pezzi disponibili · <button type="button" class="linkbtn" data-sel-tutti>${l.length && l.every(m => magSel.has(m.Codice)) ? "Deseleziona" : "Seleziona"} tutti</button></p>
    <div class="lista">${l.slice(0, 400).map(m => `<div class="riga-cli" style="cursor:default"><input type="checkbox" data-selart="${esc(m.Codice)}" ${magSel.has(m.Codice) ? "checked" : ""} aria-label="Seleziona ${esc(m.Codice)}" style="width:auto;margin:0 4px 0 0;box-shadow:none">
        <button type="button" data-art="${esc(m.Codice)}" style="flex:1;display:flex;justify-content:space-between;gap:8px;align-items:center;background:none;border:0;box-shadow:none;padding:0;margin:0;text-align:left;color:inherit">
        <span><span class="nome">${esc(m.Codice)}</span> ${esc(m.Modello)} ${esc(m.Colore)}<span class="cod">${esc(m.Calibro)}${m.Asse ? "-" + esc(m.Asse) : ""} · ${esc(nomeForn(m.Fornitore))}${esposta(m) ? " · esposta: " + esc(esposta(m)) : ""}</span></span>
        <span class="bad">${badgeMont(m)}</span></button></div>`).join("") || '<div class="vuoto">Nessuna montatura con questi filtri</div>'}</div>`;
}
function schedaArticolo(m){
  const nuovo = !m; m = m || {Codice: "", giacenze: {}, riservate: [], Movimenti: [], tot: 0};
  const pezzi = Object.entries(m.giacenze);
  return `<div class="riga" style="justify-content:space-between;align-items:center"><button type="button" class="linkbtn" data-chiudi-art style="margin:0">← Torna al magazzino</button>${nuovo ? "" : `<button type="button" data-stampa-scheda="articolo" style="margin:0">Stampa scheda</button>`}</div>
    ${nuovo ? "" : `<div class="scheda"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:17px">${esc(m.Codice)} · ${esc(m.Modello)} ${esc(m.Colore)}</b><span class="bad" style="display:flex;gap:4px;flex-wrap:wrap">${badgeMont(m)}</span></div>
      <dl class="dl">${riga("Fornitore", esc(nomeForn(m.Fornitore)) + (m.CodiceFornitore ? " · art. " + esc(m.CodiceFornitore) : ""))}${riga("Scorta minima", m.ScortaMinima ? esc(m.ScortaMinima) + (m.AvvisoScorta ? " · avviso attivo" : " · avviso spento") : "non impostata")}
        ${riga("Sotto scorta dal", m.SottoScortaDal ? dt(m.SottoScortaDal) : "")}</dl>
      <table class="rx" style="margin-top:6px"><tr><th style="text-align:left">Dove</th><th>Pezzi</th></tr>${pezzi.map(([k, n]) => `<tr><td style="text-align:left">${esc(k === "MAG" ? "Magazzino" : "Esposta da " + nomeSede(k))}</td><td>${n}</td></tr>`).join("") || '<tr><td colspan="2">Nessun pezzo disponibile</td></tr>'}</table>
      ${m.riservate.length ? `<div style="margin-top:4px">Prenotate dai clienti: ${m.riservate.map(r => `<b>${esc(r.univoco === "?" ? "cliente (dato precedente)" : r.univoco)}</b> da ${esc(nomeSede(r.ottica))}`).join("; ")}</div>` : ""}
      <div class="riga" style="margin-top:8px;align-items:flex-end"><div><label class="lbl" for="qrCopie">Copie del QR</label><input id="qrCopie" type="number" min="1" max="200" value="${Math.max(1, m.tot)}" style="width:90px;margin:0"></div>
        <button type="button" data-qr="${esc(m.Codice)}" style="margin:0">Stampa QR</button></div></div>
    ${m.archiviata ? "" : `<form data-f="magazzino" class="scheda"><b>Movimento di magazzino</b><input type="hidden" name="codice" value="${esc(m.Codice)}">
      <div class="riga"><div style="flex:1"><label class="lbl" for="mvOp">Operazione</label><select id="mvOp" name="op"><option value="carico">Carico (merce arrivata)</option><option value="trasferisci">Trasferisci (es. esponi in un'ottica)</option><option value="scarico">Scarico (rotta, persa, resa)</option><option value="rettifica">Rettifica inventario</option></select></div>
        <div style="width:100px"><label class="lbl" for="mvQ">Quantità</label><input id="mvQ" name="qta" type="number" min="0" value="1" required></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="mvDa">Da (scarico e trasferimento)</label><select id="mvDa" name="da">${optSedi("MAG")}</select></div>
        <div style="flex:1"><label class="lbl" for="mvA">A (carico, trasferimento, rettifica)</label><select id="mvA" name="a">${optSedi("MAG")}</select></div></div>
      <label class="lbl" for="mvN">Nota (facoltativa)</label><input id="mvN" name="nota" maxlength="160">
      <button type="submit" class="verde full">Registra movimento</button></form>`}`}
    <form data-f="salvaMontatura" class="scheda"><b>${nuovo ? "Nuova montatura" : "Dati dell'articolo"}</b>${nuovo ? '<input type="hidden" name="nuova" value="1">' : ""}
      <label class="lbl" for="aMCod">Codice (sul cartellino QR, es. SG-2001)</label><input id="aMCod" name="Codice" required style="text-transform:uppercase" value="${esc(m.Codice)}" ${nuovo ? "" : "readonly"}>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMMod">Modello</label><input id="aMMod" name="Modello" value="${esc(m.Modello)}"></div><div style="flex:1"><label class="lbl" for="aMCol">Colore</label><input id="aMCol" name="Colore" value="${esc(m.Colore)}"></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMCal">Calibro (es. 52-18)</label><input id="aMCal" name="Calibro" value="${esc(m.Calibro)}"></div><div style="flex:1"><label class="lbl" for="aMAs">Asta</label><input id="aMAs" name="Asse" value="${esc(m.Asse)}"></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMPr">Prezzo al cliente (vuoto = listino)</label><input id="aMPr" name="Prezzo" inputmode="decimal" value="${esc(m.Prezzo)}"></div><div style="flex:1"><label class="lbl" for="aMCo">Costo d'acquisto</label><input id="aMCo" name="Costo" inputmode="decimal" value="${esc(m.Costo)}"></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMFo">Fornitore</label><select id="aMFo" name="Fornitore">${optForn(m.Fornitore)}</select></div><div style="flex:1"><label class="lbl" for="aMCF">Codice articolo del fornitore</label><input id="aMCF" name="CodiceFornitore" value="${esc(m.CodiceFornitore)}"></div></div>
      <div class="riga"><div style="flex:1"><label class="lbl" for="aMSm">Scorta minima (pezzi)</label><input id="aMSm" name="ScortaMinima" type="number" min="0" value="${esc(m.ScortaMinima)}"></div><div style="flex:1"><label class="lbl" for="aMRq">Quantità da riordinare (vuoto = automatica)</label><input id="aMRq" name="RiordinoQta" type="number" min="0" value="${esc(m.RiordinoQta)}"></div></div>
      <label class="gdpr"><input type="checkbox" name="AvvisoScorta" ${m.AvvisoScorta || nuovo ? "checked" : ""}> Avviso automatico quando scende alla scorta minima</label>
      ${nuovo ? `<div class="riga"><div style="width:110px"><label class="lbl" for="aMQ">Pezzi iniziali</label><input id="aMQ" name="Quantita" type="number" min="0" value="1"></div><div style="flex:1"><label class="lbl" for="aMDv">Dove</label><select id="aMDv" name="Dove">${optSedi("MAG")}</select></div></div>` : ""}
      <label class="lbl" for="aMNo">Note</label><input id="aMNo" name="Note" value="${esc(m.Note)}" maxlength="300">
      <button type="submit" class="verde full">${nuovo ? "Crea montatura" : "Salva dati"}</button></form>
    ${nuovo ? "" : `<div class="scheda"><b>Ultimi movimenti</b>${(m.Movimenti || []).length ? `<div class="lista" style="max-height:240px">${m.Movimenti.map(x => `<div style="font-size:13px;border-bottom:1px solid #eef1f5;padding:3px 0">${dt(x.il)} · <b>${esc(x.tipo)}</b>${x.qta ? ` ${x.qta > 0 ? "+" : ""}${x.qta}` : ""}${x.dove ? " · " + esc(x.dove) : ""}${x.cliente ? " · cliente " + esc(x.cliente) : ""}${x.nota ? " · " + esc(x.nota) : ""}</div>`).join("")}</div>` : '<p style="margin:4px 0">Nessun movimento registrato.</p>'}</div>
      <div class="az">${m.archiviata ? `<button type="button" class="verde" data-ripristina="${esc(m.Codice)}">Ripristina dall'archivio</button>`
        : `<button type="button" class="grigio" data-elimina="montatura" data-id="${esc(m.Codice)}">Elimina (archivia)</button>`}</div>
      <p class="hint" style="font-size:12.5px">Eliminare archivia l'articolo: non compare più negli elenchi e il suo QR non è più valido. Le schede dei clienti che l'hanno scelto restano complete.</p>`}`;
}
const STATO_ORD = {BOZZA: "s1", INVIATO: "s2", RICEVUTO: "s4", ANNULLATO: "s6"};
function testoOrdine(o, f){
  const t = (dati.titolare || {});
  return `Buongiorno${f.Referente ? " " + f.Referente : ""},\nvi inviamo l'ordine ${o.ID}:\n\n${o.Righe.map(r => `- ${r.qta} x ${r.codiceFornitore || r.codice} ${r.descrizione}`).join("\n")}\n\nGrazie,\n${t.ragione || "SocialGlass"}${t.telefono ? "\n" + t.telefono : ""}`;
}
function vistaFornitori(){
  const d = dati;
  if (fornAperto) return schedaFornitore(fornAperto === "nuovo" ? null : d.fornitori.find(f => f.ID === fornAperto));
  return `<button type="button" class="verde" data-forn-nuovo style="margin:0 0 6px">+ Nuovo fornitore</button>
    <div class="lista">${d.fornitori.map(f => { const art = d.montature.filter(m => m.Fornitore === f.ID && !m.archiviata), ap = d.ordiniFornitori.filter(o => o.Fornitore === f.ID && ["BOZZA", "INVIATO"].includes(o.Stato));
      return `<button type="button" class="riga-cli" data-forn="${esc(f.ID)}"><span><span class="nome">${esc(f.Nome)}</span><span class="cod">${esc(f.ID)} · ${art.length} articoli · ${art.reduce((s, m) => s + m.tot, 0)} pezzi</span></span>
        <span class="bad">${f.proposta.length ? `<span class="chip s3">DA RIORDINARE ${f.proposta.length}</span>` : ""}${ap.length ? `<span class="chip s2">ORDINI APERTI ${ap.length}</span>` : ""}${f.RiordinoAuto ? '<span class="chip s4">RIORDINO AUTO</span>' : ""}</span></button>`; }).join("") || '<div class="vuoto">Nessun fornitore. Aggiungi il primo per collegare le montature e preparare i riordini.</div>'}</div>`;
}
function schedaFornitore(f){
  const nuovo = !f; f = f || {ID: "", proposta: []};
  const art = nuovo ? [] : dati.montature.filter(m => m.Fornitore === f.ID && !m.archiviata), ord = nuovo ? [] : dati.ordiniFornitori.filter(o => o.Fornitore === f.ID);
  return `<div class="riga" style="justify-content:space-between;align-items:center"><button type="button" class="linkbtn" data-chiudi-forn style="margin:0">← Torna ai fornitori</button>${nuovo ? "" : `<button type="button" data-stampa-forn style="margin:0">Stampa riepilogo fornitore</button>`}</div>
    ${nuovo ? "" : `<div class="scheda"><b style="font-size:17px">${esc(f.Nome)}</b><div class="az" style="margin-top:6px">${f.Sito ? `<a class="btn-link" target="_blank" rel="noopener" href="${esc(f.Sito)}">Apri il sito per gli ordini</a>` : ""}${f.Email ? `<a class="btn-link" href="mailto:${esc(f.Email)}">${esc(f.Email)}</a>` : ""}${f.Telefono ? `<a class="btn-link" href="tel:${esc(f.Telefono)}">${esc(f.Telefono)}</a>` : ""}</div></div>
    <div class="scheda"><b>Riordino</b> ${f.RiordinoAuto ? '<span class="chip s4">AUTOMATICO</span>' : ""}
      <p class="hint" style="margin:4px 0">${f.RiordinoAuto ? "Quando un articolo scende alla scorta minima si crea da solo una bozza d'ordine qui sotto (controllo anche ogni mattina): tu la controlli e la invii." : "Attiva il riordino automatico nei dati del fornitore per avere la bozza pronta da sola."}</p>
      ${f.proposta.length ? `<form data-f="creaOrdine" data-forn="${esc(f.ID)}"><table class="rx" style="width:100%"><tr><th style="text-align:left">Articolo</th><th>Disp.</th><th>Min.</th><th>In arrivo</th><th>Da ordinare</th></tr>
        ${f.proposta.map(p => `<tr><td style="text-align:left">${esc(p.codice)}${p.codiceFornitore ? ` <small>(${esc(p.codiceFornitore)})</small>` : ""}<br><small>${esc(p.descrizione)}</small></td><td>${p.giacenza}</td><td>${p.minimo}</td><td>${p.inArrivo}</td><td><input type="number" min="0" name="q_${esc(p.codice)}" value="${p.qta}" style="width:70px;margin:0"></td></tr>`).join("")}</table>
        <button type="submit" class="verde full">Crea bozza d'ordine</button></form>` : '<p style="margin:4px 0">Nessun articolo da riordinare in questo momento.</p>'}</div>
    <div class="scheda"><b>Ordini</b>${ord.length ? ord.map(o => { const tot = o.Righe.reduce((s, r) => s + r.qta * (r.costo || 0), 0), pz = o.Righe.reduce((s, r) => s + r.qta, 0), testo = testoOrdine(o, f);
        return `<div class="cli" style="margin-top:6px"><div class="top"><div><b>${esc(o.ID)}</b>${o.Auto ? ' <span class="chip">AUTOMATICO</span>' : ""}<div class="cod">creato ${dt(o.Creato)}${o.Inviato ? " · inviato " + dt(o.Inviato) : ""}${o.Ricevuto ? " · ricevuto " + dt(o.Ricevuto) : ""}</div></div><span class="chip ${STATO_ORD[o.Stato] || ""}">${esc(o.Stato)}</span></div>
          <div style="font-size:13.5px">${o.Righe.map(r => `${r.qta} × ${esc(r.codice)}${r.codiceFornitore ? " (" + esc(r.codiceFornitore) + ")" : ""} ${esc(r.descrizione)}`).join("<br>")}</div>
          <div style="font-size:13px;color:#555">${pz} pezzi${tot ? " · costo stimato " + euro(tot) : ""} · <button type="button" class="linkbtn" data-stampa-ord="${esc(o.ID)}">Stampa ordine</button></div>
          ${o.Stato === "BOZZA" ? `<div class="az">${f.Email ? `<a class="btn-link" data-invia-ord="${esc(o.ID)}" href="mailto:${esc(f.Email)}?subject=${encodeURIComponent("Ordine " + o.ID)}&body=${encodeURIComponent(testo)}">Invia per email</a>` : ""}
              ${f.Telefono ? `<a class="btn-link" data-invia-ord="${esc(o.ID)}" target="_blank" rel="noopener" href="https://wa.me/${esc(String(f.Telefono).replace(/\D/g, ""))}?text=${encodeURIComponent(testo)}">Invia su WhatsApp</a>` : ""}
              <button type="button" data-ord-op="invia" data-id="${esc(o.ID)}">Segna come inviato</button><button type="button" class="grigio" data-ord-op="annulla" data-id="${esc(o.ID)}">Annulla</button></div>` : ""}
          ${o.Stato === "INVIATO" || o.Stato === "BOZZA" ? `<form data-f="riceviOrdine" data-id="${esc(o.ID)}" class="riga" style="align-items:flex-end"><div style="flex:1"><label class="lbl" for="rc${esc(o.ID)}">Merce arrivata: carica in</label><select id="rc${esc(o.ID)}" name="dove">${optSedi("MAG")}</select></div><button type="submit" class="verde" style="margin:0">Merce arrivata</button></form>` : ""}
          ${o.Stato === "INVIATO" ? `<div class="az"><button type="button" class="grigio" data-ord-op="annulla" data-id="${esc(o.ID)}">Annulla ordine</button></div>` : ""}</div>`; }).join("") : '<p style="margin:4px 0">Nessun ordine.</p>'}</div>
    <div class="scheda"><b>Articoli di questo fornitore</b> (${art.length})<div class="lista" style="max-height:260px">${art.map(m => `<button type="button" class="riga-cli" data-art-da-forn="${esc(m.Codice)}"><span><span class="nome">${esc(m.Codice)}</span> ${esc(m.Modello)} ${esc(m.Colore)}<span class="cod">${esc(m.CodiceFornitore)}</span></span><span class="bad">${badgeMont(m)}</span></button>`).join("") || '<div class="vuoto">Nessun articolo collegato</div>'}</div></div>`}
    <form data-f="salvaFornitore" class="scheda"><b>${nuovo ? "Nuovo fornitore" : "Dati del fornitore"}</b>
      <label class="lbl" for="fId">Codice (es. SUNOPTIC)</label><input id="fId" name="ID" required style="text-transform:uppercase" value="${esc(f.ID)}" ${nuovo ? "" : "readonly"}>
      <label class="lbl" for="fNo">Nome</label><input id="fNo" name="Nome" required value="${esc(f.Nome)}">
      <div class="riga"><div style="flex:1"><label class="lbl" for="fRe">Referente</label><input id="fRe" name="Referente" value="${esc(f.Referente)}"></div><div style="flex:1"><label class="lbl" for="fTe">Telefono / WhatsApp</label><input id="fTe" name="Telefono" inputmode="tel" value="${esc(f.Telefono)}"></div></div>
      <label class="lbl" for="fEm">Email per gli ordini</label><input id="fEm" name="Email" type="email" value="${esc(f.Email)}">
      <label class="lbl" for="fSi">Sito o area riservata per gli ordini</label><input id="fSi" name="Sito" value="${esc(f.Sito)}">
      <label class="lbl" for="fCo">Tempi di consegna</label><input id="fCo" name="Consegna" value="${esc(f.Consegna)}" placeholder="es. 5 giorni lavorativi">
      <label class="lbl" for="fNt">Note (minimi d'ordine, sconti…)</label><input id="fNt" name="Note" value="${esc(f.Note)}">
      <label class="gdpr"><input type="checkbox" name="RiordinoAuto" ${f.RiordinoAuto ? "checked" : ""}> Riordino automatico: prepara da solo la bozza d'ordine per gli articoli sotto scorta</label>
      <button type="submit" class="verde full">${nuovo ? "Crea fornitore" : "Salva dati"}</button></form>
    ${nuovo ? "" : `<div class="az"><button type="button" class="grigio" data-elimina="fornitore" data-id="${esc(f.ID)}">Elimina fornitore</button></div>`}`;
}
// cartellini QR: uno o più articoli, con il numero di copie scelto
function stampa(elenco){
  if (!elenco.length) return msg("Nessuna montatura selezionata.", "err");
  const w = open("", "_blank"); if (!w) return msg("Il browser ha bloccato la finestra di stampa: consenti i popup.", "err");
  const et = []; elenco.forEach(x => { for (let i = 0; i < Math.min(200, x.copie || 1); i++) et.push(x); });
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Cartellini QR SocialGlass</title>
    <style>body{font-family:Arial,sans-serif;margin:10mm}.g{display:grid;grid-template-columns:repeat(4,1fr);gap:6mm}.c{border:1px dashed #999;padding:4mm;text-align:center;break-inside:avoid}
    .c b{display:block;font-size:13pt;margin-top:2mm}.c small{color:#444}.q{display:flex;justify-content:center}</style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script></head><body>
    <div class="g">${et.map((x, i) => `<div class="c"><div class="q" id="q${i}"></div><b>${esc(x.Codice)}</b><small>${esc(x.Modello)} ${esc(x.Colore)} ${esc(x.Calibro)}</small></div>`).join("")}</div>
    <script>window.onload=function(){${JSON.stringify(et.map(x => x.Codice))}.forEach(function(c,i){new QRCode(document.getElementById("q"+i),{text:c,width:110,height:110});});setTimeout(function(){print()},500)}<\/script></body></html>`);
  w.document.close();
}
window.SG_ADMIN = {apri};
})();
