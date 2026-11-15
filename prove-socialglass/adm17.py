import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        a = await b.new_page(viewport={"width": 1200, "height": 900}); a.on("pageerror", lambda e: E.append(str(e)))
        await a.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await a.goto("http://localhost:8823/admin"); await a.wait_for_timeout(900)
        await a.fill("#admPw", "passwordlunga1"); await a.press("#admPw", "Enter"); await a.wait_for_timeout(1500)
        if await a.query_selector("#admPw2"): await a.fill("#admPw2", "passwordlunga1"); await a.press("#admPw2", "Enter"); await a.wait_for_timeout(1500)
        await a.click(".schede-adm [data-tab=impostazioni]"); await a.wait_for_timeout(900)
        btn = a.locator("[data-prova]"); await btn.scroll_into_view_if_needed(); print("pulsante:", await btn.inner_text())
        await btn.click(); await a.wait_for_timeout(900)
        box = a.locator("#provaElenco"); print("elenco:", (await box.inner_text())[:500])
        await box.locator("..").screenshot(path="a17_pulizia.png")
        # tolgo la spunta a GIULIA (rinnovo) e rimuovo
        await a.locator("[data-prova-cliente=SGRIN17P1]").uncheck()
        await btn.click(); await a.wait_for_timeout(1200)
        print("messaggio:", (await a.inner_text("#admMsg")).strip())
        print("errori:", E)
        await b.close()
asyncio.run(main())
