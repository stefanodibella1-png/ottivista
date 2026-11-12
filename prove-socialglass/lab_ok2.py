import asyncio, json, urllib.request
from playwright.async_api import async_playwright
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
print("attiva:", post("api/pagamento",{"univoco":"SG17897BE","consensoContratto":True,"consensoAddebito":True}))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":844}); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept()))
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await pg.goto("http://localhost:8823/laboratorio"); await pg.wait_for_timeout(500)
        await pg.fill("#pw","laboratorio1"); await pg.click("#fLogin button"); await pg.wait_for_timeout(1000)
        for i in range(5):
            bt=pg.locator("details[data-u=SG17897BE] summary button")
            if not await bt.count():
                for f in ["lav","ritiro","pronti","tutti"]:
                    t=pg.locator(f"[data-f={f}]").first
                    if await t.count(): await t.click(); await pg.wait_for_timeout(300)
                    if await bt.count(): break
            if not await bt.count(): print("riga non trovata"); break
            txt=await bt.inner_text(); print("passo:", txt); await bt.click(); await pg.wait_for_timeout(900)
            if await pg.locator(".toast, #toast, .avviso").count(): print("  msg:", (await pg.locator(".toast, #toast, .avviso").first.inner_text())[:120])
        await pg.screenshot(path="r_lab2.png", full_page=True); print(errs); await b.close()
asyncio.run(main())
