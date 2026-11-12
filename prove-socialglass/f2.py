import asyncio, json, sys, urllib.request
from playwright.async_api import async_playwright
COD=sys.argv[1]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); c=await ctx.new_page(); e=[]; c.on("pageerror", lambda x: e.append(str(x))); await ctx.route("**/*", rt)
        await c.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07"); await c.wait_for_timeout(1800)
        await c.screenshot(path=f"f_{COD}.png", full_page=True)
        print("CLIENTE:", (await c.inner_text("#mpAzione")).replace("\n"," | ")[:800])
        print("strumenti:", [ (await x.inner_text()).strip() for x in await c.locator(".extra-cli button").all()]); print("err", e); await b.close()
asyncio.run(main())
