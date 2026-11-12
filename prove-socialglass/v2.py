import asyncio, json
from playwright.async_api import async_playwright
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        await ctx.route("**/*", rt)
        await pg.goto("http://localhost:8823/caf"); await pg.wait_for_timeout(1200)
        await pg.fill("#codice","CAF001"); await pg.fill("#inputPassword","demo"); await pg.click("#passwordPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        await pg.click("#cruCaf .cru-principale button"); await pg.wait_for_timeout(600)
        await pg.fill("#codiceFiscale","BNCMRA85M41C351U"); await pg.click("#attivaCodiceFiscale"); await pg.wait_for_timeout(700)
        await pg.fill("#nome","Maria"); await pg.fill("#cognome","Bianchi"); await pg.fill("#nato","Catania"); await pg.fill("#datanascita","1985-08-01"); await pg.select_option("#sesso", index=2)
        print("sesso opzioni:", await pg.eval_on_selector("#sesso","s=>[...s.options].map(o=>o.value)"), "scelto", await pg.input_value("#sesso"))
        await pg.fill("#cellulare","3331112233"); await pg.select_option("#ottica","OTT07"); await pg.check("#gdprAcceptance")
        print("convenzione:", await pg.input_value("#listinoTextBox"))
        await pg.click("#inviaLink"); await pg.wait_for_timeout(1500)
        if await pg.is_visible("#formErr"): print("ERR form:", await pg.inner_text("#formErr"))
        await pg.screenshot(path="v04_inviato.png", full_page=True)
        print("INVIATO:", (await pg.inner_text("#inviatoPopup")).replace("\n"," | ")[:400])
        wa=await pg.get_attribute("#inviatoWa","href"); link=await pg.inner_text("#inviatoLink"); cod=await pg.inner_text("#inviatoCodice")
        import urllib.parse; print("WA testo:", urllib.parse.unquote(wa.split("text=")[-1]) if wa else wa); print("link:", link, "cod:", cod)
        json.dump({"link":link,"cod":cod}, open("v_stato.json","w")); print("err", e); await b.close()
asyncio.run(main())
