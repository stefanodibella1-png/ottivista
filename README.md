# OttiVista

Prova occhiali virtuale in tempo reale nel browser: fotocamera frontale, tracciamento del viso (MediaPipe Face Landmarker, 478 punti con iride), montature 3D (Three.js) in scala reale, misura della distanza pupillare dall'iride, forma del viso e calibro consigliato.

## Pubblicazione
Sito statico: `index.html` + cartella `models/`. Su Vercel: *Add New → Project → Import* di questo repository, nessuna configurazione. Serve HTTPS per la fotocamera (Vercel lo fornisce).

## Crediti modelli 3D (CC BY 4.0)
- "Glasses" (https://sketchfab.com/3d-models/glasses-bb3c64e9e8404ef38a2ca0cdedc0a8b4) di andlipin1 (https://sketchfab.com/andlipin1), licenza CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Convertito in millimetri.
- "Glasses 08" (https://sketchfab.com/3d-models/glasses-08-79436d34fb2b471e8861fa9d002b082f) di Dokono Kinokoda (https://sketchfab.com/JunkWren), licenza CC-BY-4.0 (http://creativecommons.org/licenses/by/4.0/). Convertito in millimetri e alleggerito (da 210.000 a 46.000 triangoli).
