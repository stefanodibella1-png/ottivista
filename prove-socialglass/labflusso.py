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
print("trasferisci:", post("api/admin", {"azione": "magazzino", "codice": "SG-1043", "op": "carico", "qta": 1, "a": "OTT07"}, A))
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
        await pc.fill("#cellulare", "3331112233"); await pc.fill("#residenza", "Via Etnea 100"); await pc.fill("#cap", "95124"); await pc.fill("#comune", "Catania"); await pc.fill("#provincia", "CT"); await pc.select_option("#ottica", "OTT07"); await pc.check("#gdprAcceptance")
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
        await c.reload(); await c.wait_for_timeout(2200); await c.check("#c1"); await c.check("#c2"); await c.check("#c3"); await c.check("#c3"); await c.click("#mpPaga"); await c.wait_for_timeout(900)
        await c.get_by_role("button", name="Abbonati").click(); await c.wait_for_timeout(2500); print("4 TEL attivato:", t(await c.inner_text("#mpTitolo")))
        # 5. laboratorio: nuovo ordine da verificare → chiede la montatura all'ottica
        l = await nuovo(b, "pc"); await l.goto(B + "laboratorio"); await l.wait_for_timeout(600); await l.fill("#pw", "laboratorio1"); await l.click("#fLogin button"); await l.wait_for_timeout(1200)
        print("5 LAB titolo:", await l.title(), "| kpi:", t(await l.inner_text(".kpi")))
        riga = l.locator(f"details[data-u={COD}]"); print("   busta:", t(await riga.inner_text())[:300])
        await riga.locator("summary").click(); await l.wait_for_timeout(300); print("   ricetta chiusa:", "si apre quando" in await riga.inner_text())
        await l.screenshot(path="lf1_lab_verifica.png", full_page=True)
        rq = riga.locator("button[data-az=richiedi]"); await rq.click(); await l.wait_for_timeout(300); await rq.click(); await l.wait_for_timeout(1200)
        print("   dopo richiesta:", t(await l.inner_text("body"))[:300])
        # 6. tablet ottica: avviso e scheda per il laboratorio
        await o.reload(); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        print("6 OTT da fare:", t(await o.inner_text("#cruOtt .fare")))
        await o.locator("#cruOtt .fare button").filter(has_text="laboratorio").click(); await o.wait_for_timeout(1200)
        card = o.locator(f"#clientiLista details.cli[data-u={COD}]")
        if not await card.get_attribute("open"): await card.locator("summary").click(); await o.wait_for_timeout(400)
        print("   card:", t(await card.inner_text())[:600]); await o.screenshot(path="lf2_ott_avviso.png", full_page=True)
        async with o.context.expect_page() as pp: await card.locator("[data-stampa-lab]").click()
        sc = await pp.value; await sc.wait_for_timeout(800); await sc.set_viewport_size({"width": 800, "height": 1100}); await sc.screenshot(path="lf3_scheda.png", full_page=True); print("   scheda:", t(await sc.inner_text("body"))[:300]); await sc.close()
        # 7. laboratorio: montatura arrivata → ricetta → pronto
        await l.reload(); await l.wait_for_timeout(1200); await l.locator("[data-f=arrivo]").first.click(); await l.wait_for_timeout(300)
        riga = l.locator(f"details[data-u={COD}]"); await riga.locator("button[data-az=disponibile]").first.click(); await l.wait_for_timeout(1200)
        print("7 LAB dopo arrivo:", t(await l.inner_text("body"))[:400]); await l.screenshot(path="lf4_lab_ricetta.png", full_page=True)
        riga = l.locator(f"details[data-u={COD}]")
        for i in range(3):
            bt = riga.locator("summary button")
            if not await bt.count(): break
            print("   clic:", await bt.first.inner_text()); await bt.first.click(); await l.wait_for_timeout(900)
        await c.reload(); await c.wait_for_timeout(2200); print("8 TEL:", t(await c.inner_text("#mpTitolo")))
        print("errori:", E); await b.close()
asyncio.run(main())
