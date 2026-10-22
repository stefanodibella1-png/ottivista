/* Listini e calcolo del prezzo (stesso codice nel server e nell'anteprima). Prezzi in euro, IVA inclusa.
   Modifica qui i valori: ogni ottica ha la sua convenzione (Listino A, B, ...). */
(function (root) {
  const LISTINI = {
    // Modello "abbonamento": l'occhiale resta della ottica ed è dato in uso al cliente.
    // Canone mensile = valore dell'occhiale × quota annua ÷ 12 (+ servizi), con un minimo.
    mesi: 12,              // durata minima e periodo dopo cui si cambia occhiale
    spedizione: 9.90,      // pagata con il primo canone (0 se il ritiro è in ottica)
    abbonamento: {
      quotaAnnua: 0.60,    // 60% del valore dell'occhiale all'anno
      minimoMensile: 9.90,
      riscatto: 0.15,      // per tenere l'occhiale a fine periodo: 15% del valore
      servizi: ["Occhiale nuovo in uso, con le tue lenti", "Controllo della vista ogni anno", "Copertura rottura: 1 sostituzione all'anno", "Cambio occhiale ogni 12 mesi"]
    },
    convenzioni: {
      A: {
        montatura: 60,
        lenti: {
          mono:  {nome: "Monofocali", desc: "Lontano o vicino", prezzo: 96},
          mono16:{nome: "Monofocali sottili 1.6", desc: "Per gradazioni medio-alte", prezzo: 144},
          prog:  {nome: "Progressive", desc: "Lontano, intermedio e vicino", prezzo: 276},
          sole:  {nome: "Da sole graduate", desc: "Colorate con la tua gradazione", prezzo: 132}
        },
        trattamenti: {
          ar:   {nome: "Antiriflesso", prezzo: 24},
          blue: {nome: "Filtro luce blu", prezzo: 24},
          foto: {nome: "Fotocromatiche", prezzo: 60}
        }
      },
      B: {
        montatura: 72,
        lenti: {
          mono:  {nome: "Monofocali", desc: "Lontano o vicino", prezzo: 108},
          mono16:{nome: "Monofocali sottili 1.6", desc: "Per gradazioni medio-alte", prezzo: 156},
          prog:  {nome: "Progressive", desc: "Lontano, intermedio e vicino", prezzo: 300},
          sole:  {nome: "Da sole graduate", desc: "Colorate con la tua gradazione", prezzo: 144}
        },
        trattamenti: {
          ar:   {nome: "Antiriflesso", prezzo: 24},
          blue: {nome: "Filtro luce blu", prezzo: 30},
          foto: {nome: "Fotocromatiche", prezzo: 66}
        }
      }
    }
  };
  const r2 = v => Math.round(v * 100) / 100;
  function conv(listino){ return LISTINI.convenzioni[String(listino || "A").toUpperCase()] || LISTINI.convenzioni.A; }
  function preventivo(listino, lente, trattamenti, prezzoMontatura){
    const c = conv(listino), l = c.lenti[lente];
    if (!l) return null;
    const tr = (trattamenti || []).filter(t => c.trattamenti[t]).map(t => ({id: t, nome: c.trattamenti[t].nome, prezzo: c.trattamenti[t].prezzo}));
    const montatura = Number(prezzoMontatura) > 0 ? Number(prezzoMontatura) : c.montatura;
    const totale = r2(montatura + l.prezzo + tr.reduce((s, t) => s + t.prezzo, 0));
    const A = LISTINI.abbonamento;
    // canone arrotondato in su ai 10 centesimi
    const canone = r2(Math.max(A.minimoMensile, Math.ceil(totale * A.quotaAnnua / 12 * 10) / 10));
    return {montatura, lenti: {id: lente, nome: l.nome, prezzo: l.prezzo}, trattamenti: tr, totale,
      mesi: LISTINI.mesi, rata: canone, spedizione: LISTINI.spedizione, riscatto: r2(Math.ceil(totale * A.riscatto)), modello: "abbonamento"};
  }
  const api = {LISTINI, conv, preventivo};
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.LISTINI = api;
})(this);
