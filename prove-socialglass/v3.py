import asyncio, json
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
QR="/home/claude/prove/npmqr/package/qrcode.js"
def rt(r):
    u=r.request.url
    if "qrcode" in u: return r.fulfill(path=QR, content_type="text/javascript")
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]); ctx=await b.new_context(viewport={"width":390,"height":844},permissions=["camera"]); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        await ctx.route("**/*", rt)
        await pg.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07&promotore=CAF001&listino=A"); await pg.wait_for_timeout(2000)
        await pg.screenshot(path="v05_cliente.png", full_page=True)
        print("PAGINA:", (await pg.inner_text("#miaPagina")).replace("\n"," | ")[:900])
        # prenota la scelta
        await pg.click("#mpPrenota"); await pg.wait_for_timeout(800); print("tipo proposto:", await pg.input_value("#apTipo"))
        await pg.locator(".giorni button").nth(1).click(); await pg.locator(".orari button").first.click(); await pg.click("#apOk"); await pg.wait_for_timeout(900)
        print("PRENOTA:", (await pg.inner_text("#extraCorpo")).replace("\n"," | "))
        await pg.click("#extraPopup .back-btn") if await pg.is_visible("#extraPopup .back-btn") else await pg.click("#extraPopup [data-close]"); await pg.wait_for_timeout(500)
        await pg.click("#mpCatalogo"); await pg.wait_for_timeout(800); print("CATALOGO:", (await pg.inner_text("#extraCorpo"))[:200].replace("\n"," | "))
        await pg.click("#extraPopup [data-close]"); await pg.wait_for_timeout(500)
        # in ottica: scansiona
        await pg.screenshot(path="v06_prima_scan.png", full_page=True)
        await pg.click("#mpScan"); await pg.wait_for_timeout(1200); await pg.screenshot(path="v07_scanner.png")
        print("scanner testo:", await pg.inner_text("#video-container"))
        man=pg.locator("#video-container input"); print("campo manuale:", await man.count())
        await man.fill("SG-1043"); await pg.locator("#video-container .manuale button").click(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path="v08_dopo_scan.png", full_page=True)
        print("DOPO SCAN:", (await pg.inner_text("body")).replace("\n"," | ")[:700])
        print("err", e); await b.close()
asyncio.run(main())
