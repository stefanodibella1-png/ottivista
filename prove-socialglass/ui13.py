import asyncio
from playwright.async_api import async_playwright
async def ui():
    async with async_playwright() as p:
        b=await p.chromium.launch(); a=await b.new_page(viewport={"width":1200,"height":900}); E=[]; a.on("pageerror", lambda e: E.append(str(e)))
        await a.goto("http://localhost:8823/admin"); await a.wait_for_timeout(900); await a.fill("#admPw","passwordlunga1"); await a.press("#admPw","Enter"); await a.wait_for_timeout(1500)
        box=a.locator(".cru-box", has_text="Controllo notturno"); print("pannello:", (await box.inner_text()).replace("\n"," | ")); await box.screenshot(path="n13_box.png"); print("errori:", E); await b.close()
asyncio.run(ui())
