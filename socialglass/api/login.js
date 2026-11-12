// Accesso CAF e ottico: la password si controlla qui sul server
const L = require("./_lib");
module.exports = L.wrap(async (req, res) => {
  if (req.method !== "POST") return L.send(res, 405, {errore: "Metodo non consentito"});
  const corpo = await L.readBody(req), {ruolo, codice, password} = corpo;
  // CAF e ottico cambiano da soli la propria password (serve quella attuale)
  if (corpo.azione === "cambiaPassword"){
    const se = L.verify(req); if (!se || !["caf", "ottico"].includes(se.ruolo)) return L.send(res, 401, L.NOAUTH);
    if (L.tooMany(`cambiopw:${se.id}`)) return L.send(res, 429, {errore: "Troppi tentativi. Riprova tra 10 minuti."});
    const rec = await L.DB.login(se.ruolo, se.id);
    if (!rec || !L.checkPw(rec.Password, String(corpo.attuale || ""))) return L.send(res, 401, {errore: "La password attuale non è corretta."});
    const nuova = String(corpo.nuova || "");
    if (nuova.length < 8) return L.send(res, 400, {errore: "La nuova password deve avere almeno 8 caratteri."});
    if (nuova === String(corpo.attuale)) return L.send(res, 400, {errore: "La nuova password è uguale a quella attuale."});
    await L.DB.salva(se.ruolo === "caf" ? "caf" : "ottLogin", se.id, {Password: L.hashPw(nuova)});
    return L.send(res, 200, {ok: true});
  }
  // codice di recupero personale: si crea da dentro (dopo l'accesso) e serve se si dimentica la password
  const nuovoCodice = () => { const A = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", b = require("crypto").randomBytes(12); let c = ""; for (const x of b) c += A[x % A.length]; return c.replace(/(.{4})(?=.)/g, "$1-"); };
  const pulisci = c => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (corpo.azione === "codiceRecupero"){
    const se = L.verify(req); if (!se || !["caf", "ottico"].includes(se.ruolo)) return L.send(res, 401, L.NOAUTH);
    const c = nuovoCodice(); await L.DB.salva(se.ruolo === "caf" ? "caf" : "ottLogin", se.id, {Recupero: L.hashPw(pulisci(c)), RecuperoIl: new Date().toISOString()});
    await L.registra(`${se.ruolo === "caf" ? "CAF" : "ottica"} ${se.id}`, "codice di recupero creato", se.id, "");
    return L.send(res, 200, {codice: c});
  }
  if (corpo.azione === "recupera"){
    if (L.tooMany(`recupero:${L.ipDi(req)}`, 5)) return L.send(res, 429, {errore: "Troppi tentativi. Riprova tra 10 minuti."});
    const r = ["caf", "ottico"].includes(corpo.ruolo) ? corpo.ruolo : "", id = String(corpo.codice || "").trim().toUpperCase(), rec = r && id ? await L.DB.login(r, id) : null;
    if (!rec || !rec.Recupero || !L.checkPw(rec.Recupero, pulisci(corpo.recupero))) return L.send(res, 401, {errore: "Codice o codice di recupero non validi. Se non hai un codice di recupero, contatta SocialGlass."});
    const nuova = String(corpo.nuova || ""); if (nuova.length < 8) return L.send(res, 400, {errore: "La nuova password deve avere almeno 8 caratteri."});
    const c = nuovoCodice();   // il codice usato non vale più: se ne crea uno nuovo
    await L.DB.salva(r === "caf" ? "caf" : "ottLogin", id, {Password: L.hashPw(nuova), Recupero: L.hashPw(pulisci(c)), RecuperoIl: new Date().toISOString()});
    await L.registra(`${r === "caf" ? "CAF" : "ottica"} ${id}`, "password reimpostata con il codice di recupero", id, "");
    return L.send(res, 200, {ok: true, codice: c});
  }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0] || "ip";
  // contano solo gli accessi sbagliati: chi entra correttamente non viene mai bloccato
  if (L.giaTroppi(`login:${ip}`, 8)) return L.send(res, 429, {errore: "Troppi tentativi sbagliati. Riprova tra 10 minuti."});
  const sbagliato = (msg) => { L.tooMany(`login:${ip}`); return L.send(res, 401, {errore: msg}); };
  // laboratorio: un solo accesso, password impostata dall'amministratore
  if (ruolo === "lab"){
    const l = (await L.DB.meta("laboratorio")) || {};
    if (!password || !l.attivo || !l.password || !L.checkPw(l.password, password)) return sbagliato("Password non valida.");
    return L.send(res, 200, {token: L.sign({ruolo: "lab", id: L.LAB}), nome: l.nome || "Laboratorio", id: L.LAB});
  }
  if (!["caf", "ottico"].includes(ruolo) || !codice || !password) return L.send(res, 400, {errore: "Inserisci codice e password."});
  const id = String(codice).trim().toUpperCase();
  const rec = await L.DB.login(ruolo, id);
  if (!rec || !L.checkPw(rec.Password, password)) return sbagliato("Codice o password non valida.");
  let nome = rec.Nome || id, listino = "";
  if (ruolo === "ottico"){ const o = await L.DB.ottico(id); if (o){ nome = o.Intestatario || nome; listino = o.Listino || ""; } }
  L.send(res, 200, {token: L.sign({ruolo, id, listino}), nome, id, listino});
});
