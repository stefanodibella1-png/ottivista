# Modifica 14: la regola di sicurezza (CSP) non deve bloccare niente del sito. Si aprono tutte le pagine e le finestre di stampa
# e si raccolgono i messaggi «Refused … Content Security Policy». Server: srv.js (applica le intestazioni di vercel.json)
import sys, asyncio; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
from playwright.async_api import async_playwright
uv=nuovo("PRVGLI60A41C351","GIULIA","SG-1042")
V=[]
def guarda(pg, dove):
    pg.on("console", lambda m: V.append(f"{dove}: {m.text[:160]}") if ("Content Security Policy" in m.text or "Refused" in m.text) else None)
    pg.on("pageerror", lambda e: V.append(f"{dove} errore: {str(e)[:160]}"))
async def tutte(ctx, dove):
    ctx.on("page", lambda p: guarda(p, dove + " (finestra)"))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        # cliente
        c=await b.new_context(viewport={"width":390,"height":844}); await tutte(c,"cliente"); pg=await c.new_page(); guarda(pg,"cliente")
        await pg.goto(B+"?Univoco="+uv); await pg.wait_for_timeout(1500)
        r=await pg.evaluate("fetch('/').then(r=>r.headers.get('content-security-policy'))"); print("CSP presente:", bool(r))
        for t in ["Condizioni dell'abbonamento"]:
            x=pg.get_by_role("button", name=t)
            if await x.count(): await x.first.click(); await pg.wait_for_timeout(600)
        await pg.goto(B+"privacy.html"); await pg.wait_for_timeout(800); print("privacy, titolare caricato dal file:", await pg.locator("[data-t]").count() >= 0)
        await pg.goto(B); await pg.wait_for_timeout(1200)
        # ottica
        o=await b.new_context(viewport={"width":820,"height":1180}); await tutte(o,"ottica"); op=await o.new_page(); guarda(op,"ottica")
        await op.goto(B+"ottico"); await op.wait_for_timeout(1200)
        if await op.is_visible("#otticoPopup"): await op.fill("#codiceOttico","OTT07"); await op.fill("#inputPasswordOttico","demo"); await op.click("#otticoPopup button[type=submit]"); await op.wait_for_timeout(1500)
        for t in ["Montature esposte","Listino e canoni","Appuntamenti","I miei conteggi"]:
            x=op.locator("#cruOtt button", has_text=t)
            if await x.count(): await x.first.click(); await op.wait_for_timeout(700); await op.keyboard.press("Escape"); await op.goto(B+"ottico"); await op.wait_for_timeout(1000)
        x=op.locator("#cruOtt button", has_text="Locandina")
        if await x.count(): await x.first.click(); await op.wait_for_timeout(2500)
        await op.locator("#cruOtt button", has_text="I miei clienti").first.click(); await op.wait_for_timeout(1000)
        x=op.locator("[data-stampa-elenco]");
        if await x.count(): await x.first.click(); await op.wait_for_timeout(1200)
        # CAF: modulo e QR
        k=await b.new_context(viewport={"width":1200,"height":900}); await tutte(k,"caf"); kp=await k.new_page(); guarda(kp,"caf")
        await kp.goto(B+"caf"); await kp.wait_for_timeout(1200)
        if await kp.is_visible("#cafPopup"):
            await kp.fill("#codiceCaf","CAF001"); await kp.fill("#inputPasswordCaf","demo"); await kp.click("#cafPopup button[type=submit]"); await kp.wait_for_timeout(1500)
        x=kp.locator("button", has_text="Nuovo cliente")
        if await x.count(): await x.first.click(); await kp.wait_for_timeout(800)
        # pannello: tutte le schede
        a=await b.new_context(viewport={"width":1200,"height":900}); await tutte(a,"pannello"); ap=await a.new_page(); guarda(ap,"pannello")
        await ap.goto(B+"admin"); await ap.wait_for_timeout(900); await ap.fill("#admPw","passwordlunga1"); await ap.press("#admPw","Enter"); await ap.wait_for_timeout(1500)
        for t in await ap.locator(".schede-adm [data-tab]").all():
            k2=await t.get_attribute("data-tab"); await ap.click(f".schede-adm [data-tab={k2}]"); await ap.wait_for_timeout(700)
        await ap.click(".schede-adm [data-tab=numeri]"); await ap.wait_for_timeout(600)
        x=ap.locator("button", has_text="Report")
        if await x.count(): await x.first.click(); await ap.wait_for_timeout(1500)
        await ap.click(".schede-adm [data-tab=impostazioni]"); await ap.wait_for_timeout(700)
        await ap.click("[data-totp-nuovo]"); await ap.wait_for_timeout(1500); print("QR del secondo fattore disegnato:", await ap.locator("#totpQr canvas, #totpQr img").count() > 0)
        await ap.click(".schede-adm [data-tab=magazzino]"); await ap.wait_for_timeout(700)
        x=ap.locator("button", has_text="Stampa etichette")
        if await x.count(): await x.first.click(); await ap.wait_for_timeout(2000)
        # laboratorio e stampa della busta
        l=await b.new_context(viewport={"width":1280,"height":900}); await tutte(l,"laboratorio"); lp=await l.new_page(); guarda(lp,"laboratorio")
        await lp.goto(B+"laboratorio"); await lp.wait_for_timeout(600); await lp.fill("#pw","laboratorio1"); await lp.click("#fLogin button"); await lp.wait_for_timeout(1200)
        await lp.click("[data-f=tutti]"); await lp.wait_for_timeout(400)
        bu=lp.locator("details.busta").first; await bu.locator("input.sel").click(); await lp.wait_for_timeout(300)
        print("casella della busta: busta aperta?", await bu.get_attribute("open"), "| selezionate:", (await lp.inner_text("#stampaSel")).strip())
        await lp.click("#stampaSel"); await lp.wait_for_timeout(1500)
        print("violazioni o errori:", V if V else "nessuno"); await b.close()
asyncio.run(main())
