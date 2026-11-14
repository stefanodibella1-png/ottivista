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
- `notte13.py` controllo notturno a lotti (server con `NOTTE_MAX=4`), stato per l'allarme, copia a pezzi; `ui13.py` riquadro nel pannello.
- `mag12.py` prenotazione nell'ottica del cliente, pezzo già prenotato, giacenza da correggere, elenco esposte con i prenotati.
- `casi11.py` coda «Da risolvere», rimborso del recesso, restituzione con stato e mancata (D3, con `srv-viaggio.js`), rinnovo bloccato da segnalazione; parte cliccata su tablet e pannello.
- `corr10.py` (API) e `ui10.py` (cliccata) correzioni della modifica 10: annullo entro 30 minuti, rifacimento, correzione ricetta, correzioni e cambio ottica dal pannello, partner disattivato.
- `cons9.py` consenso della ricetta dal cliente e registrazione dall'ottica (modifica 9): API, modulo sul tablet, riquadro sul telefono, blocco e «Ricontrolla».
- `prog8.py`, `prog8b.py` ricetta delle progressive (modifica 8): altezza obbligatoria, valori fuori misura, modulo sul tablet, busta del laboratorio.
- `sped7.py` spedizione e consegna (modifica 7): montatura sbagliata rifiutata, pronto/spedito, arrivo in ottica, consegna con codice. `aiuti_ottica.py`: arrivo e consegna cliccati dal tablet (usato da `tempo.py`, `labflusso.py`, `giro_ux.py`).
- `rec6.py` inizio lavorazione e annullamento (modifica 6): pronto bloccato senza inizio, recesso con montatura rientrata, inizio mentre la montatura viaggia, rimborsi da fare.
- `node prove-socialglass/usato5.cjs`: acquisto dell'usato (modifica 5) con Stripe simulato: richiesta unica, Stripe guasto e ripresa, pagamento riuscito, non pagato dopo 30 giorni, pagamento recuperato di notte.
- `sepa4.py` pagamento con IBAN (modifica 4): carta, IBAN confermato, IBAN rifiutato e nuovo pagamento. `node prove-socialglass/notte3.cjs`: controllo notturno con Stripe simulato.
- `pag3.py` pagamenti (modifica 3): avvisi Stripe ripetuti, fuori ordine, insoluto e sollecito una sola volta.
- `conc.py`, `conc2.py` fondamenta (modifica 2): tocchi contemporanei, avviso Stripe insieme al laboratorio, passaggi non permessi, recesso → CHIUSO, storico (con `srv.js`; usano `crea_cliente.py`).
- `labflusso.py` laboratorio: verifica montatura, richiesta all'ottica, scheda per il laboratorio, arrivo e pronto (con `srv.js`).
- `loc.py` stampa la locandina in PNG/PDF.
- `tempo.py [riscatta|restituisci|rinnova]` percorso completo su PC (CAF), tablet (ottica), telefono (cliente) e laboratorio, con la barra del tempo (`node srv.js`).
