import asyncio, json, urllib.request
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
A=post("api/admin",{"azione":"imposta","password":"passwordlunga1"}).get("token") or post("api/admin",{"azione":"accedi","password":"passwordlunga1"})["token"]
print("lab:", post("api/admin",{"azione":"salvaLab","nome":"Lab Demo","attivo":True,"password":"laboratorio1"},A))
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); e=[]
        ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); pg.on("pageerror", lambda x: e.append(str(x))); await ctx.route("**/*", rt)
        await pg.goto("http://localhost:8823/laboratorio"); await pg.wait_for_timeout(600); await pg.fill("#pw","laboratorio1"); await pg.click("#fLogin button"); await pg.wait_for_timeout(1200)
        riga=pg.locator(f"details[data-u={COD}]"); print("busta presente:", await riga.count())
        await riga.locator("summary").click(); await pg.wait_for_timeout(400); await pg.screenshot(path="v15_lab.png", full_page=True)
        print("BUSTA:", (await riga.inner_text()).replace("\n"," | ")[:600])
        for i in range(3):
            bt=riga.locator("summary button")
            if not await bt.count(): break
            print("passo:", await bt.inner_text()); await bt.click(); await pg.wait_for_timeout(900)
        print("msg lab:", await pg.locator(".msg").first.inner_text() if await pg.locator(".msg").count() else "")
        # cliente
        ctx2=await b.new_context(viewport={"width":390,"height":844}); c=await ctx2.new_page(); c.on("pageerror", lambda x: e.append(str(x))); await ctx2.route("**/*", rt)
        await c.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07"); await c.wait_for_timeout(1800); await c.screenshot(path="v16_pronto.png", full_page=True)
        print("CLIENTE PRONTO:", (await c.inner_text("#mpAzione")).replace("\n"," | ")[:500])
        # ottica: avvisi e consegna
        ctx3=await b.new_context(viewport={"width":390,"height":844}); o=await ctx3.new_page(); o.on("pageerror", lambda x: e.append(str(x))); o.on("dialog", lambda d: asyncio.ensure_future(d.accept())); await ctx3.route("**/*", rt)
        await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200); await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        print("OTTICA DA FARE:", [ (await x.inner_text()).split("\n")[1] for x in await o.locator("#cruOtt .fare button").all()])
        await o.locator("#cruOtt .fare button").filter(has_text="consegnare").click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={COD}]"); print("scheda cliente:", await card.count())
        if not await card.get_attribute("open"): await card.locator("summary").click(); await o.wait_for_timeout(400)
        await o.screenshot(path="v17_ottica_cli.png", full_page=True)
        btn=[await x.inner_text() for x in await card.locator("button").all()]; print("pulsanti scheda:", btn)
        cons=card.locator("button").filter(has_text="onsegnat")
        await cons.first.click(); await o.wait_for_timeout(500)
        if await cons.count(): 
            t=await cons.first.inner_text(); print("dopo 1 tocco:", t)
            if "onferm" in t or "di nuovo" in t: await cons.first.click(); await o.wait_for_timeout(1000)
        print("stato:", json.load(urllib.request.urlopen(f"http://localhost:8823/api/benvenuto?univoco={COD}&espositore="))["stato"])
        await c.reload(); await c.wait_for_timeout(1800); await c.screenshot(path="v18_consegnato.png", full_page=True)
        print("CLIENTE CONSEGNATO:", (await c.inner_text("#mpAzione")).replace("\n"," | ")[:700])
        print("err", e); await b.close()
asyncio.run(main())
