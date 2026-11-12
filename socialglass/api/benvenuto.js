// Pagina personale del cliente (link ricevuto via SMS o WhatsApp)
const L = require("./_lib");
// indirizzo da cui il cliente sta usando il sito (l'app installata deve restare sullo stesso dominio)
let SITO = () => String(L.CFG.site || "").replace(/\/$/, "");
// PROVE TECNICHE (da togliere prima dell'uscita al pubblico): barra del tempo, solo per i clienti di prova
const diProva = f => L.PROVA.caf.includes(f.CAF) || L.PROVA.ottici.some(o => String(f.Ottica1 || "").startsWith(o + " "));
const barraAttiva = (cfg, f) => !cfg.provaRimossa && cfg.barraTempo !== false && diProva(f);
const indietro = (v, g) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(new Date(v) - g * 864e5).toISOString() : v;
function sposta(x, g){ if (Array.isArray(x)) return x.map(y => sposta(y, g)); if (x && typeof x === "object") for (const k of Object.keys(x)) if (k !== "appuntamento") x[k] = typeof x[k] === "string" ? indietro(x[k], g) : sposta(x[k], g); return x; }
async function tempo(req, res, u, b){
  if (!barraAttiva((await L.DB.meta("config")) || {}, u.f)) return L.send(res, 403, {errore: "La barra del tempo funziona solo con i clienti di prova."});
  const ord = L.parseOrdine(u.f.Ordine), ora = new Date().toISOString(), pg = ord.pagamento;
  let g = Math.round(Number(b.giorni) || 0);
  // «a 20 giorni dalla scadenza»: salta fino al momento della scelta di fine periodo
  if (b.op === "fine"){
    const p = L.PREZZI.periodo(ord);
    if (!p || !p.scadenza || p.chiuso) return L.send(res, 409, {errore: "Serve un abbonamento attivo."});
    g = Math.ceil((new Date(p.scadenza) - Date.now()) / 864e5) - 20;
    if (g < 1) return L.send(res, 409, {errore: "Mancano già meno di 20 giorni alla scadenza."});
    b.op = "avanti";
  }
  const esiti = [];
  if (b.op === "avanti"){
    if (!(g >= 1 && g <= 400)) return L.send(res, 400, {errore: "Da 1 a 400 giorni."});
    // a tappe di 29 giorni al massimo, con il controllo del mattino a ogni tappa: così nessun promemoria viene scavalcato
    let v = u;
    for (let resto = g; resto > 0;){
      const passo = Math.min(29, resto); resto -= passo;
      const o = L.parseOrdine(v.f.Ordine); sposta(o, passo);
      await L.DB.aggiorna(v, {Ordine: JSON.stringify(o), Creato: indietro(v.f.Creato, passo), ProveGiorni: (Number(v.f.ProveGiorni) || 0) + passo});
      v = await L.DB.utente("Univoco", u.f.Univoco); await require("./scadenze").controlla(v, new Date().toISOString(), esiti);
      v = await L.DB.utente("Univoco", u.f.Univoco);
    }
  } else if (b.op === "insoluto"){
    if (!pg || !pg.attivatoIl || pg.chiuso) return L.send(res, 409, {errore: "Serve un abbonamento attivo."});
    pg.insoluto = {tipo: "canone", importo: (ord.prezzi && ord.prezzi.rata) || 0, dal: new Date(Date.now() - Math.max(0, g) * 864e5).toISOString(), tentativi: 1, link: L.linkCliente(u.f.Univoco, String(u.f.Ottica1 || "").split(" - ")[0], u.f.CAF, u.f.Listino)};
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  } else if (b.op === "paga"){
    if (!pg || !pg.insoluto || pg.chiuso) return L.send(res, 409, {errore: "Non c'è un canone da pagare."});
    delete pg.insoluto; pg.ratePagate = (pg.ratePagate || 0) + 1; pg.ultimaRata = ora;
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
  } else if (b.op !== "controllo") return L.send(res, 400, {errore: "Operazione non valida."});
  // subito dopo, il controllo giornaliero solo per questo cliente (promemoria, scadenze, solleciti)
  if (b.op !== "avanti") await require("./scadenze").controlla(await L.DB.utente("Univoco", u.f.Univoco), ora, esiti);
  await L.registra("prove tecniche", "barra del tempo", u.f.Univoco, b.op + (g ? " " + g + " giorni" : "") + (esiti.length ? " → " + esiti.map(e => e.esito || e.errore).join(", ") : ""));
  return L.send(res, 200, {ok: true, esiti: esiti.map(e => e.esito || ("errore: " + e.errore))});
}
module.exports = L.wrap(async (req, res) => {
  if (L.bloccato(req)) return L.send(res, 429, L.TROPPI);
  const url = new URL(req.url, "http://x"), host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
  if (/^[a-z0-9.-]+(:\d+)?$/i.test(host)) SITO = () => `${/^(localhost|127\.)/.test(host) ? "http" : "https"}://${host}`;
  // azioni del cliente dalla sua pagina: notifiche, recensione, occhiale da donare
  if (req.method === "POST"){
    const b = await L.readBody(req), u = await L.DB.utente("Univoco", String(b.univoco || "").trim().toUpperCase());
    if (!u){ L.codiceErrato(req); return L.send(res, 404, {errore: "Cliente non trovato."}); }
    const ord = L.parseOrdine(u.f.Ordine), ora = new Date().toISOString();
    if (b.azione === "push"){
      const s = b.sub || {}; if (!/^https:\/\//.test(s.endpoint || "") || !s.keys || !s.keys.p256dh || !s.keys.auth) return L.send(res, 400, {errore: "Iscrizione non valida."});
      const l = (u.f.Push || []).filter(x => x.endpoint !== s.endpoint).concat([{endpoint: s.endpoint, keys: {p256dh: String(s.keys.p256dh), auth: String(s.keys.auth)}}]).slice(-5);
      await L.DB.aggiorna(u, {Push: l});
      const ok = await L.pushCliente(Object.assign({}, u.f, {Push: [l[l.length - 1]]}), `SocialGlass: ${L.nm(u.f.Nome)}, notifiche attive! Ti scriviamo qui quando c'è una novità sui tuoi occhiali.`, "Notifiche attive");
      return L.send(res, 200, {ok: true, prova: ok});
    }
    if (b.azione === "recensione"){
      const voto = Math.round(Number(b.voto)); if (!(voto >= 1 && voto <= 5)) return L.send(res, 400, {errore: "Scegli da 1 a 5 stelle."});
      if (!ord.consegnatoIl) return L.send(res, 409, {errore: "Potrai lasciare un giudizio dopo il ritiro degli occhiali."});
      if (ord.recensione) return L.send(res, 409, {errore: "Hai già lasciato il tuo giudizio. Grazie!"});
      ord.recensione = {voto, testo: String(b.testo || "").trim().slice(0, 600), il: ora}; ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
      const cfg = (await L.DB.meta("config")) || {};
      return L.send(res, 200, {ok: true, google: voto >= 4 ? (cfg.linkRecensioni || "") : ""});
    }
    if (b.azione === "dona"){
      if (ord.dona && ord.dona.donato) return L.send(res, 409, {errore: "L'occhiale è già stato donato."});
      ord.dona = Object.assign({}, ord.dona, {si: !!b.si, il: ora}); ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); return L.send(res, 200, {ok: true});
    }
    // appuntamento in ottica: il cliente sceglie giorno e ora tra quelli liberi
    if (b.azione === "appuntamento" || b.azione === "annullaAppuntamento"){
      const ott = String(u.f.Ottica1 || "").split(" - ")[0], o = await L.DB.ottico(ott);
      if (!o) return L.send(res, 409, {errore: "Non c'è un'ottica collegata al tuo codice: contatta il CAF."});
      const ag = (await L.DB.meta("agenda-" + ott)) || {}, prima = ord.appuntamento && ord.appuntamento.il;
      if (b.azione === "annullaAppuntamento"){
        if (prima && ag[prima] && ag[prima].u === u.f.Univoco) await L.DB.meta("agenda-" + ott, {[prima]: null});
        delete ord.appuntamento; ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)}); return L.send(res, 200, {ok: true});
      }
      const quando = String(b.quando || ""), tipo = L.TIPI_APP[b.tipo] ? b.tipo : "altro";
      const libero = L.slotLiberi(o, ag).some(g => g.data === quando.slice(0, 10) && g.slot.includes(quando.slice(11)));
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(quando) || !libero) return L.send(res, 409, {errore: "Questo orario non è più libero: scegline un altro."});
      await L.DB.meta("agenda-" + ott, Object.assign({[quando]: {u: u.f.Univoco, t: tipo, n: `${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)}`.trim(), il: ora}},
        prima && prima !== quando && ag[prima] && ag[prima].u === u.f.Univoco ? {[prima]: null} : {}));
      ord.appuntamento = {il: quando, tipo, creato: ora}; ord.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
      return L.send(res, 200, {ok: true, appuntamento: ord.appuntamento});
    }
    // segnalo un problema (con foto facoltativa): la vedono l'ottica e SocialGlass
    if (b.azione === "segnala"){
      const testo = String(b.testo || "").trim().slice(0, 600), foto = String(b.foto || "");
      if (testo.length < 5) return L.send(res, 400, {errore: "Scrivi in breve qual è il problema."});
      if (foto && (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(foto) || foto.length > 600000)) return L.send(res, 400, {errore: "Foto non valida o troppo grande."});
      const aperte = (ord.segnalazioni || []).filter(x => x.stato === "aperta");
      if (aperte.length >= 3) return L.send(res, 429, {errore: "Hai già 3 segnalazioni aperte: l'ottica ti contatta a breve."});
      const id = "SEG" + ora.replace(/\D/g, "").slice(2, 14) + u.f.Univoco.slice(-4), ott = String(u.f.Ottica1 || "").split(" - ")[0];
      await L.DB.salva("segn", id, {ID: id, il: ora, univoco: u.f.Univoco, nome: `${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)}`.trim(), cellulare: u.f.Cellulare || "", ottica: ott, testo, foto, stato: "aperta"});
      ord.segnalazioni = (ord.segnalazioni || []).concat([{id, il: ora, testo: testo.slice(0, 120), stato: "aperta"}]).slice(-10); ord.aggiornato = ora;
      await L.DB.aggiorna(u, {Ordine: JSON.stringify(ord)});
      return L.send(res, 200, {ok: true, id});
    }
    if (b.azione === "tempo") return tempo(req, res, u, b);
    return L.send(res, 400, {errore: "Operazione non valida."});
  }
  // orari liberi per l'appuntamento e montature esposte nella sua ottica
  if (url.searchParams.get("slot") || url.searchParams.get("catalogo")){
    const u = await L.DB.utente("Univoco", String(url.searchParams.get("univoco") || "").trim().toUpperCase());
    if (!u){ L.codiceErrato(req); return L.send(res, 404, {errore: "Cliente non trovato."}); }
    const ott = String(u.f.Ottica1 || "").split(" - ")[0] || url.searchParams.get("espositore") || "", o = await L.DB.ottico(ott);
    if (url.searchParams.get("slot")) return L.send(res, 200, {giorni: o ? L.slotLiberi(o, (await L.DB.meta("agenda-" + ott)) || {}) : [], ottica: o ? o.Intestatario : ""});
    const esposte = (await L.DB.lista("mont")).filter(m => !m.Eliminata).map(m => { const {g} = L.scorte(m);
      return {codice: m.Codice || m._id, modello: m.Modello || "", colore: m.Colore || "", calibro: m.Calibro || "", asse: m.Asse || "", foto: /^https:\/\//.test(m.Foto || "") ? m.Foto : "", qta: g[ott] || 0}; })
      .filter(m => m.qta > 0).sort((a, b) => (a.modello + a.colore).localeCompare(b.modello + b.colore));
    return L.send(res, 200, {montature: esposte, ottica: o ? o.Intestatario : ""});
  }
  // chi ti ha consigliato SocialGlass (link «porta un amico»): solo il nome
  if (url.searchParams.get("amico")){
    const a = await L.DB.utente("Univoco", String(url.searchParams.get("amico")).trim().toUpperCase());
    if (!a){ L.codiceErrato(req); return L.send(res, 404, {errore: "Codice non valido."}); }
    return L.send(res, 200, {nome: String(a.f.Nome || "").charAt(0) + String(a.f.Nome || "").slice(1).toLowerCase(), codice: a.f.Univoco});
  }
  // manifest dell'app installata dal cliente: si apre direttamente sulla sua pagina
  if (url.searchParams.get("manifest")){
    const uv = String(url.searchParams.get("univoco") || "").replace(/[^A-Za-z0-9]/g, "").slice(0, 20);
    res.setHeader("Content-Type", "application/manifest+json; charset=utf-8");
    return res.end(JSON.stringify({name: "SocialGlass", short_name: "SocialGlass", lang: "it", start_url: `${SITO()}/?Univoco=${uv}&app=1`, scope: `${SITO()}/`, id: `${SITO()}/?app=${uv}`, display: "standalone",
      background_color: "#ffffff", theme_color: "#0A1F5C", icons: [{src: `${SITO()}/assets/icon-192.png`, sizes: "192x192", type: "image/png"}, {src: `${SITO()}/assets/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any"}, {src: `${SITO()}/assets/icon-maskable.png`, sizes: "512x512", type: "image/png", purpose: "maskable"}]}));
  }
  const uv = (url.searchParams.get("univoco") || "").trim();
  if (!uv) return L.send(res, 400, {errore: "Codice mancante"});
  const u = await L.DB.utente("Univoco", uv);
  if (!u){ L.codiceErrato(req); return L.send(res, 404, {errore: "Link non valido o scaduto."}); }
  await L.verificaPagamento(u);
  const idOtt = String(u.f.Ottica1 || "").split(" - ")[0] || url.searchParams.get("espositore");
  const o = await L.DB.ottico(idOtt);
  const ord = L.parseOrdine(u.f.Ordine);
  const chiavi = await L.chiaviPush().catch(() => null), cfg = (await L.DB.meta("config")) || {};
  // tracciamento, tessera, porta un amico e riepilogo dell'anno
  const extra = {univoco: u.f.Univoco, vapid: chiavi ? chiavi.pubblica : "", notifiche: (u.f.Push || []).length > 0,
    lab: ord.lab ? {stato: ord.lab.stato, ritirata: !!ord.lab.ritirata, fonte: ord.lab.fonte, pronto: ord.lab.pronto || ""} : null,
    consegnatoIl: ord.consegnatoIl || "", prontoIl: ord.prontoIl || "", recensione: ord.recensione ? {voto: ord.recensione.voto} : null,
    chiediRecensione: !!(ord.consegnatoIl && !ord.recensione && Date.now() - new Date(ord.consegnatoIl) >= 7*864e5), linkRecensioni: cfg.linkRecensioni || "",
    dona: ord.dona ? {si: !!ord.dona.si, donato: ord.dona.donato || "", daDonare: ord.dona.daDonare || ""} : null,
    amici: (ord.amici || []).map(x => ({nome: L.nm(x.nome), il: x.il, stato: x.stato})), linkAmico: `${SITO()}/?amico=${u.f.Univoco}`,
    primaAttivazione: ((ord.storico || [])[0] || {}).inizio || (ord.pagamento && ord.pagamento.attivatoIl) || "", creato: u.f.Creato || "",
    appuntamento: ord.appuntamento && ord.appuntamento.il >= L.oraRoma().slice(0, 10) && !(ord.appuntamento.tipo === "scelta" && ord.montatura) ? Object.assign({descrizione: L.TIPI_APP[ord.appuntamento.tipo] || ""}, ord.appuntamento) : null,
    segnalazioni: (ord.segnalazioni || []).slice(-5).reverse(), haCarta: !!(ord.pagamento && ord.pagamento.cliente && !ord.pagamento.chiuso),
    contratto: ord.pagamento && ord.pagamento.attivatoIl ? {attivatoIl: ord.pagamento.attivatoIl, consensi: ord.consensi || null, caf: u.f.CAF || ""} : null,
    barraTempo: barraAttiva(cfg, u.f) ? {giorni: Number(u.f.ProveGiorni) || 0} : null,
    residenza: !!(u.f.Residenza && u.f.Residenza.cap)};
  L.send(res, 200, {...extra, nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato || "",
    ottico: o ? {id: o.ID, nome: o.Intestatario, indirizzo: o.Indirizzo || "", citta: o.Citta || "", telefono: o.Telefono || ""} : null,
    ordine: {montatura: ord.montatura || null, lenti: ord.lenti || null, trattamenti: ord.trattamenti || [], prezzi: ord.prezzi || null,
      finePeriodo: ord.finePeriodo || null, periodo: L.PREZZI.periodo(ord), rinnovo: ord.rinnovo ? {prosegue: !!(ord.rinnovo.prosegue)} : null,
      ritiro: ord.ritiro || null, storico: (ord.storico || []).length,
      pagamento: ord.pagamento ? {stato: ord.pagamento.stato, attivatoIl: ord.pagamento.attivatoIl, ratePagate: ord.pagamento.ratePagate || 0, insoluto: ord.pagamento.insoluto ? (({tipo, importo, dal, prossimoTentativo, link}) => ({tipo, importo, dal, prossimoTentativo, link, giorni: ord.pagamento.chiuso ? 0 : L.giorniAllaChiusura(ord.pagamento.insoluto)}))(ord.pagamento.insoluto) : null, esito: ord.pagamento.esito || null, chiuso: ord.pagamento.chiuso || null} : null}});
});
