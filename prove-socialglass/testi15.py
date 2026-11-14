# Modifica 15: testi che vede il cliente nei vari momenti (cerca parole tecniche e stati scritti in maiuscolo)
import sys, asyncio, re; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
from playwright.async_api import async_playwright
from crea_cliente import crea
def reg(base,nome):
    return call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)[1]["univoco"]
for m in ["SG-1042","SG-1043","SG-1044"]: call("api/admin",{"azione":"magazzino","codice":m,"op":"carico","qta":6,"a":"OTT07"},A)
u1=reg("PRVGLI60A41C351","GIULIA")
u2=reg("PRVMRT60A41C351","MARTA"); call("api/montatura",{"univoco":u2,"codice":"SG-1042"})
u3=reg("PRVLRA60A41C351","LAURA"); call("api/montatura",{"univoco":u3,"codice":"SG-1043"}); call("api/benvenuto",{"azione":"consenso","univoco":u3,"si":True}); call("api/ordine",{"univoco":u3,"lente":"mono","trattamenti":[],"ricetta":{"OD":{"sf":-1},"OS":{"sf":-1},"pd":63}},T)
u4=nuovo("PRVNNA60A41C351","ANNA","SG-1044")
u5=crea("PRVCRL60A41C351","CARLA","PROVA","1960-01-01","F","SG-1042")
STATI=["casi",(u1,"registrato"),(u2,"montatura scelta"),(u3,"preventivo"),(u4,"in lavorazione"),(u5,"consegnato")]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); c=await b.new_context(viewport={"width":390,"height":844}); pg=await c.new_page()
        for uv,nome in STATI[1:]:
            await pg.goto(B+"?Univoco="+uv); await pg.wait_for_timeout(1500)
            t=" ".join((await pg.inner_text("#miaPagina")).split())
            maiusc=sorted(set(re.findall(r"\b[A-ZÀ-Ú]{4,}(?: [A-ZÀ-Ú\-]{2,})+\b", t)))
            print(f"== {nome}: {t[:700]}\n   PAROLE IN MAIUSCOLO: {maiusc}")
        await b.close()
asyncio.run(main())
