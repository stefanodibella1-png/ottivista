// Pannello amministratore (si apre toccando 7 volte il logo): accessi CAF e ottici, montature, dati di prova, numeri.
// La password si sceglie al primo accesso e si può cambiare dal pannello; è salvata cifrata.
const L = require("./_lib");
const S = L.STATI;
const pulito = (v, n = 120) => String(v == null ? "" : v).trim().slice(0, n);
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
    const [caf, ottLogin, ottici, mont, utenti] = await Promise.all(["caf", "ottLogin", "ottici", "mont"].map(k => L.DB.lista(k)).concat([L.DB.tutti()]));
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
      ["Invio SMS automatico collegato (facoltativo)", !!L.CFG.smsWebhook]
    ];
    return L.send(res, 200, {
      caf: caf.map(x => ({ID: x.ID || x._id, Nome: x.Nome || "", prova: L.PROVA.caf.includes(x.ID || x._id)})),
      ottici: ottici.map(x => ({ID: x.ID || x._id, Intestatario: x.Intestatario || "", Indirizzo: x.Indirizzo || "", Citta: x.Citta || "", Telefono: x.Telefono || "", Listino: x.Listino || "A", accesso: conLogin.has(x.ID || x._id), prova: L.PROVA.ottici.includes(x.ID || x._id)})),
      montature: mont.map(x => ({Codice: x.Codice || x._id, Modello: x.Modello || "", Colore: x.Colore || "", Calibro: x.Calibro || "", Asse: x.Asse || "", Prezzo: x.Prezzo || "", Stato: x.Stato || "DISPONIBILE"})).sort((a, b) => a.Codice.localeCompare(b.Codice)),
      numeri: {clienti: utenti.length, perStato, abbonamentiAttivi: attivi, canoniMensili: Math.round(canoni * 100) / 100},
      prova, titolare: tit, pronto: lista,
      listini: Object.keys(L.PREZZI.LISTINI.convenzioni || {A: 1})
    });
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
    const d = {ID: id, Nome: pulito(b.Nome)}; if (b.Password){ if (String(b.Password).length < 8) return L.send(res, 400, {errore: "Password di almeno 8 caratteri."}); d.Password = L.hashPw(b.Password); }
    const esiste = (await L.DB.lista("caf")).some(x => (x.ID || x._id) === id);
    if (!esiste && !d.Password) return L.send(res, 400, {errore: "Per un nuovo CAF serve la password."});
    await L.DB.salva("caf", id, d); return L.send(res, 200, {ok: true});
  }
  if (az === "salvaOttico"){
    const id = pulito(b.ID, 20).toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(id)) return L.send(res, 400, {errore: "Codice ottica: 3-20 lettere o cifre."});
    if (!pulito(b.Intestatario)) return L.send(res, 400, {errore: "Serve il nome dell'ottica."});
    const ind = pulito(b.Indirizzo);
    await L.DB.salva("ottici", id, {ID: id, Intestatario: pulito(b.Intestatario), Indirizzo: ind && !/,\s*$/.test(ind) ? ind + ", " : ind, Citta: pulito(b.Citta, 60), Telefono: pulito(b.Telefono, 20).replace(/[^\d+]/g, ""), Listino: pulito(b.Listino, 4) || "A"});
    if (b.Password){ if (String(b.Password).length < 8) return L.send(res, 400, {errore: "Password di almeno 8 caratteri."}); await L.DB.salva("ottLogin", id, {ID: id, Password: L.hashPw(b.Password)}); }
    return L.send(res, 200, {ok: true});
  }
  if (az === "salvaMontatura"){
    const cod = pulito(b.Codice, 20).toUpperCase(); if (!/^[A-Z0-9_-]{3,20}$/.test(cod)) return L.send(res, 400, {errore: "Codice montatura: 3-20 lettere o cifre."});
    const st = ["DISPONIBILE", "RISERVATA", "NON DISPONIBILE"].includes(b.Stato) ? b.Stato : "DISPONIBILE";
    await L.DB.salva("mont", cod, {Codice: cod, Modello: pulito(b.Modello, 60), Colore: pulito(b.Colore, 40), Calibro: pulito(b.Calibro, 10), Asse: pulito(b.Asse, 10), Prezzo: Number(b.Prezzo) > 0 ? Number(b.Prezzo) : null, Stato: st});
    return L.send(res, 200, {ok: true});
  }
  if (az === "elimina"){
    const k = {caf: "caf", ottico: "ottici", montatura: "mont"}[b.tipo]; if (!k) return L.send(res, 400, {errore: "Tipo non valido"});
    const id = pulito(b.id, 20).toUpperCase();
    if (k === "mont"){ const m = await L.DB.montatura(id); if (m && m.f.Stato === "RISERVATA") return L.send(res, 409, {errore: "Montatura prenotata da un cliente: non si può eliminare."}); }
    await L.DB.elimina(k, id); if (k === "ottici") await L.DB.elimina("ottLogin", id);
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
    for (const c of L.PROVA.montature){ const m = await L.DB.montatura(c); if (m && m.f.Stato !== "RISERVATA") await L.DB.elimina("mont", c); }
    let n = 0;
    for (const u of await L.DB.tutti()) if (L.PROVA.caf.includes(u.f.CAF) || L.PROVA.ottici.some(o => String(u.f.Ottica1 || "").startsWith(o + " "))){ await L.DB.elimina("utenti", u.id); n++; }
    await L.DB.meta("config", {provaRimossa: new Date().toISOString()});
    return L.send(res, 200, {ok: true, clientiRimossi: n});
  }
  L.send(res, 400, {errore: "Azione non valida"});
});
