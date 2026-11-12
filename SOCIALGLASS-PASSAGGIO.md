# SocialGlass — passaggio di consegne (12/11/2026)

Leggi questo file all'inizio di ogni nuova sessione su SocialGlass.

## Il progetto
- Occhiali in abbonamento tramite **CAF** (registra il cliente), **ottica** (montatura, lenti, consegna), **laboratorio** (monta le lenti), **amministratore** SocialGlass.
- Sito: https://socialglass.vercel.app e https://www.socialglass.it (entrambi serviti dalla versione attuale).
- Codice: repo `stefanodibella1-png/ottivista`, cartella `socialglass/`. Firebase dedicato: `socialglass-289a7` (tenere separati i progetti).
- Pagine: `/` cliente e home, `/caf`, `/ottico`, `/admin`, `/laboratorio`.
- File principali: `app.js` (cliente, CAF, ottica), `admin.js` (pannello), `lab.js` + `laboratorio.html`, `listini.js` (listini di base), `cf.js`, `api/*.js` (funzioni Vercel CommonJS, `api/_lib.js` comune).

## Regole tecniche da rispettare
- **Vercel Hobby: massimo 12 funzioni** e sono già 12 (file in `api/` escluso `_lib.js`). Nuovi endpoint: dentro file esistenti (azioni POST su `api/benvenuto`, `api/admin`, `api/ordine`, `api/login`…).
- Dopo ogni modifica a JS/CSS: aumentare `?v=` in `index.html` e `laboratorio.html` (oggi **1796200000**, prossimo 1796300000).
- Pubblicazione: commit su `main` → workflow `socialglass-deploy` + prova `socialglass-prova`; poi `git push -f origin main:gh-pages`. Su `main` arrivano anche commit automatici del catalogo shop: fare `git fetch` + `rebase` prima del push.
- Firma dei commit:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`
  `Claude-Session: <link della sessione>`
- Chiavi (Stripe, WhatsApp, Twilio…) **solo** come secrets del repo GitHub, mai in chat. Non toccare i DNS. Non pubblicare dati o immagini dei fornitori senza autorizzazione.
- Listini: quelli salvati dal pannello stanno in Firestore (`meta/listini`, campo `json`) e **sostituiscono** `listini.js`.
- Nomi delle persone: salvati in maiuscolo, mostrati con `L.nm()` (risposte API tramite replacer in `send`, messaggi tramite `bel()`).

## Cosa c'è (tutto pubblicato e provato cliccando)
- Cliente: link che apre subito l'ordine, scanner montatura, preventivo e attivazione Stripe, tracciamento animato, app installabile + notifiche push gratis, tessera QR, porta un amico, occhiale solidale, recensioni, il mio anno (dopo 10 mesi), catalogo montature esposte, prenotazione in ottica, segnala un problema con foto, cambia carta e ricevute (portale Stripe), contratto PDF, rinnovo guidato, messaggi chiari di fine abbonamento.
- CAF: nuovo cliente (data nascita e sesso dal codice fiscale), clienti, conteggi, **locandina A4** da appendere, rinnovo, recupero password con codice di recupero. Niente «Da fare oggi» (compiti dell'admin).
- Ottica: ordine cliente (lenti/ricetta dai listini), da fare oggi, agenda appuntamenti con orari, segnalazioni, esposte, conteggi, consegna, rinnovo (con conferma), ritiro occhiali restituiti/vecchi.
- Laboratorio: montatura ritirata → occhiale pronto (avviso automatico al cliente).
- Admin: Oggi, clienti, morosi e solleciti, conteggi e pagamenti ai partner (Stripe Connect), magazzino (QR, scorte, riordini, importazione da Excel, foto), fornitori, **Listini** (modifica, nuovi, cancellazione), **Registro** operazioni, report del mese, copia notturna dei dati (ultime 7, da Impostazioni), prova dei messaggi.

## Formula fiscale scelta (12/11/2026) — documento «SocialGlass — fisco, vendite e contratti»
- SocialGlass (ditta individuale) è l'unico venditore: noleggia l'occhiale al cliente e incassa canoni, spedizione e «acquisto dell'usato». Ottica, CAF e laboratorio le fatturano i loro compensi.
- Compensi di base (IVA compresa, `COMPENSO_BASE` in `api/_lib.js`), proposti già compilati nel modulo del nuovo CAF/ottica e modificabili alla stipula (ogni cambio vale da oggi, i compensi maturati restano con l'accordo di prima); per chi non ha un accordo salvato valgono comunque: ottica = una rata + la spedizione del cliente per ogni abbonamento attivato (tipo `rata`); CAF = 3 € per abbonamento attivato. Il laboratorio lo paga SocialGlass.
- Riscatto → «acquisto dell'usato» nei testi (i codici interni restano `riscatta`/`riscatto`).
- Recesso → «annullamento» solo prima che il laboratorio inizi la lavorazione (`L.inLavorazione`, `L.annullabile`); terza spunta obbligatoria all'attivazione (`consensoSuMisura`, salvata in `ord.consensi.suMisura`).
- Codice ATECO di noleggio: Stefano lo aggiunge con ComUnica entro 30 giorni dal primo noleggio.
- Fatturazione (`api/_fattura.js`, non conta tra le 12 funzioni): una fattura FatturaPA FPR12 per ogni incasso Stripe (`invoice.paid` nel webhook), numero `n/SG` per anno senza buchi né doppioni (transazione `DB.nuovaFattura`, id = pagamento Stripe), archivio `sg_fatture`. Regime ordinario (IVA scorporata, 4% di base) o forfettario (N2.2, bollo virtuale oltre 77,47 €). Si attiva da Impostazioni › Fatturazione elettronica; il cliente vede la copia di cortesia in «Ricevute».
- Invio Aruba: serve il piano Premium (API). Secrets del repo `ARUBA_USER` e `ARUBA_PASSWORD` (da passare a Vercel come le altre chiavi), ambiente demo/reale dal pannello. Senza credenziali le fatture restano «da inviare»; il controllo del mattino rimanda quelle in sospeso. Validate in locale con lo schema FatturaPA (codici natura attuali).
- Residenza del cliente obbligatoria (campo `Residenza`): la chiede il CAF alla registrazione; chi è registrato prima la scrive all'attivazione.
- Da fare: attivare Aruba Premium e inserire le credenziali, contratti con l'avvocato, dati del titolare in Impostazioni.

## Barra del tempo (PROVE TECNICHE — da togliere prima dell'uscita al pubblico)
- Etichetta «⏱ PROVE» in alto a sinistra nella pagina del cliente, **solo** per i clienti di prova (CAF001, OTT07, OTT12); sparisce da sola dopo «rimuovi dati di prova».
- Pulsanti: +1 g, +7 g, +30 g, +6 mesi, «A 20 giorni dalla scadenza», canone non pagato, paga il canone, controllo di oggi. Ogni salto sposta indietro le date del cliente (tranne l'appuntamento) a tappe di 29 giorni ed esegue il controllo del mattino (`controlla` in `api/scadenze.js`); ogni uso finisce nel Registro.
- Limite: Stripe non si sposta nel tempo (i canoni veri non vengono addebitati dai salti; «canone non pagato» e «paga» sono simulati). La restituzione con Stripe chiude a fine del mese reale.
- Per toglierla: file `socialglass/prove-tempo.js` + il suo `<script>` in `index.html`; in `api/benvenuto.js` il blocco «PROVE TECNICHE» (funzione `tempo`, azione `tempo`, campo `barraTempo`); in `app.js` la riga `window.SG_PROVE`. Il campo `ProveGiorni` dei clienti di prova sparisce con loro.
- Prova locale: `prove-socialglass/tempo.py [riscatta|restituisci|rinnova]` (PC, tablet, telefono e laboratorio).

## In sospeso (decide Stefano)
- Idee rimandate: 4 mappa delle ottiche, 8 prova virtuale dal vivo; punti UX 4, 5, 7 della lista del 12/11 (ordine consegnato compatto, icone in fondo, home con soli 3 passi).
- IBAN/bonifico ai partner: rimandato. Nessun rimborso automatico sul recesso.
- WhatsApp/SMS automatici: codice pronto, servono gli account (WhatsApp Business o Twilio) e le chiavi come secrets; poi «Prova dei messaggi» in Impostazioni.
- Da provare una volta con Stripe vero (carta di prova 4242…): cambia carta/ricevute, rinnovo che prosegue senza ripagare, riscatto addebitato, restituzione che chiude a fine mese.
- Clienti di prova sul sito vero: SGPROVAREC, SGPROVAANN, SGPROVARIT, SGPROVALAB, SGPROVAVOT (workflow `socialglass-dati-prova`, azione `clienti-elimina` per toglierli).

## Prove in locale
Cartella `prove-socialglass/` (vedi il suo README).
