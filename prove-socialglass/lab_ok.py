import asyncio, json, urllib.request
from playwright.async_api import async_playwright
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
A=post("api/admin",{"azione":"imposta","password":"passwordlunga1"}).get("token") or post("api/admin",{"azione":"accedi","password":"passwordlunga1"})["token"]
print("salvaLab:", post("api/admin",{"azione":"salvaLab","nome":"Lab Demo","attivo":True,"password":"laboratorio1"},A))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":844}); errs=[]; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await pg.goto("http://localhost:8823/laboratorio"); await pg.wait_for_timeout(500)
        await pg.fill("#pw","laboratorio1"); await pg.click("#fLogin button"); await pg.wait_for_timeout(1000)
        print("righe:", await pg.locator("details[data-u]").count(), "| pulsanti passo:", await pg.locator("details[data-u] summary button").count())
        await pg.screenshot(path="r_lab.png", full_page=True); print(errs); await b.close()
asyncio.run(main())
