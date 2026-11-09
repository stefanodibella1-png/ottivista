// SocialGlass · pagina del laboratorio: buste di lavoro degli ordini pagati
(() => {
  const $ = id => document.getElementById(id), app = $("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const dt = d => d ? new Date(d).toLocaleDateString("it-IT") : "";
  let token = "", buste = [], filtro = "dafare", cerca = "", sel = new Set(), messaggio = null;
  try { token = sessionStorage.getItem("sg_lab") || ""; } catch(_){}

  async function api(path, opz){
    const o = Object.assign({headers: {}}, opz || {});
    o.headers = Object.assign({"Content-Type": "application/json"}, o.headers, token ? {Authorization: "Bearer " + token} : {});
    try { const r = await fetch(path, o); const d = await r.json().catch(() => ({})); return {ok: r.ok, status: r.status, data: d}; }
    catch(e){ return {ok: false, status: 0, data: {errore: "Connessione assente: riprova."}}; }
  }
  const esci = () => { token = ""; try { sessionStorage.removeItem("sg_lab"); } catch(_){} $("chi").innerHTML = ""; login(); };

  function login(err){
    app.innerHTML = `<form class="card login" id="fLogin"><h2 style="margin:0 0 6px">Accesso laboratorio</h2>
      <label for="pw">Password</label><input id="pw" type="password" autocomplete="current-password" required>
      ${err ? `<div class="msg err">${esc(err)}</div>` : ""}<button type="submit" style="margin-top:12px;width:100%">Entra</button></form>`;
    $("fLogin").addEventListener("submit", async e => {
      e.preventDefault();
      const r = await api("api/login", {method: "POST", body: JSON.stringify({ruolo: "lab", codice: "LAB", password: $("pw").value})});
      if (!r.ok) return login(r.data.errore || "Accesso non riuscito.");
      token = r.data.token; try { sessionStorage.setItem("sg_lab", token); } catch(_){}
      carica();
    });
    $("pw").focus();
  }

  async function carica(){
    $("chi").innerHTML = `<button type="button" class="grigio" id="esci">Esci</button>`; $("esci").onclick = esci;
    if (!buste.length) app.innerHTML = '<div class="vuoto">Caricamento…</div>';
    const r = await api("api/clienti");
    if (r.status === 401) return esci();
    if (!r.ok){ app.innerHTML = `<div class="msg err">${esc(r.data.errore || "Errore")}</div>`; return; }
    buste = r.data.buste || []; disegna();
  }

  const daRitirare = b => b.lab.fonte !== "LAB" && !b.lab.ritirata && b.lab.stato !== "PRONTO";
  const FILTRI = {
    dafare: ["Da fare", b => b.lab.stato === "DA FARE" && !b.chiuso],
    lav: ["In lavorazione", b => b.lab.stato === "IN LAVORAZIONE" && !b.chiuso],
    ritiro: ["Montature da ritirare", b => daRitirare(b) && !b.chiuso],
    pronti: ["Pronti (30 giorni)", b => b.lab.stato === "PRONTO" && Date.now() - new Date(b.lab.pronto) < 30 * 864e5],
    tutti: ["Tutti", () => true]
  };
  function statoChip(b){
    if (b.chiuso && b.lab.stato !== "PRONTO") return '<span class="chip c-rit">ORDINE CHIUSO</span>';
    return (b.lab.stato === "PRONTO" ? `<span class="chip c-pronto">PRONTO ${dt(b.lab.pronto)}</span>` : b.lab.stato === "IN LAVORAZIONE" ? '<span class="chip c-lav">IN LAVORAZIONE</span>' : '<span class="chip c-dafare">DA FARE</span>')
      + (daRitirare(b) ? `<span class="chip c-rit">MONTATURA DA RITIRARE</span>` : "");
  }
  const dio = (v, max) => { if (v == null || v === "") return ""; let x = Number(v); if (Math.abs(x) > max && Number.isInteger(x)) x /= 100; return (x > 0 ? "+" : "") + x.toFixed(2).replace(".", ","); };
  function ricetta(r){
    if (!r) return '<p class="msg err">Ricetta mancante: contatta l\'ottica.</p>';
    return `<table class="rx"><tr><th></th><th>Sfero</th><th>Cilindro</th><th>Asse</th><th>Addizione</th></tr>${["OD", "OS"].map(e => { const x = r[e] || {};
      return `<tr><th>${e}</th><td>${dio(x.sf, 30)}</td><td>${dio(x.cil, 10)}</td><td>${x.ax != null ? x.ax + "°" : ""}</td><td>${dio(x.add, 4)}</td></tr>`; }).join("")}</table>
      <p style="margin:6px 0 0">Distanza pupillare: <b>${r.pd ? esc(r.pd) + " mm" : "—"}</b>${r.note ? ` · Note dell'ottico: <b>${esc(r.note)}</b>` : ""}</p>`;
  }
  function dove(b){
    if (b.lab.fonte === "LAB") return `<div class="dove lab">Montatura: usa la copia del laboratorio.</div>`;
    const da = b.lab.fonte === "MAG" ? "dal magazzino SocialGlass" : `presso l'ottica ${esc(b.ottica.id)} ${esc(b.ottica.nome)}${b.ottica.indirizzo ? ", " + esc(b.ottica.indirizzo) : ""}${b.ottica.telefono ? ` · tel. <a href="tel:${esc(b.ottica.telefono)}">${esc(b.ottica.telefono)}</a>` : ""}`;
    return b.lab.ritirata ? `<div class="dove lab">Montatura ritirata il ${dt(b.lab.ritirata)} (${da}).</div>` : `<div class="dove ott">Montatura da ritirare ${da}.</div>`;
  }
  function corpoBusta(b){
    const m = b.montatura || {};
    return `<div class="griglia">
        <div class="box"><h4>Cliente e ottica</h4><dl class="dl"><dt>Codice</dt><dd class="cod" style="font-size:16px;color:#111">${esc(b.univoco)}</dd><dt>Cliente</dt><dd>${esc(b.nome)} ${esc(b.cognome)}</dd>
          <dt>Ottica</dt><dd>${esc(b.ottica.id)} ${esc(b.ottica.nome)}</dd>${b.ottica.indirizzo ? `<dt>Indirizzo</dt><dd>${esc(b.ottica.indirizzo)}</dd>` : ""}<dt>Arrivato</dt><dd>${dt(b.lab.creato)}</dd></dl></div>
        <div class="box"><h4>Montatura</h4><dl class="dl"><dt>Codice</dt><dd>${esc(m.codice)}</dd><dt>Modello</dt><dd>${esc(m.modello)} ${esc(m.colore)}</dd><dt>Calibro</dt><dd>${esc(m.calibro)}${m.asse ? " · asta " + esc(m.asse) : ""}</dd></dl></div>
        <div class="box"><h4>Lenti</h4><dl class="dl"><dt>Tipo</dt><dd>${esc(b.lenti ? b.lenti.nome : "")}</dd><dt>Trattamenti</dt><dd>${esc((b.trattamenti || []).join(", ") || "nessuno")}</dd></dl></div>
      </div>
      ${dove(b)}
      <div class="box"><h4>Ricetta</h4>${ricetta(b.ricetta)}</div>
      ${b.lab.note ? `<div class="box"><h4>Note del laboratorio</h4>${esc(b.lab.note)}</div>` : ""}`;
  }

  function disegna(){
    const q = cerca.trim().toUpperCase();
    const conta = k => buste.filter(FILTRI[k][1]).length;
    const l = buste.filter(FILTRI[filtro][1]).filter(b => !q || `${b.univoco} ${b.nome} ${b.cognome} ${b.ottica.id} ${b.ottica.nome} ${b.montatura && b.montatura.codice}`.toUpperCase().includes(q));
    const aperti = new Set([...document.querySelectorAll("details.busta[open]")].map(d => d.dataset.u));
    app.innerHTML = `${messaggio ? `<div class="msg ${messaggio[1]}" role="status">${esc(messaggio[0])}</div>` : ""}
      <div class="tabs" role="tablist">${Object.entries(FILTRI).map(([k, v]) => `<button type="button" role="tab" data-f="${k}" class="${filtro === k ? "on" : ""}" aria-selected="${filtro === k}">${v[0]} (${conta(k)})</button>`).join("")}</div>
      <div class="barra"><input id="cerca" placeholder="Cerca per codice, cliente, ottica o montatura" value="${esc(cerca)}" aria-label="Cerca">
        <div class="az"><button type="button" class="grigio" id="aggiorna">Aggiorna</button><button type="button" id="stampaSel" ${sel.size ? "" : "disabled"}>Stampa buste selezionate (${sel.size})</button></div></div>
      ${l.length ? `<p style="margin:4px 0;color:#666;font-size:13px">${l.length} buste · <button type="button" class="link" id="selTutte">${l.every(b => sel.has(b.univoco)) ? "deseleziona" : "seleziona"} tutte</button></p>` : ""}
      ${l.map(b => `<details class="busta" data-u="${esc(b.univoco)}" ${aperti.has(b.univoco) ? "open" : ""}><summary>
          <div style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="sel" data-sel="${esc(b.univoco)}" ${sel.has(b.univoco) ? "checked" : ""} aria-label="Seleziona ${esc(b.univoco)}" onclick="event.stopPropagation()">
            <div><b>${esc(b.univoco)}</b> · ${esc(b.nome)} ${esc(b.cognome)}<div class="cod">${esc(b.montatura ? b.montatura.codice : "")} · ${esc(b.lenti ? b.lenti.nome : "")} · ottica ${esc(b.ottica.id)}</div></div></div>
          <div>${statoChip(b)}</div></summary>
        <div class="corpo">${corpoBusta(b)}
          <div class="az">${!b.chiuso && daRitirare(b) ? `<button type="button" data-az="ritirata" data-u="${esc(b.univoco)}">Montatura ritirata</button>` : ""}
            ${!b.chiuso && b.lab.stato === "DA FARE" ? `<button type="button" data-az="inizia" data-u="${esc(b.univoco)}">Inizia lavorazione</button>` : ""}
            ${!b.chiuso && b.lab.stato !== "PRONTO" && b.stato === "ATTIVO" ? `<button type="button" class="verde" data-az="pronto" data-u="${esc(b.univoco)}" ${daRitirare(b) ? "disabled title=\"Prima ritira la montatura\"" : ""}>Occhiale pronto</button>` : ""}
            <button type="button" class="grigio" data-stampa="${esc(b.univoco)}">Stampa busta</button><button type="button" class="grigio" data-nota="${esc(b.univoco)}">Nota</button></div></div></details>`).join("")
        || `<div class="vuoto">Nessuna busta in «${FILTRI[filtro][0]}».</div>`}`;
    const c = $("cerca"); c.oninput = () => { cerca = c.value; const p = c.selectionStart; disegna(); const n = $("cerca"); n.focus(); try { n.setSelectionRange(p, p); } catch(_){} };
    $("aggiorna").onclick = () => { messaggio = null; carica(); };
    $("stampaSel").onclick = () => stampa(buste.filter(b => sel.has(b.univoco)));
    const st = $("selTutte"); if (st) st.onclick = () => { const tutte = l.every(b => sel.has(b.univoco)); l.forEach(b => tutte ? sel.delete(b.univoco) : sel.add(b.univoco)); disegna(); };
  }

  app.addEventListener("change", e => { const u = e.target.dataset && e.target.dataset.sel; if (u){ e.target.checked ? sel.add(u) : sel.delete(u); const b = $("stampaSel"); b.disabled = !sel.size; b.textContent = `Stampa buste selezionate (${sel.size})`; } });
  app.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.f){ filtro = b.dataset.f; messaggio = null; disegna(); return; }
    if (b.dataset.stampa){ stampa(buste.filter(x => x.univoco === b.dataset.stampa)); return; }
    if (b.dataset.nota){
      const x = buste.find(y => y.univoco === b.dataset.nota), n = prompt("Nota per questa busta (la vede anche l'amministratore):", x.lab.note || "");
      if (n === null) return; const r = await api("api/ordine", {method: "POST", body: JSON.stringify({univoco: x.univoco, azione: "nota", nota: n})});
      messaggio = r.ok ? ["Nota salvata.", "ok"] : [r.data.errore || "Errore", "err"]; return carica();
    }
    if (b.dataset.az){
      if (b.dataset.az === "pronto" && !b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi? Il cliente viene avvisato: tocca di nuovo"; return; }
      b.disabled = true;
      const r = await api("api/ordine", {method: "POST", body: JSON.stringify({univoco: b.dataset.u, azione: b.dataset.az})});
      if (r.status === 401) return esci();
      messaggio = r.ok ? [{ritirata: "Montatura segnata come ritirata.", inizia: "Lavorazione iniziata.", pronto: "Occhiale pronto: cliente e ottica sono stati avvisati."}[b.dataset.az], "ok"] : [r.data.errore || "Errore", "err"];
      return carica();
    }
  });

  // busta di lavoro stampabile (una per pagina)
  function stampa(l){
    if (!l.length) return;
    const w = window.open("", "_blank"); if (!w){ messaggio = ["Il browser ha bloccato la finestra di stampa: consenti i popup.", "err"]; return disegna(); }
    w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Buste di lavoro · SocialGlass</title><style>
      @page{margin:12mm}body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#111;margin:0}.pag{page-break-after:always}.pag:last-child{page-break-after:auto}
      header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #0069D9;padding-bottom:4px;margin-bottom:10px}header b{font-size:15pt;color:#0069D9}
      h1{font-size:22pt;margin:4px 0 8px;font-family:"Courier New",monospace}.griglia{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.box{border:1px solid #bbb;border-radius:6px;padding:6px 10px;margin-bottom:8px}.box h4{margin:0 0 4px;font-size:11pt}
      .dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 10px;margin:0}.dl dt{color:#555}.dl dd{margin:0;font-weight:700}table.rx{border-collapse:collapse;width:100%}table.rx th,table.rx td{border:1px solid #888;padding:6px;text-align:center;font-size:13pt}table.rx th{background:#eef2f7}
      .dove{border:2px solid #111;border-radius:6px;padding:6px 10px;font-weight:700;margin-bottom:8px}.firme{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:16px}.firme div{border-top:1px solid #888;padding-top:4px;font-size:9pt;color:#555}a{color:#111;text-decoration:none}
    </style></head><body>${l.map(b => `<div class="pag"><header><b>SocialGlass · Busta di lavoro</b><span>stampata il ${new Date().toLocaleString("it-IT", {dateStyle: "short", timeStyle: "short"})}</span></header>
      <h1>${esc(b.univoco)}</h1>${corpoBusta(b).replace(/class="msg err"/g, 'class="dove"').replace(/class="dove (lab|ott)"/g, 'class="dove"')}
      <div class="firme"><div>Montatura ricevuta</div><div>Lenti montate e controllate</div><div>Spedito all'ottica</div></div></div>`).join("")}
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }

  token ? carica() : login();
})();
