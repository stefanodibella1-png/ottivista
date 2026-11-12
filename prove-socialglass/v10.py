import asyncio, json, urllib.request
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]); e=[]
        ctx3=await b.new_context(viewport={"width":390,"height":844}); o=await ctx3.new_page(); o.on("pageerror", lambda x: e.append(str(x))); o.on("dialog", lambda d: (print("DIALOG:", d.message[:150]), asyncio.ensure_future(d.accept()))); await ctx3.route("**/*", rt)
        await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200); await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        print("OTTICA DA FARE:", [ (await x.inner_text()).replace("\n"," ") for x in await o.locator("#cruOtt .fare button").all()])
        await o.locator("#cruOtt .fare button").filter(has_text="rinnovare").click(); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={COD}]"); print("in elenco:", await card.count())
        await card.locator("summary").click(); await o.wait_for_timeout(400)
        print("SCHEDA:", (await card.inner_text()).replace("\n"," | ")[:600])
        btn=[await x.inner_text() for x in await card.locator("button").all()]; print("pulsanti:", btn)
        r=card.locator("button").filter(has_text="innov")
        if await r.count():
            await r.first.click(); await o.wait_for_timeout(600); t=await r.first.inner_text() if await r.count() else ""; print("dopo tocco:", t)
            if await r.count() and ("onferm" in t or "nuovo" in t): await r.first.click(); await o.wait_for_timeout(1200)
        await o.screenshot(path="v21_rinnovo_ottica.png", full_page=True)
        d=json.load(urllib.request.urlopen(f"http://localhost:8823/api/benvenuto?univoco={COD}&espositore="))
        print("STATO dopo rinnovo:", d["stato"], d["ordine"]["rinnovo"], d["ordine"].get("storico"))
        # cliente
        ctx=await b.new_context(viewport={"width":390,"height":844},permissions=["camera"]); c=await ctx.new_page(); c.on("pageerror", lambda x: e.append(str(x))); await ctx.route("**/*", rt)
        await c.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07"); await c.wait_for_timeout(1800); await c.screenshot(path="v22_cliente_rinnovo.png", full_page=True)
        print("CLIENTE:", (await c.inner_text("#miaPagina")).replace("\n"," | ")[:800])
        print("err", e); await b.close()
asyncio.run(main())
