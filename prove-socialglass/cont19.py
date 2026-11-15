import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        a = await b.new_page(viewport={"width": 1280, "height": 900}); a.on("pageerror", lambda e: E.append(str(e)))
        await a.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await a.goto("http://localhost:8823/admin"); await a.wait_for_timeout(900)
        await a.fill("#admPw", "passwordlunga1"); await a.press("#admPw", "Enter"); await a.wait_for_timeout(1500)
        if await a.query_selector("#admPw2"): await a.fill("#admPw2", "passwordlunga1"); await a.press("#admPw2", "Enter"); await a.wait_for_timeout(1500)
        await a.click(".schede-adm [data-tab=conteggi]"); await a.wait_for_timeout(1200)
        t = a.locator("table.rx", has_text="Da liquidare").first; await t.scroll_into_view_if_needed(); print((await t.inner_text())[:600])
        await t.screenshot(path="cont19_admin.png")
        # estratto del CAF dal suo pannello
        c = await b.new_page(viewport={"width": 1280, "height": 900}); c.on("pageerror", lambda e: E.append(str(e)))
        await c.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await c.goto("http://localhost:8823/"); await c.wait_for_timeout(800); await c.click("#loginButton"); await c.wait_for_timeout(400)
        dlg = c.locator(".popup:not([hidden])").first; await dlg.locator("input:not([type=hidden])").nth(0).fill("CAF001"); await dlg.locator("input[type=password]").fill("demo"); await dlg.locator("input[type=password]").press("Enter"); await c.wait_for_timeout(1800)
        k = c.locator("[data-conti]").first
        if await k.count():
            await k.click(); await c.wait_for_timeout(1500); x = await c.inner_text("body"); i = x.find("Saldo a inizio"); print("CAF:", x[i:i+500])
            await c.screenshot(path="cont19_caf.png")
        print("errori:", E); await b.close()
asyncio.run(main())
