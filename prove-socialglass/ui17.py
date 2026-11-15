import asyncio, json
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        async def rt(r):
            u = r.request.url
            if u.startswith("http://localhost"): return await r.continue_()
            if "qrcode" in u: return await r.fulfill(path="npmqr/package/qrcode.js")
            if "jspdf" in u: return await r.fulfill(path="jspdf.umd.min.js")
            if "xlsx" in u: return await r.fulfill(path="xlsx.full.min.js")
            await r.abort()
        await ctx.route("**/*", rt)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("http://localhost:8823/?Univoco=SGRIN17P1"); await pg.wait_for_timeout(1800)
        t = await pg.inner_text("#app") if await pg.query_selector("#app") else await pg.inner_text("body")
        print("1 banner:", "Pagamento del canone non riuscito" in t, "| 9,90" , "9,90" in t)
        el = pg.locator(".esito.err", has_text="canone").first
        await el.scroll_into_view_if_needed(); await pg.wait_for_timeout(300); await pg.screenshot(path="r17_tel_insoluto.png")
        # prova a confermare: tutte le spunte e il pulsante
        for c in await pg.query_selector_all("input[type=checkbox]"):
            if await c.is_visible(): await c.check()
        btns = []
        for x in await pg.query_selector_all("button"):
            tx = ((await x.inner_text()) or "").lower()
            if await x.is_visible() and ("conferm" in tx or "attiva" in tx): btns.append(x)
        print("  pulsanti conferma:", [await x.inner_text() for x in btns][:3])
        if btns:
            await btns[-1].click(); await pg.wait_for_timeout(1200)
            t2 = await pg.inner_text("body"); i = t2.find("Prima di confermare"); print("2 conferma:", t2[i:i+150] if i >= 0 else "messaggio NON visto")
            await pg.screenshot(path="r17_tel_blocco.png")
        # paga (simulato) e poi la conferma passa
        pb = await pg.query_selector("[data-paga-simulato]")
        print("3 pulsante paga:", bool(pb))
        if pb:
            await pb.click(); await pg.wait_for_timeout(1500)
            t3 = await pg.inner_text("body"); print("  dopo il pagamento banner sparito:", "Pagamento del canone non riuscito" not in t3)
        pg2 = await ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
        await pg2.goto("http://localhost:8823/?Univoco=SGRIN17P2"); await pg2.wait_for_timeout(1800)
        t = await pg2.inner_text("body"); i = t.find("Abbonamento chiuso"); print("4 chiuso:", t[i:i+200] if i >= 0 else "NON visto")
        await pg2.screenshot(path="r17_tel_chiuso.png")
        print("errori js:", errs)
        await b.close()
asyncio.run(main())
