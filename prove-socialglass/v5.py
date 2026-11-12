import asyncio, json
from playwright.async_api import async_playwright
S=json.load(open("v_stato.json")); COD=S["cod"]
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        pg.on("dialog", lambda d: (print("DIALOG:", d.message), asyncio.ensure_future(d.accept()))); await ctx.route("**/*", rt)
        await pg.goto("http://localhost:8823/ottico"); await pg.wait_for_timeout(1200)
        await pg.fill("#codiceOttico","OTT07"); await pg.fill("#inputPasswordOttico","demo"); await pg.click("#otticoPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        await pg.screenshot(path="v10_ottica.png", full_page=True)
        print("DA FARE:", [ (await x.inner_text()).replace("\n"," ") for x in await pg.locator("#cruOtt .fare button").all()])
        await pg.click("#cruOtt .cru-principale button"); await pg.wait_for_timeout(500)
        await pg.fill("#ordineCodice", COD); await pg.click("#formOrdineCerca button"); await pg.wait_for_timeout(1000)
        await pg.screenshot(path="v11_ordine.png", full_page=True)
        print("CLIENTE:", (await pg.inner_text("#ordineCliente")).replace("\n"," | "))
        await pg.locator("#ordineLenti label").filter(has_text="Monofocali").first.click()
        await pg.locator("#formOrdine label").filter(has_text="Antiriflesso").click()
        for k,v in {"OD_sf":"-1.25","OD_cil":"-0.50","OD_ax":"90","OS_sf":"-1","pd":"63"}.items(): await pg.fill(f"#formOrdine [name={k}]", v)
        print("TOTALE:", (await pg.inner_text("#ordineTotale")).replace("\n"," | "))
        sub=pg.locator("#formOrdine button[type=submit]"); print("pulsante:", await sub.inner_text())
        await sub.click(); await pg.wait_for_timeout(1500)
        await pg.screenshot(path="v12_preventivo.png", full_page=True)
        print("ESITO:", (await pg.inner_text("#ordinePopup")).replace("\n"," | ")[-700:])
        print("err", e); await b.close()
asyncio.run(main())
