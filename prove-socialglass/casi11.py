# Modifica 11: coda dei casi da risolvere, rimborso con Stripe, restituzione con stato, rinnovo bloccato da segnalazione, restituzione mancata (D3)
# Server: CRON_SECRET=prova STRIPE_WEBHOOK_SECRET=whsec_prova node srv-viaggio.js  (macchina del tempo su :8824)
import sys, asyncio, urllib.request; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
from crea_cliente import crea
def adm(az, **k): s,r=call("api/admin",{"azione":az,**k},A); return r
def coda(): return adm("dati")["coda"]
def casi(uv): return [(x["tipo"], x["scaduto"]) for x in coda() if x["univoco"]==uv]
def tempo(uv, **q): urllib.request.urlopen("http://localhost:8824/?u="+uv+"".join(f"&{k}={v}" for k,v in q.items())).read()
def notte():
    r=urllib.request.Request(B+"api/scadenze?tutto=1", headers={"Authorization":"Bearer prova"}); import json as J; return [e for e in J.load(urllib.request.urlopen(r))["esiti"] if e.get("univoco")]
def ott(uv, az, **k): s,r=call("api/ordine",{"univoco":uv,"azione":az,**k},T); return r.get("errore") or "ok"

for m in ["SG-1042","SG-1043","SG-1044"]: adm("magazzino",codice=m,op="carico",qta=6,a="OTT07")
print("A — rimborso del recesso (D2)")
uv=nuovo("PRVGLI60A41C351","GIULIA","SG-1042")
print("1 recesso:", ott(uv,"recesso"), "| in coda:", casi(uv))
r=adm("rimborsa",id=uv); print("  rimborsa (prova senza Stripe):", r.get("ok"), r.get("importo"), "| coda:", casi(uv), "| di nuovo:", adm("rimborsa",id=uv).get("errore"))
print("  esito:", scheda(uv)["ordine"]["pagamento"]["esito"])

print("B — restituzione mancata (D3)")
uvC=crea("PRVCRL60A41C351","CARLA","PROVA","1960-01-01","F","SG-1044")
print("2 contratto con clausola:", scheda(uvC)["ordine"]["consensi"].get("versione"))
tempo(uvC, insoluto=35); print("  canone non pagato da 35 giorni → coda:", casi(uvC))
print("  notte:", [e.get("esito") for e in notte() if e["univoco"]==uvC], "| esito:", scheda(uvC)["ordine"]["pagamento"].get("esito"), "| coda:", casi(uvC))
tempo(uvC, giorni=20); print("3 dopo 20 giorni → notte:", [e.get("esito") for e in notte() if e["univoco"]==uvC], "| coda:", casi(uvC), [x["dettaglio"] for x in coda() if x["univoco"]==uvC])
tempo(uvC, giorni=4); print("  24 giorni, addebito spento → notte:", [e.get("esito") for e in notte() if e["univoco"]==uvC])
print("  accendo l'addebito:", adm("addebitoUsato",attivo=True), "→ notte:", [e.get("esito") for e in notte() if e["univoco"]==uvC], "| di nuovo:", [e.get("esito") for e in notte() if e["univoco"]==uvC])
tempo(uvC, giorni=7); print("  31 giorni → notte:", [e.get("esito") for e in notte() if e["univoco"]==uvC])
o=scheda(uvC)["ordine"]; print("  esito:", o["pagamento"]["esito"], "| ritiro:", o.get("ritiro"), "| coda:", casi(uvC), "| di nuovo:", [e.get("esito") for e in notte() if e["univoco"]==uvC])
adm("addebitoUsato",attivo=False)

print("C — restituzione con lo stato dell'occhiale")
uvD=crea("PRVDNL60A41C351","DANIELA","PROVA","1960-01-01","F","SG-1043")
tempo(uvD, insoluto=35); notte()
print("4 ritiro senza stato:", ott(uvD,"ritirato"), "| rovinato senza nota:", ott(uvD,"ritirato",condizione="rovinato"))
print("  rovinato con nota:", ott(uvD,"ritirato",condizione="rovinato",nota="lente destra rigata"), "| coda:", casi(uvD))
print("  controllo senza nota:", adm("verificaRestituzione",id=uvD).get("errore"), "| con nota:", adm("verificaRestituzione",id=uvD,nota="lente da sostituire, nessun addebito"), "| coda:", casi(uvD))

