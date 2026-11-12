import asyncio, json
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); c=await ctx.new_page(); e=[]; c.on("pageerror", lambda x: e.append(str(x))); c.on("dialog", lambda d: (print("DIALOG:", d.message), asyncio.ensure_future(d.accept()))); await ctx.route("**/*", rt)
        await c.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07"); await c.wait_for_timeout(1800)
        await c.click("[data-fine=rinnova]"); await c.wait_for_timeout(700)
        print("CONFERMA:", (await c.inner_text("#fineConferma")).replace("\n"," | "))
        bt=c.locator("#fineConferma button"); print("pulsanti:", [await x.inner_text() for x in await bt.all()])
        if await bt.count(): await bt.first.click(); await c.wait_for_timeout(1200)
        await c.screenshot(path="v20_scelta_rinnovo.png", full_page=True)
        print("DOPO:", (await c.inner_text("#mpAzione")).replace("\n"," | ")[:700])
        print("err", e); await b.close()
asyncio.run(main())
