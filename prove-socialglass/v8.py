import asyncio, json, sys
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); c=await ctx.new_page(); e=[]; c.on("pageerror", lambda x: e.append(str(x))); await ctx.route("**/*", rt)
        await c.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07"); await c.wait_for_timeout(1800)
        await c.screenshot(path=f"v19_{sys.argv[1]}.png", full_page=True)
        print("CLIENTE:", (await c.inner_text("#mpAzione")).replace("\n"," | ")[:1200])
        if sys.argv[1]=="rec":
            await c.locator("[data-stella]").nth(4).click(); await c.fill("#mpRecTesto","Comodissimi, gentilissimi"); await c.click("#mpRecInvia"); await c.wait_for_timeout(900)
            print("dopo voto:", (await c.inner_text("#mpRec")).replace("\n"," | "))
        print("err", e); await b.close()
asyncio.run(main())
