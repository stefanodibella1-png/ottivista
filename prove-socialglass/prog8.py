# Modifica 8: altezza di montaggio per le progressive e DP per occhio (API + modulo sul tablet)
import sys, asyncio; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def fino_alla_montatura(base, nome, mont):
    s,r=call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"documento":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)
    uv=r["univoco"]; call("api/montatura",{"univoco":uv,"codice":mont}); call("api/benvenuto",{"azione":"consenso","univoco":uv,"si":True}); return uv
def prev(uv, lente, **rx):
    ric={"OD":{"sf":-1,"add":2},"OS":{"sf":-1,"add":2},"pd":63, **rx}
    s,r=call("api/ordine",{"univoco":uv,"lente":lente,"trattamenti":[],"ricetta":ric},T); return r.get("errore") or "ok"
uv=fino_alla_montatura("PRVNNA60A41C351","ANNA","SG-1042")
print("1 progressive senza altezza:", prev(uv,"prog"))
print("  altezza solo destra:", prev(uv,"prog",h={"OD":22}))
print("  altezza fuori misura:", prev(uv,"prog",h={"OD":22,"OS":55}))
print("  DP per occhio fuori misura:", prev(uv,"prog",h={"OD":22,"OS":22},pdm={"OD":50}))
print("  completa (22 / 21,5 e DP 31,5 / 32):", prev(uv,"prog",h={"OD":"22","OS":"21,5"},pdm={"OD":"31,5","OS":32}), "|", {k: scheda(uv)["ordine"]["ricetta"].get(k) for k in ("h","pdm")})
uv2=fino_alla_montatura("PRVLSE60A41C351","ELISA","SG-1043")
print("2 monofocali senza altezza:", prev(uv2,"mono"))
from playwright.async_api import async_playwright
async def ui():
    uv3=fino_alla_montatura("PRVTRS60A41C351","TERESA","SG-1044")
    async with async_playwright() as p:
        b=await p.chromium.launch(); o=await b.new_page(viewport={"width":820,"height":1180}); E=[]; o.on("pageerror", lambda e: E.append(str(e)))
        await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.click("#cruOtt .cru-principale button"); await o.wait_for_timeout(500); await o.fill("#ordineCodice", uv3); await o.click("#formOrdineCerca button"); await o.wait_for_timeout(1000)
        print("3 tablet · riga altezza con monofocali visibile:", await o.is_visible("#rigaAlt"))
        await o.locator("#ordineLenti label").filter(has_text="Progressive").first.click(); await o.wait_for_timeout(300)
        print("  con progressive visibile:", await o.is_visible("#rigaAlt"))
        for k,v in {"OD_sf":"-1","OS_sf":"-1","OD_add":"2","OS_add":"2","pd":"63"}.items(): await o.fill(f"#formOrdine [name={k}]", v)
        await o.click("#ordineInvia"); await o.wait_for_timeout(600); print("  invio senza altezza:", (await o.inner_text("#ordineErr")).strip()[:90])
        await o.fill("[name=h_OD]","22"); await o.fill("[name=h_OS]","22"); await o.screenshot(path="prog8_tablet.png", full_page=True)
        await o.click("#ordineInvia"); await o.wait_for_timeout(1500); print("  con altezza:", "Ordine inviato" in await o.inner_text("body"), "| errori JS:", E)
        await b.close()
asyncio.run(ui())
