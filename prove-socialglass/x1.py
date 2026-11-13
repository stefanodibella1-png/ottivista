import asyncio, json, urllib.request
from playwright.async_api import async_playwright
QR="/home/claude/prove/npmqr/package/qrcode.js"
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
def get(path): return json.load(urllib.request.urlopen("http://localhost:8823/"+path))
async def main():
    print("manifest:", get("api/benvenuto?manifest=1&univoco=SG8BA2115")["start_url"])
    print("amico lookup:", get("api/benvenuto?amico=sg8ba2115"))
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={"width":390,"height":844}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await ctx.route("**/*", lambda r: r.fulfill(path=QR, content_type="text/javascript") if "qrcode" in r.request.url else (r.continue_() if r.request.url.startswith("http://localhost") or r.request.url.startswith("blob") else r.abort()))
        await pg.goto("http://localhost:8823/?Univoco=SG8BA2115&espositore=OTT12"); await pg.wait_for_timeout(1500)
        if await pg.is_visible("#continue-button"): await pg.click("#continue-button"); await pg.wait_for_timeout(600)
        if not await pg.is_visible("#miaPagina"): await pg.click("#mio-ordine"); await pg.wait_for_timeout(800)
        print("manifest link:", await pg.get_attribute("#manifestLink","href"))
        await pg.screenshot(path="x_cli1.png", full_page=True)
        await pg.click("#mpRec [data-stella='5']"); await pg.fill("#mpRecTesto","Bellissimi, grazie!"); await pg.click("#mpRecInvia"); await pg.wait_for_timeout(500)
        print("recensione:", (await pg.inner_text("#mpRec"))[:60].replace("\n"," "))
        await pg.click("#mpTessera"); await pg.wait_for_timeout(900); await pg.screenshot(path="x_tes.png")
        await pg.evaluate("Object.defineProperty(navigator,'canShare',{value:undefined})")
        async with pg.expect_download() as dl: await pg.click("#tesSalva")
        print("tessera salvata:", (await dl.value).suggested_filename)
        await pg.click("#extraPopup .back-btn"); await pg.wait_for_timeout(400)
        await pg.click("#mpAmico"); await pg.wait_for_timeout(400); await pg.screenshot(path="x_amico.png"); await pg.click("#extraPopup .back-btn"); await pg.wait_for_timeout(400)
        await pg.click("#mpAnno"); await pg.wait_for_timeout(400); await pg.screenshot(path="x_anno.png")
        async with pg.expect_download() as dl: await pg.click("#annoCondividi")
        d=await dl.value; await d.save_as("/home/claude/prove/x_anno_img.png"); print("anno:", d.suggested_filename)
        await pg.click("#extraPopup .back-btn"); await pg.wait_for_timeout(300)
        # dona: sceglie restituisci
        await pg.click("#mpAzione details.regole-box summary") if await pg.is_visible("#mpAzione details.regole-box summary") else None
        await pg.click("[data-fine=restituisci]"); await pg.click("#fineSi"); await pg.wait_for_timeout(900)
        print("box dona (solo testo):", await pg.locator(".dona").count(), await pg.locator("#mpDona").count())
        # amico: registrazione dal CAF con codice amico + attivazione
        C=post("api/login",{"ruolo":"caf","codice":"CAF001","password":"demo"})["token"]
        r=post("api/utenti",{"cf":"RSSGNN80A01C351H","nome":"GIANNI","cognome":"ROSSI","nato":"CATANIA","datanascita":"1980-01-01","sesso":"M","prefisso":"+39","cellulare":"3331231234","ottica":"OTT07","gdpr":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"},"amico":"SG8BAXXXX"},C)
        print("amico errato:", r.get("errore"))
        import itertools
        r=post("api/utenti",{"cf":"RSSGNN80A01C351H","nome":"GIANNI","cognome":"ROSSI","nato":"CATANIA","datanascita":"1980-01-01","sesso":"M","prefisso":"+39","cellulare":"3331231234","ottica":"OTT07","gdpr":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"},"amico":"sg8ba2115"},C)
        uv=r.get("univoco"); print("nuovo:", uv, r.get("errore"))
        O=post("api/login",{"ruolo":"ottico","codice":"OTT07","password":"demo"})["token"]
        print(post("api/montatura",{"univoco":uv,"codice":"SG-1043"}).get("errore"))
        print(post("api/ordine",{"univoco":uv,"lente":"mono","ricetta":{"OD":{"sf":"-1"},"OS":{"sf":"-1"},"pd":63}},O).get("errore"))
        print(post("api/pagamento",{"univoco":uv,"consensoContratto":True,"consensoAddebito":True,"consensoSuMisura":True}))
        print("amici del referente:", get("api/benvenuto?univoco=SG8BA2115&espositore=")["amici"])
        await pg.goto("http://localhost:8823/?amico=SG8BA2115"); await pg.wait_for_timeout(1500); print("home amico:", await pg.inner_text(".occhiello"))
        # admin
        await pg.goto("http://localhost:8823/admin"); await pg.wait_for_timeout(1600)
        if await pg.is_visible("#admPw2"): await pg.fill("#admPw2","passwordlunga1")
        await pg.fill("#admPw","passwordlunga1"); await pg.click("#adminPopup button[type=submit]"); await pg.wait_for_timeout(800)
        await pg.locator("#admServizio").screenshot(path="x_adm.png")
        print(errs); await b.close()
asyncio.run(main())
