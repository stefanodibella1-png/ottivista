# punto 4 cliccato: conferma con la data di nascita (consenso, attivazione, ricevute, contratto) su telefono e PC (srv.js)
import asyncio
from playwright.async_api import async_playwright
B = "http://localhost:8823/"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        async def pagina(w, h):
            c = await b.new_page(viewport={"width": w, "height": h}, is_mobile=w < 500, has_touch=w < 500); c.on("pageerror", lambda e: E.append(str(e)))
            await c.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort()); return c
        c = await pagina(390, 844)
        await c.goto(B + "?Univoco=SGNUOVO01"); await c.wait_for_timeout(2200)
        print("consenso da dare:", await c.is_visible("#cSanOk"))
        await c.check("#cSan"); await c.click("#cSanOk"); await c.wait_for_timeout(500)
        print("richiesta data di nascita:", await c.is_visible("#confData"))
        await c.screenshot(path="ui24b_conferma_tel.png")
        await c.fill("#confData", "1980-01-01"); await c.click(".conf-ov button[type=submit]"); await c.wait_for_timeout(500)
        print("data sbagliata:", (await c.inner_text("#confErr")))
        await c.fill("#confData", "1974-12-27"); await c.click(".conf-ov button[type=submit]"); await c.wait_for_timeout(1200)
        print("popup chiuso:", not await c.is_visible(".conf-ov"), "| consenso salvato, riquadro sparito:", not await c.is_visible("#cSanOk"))
        await c.goto(B + "?Univoco=SG17897BE"); await c.wait_for_timeout(2200)
        if await c.is_visible("#rsInd"):
            await c.fill("#rsInd", "Via Roma 1"); await c.fill("#rsCap", "95100"); await c.fill("#rsCom", "Catania"); await c.fill("#rsPrv", "CT")
        await c.check("#c1"); await c.check("#c2"); await c.check("#c3"); await c.click("#mpPaga"); await c.wait_for_timeout(900)
        await c.screenshot(path="ui24b_att.png")
        if await c.get_by_role("button", name="Abbonati").count(): await c.get_by_role("button", name="Abbonati").click(); await c.wait_for_timeout(2800)
        print("attivazione (altro cliente) → richiesta:", await c.is_visible("#confData"))
        if await c.is_visible("#confData"): await c.fill("#confData", "1974-12-27"); await c.click(".conf-ov button[type=submit]"); await c.wait_for_timeout(1800)
        print("dopo la conferma:", not await c.is_visible(".conf-ov"), "|", (await c.inner_text("#mpTitolo"))[:80].replace("\n", " "))
        await c.close()
        # PC, dispositivo nuovo: ricevute e contratto chiedono la conferma; Annulla non apre niente
        c = await pagina(1280, 900)
        await c.goto(B + "?Univoco=SG8BA2115"); await c.wait_for_timeout(2200)
        await c.click("#mpRicevute"); await c.wait_for_timeout(600); print("PC ricevute → richiesta:", await c.is_visible("#confData"))
        await c.screenshot(path="ui24b_conferma_pc.png")
        await c.click("[data-conf-no]"); await c.wait_for_timeout(400); print("annulla: popup chiuso", not await c.is_visible(".conf-ov"), "| ricevute aperte:", await c.is_visible("#extraPopup"))
        await c.click("#mpContratto"); await c.wait_for_timeout(500); print("contratto → richiesta:", await c.is_visible("#confData"))
        await c.keyboard.press("Escape"); await c.wait_for_timeout(300); print("Esc chiude solo la conferma:", not await c.is_visible(".conf-ov"), "| pagina cliente ancora aperta:", await c.is_visible("#miaPagina"))
        await c.click("#mpRicevute"); await c.wait_for_timeout(500); await c.fill("#confData", "1974-12-27"); await c.press("#confData", "Enter"); await c.wait_for_timeout(900)
        print("ricevute dopo la conferma:", (await c.inner_text("#extraCorpo"))[:80].replace("\n", " "))
        await c.click("[data-close]:visible") if await c.locator("#extraPopup [data-close]").count() else None
        await c.goto(B + "?Univoco=SG8BA2115"); await c.wait_for_timeout(1800)
        await c.click("#mpContratto"); await c.wait_for_timeout(600); print("contratto dopo la conferma (niente richiesta):", not await c.is_visible(".conf-ov"), await c.is_visible("#extraPopup"))
        print("errori:", E); await b.close()
asyncio.run(main())
