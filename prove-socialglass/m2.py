import asyncio, json, urllib.request
from playwright.async_api import async_playwright
QR="/home/claude/prove/npmqr/package/qrcode.js"
PDF="/home/claude/prove/jspdf.umd.min.js"
def rt(r):
    u=r.request.url
    if "qrcode" in u: return r.fulfill(path=QR, content_type="text/javascript")
    if "jspdf" in u: return r.fulfill(path=PDF, content_type="text/javascript")
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") else r.abort()
async def apri(b, uv):
    ctx=await b.new_context(viewport={"width":390,"height":844}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    await ctx.route("**/*", rt); await pg.goto(f"http://localhost:8823/?Univoco={uv}&espositore=OTT07"); await pg.wait_for_timeout(1500); return pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        pg,e=await apri(b,"SGPROVAREC")
        print("strumenti:", [ (await x.inner_text()).strip() for x in await pg.locator(".extra-cli button").all()])
        await pg.click("#mpPrenota"); await pg.wait_for_timeout(800)
        print("prenota giorni:", await pg.locator(".giorni button").count(), "orari:", await pg.locator(".orari button").count(), "tipo:", await pg.input_value("#apTipo"))
        await pg.locator(".orari button").nth(1).click(); await pg.click("#apOk"); await pg.wait_for_timeout(900)
        print("conferma:", (await pg.inner_text("#extraCorpo"))[:90].replace("\n"," | "))
        await pg.click("#extraPopup [data-close]") if await pg.locator("#extraPopup [data-close]").count() else None; await pg.wait_for_timeout(400)
        print("box app in pagina:", await pg.locator(".app-box").count(), "| bottone:", await pg.inner_text("#mpPrenota"))
        await pg.click("#mpSegnala"); await pg.wait_for_timeout(400)
        await pg.fill("#sgTesto","L'asta destra stringe dietro l'orecchio")
        await pg.set_input_files("#sgFoto","/home/claude/ottivista/socialglass/assets/icon-512.png"); await pg.wait_for_timeout(800)
        print("anteprima foto:", await pg.is_visible("#sgAnteprima"))
        await pg.click("#sgInvia"); await pg.wait_for_timeout(900); print("segnala:", (await pg.inner_text("#extraCorpo"))[:60])
        await pg.click("#extraPopup [data-close]"); await pg.wait_for_timeout(300)
        await pg.click("#mpRicevute"); await pg.wait_for_timeout(700); print("ricevute:", (await pg.inner_text("#extraCorpo"))[:80])
        await pg.click("#extraPopup [data-close]"); await pg.wait_for_timeout(300)
        await pg.click("#mpContratto"); await pg.wait_for_timeout(500); print("contratto righe:", await pg.locator(".r-c").count())
        async with pg.expect_download() as d: await pg.click("#ctPdf")
        dl=await d.value; await dl.save_as("/home/claude/prove/contratto.pdf"); print("pdf:", dl.suggested_filename)
        print("err", e)
        # cliente registrato: catalogo
        pg,e=await apri(b,"SGNUOVO02")
        print("registrato strumenti:", [ (await x.inner_text()).strip() for x in await pg.locator(".extra-cli button").all()])
        await pg.click("#mpCatalogo"); await pg.wait_for_timeout(800); print("catalogo:", await pg.locator(".cat").count(), (await pg.inner_text("#extraCorpo"))[:80].replace("\n"," "))
        await pg.screenshot(path="m_cat.png")
        # Giulia: rinnovo
        pg,e2=await apri(b,"SGPROVAANN"); print("rinnovo cat:", await pg.locator("#mpRinnovaCat").count(), "carta:", await pg.locator("#mpCarta").count(), e+e2)
        await b.close()
asyncio.run(main())
