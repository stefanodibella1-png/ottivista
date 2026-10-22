/* Codice fiscale: validazione e coerenza con i dati anagrafici (browser e server) */
(function (root) {
  const ODD = {0:1,1:0,2:5,3:7,4:9,5:13,6:15,7:17,8:19,9:21,A:1,B:0,C:5,D:7,E:9,F:13,G:15,H:17,I:19,J:21,K:2,L:4,M:18,N:20,O:11,P:3,Q:6,R:8,S:12,T:14,U:16,V:10,W:22,X:25,Y:24,Z:23};
  const even = c => /\d/.test(c) ? +c : c.charCodeAt(0) - 65;
  const control = s => String.fromCharCode(65 + [...s].reduce((a, c, i) => a + (i % 2 ? even(c) : ODD[c]), 0) % 26);
  // omocodia: alcune cifre possono essere sostituite da lettere
  const OMO = {L:"0",M:"1",N:"2",P:"3",Q:"4",R:"5",S:"6",T:"7",U:"8",V:"9"};
  function valido(cf){
    cf = String(cf || "").toUpperCase().trim();
    if (!/^[A-Z]{6}[0-9LMNPQRSTUV]{2}[ABCDEHLMPRST][0-9LMNPQRSTUV]{2}[A-Z][0-9LMNPQRSTUV]{3}[A-Z]$/.test(cf)) return false;
    return control(cf.slice(0, 15)) === cf[15];
  }
  function deomo(cf){ return [...cf].map((c, i) => [6,7,9,10,12,13,14].includes(i) && OMO[c] ? OMO[c] : c).join(""); }
  function parte(s, isNome){
    s = String(s || "").toUpperCase().normalize("NFD").replace(/[^A-Z]/g, "");
    const cons = [...s].filter(c => !"AEIOU".includes(c)), voc = [...s].filter(c => "AEIOU".includes(c));
    if (isNome && cons.length >= 4) return cons[0] + cons[2] + cons[3];
    return (cons.join("") + voc.join("") + "XXX").slice(0, 3);
  }
  const MESI = "ABCDEHLMPRST";
  function prefisso(nome, cognome, data, sesso){
    const [y, m, d] = String(data).split("-");
    if (!y || !m || !d) return "";
    return parte(cognome) + parte(nome, true) + y.slice(2) + MESI[+m - 1] + String(+d + (sesso === "F" ? 40 : 0)).padStart(2, "0");
  }
  function coerente(cf, nome, cognome, data, sesso){
    return deomo(String(cf).toUpperCase()).slice(0, 11) === prefisso(nome, cognome, data, sesso);
  }
  const api = {valido, coerente, prefisso, control};
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.CF = api;
})(this);
