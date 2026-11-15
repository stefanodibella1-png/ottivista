# Prompt per ripartire con SocialGlass in una nuova sessione

Copia e incolla il testo qui sotto all'inizio della nuova chat.

```
Riprendiamo SocialGlass. Repo GitHub pubblico stefanodibella1-png/ottivista, cartella socialglass/ (aggiungilo alla sessione con accesso push).
Prima di tutto leggi SOCIALGLASS-PASSAGGIO.md (regole, stato, decisioni, cronologia) e prove-socialglass/README.md (prove locali). Non rileggere altro finché non serve.

Regole fisse:
- Rispondi in italiano, semplice e breve: prima il risultato, poi poche righe. Fai tu tutto ciò che puoi (deploy, configurazioni, prove); a me solo ciò che richiede i miei account.
- Niente chiavi in chat, niente DNS. I secret GitHub li aggiungo io.
- Prima di ogni modifica verifica cosa può rompersi; prova cliccando in locale (Playwright, telefono e PC) prima di pubblicare.
- Massimo 12 funzioni in socialglass/api (i file _* non contano).
- A ogni rilascio aumenta ?v= in index.html e laboratorio.html e aggiorna la riga 14 di SOCIALGLASS-PASSAGGIO.md, più una riga di cronologia.
- Pubblicazione: commit firmato (git commit -S) con le righe di attribuzione, poi
  git fetch --depth=50 origin main && git rebase origin/main && git push origin HEAD:main && git push -f origin main:gh-pages
  e controlla socialglass-deploy e la socialglass-prova partita dopo il rilascio.
- Il repo è pubblico: mai dati o foto di clienti veri in file, log o artifact.
- Oggi tutti i clienti sono di prova (si cancellano al passaggio ai pagamenti veri).

Stato al 15/11/2026: modifiche 1-18 fatte e online. Prova generale sul sito: tutto OK tranne il pagamento SEPA (non attivo su Stripe, decisione mia).
Cosa manca prima del pubblico: vedi la sezione «In sospeso» di SOCIALGLASS-PASSAGGIO.md.

Oggi voglio: <scrivi qui cosa fare>
```
