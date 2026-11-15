import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        m = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); m.on("pageerror", lambda e: E.append(str(e)))
        await m.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await m.goto("http://localhost:8823/?Univoco=SGV20D"); await m.wait_for_timeout(1600)
        d = m.locator(".scheda", has_text="Il tuo abbonamento").locator("details.regole-box"); await d.locator("summary").click(); await m.wait_for_timeout(300)
        await m.locator('[data-fine="restituisci"]').scroll_into_view_if_needed(); await m.screenshot(path="fine22_pulsanti.png")
        await m.locator('[data-fine="restituisci"]').click(); await m.wait_for_timeout(600)
        print("popup:", (await m.inner_text("#extraPopup .popup-content")).replace("\n", " · ")[:400])
        await m.locator("#extraPopup .popup-content").screenshot(path="fine22_popup.png")
        await m.locator("#extraPopup [data-close]").first.click(); await m.wait_for_timeout(500)
        print("dopo chiusura: pagina cliente visibile:", await m.is_visible("#miaPagina"), "| scelta salvata:", "Hai scelto" in await m.inner_text("body"))
        await m.goto("http://localhost:8823/?Univoco=SGV20C"); await m.wait_for_timeout(1600)
        await m.locator('[data-fine="restituisci"]').click(); await m.wait_for_timeout(400); print("nei 30 giorni:", (await m.inner_text("#fineConferma"))[:160])
        print("errori:", E); await b.close()
asyncio.run(main())
