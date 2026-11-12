import asyncio, json
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        await ctx.route("**/*", rt)
        await pg.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07&promotore=CAF001&listino=A"); await pg.wait_for_timeout(1800)
        await pg.screenshot(path="v13_riepilogo.png", full_page=True)
        print("RIEPILOGO:", (await pg.inner_text("#mpAzione")).replace("\n"," | ")[:1500])
        await pg.click("#mpPaga"); await pg.wait_for_timeout(600); print("senza spunte:", await pg.inner_text("#mpErr") if await pg.is_visible("#mpErr") else "(nessun errore mostrato)")
        await pg.check("#c1"); await pg.check("#c2"); await pg.click("#mpPaga"); await pg.wait_for_timeout(800)
        await pg.screenshot(path="v13b_checkout.png"); await pg.get_by_role("button", name="Abbonati").click(); await pg.wait_for_timeout(2500)
        await pg.screenshot(path="v14_attivato.png", full_page=True)
        print("DOPO ATTIVAZIONE:", (await pg.inner_text("#miaPagina")).replace("\n"," | ")[:900])
        print("err", e); await b.close()
asyncio.run(main())
