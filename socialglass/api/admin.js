// Pannello amministratore (si apre toccando 7 volte il logo): accessi CAF e ottici, montature, dati di prova, numeri.
// La password si sceglie al primo accesso e si può cambiare dal pannello; è salvata cifrata.
const L = require("./_lib");
const S = L.STATI;
const pulito = (v, n = 120) => String(v == null ? "" : v).trim().slice(0, n);
const gg = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
const numero = v => { const x = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(x) && x >= 0 ? Math.round(x * 100) / 100 : 0; };
// nuovo accordo: vale da oggi; se cambia di nuovo nello stesso giorno si sostituisce quello di oggi
function nuoviAccordi(prima, cp){
  const l = L.accordiDi(prima || {}), oggi = new Date().toISOString().slice(0, 10), ult = l[l.length - 1];
  if (ult && ult.tipo === cp.tipo && Number(ult.valore) === Number(cp.valore)) return l;
  if (!ult && !cp.tipo) return l;
  if (ult && ult.dal === oggi) l.pop();
  l.push({dal: oggi, tipo: cp.tipo, valore: cp.valore});
  return l;
}
function compenso(b){
  const tipo = ["fisso", "percentuale"].includes(b.CompensoTipo) ? b.CompensoTipo : "";
  const valore = numero(b.CompensoValore);
  if (tipo === "percentuale" && valore > 100) return {errore: "La percentuale non può superare 100."};
  return {tipo, valore: tipo ? valore : 0};
}
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  if (L.MODO === "airtable") return L.send(res, 400, {errore: "Il pannello funziona con Firestore."});
  const b = await L.readBody(req), az = b.azione;
  const conf = (await L.DB.meta("admin")) || {};
  if (az === "stato") return L.send(res, 200, {impostata: !!conf.password});
  if (az === "imposta"){
    if (conf.password) return L.send(res, 409, {errore: "La password è già stata scelta."});
    if (String(b.password || "").length < 10) return L.send(res, 400, {errore: "Usa almeno 10 caratteri."});
    await L.DB.meta("admin", {password: L.hashPw(b.password), il: new Date().toISOString()});
    return L.send(res, 200, {token: L.sign({ruolo: "admin", id: "admin"})});
  }
  if (az === "accedi"){
    if (L.tooMany("admin:" + L.ipDi(req), 5)) return L.send(res, 429, {errore: "Troppi tentativi. Riprova tra 10 minuti."});
    if (!conf.password || !L.checkPw(conf.password, b.password)) return L.send(res, 401, {errore: "Password non valida."});
    return L.send(res, 200, {token: L.sign({ruolo: "admin", id: "admin"})});
  }
  if (!L.verify(req, "admin")) return L.send(res, 401, L.NOAUTH);

  if (az === "dati"){
    const [caf, ottLogin, ottici, mont, forn, ordForn, utenti] = await Promise.all(["caf", "ottLogin", "ottici", "mont", "forn", "ordForn"].map(k => L.DB.lista(k)).concat([L.DB.tutti()]));
    const perStato = {}; let attivi = 0, canoni = 0;
    for (const u of utenti){
      perStato[u.f.Stato || "—"] = (perStato[u.f.Stato || "—"] || 0) + 1;
      const o = L.parseOrdine(u.f.Ordine);
      if (o.pagamento && o.pagamento.attivatoIl && !o.pagamento.chiuso){ attivi++; canoni += (o.prezzi && o.prezzi.rata) || 0; }
    }
    const conLogin = new Set(ottLogin.map(x => x.ID || x._id));
    const tit = (await L.DB.meta("titolare")) || {};
    const prova = caf.some(x => L.PROVA.caf.includes(x.ID || x._id)) || ottLogin.some(x => L.PROVA.ottici.includes(x.ID || x._id));
    const vere = k => k.filter(x => !L.PROVA.caf.concat(L.PROVA.ottici).includes(x.ID || x._id)).length;
    const lista = [
      ["Password del pannello scelta", true],
      ["Dati del titolare (privacy e contratto) inseriti", !!(tit.ragione && tit.piva && tit.indirizzo && tit.email)],
      ["Almeno un CAF reale", vere(caf) > 0],
      ["Almeno un'ottica reale con accesso", ottici.some(o => !L.PROVA.ottici.includes(o.ID || o._id) && conLogin.has(o.ID || o._id))],
      ["Montature reali caricate", mont.some(m => !L.PROVA.montature.includes(m.Codice || m._id))],
      ["Dati di prova rimossi", !prova],
      ["Pagamenti Stripe reali (non di prova)", /^sk_live_|^rk_live_/.test(L.CFG.stripeKey)],
      ["Dominio socialglass.it collegato", /socialglass\.it/.test(L.CFG.site) && !/vercel\.app/.test(L.CFG.site)],
      ["Condizioni e informativa privacy verificate da un consulente", !!((await L.DB.meta("config")) || {}).legale],
      ["Avvisi automatici ai clienti collegati (WhatsApp Business o SMS)", L.canaliCollegati().whatsapp || L.canaliCollegati().sms]
    ];
    const comp = x => { const c = x.Compenso || {}; return {CompensoTipo: c.tipo || "", CompensoValore: c.valore || ""}; };
    const diCaf = id => utenti.filter(u => u.f.CAF === id).map(u => u.f), diOtt = id => utenti.filter(u => String(u.f.Ottica1 || "").startsWith(id + " ")).map(u => u.f);
    return L.send(res, 200, {
      caf: caf.map(x => Object.assign({ID: x.ID || x._id, Nome: x.Nome || "", prova: L.PROVA.caf.includes(x.ID || x._id), conti: L.conteggi(diCaf(x.ID || x._id), x, gg(b.da), gg(b.a)), estratto: L.estratto(diCaf(x.ID || x._id), x, gg(b.da), gg(b.a))}, comp(x))),
      ottici: ottici.map(x => Object.assign({ID: x.ID || x._id, Intestatario: x.Intestatario || "", Indirizzo: x.Indirizzo || "", Citta: x.Citta || "", Telefono: x.Telefono || "", Listino: x.Listino || "A", accesso: conLogin.has(x.ID || x._id), prova: L.PROVA.ottici.includes(x.ID || x._id), conti: L.conteggi(diOtt(x.ID || x._id), x, gg(b.da), gg(b.a)), estratto: L.estratto(diOtt(x.ID || x._id), x, gg(b.da), gg(b.a))}, comp(x))),
      montature: mont.map(x => Object.assign({Codice: x.Codice || x._id, Modello: x.Modello || "", Colore: x.Colore || "", Calibro: x.Calibro || "", Asse: x.Asse || "", Prezzo: x.Prezzo || "",
        Costo: x.Costo || "", Fornitore: x.Fornitore || "", CodiceFornitore: x.CodiceFornitore || "", ScortaMinima: x.ScortaMinima || "", RiordinoQta: x.RiordinoQta || "", AvvisoScorta: !!x.AvvisoScorta,
        Note: x.Note || "", Movimenti: (x.Movimenti || []).slice(0, 30), SottoScortaDal: x.SottoScortaDal || ""}, L.infoMont(x))).sort((a, b) => a.Codice.localeCompare(b.Codice)),
      fornitori: forn.map(x => ({ID: x.ID || x._id, Nome: x.Nome || "", Referente: x.Referente || "", Email: x.Email || "", Telefono: x.Telefono || "", Sito: x.Sito || "", Consegna: x.Consegna || "", Note: x.Note || "",
        RiordinoAuto: !!x.RiordinoAuto, proposta: L.proposta(mont, ordForn, x.ID || x._id)})).sort((a, b) => a.Nome.localeCompare(b.Nome)),
      ordiniFornitori: ordForn.map(x => ({ID: x.ID || x._id, Fornitore: x.Fornitore || "", Stato: x.Stato || "BOZZA", Righe: x.Righe || [], Creato: x.Creato || "", Inviato: x.Inviato || "", Ricevuto: x.Ricevuto || "", Auto: !!x.Auto, Note: x.Note || ""}))
        .sort((a, b) => String(b.Creato).localeCompare(String(a.Creato))),
      numeri: {clienti: utenti.length, perStato, abbonamentiAttivi: attivi, canoniMensili: Math.round(canoni * 100) / 100,
        sottoScorta: mont.filter(x => { const i = L.infoMont(x); return i.sottoScorta || i.esaurita; }).filter(x => !x.Eliminata).length,
        morosi: utenti.filter(u => { const pg = L.parseOrdine(u.f.Ordine).pagamento || {}; return pg.insoluto && !pg.chiuso; }).length},
      prova, titolare: tit, pronto: lista, canali: L.canaliCollegati(), canaleSolleciti: (((await L.DB.meta("config")) || {}).canaleSolleciti) || "whatsapp",
      listini: Object.keys(L.PREZZI.LISTINI.convenzioni || {A: 1})
    });
  }
  // pagamenti di SocialGlass al CAF o all'ottica (acconti, saldi): entrano nel loro estratto conto
  if (az === "liquidazione"){
    const k = b.tipo === "caf" ? "caf" : b.tipo === "ottico" ? "ottici" : null, id = pulito(b.id, 20).toUpperCase(); if (!k) return L.send(res, 400, {errore: "Tipo non valido."});
    const acc = k === "caf" ? (await L.DB.lista("caf")).find(x => (x.ID || x._id) === id) : await L.DB.ottico(id); if (!acc) return L.send(res, 404, {errore: "Non trovato."});
    let l = L.liquidazioniDi(acc);
    if (b.op === "elimina") l = l.filter(x => x.id !== b.rid);
    else {
      const imp = numero(b.importo), il = gg(b.data); if (!(imp > 0)) return L.send(res, 400, {errore: "Importo non valido."}); if (!il) return L.send(res, 400, {errore: "Data non valida."});
      l.push({id: require("crypto").randomBytes(4).toString("hex"), il, importo: imp, causale: ["acconto", "saldo", "rettifica"].includes(b.causale) ? b.causale : "acconto",
        metodo: pulito(b.metodo, 40), nota: pulito(b.nota, 200), registrato: new Date().toISOString()});
    }
    await L.DB.salva(k, id, {Liquidazioni: l}); return L.send(res, 200, {ok: true});
  }
  if (az === "canaleSolleciti"){
    const c = ["whatsapp", "sms", "spento"].includes(b.canale) ? b.canale : null; if (!c) return L.send(res, 400, {errore: "Canale non valido."});
    await L.DB.meta("config", {canaleSolleciti: c}); return L.send(res, 200, {ok: true, collegato: c === "spento" || L.canaliCollegati()[c]});
  }
  // elenco solleciti: clienti con un canone non pagato (e chiusi per morosità con l'occhiale ancora da riportare)
  if (az === "solleciti"){
    const tutti = await L.DB.tutti(), ottici = await L.DB.lista("ottici"), cafs = await L.DB.lista("caf"), ora = new Date().toISOString(), out = [];
    for (const {f} of tutti){
      const o = L.parseOrdine(f.Ordine), pg = o.pagamento || {}, ins = pg.insoluto;
      const daRiportare = /MANCATO PAGAMENTO/.test(pg.esito || "") && o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato;
      if (!(ins && !pg.chiuso) && !daRiportare) continue;
      const ottId = String(f.Ottica1 || "").split(" - ")[0], ott = ottici.find(x => (x.ID || x._id) === ottId) || {}, caf = cafs.find(x => (x.ID || x._id) === f.CAF) || {};
      const consegnato = !!o.consegnatoIl || f.Stato === L.STATI.CONSEGNATO, giorni = ins && !pg.chiuso ? L.giorniAllaChiusura(ins, ora) : 0;
      out.push({univoco: f.Univoco, nome: `${f.Nome || ""} ${f.Cognome || ""}`.trim(), cf: f["Codice Fiscale"] || "", cellulare: L.numeroCliente(f), stato: f.Stato || "",
        caf: f.CAF || "", cafNome: caf.Nome || "", ottica: ottId, otticaNome: ott.Intestatario || "", otticaTel: ott.Telefono || "",
        tipo: ins ? ins.tipo : "", importo: ins ? ins.importo : 0, dal: ins ? ins.dal : "", tentativi: ins ? ins.tentativi : 0, prossimoTentativo: ins ? ins.prossimoTentativo : "", link: ins ? ins.link : "",
        giorni, chiuso: pg.chiuso || "", esito: pg.esito || "", consegnato, canone: (o.prezzi || {}).rata || 0, ratePagate: pg.ratePagate || 0, riscatto: (o.prezzi || {}).riscatto || 0,
        messaggi: ins ? (ins.messaggi || []) : [], note: ins ? (ins.note || []) : [], ritiroDal: daRiportare ? o.ritiro.dal : "",
        testo: ins && !pg.chiuso ? L.testoSollecito(f, ins, giorni, consegnato) : `SocialGlass: ${f.Nome || ""}, l'abbonamento è stato chiuso per mancato pagamento: riporta l'occhiale in ottica o contattaci per riscattarlo.`});
    }
    out.sort((a, b) => (a.chiuso ? 1 : 0) - (b.chiuso ? 1 : 0) || a.giorni - b.giorni);
    return L.send(res, 200, {solleciti: out, canali: L.canaliCollegati()});
  }
  if (az === "sollecito"){
    const u = await L.DB.utente("Univoco", pulito(b.id, 20).toUpperCase()); if (!u) return L.send(res, 404, {errore: "Cliente non trovato."});
    const o = L.parseOrdine(u.f.Ordine), pg = o.pagamento || {}, ins = pg.insoluto; if (!ins) return L.send(res, 409, {errore: "Il cliente non ha pagamenti in sospeso."});
    const ora = new Date().toISOString(); let esito = null;
    if (b.op === "nota"){ const n = pulito(b.nota, 300); if (!n) return L.send(res, 400, {errore: "Scrivi cosa hai fatto (es. telefonato, promesso pagamento)."}); ins.note = (ins.note || []).concat([{il: ora, nota: n}]).slice(-30); }
    else if (b.op === "invia"){
      const giorni = L.giorniAllaChiusura(ins, ora), consegnato = !!o.consegnatoIl || u.f.Stato === L.STATI.CONSEGNATO, testo = L.testoSollecito(u.f, ins, giorni, consegnato);
      esito = await L.inviaCliente(u.f, testo, [u.f.Nome || "", Number(ins.importo || 0).toFixed(2).replace(".", ","), String(giorni), consegnato ? "l'occhiale andrà restituito" : "l'ordine sarà annullato", ins.link || L.CFG.site]);
      ins.messaggi = (ins.messaggi || []).concat([Object.assign({il: ora, passo: "manuale", giorni, testo}, esito)]).slice(-20);
    }
    else if (b.op === "inviatoAMano"){ ins.messaggi = (ins.messaggi || []).concat([{il: ora, passo: "a mano", canale: pulito(b.canale, 20) || "whatsapp", inviato: true, testo: pulito(b.testo, 600)}]).slice(-20); }
    else return L.send(res, 400, {errore: "Operazione non valida."});
    o.aggiornato = ora; await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
    return L.send(res, 200, {ok: true, esito});
  }
  if (az === "legale"){ await L.DB.meta("config", {legale: b.valore ? new Date().toISOString() : ""}); return L.send(res, 200, {ok: true}); }
  if (az === "salvaTitolare"){
    const t = {}; for (const k of ["ragione", "piva", "indirizzo", "email", "pec", "telefono"]) t[k] = pulito(b[k], 160);
    if (t.piva && !/^\d{11}$/.test(t.piva.replace(/\D/g, ""))) return L.send(res, 400, {errore: "Partita IVA: 11 cifre."});
    if (t.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t.email)) return L.send(res, 400, {errore: "Email non valida."});
    await L.DB.meta("titolare", t); return L.send(res, 200, {ok: true});
  }
  if (az === "salvaCaf"){
    const id = pulito(b.ID, 20).toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(id)) return L.send(res, 400, {errore: "Codice CAF: 3-20 lettere o cifre."});
    const cp = compenso(b); if (cp.errore) return L.send(res, 400, cp);
    const d = {ID: id, Nome: pulito(b.Nome), Compenso: cp};
    { const prima = (await L.DB.lista("caf")).find(x => (x.ID || x._id) === id); if (prima && !prima.Liquidazioni && L.liquidazioniDi(prima).length) d.Liquidazioni = L.liquidazioniDi(prima); d.Accordi = nuoviAccordi(prima, cp); } if (b.Password){ if (String(b.Password).length < 8) return L.send(res, 400, {errore: "Password di almeno 8 caratteri."}); d.Password = L.hashPw(b.Password); }
    const esiste = (await L.DB.lista("caf")).some(x => (x.ID || x._id) === id);
    if (!esiste && !d.Password) return L.send(res, 400, {errore: "Per un nuovo CAF serve la password."});
    await L.DB.salva("caf", id, d); return L.send(res, 200, {ok: true});
  }
  if (az === "salvaOttico"){
    const id = pulito(b.ID, 20).toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(id)) return L.send(res, 400, {errore: "Codice ottica: 3-20 lettere o cifre."});
    if (!pulito(b.Intestatario)) return L.send(res, 400, {errore: "Serve il nome dell'ottica."});
    const ind = pulito(b.Indirizzo), cp = compenso(b); if (cp.errore) return L.send(res, 400, cp);
    { const prima = await L.DB.ottico(id); if (prima && !prima.Liquidazioni && L.liquidazioniDi(prima).length) await L.DB.salva("ottici", id, {Liquidazioni: L.liquidazioniDi(prima)}); await L.DB.salva("ottici", id, {Accordi: nuoviAccordi(prima, cp)}); }
    await L.DB.salva("ottici", id, {Compenso: cp, ID: id, Intestatario: pulito(b.Intestatario), Indirizzo: ind && !/,\s*$/.test(ind) ? ind + ", " : ind, Citta: pulito(b.Citta, 60), Telefono: pulito(b.Telefono, 20).replace(/[^\d+]/g, ""), Listino: pulito(b.Listino, 4) || "A"});
    if (b.Password){ if (String(b.Password).length < 8) return L.send(res, 400, {errore: "Password di almeno 8 caratteri."}); await L.DB.salva("ottLogin", id, {ID: id, Password: L.hashPw(b.Password)}); }
    return L.send(res, 200, {ok: true});
  }
  if (az === "salvaMontatura"){
    const cod = pulito(b.Codice, 20).toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(cod)) return L.send(res, 400, {errore: "Codice montatura: 3-20 lettere o cifre."});
    const prima = await L.DB.montatura(cod), intero = v => Math.max(0, Math.floor(Number(v) || 0));
    if (prima && b.nuova) return L.send(res, 409, {errore: `Il codice ${cod} esiste già${prima.f.Eliminata ? " (archiviato: ripristinalo dall'archivio)" : ""}.`});
    const d = {Codice: cod, Modello: pulito(b.Modello, 60), Colore: pulito(b.Colore, 40), Calibro: pulito(b.Calibro, 10), Asse: pulito(b.Asse, 10),
      Prezzo: numero(b.Prezzo) || null, Costo: numero(b.Costo) || null, Fornitore: pulito(b.Fornitore, 20), CodiceFornitore: pulito(b.CodiceFornitore, 40),
      ScortaMinima: intero(b.ScortaMinima), RiordinoQta: intero(b.RiordinoQta), AvvisoScorta: !!b.AvvisoScorta, Note: pulito(b.Note, 300)};
    if (!prima){
      // nuovo articolo: carico iniziale nella sede indicata
      const q = intero(b.Quantita), dove = pulito(b.Dove, 20) || L.MAG, g = q ? {[dove]: q} : {};
      Object.assign(d, L.campiScorte(d, g, [], {tipo: "carico iniziale", qta: q, dove}));
    }
    await L.DB.salva("mont", cod, d);
    if (prima){ const f = Object.assign({}, prima.f, d), {g, r} = L.scorte(f); await L.DB.salva("mont", cod, {Stato: L.campiScorte(f, g, r, {}).Stato, SottoScortaDal: L.campiScorte(f, g, r, {}).SottoScortaDal}); }
    return L.send(res, 200, {ok: true});
  }
  // movimenti di magazzino: carico, scarico, trasferimento tra sedi, rettifica inventario
  if (az === "magazzino"){
    const m = await L.DB.montatura(pulito(b.codice, 20).toUpperCase()); if (!m) return L.send(res, 404, {errore: "Montatura non trovata."});
    const q = Math.floor(Number(b.qta)), op = b.op, da = pulito(b.da, 20) || L.MAG, a = pulito(b.a, 20) || L.MAG, nota = pulito(b.nota, 160);
    if (!["carico", "scarico", "trasferisci", "rettifica"].includes(op)) return L.send(res, 400, {errore: "Operazione non valida."});
    if (!(q >= (op === "rettifica" ? 0 : 1)) || q > 9999) return L.send(res, 400, {errore: "Quantità non valida."});
    let errore = "", sotto = null;
    await L.DB.tx("mont", m.id, f => {
      errore = ""; sotto = null; const {g, r} = L.scorte(f);
      if (op === "carico") g[a] = (g[a] || 0) + q;
      if (op === "scarico" || op === "trasferisci"){ if ((g[da] || 0) < q){ errore = `In ${da === L.MAG ? "magazzino" : da} ci sono solo ${g[da] || 0} pezzi.`; return null; } g[da] -= q; if (op === "trasferisci") g[a] = (g[a] || 0) + q; }
      if (op === "rettifica") g[a] = q;
      const out = L.campiScorte(f, g, r, {tipo: op, qta: op === "scarico" ? -q : q, dove: op === "trasferisci" ? `${da} → ${a}` : op === "scarico" ? da : a, nota});
      if (!f.SottoScortaDal && out.SottoScortaDal) sotto = Object.assign({}, f, out);
      return out;
    });
    if (errore) return L.send(res, 409, {errore});
    if (sotto) await L.sottoScorta(sotto).catch(e => console.error(e));
    return L.send(res, 200, {ok: true});
  }
  if (az === "salvaFornitore"){
    const id = pulito(b.ID, 20).toUpperCase(); if (!/^[A-Z0-9_-]{2,20}$/.test(id)) return L.send(res, 400, {errore: "Codice fornitore: 2-20 lettere o cifre."});
    if (!pulito(b.Nome)) return L.send(res, 400, {errore: "Serve il nome del fornitore."});
    const em = pulito(b.Email, 120); if (em && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return L.send(res, 400, {errore: "Email non valida."});
    let sito = pulito(b.Sito, 300); if (sito && !/^https?:\/\//i.test(sito)) sito = "https://" + sito;
    await L.DB.salva("forn", id, {ID: id, Nome: pulito(b.Nome), Referente: pulito(b.Referente, 80), Email: em, Telefono: pulito(b.Telefono, 20).replace(/[^\d+]/g, ""), Sito: sito,
      Consegna: pulito(b.Consegna, 60), Note: pulito(b.Note, 300), RiordinoAuto: !!b.RiordinoAuto});
    if (b.RiordinoAuto) await L.riordinoAuto(id);
    return L.send(res, 200, {ok: true});
  }
  // ordini ai fornitori: bozza (anche automatica) → inviato → ricevuto (carica il magazzino) o annullato
  if (az === "ordineFornitore"){
    const op = b.op, ora = new Date().toISOString();
    const righe = (Array.isArray(b.righe) ? b.righe : []).map(x => ({codice: pulito(x.codice, 20).toUpperCase(), codiceFornitore: pulito(x.codiceFornitore, 40), descrizione: pulito(x.descrizione, 120), qta: Math.max(0, Math.floor(Number(x.qta) || 0)), costo: numero(x.costo)})).filter(x => x.codice && x.qta > 0);
    if (op === "crea"){
      const fo = pulito(b.fornitore, 20).toUpperCase(); if (!(await L.DB.lista("forn")).some(x => (x.ID || x._id) === fo)) return L.send(res, 404, {errore: "Fornitore non trovato."});
      if (!righe.length) return L.send(res, 400, {errore: "L'ordine non ha righe."});
      const id = `RO-${ora.slice(0, 10).replace(/-/g, "")}-${require("crypto").randomBytes(2).toString("hex").toUpperCase()}`;
      await L.DB.salva("ordForn", id, {ID: id, Fornitore: fo, Stato: "BOZZA", Righe: righe, Creato: ora, Aggiornato: ora, Auto: false, Note: pulito(b.note, 300)});
      return L.send(res, 200, {ok: true, id});
    }
    const o = (await L.DB.lista("ordForn")).find(x => (x.ID || x._id) === pulito(b.id, 40)); if (!o) return L.send(res, 404, {errore: "Ordine non trovato."});
    const id = o.ID || o._id;
    if (op === "modifica"){ if (o.Stato !== "BOZZA") return L.send(res, 409, {errore: "Si modificano solo le bozze."}); if (!righe.length) return L.send(res, 400, {errore: "L'ordine non ha righe."}); await L.DB.salva("ordForn", id, {Righe: righe, Aggiornato: ora}); return L.send(res, 200, {ok: true}); }
    if (op === "invia"){ if (o.Stato !== "BOZZA") return L.send(res, 409, {errore: "Ordine già inviato."}); await L.DB.salva("ordForn", id, {Stato: "INVIATO", Inviato: ora, Aggiornato: ora}); return L.send(res, 200, {ok: true}); }
    if (op === "annulla"){ if (o.Stato === "RICEVUTO") return L.send(res, 409, {errore: "Ordine già ricevuto."}); await L.DB.salva("ordForn", id, {Stato: "ANNULLATO", Aggiornato: ora}); return L.send(res, 200, {ok: true}); }
    if (op === "ricevi"){
      if (!["INVIATO", "BOZZA"].includes(o.Stato)) return L.send(res, 409, {errore: "Ordine già chiuso."});
      const dove = pulito(b.dove, 20) || L.MAG, ric = righe.length ? righe : (o.Righe || []), mancanti = [];
      for (const x of ric){
        const m = await L.DB.montatura(x.codice); if (!m){ mancanti.push(x.codice); continue; }
        await L.DB.tx("mont", m.id, f => { const {g, r} = L.scorte(f); g[dove] = (g[dove] || 0) + x.qta; return L.campiScorte(f, g, r, {tipo: "carico da ordine " + id, qta: x.qta, dove}); });
      }
      await L.DB.salva("ordForn", id, {Stato: "RICEVUTO", Ricevuto: ora, Aggiornato: ora, Arrivati: ric});
      return L.send(res, 200, {ok: true, mancanti});
    }
    return L.send(res, 400, {errore: "Operazione non valida."});
  }
  if (az === "clienti"){
    const tutti = await L.DB.tutti();
    return L.send(res, 200, {clienti: tutti.map(({f}) => { const o = L.parseOrdine(f.Ordine), pg = o.pagamento || {}, si = L.situazione(f), per = L.PREZZI.periodo(o);
      return {univoco: f.Univoco, nome: `${f.Nome || ""} ${f.Cognome || ""}`.trim(), cf: f["Codice Fiscale"] || "", caf: f.CAF || "", ottica: String(f.Ottica1 || "").split(" - ")[0],
        stato: f.Stato || "", abbonamentoAttivo: !!(pg.abbonamento && !pg.chiuso), creato: f.Creato || "", moroso: si.moroso, bloccato: si.bloccato,
        scadenza: per && !per.chiuso ? per.scadenza : "", inScadenza: !!(per && !per.chiuso && per.aperto && !per.scaduto), chiuso: !!pg.chiuso, esito: pg.esito || ""}; })
      .sort((a, b) => String(b.creato).localeCompare(String(a.creato)))});
  }
  if (az === "scheda"){
    const u = await L.DB.utente("Univoco", pulito(b.id, 20).toUpperCase()); if (!u) return L.send(res, 404, {errore: "Cliente non trovato."});
    const f = u.f, o = L.parseOrdine(f.Ordine), ott = String(f.Ottica1 || "").split(" - ")[0];
    return L.send(res, 200, {cliente: {univoco: f.Univoco, nome: f.Nome || "", cognome: f.Cognome || "", cf: f["Codice Fiscale"] || "", cellulare: f.Cellulare || "", natoA: f["Nato a"] || "", dataNascita: f["Data Nascita"] || "",
      genere: f.Genere || "", caf: f.CAF || "", ottica: f.Ottica1 || "", listino: f.Listino || "", stato: f.Stato || "", creato: f.Creato || "", ordine: o, periodo: L.PREZZI.periodo(o),
      situazione: L.situazione(f), link: L.linkCliente(f.Univoco, ott, f.CAF, f.Listino)}});
  }
  if (az === "blocco"){
    const u = await L.DB.utente("Univoco", pulito(b.id, 20).toUpperCase()); if (!u) return L.send(res, 404, {errore: "Cliente non trovato."});
    const st = ["bloccato", "sbloccato", "auto"].includes(b.stato) ? b.stato : null; if (!st) return L.send(res, 400, {errore: "Scelta non valida."});
    const motivo = pulito(b.motivo, 300);
    if (st !== "auto" && !motivo) return L.send(res, 400, {errore: st === "bloccato" ? "Scrivi il motivo del blocco." : "Scrivi perché sblocchi l'anagrafica."});
    await L.DB.aggiorna(u, {Blocco: st === "auto" ? null : {stato: st, motivo, il: new Date().toISOString()}});
    return L.send(res, 200, {ok: true, situazione: L.situazione(u.f)});
  }
  if (az === "elimina"){
    const id = pulito(b.id, 20).toUpperCase();
    if (b.tipo === "cliente"){
      const u = await L.DB.utente("Univoco", id); if (!u) return L.send(res, 404, {errore: "Cliente non trovato."});
      const o = L.parseOrdine(u.f.Ordine), pg = o.pagamento || {}, prosegue = o.rinnovo && o.rinnovo.prosegue;
      const abb = (pg.abbonamento && !pg.chiuso) ? pg.abbonamento : (prosegue && prosegue.abbonamento) || "";
      // con un abbonamento attivo si elimina solo chiudendolo, per non lasciare addebiti senza cliente
      if (abb && !b.chiudiAbbonamento) return L.send(res, 409, {errore: "Il cliente ha un abbonamento attivo.", abbonamento: true});
      if (abb && L.CFG.stripeKey){ try { await L.stripeApi("DELETE", `subscriptions/${abb}`); } catch(e){ if (!/No such subscription/i.test(e.message)) return L.send(res, 502, {errore: "Stripe non risponde: riprova tra poco."}); } }
      if (o.montatura && [L.STATI.REGISTRATO, L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato)) await L.liberaMontatura(o.montatura.codice, u.f.Univoco);
      await L.DB.elimina("utenti", u.id);
      return L.send(res, 200, {ok: true, abbonamentoChiuso: !!abb});
    }
    // montatura: si archivia (sparisce da elenchi e QR, le schede clienti restano intatte); si può ripristinare
    if (b.tipo === "montatura"){
      const m = await L.DB.montatura(id); if (!m) return L.send(res, 404, {errore: "Montatura non trovata."});
      const pren = L.scorte(m.f).r.length;
      await L.DB.salva("mont", m.id, {Eliminata: b.ripristina ? null : new Date().toISOString()});
      const f = Object.assign({}, m.f, {Eliminata: b.ripristina ? null : "x"}), {g, r} = L.scorte(f);
      await L.DB.salva("mont", m.id, L.campiScorte(f, g, r, {tipo: b.ripristina ? "ripristinata" : "archiviata", qta: 0, dove: ""}));
      return L.send(res, 200, {ok: true, prenotate: pren});
    }
    if (b.tipo === "fornitore"){
      const n = (await L.DB.lista("mont")).filter(x => x.Fornitore === id && !x.Eliminata).length;
      await L.DB.elimina("forn", id); return L.send(res, 200, {ok: true, articoli: n});
    }
    const k = {caf: "caf", ottico: "ottici"}[b.tipo]; if (!k) return L.send(res, 400, {errore: "Tipo non valido"});
    if (k === "ottici" || k === "caf"){
      // i clienti restano: un'ottica con clienti in corso non si elimina (perderebbero indirizzo e ordini), si toglie solo l'accesso
      const legati = (await L.DB.tutti()).filter(({f}) => k === "caf" ? f.CAF === id : String(f.Ottica1 || "").startsWith(id + " "));
      const inCorso = legati.filter(({f}) => { const pg = L.parseOrdine(f.Ordine).pagamento || {}; return f.Stato !== L.STATI.CONSEGNATO || (pg.abbonamento && !pg.chiuso); });
      if (k === "ottici" && inCorso.length && !b.soloAccesso) return L.send(res, 409, {errore: `L'ottica ha ${inCorso.length} ${inCorso.length === 1 ? "cliente" : "clienti"} con ordini o abbonamenti in corso: puoi togliere solo l'accesso.`, soloAccesso: true});
      if (k === "ottici" && b.soloAccesso){ await L.DB.elimina("ottLogin", id); return L.send(res, 200, {ok: true, soloAccesso: true}); }
      await L.DB.elimina(k, id); if (k === "ottici") await L.DB.elimina("ottLogin", id);
      return L.send(res, 200, {ok: true, clientiRestano: legati.length});
    }
    await L.DB.elimina(k, id);
    return L.send(res, 200, {ok: true});
  }
  if (az === "cambiaPassword"){
    if (String(b.nuova || "").length < 10) return L.send(res, 400, {errore: "Usa almeno 10 caratteri."});
    await L.DB.meta("admin", {password: L.hashPw(b.nuova), il: new Date().toISOString()});
    return L.send(res, 200, {ok: true});
  }
  if (az === "rimuoviProva"){
    // accessi, ottiche e montature libere di prova; clienti creati con gli accessi di prova
    for (const id of L.PROVA.caf) await L.DB.elimina("caf", id);
    for (const id of L.PROVA.ottici){ await L.DB.elimina("ottLogin", id); await L.DB.elimina("ottici", id); }
    for (const c of L.PROVA.montature){ const m = await L.DB.montatura(c); if (m && !L.scorte(m.f).r.length) await L.DB.elimina("mont", c); }
    let n = 0;
    for (const u of await L.DB.tutti()) if (L.PROVA.caf.includes(u.f.CAF) || L.PROVA.ottici.some(o => String(u.f.Ottica1 || "").startsWith(o + " "))){ await L.DB.elimina("utenti", u.id); n++; }
    await L.DB.meta("config", {provaRimossa: new Date().toISOString()});
    return L.send(res, 200, {ok: true, clientiRimossi: n});
  }
  L.send(res, 400, {errore: "Azione non valida"});
});
