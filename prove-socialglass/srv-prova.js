// copia di prova + clienti di prova SGPROVA* (stesso script del workflow, senza il controllo Firestore)
const fs = require("fs");
const s = fs.readFileSync("/home/claude/ottivista/scripts/sg-clienti-prova.cjs", "utf8")
  .replace('if (L.MODO !== "firestore") throw new Error("Firestore non configurato");', "")
  .replace('require("../socialglass/api/_lib.js")', 'require("/home/claude/ottivista/socialglass/api/_lib.js")');
fs.writeFileSync("/tmp/clienti-test.cjs", s);
require("./srv.js");
setTimeout(() => { process.argv[2] = "crea"; require("/tmp/clienti-test.cjs"); }, 500);
