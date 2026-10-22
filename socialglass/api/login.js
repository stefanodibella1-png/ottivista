// Accesso CAF e ottico: la password si controlla qui sul server
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const {ruolo, codice, password} = await L.readBody(req);
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "ip";
  if (L.tooMany(`login:${ip}`)) return L.send(res, 429, {errore: "Troppi tentativi. Riprova tra 10 minuti."});
  if (!["caf", "ottico"].includes(ruolo) || !codice || !password) return L.send(res, 400, {errore: "Inserisci codice e password."});
  const id = String(codice).trim().toUpperCase();
  let rec = null;
  if (L.DEMO){
    rec = (ruolo === "caf" ? L.demo.caf : L.demo.ottLogin).find(r => r.ID === id) || null;
  } else {
    const t = ruolo === "caf" ? L.CFG.tCaf : L.CFG.tOttLogin;
    const rows = await L.find(L.CFG.baseMain, t, `UPPER({ID})="${L.q(id)}"`, 1);
    rec = rows[0] ? rows[0].fields : null;
  }
  if (!rec || !L.safeEq(rec.Password || "", password)) return L.send(res, 401, {errore: "Codice o password non valida."});
  let nome = rec.Nome || rec.Intestatario || id;
  if (ruolo === "ottico"){
    const o = L.DEMO ? L.demo.ottici.find(x => x.ID === id) : ((await L.find(L.CFG.baseMain, L.CFG.tOttici, `{ID}="${L.q(id)}"`, 1))[0] || {}).fields;
    if (o) nome = o.Intestatario || nome;
  }
  L.send(res, 200, {token: L.sign({ruolo, id}), nome, id});
});
