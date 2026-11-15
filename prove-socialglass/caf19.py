import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        for ruolo, cod in [("caf", "CAF001"), ("ottico", "OTT07")]:
            pg = await b.new_page(viewport={"width": 1280, "height": 900}); pg.on("pageerror", lambda e: E.append(str(e)))
            await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
            await pg.goto("http://localhost:8823/"); await pg.wait_for_timeout(800)
            await pg.click("#loginButton" if ruolo == "caf" else "#otticoButton"); await pg.wait_for_timeout(500)
            dlg = pg.locator(".popup:not([hidden])").first
            await dlg.locator("input:not([type=hidden])").nth(0).fill(cod); await dlg.locator("input[type=password]").fill("demo"); await dlg.locator("input[type=password]").press("Enter"); await pg.wait_for_timeout(1800)
            cru = await pg.inner_text("body"); print(f"== {ruolo}: cruscotto con «Avvisi da inviare»:", "Avvisi da inviare ai clienti" in cru)
            await pg.locator("[data-clienti]").first.click(); await pg.wait_for_timeout(1500)
            for uv in ["SGCAF19A", "SGCAF19B", "SGCAF19C"]:
                d = pg.locator(f'#clientiLista details[data-u="{uv}"]')
                if not await d.count(): print("  ", uv, "non in elenco"); continue
                await d.locator("summary").click(); await pg.wait_for_timeout(250)
                t = await d.inner_text()
                print(f"   {uv}: reinvia link={'Reinvia link' in t} | avviso WhatsApp={'Invia su WhatsApp' in t} | chip AVVISO={'AVVISO' in t} | bloccato={'BLOCCATO' in t}")
            opz = await pg.evaluate("[...document.querySelectorAll('#filtroSit option')].filter(o=>!o.hidden).map(o=>o.value).join(',')")
            print("   filtri visibili:", opz)
            await pg.screenshot(path=f"c19_{ruolo}.png", full_page=False)
        print("errori:", E); await b.close()
asyncio.run(main())
