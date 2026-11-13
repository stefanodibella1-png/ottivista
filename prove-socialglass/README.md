# Prove locali di SocialGlass

Gli script si aspettano il repo in `/home/claude/ottivista` e questa cartella copiata in `/home/claude/prove`.

## Preparazione
```bash
git clone https://github.com/stefanodibella1-png/ottivista /home/claude/ottivista
cp -r /home/claude/ottivista/prove-socialglass /home/claude/prove && cd /home/claude/prove
pip install playwright --break-system-packages && python3 -m playwright install chromium
(cd /home/claude/ottivista/socialglass && npm install)
# librerie servite in locale al posto dei CDN (le prove bloccano i siti esterni)
mkdir -p npmqr && (cd npmqr && npm pack qrcodejs@1.0.0 >/dev/null && tar xzf qrcodejs-1.0.0.tgz)   # → npmqr/package/qrcode.js
(cd /tmp && npm pack jspdf@2.5.1 xlsx@0.18.5 >/dev/null && tar xzf jspdf-2.5.1.tgz && cp package/dist/jspdf.umd.min.js /home/claude/prove/ && rm -rf package && tar xzf xlsx-0.18.5.tgz && cp package/dist/xlsx.full.min.js /home/claude/prove/)
```

## Server
- `node srv.js` → copia di prova su http://localhost:8823 (dati in memoria, pagamento simulato).
- `CRON_SECRET=prova node srv-prova.js` → come sopra + clienti di prova SGPROVA*.
- `CRON_SECRET=prova node srv-viaggio.js` → come `srv.js` + «macchina del tempo» su :8824:
  `curl "localhost:8824/?u=CODICE&giorni=30"` sposta indietro le date del cliente; `&insoluto=10` simula un canone non pagato da 10 giorni.
  Controllo giornaliero: `curl -H "Authorization: Bearer prova" localhost:8823/api/scadenze`.
- Accessi di prova: CAF `CAF001`/`demo`, ottiche `OTT07` e `OTT12`/`demo`, admin: la prima password impostata (gli script usano `passwordlunga1`), laboratorio `laboratorio1` dopo `salvaLab`.
- Il blocco accessi scatta dopo 8 password sbagliate in 10 minuti: se uno script fallisce in login, riavvia il server.

## Script (Playwright, cliccano l'interfaccia)
- `m1.py` modifiche UX · `m2.py` funzioni cliente · `m3.py` ottica, admin, listini, registro, importazione, copia, report · `m4.py` preventivo con lente nuova · `x1.py` servizi (amico, recensioni, tessera, dona).
- Percorso completo cliente: `v1.py` … `v11.py` (con `srv-viaggio.js`, in ordine; i salti di tempo sono nei comandi curl).
- Fine abbonamento: `crea_cliente.py` (crea una cliente consegnata via API) + `f1.py` scelta, `f2.py` pagina cliente, `f3.py` ritiro in ottica.
- `labflusso.py` laboratorio: verifica montatura, richiesta all'ottica, scheda per il laboratorio, arrivo e pronto (con `srv.js`).
- `loc.py` stampa la locandina in PNG/PDF.
- `tempo.py [riscatta|restituisci|rinnova]` percorso completo su PC (CAF), tablet (ottica), telefono (cliente) e laboratorio, con la barra del tempo (`node srv.js`).
