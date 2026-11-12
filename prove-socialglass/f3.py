import asyncio, json, sys, urllib.request
from playwright.async_api import async_playwright
COD=sys.argv[1]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); e=[]
        ctx=await b.new_context(viewport={"width":390,"height":844}); o=await ctx.new_page(); o.on("pageerror", lambda x: e.append(str(x))); o.on("dialog", lambda d: (print("DIALOG:", d.message[:200]), asyncio.ensure_future(d.accept()))); await ctx.route("**/*", rt)
        await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200); await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        print("OTTICA DA FARE:", [ (await x.inner_text()).replace("\n"," ")[:70] for x in await o.locator("#cruOtt .fare button").all()])
        await o.click("#cruOtt [data-clienti]"); await o.wait_for_timeout(1200)
        card=o.locator(f"#clientiLista details.cli[data-u={COD}]"); await card.locator("summary").click(); await o.wait_for_timeout(400)
        print("SCHEDA:", (await card.inner_text()).replace("\n"," | ")[:400])
        print("pulsanti:", [await x.inner_text() for x in await card.locator("button").all()])
        r=card.locator("button").filter(has_text="itirat")
        if await r.count():
            await r.first.click(); await o.wait_for_timeout(600)
            if await r.count() and "di nuovo" in (await r.first.inner_text()): await r.first.click(); await o.wait_for_timeout(900)
            print("messaggio:", await o.inner_text("#demoNota") if await o.locator("#demoNota").is_visible() else "(nessuno)")
        d=json.load(urllib.request.urlopen(f"http://localhost:8823/api/benvenuto?univoco={COD}&espositore="))
        print("STATO:", d["stato"], "| esito:", d["ordine"]["pagamento"].get("esito"), "| ritiro:", d["ordine"]["ritiro"], "| dona:", d.get("dona"))
        print("err", e); await b.close()
asyncio.run(main())
