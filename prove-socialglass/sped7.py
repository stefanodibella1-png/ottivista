# Modifica 7: spedizione all'ottica, arrivo e consegna con controllo del codice
import sys; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def lab(uv, az, **k): s,r=call("api/ordine",{"univoco":uv,"azione":az,**k},Lb); return r.get("errore") or "ok"
def ott(uv, az, **k): s,r=call("api/ordine",{"univoco":uv,"azione":az,**k},T); return r.get("errore") or "ok"
def st(uv): c=scheda(uv); return c["stato"], (c["ordine"].get("lab") or {}).get("stato")
uv=nuovo("PRVGLI60A41C351","GIULIA","SG-1044")
print("1 montatura chiesta all'ottica:", lab(uv,"richiedi"), "| ottica la consegna al corriere:", ott(uv,"montaturaSpedita"), "| il lab vede spedita:", bool(scheda(uv)["ordine"]["lab"].get("spedita")))
print("  arriva una montatura sbagliata:", lab(uv,"disponibile",codice="SG-1042"))
print("  senza codice:", lab(uv,"disponibile"))
print("  quella giusta (scansione con spazi):", lab(uv,"disponibile",codice=" sg-1044 "), "| lab:", st(uv)[1])
print("2 inizio:", lab(uv,"inizia"), "| solo pronto:", lab(uv,"pronto"), "| stato:", st(uv))
print("  l'ottica prova a consegnare:", ott(uv,"consegnato",codice=uv[-4:]))
print("  spedito:", lab(uv,"spedito"), "| stato:", st(uv), "| di nuovo:", lab(uv,"spedito"))
print("3 occhiale arrivato in ottica:", ott(uv,"arrivato"), "| stato:", st(uv), "| di nuovo:", ott(uv,"arrivato"))
print("4 consegna senza codice:", ott(uv,"consegnato"))
print("  codice sbagliato:", ott(uv,"consegnato",codice="1234"))
print("  ultime 4 cifre:", ott(uv,"consegnato",codice=uv[-4:].lower()), "| stato:", st(uv))
uv2=nuovo("PRVLRA60A41C351","LAURA","SG-1042")
print("5 copia del laboratorio, pronto e spedito in un tocco:", lab(uv2,"disponibile"), lab(uv2,"inizia"), lab(uv2,"pronto",spedisci=True), "| stato:", st(uv2))
print("  arrivato:", ott(uv2,"arrivato"), "| consegna con la tessera (link completo):", ott(uv2,"consegnato",codice=f"https://www.socialglass.it/?Univoco={uv2}"), "| stato:", st(uv2))
c=scheda(uv2); print("6 storico:"); [print("   ", p["chi"], "|", p.get("az",""), "|", p["a"]) for p in c["passi"][-4:]]
