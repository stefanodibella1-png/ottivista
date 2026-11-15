import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        for w,h in [(1280,900)]:
            c = await b.new_page(viewport={"width": w, "height": h}, is_mobile=w<500, has_touch=w<500); c.on("pageerror", lambda e: E.append(str(e)))
            await c.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
            await c.goto("http://localhost:8823/?caf=1" if w < 500 else "http://localhost:8823/"); await c.wait_for_timeout(900)
            if await c.locator("#loginButton").is_visible(): await c.click("#loginButton")
            else: await c.evaluate("open('loginPopup')") 
            await c.wait_for_timeout(400)
            dlg = c.locator(".popup:not([hidden])").first; await dlg.locator("input:not([type=hidden])").nth(0).fill("CAF001"); await dlg.locator("input[type=password]").fill("demo"); await dlg.locator("input[type=password]").press("Enter"); await c.wait_for_timeout(1800)
            t = c.locator('[data-open="codiceFiscalePopup"]').first; print(w, "tessera:", (await t.inner_text()).replace("\n", " | "))
            for cf in ["RSSMRA80A01C351X", "GLLSRA70E50C351Y", "RSSMRA80A01C351O", "BNCLGU75B12C351C", "VRDNNA90C41C351H", "NREPLA85D15C351U"]:
                await t.evaluate('e => e.click()'); await c.wait_for_timeout(300); await c.fill("#cfVerifica", cf); await c.locator("#formVerifica button[type=submit]").click(); await c.wait_for_timeout(900)
                print("  ", cf, "→", (await c.inner_text("#verificaEsito")).replace("\n", " · ")[:260])
                if w > 500: await c.locator("#codiceFiscalePopup .popup-content").screenshot(path=f"cf20_{cf}.png")
                if cf == "VRDNNA90C41C351H" and w > 500:
                    await c.click("[data-cf-rinnovo]"); await c.wait_for_timeout(1000); print("     → rinnovo:", (await c.inner_text("#rinnovoEsito"))[:150])
                if cf == "GLLSRA70E50C351Y" and w > 500:
                    await c.click("[data-cf-nuovo]"); await c.wait_for_timeout(800); print("     → nuovo cliente, CF precompilato:", await c.input_value("#codiceFiscale"), "| popup:", await c.is_visible("#popupForm"))
                for _ in range(3):
                    if await t.is_visible(): break
                    await c.keyboard.press("Escape"); await c.wait_for_timeout(300)
            await c.set_viewport_size({"width": 390, "height": 844}); await c.wait_for_timeout(400)
            if True: await t.evaluate('e => e.click()'); await c.fill("#cfVerifica", "BNCLGU75B12C351C"); await c.locator("#formVerifica button[type=submit]").click(); await c.wait_for_timeout(900); await c.screenshot(path="cf20_tel.png")
        print("errori:", E); await b.close()
asyncio.run(main())
