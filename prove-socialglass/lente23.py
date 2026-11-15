import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        m = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        await m.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await m.goto("http://localhost:8823/"); await m.wait_for_timeout(1000)
        await m.locator(".scena-m").scroll_into_view_if_needed()
        await m.wait_for_timeout(7000); await m.locator(".scena-m").screenshot(path="lente23_tel.png")
        print("larghezza pagina:", await m.evaluate("document.documentElement.scrollWidth"))
        d = await b.new_page(viewport={"width": 1440, "height": 900}); await d.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await d.goto("http://localhost:8823/"); await d.wait_for_timeout(2500); await d.screenshot(path="lente23_pc.png")
        await b.close()
asyncio.run(main())
