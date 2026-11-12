import asyncio, json, re, sys, urllib.request
from playwright.async_api import async_playwright
B = "http://localhost:8823/"
QR = "/home/claude/prove/npmqr/package/qrcode.js"
def post(path, body, tok=None):
    r = urllib.request.Request(B + path, data=json.dumps(body).encode(), headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
A = post("api/admin", {"azione": "imposta", "password": "passwordlunga1"}).get("token") or post("api/admin", {"azione": "accedi", "password": "passwordlunga1"})["token"]
post("api/admin", {"azione": "salvaLab", "nome": "Lab Demo", "attivo": True, "password": "laboratorio1"}, A)
SCELTA = sys.argv[1] if len(sys.argv) > 1 else "riscatta"   # rinnova | riscatta | restituisci
DEV = {"pc": {"viewport": {"width": 1366, "height": 768}},
       "tablet": {"viewport": {"width": 820, "height": 1180}, "is_mobile": True, "has_touch": True},
       "tel": {"viewport": {"width": 390, "height": 844}, "is_mobile": True, "has_touch": True, "device_scale_factor": 2}}
E = []
async def nuovo(b, d):
    ctx = await b.new_context(**DEV[d]); pg = await ctx.new_page()
    pg.on("pageerror", lambda x: E.append(d + ": " + str(x))); pg.on("dialog", lambda x: asyncio.ensure_future(x.accept()))
    await ctx.route("**/*", lambda r: r.fulfill(path=QR, content_type="text/javascript") if "qrcode" in r.request.url else (r.continue_() if re.match(r"^(http://localhost|data:|blob:|about:)", r.request.url) else r.abort()))
    return pg
def t(s): return s.replace("\n", " | ")[:500]
async def barra(c, op, g=None, foto=None):
    sel = f"#sgTempo button[data-op={op}]" + (f"[data-g='{g}']" if g is not None else "")
    if "chiusa" in (await c.get_attribute("#sgTempo", "class") or ""): await c.click("#sgtP")
    await c.click(sel); await c.wait_for_function("!document.querySelector('#sgTempo button[data-op]').disabled", timeout=15000); await c.wait_for_timeout(600)
    print(f"  ⏱ {op} {g or ''} →", await c.inner_text("#sgtE"), "| tempo:", await c.inner_text("#sgtG"))
    if foto: await c.screenshot(path=foto)
    await c.click("#sgtP"); await c.wait_for_timeout(300)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1. PC — CAF registra la cliente
        pc = await nuovo(b, "pc"); await pc.goto(B + "caf"); await pc.wait_for_timeout(1200)
        await pc.fill("#codice", "CAF001"); await pc.fill("#inputPassword", "demo"); await pc.click("#passwordPopup button[type=submit]"); await pc.wait_for_timeout(1500)
        await pc.click("#cruCaf .cru-principale button"); await pc.wait_for_timeout(600)
        await pc.fill("#codiceFiscale", "BNCMRA85M41C351U"); await pc.wait_for_timeout(300)
        if await pc.locator("#attivaCodiceFiscale").is_visible(): await pc.click("#attivaCodiceFiscale"); await pc.wait_for_timeout(600)
        for k, v in {"nome": "Maria", "cognome": "Bianchi", "nato": "Catania"}.items():
            if not await pc.input_value("#" + k): await pc.fill("#" + k, v)
        await pc.fill("#cellulare", "3331112233"); await pc.select_option("#ottica", "OTT07"); await pc.check("#gdprAcceptance")
        await pc.click("#inviaLink"); await pc.wait_for_timeout(1500); await pc.screenshot(path="t01_pc_caf.png")
        COD = (await pc.inner_text("#inviatoCodice")).strip(); print("1 PC CAF → cliente", COD)
        # 2. telefono — la cliente apre il link e sceglie la montatura (scanner, codice a mano)
        c = await nuovo(b, "tel"); await c.goto(f"{B}?Univoco={COD}&espositore=OTT07&promotore=CAF001&listino=A"); await c.wait_for_timeout(2500)
        print("2 TEL barra visibile:", await c.is_visible("#sgTempo"), "|", t(await c.inner_text("#mpTitolo")))
        await c.screenshot(path="t02_tel_link.png")
        await c.click("#mpScan"); await c.wait_for_timeout(900); await c.locator("#video-container input").fill("SG-1043"); await c.locator("#video-container .manuale button").click(); await c.wait_for_timeout(1300)
        await c.get_by_role("button", name="Scelgo questa montatura").click(); await c.wait_for_timeout(1500)
        print("   montatura scelta:", t(await c.inner_text("#mpTitolo")))
        # 3. tablet — l'ottica inserisce lenti e ricetta
        o = await nuovo(b, "tablet"); await o.goto(B + "ottico"); await o.wait_for_timeout(1200)
        await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.click("#cruOtt .cru-principale button"); await o.wait_for_timeout(500); await o.fill("#ordineCodice", COD); await o.click("#formOrdineCerca button"); await o.wait_for_timeout(1000)
        await o.locator("#ordineLenti label").filter(has_text="Monofocali").first.click(); await o.locator("#formOrdine label").filter(has_text="Antiriflesso").click()
        for k, v in {"OD_sf": "-1.25", "OD_cil": "-0.50", "OD_ax": "90", "OS_sf": "-1", "pd": "63"}.items(): await o.fill(f"#formOrdine [name={k}]", v)
        await o.screenshot(path="t03_tablet_ordine.png", full_page=True)
        await o.click("#formOrdine button[type=submit]"); await o.wait_for_timeout(1500); print("3 TABLET ordine:", t((await o.inner_text("#ordinePopup"))[-300:]))
        # 4. telefono — attiva l'abbonamento
        await c.reload(); await c.wait_for_timeout(2200); await c.check("#c1"); await c.check("#c2"); await c.click("#mpPaga"); await c.wait_for_timeout(900)
        await c.get_by_role("button", name="Abbonati").click(); await c.wait_for_timeout(2500); print("4 TEL attivato:", t(await c.inner_text("#mpTitolo")))
        # 5. laboratorio (telefono del laboratorio)
        l = await nuovo(b, "tel"); await l.goto(B + "laboratorio"); await l.wait_for_timeout(600); await l.fill("#pw", "laboratorio1"); await l.click("#fLogin button"); await l.wait_for_timeout(1200)
        riga = l.locator(f"details[data-u={COD}]"); await riga.locator("summary").click(); await l.wait_for_timeout(400)
        for i in range(3):
            bt = riga.locator("summary button")
            if not await bt.count(): break
            await bt.click(); await l.wait_for_timeout(900)
        await c.reload(); await c.wait_for_timeout(2200); print("5 LAB → TEL:", t(await c.inner_text("#mpTitolo")))
        # 6. tablet — consegna
        await o.reload(); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt .fare button").filter(has_text="consegnare").click(); await o.wait_for_timeout(1200)
        card = o.locator(f"#clientiLista details.cli[data-u={COD}]")
        if not await card.get_attribute("open"): await card.locator("summary").click(); await o.wait_for_timeout(400)
        cons = card.locator("button").filter(has_text="onsegnat"); await cons.first.click(); await o.wait_for_timeout(600)
        if await cons.count() and re.search("onferm|di nuovo", await cons.first.inner_text()): await cons.first.click(); await o.wait_for_timeout(1000)
        await c.reload(); await c.wait_for_timeout(2200); print("6 TABLET consegna → TEL:", t(await c.inner_text("#mpTitolo")))
        await c.screenshot(path="t06_tel_consegnato.png")
        # 7. il tempo passa (barra sul telefono)
        await barra(c, "avanti", 7, "t07_tel_7giorni.png"); print("   recensione chiesta:", await c.locator("[data-stella]").count() > 0)
        await barra(c, "avanti", 30)
        await barra(c, "insoluto", 0); await barra(c, "avanti", 7, "t08_tel_insoluto.png"); print("   pagina:", t(await c.inner_text("#mpAzione"))[:300])
        await o.reload(); await o.wait_for_timeout(1500); print("   TABLET da fare:", [t(await x.inner_text()) for x in await o.locator("#cruOtt .fare button").all()])
        await barra(c, "paga"); await barra(c, "avanti", 182); await barra(c, "fine", None, "t09_tel_preavviso.png"); print("   pagina:", t(await c.inner_text("#mpAzione"))[:400])
        # 8. scelta di fine periodo e scadenza
        await c.click(f"[data-fine={SCELTA}]"); await c.wait_for_timeout(700); bt = c.locator("#fineConferma button")
        if await bt.count(): await bt.first.click(); await c.wait_for_timeout(1200)
        print(f"8 TEL scelta {SCELTA}:", t(await c.inner_text("#mpAzione"))[:300])
        await barra(c, "avanti", 30, "t10_tel_fine.png"); print("   pagina:", t(await c.inner_text("#mpAzione"))[:400])
        await o.reload(); await o.wait_for_timeout(1500); print("   TABLET da fare:", [t(await x.inner_text()) for x in await o.locator("#cruOtt .fare button").all()])
        await o.screenshot(path="t11_tablet_fine.png")
        await pc.reload(); await pc.wait_for_timeout(1500); await pc.screenshot(path="t12_pc_caf.png"); print("   PC CAF:", t(await pc.inner_text("#cruCaf"))[:300])
        # 9. un anno dopo la consegna: controllo della vista
        await barra(c, "avanti", 30, None); await barra(c, "avanti", 30, "t13_tel_dopo.png"); print("   pagina:", t(await c.inner_text("#mpAzione"))[:300])
        await o.reload(); await o.wait_for_timeout(1500); print("   TABLET da fare:", [t(await x.inner_text()) for x in await o.locator("#cruOtt .fare button").all()])
        print("ERRORI JS:", E); await b.close()
asyncio.run(main())
