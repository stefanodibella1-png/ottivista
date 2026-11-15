# punti 5 e 6 cliccati nel pannello: ordine pagato senza busta («Da risolvere»), pagamento al CAF oltre il maturato, occhiali coperti (srv25.js)
import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        for w, h, nome in [(1200, 900, "pc"), (390, 844, "tel")]:
            a = await b.new_page(viewport={"width": w, "height": h}, is_mobile=w < 500, has_touch=w < 500); a.on("pageerror", lambda e: E.append(str(e)))
            await a.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
            await a.goto("http://localhost:8823/admin"); await a.wait_for_timeout(900)
            await a.fill("#admPw", "passwordlunga1"); await a.press("#admPw", "Enter"); await a.wait_for_timeout(1500)
            if await a.query_selector("#admPw2"): await a.fill("#admPw2", "passwordlunga1"); await a.press("#admPw2", "Enter"); await a.wait_for_timeout(1500)
            caso = a.locator("[data-busta]")
            print(nome, "caso «senza busta» in Da risolvere:", await caso.count())
            if nome == "pc":
                await caso.first.click(); await a.wait_for_timeout(300); await a.locator("#admCoda").screenshot(path="adm24_busta.png")
                await a.click("[data-busta-op=crea]"); await a.wait_for_timeout(1200); print("  ", (await a.inner_text("#admMsg")).strip()[:120], "| caso sparito:", not await a.locator("[data-busta]").count())
                # pagamento a mano oltre il maturato
                await a.locator(".schede-adm [data-tab=conteggi]").first.click(); await a.wait_for_timeout(800)
                await a.locator("[data-conto='caf:CAF001']").first.click(); await a.wait_for_timeout(900)
                testo = await a.inner_text("#estrattoAdm"); print("  estratto CAF001:", " ".join(testo.split())[:200])
                await a.fill("#lqI", "999"); await a.fill("#lqN", "prova"); await a.click("form[data-f=liquidazione] button[type=submit]"); await a.wait_for_timeout(900)
                print("  999 €:", (await a.inner_text("#admMsg")).strip()[:140])
                await a.fill("#lqI", "3"); await a.select_option("#lqC", "acconto"); await a.click("form[data-f=liquidazione] button[type=submit]"); await a.wait_for_timeout(1200)
                print("  3 €:", (await a.inner_text("#admMsg")).strip()[:140])
                t = await a.inner_text("body"); i = t.find("Pagamenti nel periodo"); print("  ", " ".join(t[i:i+220].split()))
                await a.screenshot(path="adm24_pagamenti.png", full_page=True)
        print("errori:", E); await b.close()
asyncio.run(main())
