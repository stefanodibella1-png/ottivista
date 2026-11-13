// SocialGlass · pagina del laboratorio: buste di lavoro degli ordini pagati
(() => {
  const $ = id => document.getElementById(id), app = $("app");
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
  const dt = d => d ? new Date(d).toLocaleDateString("it-IT") : "";
  let token = "", buste = [], filtro = "dafare", cerca = "", sel = new Set(), messaggio = null, apri = "", nomeLab = "Laboratorio";
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
    buste = r.data.buste || []; nomeLab = (r.data.laboratorio || {}).nome || nomeLab;
    if (!messaggio && filtro === "dafare" && buste.some(FILTRI.verifica[1])) filtro = "verifica";
    disegna(); notificheBottone();
  }

  // buste nuove: il laboratorio verifica se ha la montatura (DA VERIFICARE) o la chiede all'ottica (ATTESA MONTATURA)
  const daVerificare = b => b.lab.stato === "DA VERIFICARE", inArrivo = b => b.lab.stato === "ATTESA MONTATURA", inAttesa = b => daVerificare(b) || inArrivo(b);
  const daRitirare = b => !b.lab.verifica && b.lab.fonte !== "LAB" && !b.lab.ritirata && b.lab.stato !== "PRONTO";
  const FILTRI = {
    verifica: ["Da verificare: hai la montatura?", b => daVerificare(b) && !b.chiuso],
    arrivo: ["Montature in arrivo dall'ottica", b => inArrivo(b) && !b.chiuso],
    dafare: ["Da fare", b => b.lab.stato !== "PRONTO" && !inAttesa(b) && !b.chiuso],
    ritiro: ["Montature da ritirare", b => daRitirare(b) && !b.chiuso],
    pronti: ["Pronti (30 giorni)", b => b.lab.stato === "PRONTO" && Date.now() - new Date(b.lab.pronto) < 30 * 864e5],
    tutti: ["Tutte le buste", () => true]
  };
  // montature da ritirare raggruppate per ottica: il giro da fare
  function gruppiRitiro(l){ const g = {}; l.forEach(b => { const k = b.lab.fonte === "MAG" ? "MAG" : b.ottica.id; (g[k] = g[k] || {ottica: b.ottica, mag: b.lab.fonte === "MAG", buste: []}).buste.push(b); }); return Object.values(g); }
  function giroRitiri(l){
    return `<div class="giro"><div style="display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap"><h4>Giro ritiri: ${gruppiRitiro(l).length} ${gruppiRitiro(l).length === 1 ? "tappa" : "tappe"}, ${l.length} montature</h4><button type="button" class="grigio" id="stampaGiro">Stampa giro ritiri</button></div>
      ${gruppiRitiro(l).map(g => `<div style="margin-top:8px"><b>${g.mag ? "Magazzino SocialGlass" : esc(g.ottica.id) + " " + esc(g.ottica.nome)}</b>${!g.mag && g.ottica.indirizzo ? " · " + esc(g.ottica.indirizzo) : ""}${!g.mag && g.ottica.telefono ? ` · <a href="tel:${esc(g.ottica.telefono)}">${esc(g.ottica.telefono)}</a>` : ""}
        <ul>${g.buste.map(b => `<li><b>${esc(b.montatura ? b.montatura.codice : "")}</b> ${esc(b.montatura ? b.montatura.modello + " " + b.montatura.colore : "")} · cliente ${esc(b.univoco)}</li>`).join("")}</ul></div>`).join("")}</div>`;
  }
  function stampaGiro(l){
    const w = window.open("", "_blank"); if (!w){ messaggio = ["Il browser ha bloccato la finestra di stampa: consenti i popup.", "err"]; return disegna(); }
    w.document.write(`<!doctype html><html lang="it"><head><meta charset="utf-8"><title>Giro ritiri · SocialGlass</title><style>@page{margin:12mm}body{font-family:Arial,sans-serif;font-size:11pt}h1{font-size:15pt;color:#0069D9;border-bottom:2px solid #0069D9;padding-bottom:4px}h2{font-size:12pt;margin:14px 0 2px}table{border-collapse:collapse;width:100%;margin-top:4px}th,td{border:1px solid #999;padding:4px 6px;text-align:left}th{background:#eef2f7}</style></head><body>
      <h1>SocialGlass · Giro ritiri montature · ${new Date().toLocaleDateString("it-IT")}</h1>${gruppiRitiro(l).map(g => `<h2>${g.mag ? "Magazzino SocialGlass" : esc(g.ottica.id) + " " + esc(g.ottica.nome)}</h2><div>${g.mag ? "" : esc(g.ottica.indirizzo) + (g.ottica.telefono ? " · tel. " + esc(g.ottica.telefono) : "")}</div>
        <table><tr><th>Montatura</th><th>Modello</th><th>Calibro</th><th>Codice cliente</th><th>Ritirata</th></tr>${g.buste.map(b => { const m = b.montatura || {}; return `<tr><td>${esc(m.codice)}</td><td>${esc(m.modello)} ${esc(m.colore)}</td><td>${esc(m.calibro)}</td><td>${esc(b.univoco)}</td><td style="width:22mm"></td></tr>`; }).join("")}</table>`).join("")}
      <script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`);
    w.document.close();
  }
  const attesa = b => { const g = Math.floor((Date.now() - new Date(b.lab.creato)) / 864e5); return b.lab.stato !== "PRONTO" && !b.chiuso && g >= 4 ? `<span class="chip c-rit">IN ATTESA DA ${g} GIORNI</span>` : ""; };
  function statoChip(b){
    if (b.chiuso && b.lab.stato !== "PRONTO") return '<span class="chip c-rit">ORDINE CHIUSO</span>';
    if (daVerificare(b)) return '<span class="chip c-rit">DA VERIFICARE: HAI LA MONTATURA?</span>' + attesa(b);
    if (inArrivo(b)) return `<span class="chip c-dafare">MONTATURA IN ARRIVO DALL'OTTICA (richiesta il ${dt(b.lab.richiesta)})</span>` + attesa(b);
    return (b.lab.stato === "PRONTO" ? `<span class="chip c-pronto">PRONTO ${dt(b.lab.pronto)}</span>` : b.lab.stato === "IN LAVORAZIONE" ? '<span class="chip c-lav">IN LAVORAZIONE</span>' : '<span class="chip c-dafare">DA FARE</span>')
      + (daRitirare(b) ? `<span class="chip c-rit">MONTATURA DA RITIRARE</span>` : "") + attesa(b);
  }
  const dio = (v, max) => { if (v == null || v === "") return ""; let x = Number(v); if (Math.abs(x) > max && Number.isInteger(x)) x /= 100; return (x > 0 ? "+" : "") + x.toFixed(2).replace(".", ","); };
  function ricetta(r){
    if (!r) return '<p class="msg err">Ricetta mancante: contatta l\'ottica.</p>';
    return `<table class="rx"><tr><th></th><th>Sfero</th><th>Cilindro</th><th>Asse</th><th>Addizione</th></tr>${["OD", "OS"].map(e => { const x = r[e] || {};
      return `<tr><th>${e}</th><td>${dio(x.sf, 30)}</td><td>${dio(x.cil, 10)}</td><td>${x.ax != null ? x.ax + "°" : ""}</td><td>${dio(x.add, 4)}</td></tr>`; }).join("")}</table>
      <p style="margin:6px 0 0">Distanza pupillare: <b>${r.pd ? esc(r.pd) + " mm" : "—"}</b>${r.note ? ` · Note dell'ottico: <b>${esc(r.note)}</b>` : ""}</p>`;
  }
  function dove(b){
    const m = b.montatura || {};
    if (daVerificare(b)) return `<div class="dove ott">Controlla se hai in magazzino la montatura <b>${esc(m.codice)}</b> ${esc(m.modello)} ${esc(m.colore)}. ${b.lab.labHa ? "Secondo il magazzino ne hai una copia." : "Il magazzino non registra copie in laboratorio."} Se c'è, tocca «Montatura disponibile»; se non c'è, «Ritira la montatura dall'ottico».</div>`;
    if (inArrivo(b)) return `<div class="dove ott">Montatura richiesta il ${dt(b.lab.richiesta)} all'ottica ${esc(b.ottica.id)} ${esc(b.ottica.nome)}${b.ottica.telefono ? ` · tel. <a href="tel:${esc(b.ottica.telefono)}">${esc(b.ottica.telefono)}</a>` : ""}: arriva con il corriere, insieme alla scheda del cliente. Quando la ricevi tocca «Montatura arrivata: disponibile».</div>`;
    if (b.lab.verifica && b.lab.fonte !== "LAB" && b.lab.ritirata) return `<div class="dove lab">Montatura arrivata dall'ottica il ${dt(b.lab.ritirata)}.</div>`;
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
      <div class="box"><h4>Ricetta</h4>${inAttesa(b) ? '<p style="margin:0;color:#555">La ricetta si apre quando la montatura è disponibile in laboratorio.</p>' : ricetta(b.ricetta)}</div>
      ${b.lab.note ? `<div class="box"><h4>Note del laboratorio</h4>${esc(b.lab.note)}</div>` : ""}
      ${b.lab.avvisoCliente ? `<div class="box">Avviso «occhiali pronti» al cliente: ${b.lab.avvisoCliente.inviato ? `inviato in automatico (${({sms: "SMS", notifica: "notifica sul telefono"})[b.lab.avvisoCliente.canale] || "WhatsApp"}) il ${dt(b.lab.avvisoCliente.il)}` : "non partito in automatico: lo manda l'ottica"}.</div>` : ""}`;
  }

  // il passo successivo, sempre visibile sulla riga della busta
  function prossimo(b){
    if (b.chiuso || b.lab.stato === "PRONTO" || !b.inLavorazione) return "";
    if (daVerificare(b)) return `<button type="button" class="verde" data-az="disponibile" data-u="${esc(b.univoco)}">Montatura disponibile</button><button type="button" data-az="richiedi" data-u="${esc(b.univoco)}">Ritira la montatura dall'ottico</button>`;
    if (inArrivo(b)) return `<button type="button" class="verde" data-az="disponibile" data-u="${esc(b.univoco)}">Montatura arrivata: disponibile</button>`;
    if (daRitirare(b)) return `<button type="button" data-az="ritirata" data-u="${esc(b.univoco)}">Montatura ritirata</button>`;
    return `<button type="button" class="verde" data-az="pronto" data-u="${esc(b.univoco)}">Occhiale pronto · avvisa il cliente</button>`;
  }
  function disegna(){
    const q = cerca.trim().toUpperCase();
    const conta = k => buste.filter(FILTRI[k][1]).length;
    const l = buste.filter(FILTRI[filtro][1]).filter(b => !q || `${b.univoco} ${b.nome} ${b.cognome} ${b.ottica.id} ${b.ottica.nome} ${b.montatura && b.montatura.codice}`.toUpperCase().includes(q));
    const aperti = new Set([...document.querySelectorAll("details.busta[open]")].map(d => d.dataset.u)); if (apri) aperti.add(apri);
    document.title = (conta("verifica") ? `(${conta("verifica")}) ` : "") + "Laboratorio · SocialGlass";
    const kp = (k, v, t, cl) => `<button type="button" data-f="${k}" class="${filtro === k ? "on " : ""}${cl || ""}"><b>${v}</b>${t}</button>`;
    app.innerHTML = `${messaggio ? `<div class="msg ${messaggio[1]}" role="status">${esc(messaggio[0])}</div>` : ""}
      <div class="kpi">${kp("verifica", conta("verifica"), "Da verificare", conta("verifica") ? "att" : "")}${kp("arrivo", conta("arrivo"), "In arrivo dall'ottica")}${kp("dafare", conta("dafare"), "Da fare")}${conta("ritiro") ? kp("ritiro", conta("ritiro"), "Montature da ritirare", "att") : ""}${kp("pronti", conta("pronti"), "Pronti (30 giorni)", "ok")}${kp("tutti", conta("tutti"), "Tutte le buste")}</div>
      <div class="barra"><input id="cerca" placeholder="Cerca per codice, cliente, ottica o montatura" value="${esc(cerca)}" aria-label="Cerca">
        <div class="az"><button type="button" class="grigio" id="aggiorna">Aggiorna</button><button type="button" id="stampaSel" ${sel.size ? "" : "disabled"}>Stampa buste selezionate (${sel.size})</button></div></div>
      ${l.length ? `<p style="margin:4px 0;color:#666;font-size:13px">${l.length} buste · <button type="button" class="link" id="selTutte">${l.every(b => sel.has(b.univoco)) ? "deseleziona" : "seleziona"} tutte</button></p>` : ""}
      ${filtro === "ritiro" && l.length ? giroRitiri(l) : ""}
      ${l.map(b => `<details class="busta" data-u="${esc(b.univoco)}" ${aperti.has(b.univoco) ? "open" : ""}><summary>
          <div style="display:flex;gap:10px;align-items:center"><input type="checkbox" class="sel" data-sel="${esc(b.univoco)}" ${sel.has(b.univoco) ? "checked" : ""} aria-label="Seleziona ${esc(b.univoco)}" onclick="event.stopPropagation()">
            <div><b>${esc(b.univoco)}</b> · ${esc(b.nome)} ${esc(b.cognome)}<div class="cod">${esc(b.montatura ? b.montatura.codice : "")} · ${esc(b.lenti ? b.lenti.nome : "")} · ottica ${esc(b.ottica.id)}</div></div></div>
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">${statoChip(b)}${prossimo(b)}</div></summary>
        <div class="corpo">${corpoBusta(b)}
          ${!b.chiuso && b.lab.stato !== "PRONTO" && b.inLavorazione && !inAttesa(b) ? `<p style="margin:0;color:#555;font-size:13px">${daRitirare(b) ? "Per segnarlo pronto, prima tocca «Montatura ritirata». " : ""}Con «Occhiale pronto» il cliente riceve in automatico il messaggio (WhatsApp o SMS, come impostato da SocialGlass) e l'ottica viene avvisata.</p>` : ""}
          <div class="az">${!b.chiuso && daRitirare(b) ? `<button type="button" data-az="ritirata" data-u="${esc(b.univoco)}">Montatura ritirata</button>` : ""}
            ${!b.chiuso && b.lab.stato !== "PRONTO" && b.inLavorazione && !inAttesa(b) ? `<button type="button" class="verde" data-az="pronto" data-u="${esc(b.univoco)}" ${daRitirare(b) ? "disabled" : ""}>Occhiale pronto · avvisa il cliente</button>` : ""}
            <button type="button" class="grigio" data-stampa="${esc(b.univoco)}">Stampa busta</button><button type="button" class="grigio" data-nota="${esc(b.univoco)}">Nota</button></div></div></details>`).join("")
        || `<div class="vuoto">Nessuna busta in «${FILTRI[filtro][0]}».</div>`}`;
    const c = $("cerca"); c.oninput = () => { cerca = c.value; const p = c.selectionStart; disegna(); const n = $("cerca"); n.focus(); try { n.setSelectionRange(p, p); } catch(_){} };
    $("aggiorna").onclick = () => location.reload();
    $("stampaSel").onclick = () => stampa(buste.filter(b => sel.has(b.univoco)));
    const sg = $("stampaGiro"); if (sg) sg.onclick = () => stampaGiro(l);
    const st = $("selTutte"); if (st) st.onclick = () => { const tutte = l.every(b => sel.has(b.univoco)); l.forEach(b => tutte ? sel.delete(b.univoco) : sel.add(b.univoco)); disegna(); };
  }

  app.addEventListener("change", e => { const u = e.target.dataset && e.target.dataset.sel; if (u){ e.target.checked ? sel.add(u) : sel.delete(u); const b = $("stampaSel"); b.disabled = !sel.size; b.textContent = `Stampa buste selezionate (${sel.size})`; } });
  app.addEventListener("click", async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.closest("summary")) e.preventDefault();   // il pulsante sulla riga non apre/chiude la busta
    if (b.dataset.f){ filtro = b.dataset.f; messaggio = null; disegna(); return; }
    if (b.dataset.stampa){ stampa(buste.filter(x => x.univoco === b.dataset.stampa)); return; }
    if (b.dataset.nota){
      const x = buste.find(y => y.univoco === b.dataset.nota), n = prompt("Nota per questa busta (la vede anche l'amministratore):", x.lab.note || "");
      if (n === null) return; const r = await api("api/ordine", {method: "POST", body: JSON.stringify({univoco: x.univoco, azione: "nota", nota: n})});
      messaggio = r.ok ? ["Nota salvata.", "ok"] : [r.data.errore || "Errore", "err"]; return carica();
    }
    if (b.dataset.az){
      if (b.dataset.az === "pronto" && !b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi? Il cliente viene avvisato: tocca di nuovo"; return; }
      if (b.dataset.az === "richiedi" && !b.dataset.ok){ b.dataset.ok = "1"; b.textContent = "Confermi? Avvisiamo l'ottica di prepararla per il corriere: tocca di nuovo"; return; }
      b.disabled = true;
      const r = await api("api/ordine", {method: "POST", body: JSON.stringify({univoco: b.dataset.u, azione: b.dataset.az})});
      if (r.status === 401) return esci();
      const av = r.ok && r.data.avviso;
      if (r.ok && b.dataset.az === "disponibile"){ apri = b.dataset.u; filtro = "dafare"; }
      messaggio = r.ok ? [{ritirata: "Montatura segnata come ritirata.", inizia: "Lavorazione iniziata.",
        disponibile: "Montatura disponibile: qui sotto trovi la ricetta, procedi con la lavorazione.",
        richiedi: "L'ottica è stata avvisata: mette da parte la montatura con la scheda per il corriere. Quando arriva tocca «Montatura arrivata: disponibile».",
        pronto: av && /moroso/.test(av.motivo || "") ? "Occhiale pronto: l'ottica è avvisata. Il cliente ha un pagamento in sospeso, quindi non viene invitato al ritiro finché non paga." : av && av.inviato ? `Occhiale pronto: il cliente è stato avvisato in automatico (${({sms: "SMS", notifica: "notifica sul telefono"})[av.canale] || "WhatsApp"}) e l'ottica lo sa.` : "Occhiale pronto: l'ottica è stata avvisata. Il messaggio automatico al cliente non è partito (canale non collegato), lo manda l'ottica."}[b.dataset.az], "ok"] : [r.data.errore || "Errore", "err"];
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

  // notifiche sul computer o sul telefono del laboratorio a ogni nuovo ordine pagato
  const b64 = s => { const p = "=".repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
  async function notificheBottone(){
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !window.Notification) return;
    let attive = false;
    try { const reg = await navigator.serviceWorker.register("sw-sg.js"); attive = Notification.permission === "granted" && !!(await reg.pushManager.getSubscription()); } catch(_){}
    if (attive || $("notif")) return;
    const x = document.createElement("button"); x.type = "button"; x.id = "notif"; x.className = "grigio"; x.style.marginRight = "6px"; x.textContent = "🔔 Attiva notifiche"; $("chi").prepend(x);
    x.onclick = async () => {
      x.disabled = true; x.textContent = "Attendi…";
      try {
        if (await Notification.requestPermission() !== "granted") throw new Error("Permesso negato: riattivalo dalle impostazioni del browser.");
        const v = await api("api/ordine?vapid=1"); if (!v.ok || !v.data.vapid) throw new Error("Notifiche non disponibili ora.");
        const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.subscribe({userVisibleOnly: true, applicationServerKey: b64(v.data.vapid)});
        const r = await api("api/ordine?push=1", {method: "POST", body: JSON.stringify({sub: sub.toJSON()})}); if (!r.ok) throw new Error(r.data.errore || "Non riuscito.");
        x.remove(); messaggio = ["Notifiche attive: ti avvisiamo a ogni nuovo ordine pagato.", "ok"]; disegna();
      } catch(e){ x.disabled = false; x.textContent = "🔔 Attiva notifiche"; messaggio = [e.message, "err"]; disegna(); }
    };
  }

  // aggiornamento automatico ogni 2 minuti, se nessuno sta scrivendo o confermando
  setInterval(async () => {
    if (!token || document.hidden || document.querySelector("[data-ok]") || document.activeElement === $("cerca")) return;
    const r = await api("api/clienti"); if (r.ok){ buste = r.data.buste || []; disegna(); }
  }, 120000);
  token ? carica() : login();
})();
