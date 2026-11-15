// Modifica 18: confronto incassi Stripe ↔ app per il pilota
process.env.SESSION_SECRET = "z".repeat(40);
const D = "/home/claude/ottivista/socialglass/api/", L = require(D + "_lib.js");
const ok = (c, t) => { console.log((c ? "OK  " : "NO  ") + t); if (!c) process.exitCode = 1; };
const ts = d => Math.floor(new Date(d) / 1000), ieri = new Date(Date.now() - 864e5).toISOString();
(async () => {
  L.demo.utenti.push(
    {Univoco: "SGPIL1", Stato: L.STATI.CONSEGNATO, Ordine: JSON.stringify({pagamento: {abbonamento: "sub_1", pagamenti: [{id: "in_a", il: ieri, canone: 9.9, spedizione: 9.9, riscatto: 0}, {id: "in_b", il: ieri, canone: 9.9, spedizione: 0, riscatto: 0}]}})},
    {Univoco: "SGPIL2", Stato: L.STATI.REGISTRATO, Ordine: JSON.stringify({rinnovo: {prosegue: {abbonamento: "sub_2", pagamenti: [{id: "in_c", il: ieri, canone: 12, spedizione: 0, riscatto: 0}], idPrecedenti: ["in_old"]}}})});
  const inv = (id, cent, uv, reason) => ({id, amount_paid: cent, created: ts(ieri), status_transitions: {paid_at: ts(ieri)}, billing_reason: reason || "subscription_cycle", subscription_details: {metadata: uv ? {univoco: uv} : {}}});
  L.CFG.stripeKey = "sk_live_finto";
  let fatture = [inv("in_a", 1980, "SGPIL1", "subscription_create"), inv("in_b", 990, "SGPIL1"), inv("in_c", 1200, "SGPIL2")];
  global.fetch = async (url) => { if (!/api\.stripe\.com\/v1\/invoices\?/.test(url)) throw new Error("rete: " + url); return {ok: true, json: async () => ({data: fatture, has_more: false})}; };
  const da = new Date(Date.now() - 7 * 864e5).toISOString(), a = new Date().toISOString();
  let r = await L.controlloPilota(da, a);
  ok(r.ok && r.stripe.fatture === 3 && r.stripe.importo === 41.7 && r.app.importo === 41.7 && r.stripe.canoniMensili === 2, `tutto uguale: ${r.stripe.fatture} pagamenti ${r.stripe.importo} € (anche il canone durante il rinnovo)`);
  fatture = fatture.concat([inv("in_d", 990, "SGPIL1"), inv("in_old", 990, "SGPIL2"), inv("in_x", 500, "")]); fatture[1] = inv("in_b", 1090, "SGPIL1");
  fatture = fatture.filter(x => x.id !== "in_c");
  r = await L.controlloPilota(da, a);
  console.log(r.differenze.map(x => "    " + x.fattura + ": " + x.problema).join("\n"));
  ok(!r.ok && r.differenze.length === 4 && r.altre.length === 1, "differenze trovate: non registrata, importo diverso, contata prima del rinnovo, registrata ma non su Stripe; fattura estranea a parte");
  await L.registra("amministratore", "dati cliente corretti", "SGPIL1", "cellulare");
  r = await L.controlloPilota(da, new Date().toISOString()); ok(r.interventi.length === 1, "intervento a mano nel periodo segnalato");
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
