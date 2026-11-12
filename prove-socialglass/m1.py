import asyncio, json, urllib.request
from playwright.async_api import async_playwright
QR="/home/claude/prove/npmqr/package/qrcode.js"
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
async def ctxpg(b):
    ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
    await ctx.route("**/*", lambda r: r.fulfill(path=QR, content_type="text/javascript") if "qrcode" in r.request.url else (r.continue_() if r.request.url.startswith("http://localhost") else r.abort()))
    return pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"])
        # 1-3 cliente registrato
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/?Univoco=SGNUOVO02&espositore=OTT12"); await pg.wait_for_timeout(1500)
        print("1 pagina subito:", await pg.is_visible("#miaPagina"), "| titolo:", await pg.inner_text("#mpTitolo"), "| scan-btn pagina:", await pg.is_visible("#scan-btn"), "| mpScan:", await pg.is_visible("#mpScan"), e)
        await pg.click("#mpScan"); await pg.wait_for_timeout(700); print("  scanner aperto:", await pg.is_visible("#video-container"))
        await pg.screenshot(path="m_cli.png")
        # link solo espositore
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/?espositore=OTT12"); await pg.wait_for_timeout(1200); print("  solo espositore scan-btn:", await pg.is_visible("#scan-btn"), e)
        # 2 nome consegnato
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/?Univoco=SGPROVAREC&espositore=OTT07"); await pg.wait_for_timeout(1500)
        print("2 titolo:", await pg.inner_text("#mpTitolo"), "| banner:", [await x.inner_text() for x in await pg.locator(".banner-app b").all()], e)
        # 8 home
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/"); await pg.wait_for_timeout(800); print("8 sottotitolo:", await pg.inner_text(".hero .sotto"))
        # 9-12 CAF
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/caf"); await pg.wait_for_timeout(1200)
        await pg.fill("#codice","CAF001"); await pg.fill("#inputPassword","demo"); await pg.click("#passwordPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        print("9 CAF numeri:", [ (await x.inner_text()).replace("\n"," ") for x in await pg.locator("#cruCaf .cru-kpi button").all()], "| principale:", (await pg.inner_text("#cruCaf .cru-principale")).replace("\n"," "))
        await pg.screenshot(path="m_caf.png", full_page=True)
        await pg.click("#cruCaf [data-clienti]"); await pg.wait_for_timeout(1200)
        print("11 elenco: titolo", await pg.inner_text("#clientiTitolo"), "conteggi visibili:", await pg.is_visible("#clientiConti"), "righe:", await pg.locator("#clientiLista .cli, #clientiLista tr").count())
        print("12 indietro:", await pg.is_visible("#clientiPopup .back-btn"), "X:", await pg.is_visible("#clientiPopup .close-btn"))
        await pg.click("#clientiPopup .back-btn"); await pg.wait_for_timeout(1000)
        await pg.click("#cruCaf [data-conti]"); await pg.wait_for_timeout(1200)
        print("11 conteggi: titolo", await pg.inner_text("#clientiTitolo"), "conteggi:", await pg.is_visible("#clientiConti"), "lista:", await pg.is_visible("#clientiLista"), "filtri:", await pg.is_visible("#clientiFiltri"))
        await pg.screenshot(path="m_conti.png", full_page=True); print("  err", e)
        # Ottica
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/ottico"); await pg.wait_for_timeout(1200)
        await pg.fill("#codiceOttico","OTT07"); await pg.fill("#inputPasswordOttico","demo"); await pg.click("#otticoPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        print("10 ottica principale:", (await pg.inner_text("#cruOtt .cru-principale")).replace("\n"," "), "| numeri:", await pg.locator("#cruOtt .cru-kpi button").count(), e)
        await pg.click("#cruOtt .cru-principale button"); await pg.wait_for_timeout(700); print("   apre ordine:", await pg.is_visible("#ordinePopup"))
        await pg.screenshot(path="m_ott.png")
        # admin
        A=post("api/admin",{"azione":"imposta","password":"passwordlunga1"}).get("token") or post("api/admin",{"azione":"accedi","password":"passwordlunga1"})["token"]
        post("api/admin",{"azione":"salvaLab","nome":"Lab Demo","attivo":True,"password":"laboratorio1"},A)
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/admin"); await pg.wait_for_timeout(1000)
        await pg.fill("#adminPw","passwordlunga1") if await pg.locator("#adminPw").count() else None
        print("admin campi:", [await x.get_attribute("id") for x in await pg.locator("#adminPopup input").all()][:4])
        # lab
        pg,e=await ctxpg(b); await pg.goto("http://localhost:8823/laboratorio"); await pg.wait_for_timeout(500)
        await pg.fill("#pw","laboratorio1"); await pg.click("#fLogin button"); await pg.wait_for_timeout(1000)
        print("13 lab riquadri:", [ (await x.inner_text()).replace("\n"," ") for x in await pg.locator(".kpi button").all()], "schede:", await pg.locator(".tabs").count())
        bt=pg.locator("details[data-u=SGPROVALAB] summary button")
        for i in range(3):
            if not await bt.count(): break
            t=await bt.inner_text(); print("14 passo:", t); await bt.click(); await pg.wait_for_timeout(900)
        print("   stato cliente:", json.load(urllib.request.urlopen("http://localhost:8823/api/benvenuto?univoco=SGPROVALAB&espositore="))["stato"], e)
        await b.close()
asyncio.run(main())
