// Clienti: verifica codice fiscale, inserimento e rinnovo (CAF), ricerca (ottico)
const L = require("./_lib");
async function sendSms(to, text){
  if (!L.CFG.smsWebhook) return false;
  try { const r = await fetch(L.CFG.smsWebhook, {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({to, text})}); return r.ok; }
  catch(e){ return false; }
}
function messaggio(nome, ottica, link){ return `SocialGlass: ciao ${L.nm(nome)}, ecco il tuo link personale per scegliere i nuovi occhiali da ${ottica}. Aprilo e mostra all'ottico il tuo codice. Il link vale 30 giorni, fino al ${L.giornoIt(Date.now() + L.GIORNI_LINK * 864e5)}: ${link}`; }
function wa(numero, testo){ return `https://wa.me/${String(numero).replace(/\D/g, "")}?text=${encodeURIComponent(testo)}`; }
module.exports = L.wrap(async (req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "GET" && url.searchParams.get("ottici")){
    // elenco ottiche convenzionate: il CAF le vede tutte, l'ottica solo sé stessa (registra i clienti per sé)
    const sc = L.verify(req, "caf"), so = sc ? null : L.verify(req, "ottico");
    if (!sc && !so) return L.send(res, 401, L.NOAUTH);
    const list = (await L.DB.ottici()).filter(f => f.ID && !f.Disattivato && (!so || f.ID === so.id)).sort((a, b) => parseInt(String(a.ID).replace(/\D/g, "") || 0) - parseInt(String(b.ID).replace(/\D/g, "") || 0))
      .map(f => ({id: f.ID, label: `${f.ID} - ${f.Intestatario || ""} - ${f.Indirizzo || ""}${f.Citta || ""}`, listino: f.Listino || ""}));
    return L.send(res, 200, {ottici: list});
  }
  if (req.method === "GET"){
    const cf = (url.searchParams.get("cf") || "").toUpperCase().trim();
    const uv = (url.searchParams.get("univoco") || "").toUpperCase().trim();
    if (cf){
      const sc = L.verify(req, "caf"), so = sc ? null : L.verify(req, "ottico");
      if (!sc && !so) return L.send(res, 401, L.NOAUTH);
      if (!L.CF.valido(cf)) return L.send(res, 200, {valido: false});
      const u = await L.clientePerCF(cf);
      // all'ottica che registra basta sapere se il codice fiscale è libero: nome e codice solo per i suoi clienti
      if (so){
        const mio = u && String(u.f.Ottica1 || "").startsWith(so.id + " ");
        return L.send(res, 200, {valido: true, stato: u ? (u.f.Archiviato ? null : mio ? u.f.Stato || "REGISTRATO" : "GIÀ REGISTRATO") : null, nome: mio ? `${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)}` : null,
          univoco: mio ? u.f.Univoco : null, ottica: u ? String(u.f.Ottica1 || "").split(" - ")[0] : null, rinnovabile: false, rinnovoDal: null, bloccato: false});
      }
      const o = u ? L.parseOrdine(u.f.Ordine) : null, per = o ? L.PREZZI.periodo(o) : null;
      // cliente di un altro CAF (o registrato da un'ottica): solo che è già registrato, presso chi, e da quando potrà passare a questo CAF.
      // Niente nome, codice, situazione, pagamenti o date personali (privacy tra CAF)
      if (u && u.f.CAF !== sc.id){
        const altro = u.f.CAF ? await L.DB.login("caf", u.f.CAF).catch(() => null) : null, si = L.situazione(u.f);
        const finito = [L.STATI.CONSEGNATO, L.STATI.CHIUSO].includes(u.f.Stato) && !(o.rinnovo && !(o.pagamento || {}).attivatoIl);
        return L.send(res, 200, {valido: true, stato: "GIÀ REGISTRATO", altroCaf: true, cafNome: u.f.CAF ? ((altro && altro.Nome) || "un altro CAF") : "un'ottica convenzionata",
          rinnovabile: !u.f.Archiviato && !si.bloccato && finito && L.PREZZI.rinnovabile(o), rinnovoDal: !u.f.Archiviato && finito && per && !per.chiuso ? per.preavviso : null, inCorso: !u.f.Archiviato && !finito});
      }
      return L.send(res, 200, {valido: true, stato: u ? u.f.Stato || "REGISTRATO" : null, nome: u ? `${L.nm(u.f.Nome)} ${L.nm(u.f.Cognome)}` : null, univoco: u ? u.f.Univoco : null,
        ottica: u ? String(u.f.Ottica1 || "").split(" - ")[0] : null, rinnovabile: u ? [L.STATI.CONSEGNATO, L.STATI.CHIUSO].includes(u.f.Stato) && L.PREZZI.rinnovabile(o) : false,
        rinnovoDal: per && !per.chiuso ? per.preavviso : null, bloccato: u ? L.situazione(u.f).bloccato : false,
        // verifica anagrafica del CAF: promozione già usata, morosità, pratica in corso
        ...(u ? (() => { const si = L.situazione(u.f), pg = o.pagamento || {}, p0 = (o.storico || []).find(x => x.inizio);
          return {creato: u.f.Creato || "", attivatoIl: (p0 && p0.inizio) || pg.attivatoIl || "", periodi: (o.storico || []).filter(x => x.inizio).length + (pg.attivatoIl ? 1 : 0),
            consegnatoIl: o.consegnatoIl || "", moroso: si.moroso, bloccoAdmin: !!(si.blocco && si.blocco.stato === "bloccato"), esito: pg.esito || "", scadenza: per ? per.scadenza : null,
            rinnovoInCorso: !!o.rinnovo && !pg.attivatoIl, mio: u.f.CAF === sc.id,
            scelta: o.finePeriodo && !o.finePeriodo.eseguita ? {scelta: o.finePeriodo.scelta, descrizione: o.finePeriodo.descrizione} : null}; })() : {})});
    }
    if (uv){
      const s = L.verify(req, "ottico"); if (!s) return L.send(res, 401, L.NOAUTH);
      // solo i clienti della propria ottica
      const u0 = await L.DB.utente("Univoco", uv), u = u0 && String(u0.f.Ottica1 || "").startsWith(s.id + " ") ? u0 : null;
      return L.send(res, 200, u ? {trovato: true, nome: u.f.Nome, cognome: u.f.Cognome, stato: u.f.Stato || ""} : {trovato: false});
    }
    return L.send(res, 400, {errore: "Parametro mancante"});
  }
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  { const so = await L.partnerSospeso(L.verify(req)); if (so) return L.send(res, 403, so); }
  const b = await L.readBody(req);

  // rinnovo: dal CAF o direttamente dall'ottico, dai 30 giorni prima della scadenza
  if (b.azione === "rinnovo"){
    const sc = L.verify(req, "caf"), so = sc ? null : L.verify(req, "ottico");
    if (!sc && !so) return L.send(res, 401, L.NOAUTH);
    const u = b.univoco ? await L.DB.utente("Univoco", String(b.univoco).toUpperCase().trim()) : await L.clientePerCF(String(b.cf || ""));
    if (!u) return L.send(res, 404, {errore: "Cliente non trovato. Controlla il codice fiscale."});
    // l'ottico può rinnovare per codice univoco solo i propri clienti; per un cliente di un'altra ottica serve il codice fiscale
    const suo = sc ? u.f.CAF === sc.id : String(u.f.Ottica1 || "").startsWith(so.id + " ");
    if (so && b.univoco && !suo) return L.send(res, 404, {errore: "Cliente non trovato tra i tuoi clienti."});
    // cliente di un altro CAF (o di un'altra ottica): passa a te solo con il suo consenso, cioè il codice cliente che ti mostra (tessera o link)
    if (!suo && b.codice && await L.bloccato(req)) return L.send(res, 429, L.TROPPI);
    if (!suo && !L.codiceIntero(b.codice, u.f.Univoco)){
      if (b.codice) await L.codiceErrato(req);
      return L.send(res, 403, {serveCodice: true, errore: b.codice ? "Il codice cliente non corrisponde: fatti mostrare la tessera o il link del cliente e riprova."
        : sc ? "Il cliente è registrato presso un altro CAF. Per passarlo al tuo CAF serve il suo consenso: scansiona la sua tessera o scrivi il codice cliente che trova nel suo link."
        : "Il cliente è di un'altra ottica. Per passarlo alla tua serve il suo consenso: scansiona la sua tessera o scrivi il codice cliente che trova nel suo link."});
    }
    if (L.situazione(u.f).bloccato) return L.send(res, 423, L.BLOCCATO);
    { const ap = L.segnalazioniAperte(u.f); if (ap.length) return L.send(res, 409, {errore: `Il cliente ha una segnalazione aperta dal ${new Date(ap[0].il).toLocaleDateString("it-IT")} («${String(ap[0].testo || "").slice(0, 60)}»): prima risolvila, poi fai il rinnovo.`, segnalazione: true}); }
    const ord = L.parseOrdine(u.f.Ordine);
    if (ord.rinnovo && [L.STATI.REGISTRATO, L.STATI.MONTATURA, L.STATI.PAGAMENTO].includes(u.f.Stato))
      return L.send(res, 409, {errore: `Rinnovo già avviato il ${new Date(ord.rinnovo.il).toLocaleDateString("it-IT")} (${ord.rinnovo.da}): il cliente deve solo scegliere la montatura dal suo link.`, univoco: u.f.Univoco});
    if (![L.STATI.CONSEGNATO, L.STATI.CHIUSO, L.STATI.REGISTRATO].includes(u.f.Stato) && ord.pagamento && !ord.pagamento.chiuso)
      return L.send(res, 409, {errore: "Il cliente ha un ordine in corso: il rinnovo si fa dopo la consegna."});
    if (!L.PREZZI.rinnovabile(ord)){
      const p = L.PREZZI.periodo(ord);
      return L.send(res, 409, {errore: `Rinnovo possibile dal ${new Date(p.preavviso).toLocaleDateString("it-IT")} (30 giorni prima della scadenza del ${new Date(p.scadenza).toLocaleDateString("it-IT")}).`});
    }
    // l'ottico che rinnova diventa l'ottica del cliente; il CAF può indicarne un'altra
    const otticoId = so ? so.id : (b.ottica || "");
    if (otticoId && !so){ const oo = await L.DB.ottico(otticoId); if (!oo || oo.Disattivato) return L.send(res, 400, {errore: "Questa ottica non è più attiva: scegline un'altra."}); }
    const r = await L.rinnova(u, {otticoId, caf: sc ? sc.id : "", cambioCaf: !!(sc && !suo)});
    if (!suo && so) await L.registra("ottica " + so.id, "cambio ottica autorizzato dal cliente", u.f.Univoco, "rinnovo con il codice cliente");
    return L.send(res, 200, r);
  }

  // registrazione: dal CAF (sceglie l'ottica) o dall'ottica stessa (il cliente è suo; nessun compenso CAF, decisione D8)
  const sc = L.verify(req, "caf"), so = sc ? null : L.verify(req, "ottico");
  if (!sc && !so) return L.send(res, 401, L.NOAUTH);
  if (so) b.ottica = so.id;
  const cafId = sc ? sc.id : "";

  const d = {cf: String(b.cf || "").toUpperCase().trim(), nome: String(b.nome || "").toUpperCase().trim(), cognome: String(b.cognome || "").toUpperCase().trim(),
    prefisso: String(b.prefisso || "+39"), cellulare: String(b.cellulare || "").replace(/\D/g, ""), nato: String(b.nato || "").toUpperCase().trim(),
    sesso: b.sesso === "F" ? "F" : "M", data: String(b.datanascita || ""), ottica: String(b.ottica || ""), gdpr: !!b.gdpr};
  if (!d.cf || !d.nome || !d.cognome || !d.cellulare || !d.nato || !d.data || !d.ottica || !d.gdpr) return L.send(res, 400, {errore: "Per favore, compila tutti i campi obbligatori."});
  // codice fiscale falso o di comodo: controllo, coerenza con i dati, luogo di nascita esistente e uguale a quello dichiarato
  { const e = L.controlloCF(d); if (e) return L.send(res, 400, {errore: e}); }
  // chi registra conferma di aver controllato il codice sul documento del cliente (tessera sanitaria o carta d'identità)
  if (!b.documento) return L.send(res, 400, {errore: "Conferma di aver controllato il codice fiscale sulla tessera sanitaria o sul documento del cliente."});
  if (d.cellulare.length < 6) return L.send(res, 400, {errore: "Numero di cellulare non valido."});
  const res_ = L.residenza(b.residenza); if (res_.errore) return L.send(res, 400, res_);
  let gia = await L.clientePerCF(d.cf);
  // pratica precedente scaduta (link oltre i 30 giorni): i suoi dati si cancellano subito e il cliente riparte da capo
  if (gia && gia.f.Archiviato){ await require("./scadenze").anonimizza(gia, new Date().toISOString(), "nuova registrazione"); gia = null; }
  if (gia) return L.send(res, 409, {errore: `ATTENZIONE ! CODICE FISCALE ${gia.f.Stato || "GIÀ REGISTRATO"}${gia.f["Codice Fiscale"] !== d.cf ? " (scritto in un'altra forma: è lo stesso codice)" : ""}`, univoco: (sc ? gia.f.CAF === sc.id : String(gia.f.Ottica1 || "").startsWith(so.id + " ")) ? gia.f.Univoco : undefined});
  // stessa persona già cliente con un altro codice fiscale: possibile codice falso per aggirare un blocco o avere più occhiali
  { const p = await L.stessaPersona(d.nome, d.cognome, d.data, d.cf);
    const mioP = p && (sc ? p.f.CAF === sc.id : String(p.f.Ottica1 || "").startsWith(so.id + " "));
    if (p){ await L.registra(sc ? "caf " + sc.id : "ottica " + so.id, "codice fiscale sospetto", p.f.Univoco, `${d.cf} per ${d.nome} ${d.cognome} ${d.data}: già cliente con ${p.f["Codice Fiscale"]}`);
      return L.send(res, 409, {errore: `ATTENZIONE: ${d.nome} ${d.cognome}, nato il ${d.data.split("-").reverse().join("/")}, è già cliente con un altro codice fiscale${mioP ? ` (codice cliente ${p.f.Univoco})` : ""}. Due codici per la stessa persona non sono ammessi: controlla il documento o contatta SocialGlass.`, univoco: mioP ? p.f.Univoco : undefined}); } }
  const o = await L.DB.ottico(d.ottica);
  if (!o) return L.send(res, 400, {errore: "Ottica non trovata."});
  if (o.Disattivato) return L.send(res, 400, {errore: "Questa ottica non è più attiva: scegline un'altra."});
  // porta un amico: codice cliente di chi lo ha presentato (facoltativo)
  const amico = String(b.amico || "").toUpperCase().replace(/\s/g, "");
  if (amico){ const a = await L.DB.utente("Univoco", amico); if (!a) return L.send(res, 400, {errore: "Codice amico non trovato: controllalo o lascia il campo vuoto."}); if (a.f["Codice Fiscale"] === d.cf) return L.send(res, 400, {errore: "Il codice amico è dello stesso cliente."});
    if (!L.abbonamentoAttivo(a.f)) return L.send(res, 400, {errore: L.PREMIO_NON_ATTIVABILE + " Lascia vuoto il campo «Codice amico» per registrare il cliente."}); }
  const fields = {"CAF": cafId, "RegistratoDa": sc ? "caf " + sc.id : "ottica " + so.id, "InformativaMostrata": new Date().toISOString(), "Nome": d.nome, "Cognome": d.cognome, "Cellulare": d.cellulare, "Codice Fiscale": d.cf,
    "Ottica1": `${o.ID} - ${o.Intestatario} - ${o.Indirizzo || ""}${o.Citta || ""}`, "Nato a": d.nato, "Genere": d.sesso, "Data Nascita": d.data, ...L.campiCF(d.cf, d.nome, d.cognome, d.data), DocumentoVerificato: {il: new Date().toISOString(), da: sc ? "caf " + sc.id : "ottica " + so.id},
    "Listino": o.Listino || "", "Stato": L.STATI.REGISTRATO, "Residenza": res_, "LinkFino": new Date(Date.now() + L.GIORNI_LINK * 864e5).toISOString(), ...(amico ? {PresentatoDa: amico} : {})};
  const uv = await L.DB.creaUtente(fields);
  const link = L.linkCliente(uv, o.ID, cafId, o.Listino);
  const testo = messaggio(d.nome, o.Intestatario, link);
  L.send(res, 200, {univoco: uv, link, smsInviato: await sendSms(d.prefisso + d.cellulare, testo), whatsapp: wa(d.prefisso + d.cellulare, testo), ottica: o.Intestatario});
});
