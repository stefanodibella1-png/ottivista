# Modifica 10 cliccata: laboratorio (annulla, da rifare), ottica (correggi ricetta, da rifare, annulla), pannello (correggi dati, cambia ottica, disattiva)
import sys, asyncio; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
from playwright.async_api import async_playwright
uvA=nuovo("PRVGLI60A41C351","GIULIA","SG-1042")   # per il laboratorio
uvB=nuovo("PRVMRT60A41C351","MARTA","SG-1043")    # correzione ricetta in ottica
uvC=nuovo("PRVLRA60A41C351","LAURA","SG-1044")    # per pannello
B="http://localhost:8823/"
async def ui():
    async with async_playwright() as p:
        b=await p.chromium.launch(); E=[]
        # ---- laboratorio sul PC
        l=await b.new_page(viewport={"width":1280,"height":900}); l.on("pageerror", lambda e: E.append("lab "+str(e)))
        l.on("dialog", lambda d: asyncio.ensure_future(d.accept("lente rigata durante il montaggio")))
        await l.goto(B+"laboratorio"); await l.wait_for_timeout(600); await l.fill("#pw","laboratorio1"); await l.click("#fLogin button"); await l.wait_for_timeout(1200)
        busta=lambda: l.locator(f".busta-w[data-u={uvA}]")
        await busta().locator(".busta-az button", has_text="Montatura disponibile").click(); await l.wait_for_timeout(1000)
        await busta().locator(".busta-az button", has_text="Inizio lavorazione").click(); await l.wait_for_timeout(1000)
        await busta().locator("details").evaluate("d => d.open = true"); await l.wait_for_timeout(300)
        an=busta().locator("[data-annulla]"); print("1 lab · pulsante annulla:", (await an.inner_text()).strip())
        await an.click(); await l.wait_for_timeout(200); print("  conferma:", (await an.inner_text()).strip()); await an.click(); await l.wait_for_timeout(1200)
        print("  esito:", (await l.inner_text(".msg")).strip()[:90])
        for t in ["Inizio lavorazione", "Solo pronto"]:
            x=busta().locator(".busta-az button", has_text=t)
            if await x.count(): await x.first.click(); await l.wait_for_timeout(1000)
        await l.click("[data-f=tutti]"); await l.wait_for_timeout(400)
        await busta().locator("details").evaluate("d => d.open = true"); await l.wait_for_timeout(300)
        await busta().locator("[data-rifare]").click(); await l.wait_for_timeout(1300)
        print("2 lab · da rifare:", (await l.inner_text(".msg")).strip()[:100])
        await l.click("[data-f=tutti]"); await l.wait_for_timeout(400)
        await busta().locator("details").evaluate("d => d.open = true"); await l.wait_for_timeout(300)
        print("  chip:", (await busta().inner_text()).replace("\n"," ")[:140]); await busta().screenshot(path="r10_1_lab.png")
        # ---- ottica sul tablet
        o=await b.new_page(viewport={"width":820,"height":1180}); o.on("pageerror", lambda e: E.append("ott "+str(e)))
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={uvB}]"); await card.locator("summary").click(); await o.wait_for_timeout(300)
        print("3 ottica · pulsanti di MARTA:", [ (await x.inner_text()).strip() for x in await card.locator(".az button").all()])
        await card.locator("[data-ricetta]").click(); await o.wait_for_timeout(1200)
        print("  modulo:", await o.is_visible("#formOrdine"), "| lenti bloccate:", await o.locator("#formOrdine [name=lente]").first.is_disabled(), "| pulsante:", await o.inner_text("#ordineInvia"), "| totale nascosto:", await o.is_hidden("#ordineTotale"))
        await o.fill("#formOrdine [name=OD_sf]", "-1,75"); await o.screenshot(path="r10_2_ricetta.png"); await o.click("#ordineInvia"); await o.wait_for_timeout(1000)
        print("  esito:", (await o.inner_text("#ordineEsito")).strip(), "| OD sf:", scheda(uvB)["ordine"]["ricetta"]["OD"]["sf"])
        # occhiale di GIULIA rifatto: l'ottica vede l'avviso
        await o.goto(B+"ottico"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={uvA}]"); await card.locator("summary").click(); await o.wait_for_timeout(300)
        print("4 ottica · avviso rifacimento:", (await card.locator(".avviso-cli").first.inner_text()).strip()[:110])
        # il lab finisce e spedisce, l'ottica segna arrivato e poi lo annulla
        print("  lab pronto e spedito:", call("api/ordine",{"univoco":uvA,"azione":"pronto","spedisci":True},Lb)[0])
        await o.goto(B+"ottico"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(1200)
        await o.screenshot(path="r10_dbg2.png"); card=o.locator(f"#clientiLista details.cli[data-u={uvA}]"); await card.evaluate("d => d.open = true"); await o.wait_for_timeout(300)
        await card.locator("[data-azione=arrivato]").click(); await o.wait_for_timeout(1500)
        await o.screenshot(path="r10_dbg3.png")
        aperti=[await x.get_attribute("id") for x in await o.locator(".popup:not([hidden])").all()]; print("  finestre aperte dopo «arrivato»:", aperti)
        for pid in aperti:
            if pid!="clientiPopup": await o.locator(f"#{pid} [data-close]").first.click(); await o.wait_for_timeout(300)
        card=o.locator(f"#clientiLista details.cli[data-u={uvA}]"); await card.evaluate("d => d.open = true"); await o.wait_for_timeout(300)
        an=card.locator("[data-annulla]"); print("5 ottica · dopo arrivato:", (await an.inner_text()).strip())
        await an.click(); await an.click(); await o.wait_for_timeout(1300); print("  stato dopo annullo:", scheda(uvA)["stato"], scheda(uvA)["ordine"]["lab"]["stato"])
        await o.screenshot(path="r10_3_ottica.png")
        # ---- pannello
        a=await b.new_page(viewport={"width":1200,"height":900}); a.on("pageerror", lambda e: E.append("adm "+str(e)))
        await a.goto(B+"admin"); await a.wait_for_timeout(900); await a.fill("#admPw","passwordlunga1"); await a.press("#admPw","Enter"); await a.wait_for_timeout(1500)
        await a.click(".schede-adm [data-tab=clienti]"); await a.wait_for_timeout(900); await a.click(f"[data-scheda={uvC}]"); await a.wait_for_timeout(900)
        await a.locator("details.scheda", has_text="Correggi i dati").locator("summary").click()
        print("6 pannello · cf bloccato:", await a.is_disabled("#cdCf"))
        await a.fill("#cdCell","3479998877"); await a.fill("#cdMot","numero sbagliato"); await a.click("[data-f=correggiDati] button[type=submit]"); await a.wait_for_timeout(1200)
        print("  esito:", (await a.inner_text("#admMsg")).strip())
        await a.locator("details.scheda", has_text="Cambia l'ottica").locator("summary").click()
        await a.select_option("#coOtt","OTT12"); await a.click("[data-f=cambiaOttica] button[type=submit]"); await a.wait_for_timeout(1200)
        print("7 cambio ottica (lab da verificare):", (await a.inner_text("#admMsg")).strip()[:120])
        await a.screenshot(path="r10_4_scheda.png", full_page=False)
        await a.click(".schede-adm [data-tab=ottici]"); await a.wait_for_timeout(800)
        cli=a.locator(".lista .cli", has_text="OTT12").first; await cli.locator("details summary", has_text="Disattiva").click()
        await cli.locator("input[name=motivo]").fill("ottica chiusa"); await cli.locator("[data-f=attivaPartner] button").click(); await a.wait_for_timeout(1200)
        print("8 disattiva OTT12:", (await a.inner_text("#admMsg")).strip()[:120])
        cli=a.locator(".lista .cli", has_text="OTT12").first; print("  riquadro:", (await cli.locator(".esito.err").inner_text()).strip()[:60])
        await cli.locator("details summary", has_text="Riattiva").click(); await cli.locator("[data-f=attivaPartner] button").click(); await a.wait_for_timeout(1200)
        print("  riattiva:", (await a.inner_text("#admMsg")).strip())
        print("errori pagina:", E); await b.close()
asyncio.run(ui())
