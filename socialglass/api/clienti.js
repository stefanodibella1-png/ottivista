// Elenco dei propri clienti: per il CAF quelli registrati, per l'ottico quelli assegnati alla sua ottica
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  const s = L.verify(req); if (!s) return L.send(res, 401, L.NOAUTH);
  // segna come inviato su WhatsApp l'ultimo avviso automatico
  if (req.method === "POST"){
    const b = await L.readBody(req);
    const u = await L.DB.utente("Univoco", String(b.univoco || ""));
    const mio = u && (s.ruolo === "caf" ? u.f.CAF === s.id : String(u.f.Ottica1 || "").startsWith(s.id + " "));
    if (!mio) return L.send(res, 404, {errore: "Cliente non trovato."});
    const o = L.parseOrdine(u.f.Ordine); Object.values(o.avvisi || {}).forEach(a => { if (!a.inviato) a.inviato = new Date().toISOString(); });
    await L.DB.aggiorna(u, {Ordine: JSON.stringify(o)});
    return L.send(res, 200, {ok: true});
  }
  const rows = await L.DB.utenti(s.ruolo === "caf" ? {caf: s.id} : {ottico: s.id});
  for (const r of rows) if (r.f.Stato === L.STATI.PAGAMENTO) await L.verificaPagamento(r);
  const isOtt = s.ruolo === "ottico";
  const list = rows.map(({f}) => {
    const o = L.parseOrdine(f.Ordine), pg = o.pagamento || {}, m = o.montatura;
    // l'ottico vede anche i dati tecnici dell'occhiale e la ricetta; il CAF no (dati sanitari)
    const tecnico = isOtt ? {montaturaCodice: m ? m.codice : "", calibro: m ? `${m.calibro || ""}${m.asse ? "-" + m.asse : ""}` : "",
      lenti: o.lenti ? o.lenti.nome : "", trattamenti: (o.trattamenti || []).map(t => t.nome), ricetta: o.ricetta || null, riscatto: o.prezzi ? o.prezzi.riscatto : null, prontoIl: o.prontoIl || ""} : {};
    return Object.assign({univoco: f.Univoco, nome: f.Nome, cognome: f.Cognome, stato: f.Stato || "", cf: s.ruolo === "caf" ? f["Codice Fiscale"] : undefined,
      bloccato: L.situazione(f).bloccato, consegnatoIl: o.consegnatoIl || "", creato: f.Creato || "", attivatoIl: pg.attivatoIl || "", chiuso: pg.chiuso || "",
      ottica: String(f.Ottica1 || "").split(" - ").slice(0, 2).join(" - "), caf: f.CAF || "",
      cellulare: f.Cellulare, montatura: o.montatura ? `${o.montatura.modello} ${o.montatura.colore}` : "", totale: o.prezzi ? o.prezzi.totale : null,
      rata: o.prezzi ? o.prezzi.rata : null, ratePagate: o.pagamento ? o.pagamento.ratePagate || 0 : 0, finePeriodo: o.finePeriodo ? o.finePeriodo.descrizione : "", aggiornato: o.aggiornato || f.Creato || "",
      periodo: L.PREZZI.periodo(o), rinnovabile: L.PREZZI.rinnovabile(o), daRitirare: !!(o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato),
      esito: o.pagamento && o.pagamento.esito || "", rinnovo: !!o.rinnovo,
      link: L.linkCliente(f.Univoco, String(f.Ottica1 || "").split(" - ")[0], f.CAF, f.Listino),
      recedibile: !!(o.pagamento && o.pagamento.attivatoIl && !o.pagamento.chiuso && !o.pagamento.rinnovato && Date.now() - new Date(o.pagamento.attivatoIl) <= 14*864e5),
      ritiroInRitardo: !!(o.ritiro && o.ritiro.daRitirare && !o.ritiro.ritirato && Date.now() - new Date(o.ritiro.dal) > 15*864e5),
      avviso: (() => { const a = Object.entries(o.avvisi || {}).filter(([k, x]) => !x.inviato && !/^insoluto/.test(k)).map(([, x]) => x).sort((x, y) => String(y.il).localeCompare(String(x.il)))[0]; return a ? {testo: a.testo, whatsapp: a.whatsapp} : null; })()}, tecnico);
  }).sort((a, b) => String(b.aggiornato).localeCompare(String(a.aggiornato)));
  // conteggi economici con SocialGlass secondo l'accordo impostato dall'amministratore
  let acc = null; try { acc = isOtt ? await L.DB.ottico(s.id) : await L.DB.login("caf", s.id); } catch(e){ console.error(e); }
  const q = new URL(req.url, "http://x").searchParams, gg = v => /^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "";
  L.send(res, 200, {clienti: list, conteggi: L.conteggi(rows.map(r => r.f), acc, gg(q.get("da")), gg(q.get("a")))});
});
