# Modifica 14 cliccata: attivazione del secondo fattore dal pannello e accesso con il codice
import sys, asyncio, hmac, hashlib, struct, time, base64; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def codice(seg, d=0):
    k=base64.b32decode(seg); c=struct.pack(">Q", int(time.time()//30)+d); h=hmac.new(k,c,hashlib.sha1).digest(); o=h[-1]&15
    return str((struct.unpack(">I",h[o:o+4])[0]&0x7fffffff)%1000000).zfill(6)
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); E=[]
        a=await b.new_page(viewport={"width":1200,"height":900}); a.on("pageerror", lambda e: E.append(str(e)))
        await a.goto(B+"admin"); await a.wait_for_timeout(900); await a.fill("#admPw","passwordlunga1"); await a.press("#admPw","Enter"); await a.wait_for_timeout(1500)
        await a.click(".schede-adm [data-tab=impostazioni]"); await a.wait_for_timeout(700)
        print("1 riquadro:", (await a.locator(".scheda", has_text="Sicurezza dell'accesso").inner_text()).replace("\n"," | ")[:200])
        await a.click("[data-totp-nuovo]"); await a.wait_for_timeout(1500)
        seg=(await a.inner_text("#totpBox code")).replace(" ","")
        await a.fill("#taCod", codice(seg)); await a.screenshot(path="s14_qr.png"); await a.click("[data-f=totpAttiva] button"); await a.wait_for_timeout(1200)
        print("2 attivato:", (await a.inner_text("#totpBox")).replace("\n"," | ")[:160])
        await a.click("[data-ricarica]"); await a.wait_for_timeout(1200)
        print("  dopo:", (await a.locator(".scheda", has_text="Sicurezza dell'accesso").inner_text()).replace("\n"," | ")[:140])
        await a.evaluate("sessionStorage.clear()"); await a.goto(B+"admin"); await a.wait_for_timeout(1000)
        await a.fill("#admPw","passwordlunga1"); await a.press("#admPw","Enter"); await a.wait_for_timeout(1200)
        print("3 dopo la password:", (await a.inner_text("#admMsg")).strip(), "| campo codice:", await a.is_visible("#admCod"))
        await a.screenshot(path="s14_login.png")
        await a.fill("#admCod", codice(seg, 1)); await a.press("#admCod","Enter"); await a.wait_for_timeout(1500)
        print("  dentro:", await a.locator(".schede-adm").count() > 0)
        print("errori:", E); await b.close()
asyncio.run(main())
