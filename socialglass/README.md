# SocialGlass – Visione condivisa (ricostruzione 2026)

Ricostruito dalle copie archiviate di socialglass.it: stesso design e stesso percorso, con le chiavi spostate sul server.

## Percorso
1. **CAF**: LOGIN CAF → inserisci nuovo utente (controllo codice fiscale, ottica convenzionata, GDPR) → link personale via SMS o WhatsApp.
2. **Cliente**: apre il link → benvenuto con ottico e codice → dall'ottico preme «Ho scelto la montatura» e inquadra il QR sull'espositore.
3. **Ottico**: OTTICO → assistenza utente (ricerca per codice).

## Pubblicazione su Vercel
Importa la cartella `socialglass` come progetto (Root Directory: `socialglass`). Variabili d'ambiente:

| Variabile | Valore |
|---|---|
| `AIRTABLE_TOKEN` | nuovo token Airtable (lettura e scrittura sulle due basi). Senza, il sito gira con dati di prova |
| `SESSION_SECRET` | una stringa casuale lunga |
| `SITE_URL` | es. `https://www.socialglass.it` |
| `STRIPE_SECRET_KEY` | chiave segreta Stripe (rate mensili). Senza, l'attivazione delle rate è simulata |
| `STRIPE_WEBHOOK_SECRET` | segreto del webhook Stripe puntato a `/api/stripe-webhook` (eventi `checkout.session.completed`, `invoice.payment_failed`) |
| `SMS_WEBHOOK_URL` | facoltativo: indirizzo che riceve `{to, text}` e invia l'SMS. Senza, il CAF invia il link su WhatsApp |
| `AIRTABLE_BASE_MAIN`, `AIRTABLE_BASE_MONTATURE`, `T_*` | solo se le basi o le tabelle hanno nomi diversi da quelli originali |

## Immagini da inserire in `assets/`
`sfondo-socialglass.jpg`, `sfondo-mobile-socialglass.jpg`, `solo-scritto.png`, `simbolo.png`, `logo-social-glass.png`. Finché mancano, la pagina usa segnaposto.

## Sicurezza rispetto al sito originale
La vecchia chiave Airtable era scritta nelle pagine pubbliche: va revocata. Ora password e dati dei clienti si leggono solo dal server, gli accessi hanno un limite di tentativi e le sessioni sono firmate.

## Percorso completo (2026)
1. CAF registra il cliente → link personale (SMS/WhatsApp).
2. Cliente dall'ottico: «Ho scelto la montatura» → QR → montatura RISERVATA.
3. Ottico: ORDINE CLIENTE → lenti, trattamenti, ricetta, PD → prezzo dal listino della convenzione (`listini.js`).
4. Cliente: riepilogo, 12 rate senza interessi, consensi → Stripe (carta o SEPA). Prima rata + spedizione subito, poi mensile; dopo 12 mesi l'addebito si ferma.
5. Ottico: «Segna pronto» → «Segna consegnato». CAF: «Rinnovo» dopo 12 mesi.

## Airtable: campo da aggiungere
Nella tabella **Utenti** aggiungi un campo **Ordine** (tipo *Testo lungo*): contiene montatura, lenti, ricetta, prezzi e pagamento.
Nella tabella **Ottici** puoi aggiungere **Telefono**. Nella tabella montature puoi aggiungere **Prezzo** (se manca vale il prezzo montatura del listino).
