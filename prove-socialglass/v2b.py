import asyncio
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":844})
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await pg.goto("http://localhost:8823/caf"); await pg.wait_for_timeout(1000); await pg.fill("#codice","CAF001"); await pg.fill("#inputPassword","demo"); await pg.click("#passwordPopup button[type=submit]"); await pg.wait_for_timeout(1300)
        await pg.click("#cruCaf .cru-principale button"); await pg.wait_for_timeout(500); await pg.fill("#codiceFiscale","RSSGNN80A01C351H"); await pg.click("#attivaCodiceFiscale"); await pg.wait_for_timeout(600)
        print("auto da CF:", await pg.input_value("#datanascita"), await pg.input_value("#sesso")); await b.close()
asyncio.run(main())
