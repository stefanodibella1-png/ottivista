// Accesso CAF e ottico: la password si controlla qui sul server
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const {ruolo, codice, password} = await L.readBody(req);
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "ip";
  if (L.tooMany(`login:${ip}`)) return L.send(res, 429, {errore: "Troppi tentativi. Riprova tra 10 minuti."});
  if (!["caf", "ottico"].includes(ruolo) || !codice || !password) return L.send(res, 400, {errore: "Inserisci codice e password."});
  const id = String(codice).trim().toUpperCase();
  const rec = await L.DB.login(ruolo, id);
  if (!rec || !L.checkPw(rec.Password, password)) return L.send(res, 401, {errore: "Codice o password non valida."});
  let nome = rec.Nome || id, listino = "";
  if (ruolo === "ottico"){ const o = await L.DB.ottico(id); if (o){ nome = o.Intestatario || nome; listino = o.Listino || ""; } }
  L.send(res, 200, {token: L.sign({ruolo, id, listino}), nome, id, listino});
});
