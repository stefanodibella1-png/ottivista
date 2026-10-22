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
| `SMS_WEBHOOK_URL` | facoltativo: indirizzo che riceve `{to, text}` e invia l'SMS. Senza, il CAF invia il link su WhatsApp |
| `AIRTABLE_BASE_MAIN`, `AIRTABLE_BASE_MONTATURE`, `T_*` | solo se le basi o le tabelle hanno nomi diversi da quelli originali |

## Immagini da inserire in `assets/`
`sfondo-socialglass.jpg`, `sfondo-mobile-socialglass.jpg`, `solo-scritto.png`, `simbolo.png`, `logo-social-glass.png`. Finché mancano, la pagina usa segnaposto.

## Sicurezza rispetto al sito originale
La vecchia chiave Airtable era scritta nelle pagine pubbliche: va revocata. Ora password e dati dei clienti si leggono solo dal server, gli accessi hanno un limite di tentativi e le sessioni sono firmate.
