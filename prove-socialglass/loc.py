import asyncio
from playwright.async_api import async_playwright
QR="/home/claude/prove/npmqr/package/qrcode.js"
def rt(r):
    u=r.request.url
    if "qrcode" in u: return r.fulfill(path=QR, content_type="text/javascript")
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") or u.startswith("about:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x))); await ctx.route(__import__("re").compile(r"^https?://(?!localhost)"), lambda r: r.fulfill(path=QR, content_type="text/javascript") if "qrcode" in r.request.url else r.abort()); await ctx.add_init_script("window.print=()=>{}")
        await pg.goto("http://localhost:8823/caf"); await pg.wait_for_timeout(1200)
        await pg.fill("#codice","CAF001"); await pg.fill("#inputPassword","demo"); await pg.click("#passwordPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        async with ctx.expect_page() as np: await pg.click("#cruCaf [data-volantino]")
        v=await np.value; await v.wait_for_timeout(3000); print("stato img:", await v.evaluate("[...document.images].map(i=>[i.src.slice(0,50),i.complete,i.naturalWidth])"))
        await v.emulate_media(media="print"); await v.set_viewport_size({"width":794,"height":1123})
        await v.screenshot(path="locandina.png", full_page=True)
        await v.pdf(path="locandina.pdf", format="A4", print_background=True, prefer_css_page_size=True)
        print("immagini caricate:", await v.evaluate("[...document.images].map(i=>i.naturalWidth>0)"), "err", e)
        await b.close()
asyncio.run(main())
