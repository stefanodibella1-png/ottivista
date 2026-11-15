# punti 1-2 cliccati: verifica anagrafica di un cliente di un altro CAF, rinnovo con codice cliente; ottica: rinnovo con codice (srv24.js)
import asyncio
from playwright.async_api import async_playwright
B = "http://localhost:8823/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        for w, h in [(390, 844), (1280, 900)]:
            tel = w < 500
            c = await b.new_page(viewport={"width": w, "height": h}, is_mobile=tel, has_touch=tel); c.on("pageerror", lambda e: E.append(str(e)))
            await c.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
            await c.goto(B + "caf"); await c.wait_for_timeout(900)
            dlg = c.locator(".popup:not([hidden])").first
            if not await dlg.count(): await c.click("#loginButton"); await c.wait_for_timeout(400); dlg = c.locator(".popup:not([hidden])").first
            await dlg.locator("input:not([type=hidden])").nth(0).fill("CAF002"); await dlg.locator("input[type=password]").fill("demo2"); await dlg.locator("input[type=password]").press("Enter"); await c.wait_for_timeout(1600)
            t = c.locator('[data-open="codiceFiscalePopup"]').first
            cf = "RSSMRA80A01C351O" if tel else "BNCLGU75B12C351C"
            await t.evaluate('e => e.click()'); await c.wait_for_timeout(300); await c.fill("#cfVerifica", cf); await c.locator("#formVerifica button[type=submit]").click(); await c.wait_for_timeout(900)
            testo = await c.inner_text("#verificaEsito"); print(w, cf, "→", testo.replace("\n", " · ")[:300])
            print("   dati personali visibili:", any(x in testo for x in ["MARIO", "Mario", "Luigi", "SGP24", "consegnato", "Durata"]))
            await c.screenshot(path=f"ui24_verifica_{w}.png")
            if tel:
                await c.click("[data-cf-rinnovo]"); await c.wait_for_timeout(1200)
                print("   campo codice visibile:", await c.is_visible("#rinnovoCodice"))
                await c.select_option("#rinnovoOttica", "OTT12")
                await c.click("#rinnovoAvvia"); await c.wait_for_timeout(500); print("   senza codice:", (await c.inner_text("#rinnovoEsito"))[-120:].replace("\n", " "))
                await c.fill("#rinnovoCodice", "SGP24A00X"); await c.click("#rinnovoAvvia"); await c.wait_for_timeout(900); print("   codice sbagliato:", (await c.inner_text("#rinnovoEsito"))[-110:].replace("\n", " "))
                await c.screenshot(path="ui24_rinnovo_tel.png")
                await c.fill("#rinnovoCodice", "SGP24A001"); await c.click("#rinnovoAvvia"); await c.wait_for_timeout(1200)
                print("   codice giusto → link inviato:", await c.is_visible("#inviatoPopup"), (await c.inner_text("#inviatoCodice")) if await c.is_visible("#inviatoPopup") else "")
            await c.close()
        # ottica OTT07 rinnova la cliente di OTT12 (tablet)
        o = await b.new_page(viewport={"width": 820, "height": 1180}, has_touch=True); o.on("pageerror", lambda e: E.append(str(e)))
        await o.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await o.goto(B + "ottico"); await o.wait_for_timeout(1000)
        await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.locator('[data-open="ordinePopup"]').first.click(); await o.wait_for_timeout(500)
        await o.click(".rinnovo-cf summary"); await o.fill("#rinnovoCf", "VRDNNA90C41C351H"); await o.click("#formRinnovoCf button[type=submit]"); await o.wait_for_timeout(900)
        print("ottica senza codice:", (await o.inner_text("#ordineEsito"))[:160].replace("\n", " "))
        await o.fill("#rinnovoCfCodice", "SGP24C003"); await o.click("#formRinnovoCf button[type=submit]"); await o.wait_for_timeout(1200)
        print("ottica con codice:", (await o.inner_text("#ordineEsito"))[:160].replace("\n", " "))
        await o.screenshot(path="ui24_ottica.png")
        # verifica per codice (assistenza): cliente di un'altra ottica
        print("errori:", E); await b.close()
asyncio.run(main())
