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
  crea(); mostra(); $("adminPopup").classList.remove("pagina");
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
  const [da, a] = window.SG_STAMPA.periodoDa(perAdm.p, perAdm.da, perAdm.a);
  const r = await call("dati", {da, a}); if (!r.ok){ if (r.status === 401) return apri(); $("admCorpo").innerHTML = `<div class="esito err">${esc(r.data.errore || "Errore")}</div>`; return; }
  dati = r.data; disegna();
}
const TAB = [["numeri", "Oggi"], ["clienti", "Clienti"], ["solleciti", "Solleciti"], ["conteggi", "Conteggi"], ["caf", "CAF"], ["ottici", "Ottici"], ["magazzino", "Magazzino"], ["fornitori", "Fornitori"], ["listini", "Listini"], ["registro", "Registro"], ["impostazioni", "Impostazioni"]];
let clientiAdm = null, schedaCli = null, filtriAdm = {q: "", caf: "", ottica: "", stato: "", sit: ""};
const SIT = {
  morosi: ["Morosi", c => c.moroso], bloccati: ["Anagrafica bloccata", c => c.bloccato], attivi: ["Abbonamento attivo", c => c.abbonamentoAttivo],
  scadenza: ["In scadenza (30 giorni)", c => c.inScadenza], chiusi: ["Abbonamento chiuso", c => c.chiuso]
};
const dt = d => d ? new Date(d).toLocaleDateString("it-IT") : "—";
const riga = (k, v) => v === "" || v == null ? "" : `<dt>${k}</dt><dd>${v}</dd>`;
function ricettaHtml(r){
  if (!r) return "";
  const n = (v, max) => { if (v == null || v === "") return ""; let x = Number(v); if (Math.abs(x) > max && Number.isInteger(x)) x /= 100; return (x > 0 ? "+" : "") + x.toFixed(2).replace(".", ","); };
  return `<table class="rx"><tr><th></th><th>Sfero</th><th>Cilindro</th><th>Asse</th><th>Add.</th></tr>${["OD", "OS"].map(e => `<tr><th>${e}</th><td>${n(r[e] && r[e].sf, 30)}</td><td>${n(r[e] && r[e].cil, 10)}</td><td>${r[e] && r[e].ax != null ? r[e].ax + "°" : ""}</td><td>${n(r[e] && r[e].add, 4)}</td></tr>`).join("")}</table>
    ${r.pd ? `<div>Distanza pupillare: <b>${esc(r.pd)} mm</b></div>` : ""}${r.note ? `<div>Note: ${esc(r.note)}</div>` : ""}`;
}
// accordo economico con il CAF o l'ottica e riepilogo dei conti
function campiCompenso(pfx, ruolo){
  const base = ruolo === "ottica" ? {t: "rata", v: ""} : {t: "fisso", v: "3"}, o = (k, t) => `<option value="${k}"${k === base.t ? " selected" : ""}>${t}</option>`;
  return `<fieldset style="border:1px solid #e3e6ea;border-radius:8px;padding:6px 10px;margin:8px 0"><legend style="font-size:13px;color:#555;padding:0 4px">Accordo economico con SocialGlass</legend>
    <label class="lbl" for="${pfx}CT">Compenso</label><select id="${pfx}CT" name="CompensoTipo" data-compenso>${o("rata", "Una rata + spedizione del cliente, per ogni abbonamento attivato")}${o("fisso", "€ per ogni abbonamento attivato")}${o("percentuale", "% sui canoni incassati")}</select>
    <label class="lbl" for="${pfx}CV">Valore (€ o %)</label><input id="${pfx}CV" name="CompensoValore" inputmode="decimal" value="${base.v}"${base.t === "rata" ? " disabled placeholder=\"non serve\"" : ""}>
    <p class="hint" style="margin:4px 0;font-size:12.5px">Importi IVA compresa. Proposta di base: ottica una rata + spedizione, CAF 3 € per abbonamento attivato; cambiala se con il partner avete concordato altro. Ogni cambio vale da oggi: i compensi già maturati restano con l'accordo di prima. I pagamenti al partner (acconti e saldi) si registrano nella sezione <b>Conteggi</b>.</p></fieldset>`;
}
let perAdm = {p: "", da: "", a: ""};
// riga breve nelle schede CAF/Ottici: il dettaglio è nella sezione Conteggi
function contiHtml(x, tipo){
  const e = x.estratto || {}, acc = e.accordo ? window.SG_STAMPA.testoAccordo(e.accordo) : "accordo non definito";
  return `<div style="font-size:13.5px">Accordo: ${esc(acc)} · da liquidare <b>${euro(e.saldoAttuale)}</b> · <button type="button" class="linkbtn" data-conto="${tipo}:${esc(x.ID)}">estratto conto</button></div>`;
}
let contoAperto = null, segConti = "caf", stripeStato = {}, tokenPaga = Math.random().toString(36).slice(2);
// pagamento al partner con Stripe Connect
function bloccoStripe(tipo, x, e){
  const k = `${tipo}:${x.ID}`, st = stripeStato[k];
  if (x.stripe && !st){ call("stripePartner", {tipo, id: x.ID, op: "stato"}).then(r => { stripeStato[k] = r.ok ? r.data : {errore: r.data.errore}; if (contoAperto === k) disegna(); }); }
  const intro = `<b>Paga con Stripe</b><p class="hint" style="margin:4px 0">Il ${tipo === "caf" ? "CAF" : "partner"} riceve il compenso sul proprio conto bancario tramite Stripe; il pagamento si registra da solo nell'estratto conto.</p>`;
  if (!x.stripe || (st && st.collegato === false)) return `<div class="scheda">${intro}<p style="margin:4px 0">Prima volta: il partner deve aprire il suo conto Stripe collegato (pochi minuti, con documento e IBAN).</p>
    <button type="button" data-stripe-collega="${esc(k)}" style="margin:0">Crea il link di registrazione</button>${st && st.link ? linkStripe(st, x) : ""}${st && st.errore ? `<p class="esito err" style="display:block">${esc(st.errore)}</p>` : ""}</div>`;
  if (!st) return `<div class="scheda">${intro}<p>Verifico il conto Stripe…</p></div>`;
  if (st.errore) return `<div class="scheda">${intro}<p class="esito err" style="display:block">${esc(st.errore)}</p><button type="button" data-stripe-aggiorna="${esc(k)}" style="margin:0">Riprova</button></div>`;
  if (!st.pronto) return `<div class="scheda">${intro}<p style="margin:4px 0"><span class="chip s2">REGISTRAZIONE DA COMPLETARE</span> ${st.mancano ? `mancano ${st.mancano} dati` : ""}</p>
    <div class="az"><button type="button" data-stripe-collega="${esc(k)}">Nuovo link di registrazione</button><button type="button" class="grigio" data-stripe-aggiorna="${esc(k)}">Aggiorna stato</button></div>${st.link ? linkStripe(st, x) : ""}</div>`;
  const dov = Math.max(0, e.saldoAttuale);
  return `<div class="scheda">${intro}<p style="margin:4px 0"><span class="chip s4">CONTO STRIPE ATTIVO</span></p>
    <form data-f="pagaStripe" data-tipo="${tipo}" data-id="${esc(x.ID)}"><div class="riga"><div style="flex:1"><label class="lbl" for="psI">Importo (€)</label><input id="psI" name="importo" inputmode="decimal" value="${dov ? String(dov).replace(".", ",") : ""}" required></div>
      <div style="flex:1"><label class="lbl" for="psC">Causale</label><select id="psC" name="causale"><option value="saldo">Saldo</option><option value="acconto">Acconto</option></select></div></div>
      <label class="lbl" for="psN">Nota</label><input id="psN" name="nota" maxlength="200" placeholder="es. compensi ottobre 2026">
      <button type="submit" class="verde full">Paga con Stripe</button></form></div>`;
}
function linkStripe(st, x){
  const tel = String(x.Telefono || "").replace(/\D/g, ""), testo = `SocialGlass: per ricevere i tuoi compensi completa la registrazione su Stripe da questo link (vale pochi minuti, se scade te ne mando un altro): ${st.link}`;
  return `<div class="avviso-cli" style="margin-top:6px">Link per il partner (scade dopo pochi minuti): <a href="${esc(st.link)}" target="_blank" rel="noopener">apri</a>
    <div class="az" style="margin-top:4px"><button type="button" data-copia="${esc(st.link)}">Copia link</button>${tel ? `<a class="btn-link" target="_blank" rel="noopener" href="https://wa.me/39${esc(tel)}?text=${encodeURIComponent(testo)}">Invia su WhatsApp</a>` : ""}</div></div>`;
}
// previsione: canoni ancora da incassare mese per mese, fino all'ultimo previsto (massimo 12 mesi)
function tabPrevisione(pv){
  if (!pv) return "";
  let l = pv.mesi.slice(); while (l.length > 1 && !l[l.length - 1].canoni) l.pop();
  const nomeMese = m => new Date(m + "-15").toLocaleDateString("it-IT", {month: "long", year: "numeric"}), som = k => l.reduce((t, x) => t + x[k], 0);
  return `<div class="scheda" id="previsioneAdm"><b>Previsione incassi</b>
    ${som("canoni") ? `<div style="overflow-x:auto"><table class="rx" style="width:100%;margin-top:6px"><tr><th style="text-align:left">Mese</th><th>Canoni</th><th>Incasso previsto</th><th>di cui da clienti morosi</th><th>Compensi previsti</th><th>Netto previsto</th></tr>
      ${l.map(x => `<tr><td style="text-align:left">${nomeMese(x.mese)}</td><td>${x.canoni}</td><td>${euro(x.importo)}</td><td>${x.rischio ? euro(x.rischio) : "—"}</td><td>${euro(x.compensi)}</td><td><b>${euro(x.netto)}</b></td></tr>`).join("")}
      <tr><th style="text-align:left">Totale</th><th>${som("canoni")}</th><th>${euro(som("importo"))}</th><th>${som("rischio") ? euro(som("rischio")) : "—"}</th><th>${euro(som("compensi"))}</th><th>${euro(som("netto"))}</th></tr></table></div>
      <p class="hint" style="font-size:12.5px;margin:6px 0 0">Canoni ancora da ricevere fino alla fine della durata minima di ogni abbonamento attivo${pv.ultimo ? ` (ultimo previsto: ${dt(pv.ultimo)})` : ""}. Non include nuovi clienti, spedizioni, riscatti né i mesi «mese per mese» dopo la scadenza. Un canone scaduto e non pagato è nel mese corrente. Compensi: solo quelli a percentuale, con gli accordi in vigore oggi (quelli fissi dipendono dalle nuove attivazioni).</p>`
    : '<p style="margin:4px 0">Nessun canone da incassare: non ci sono abbonamenti attivi.</p>'}</div>`;
}
function vistaConteggi(){
  const d = dati, S = window.SG_STAMPA;
  if (contoAperto){
    const [tipo, id] = contoAperto.split(":"), x = (tipo === "caf" ? d.caf : d.ottici).find(y => y.ID === id);
    if (!x){ contoAperto = null; return vistaConteggi(); }
    const e = x.estratto, oggi = new Date().toISOString().slice(0, 10), pag = (e.righe || []).filter(r => r.tipo === "pagamento");
    return `<div class="riga" style="justify-content:space-between;align-items:center"><button type="button" class="linkbtn" data-chiudi-conto style="margin:0">← Torna ai conteggi</button><button type="button" data-stampa-estratto-adm style="margin:0">Stampa estratto conto</button></div>
      <div class="scheda" id="estrattoAdm"><b style="font-size:17px">${tipo === "caf" ? "CAF" : "Ottica"} ${esc(x.ID)} · ${esc(tipo === "caf" ? x.Nome : x.Intestatario)}</b>${S.campiPeriodo("pa", perAdm)}${S.estrattoCorpo(e, true)}</div>
      ${bloccoStripe(tipo, x, e)}
      <form data-f="liquidazione" data-tipo="${tipo}" data-id="${esc(x.ID)}" class="scheda"><b>Pagamento fatto in altro modo (bonifico, contanti…)</b>
        <div class="riga"><div style="flex:1"><label class="lbl" for="lqD">Data</label><input id="lqD" name="data" type="date" value="${oggi}" required></div><div style="flex:1"><label class="lbl" for="lqI">Importo (€)</label><input id="lqI" name="importo" inputmode="decimal" required></div></div>
        <div class="riga"><div style="flex:1"><label class="lbl" for="lqC">Causale</label><select id="lqC" name="causale"><option value="acconto">Acconto</option><option value="saldo">Saldo</option><option value="rettifica">Rettifica</option></select></div><div style="flex:1"><label class="lbl" for="lqM">Metodo</label><input id="lqM" name="metodo" placeholder="es. bonifico" maxlength="40"></div></div>
        <label class="lbl" for="lqN">Nota (es. riferimento fattura, periodo)</label><input id="lqN" name="nota" maxlength="200">
        <button type="submit" class="verde full">Registra pagamento</button></form>
      ${pag.length ? `<div class="scheda"><b>Pagamenti nel periodo</b>${pag.map(p => `<div class="riga" style="justify-content:space-between;align-items:center;border-bottom:1px solid #eef1f5;padding:3px 0"><span>${dt(p.il)} · ${euro(p.importo)} · ${esc(p.descrizione)}</span>${p.id !== "precedenti" ? `<button type="button" class="grigio" data-elimina-liq="${esc(p.id)}" style="margin:0">Elimina</button>` : ""}</div>`).join("")}</div>` : ""}`;
  }
  const somma = (l, f) => l.reduce((t, x) => t + (f(x) || 0), 0);
  // incassi contati una volta sola (sui CAF: ogni cliente ha un CAF)
  const inc = k => somma(d.caf, x => x.conti[k]), e = (l, k) => somma(l, x => x.estratto[k]);
  const matCaf = e(d.caf, "maturato"), matOtt = e(d.ottici, "maturato"), tot = inc("incassati");
  const liqCaf = e(d.caf, "saldoAttuale"), liqOtt = e(d.ottici, "saldoAttuale");
  const p = (t, v, cl) => `<p${cl ? ` class="${cl}"` : ""}><span>${t}</span><b>${euro(v)}</b></p>`;
  const tab = (tipo, l) => `<div style="overflow-x:auto"><table class="rx" style="width:100%"><tr><th style="text-align:left">${tipo === "caf" ? "CAF" : "Ottica"}</th><th style="text-align:left">Accordo</th><th>Attivati</th><th>Canoni dei suoi clienti</th><th>Compensi maturati</th><th>Pagati</th><th>Da liquidare</th><th></th></tr>
    ${l.map(x => { const es = x.estratto, k = x.conti; return `<tr><td style="text-align:left"><b>${esc(x.ID)}</b><br><small>${esc(tipo === "caf" ? x.Nome : x.Intestatario)}</small></td>
      <td style="text-align:left">${es.accordo ? esc(S.testoAccordo(es.accordo)) : "<i>non definito</i>"}</td><td>${k.attivati}</td><td>${euro(k.canoni)}</td><td>${euro(es.maturato)}</td><td>${euro(es.pagato)}</td><td><b>${euro(es.saldoAttuale)}</b></td>
      <td><button type="button" class="${es.saldoAttuale > 0 ? "verde" : "grigio"}" data-conto="${tipo}:${esc(x.ID)}" style="margin:0;padding:6px 10px">${es.saldoAttuale > 0 ? "Paga" : "Estratto"}</button></td></tr>`; }).join("") || '<tr><td colspan="8">Nessuno</td></tr>'}
    ${l.length ? `<tr><th style="text-align:left" colspan="2">Totale</th><th>${somma(l, x => x.conti.attivati)}</th><th>${euro(somma(l, x => x.conti.canoni))}</th><th>${euro(e(l, "maturato"))}</th><th>${euro(e(l, "pagato"))}</th><th>${euro(e(l, "saldoAttuale"))}</th><th></th></tr>` : ""}</table></div>`;
  return `<div class="scheda"><b>Periodo</b>${S.campiPeriodo("pa", perAdm)}<span class="hint">${S.testoPeriodo((d.caf[0] || d.ottici[0] || {}).conti || {})}</span></div>
    <div class="scheda"><b>Riepilogo SocialGlass</b>
      <div class="kpi"><div>Totale incassato<b>${euro(tot)}</b></div><div>Compensi maturati<b>${euro(matCaf + matOtt)}</b></div><div>Margine<b>${euro(tot - matCaf - matOtt)}</b></div><div class="evid">Da liquidare<b>${euro(liqCaf + liqOtt)}</b></div></div>
      <div class="voci"><div><h4>Incassi dai clienti</h4>${p("Canoni", inc("canoni"))}${p("Spedizioni", inc("spedizioni"))}${p("Riscatti", inc("riscatti"))}${p("Totale", tot, "tot")}</div>
        <div><h4>CAF</h4>${p("Compensi maturati", matCaf)}${p("Pagati", e(d.caf, "pagato"))}${p("Da liquidare", liqCaf, "tot")}</div>
        <div><h4>Ottiche</h4>${p("Compensi maturati", matOtt)}${p("Pagati", e(d.ottici, "pagato"))}${p("Da liquidare", liqOtt, "tot")}</div></div>
      <p class="hint" style="font-size:12.5px;margin:8px 0 4px">Incassi e compensi del periodo scelto; «Da liquidare» è sempre il dovuto ad oggi. Il margine non tiene conto dei costi (montature, lenti, commissioni Stripe). CAF e ottici vedono solo il proprio estratto conto.</p>
      <button type="button" data-stampa-conti style="margin:0">Stampa report conteggi</button></div>
    ${tabPrevisione(d.previsione)}
    <div class="seg" role="tablist"><button type="button" role="tab" data-seg="caf" class="${segConti === "caf" ? "attivo" : ""}" aria-selected="${segConti === "caf"}">CAF (${d.caf.length})</button><button type="button" role="tab" data-seg="ottici" class="${segConti === "ottici" ? "attivo" : ""}" aria-selected="${segConti === "ottici"}">Ottiche (${d.ottici.length})</button></div>
    <div class="scheda">${segConti === "caf" ? tab("caf", d.caf) : tab("ottico", d.ottici)}</div>`;
}
function disegnaScheda(c){
  const o = c.ordine || {}, pg = o.pagamento || {}, pr = o.prezzi || {}, m = o.montatura, p = c.periodo, si = c.situazione, b = si.blocco;
  const ins = pg.insoluto;
  return `<div class="riga" style="justify-content:space-between;align-items:center"><button type="button" class="linkbtn" data-chiudi-scheda style="margin:0">← Torna all'elenco</button><button type="button" data-stampa-scheda="cliente" style="margin:0">Stampa scheda</button></div>
    <div class="scheda"><div class="top" style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b style="font-size:17px">${esc(c.nome)} ${esc(c.cognome)}</b><span class="chip">${esc(c.stato)}</span></div>
    ${si.bloccato ? '<span class="chip s3">ANAGRAFICA BLOCCATA</span> ' : ""}${si.moroso ? '<span class="chip s3">MOROSO</span>' : ""}
    <dl class="dl">${riga("Codice cliente", esc(c.univoco))}${riga("Codice fiscale", esc(c.cf))}${riga("Cellulare", esc(c.cellulare))}${riga("Nato a", esc(c.natoA))}${riga("Data di nascita", c.dataNascita ? dt(c.dataNascita) : "")}${riga("Registrato il", dt(c.creato))}
      ${riga("CAF", esc(c.caf))}${riga("Ottica", esc(c.ottica))}${riga("Listino", esc(c.listino))}
      ${riga("Presentato da", c.presentatoDa ? esc(c.presentatoDa) + (c.amicoPremiato ? " · mese gratis dato il " + dt(c.amicoPremiato) : "") : "")}${riga("Amici portati", (o.amici || []).length ? o.amici.map(a => `${esc(a.nome)} (${esc(a.stato)})`).join(", ") : "")}
      ${riga("Notifiche sul telefono", c.notifiche ? "attive" : "")}${riga("Recensione", o.recensione ? "★".repeat(o.recensione.voto) + (o.recensione.testo ? " «" + esc(o.recensione.testo) + "»" : "") : "")}${riga("Occhiale da donare", o.dona && o.dona.si ? (o.dona.donato ? "donato il " + dt(o.dona.donato) : o.dona.daDonare ? "ritirato, da donare" : "sì, alla restituzione") : "")}</dl>
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
      ${o.lab ? riga("Laboratorio", `${esc(o.lab.stato)} · montatura ${o.lab.fonte === "LAB" ? "copia del laboratorio" : o.lab.fonte === "MAG" ? "dal magazzino" : "da ritirare in ottica"}${o.lab.fonte !== "LAB" ? (o.lab.ritirata ? " (ritirata il " + dt(o.lab.ritirata) + ")" : " (non ancora ritirata)") : ""}`) : ""}
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
  let h = `<div class="riga schede-adm" role="tablist">${TAB.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === scheda}" class="${k === scheda ? "" : "grigio"}" data-tab="${k}" style="margin:0 0 6px">${t}</button>`).join("")}</div><div class="esito" id="admMsg" hidden></div>`;
  if (d.prova && scheda === "numeri") h += `<div class="esito info">Sono ancora attivi gli accessi di prova (CAF001, OTT07, OTT12 con password «demo»). Prima di aprire il servizio al pubblico rimuovili da <b>Impostazioni</b>.</div>`;
  $("adminPopup").classList.add("pagina");
  if (scheda === "numeri"){
    const n = d.numeri, lb = d.laboratorio || {}, ord = d.ordiniFornitori || [], partner = d.caf.concat(d.ottici);
    const daLiq = partner.filter(x => x.estratto && x.estratto.saldoAttuale > 0), totLiq = daLiq.reduce((t, x) => t + x.estratto.saldoAttuale, 0);
    const bozze = ord.filter(o => o.Stato === "BOZZA").length, inviati = ord.filter(o => o.Stato === "INVIATO").length;
    const daRiord = (d.fornitori || []).filter(f => f.proposta.length && !ord.some(o => o.Fornitore === f.ID && o.Stato === "BOZZA")).length;
    const senza = partner.filter(x => !x.CompensoTipo && !x.CompensoBase).length, mancano = d.pronto.filter(([, ok]) => !ok).length;
    const fare = [], f = (num, t, sotto, tab, urg) => { if (num) fare.push(`<button type="button" data-tab="${tab}"${urg ? ' class="urg"' : ""}><span class="n">${num}</span><span>${t}<small>${sotto}</small></span><span class="va">Apri ›</span></button>`); };
    f(n.morosi, "Clienti con il canone non pagato", "Sollecita: testo e contatti già pronti", "solleciti", true);
    f(n.sottoScorta, "Montature sotto scorta o esaurite", "Controlla il magazzino e riordina", "magazzino", true);
    f(bozze, "Ordini ai fornitori da inviare", "Bozze pronte: controlla e invia", "fornitori");
    f(daRiord, "Fornitori con articoli da riordinare", "Crea la bozza d'ordine", "fornitori");
    f(inviati, "Ordini inviati in attesa della merce", "Quando arriva, segna «merce arrivata»", "fornitori");
    f(daLiq.length, `Compensi da liquidare: ${euro(totLiq)}`, "CAF e ottiche con un saldo a credito", "conteggi");
    f(lb.attivo ? lb.daRitirare : 0, "Montature che il laboratorio deve ritirare", "Sono ancora esposte in ottica", "clienti");
    f(senza, "CAF o ottiche senza accordo economico", "Imposta il compenso nella loro scheda", "conteggi");
    f((d.segnalazioni || []).length, "Segnalazioni dei clienti aperte", "Problemi con l'occhiale: le vede anche l'ottica", "numeri", true);
    const sv = d.servizio || {daDonare: [], recensioni: []};
    if (sv.daLeggere) fare.push(`<button type="button" data-vai-servizio class="urg"><span class="n">${sv.daLeggere}</span><span>Recensioni da 1 a 3 stelle da leggere<small>Contatta il cliente prima che lo scriva altrove</small></span><span class="va">Apri ›</span></button>`);
    if (sv.daDonare.length) fare.push(`<button type="button" data-vai-servizio><span class="n">${sv.daDonare.length}</span><span>Occhiali restituiti da donare<small>I clienti hanno scelto di donarli</small></span><span class="va">Apri ›</span></button>`);
    const max = Math.max(1, ...Object.values(n.perStato));
    // solo i numeri che non compaiono già nella lista «Da fare oggi»
    h += `<div class="cru-kpi"><button type="button" data-tab="clienti"><b>${n.clienti}</b>Clienti</button><button type="button" data-tab="clienti" class="ok"><b>${n.abbonamentiAttivi}</b>Abbonamenti attivi</button>
        <button type="button" data-tab="conteggi"><b>${euro(n.canoniMensili)}</b>Canoni al mese</button></div>
      <div class="cru-griglia"><div class="cru-box"><h3>Da fare oggi</h3>${fare.length ? `<div class="fare">${fare.join("")}</div>` : '<div class="fare-vuoto"><b>✓</b> Tutto in ordine: niente in sospeso.</div>'}</div>
        <div class="cru-box"><h3>Clienti per stato</h3>${Object.entries(n.perStato).map(([st, c]) => `<div class="barra-st"><span>${esc(st)}</span><b>${c}</b><i style="width:${Math.round(c / max * 100)}%"></i></div>`).join("") || '<div class="vuoto">Nessun cliente</div>'}</div></div>
      ${(d.segnalazioni || []).length ? `<div class="cru-box" id="admSegn" style="margin-top:14px"><h3>Segnalazioni dei clienti</h3>${d.segnalazioni.map(x => `<div class="scheda" data-sg="${esc(x.id)}"><small>${dt(x.il)} · <b>${esc(x.univoco)}</b> ${esc(x.nome)} · ottica ${esc(x.ottica)}${x.cellulare ? ` · <a href="tel:+39${esc(String(x.cellulare).replace(/\D/g, ""))}">${esc(x.cellulare)}</a>` : ""}</small>
        <p style="margin:6px 0">${esc(x.testo)}</p>${x.foto ? `<img src="${esc(x.foto)}" alt="Foto del cliente" style="max-width:260px;width:100%;border-radius:10px">` : ""}
        <div class="riga" style="margin-top:6px"><input data-risp placeholder="Risposta al cliente (facoltativa: gli arriva come notifica)" maxlength="300" style="flex:1;margin:0"><button type="button" class="verde" data-segn-ok="${esc(x.id)}" style="margin:0">Risolta</button></div></div>`).join("")}</div>` : ""}
      <div class="cru-box" style="margin-top:14px"><h3>Report del mese</h3><p class="hint" style="margin:0 0 8px">Incassi, nuovi clienti, attivazioni, morosi e recensioni del mese, pronto da stampare.</p>
        <div class="riga"><input type="month" id="repMese" value="${new Date(Date.now() - 15*864e5).toISOString().slice(0, 7)}" style="margin:0;max-width:200px"><button type="button" data-report style="margin:0">Apri il report</button></div></div>
      <div class="cru-box" id="admServizio" style="margin-top:14px"><h3>Clienti contenti</h3>
        <div class="cru-kpi" style="margin-bottom:8px"><div class="kpi-f"><b>${sv.totRecensioni ? "★ " + String(sv.media).replace(".", ",") : "—"}</b>${sv.totRecensioni} ${sv.totRecensioni === 1 ? "recensione" : "recensioni"}</div><div class="kpi-f"><b>${sv.amici || 0}</b>clienti portati da amici</div><div class="kpi-f"><b>${sv.donati || 0}</b>occhiali donati</div><div class="kpi-f"><b>${sv.notifiche || 0}</b>clienti con le notifiche attive</div></div>
        ${sv.recensioni.length ? `<div class="lista" style="max-height:300px">${sv.recensioni.slice(0, 20).map(r => `<div class="riga-cli" style="cursor:default;align-items:flex-start"><span><span class="nome" style="color:#F5B301">${"★".repeat(r.voto)}<span style="color:#cfd6e2">${"★".repeat(5 - r.voto)}</span></span> ${esc(r.nome)} · ${esc(r.ottica)} · ${dt(r.il)}${r.testo ? `<span class="cod" style="font-family:inherit;white-space:normal">«${esc(r.testo)}»</span>` : ""}</span>
          <span class="bad">${r.voto <= 3 && !r.letta ? `<button type="button" class="grigio" data-rec-letta="${esc(r.univoco)}" style="margin:0;padding:6px 10px">Fatto</button>` : ""}<button type="button" class="grigio" data-scheda-da-soll="${esc(r.univoco)}" style="margin:0;padding:6px 10px">Scheda</button></span></div>`).join("")}</div>` : '<p class="hint">Le recensioni arrivano 7 giorni dopo la consegna degli occhiali.</p>'}
        ${sv.daDonare.length ? `<h3 style="margin-top:12px">Occhiali da donare (${sv.daDonare.length})</h3><div class="lista">${sv.daDonare.map(x => `<div class="riga-cli" style="cursor:default"><span><span class="nome">${esc(x.nome)}</span><span class="cod">${esc(x.montatura)} · ritirato dall'ottica ${esc(x.ottica)} il ${dt(x.dal)}</span></span></div>`).join("")}</div>
          <button type="button" class="verde" data-donati style="margin-top:8px">Segna tutti come donati</button><p class="hint" style="font-size:12.5px">Al cliente arriva «il tuo occhiale ha aiutato qualcuno».</p>` : ""}</div>
      <details class="cru-box" style="margin-top:14px" ${mancano && mancano < d.pronto.length ? "" : ""}><summary style="cursor:pointer;font-weight:700;color:var(--notte)">Pronto per il pubblico? ${mancano ? `Mancano ${mancano} passi su ${d.pronto.length}` : "Sì, tutto fatto"}</summary>
        <ul class="regole" style="list-style:none;padding-left:0">${d.pronto.map(([t, ok]) => `<li>${ok ? "✅" : "⬜"} ${esc(t)}</li>`).join("")}</ul></details>`;
  }
  if (scheda === "conteggi") h += vistaConteggi();
  if (scheda === "solleciti"){
    if (!sollecitiAdm){ h += '<div class="vuoto">Caricamento…</div>'; $("admCorpo").innerHTML = h; call("solleciti").then(r => { sollecitiAdm = r.ok ? r.data.solleciti : []; disegna(); }); return; }
    h += vistaSolleciti();
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
      <p class="hint" style="margin:2px 0 4px">${l.length} di ${clientiAdm.length} clienti · tocca un cliente per aprire la scheda · <button type="button" class="linkbtn" data-stampa-cli-elenco>Stampa elenco</button> · <button type="button" class="linkbtn" data-csv="clienti">Esporta per Excel</button></p>
      <div class="lista">${l.slice(0, 300).map(c => `<button type="button" class="riga-cli" data-scheda="${esc(c.univoco)}"><span><span class="nome">${esc(c.nome)}</span><span class="cod">${esc(c.univoco)} · ${esc(c.caf)} · ${esc(c.ottica)}</span></span>
        <span class="bad">${c.bloccato ? '<span class="chip s3">BLOCCATO</span>' : ""}${c.moroso ? '<span class="chip s3">MOROSO</span>' : ""}${c.inScadenza ? '<span class="chip s2">IN SCADENZA</span>' : ""}<span class="chip">${esc(c.stato)}</span></span></button>`).join("") || '<div class="vuoto">Nessun cliente con questi filtri</div>'}</div>`;
  }
  if (scheda === "caf"){
    h += `<form data-f="salvaCaf" class="scheda"><b>Nuovo CAF o modifica</b>
      <label class="lbl" for="aCafId">Codice CAF</label><input id="aCafId" name="ID" required style="text-transform:uppercase">
      <label class="lbl" for="aCafNome">Nome</label><input id="aCafNome" name="Nome">
      <label class="lbl" for="aCafPw">Password (almeno 8 caratteri; vuota = non cambiare)</label><input id="aCafPw" name="Password" type="text" autocomplete="off">
      ${campiCompenso("aCaf", "caf")}
      <button type="submit" class="verde full">Salva CAF</button></form>
      <div class="lista">${d.caf.map(c => `<div class="cli"><div class="top"><div><b>${esc(c.ID)}</b> ${esc(c.Nome)}${c.prova ? ' <span class="chip">PROVA</span>' : ""}</div></div>${contiHtml(c, "caf")}
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
      ${campiCompenso("aO", "ottica")}
      <button type="submit" class="verde full">Salva ottica</button></form>
      <div class="lista">${d.ottici.map(o => `<div class="cli"><div class="top"><div><b>${esc(o.ID)}</b> ${esc(o.Intestatario)}${o.prova ? ' <span class="chip">PROVA</span>' : ""}</div>${o.accesso ? '<span class="chip s4">ACCESSO ATTIVO</span>' : '<span class="chip s3">SENZA PASSWORD</span>'}</div>
        <div>${esc(o.Indirizzo)}${esc(o.Citta)} · listino ${esc(o.Listino)}${o.Telefono ? " · " + esc(o.Telefono) : ""}</div>
        <div>Montature esposte: <b>${d.montature.filter(m => !m.archiviata).reduce((t, m) => t + (m.giacenze[o.ID] || 0), 0)}</b> pezzi · <button type="button" class="linkbtn" data-esposte="${esc(o.ID)}">vedi</button></div>${contiHtml(o, "ottico")}
        <div class="az"><button type="button" class="grigio" data-mod-ott="${esc(o.ID)}">Modifica</button><button type="button" class="grigio" data-elimina="ottico" data-id="${esc(o.ID)}">Elimina</button></div></div>`).join("")}</div>`;
  }
  if (scheda === "magazzino") h += vistaMagazzino();
  if (scheda === "listini") h += vistaListini();
  if (scheda === "registro") h += vistaRegistro();
  if (scheda === "fornitori") h += vistaFornitori();
  if (scheda === "impostazioni"){
    const t = d.titolare || {}, cn = d.canali || {}, cs = d.canaleSolleciti;
    const stato = k => cn[k] ? '<span class="chip s4">COLLEGATO</span>' : '<span class="chip s3">NON COLLEGATO</span>';
    const lb = d.laboratorio || {};
    h += `<form data-f="linkRecensioni" class="scheda"><b>Recensioni su Google</b><p class="hint" style="margin:4px 0">A chi dà 4 o 5 stelle proponiamo di scriverlo anche su Google. Incolla il link «Chiedi recensioni» della tua scheda Google Business.</p>
      <input name="link" type="url" placeholder="https://g.page/r/…" value="${esc((d.servizio || {}).linkRecensioni)}" style="width:100%"><button type="submit" class="full">Salva link</button></form>`;
    h += `<form data-f="salvaLab" class="scheda"><b>Laboratorio</b> ${lb.attivo ? '<span class="chip s4">ATTIVO</span>' : '<span class="chip">NON ATTIVO</span>'}
      <p class="hint" style="margin:4px 0">Quando è attivo, ogni ordine pagato diventa una busta di lavoro per il laboratorio, che la vede su <b>${esc(location.origin)}/laboratorio</b> e segna l'occhiale pronto (il cliente viene avvisato). ${lb.attivo ? `Ora: ${lb.daFare} da fare, ${lb.inLavorazione} in lavorazione, ${lb.daRitirare} montature da ritirare in ottica.` : ""}</p>
      <label class="lbl" for="lbN">Nome</label><input id="lbN" name="nome" value="${esc(lb.nome)}">
      <label class="lbl" for="lbI">Indirizzo</label><input id="lbI" name="indirizzo" value="${esc(lb.indirizzo)}">
      <div class="riga"><div style="flex:1"><label class="lbl" for="lbT">Telefono</label><input id="lbT" name="telefono" value="${esc(lb.telefono)}"></div><div style="flex:1"><label class="lbl" for="lbE">Email</label><input id="lbE" name="email" type="email" value="${esc(lb.email)}"></div></div>
      <label class="lbl" for="lbP">Password di accesso del laboratorio (almeno 8; vuota = non cambiare)</label><input id="lbP" name="password" type="text" autocomplete="off" placeholder="${lb.password ? "già impostata" : ""}">
      <label class="gdpr"><input type="checkbox" name="attivo" ${lb.attivo ? "checked" : ""}> Laboratorio attivo</label>
      <button type="submit" class="verde full">Salva laboratorio</button></form>`;
    h += `<div class="scheda"><b>Messaggi automatici ai clienti</b>
      <p style="margin:4px 0">Partono da soli con il canale scelto: <b>occhiali pronti</b> (quando il laboratorio o l'ottica segna pronto) e <b>canoni non pagati</b> (conto alla rovescia a 30, 20, 10, 5, 3 e 1 giorno dalla chiusura, più quello di chiusura).</p>
      <div role="radiogroup" aria-label="Canale" style="display:grid;gap:6px;margin:6px 0">
        <label style="display:flex;align-items:center;gap:8px;text-align:left;font-size:15px;cursor:pointer"><input type="radio" style="width:auto;margin:0;box-shadow:none" name="canaleSoll" value="whatsapp" ${cs === "whatsapp" ? "checked" : ""}> WhatsApp ${stato("whatsapp")}</label>
        <label style="display:flex;align-items:center;gap:8px;text-align:left;font-size:15px;cursor:pointer"><input type="radio" style="width:auto;margin:0;box-shadow:none" name="canaleSoll" value="sms" ${cs === "sms" ? "checked" : ""}> SMS ${stato("sms")}</label>
        <label style="display:flex;align-items:center;gap:8px;text-align:left;font-size:15px;cursor:pointer"><input type="radio" style="width:auto;margin:0;box-shadow:none" name="canaleSoll" value="spento" ${cs === "spento" ? "checked" : ""}> Nessun invio automatico (li mandi tu dall'elenco Solleciti)</label></div>
      ${cs !== "spento" && !cn[cs] ? `<p class="hint" style="margin:4px 0">Il canale scelto non è ancora collegato: finché non lo è, i solleciti restano pronti nell'elenco <b>Solleciti</b> e l'avviso «occhiali pronti» lo manda l'ottica con un tocco su WhatsApp.</p>` : ""}</div>`;
    h += `<form data-f="provaMessaggio" class="scheda"><b>Prova dei messaggi automatici</b><p class="hint" style="margin:4px 0">Manda un messaggio di prova al tuo cellulare con il canale scelto sopra. WhatsApp: ${cn.whatsapp ? "collegato" : "non collegato"} · SMS: ${cn.sms ? "collegato" : "non collegato"}.</p>
      <div class="riga"><input name="numero" type="tel" placeholder="Il tuo cellulare" style="flex:1;margin:0" required><button type="submit" style="margin:0">Invia prova</button></div></form>
      <div class="scheda"><b>Copia dei dati</b><p class="hint" style="margin:4px 0">Ogni notte si salva una copia completa (clienti, CAF, ottiche, magazzino, fornitori, segnalazioni). Si tengono le ultime 7. Scaricala e conservala anche fuori dal sito.</p>
      ${(d.copie || []).length ? `<div class="ricevute" style="margin:6px 0">${d.copie.map(c => `<div class="ric"><span><b>${dt(c.data)}</b><small>${Math.round(c.byte / 1024)} KB</small></span><button type="button" class="grigio" data-copia="${esc(c.data)}" style="margin:0">Scarica</button></div>`).join("")}</div>` : '<p class="hint">La prima copia automatica si crea stanotte.</p>'}
      <button type="button" class="full" data-copia="">Scarica una copia adesso</button></div>`;
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
function valoreCompenso(sel){ const v = sel.form && sel.form.elements.CompensoValore; if (!v) return; v.disabled = sel.value === "rata"; v.placeholder = sel.value === "rata" ? "non serve" : sel.value === "percentuale" ? "es. 10" : "es. 3"; if (v.disabled) v.value = ""; }
function riempi(f, o){ for (const [k, v] of Object.entries(o)) if (f.elements[k]) f.elements[k].value = v ?? ""; if (f.elements.CompensoTipo) valoreCompenso(f.elements.CompensoTipo); f.scrollIntoView({behavior: "smooth", block: "start"}); }
document.addEventListener("change", e => { if (e.target.matches && e.target.matches("[data-compenso]")) valoreCompenso(e.target); });
document.addEventListener("change", async e => { if (e.target.matches && e.target.matches("[data-legale]")){ await call("legale", {valore: e.target.checked}); await carica(); msg("Salvato."); } });
async function clic(e){
  const am = e.target.closest("[data-amano]");
  if (am){ const x = (sollecitiAdm || []).find(y => y.univoco === am.dataset.amano); setTimeout(async () => { await call("sollecito", {op: "inviatoAMano", id: am.dataset.amano, canale: "whatsapp", testo: x ? x.testo : ""}); sollecitiAdm = null; disegna(); }, 600); return; }
  const inv = e.target.closest("[data-invia-ord]");
  // email o WhatsApp aperti: l'ordine si segna come inviato
  if (inv){ setTimeout(async () => { const r = await call("ordineFornitore", {op: "invia", id: inv.dataset.inviaOrd}); if (r.ok){ await carica(); msg("Ordine segnato come inviato. Se non l'hai spedito davvero, annullalo e ricrealo."); } }, 400); return; }
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.tab){ scheda = b.dataset.tab; schedaCli = null; if (scheda === "clienti") clientiAdm = null; if (scheda === "solleciti") sollecitiAdm = null; disegna(); return; }
  if (b.dataset.scheda){ const r = await call("scheda", {id: b.dataset.scheda}); if (!r.ok) return msg(r.data.errore || "Errore", "err"); schedaCli = r.data.cliente; disegna(); $("admCorpo").scrollTop = 0; b.blur(); const t = $("admTit"); if (t) t.scrollIntoView({block: "start"}); return; }
  if (b.hasAttribute("data-chiudi-scheda")){ schedaCli = null; disegna(); return; }
  if (b.dataset.modCaf){ riempi(document.querySelector('[data-f="salvaCaf"]'), dati.caf.find(x => x.ID === b.dataset.modCaf)); return; }
  if (b.dataset.modOtt){ riempi(document.querySelector('[data-f="salvaOttico"]'), dati.ottici.find(x => x.ID === b.dataset.modOtt)); return; }
  if (b.dataset.art || b.dataset.artDaForn){ artAperto = b.dataset.art || b.dataset.artDaForn; if (b.dataset.artDaForn) scheda = "magazzino"; disegna(); inCima(); return; }
  if (b.hasAttribute("data-art-nuovo")){ artAperto = "nuovo"; disegna(); inCima(); return; }
  if (b.hasAttribute("data-chiudi-art")){ artAperto = null; disegna(); return; }
  if (b.hasAttribute("data-stampa-mag")) return stampaMagazzino();
  if (b.dataset.segnOk){ const box = b.closest("[data-sg]"), r = await call("segnalazioneRisolta", {id: b.dataset.segnOk, risposta: box.querySelector("[data-risp]").value}); if (!r.ok) return msg(r.data.errore || "Errore", "err"); await carica(); return msg("Segnalazione risolta."); }
  if (b.hasAttribute("data-report")) return apriReport($("repMese").value);
  if (b.dataset.copia !== undefined){ b.disabled = true; const t0 = b.textContent; b.textContent = "Preparo la copia…";
    try { const r = await fetch("api/admin", {method: "POST", headers: {"Content-Type": "application/json", Authorization: "Bearer " + tok}, body: JSON.stringify({azione: "scaricaCopia", data: b.dataset.copia || ""})});
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).errore || "Copia non disponibile.");
      const a = document.createElement("a"); a.href = URL.createObjectURL(await r.blob()); a.download = `copia-socialglass-${b.dataset.copia || new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove();
    } catch(err){ msg(err.message, "err"); } b.disabled = false; b.textContent = t0; return; }
  if (b.hasAttribute("data-reg-cerca")){ registroAdm = null; regQ = $("regQ").value; disegna(); return; }
  if (b.dataset.lisElimina){
    if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = `Confermi? Il listino ${b.dataset.lisElimina} sparisce: tocca di nuovo`; return; }
    const r = await call("eliminaListino", {id: b.dataset.lisElimina}); if (!r.ok){ b.dataset.ok = ""; b.textContent = `Cancella il listino ${b.dataset.lisElimina}`; return msg(r.data.errore || "Errore", "err"); }
    lisSel = "A"; lisBozza = null; await carica(); return msg(`Listino cancellato.${r.data.spostati ? ` ${r.data.spostati} clienti ora usano il listino della loro ottica.` : ""}`); }
  if (b.dataset.lisVai){ lisSel = b.dataset.lisVai; lisBozza = null; disegna(); return; }
  if (b.hasAttribute("data-lis-nuovo")){ const usati = Object.keys(dati.convenzioni || {}), id = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").find(x => !usati.includes(x));
    lisSel = id; lisBozza = JSON.parse(JSON.stringify((dati.convenzioni || {})[usati[0] || "A"] || {montatura: 60, lenti: {}, trattamenti: {}})); lisBozza.nuovo = true; disegna(); return; }
  if (b.dataset.lisAgg){ leggiListino(); lisBozza[b.dataset.lisAgg]["nuovo" + Date.now()] = b.dataset.lisAgg === "lenti" ? {nome: "", desc: "", prezzo: ""} : {nome: "", prezzo: ""}; disegna(); return; }
  if (b.dataset.lisTogli){ leggiListino(); const [g, k] = b.dataset.lisTogli.split(":"); delete lisBozza[g][k]; disegna(); return; }
  if (b.hasAttribute("data-imp-modello")) return csv("modello-importazione-montature", ["Codice", "Modello", "Colore", "Calibro", "Asta", "Prezzo", "Costo", "Fornitore", "Codice fornitore", "Foto", "Quantita", "Dove"], [["SG-2001", "Aurora", "Nero", "52-18", "145", "60", "22", "", "", "", "3", "MAG"]]);
  if (b.hasAttribute("data-imp-vai")) return importaVai(b);
  if (b.hasAttribute("data-vai-servizio")){ const el = $("admServizio"); if (el) el.scrollIntoView({behavior: "smooth", block: "start"}); return; }
  if (b.dataset.recLetta){ const r = await call("recensioneLetta", {id: b.dataset.recLetta}); if (!r.ok) return msg(r.data.errore, "err"); await carica(); return msg("Segnata come gestita."); }
  if (b.hasAttribute("data-donati")){
    if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi? Tocca di nuovo"; return; }
    const r = await call("donati", {ids: (dati.servizio.daDonare || []).map(x => x.univoco)}); if (!r.ok) return msg(r.data.errore, "err"); await carica(); return msg("Occhiali segnati come donati: grazie!"); }
  if (b.dataset.csv === "clienti") return csv("clienti-socialglass", ["Codice", "Cliente", "Codice fiscale", "CAF", "Ottica", "Stato", "Registrato il", "Scadenza", "Abbonamento attivo", "Moroso", "Bloccato", "Esito"],
    clientiVisti.map(c => [c.univoco, c.nome, c.cf, c.caf, c.ottica, c.stato, c.creato ? dt(c.creato) : "", c.scadenza ? dt(c.scadenza) : "", c.abbonamentoAttivo ? "sì" : "no", c.moroso ? "sì" : "no", c.bloccato ? "sì" : "no", c.esito]));
  if (b.dataset.csv === "magazzino") return csv("magazzino-socialglass", ["Codice", "Modello", "Colore", "Calibro", "Asta", "Fornitore", "Codice fornitore", "Disponibili", "Prenotate", "Dove", "Scorta minima", "Costo", "Prezzo", "Stato"],
    magVisti.map(m => [m.Codice, m.Modello, m.Colore, m.Calibro, m.Asse, nomeForn(m.Fornitore), m.CodiceFornitore, m.tot, m.riservate.length, Object.entries(m.giacenze).map(([k, n]) => `${k}:${n}`).join(" "), Number(m.ScortaMinima) || 0, Number(m.Costo) || "", Number(m.Prezzo) || "", m.archiviata ? "archiviata" : m.esaurita ? "esaurita" : m.sottoScorta ? "sotto scorta" : ""]));
  if (b.dataset.conto){ contoAperto = b.dataset.conto; scheda = "conteggi"; disegna(); inCima(); return; }
  if (b.hasAttribute("data-chiudi-conto")){ contoAperto = null; disegna(); return; }
  if (b.dataset.seg){ segConti = b.dataset.seg; disegna(); return; }
  if (b.dataset.copia){ try { await navigator.clipboard.writeText(b.dataset.copia); msg("Link copiato."); } catch(_){ msg("Copia non riuscita: tieni premuto sul link «apri».", "err"); } return; }
  if (b.dataset.stripeAggiorna){ delete stripeStato[b.dataset.stripeAggiorna]; disegna(); return; }
  if (b.dataset.stripeCollega){
    const [tipo, id] = b.dataset.stripeCollega.split(":"); b.disabled = true; b.textContent = "Attendi…";
    const r = await call("stripePartner", {tipo, id, op: "collega"});
    stripeStato[b.dataset.stripeCollega] = r.ok ? {collegato: true, pronto: false, link: r.data.link} : {collegato: false, errore: r.data.errore};
    if (r.ok) await carica(); else disegna(); return;
  }
  if (b.hasAttribute("data-stampa-estratto-adm")) return ST().stampaDoc("Estratto conto con SocialGlass · " + contoAperto.replace(":", " "), ST().pulisciStampa($("estrattoAdm")));
  if (b.dataset.eliminaLiq){
    if (!b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi? Tocca di nuovo"; return; }
    const [tipo, id] = contoAperto.split(":"), r = await call("liquidazione", {tipo, id, op: "elimina", rid: b.dataset.eliminaLiq}); if (!r.ok) return msg(r.data.errore, "err"); await carica(); return msg("Pagamento eliminato.");
  }
  if (b.hasAttribute("data-stampa-soll")) return stampaSolleciti();
  if (b.dataset.sollInvia){ b.disabled = true; const r = await call("sollecito", {op: "invia", id: b.dataset.sollInvia}); sollecitiAdm = null; disegna();
    return r.ok ? msg(r.data.esito && r.data.esito.inviato ? "Messaggio inviato al cliente." : "Messaggio NON inviato: " + ((r.data.esito || {}).motivo || ""), r.data.esito && r.data.esito.inviato ? "" : "err") : msg(r.data.errore, "err"); }
  if (b.dataset.schedaDaSoll){ const r = await call("scheda", {id: b.dataset.schedaDaSoll}); if (!r.ok) return msg(r.data.errore, "err"); scheda = "clienti"; clientiAdm = null; schedaCli = r.data.cliente; disegna(); inCima(); return; }
  if (b.dataset.stampaOrd) return stampaOrdine(b.dataset.stampaOrd);
  if (b.hasAttribute("data-stampa-conti")) return stampaConti();
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
  if (["paP", "paDa", "paA"].includes(t.id)){
    if (t.id === "paP"){ perAdm.p = t.value; if (t.value === "libero"){ $("paDa").hidden = $("paA").hidden = false; return; } } else perAdm[t.id === "paDa" ? "da" : "a"] = t.value;
    if (perAdm.p === "libero" && !(perAdm.da || perAdm.a)) return; carica(); return;
  }
  if (t.name === "canaleSoll"){ call("canaleSolleciti", {canale: t.value}).then(async r => { if (!r.ok) return msg(r.data.errore, "err"); await carica(); msg(t.value === "spento" ? "Invio automatico disattivato." : r.data.collegato ? "Canale salvato." : "Canale salvato. Non è ancora collegato: i messaggi restano da inviare a mano in Solleciti.", r.data.collegato ? "" : "err"); }); return; }
  if (t.hasAttribute("data-formato-qr")){ formatoQr = t.value; try { localStorage.setItem("sg_qr", formatoQr); } catch(_){} document.querySelectorAll("[data-formato-qr]").forEach(x => x.value = formatoQr); return; }
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
  if (k === "pagaStripe"){
    const btn = f.querySelector("button[type=submit]");
    if (!btn.dataset.ok){ btn.dataset.ok = "1"; btn.textContent = `Confermi il pagamento di ${String(v.importo).replace(".", ",")} € con Stripe? Tocca di nuovo`; return; }
    btn.disabled = true; btn.textContent = "Pagamento in corso…";
    const r = await call("stripePartner", Object.assign({tipo: f.dataset.tipo, id: f.dataset.id, op: "paga", token: tokenPaga}, v));
    tokenPaga = Math.random().toString(36).slice(2);
    if (!r.ok){ btn.disabled = false; btn.dataset.ok = ""; btn.textContent = "Paga con Stripe"; return msg(r.data.errore || "Errore", "err"); }
    await carica(); return msg(`Pagamento inviato con Stripe (${r.data.trasferimento}) e registrato nell'estratto conto.`);
  }
  if (k === "provaMessaggio"){ const r = await call("provaMessaggio", v); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    return msg(r.data.inviato ? `Messaggio di prova inviato via ${r.data.canale === "sms" ? "SMS" : "WhatsApp"}: controlla il telefono.` : `Non partito: ${r.data.motivo || "canale non collegato"}.`, r.data.inviato ? "ok" : "err"); }
  if (k === "salvaListino"){ leggiListino(); const c = lisBozza, lista = g => Object.entries(c[g] || {}).map(([id, x]) => Object.assign({id: /^nuovo\d+$/.test(id) ? "" : id}, x));
    const r = await call("salvaListino", {id: lisSel, nuovo: !!c.nuovo, montatura: c.montatura, lenti: lista("lenti"), trattamenti: lista("trattamenti")});
    if (!r.ok) return msg(r.data.errore || "Errore", "err"); lisBozza = null; await carica(); return msg(`Listino ${lisSel} salvato: l'ottico vede subito i nuovi prezzi nei preventivi. I preventivi già fatti non cambiano.`); }
  if (k === "linkRecensioni"){ const r = await call("linkRecensioni", v); if (!r.ok) return msg(r.data.errore || "Errore", "err"); await carica(); return msg("Link salvato."); }
  if (k === "liquidazione"){
    const r = await call("liquidazione", Object.assign({tipo: f.dataset.tipo, id: f.dataset.id}, v)); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    await carica(); return msg("Pagamento registrato: compare anche nell'estratto conto del partner.");
  }
  if (k === "notaSoll"){
    const r = await call("sollecito", {op: "nota", id: f.dataset.id, nota: v.nota}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
    sollecitiAdm = null; disegna(); return msg("Nota salvata.");
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
let magVisti = [], clientiVisti = [], sollecitiAdm = null;
// esporta in CSV (si apre con Excel: separatore punto e virgola, numeri con la virgola)
function csv(nome, intest, righe){
  const cella = v => { let x = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v); if (/^[=+\-@]/.test(x)) x = "'" + x; return /[";\n]/.test(x) ? '"' + x.replace(/"/g, '""') + '"' : x; };
  const testo = "\ufeff" + [intest].concat(righe).map(r => r.map(cella).join(";")).join("\r\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([testo], {type: "text/csv;charset=utf-8"})); a.download = `${nome}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function vistaSolleciti(){
  const l = sollecitiAdm, cn = dati.canali || {}, cs = dati.canaleSolleciti, auto = cs !== "spento" && cn[cs];
  const att = l.filter(x => !x.chiuso), chi = l.filter(x => x.chiuso);
  const card = x => { const wa = `https://wa.me/${String(x.cellulare).replace(/\D/g, "")}?text=${encodeURIComponent(x.testo)}`;
    return `<div class="scheda"><div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><div><b style="font-size:16px">${esc(x.nome)}</b><div class="cod">${esc(x.univoco)} · ${esc(x.cf)}</div></div>
        <div>${x.chiuso ? `<span class="chip s3">CHIUSO ${dt(x.chiuso)}</span>` : `<span class="chip s3">${x.giorni ? `CHIUSURA TRA ${x.giorni} ${x.giorni === 1 ? "GIORNO" : "GIORNI"}` : "CHIUSURA OGGI"}</span>`}</div></div>
      <dl class="dl">${riga("Cellulare", `<a href="tel:${esc(x.cellulare)}">${esc(x.cellulare)}</a>`)}${riga(x.tipo === "riscatto" ? "Riscatto non pagato" : "Canone non pagato", x.importo ? euro(x.importo) + (x.dal ? " dal " + dt(x.dal) : "") : "")}
        ${riga("Tentativi di addebito", x.tentativi ? String(x.tentativi) + (x.prossimoTentativo ? " · prossimo " + dt(x.prossimoTentativo) : " · nessun altro tentativo previsto") : "")}
        ${riga("Abbonamento", `${euro(x.canone)}/mese · ${x.ratePagate} canoni pagati`)}${riga("Occhiale", x.consegnato ? "consegnato" + (x.riscatto ? ` · riscatto ${euro(x.riscatto)}` : "") : "non ancora consegnato")}
        ${riga("CAF", esc(`${x.caf} ${x.cafNome}`))}${riga("Ottica", esc(`${x.ottica} ${x.otticaNome}`) + (x.otticaTel ? ` · <a href="tel:${esc(x.otticaTel)}">${esc(x.otticaTel)}</a>` : ""))}
        ${x.chiuso ? riga("Esito", esc(x.esito)) + riga("Da riportare dal", dt(x.ritiroDal)) : ""}</dl>
      ${x.messaggi.length ? `<div style="font-size:13px"><b>Messaggi al cliente</b>${x.messaggi.slice().reverse().map(m => `<div>${dt(m.il)} · ${esc(m.canale || "")} ${m.passo === "a mano" ? "· inviato a mano" : m.inviato ? "· inviato" : "· <b>non inviato</b> (" + esc(m.motivo || "") + ")"}${m.giorni !== undefined && m.passo !== "a mano" ? ` · ${m.giorni} gg alla chiusura` : ""}</div>`).join("")}</div>` : ""}
      ${x.note.length ? `<div style="font-size:13px;margin-top:4px"><b>Note di sollecito</b>${x.note.slice().reverse().map(n => `<div>${dt(n.il)} · ${esc(n.nota)}</div>`).join("")}</div>` : ""}
      <div class="az" style="margin-top:6px"><a class="btn-link" target="_blank" rel="noopener" href="${esc(wa)}" data-amano="${esc(x.univoco)}">Invia su WhatsApp</a><a class="btn-link" href="tel:${esc(x.cellulare)}">Chiama</a>
        ${x.link ? `<a class="btn-link" target="_blank" rel="noopener" href="${esc(x.link)}">Pagina di pagamento</a>` : ""}${auto && !x.chiuso ? `<button type="button" data-soll-invia="${esc(x.univoco)}">Invia ora via ${cs === "sms" ? "SMS" : "WhatsApp"}</button>` : ""}
        <button type="button" class="grigio" data-scheda-da-soll="${esc(x.univoco)}">Scheda cliente</button></div>
      ${x.chiuso ? "" : `<form data-f="notaSoll" data-id="${esc(x.univoco)}" class="riga" style="align-items:flex-end;margin-top:6px"><div style="flex:1"><label class="lbl" for="ns${esc(x.univoco)}">Annota il sollecito (telefonata, promessa di pagamento…)</label><input id="ns${esc(x.univoco)}" name="nota" maxlength="300"></div><button type="submit" style="margin:0">Salva nota</button></form>`}</div>`; };
  return `<div class="esito ${auto ? "ok" : "err"}" style="display:block">${cs === "spento" ? "Invio automatico al cliente disattivato" : auto ? `Il conto alla rovescia parte da solo via ${cs === "sms" ? "SMS" : "WhatsApp"} (30, 20, 10, 5, 3, 1 giorni).` : `${cs === "sms" ? "SMS" : "WhatsApp"} non ancora collegato`}: ${auto ? "qui sotto vedi l'esito di ogni messaggio." : "invia i messaggi da qui con «Invia su WhatsApp» (testo già pronto)."} <button type="button" class="linkbtn" data-tab="impostazioni">Impostazioni</button></div>
    <div class="riga"><button type="button" data-stampa-soll style="margin:0" ${l.length ? "" : "disabled"}>Stampa elenco solleciti</button></div>
    <h3 style="margin:10px 0 4px">Canoni non pagati (${att.length})</h3>${att.map(card).join("") || '<div class="vuoto">Nessun cliente moroso.</div>'}
    ${chi.length ? `<h3 style="margin:10px 0 4px">Chiusi per mancato pagamento, occhiale da riportare (${chi.length})</h3>${chi.map(card).join("")}` : ""}`;
}
function stampaSolleciti(){
  ST().stampaDoc("Elenco solleciti di pagamento", `<table><tr><th>Cliente</th><th>Cellulare</th><th>Importo</th><th>Dal</th><th class="n">Giorni alla chiusura</th><th>CAF</th><th>Ottica</th><th>Occhiale</th><th>Ultimo messaggio</th><th>Note</th></tr>
    ${sollecitiAdm.map(x => { const m = x.messaggi[x.messaggi.length - 1], n = x.note[x.note.length - 1];
      return `<tr><td>${esc(x.nome)}<br><small>${esc(x.univoco)} · ${esc(x.cf)}</small></td><td>${esc(x.cellulare)}</td><td>${x.importo ? euro(x.importo) : ""}</td><td>${x.dal ? dt(x.dal) : ""}</td><td class="n">${x.chiuso ? "chiuso" : x.giorni}</td>
        <td>${esc(x.caf)}</td><td>${esc(x.ottica)}${x.otticaTel ? "<br><small>" + esc(x.otticaTel) + "</small>" : ""}</td><td>${x.consegnato ? "consegnato" : "non consegnato"}${x.chiuso ? "<br>da riportare" : ""}</td>
        <td>${m ? dt(m.il) + " " + esc(m.canale || "") + (m.inviato ? "" : " (non inviato)") : ""}</td><td>${n ? dt(n.il) + " " + esc(n.nota) : ""}</td></tr>`; }).join("")}</table>`);
}
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
function stampaConti(){
  const corpo = $("admCorpo").cloneNode(true); corpo.querySelectorAll(".esito,.tabs,[role=tablist]").forEach(x => x.remove());
  const blocchi = [...corpo.querySelectorAll(".scheda")].slice(1).map(x => `<div class="scheda">${ST().pulisciStampa(x)}</div>`).join("");
  ST().stampaDoc("Report conteggi con CAF e ottiche", `<p class="hint">Periodo: ${ST().testoPeriodo((dati.caf[0] || dati.ottici[0] || {}).conti || {})}</p>${blocchi}`);
}
function stampaElencoAdm(){
  const F = filtriAdm, filtri = [F.q, F.caf, F.ottica, F.stato, F.sit ? SIT[F.sit][0] : ""].filter(Boolean).join(" · ");
  ST().stampaDoc("Elenco clienti", `${filtri ? `<p class="hint">Filtri: ${esc(filtri)}</p>` : ""}<table><tr><th>Codice</th><th>Cliente</th><th>Codice fiscale</th><th>CAF</th><th>Ottica</th><th>Stato</th><th>Scadenza</th><th>Situazione</th></tr>
    ${clientiVisti.map(c => `<tr><td>${esc(c.univoco)}</td><td>${esc(c.nome)}</td><td>${esc(c.cf)}</td><td>${esc(c.caf)}</td><td>${esc(c.ottica)}</td><td>${esc(c.stato)}</td><td>${c.scadenza ? dt(c.scadenza) : ""}</td>
      <td>${[c.bloccato ? "bloccato" : "", c.moroso ? "moroso" : "", c.chiuso ? "chiuso" : c.abbonamentoAttivo ? "attivo" : ""].filter(Boolean).join(", ")}</td></tr>`).join("")}</table><p class="hint">${clientiVisti.length} clienti.</p>`);
}
let artAperto = null, fornAperto = null, magSel = new Set(), magF = {q: "", forn: "", dove: "", stato: "attive"};
const sedi = () => [["MAG", "Magazzino"], ["LAB", "Laboratorio"]].concat(dati.ottici.map(o => [o.ID, `${o.ID} · ${o.Intestatario}`]));
const nomeSede = id => id === "MAG" ? "Magazzino" : id === "LAB" ? "Laboratorio" : ((dati.ottici.find(o => o.ID === id) || {}).Intestatario ? `${id} · ${dati.ottici.find(o => o.ID === id).Intestatario}` : id);
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
      <button type="button" data-qr-sel style="margin:0" ${magSel.size ? "" : "disabled"}>Stampa QR selezionati (${magSel.size})</button>${selFormatoQr()}
      <button type="button" data-stampa-mag style="margin:0">Stampa report</button><button type="button" class="grigio" data-csv="magazzino" style="margin:0">Esporta per Excel</button></div>
    <details class="scheda" style="margin-top:8px"><summary style="cursor:pointer;font-weight:700">Importa montature da Excel</summary>
      <p class="hint" style="margin:6px 0">Prima riga con le intestazioni: Codice, Modello, Colore, Calibro, Asta, Prezzo, Costo, Fornitore, Codice fornitore, Foto, Quantita, Dove (MAG, LAB o codice ottica). I codici già presenti aggiornano solo i dati (non le quantità).</p>
      <div class="riga"><input type="file" id="impFile" accept=".xlsx,.xls,.csv" style="flex:1;margin:0"><button type="button" class="grigio" data-imp-modello style="margin:0">Scarica il modello</button></div>
      <div id="impAnteprima"></div></details>
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
        ${selFormatoQr()}<button type="button" data-qr="${esc(m.Codice)}" style="margin:0">Stampa QR</button></div></div>
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
      <label class="lbl" for="aMFoto">Foto (link https, facoltativo: compare nel catalogo del cliente)</label><input id="aMFoto" name="Foto" type="url" placeholder="https://…" value="${esc(m.Foto || "")}">
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
// cartellini QR piccoli da appendere all'asta: misure in millimetri, tanti per foglio A4
const FORMATI_QR = {mini: ["Mini 18×24 mm", 18, 13, 6], piccola: ["Piccola 22×30 mm", 22, 16, 7], media: ["Media 30×40 mm", 30, 22, 8.5]};
let formatoQr = "piccola"; try { formatoQr = localStorage.getItem("sg_qr") || "piccola"; } catch(_){}
const selFormatoQr = () => `<select data-formato-qr aria-label="Formato etichette" style="width:auto;margin:0">${Object.entries(FORMATI_QR).map(([k, v]) => `<option value="${k}" ${formatoQr === k ? "selected" : ""}>${v[0]}</option>`).join("")}</select>`;
// i QR si disegnano qui (libreria caricata una volta) e vanno nel foglio come immagini: la stampa non dipende da script esterni
function caricaQrLib(){
  if (window.QRCode) return Promise.resolve();
  return new Promise((ok, ko) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"; sc.onload = ok; sc.onerror = ko; document.head.appendChild(sc); });
}
async function stampa(elenco){
  if (!elenco.length) return msg("Nessuna montatura selezionata.", "err");
  const w = open("", "_blank"); if (!w) return msg("Il browser ha bloccato la finestra di stampa: consenti i popup.", "err");
  w.document.write("<p style='font-family:Arial'>Preparo le etichette…</p>");
  try { await caricaQrLib(); } catch(_){ w.close(); return msg("Non riesco a caricare il generatore di QR: controlla la connessione e riprova.", "err"); }
  const [, larg, qr, pt] = FORMATI_QR[formatoQr] || FORMATI_QR.piccola, img = {};
  for (const x of elenco){
    if (img[x.Codice]) continue;
    const d = document.createElement("div"); new QRCode(d, {text: x.Codice, width: 256, height: 256, correctLevel: QRCode.CorrectLevel.M});
    const c = d.querySelector("canvas"); img[x.Codice] = c ? c.toDataURL("image/png") : (d.querySelector("img") || {}).src;
  }
  const et = []; elenco.forEach(x => { for (let i = 0; i < Math.min(200, x.copie || 1); i++) et.push(x); });
  w.document.open();
  w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Etichette QR SocialGlass</title>
    <style>@page{size:A4;margin:8mm}body{font-family:Arial,sans-serif;margin:0}.g{display:grid;grid-template-columns:repeat(auto-fill,${larg}mm);gap:2mm}
    .c{width:${larg}mm;border:0.2mm dashed #aaa;padding:1.2mm 1.5mm;text-align:center;break-inside:avoid;box-sizing:border-box;overflow:hidden}
    .c img{width:${qr}mm;height:${qr}mm;display:block;margin:0 auto;image-rendering:pixelated}
    .c b{display:block;font-size:${pt}pt;line-height:1.1;margin-top:0.6mm;white-space:nowrap}.c small{display:block;font-size:${pt - 2}pt;line-height:1.1;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}</style></head><body>
    <div class="g">${et.map(x => `<div class="c"><img src="${img[x.Codice]}" alt=""><b>${esc(x.Codice)}</b><small>${esc(x.Calibro)}${x.Colore ? " " + esc(x.Colore) : ""}</small></div>`).join("")}</div>
    <script>window.onload=function(){setTimeout(function(){print()},300)}<\/script></body></html>`);
  w.document.close();
}
window.SG_ADMIN = {apri};
/* ---------- listini: prezzi di lenti, trattamenti e montatura base ---------- */
let lisSel = "A", lisBozza = null;
function leggiListino(){
  const f = document.querySelector('[data-f="salvaListino"]'); if (!f || !lisBozza) return;
  lisBozza.montatura = f.elements.montatura.value;
  for (const g of ["lenti", "trattamenti"]) f.querySelectorAll(`[data-voce^="${g}:"]`).forEach(r => { const k = r.dataset.voce.split(":")[1], x = lisBozza[g][k]; if (!x) return;
    x.nome = r.querySelector("[data-n]").value; x.prezzo = r.querySelector("[data-p]").value; const de = r.querySelector("[data-d]"); if (de) x.desc = de.value; });
}
function vistaListini(){
  const conv = dati.convenzioni || {}, ids = Object.keys(conv);
  if (!conv[lisSel] && !(lisBozza && lisBozza.nuovo)) lisSel = ids[0] || "A";
  if (!lisBozza) lisBozza = JSON.parse(JSON.stringify(conv[lisSel] || {montatura: 60, lenti: {}, trattamenti: {}}));
  const c = lisBozza, usato = dati.ottici.filter(o => (o.Listino || "A") === lisSel).map(o => o.ID);
  const voce = (g, k, x) => `<div class="riga voce-lis" data-voce="${g}:${k}"><input data-n placeholder="Nome" value="${esc(x.nome)}" style="flex:2;margin:0">${g === "lenti" ? `<input data-d placeholder="Descrizione breve" value="${esc(x.desc || "")}" style="flex:2;margin:0">` : ""}
    <input data-p type="number" min="0" step="0.01" placeholder="€" value="${esc(x.prezzo)}" style="width:96px;margin:0"><button type="button" class="grigio" data-lis-togli="${g}:${k}" title="Togli" style="margin:0">✕</button></div>`;
  return `<div class="riga">${ids.map(id => `<button type="button" class="${id === lisSel ? "" : "grigio"}" data-lis-vai="${id}" style="margin:0">Listino ${esc(id)}</button>`).join("")}
      ${c.nuovo ? `<button type="button" style="margin:0">Listino ${esc(lisSel)} (nuovo)</button>` : ""}<button type="button" class="grigio" data-lis-nuovo style="margin:0">+ Nuovo listino</button></div>
    <form data-f="salvaListino" class="scheda" style="margin-top:10px"><b>Listino ${esc(lisSel)}</b> <span class="hint">${usato.length ? "usato da " + usato.map(esc).join(", ") : "non ancora assegnato a nessuna ottica (lo scegli nella scheda dell'ottica)"}</span>
      <p class="hint" style="margin:4px 0 10px">Prezzi IVA inclusa. L'ottico vede solo queste voci quando prepara il preventivo. I preventivi già fatti restano con il prezzo di allora.</p>
      <label class="lbl" for="lisM">Montatura base (se la montatura non ha un prezzo suo)</label><input id="lisM" name="montatura" type="number" min="0" step="0.01" value="${esc(c.montatura)}" style="max-width:160px">
      <h3>Lenti</h3>${Object.entries(c.lenti || {}).map(([k, x]) => voce("lenti", k, x)).join("") || '<p class="hint">Nessuna lente.</p>'}
      <button type="button" class="grigio" data-lis-agg="lenti" style="margin:4px 0 0">+ Aggiungi lente</button>
      <h3>Trattamenti</h3>${Object.entries(c.trattamenti || {}).map(([k, x]) => voce("trattamenti", k, x)).join("") || '<p class="hint">Nessun trattamento.</p>'}
      <button type="button" class="grigio" data-lis-agg="trattamenti" style="margin:4px 0 0">+ Aggiungi trattamento</button>
      <button type="submit" class="verde full" style="margin-top:14px">Salva listino ${esc(lisSel)}</button>
      ${c.nuovo ? "" : `<button type="button" class="grigio full" data-lis-elimina="${esc(lisSel)}" style="margin-top:6px">Cancella il listino ${esc(lisSel)}</button>`}</form>
    <p class="hint">Le lenti con «progressiv» o «multifocal» nel nome chiedono l'addizione nella ricetta.</p>`;
}
/* ---------- registro delle operazioni ---------- */
let registroAdm = null, regQ = "";
function vistaRegistro(){
  if (!registroAdm){ call("registro", {q: regQ}).then(r => { registroAdm = r.ok ? r.data.voci : []; if (scheda === "registro") disegna(); }); return '<div class="vuoto">Caricamento…</div>'; }
  return `<div class="riga"><input id="regQ" placeholder="Cerca per codice cliente, CAF, ottica o operazione" value="${esc(regQ)}" style="flex:1;margin:0"><button type="button" data-reg-cerca style="margin:0">Cerca</button></div>
    <p class="hint">Chi ha bloccato, eliminato, pagato o modificato cosa, e quando. Le voci non si possono cancellare.</p>
    ${registroAdm.length ? `<div class="tab-wrap"><table class="rx tab"><tr><th>Quando</th><th>Chi</th><th>Operazione</th><th>Su</th><th>Dettagli</th></tr>${registroAdm.map(x => `<tr><td>${esc(new Date(x.il).toLocaleString("it-IT", {dateStyle: "short", timeStyle: "short"}))}</td><td>${esc(x.chi)}</td><td>${esc(x.azione)}</td><td>${esc(x.rif)}</td><td>${esc(x.dettaglio)}</td></tr>`).join("")}</table></div>`
      : '<div class="vuoto">Nessuna operazione registrata.</div>'}`;
}
/* ---------- report del mese, stampabile ---------- */
async function apriReport(mese){
  const r = await call("report", {mese}); if (!r.ok) return msg(r.data.errore || "Errore", "err");
  const x = r.data, nomeMese = new Date(x.mese + "-15").toLocaleDateString("it-IT", {month: "long", year: "numeric"});
  const tab = o => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<tr><td>${esc(k)}</td><td style="text-align:right">${n}</td></tr>`).join("") || '<tr><td colspan="2">—</td></tr>';
  const w = window.open("", "_blank"); if (!w) return msg("Il browser ha bloccato la finestra: consenti i popup.", "err");
  w.document.write(`<!DOCTYPE html><html lang="it"><head><meta charset="utf-8"><title>Report SocialGlass · ${esc(nomeMese)}</title><style>body{font-family:system-ui,Arial,sans-serif;margin:28px;color:#111}h1{font-size:22px;margin:0 0 4px}h2{font-size:15px;margin:22px 0 8px}
    .k{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.k div{border:1px solid #ddd;border-radius:10px;padding:10px;font-size:12px;color:#555}.k b{display:block;font-size:20px;color:#111}
    table{border-collapse:collapse;width:100%;font-size:13px}td,th{border:1px solid #ddd;padding:6px 8px;text-align:left}@media print{button{display:none}}</style></head><body>
    <h1>Report di ${esc(nomeMese)}</h1><p style="color:#666;margin:0">SocialGlass · creato il ${new Date().toLocaleString("it-IT")}</p><button onclick="print()" style="margin:12px 0;padding:8px 16px">Stampa o salva PDF</button>
    <h2>Incassi</h2><div class="k"><div>Totale<b>${euro(x.incassi)}</b></div><div>Canoni<b>${euro(x.canoni)}</b></div><div>Spedizioni<b>${euro(x.spedizioni)}</b></div><div>Riscatti<b>${euro(x.riscatti)}</b></div></div>
    <h2>Clienti</h2><div class="k"><div>Nuovi registrati<b>${x.nuovi}</b></div><div>Abbonamenti attivati<b>${x.attivati}</b></div><div>Occhiali consegnati<b>${x.consegnati}</b></div><div>Abbonamenti chiusi<b>${x.chiusi}</b></div>
      <div>Morosi (oggi)<b>${x.morosi}</b></div><div>Recensioni<b>${x.recensioni}${x.recensioni ? " · ★ " + String(x.media).replace(".", ",") : ""}</b></div><div>Segnalazioni<b>${x.segnalazioni}</b></div><div>Portati da amici<b>${x.amici}</b></div></div>
    <h2>Nuovi clienti per CAF</h2><table>${tab(x.perCaf)}</table><h2>Attivazioni per ottica</h2><table>${tab(x.perOttica)}</table>
    <p style="color:#666;font-size:12px;margin-top:20px">Gli incassi includono i canoni stimati per i mesi registrati prima dello storico dei pagamenti. Occhiali donati nel mese: ${x.donati}.</p></body></html>`);
  w.document.close();
}
/* ---------- importazione montature da Excel o CSV ---------- */
let impRighe = [];
const caricaXlsx = () => window.XLSX ? Promise.resolve() : new Promise((ok, ko) => { const s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js"; s.onload = ok; s.onerror = ko; document.head.appendChild(s); });
const COL_IMP = {codice: "Codice", modello: "Modello", colore: "Colore", calibro: "Calibro", asta: "Asse", asse: "Asse", prezzo: "Prezzo", costo: "Costo", fornitore: "Fornitore",
  codicefornitore: "CodiceFornitore", articolofornitore: "CodiceFornitore", foto: "Foto", immagine: "Foto", quantita: "Quantita", qta: "Quantita", pezzi: "Quantita", dove: "Dove", sede: "Dove", note: "Note"};
async function leggiFileImp(file){
  await caricaXlsx();
  const wb = XLSX.read(await file.arrayBuffer(), {type: "array"}), ws = wb.Sheets[wb.SheetNames[0]];
  const righe = XLSX.utils.sheet_to_json(ws, {defval: "", raw: false});
  return righe.map(r => { const o = {}; for (const [k, v] of Object.entries(r)){ const c = COL_IMP[String(k).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "")]; if (c) o[c] = String(v).trim(); } return o; })
    .filter(o => o.Codice);
}
document.addEventListener("change", async e => {
  if (!e.target.matches || !e.target.matches("#impFile")) return;
  const f = e.target.files[0], box = $("impAnteprima"); if (!f) return;
  box.innerHTML = '<p class="hint">Lettura del file…</p>';
  try { impRighe = await leggiFileImp(f); } catch(err){ impRighe = []; box.innerHTML = `<div class="esito err" style="display:block">File non leggibile: usa un file Excel (.xlsx) o CSV con la prima riga di intestazione.</div>`; return; }
  box.innerHTML = impRighe.length ? `<p style="margin:6px 0"><b>${impRighe.length}</b> righe con un codice. Le prime:</p><div class="tab-wrap"><table class="rx tab"><tr><th>Codice</th><th>Modello</th><th>Colore</th><th>Calibro</th><th>Prezzo</th><th>Quantità</th><th>Dove</th></tr>
      ${impRighe.slice(0, 6).map(r => `<tr><td>${esc(r.Codice)}</td><td>${esc(r.Modello || "")}</td><td>${esc(r.Colore || "")}</td><td>${esc(r.Calibro || "")}</td><td>${esc(r.Prezzo || "")}</td><td>${esc(r.Quantita || "")}</td><td>${esc(r.Dove || "MAG")}</td></tr>`).join("")}</table></div>
      <button type="button" class="verde full" data-imp-vai>Importa ${impRighe.length} montature</button>`
    : '<div class="esito err" style="display:block">Nessuna riga con la colonna «Codice». Scarica il modello e usa le stesse intestazioni.</div>';
});
async function importaVai(b){
  b.disabled = true; b.textContent = "Importazione in corso…";
  const r = await call("importaMontature", {righe: impRighe}); if (!r.ok){ b.disabled = false; b.textContent = "Riprova"; return msg(r.data.errore || "Errore", "err"); }
  impRighe = []; await carica();
  msg(`Importazione fatta: ${r.data.nuove} nuove, ${r.data.aggiornate} aggiornate${r.data.scartate.length ? `, ${r.data.scartate.length} scartate (${r.data.scartate.slice(0, 3).join("; ")}${r.data.scartate.length > 3 ? "…" : ""})` : ""}.`, r.data.scartate.length ? "err" : "ok");
}
})();
