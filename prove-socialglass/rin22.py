import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        c = await b.new_page(viewport={"width": 1280, "height": 900}); c.on("pageerror", lambda e: E.append(str(e)))
        await c.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await c.goto("http://localhost:8823/"); await c.wait_for_timeout(800); await c.click("#loginButton"); await c.wait_for_timeout(400)
        dlg = c.locator(".popup:not([hidden])").first; await dlg.locator("input:not([type=hidden])").nth(0).fill("CAF001"); await dlg.locator("input[type=password]").fill("demo"); await dlg.locator("input[type=password]").press("Enter"); await c.wait_for_timeout(1800)
        await c.locator('[data-open="rinnovoPopup"]').first.evaluate("e => e.click()"); await c.wait_for_timeout(300)
        await c.fill("#cfRinnovo", "VRDNNA90C41C351H"); await c.locator("#formRinnovo button[type=submit]").click(); await c.wait_for_timeout(1500)
        print("rinnovo:", (await c.inner_text("#rinnovoEsito")).replace("\n", " · ")[:500]); print("pulsante:", await c.inner_text("#rinnovoAvvia"))
        await c.locator("#rinnovoPopup .popup-content").screenshot(path="rin22.png")
        await c.click("#rinnovoAvvia"); await c.wait_for_timeout(300); print("dopo 1° tocco:", await c.inner_text("#rinnovoAvvia"))
        await c.click("#rinnovoAvvia"); await c.wait_for_timeout(1500); print("dopo conferma:", (await c.inner_text("body"))[:0], await c.locator(".popup:not([hidden]) h2").first.inner_text())
        # moroso nel rinnovo
        await c.locator('[data-open="rinnovoPopup"]').first.evaluate("e => e.click()"); await c.wait_for_timeout(300)
        await c.fill("#cfRinnovo", "BNCLGU75B12C351C"); await c.locator("#formRinnovo button[type=submit]").click(); await c.wait_for_timeout(1200)
        print("moroso:", (await c.inner_text("#rinnovoEsito")).split("\n")[0], "| scelta ottica visibile:", await c.is_visible("#rinnovoScelta"))
        # nuovo cliente: spunta documento
        await c.locator('[data-open="popupForm"]').first.evaluate("e => e.click()"); await c.wait_for_timeout(500)
        print("spunta documento presente:", await c.locator("#docVerificato").count())
        await c.locator("#popupForm .popup-content").screenshot(path="nuovo22.png")
        print("errori:", E); await b.close()
asyncio.run(main())
