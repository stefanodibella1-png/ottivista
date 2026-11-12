import asyncio, json
from playwright.async_api import async_playwright
def rt(r):
    u=r.request.url
    return r.continue_() if u.startswith("http://localhost") or u.startswith("data:") or u.startswith("blob:") or u.startswith("about:") else r.abort()
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); ctx=await b.new_context(viewport={"width":390,"height":844}); pg=await ctx.new_page(); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        pg.on("dialog", lambda d: asyncio.ensure_future(d.accept())); await ctx.route("**/*", rt)
        await pg.goto("http://localhost:8823/caf"); await pg.wait_for_timeout(1200)
        await pg.fill("#codice","CAF001"); await pg.fill("#inputPassword","demo"); await pg.click("#passwordPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        # 1. volantino
        async with ctx.expect_page() as np: await pg.click("#cruCaf [data-volantino]")
        v=await np.value; await v.wait_for_load_state(); await v.wait_for_timeout(500); await v.set_viewport_size({"width":800,"height":1100}); await v.screenshot(path="v01_volantino.png", full_page=True)
        print("VOLANTINO:\n", (await v.inner_text("body"))[:1500]); await v.close()
        # 2. registrazione
        await pg.click("#cruCaf .cru-principale button"); await pg.wait_for_timeout(600)
        await pg.screenshot(path="v02_form.png", full_page=True)
        await pg.fill("#codiceFiscale","BNCMRA85M41C351U"); await pg.wait_for_timeout(300)
        if await pg.locator("#attivaCodiceFiscale").is_visible(): await pg.click("#attivaCodiceFiscale"); await pg.wait_for_timeout(600)
        vals={k: await pg.input_value("#"+k) for k in ["nome","cognome","nato","datanascita","sesso"]}; print("dal CF:", vals, "| esito cf:", await pg.inner_text("#cfEsito") if await pg.locator("#cfEsito").is_visible() else "")
        await pg.fill("#nome","Maria") if not vals["nome"] else None; await pg.fill("#cognome","Bianchi") if not vals["cognome"] else None
        await pg.fill("#cellulare","3331112233")
        opts=await pg.eval_on_selector("#ottica","s=>[...s.options].map(o=>o.value+'|'+o.text)"); print("ottiche:", opts)
        await pg.select_option("#ottica", index=1)
        await pg.check("#gdprAcceptance"); await pg.screenshot(path="v03_form_pieno.png", full_page=True)
        await pg.click("#inviaLink"); await pg.wait_for_timeout(1500)
        print("dopo invio visibili:", [x for x in ["#inviatoPopup","#popupForm","#formErr"] if await pg.is_visible(x)])
        if await pg.is_visible("#formErr"): print("ERR form:", await pg.inner_text("#formErr"))
        await pg.screenshot(path="v04_inviato.png", full_page=True)
        print("INVIATO:\n", (await pg.inner_text("#inviatoPopup"))[:800])
        links=await pg.eval_on_selector_all("#inviatoPopup a","as=>as.map(a=>a.href)"); print("links:", links)
        json.dump({"links":links}, open("v_stato.json","w")); print("err", e); await b.close()
asyncio.run(main())
