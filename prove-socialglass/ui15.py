# Modifica 15 cliccata: fotocamera alla consegna (ottica) e all'arrivo della montatura (laboratorio), nuova riga delle buste
import sys, asyncio; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
from playwright.async_api import async_playwright
uv=nuovo("PRVGLI60A41C351","GIULIA","SG-1042")
call("api/ordine",{"univoco":uv,"azione":"richiedi"},Lb); call("api/ordine",{"univoco":uv,"azione":"montaturaSpedita"},T)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-fake-device-for-media-stream","--use-fake-ui-for-media-stream"]); E=[]
        # laboratorio: riga della busta, fotocamera, codice
        l=await b.new_page(viewport={"width":1280,"height":900}); l.on("pageerror", lambda e: E.append("lab "+str(e)))
        await l.context.grant_permissions(["camera"])
        await l.goto(B+"laboratorio"); await l.wait_for_timeout(600); await l.fill("#pw","laboratorio1"); await l.click("#fLogin button"); await l.wait_for_timeout(1200)
        await l.click("[data-f=arrivo]"); await l.wait_for_timeout(400)
        w=l.locator(f".busta-w[data-u={uv}]"); await w.screenshot(path="u15_riga.png")
        print("1 riga: pulsanti fuori dal titolo:", await w.locator("summary button").count()==0, "| pulsanti sulla riga:", [ (await x.inner_text()).strip() for x in await w.locator(".busta-az button").all()])
        await w.locator(".busta-sel").click(); print("  casella: busta resta chiusa:", await w.locator("details").get_attribute("open") is None, "| selezionate:", (await l.inner_text("#stampaSel")).strip())
        await w.locator("summary b").click(); await l.wait_for_timeout(300); print("  clic sul titolo apre:", await w.locator("details").get_attribute("open") is not None)
        await w.locator("[data-arrivo]").click(); await l.wait_for_timeout(500)
        await l.locator("[data-scan-mont]").click(); await l.wait_for_timeout(1500)
        print("2 lab · fotocamera aperta:", await l.is_visible("#scanLab"), "| testo:", (await l.inner_text("#scanLabT")).strip()); await l.screenshot(path="u15_lab_scan.png")
        await l.keyboard.press("Escape"); await l.wait_for_timeout(300); print("  Esc chiude:", await l.locator("#scanLab").count()==0)
        await l.fill("#codMont","SG-1042"); await l.locator(f"[data-az=disponibile][data-u={uv}]").click(); await l.wait_for_timeout(1200); print("  codice a mano:", (await l.inner_text(".msg")).strip()[:70])
        call("api/ordine",{"univoco":uv,"azione":"inizia"},Lb); call("api/ordine",{"univoco":uv,"azione":"pronto","spedisci":True},Lb); call("api/ordine",{"univoco":uv,"azione":"arrivato"},T)
        # ottica: consegna con la fotocamera (codice scritto nel lettore, come se il QR fosse letto)
        o=await b.new_page(viewport={"width":820,"height":1180}); o.on("pageerror", lambda e: E.append("ott "+str(e))); await o.context.grant_permissions(["camera"])
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={uv}]"); await card.evaluate("d => d.open = true")
        await card.locator("[data-consegna]").click(); await o.wait_for_timeout(300); await o.locator("#boxCons").screenshot(path="u15_consegna.png")
        await o.click("[data-scan-cons]"); await o.wait_for_timeout(1500)
        print("3 ottica · lettore aperto:", await o.is_visible("#video-container"), "| testo:", (await o.inner_text("#video-container p")).strip()[:60], "| etichetta:", (await o.inner_text("label[for=codiceManuale]")).strip()[:60])
        print("  la scheda clienti resta sotto:", await o.is_visible("#clientiPopup"))
        await o.keyboard.press("Escape"); await o.wait_for_timeout(300); print("  Esc chiude solo il lettore:", await o.is_hidden("#video-container"), "| scheda ancora aperta:", await o.is_visible("#clientiPopup"))
        await o.click("[data-scan-cons]"); await o.wait_for_timeout(1000)
        await o.fill("#codiceManuale", f"https://www.socialglass.it/?Univoco={uv}"); await o.locator("#formManuale button").click(); await o.wait_for_timeout(1500)
        print("  QR della tessera → consegna:", (await o.inner_text("#demoNota")).strip()[:60], "|", scheda(uv)["stato"])
        # cliente: il lettore normale della montatura non è cambiato
        c=await b.new_page(viewport={"width":390,"height":844}); await c.context.grant_permissions(["camera"]); c.on("pageerror", lambda e: E.append("cli "+str(e)))
        uv2=call("api/utenti",{"cf":cf("PRVMRT60A41C351"),"nome":"MARTA","cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"documento":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)[1]["univoco"]
        await c.goto(B+"?Univoco="+uv2); await c.wait_for_timeout(1500); await c.click("#mpScan"); await c.wait_for_timeout(1000)
        print("4 cliente · lettore:", (await c.inner_text("#video-container p")).strip()[:60], "| etichetta:", (await c.inner_text("label[for=codiceManuale]")).strip()[:60])
        print("errori:", E); await b.close()
asyncio.run(main())
