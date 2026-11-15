import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        m = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        await m.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        for url in ["http://localhost:8823/?Univoco=SGPAG23", "http://localhost:8823/"]:
            await m.goto(url); await m.wait_for_timeout(1000)
            mx = 0
            for i in range(30):
                w = await m.evaluate("""(() => { const W = document.documentElement.clientWidth; let worst = null, wr = 0;
                  for (const el of document.querySelectorAll('body *')){ const r = el.getBoundingClientRect(); if (r.width && r.right > W + 1 && r.right > wr && getComputedStyle(el).position !== 'fixed'){ wr = r.right; worst = (el.id || el.className || el.tagName) + ''; } }
                  return [document.documentElement.scrollWidth, innerWidth, innerHeight, worst, Math.round(wr)] })()""")
                if w[0] > 390 or w[1] != 390: print(url[-20:], i, w)
                await m.wait_for_timeout(300)
        await b.close()
asyncio.run(main())
