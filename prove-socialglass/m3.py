import asyncio, json, urllib.request
from playwright.async_api import async_playwright
QR="/home/claude/prove/npmqr/package/qrcode.js"
def rt(r):
    u=r.request.url
    if "qrcode" in u: return r.fulfill(path=QR, content_type="text/javascript")
    if "xlsx" in u: return r.fulfill(path="/home/claude/prove/xlsx.full.min.js", content_type="text/javascript")
    if "jspdf" in u: return r.fulfill(path="/home/claude/prove/jspdf.umd.min.js", content_type="text/javascript")
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
async def nuova(b):
    ctx=await b.new_context(viewport={"width":390,"height":844}, accept_downloads=True); pg=await ctx.new_page(); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.on("dialog", lambda d: asyncio.ensure_future(d.accept())); await ctx.route("**/*", rt); return pg, errs
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # cliente prenota e segnala (dati per l'ottica)
        print("prenota:", post("api/benvenuto",{"azione":"appuntamento","univoco":"SGPROVAREC","quando":json.load(urllib.request.urlopen("http://localhost:8823/api/benvenuto?slot=1&univoco=SGPROVAREC"))["giorni"][0]["data"]+"T"+json.load(urllib.request.urlopen("http://localhost:8823/api/benvenuto?slot=1&univoco=SGPROVAREC"))["giorni"][0]["slot"][0],"tipo":"controllo"}))
        print("segnala:", post("api/benvenuto",{"azione":"segnala","univoco":"SGPROVAREC","testo":"Vite allentata sulla cerniera"}).get("ok"))
        # OTTICA
        pg,e=await nuova(b); await pg.goto("http://localhost:8823/ottico"); await pg.wait_for_timeout(1200)
        await pg.fill("#codiceOttico","OTT07"); await pg.fill("#inputPasswordOttico","demo"); await pg.click("#otticoPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        print("ottica da fare:", [ (await x.inner_text()).split("\n")[1] for x in await pg.locator("#cruOtt .fare button").all()])
        await pg.click("#cruOtt .tessere [data-agenda]"); await pg.wait_for_timeout(500)
        print("agenda:", (await pg.inner_text("#extraCorpo"))[:120].replace("\n"," | "))
        await pg.fill("#orM","09:00-12:00"); await pg.click("#fOrari button[type=submit]"); await pg.wait_for_timeout(700); print("orari:", await pg.inner_text("#orEsito"))
        await pg.click("#extraPopup .back-btn"); await pg.wait_for_timeout(900)
        await pg.click("#cruOtt .fare [data-segn]"); await pg.wait_for_timeout(500)
        await pg.fill("#extraCorpo [data-risp]","Passa quando vuoi, la sistemiamo in 2 minuti"); await pg.click("#extraCorpo [data-risolta]"); await pg.wait_for_timeout(700)
        print("segn risolta:", await pg.inner_text("#extraCorpo"), e)
        # codice di recupero
        await pg.click("#extraPopup .back-btn"); await pg.wait_for_timeout(900)
        await pg.click("#cruOtt [data-open=passwordCambioPopup]"); await pg.wait_for_timeout(400)
        await pg.click("#recCrea"); await pg.click("#recCrea"); await pg.wait_for_timeout(700)
        cod=(await pg.inner_text("#recEsito")).split("\n")[1].strip(); print("codice recupero:", cod)
        pg2,e2=await nuova(b); await pg2.goto("http://localhost:8823/ottico"); await pg2.wait_for_timeout(1000)
        await pg2.fill("#codiceOttico","OTT07"); await pg2.click("#otticoPopup [data-recupero]"); await pg2.wait_for_timeout(400)
        await pg2.fill("#recCod", cod.lower().replace("-"," ")); await pg2.fill("#recNuova","nuovapassword9"); await pg2.click("#formRecupero button"); await pg2.wait_for_timeout(700)
        print("recupero:", (await pg2.inner_text("#recRis"))[:60].replace("\n"," "))
        print("login nuova:", "token" in post("api/login",{"ruolo":"ottico","codice":"OTT07","password":"nuovapassword9"}), "| vecchio codice:", post("api/login",{"azione":"recupera","ruolo":"ottico","codice":"OTT07","recupero":cod,"nuova":"altrapass99"}).get("errore","")[:40], e2)
        post("api/login",{"azione":"recupera","ruolo":"ottico","codice":"OTT07","recupero":"x","nuova":"x"})
        # ADMIN
        A=post("api/admin",{"azione":"imposta","password":"passwordlunga1"}).get("token") or post("api/admin",{"azione":"accedi","password":"passwordlunga1"})["token"]
        pg,e=await nuova(b); await pg.set_viewport_size({"width":1200,"height":900}); await pg.goto("http://localhost:8823/admin"); await pg.wait_for_timeout(900)
        await pg.fill("#admPw","passwordlunga1"); await pg.press("#admPw","Enter"); await pg.wait_for_timeout(1500)
        print("admin schede:", [await x.inner_text() for x in await pg.locator(".schede-adm button").all()])
        print("oggi numeri:", await pg.locator("#admCorpo > .cru-kpi button").count(), "| avviso prova in Oggi:", await pg.locator("#admCorpo .esito.info").count())
        # listini
        await pg.click(".schede-adm [data-tab=listini]"); await pg.wait_for_timeout(500)
        print("avviso prova in Listini:", await pg.locator("#admCorpo .esito.info").count())
        await pg.click("[data-lis-agg=lenti]"); await pg.wait_for_timeout(200)
        r=pg.locator(".voce-lis").filter(has=pg.locator("[data-d]")).last
        await r.locator("[data-n]").fill("Progressive premium"); await r.locator("[data-d]").fill("Campo visivo ampio"); await r.locator("[data-p]").fill("390")
        await pg.locator("[data-lis-togli^='trattamenti:']").first.click(); await pg.wait_for_timeout(200)
        await pg.click("[data-f=salvaListino] button[type=submit]"); await pg.wait_for_timeout(900); print("listino:", await pg.inner_text("#admMsg"))
        # ottica vede la nuova lente
        O=post("api/login",{"ruolo":"ottico","codice":"OTT07","password":"nuovapassword9"})["token"]
        rq=urllib.request.Request("http://localhost:8823/api/ordine?univoco=SGPROVALAB", headers={"Authorization":"Bearer "+O}); lis=json.load(urllib.request.urlopen(rq))["listino"]
        print("ottico listino", lis["id"], "lenti:", [v["nome"] for v in lis["lenti"].values()], "tratt:", [v["nome"] for v in lis["trattamenti"].values()])
        # registro
        await pg.click(".schede-adm [data-tab=registro]"); await pg.wait_for_timeout(1200)
        print("registro righe:", await pg.locator("table.tab tr").count()-1, [ (await x.inner_text()).replace("\t"," ")[:70] for x in await pg.locator("table.tab tr").all()][1:5])
        # magazzino import
        await pg.click(".schede-adm [data-tab=magazzino]"); await pg.wait_for_timeout(600)
        await pg.click("text=Importa montature da Excel"); await pg.set_input_files("#impFile","/home/claude/prove/imp.csv"); await pg.wait_for_timeout(1500)
        print("anteprima:", (await pg.inner_text("#impAnteprima"))[:60].replace("\n"," "))
        await pg.click("[data-imp-vai]"); await pg.wait_for_timeout(1200); print("import:", await pg.inner_text("#admMsg"))
        # catalogo cliente OTT07
        print("catalogo OTT07:", [m["modello"] for m in json.load(urllib.request.urlopen("http://localhost:8823/api/benvenuto?catalogo=1&univoco=SGPROVALAB"))["montature"]])
        # impostazioni: prova messaggio e copia
        await pg.click(".schede-adm [data-tab=impostazioni]"); await pg.wait_for_timeout(600)
        await pg.fill("[data-f=provaMessaggio] [name=numero]","3331234567"); await pg.click("[data-f=provaMessaggio] button"); await pg.wait_for_timeout(700); print("prova msg:", await pg.inner_text("#admMsg"))
        async with pg.expect_download() as d: await pg.click("[data-copia='']")
        dl=await d.value; await dl.save_as("/home/claude/prove/copia.json"); c=json.load(open("/home/claude/prove/copia.json")); print("copia:", {k: len(v) if isinstance(v,list) else v for k,v in c["raccolte"].items()})
        # report
        await pg.click(".schede-adm [data-tab=numeri]"); await pg.wait_for_timeout(600)
        await pg.fill("#repMese", "2026-11")
        async with pg.context.expect_page() as np: await pg.click("[data-report]")
        rp=await np.value; await rp.wait_for_load_state(); print("report:", (await rp.inner_text("body"))[:200].replace("\n"," | "))
        print("err admin", e); await b.close()
asyncio.run(main())