print("D — rinnovo bloccato da una segnalazione aperta")
uvE=crea("PRVLNE60A41C351","ELENA","PROVA","1960-01-01","F","SG-1042")
s,r=call("api/benvenuto",{"azione":"segnala","univoco":uvE,"testo":"la vite dell'asta si allenta"}); idS=r["id"]
s,r=call("api/utenti",{"azione":"rinnovo","univoco":uvE},T); print("5 rinnovo con segnalazione aperta:", s, r.get("errore"))
s,r=call("api/utenti",{"azione":"rinnovo","cf":cf("PRVLNE60A41C351")},C); print("  dal CAF:", s, r.get("errore","")[:60])
print("  in coda:", casi(uvE))
s,r=call("api/ordine",{"azione":"segnalazioneRisolta","id":idS,"risposta":"vite stretta in negozio"},T)
s,r=call("api/utenti",{"azione":"rinnovo","univoco":uvE},T); print("  risolta → rinnovo:", s, r.get("errore"))

print("E — coda")
cd=coda(); print("6 casi:", [(x["tipo"], x["univoco"][-4:], "scaduto" if x["scaduto"] else "entro "+x["scadenza"][:10]) for x in cd])
print("  ordinati per scadenza:", [x["scadenza"] for x in cd]==sorted(x["scadenza"] for x in cd))

from playwright.async_api import async_playwright
async def ui():
    uvF=crea("PRVFNC60A41C351","FRANCA","PROVA","1960-01-01","F","SG-1044"); tempo(uvF, insoluto=35); notte()
    uvG=nuovo("PRVMRT60A41C351","MARTA","SG-1043"); ott(uvG,"recesso")
    async with async_playwright() as p:
        b=await p.chromium.launch(); E=[]
        o=await b.new_page(viewport={"width":820,"height":1180}); o.on("pageerror", lambda e: E.append("ott "+str(e)))
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={uvF}]"); await card.evaluate("d => d.open = true"); await o.wait_for_timeout(300)
        await card.locator("[data-ritiro]").click(); await o.wait_for_timeout(300)
        await o.locator("#boxRit label", has_text="Incompleto").click(); await o.locator("#boxRit button").click(); await o.wait_for_timeout(600)
        print("7 tablet · incompleto senza nota:", (await o.inner_text("#demoNota")).strip()[:80])
        for x in await o.locator(".popup:not([hidden]):not(#clientiPopup) [data-close]").all(): await x.click()
        await o.fill("#notaRit","manca l'asta sinistra"); await o.screenshot(path="c11_1_ritiro.png"); await o.locator("#boxRit button").click(); await o.wait_for_timeout(1300)
        print("  conferma:", (await o.inner_text("#demoNota")).strip()[:110])
        a=await b.new_page(viewport={"width":1200,"height":900}); a.on("pageerror", lambda e: E.append("adm "+str(e)))
        await a.goto(B+"admin"); await a.wait_for_timeout(900); await a.fill("#admPw","passwordlunga1"); await a.press("#admPw","Enter"); await a.wait_for_timeout(1500)
        print("8 pannello · voce in Da fare:", (await a.locator("[data-vai-coda]").inner_text()).replace("\n"," ")[:120])
        await a.click("[data-vai-coda]"); await a.wait_for_timeout(600); await a.locator("#admCoda").screenshot(path="c11_2_coda.png")
        print("  casi nel riquadro:", await a.locator("#admCoda .riga-cli").count())
        await a.locator(f"#admCoda [data-scheda={uvG}]").first.click(); await a.wait_for_timeout(1000)
        rb=a.locator("[data-rimborsa]"); await rb.click(); print("  rimborsa:", (await rb.inner_text()).strip()); await rb.click(); await a.wait_for_timeout(1300)
        print("  esito:", (await a.inner_text("#admMsg")).strip())
        await a.click("[data-chiudi-scheda]"); await a.wait_for_timeout(500); await a.click(".schede-adm [data-tab=numeri]"); await a.wait_for_timeout(900)
        await a.locator(f"#admCoda [data-scheda={uvF}]").first.click(); await a.wait_for_timeout(1000)
        await a.fill("[data-f=verificaRestituzione] input[name=nota]","asta da ordinare al fornitore"); await a.click("[data-f=verificaRestituzione] button"); await a.wait_for_timeout(1000)
        print("9 controllo restituzione:", (await a.inner_text("#admMsg")).strip())
        await a.click("[data-chiudi-scheda]"); await a.wait_for_timeout(500); await a.click(".schede-adm [data-tab=impostazioni]"); await a.wait_for_timeout(900)
        print("10 interruttore D3:", (await a.locator("[data-addebito-usato]").locator("xpath=..").inner_text()).strip())
        print("errori pagina:", E); await b.close()
asyncio.run(ui())
