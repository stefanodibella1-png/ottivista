import asyncio, json
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=["--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"]); ctx=await b.new_context(viewport={"width":390,"height":844},permissions=["camera"]); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        await ctx.route("**/*", rt)
        await pg.goto(f"http://localhost:8823/?Univoco={COD}&espositore=OTT07&promotore=CAF001&listino=A"); await pg.wait_for_timeout(1800)
        await pg.click("#mpScan"); await pg.wait_for_timeout(800)
        await pg.locator("#video-container input").fill(__import__("sys").argv[1] if len(__import__("sys").argv)>1 else "SG-1043"); await pg.locator("#video-container .manuale button").click(); await pg.wait_for_timeout(1300)
        bt=[await x.inner_text() for x in await pg.locator(".popup:not([hidden]) button").all()]; print("pulsanti:", bt)
        await pg.get_by_role("button", name="Scelgo questa montatura").click(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path="v09_scelta.png", full_page=True)
        print("DOPO CONTINUA:", (await pg.inner_text("body")).replace("\n"," | ")[:900])
        print("err", e); await b.close()
asyncio.run(main())
