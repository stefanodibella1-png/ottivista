# Modifica 9: consenso per la ricetta dato dal cliente + registrazione dall'ottica (API + interfaccia)
import sys, asyncio; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
C=call("api/login",{"ruolo":"caf","codice":"CAF001","password":"demo"})[1]["token"]
RES={"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}
def reg(base, nome, tok, ottica="OTT07"):
    return call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":ottica,"amico":"","gdpr":True,"residenza":RES},tok)
def prev(uv):
    s,r=call("api/ordine",{"univoco":uv,"lente":"mono","trattamenti":[],"ricetta":{"OD":{"sf":-1},"OS":{"sf":-1},"pd":63}},T); return s, r.get("errore") or "ok"
s,r=reg("PRVGLI60A41C351","GIULIA",C); uvC=r["univoco"]; c=scheda(uvC)
print("1 CAF registra:", s, "| CAF:", c["caf"], "| registrato da:", c["registratoDa"], "| link promotore:", "promotore=CAF001" in r["link"])
s,r=call("api/utenti?ottici=1",None,T); print("2 elenco ottiche per l'ottica:", [o["id"] for o in r["ottici"]])
s,r=reg("PRVMRT60A41C351","MARTA",T,ottica="OTT12"); uvO=r["univoco"]; c=scheda(uvO)
print("3 ottica registra (chiede OTT12):", s, "| ottica:", c["ottica"][:5], "| CAF:", repr(c["caf"]), "| registrato da:", c["registratoDa"], "| link promotore vuoto:", "promotore=&" in r["link"])
T12=call("api/login",{"ruolo":"ottico","codice":"OTT12","password":"demo"})[1]["token"]
s,r=call("api/utenti?cf="+cf("PRVMRT60A41C351"),None,T12); print("4 altra ottica cerca il CF:", r.get("stato"), "| nome:", r.get("nome"), "| codice:", r.get("univoco"))
s,r=call("api/utenti?cf="+cf("PRVMRT60A41C351"),None,T); print("  la sua ottica:", r.get("nome"), r.get("univoco")==uvO)
s,r=reg("PRVMRT60A41C351","MARTA",T); print("  doppione:", s, r.get("errore"))
call("api/montatura",{"univoco":uvO,"codice":"SG-1042"})
print("5 preventivo senza consenso:", prev(uvO))
s,r=call("api/ordine?univoco="+uvO,None,T); print("  lettura ordine: consenso", r.get("consenso"))
s,r=call("api/benvenuto",{"azione":"consenso","univoco":uvO,"si":False}); print("6 consenso senza spunta:", s, r.get("errore"))
s,r=call("api/benvenuto",{"azione":"consenso","univoco":uvO,"si":True}); print("  consenso:", s, r.get("consenso"))
s,r2=call("api/benvenuto",{"azione":"consenso","univoco":uvO,"si":True}); print("  ripetuto, stessa data:", r2.get("consenso")==r.get("consenso"))
s,r=call("api/benvenuto?univoco="+uvO+"&espositore="); print("  pagina cliente:", r.get("consensoSanitario") is not None, r.get("informativa"))
print("7 preventivo con consenso:", prev(uvO))
c=scheda(uvO); print("  scheda admin consenso:", bool(c["consensoSanitario"]), "| ultimo passo:", (c["passi"] or [{}])[-1])
s,r=call("api/clienti",None,T); x=[k for k in r.get("clienti",[]) if k["univoco"]==uvO]; print("8 elenco ottica: consenso", x and x[0]["consenso"], "| registratoDa", x and x[0]["registratoDa"])
s,r=call("api/clienti",None,C); print("  il CAF non vede il cliente dell'ottica:", not any(k["univoco"]==uvO for k in r.get("clienti",[])))

from playwright.async_api import async_playwright
async def ui():
    async with async_playwright() as p:
        b=await p.chromium.launch(); o=await b.new_page(viewport={"width":820,"height":1180}); E=[]; o.on("pageerror", lambda e: E.append(str(e)))
        await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.screenshot(path="c9_1_cruscotto.png")
        await o.locator("#cruOtt button", has_text="Nuovo cliente").first.click(); await o.wait_for_timeout(800)
        print("9 tablet · titolo:", await o.inner_text("#popupForm h2"))
        await o.fill("#codiceFiscale", cf("PRVLRA60A41C351")); await o.click("#attivaCodiceFiscale"); await o.wait_for_timeout(800)
        print("  ottica fissata:", await o.input_value("#ottica"), "| bloccata:", await o.is_disabled("#ottica"), "| listino:", await o.input_value("#listinoTextBox"))
        for k,v in {"nome":"LAURA","cognome":"PROVA","nato":"CATANIA","cellulare":"3330000099","residenza":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}.items(): await o.fill("#"+k, v)
        await o.click("#inviaLink"); await o.wait_for_timeout(500); print("  senza spunta:", (await o.inner_text("#formErr")).strip())
        print("  testo spunta:", (await o.inner_text("label.gdpr")).strip()[:90])
        await o.check("#gdprAcceptance"); await o.screenshot(path="c9_2_modulo.png"); await o.click("#inviaLink"); await o.wait_for_timeout(1200)
        uv=(await o.inner_text("#inviatoCodice")).strip(); link=(await o.inner_text("#inviatoLink")).strip(); print("  registrato:", uv, "| link:", link.split("?")[1][:60])
        # cliente sul telefono: riquadro del consenso in alto
        c=await b.new_page(viewport={"width":390,"height":844}); c.on("pageerror", lambda e: E.append(str(e)))
        await c.goto("http://localhost:8823/?"+link.split("?")[1]); await c.wait_for_timeout(1500)
        print("10 telefono · riquadro consenso:", await c.is_visible("#mpConsenso")); await c.screenshot(path="c9_3_cliente.png")
        await c.click("#mpScan"); await c.wait_for_timeout(900); await c.locator("#video-container input").fill("SG-1043"); await c.locator("#video-container .manuale button").click(); await c.wait_for_timeout(1300)
        await c.get_by_role("button", name="Scelgo questa montatura").click(); await c.wait_for_timeout(1500)
        await c.screenshot(path="c9_3b_dopo_scan.png"); print("  dopo la montatura riquadro ancora visibile:", await c.is_visible("#mpConsenso"), "|", (await c.inner_text("body"))[:300].replace(chr(10)," / "))
        # l'ottica prova a fare il preventivo
        await o.keyboard.press("Escape"); await o.goto("http://localhost:8823/ottico"); await o.wait_for_timeout(1200)
        await o.click("#cruOtt .cru-principale button"); await o.wait_for_timeout(500); await o.fill("#ordineCodice", uv); await o.click("#formOrdineCerca button"); await o.wait_for_timeout(1000)
        print("11 tablet senza consenso:", (await o.inner_text("#ordineEsito")).strip()[:110], "| modulo visibile:", await o.is_visible("#formOrdine")); await o.screenshot(path="c9_4_ottica_blocco.png")
        await c.click("#cSanOk"); await c.wait_for_timeout(500); print("12 telefono conferma senza spunta:", (await c.inner_text("#cSanErr")).strip())
        await c.check("#cSan"); await c.click("#cSanOk"); await c.wait_for_timeout(1000); print("  dopo il consenso riquadro:", await c.is_visible("#mpConsenso")); await c.screenshot(path="c9_5_cliente_ok.png")
        await o.click("#ricontrollaConsenso"); await o.wait_for_timeout(1000); print("13 tablet ricontrolla → modulo visibile:", await o.is_visible("#formOrdine"))
        print("errori pagina:", E); await b.close()
asyncio.run(ui())
