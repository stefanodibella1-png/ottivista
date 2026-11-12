import asyncio, json, urllib.request
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); e=[]
        ctx3=await b.new_context(viewport={"width":390,"height":844}); o=await ctx3.new_page(); o.on("pageerror", lambda x: e.append(str(x))); o.on("dialog", lambda d: (print("DIALOG:", d.message[:150]), asyncio.ensure_future(d.accept()))); await ctx3.route("**/*", rt)
        await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200); await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        print("OTTICA DA FARE:", [ (await x.inner_text()).replace("\n"," ") for x in await o.locator("#cruOtt .fare button").all()])
        await o.locator("#cruOtt .fare button").filter(has_text="ritirare dal cliente").click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={COD}]"); await card.locator("summary").click(); await o.wait_for_timeout(400)
        print("pulsanti:", [await x.inner_text() for x in await card.locator("button").all()])
        r=card.locator("button").filter(has_text="itirat")
        await r.first.click(); await o.wait_for_timeout(500)
        if await r.count(): t=await r.first.inner_text(); print("dopo tocco:", t); 
        if await r.count() and "di nuovo" in (await r.first.inner_text()): await r.first.click(); await o.wait_for_timeout(1000)
        d=json.load(urllib.request.urlopen(f"http://localhost:8823/api/benvenuto?univoco={COD}&espositore="))
        print("DOPO RITIRO:", d["stato"], d["ordine"]["ritiro"], "| esito pagamento:", d["ordine"]["pagamento"].get("esito"))
        print("err", e); await b.close()
asyncio.run(main())
