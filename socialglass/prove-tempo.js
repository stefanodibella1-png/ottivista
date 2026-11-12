// PROVE TECNICHE — barra del tempo (da togliere prima dell'uscita al pubblico: questo file, il suo <script> in index.html
// e la funzione «tempo» in api/benvenuto.js). Compare solo sulla pagina dei clienti di prova (CAF001, OTT07, OTT12).
(function(){
  let fatta = false;
  const css = `#sgTempo{position:fixed;left:8px;top:calc(8px + env(safe-area-inset-top));z-index:9999;font:14px/1.3 system-ui,sans-serif;max-width:calc(100vw - 16px)}
#sgtP{background:#3b1d00;color:#fff;border:2px solid #ff9800;border-radius:999px;padding:6px 12px;font-weight:700;font-size:13px;min-height:0;box-shadow:0 2px 8px rgba(0,0,0,.3)}
#sgtP b{color:#ffb74d}
#sgTempo .corpo{margin-top:6px;background:#3b1d00;color:#fff;border-radius:12px;padding:10px;box-shadow:0 4px 16px rgba(0,0,0,.4);width:340px;max-width:calc(100vw - 16px)}
#sgTempo .r{display:flex;gap:6px;flex-wrap:wrap}
#sgTempo .corpo button{background:#ff9800;color:#000;border:0;border-radius:8px;padding:8px 10px;font-weight:700;font-size:14px;min-height:38px}
#sgTempo .corpo button.alt{background:#fff3e0}
#sgTempo .corpo button:disabled{opacity:.5}
#sgTempo .es{margin-top:8px;font-size:13px;color:#ffe0b2}
#sgTempo.chiusa .corpo{display:none}`;
  function giorni(n){ return n >= 365 ? `${Math.floor(n / 365)} anno${n >= 730 ? "i" : ""}${n % 365 ? " e " + n % 365 + " g" : ""}` : n + " giorni"; }
  function disegna(){
    const P = window.SG_PROVE, mio = P && P.mio(), t = mio && mio.barraTempo;
    let el = document.getElementById("sgTempo");
    if (!t){ if (el) el.remove(); return; }
    if (!el){
      if (!fatta){ const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s); fatta = true; }
      el = document.createElement("div"); el.id = "sgTempo";
      el.innerHTML = `<button type="button" id="sgtP" title="Barra del tempo (prove tecniche)">⏱ PROVE <b id="sgtG"></b></button>
<div class="corpo"><div class="r">
<button type="button" data-op="avanti" data-g="1">+1 g</button><button type="button" data-op="avanti" data-g="7">+7 g</button><button type="button" data-op="avanti" data-g="30">+30 g</button><button type="button" data-op="avanti" data-g="182">+6 mesi</button><button type="button" data-op="fine">A 20 giorni dalla scadenza</button>
<button type="button" class="alt" data-op="insoluto" data-g="0">Canone non pagato</button><button type="button" class="alt" data-op="paga">Paga il canone</button><button type="button" class="alt" data-op="controllo">Controllo di oggi</button></div>
<div class="es" id="sgtE">Ogni salto esegue anche il controllo del mattino (promemoria, scadenze, solleciti). Tocca l'etichetta per chiudere.</div></div>`;
      el.className = "chiusa"; document.body.appendChild(el);
      el.querySelector("#sgtP").onclick = () => el.classList.toggle("chiusa");
      el.querySelectorAll("button[data-op]").forEach(b => b.onclick = async () => {
        const bt = el.querySelectorAll("button[data-op]"); bt.forEach(x => x.disabled = true); const e = el.querySelector("#sgtE"); e.textContent = "Un momento…";
        const m = window.SG_PROVE.mio(); let r;
        try { const q = await fetch("api/benvenuto", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({azione: "tempo", univoco: m.univoco, op: b.dataset.op, giorni: +b.dataset.g || 0})}); r = {ok: q.ok, data: await q.json().catch(() => ({}))}; }
        catch(_){ r = {ok: false, data: {errore: "Connessione assente."}}; }
        if (r.ok){ e.textContent = `Fatto. ${r.data.esiti && r.data.esiti.length ? "Controllo del mattino: " + r.data.esiti.join(", ") + "." : "Controllo del mattino: niente da fare."}`; await window.SG_PROVE.ricarica(); }
        else e.textContent = (r.data && r.data.errore) || "Non riuscito.";
        bt.forEach(x => x.disabled = false); disegna();
      });
    }
    el.querySelector("#sgtG").textContent = "+" + giorni(t.giorni || 0);
  }
  setInterval(disegna, 1500);
})();
