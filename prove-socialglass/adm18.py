import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        for w,h,nome in [(1200,900,"pc"),(390,844,"tel")]:
            a = await b.new_page(viewport={"width": w, "height": h}); a.on("pageerror", lambda e: E.append(str(e)))
            await a.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
            await a.goto("http://localhost:8823/admin"); await a.wait_for_timeout(900)
            await a.fill("#admPw", "passwordlunga1"); await a.press("#admPw", "Enter"); await a.wait_for_timeout(1500)
            if await a.query_selector("#admPw2"): await a.fill("#admPw2", "passwordlunga1"); await a.press("#admPw2", "Enter"); await a.wait_for_timeout(1500)
            box = a.locator("#boxPilota")
            if not await box.count():
                for t in ["oggi","numeri"]:
                    el = a.locator(f".schede-adm [data-tab={t}]")
                    if await el.count(): await el.first.click(); await a.wait_for_timeout(900)
                    if await box.count(): break
            print(nome, "riquadro pilota:", await box.count())
            if nome == "pc":
                await a.click("[data-pilota-inizia]"); await a.wait_for_timeout(1200); print("  messaggio:", (await a.inner_text("#admMsg")).strip())
            await a.click("[data-pilota-controlla]"); await a.wait_for_timeout(1500)
            await box.scroll_into_view_if_needed(); print("  esito:", (await a.inner_text("#pilEsito")).strip()[:200])
            await box.screenshot(path=f"p18_{nome}.png")
            t = await a.inner_text("body"); i = t.find("Pronto per il pubblico"); print("  ", t[i:i+60])
        print("errori:", E); await b.close()
asyncio.run(main())
