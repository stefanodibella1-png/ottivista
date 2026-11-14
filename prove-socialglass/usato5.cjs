// Modifica 5: acquisto dell'usato con Stripe simulato. Uso: node prove-socialglass/usato5.cjs (dalla radice del repo, senza chiavi)
const L = require("../socialglass/api/_lib"), S = require("../socialglass/api/_stripe"), SC = require("../socialglass/api/scadenze");
const st = {fatture: [], voci: [], cancellati: [], guasto: 0};
L.CFG.stripeKey = "sk_test_finto";
L.stripeApi = async (m, p, par = {}, chiave) => {
  if (m === "GET" && p === "invoices") return {data: par.subscription ? [] : st.fatture.filter(f => f.customer === par.customer)};
  if (m === "GET" && p.startsWith("invoices/")) return st.fatture.find(f => f.id === p.split("/")[1]);
  if (m === "GET" && p === "invoiceitems") return {data: st.voci.filter(v => v.customer === par.customer && !v.invoice)};
  if (m === "POST" && p === "invoiceitems"){ const v = {id: "ii_" + (st.voci.length + 1), customer: par.customer, metadata: par.metadata || {}}; st.voci.push(v); return v; }
  if (m === "POST" && p === "invoices"){ if (st.guasto){ st.guasto--; throw new Error("Stripe non risponde"); } const f = {id: "in_r" + (st.fatture.length + 1), customer: par.customer, status: "draft", metadata: par.metadata, amount_paid: 0}; st.voci.filter(v => v.customer === par.customer && !v.invoice).forEach(v => v.invoice = f.id); st.fatture.push(f); return f; }
  if (m === "POST" && /finalize$/.test(p)){ const f = st.fatture.find(x => x.id === p.split("/")[1]); f.status = "open"; return f; }
  if (m === "POST" && /void$/.test(p)){ const f = st.fatture.find(x => x.id === p.split("/")[1]); f.status = "void"; return f; }
  if (m === "DELETE"){ st.cancellati.push(p); return {}; }
  if (m === "GET" && p.startsWith("subscriptions/")) return {id: p.split("/")[1], status: st.cancellati.includes(p) ? "canceled" : "active"};
  throw new Error("non previsto " + m + " " + p);
};
const ordine = (cus) => JSON.stringify({prezzi: {rata: 9.9, mesi: 12, riscatto: 27}, consegnatoIl: "2025-10-20", finePeriodo: {scelta: "riscatta", descrizione: "acquisto dell'usato"},
  pagamento: {stato: "ATTIVO", abbonamento: "sub_" + cus, cliente: cus, attivatoIl: "2025-10-01", ratePagate: 12}});
const giro = async (u, ora) => { const e = []; await SC.controlla(await L.DB.utente("Univoco", u), ora, e); return e.map(x => x.esito || x.errore).join(", ") || "—"; };
const vedi = async (id) => { const u = await L.DB.utente("Univoco", id), pg = L.parseOrdine(u.f.Ordine).pagamento; return `stato ${u.f.Stato} | ${pg.esito} | fattura ${pg.riscatto && pg.riscatto.fattura || "-"} | pagato ${pg.riscatto && pg.riscatto.pagato ? "sì" : "no"} | insoluto ${pg.insoluto ? "sì (" + (pg.insoluto.messaggi || []).length + " messaggi)" : "no"}`; };
(async () => {
  const a = await L.DB.creaUtente({Nome: "ANNA", Cellulare: "3330000001", Stato: L.STATI.CONSEGNATO, Ordine: ordine("cus_a")});
  console.log("1 scadenza:", await giro(a, "2026-11-14T08:00:00Z")); console.log("  ", await vedi(a));
  console.log("2 giorno dopo:", await giro(a, "2026-11-15T08:00:00Z"), "| fatture create:", st.fatture.length, "| voci:", st.voci.length, "| abbonamenti chiusi:", st.cancellati.length);
  console.log("3 Stripe chiude l'abbonamento:", JSON.stringify(await S.elabora(await L.DB.utente("Univoco", a), {id: "e1", type: "customer.subscription.deleted", data: {object: {id: "sub_cus_a", metadata: {univoco: a}}}})), "|", await vedi(a));
  const inv = st.fatture[0];
  await S.elabora(await L.DB.utente("Univoco", a), {id: "e2", type: "invoice.payment_failed", data: {object: Object.assign({}, inv, {amount_due: 2700, attempt_count: 1, hosted_invoice_url: "https://pay.stripe/x"})}});
  console.log("4 pagamento non riuscito:", await vedi(a));
  await S.elabora(await L.DB.utente("Univoco", a), {id: "e3", type: "invoice.paid", data: {object: Object.assign({}, inv, {amount_paid: 2700, status: "paid"})}});
  console.log("5 il cliente paga:", await vedi(a));
  // interruzione: Stripe non risponde alla creazione della fattura
  const b = await L.DB.creaUtente({Nome: "BRUNO", Cellulare: "3330000002", Stato: L.STATI.CONSEGNATO, Ordine: ordine("cus_b")}); st.guasto = 1;
  console.log("6 scadenza con Stripe guasto:", await giro(b, "2026-11-14T08:00:00Z")); console.log("  ", await vedi(b));
  console.log("7 giorno dopo, si riprende:", await giro(b, "2026-11-15T08:00:00Z"), "| fatture di Bruno:", st.fatture.filter(f => f.customer === "cus_b").length, "| voci di Bruno:", st.voci.filter(v => v.customer === "cus_b").length);
  console.log("  ", await vedi(b));
  // pagamento mai arrivato
  await S.elabora(await L.DB.utente("Univoco", b), {id: "e4", type: "invoice.payment_failed", data: {object: Object.assign({}, st.fatture.find(f => f.customer === "cus_b"), {amount_due: 2700, attempt_count: 1})}});
  const ub = await L.DB.utente("Univoco", b), ob = L.parseOrdine(ub.f.Ordine); ob.pagamento.insoluto.dal = "2026-10-01T00:00:00Z"; await L.DB.aggiorna(ub, {Ordine: JSON.stringify(ob)});
  console.log("8 dopo 30 giorni senza pagare:", await giro(b, "2026-11-16T08:00:00Z")); console.log("  ", await vedi(b), "| fattura annullata:", st.fatture.find(f => f.customer === "cus_b").status);
  // controllo notturno: avviso di pagamento perso
  const c = await L.DB.creaUtente({Nome: "CARLO", Cellulare: "3330000003", Stato: L.STATI.CONSEGNATO, Ordine: ordine("cus_c")});
  await giro(c, "2026-11-14T08:00:00Z"); const fc = st.fatture.find(f => f.customer === "cus_c"); fc.status = "paid"; fc.amount_paid = 2700;
  console.log("9 notte, pagamento perso:", JSON.stringify(await S.riconcilia(await L.DB.utente("Univoco", c))), "|", await vedi(c));
})().catch(e => console.error("ERRORE", e));
