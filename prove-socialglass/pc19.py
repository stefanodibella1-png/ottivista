import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); E=[]
        for w,h in [(1440,900),(1280,720),(1920,1080)]:
            d = await b.new_page(viewport={"width": w, "height": h}); d.on("pageerror", lambda e: E.append(str(e)))
            await d.goto("http://localhost:8823/"); await d.wait_for_timeout(1500)
            sc = d.locator(".scena-pc"); r = await sc.bounding_box(); t = await d.locator(".hero-testo").bounding_box(); img = await d.locator(".scena-pc .resp").bounding_box()
            print(w, "scena", r, "\n  immagine", img, "\n  testo", t, "\n  logo", await d.locator("#immagineCadente1").bounding_box())
            # mouse sul testo a destra: dove va la lente?
            await d.mouse.move(t["x"]+t["width"]*0.6, t["y"]+t["height"]*0.4); await d.wait_for_timeout(1500)
            l = await d.locator(".scena-pc .lente").bounding_box(); print("  lente col mouse sul testo:", l)
            await d.screenshot(path=f"pc19_{w}_{sys.argv[1] if len(sys.argv)>1 else 'prima'}.png")
        print("errori", E); await b.close()
asyncio.run(main())
