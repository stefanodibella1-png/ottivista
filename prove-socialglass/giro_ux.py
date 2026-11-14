from aiuti_ottica import arrivo_e_consegna
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
    ctx = await b.new_context(bypass_csp=True, **DEV[d]); pg = await ctx.new_page()
    pg.on("pageerror", lambda x: E.append(d + ": " + str(x))); pg.on("dialog", lambda x: asyncio.ensure_future(x.accept()))
    await ctx.route("**/*", lambda r: r.fulfill(path=QR, content_type="text/javascript") if "qrcode" in r.request.url else (r.continue_() if re.match(r"^(http://localhost|data:|blob:|about:)", r.request.url) else r.abort()))
    return pg
import os
os.makedirs("ux", exist_ok=True); N=[0]
async def foto(pg, nome, intera=True):
    N[0]+=1; await pg.wait_for_timeout(300); await pg.screenshot(path=f"ux/{N[0]:02d}_{nome}.png", full_page=intera)
    try: testo = await pg.inner_text("body")
    except Exception: testo = ""
    open(f"ux/{N[0]:02d}_{nome}.txt", "w").write(re.sub(r"\n{3,}", "\n\n", testo))
def t(s): return s.replace("\n", " | ")[:500]
async def barra(c, op, g=None, ft=None):
    sel = f"#sgTempo button[data-op={op}]" + (f"[data-g='{g}']" if g is not None else "")
    if "chiusa" in (await c.get_attribute("#sgTempo", "class") or ""): await c.click("#sgtP")
    await c.click(sel); await c.wait_for_function("!document.querySelector('#sgTempo button[data-op]').disabled", timeout=15000); await c.wait_for_timeout(600)
    print(f"  ⏱ {op} {g or ''} →", await c.inner_text("#sgtE"), "| tempo:", await c.inner_text("#sgtG"))
    if ft: await c.screenshot(path=ft)
    await c.click("#sgtP"); await c.wait_for_timeout(300)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # 1. PC — CAF registra la cliente
        pc = await nuovo(b, "pc"); await pc.goto(B + "caf"); await pc.wait_for_timeout(1200); await foto(pc, "PC_CAF_accesso")
        await pc.fill("#codice", "CAF001"); await pc.fill("#inputPassword", "demo"); await pc.click("#passwordPopup button[type=submit]"); await pc.wait_for_timeout(1500); await foto(pc, "PC_CAF_cruscotto")
        await pc.click("#cruCaf .cru-principale button"); await pc.wait_for_timeout(600)
        await pc.fill("#codiceFiscale", "BNCMRA85M41C351U"); await pc.wait_for_timeout(300)
        if await pc.locator("#attivaCodiceFiscale").is_visible(): await pc.click("#attivaCodiceFiscale"); await pc.wait_for_timeout(600)
        for k, v in {"nome": "Maria", "cognome": "Bianchi", "nato": "Catania"}.items():
            if not await pc.input_value("#" + k): await pc.fill("#" + k, v)
        await pc.fill("#cellulare", "3331112233"); await pc.fill("#residenza", "Via Etnea 100"); await pc.fill("#cap", "95124"); await pc.fill("#comune", "Catania"); await pc.fill("#provincia", "CT"); await pc.select_option("#ottica", "OTT07"); await pc.check("#gdprAcceptance"); await foto(pc, "PC_CAF_nuovo_cliente_compilato")
        await pc.click("#inviaLink"); await pc.wait_for_timeout(1500); await foto(pc, "PC_CAF_link_inviato")
        COD = (await pc.inner_text("#inviatoCodice")).strip(); print("1 PC CAF → cliente", COD)
        # 2. telefono — la cliente apre il link e sceglie la montatura (scanner, codice a mano)
        c = await nuovo(b, "tel"); await c.goto(f"{B}?Univoco={COD}&espositore=OTT07&promotore=CAF001&listino=A"); await c.wait_for_timeout(2500)
        print("2 TEL barra visibile:", await c.is_visible("#sgTempo"), "|", t(await c.inner_text("#mpTitolo")))
        await foto(c, "TEL_cliente_apre_link")
        await c.check("#cSan"); await c.click("#cSanOk"); await c.wait_for_timeout(800); await c.click("#mpScan"); await c.wait_for_timeout(900); await c.locator("#video-container input").fill("SG-1043"); await c.locator("#video-container .manuale button").click(); await c.wait_for_timeout(1300); await foto(c, "TEL_cliente_montatura_scansionata")
        await c.get_by_role("button", name="Scelgo questa montatura").click(); await c.wait_for_timeout(1500)
        await foto(c, "TEL_cliente_dopo_scelta"); print("   montatura scelta:", t(await c.inner_text("#mpTitolo")))
        # 3. tablet — l'ottica inserisce lenti e ricetta
        o = await nuovo(b, "tablet"); await o.goto(B + "ottico"); await o.wait_for_timeout(1200); await foto(o, "TABLET_ottica_accesso")
        await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500); await foto(o, "TABLET_ottica_cruscotto")
        await o.click("#cruOtt .cru-principale button"); await o.wait_for_timeout(500); await o.fill("#ordineCodice", COD); await o.click("#formOrdineCerca button"); await o.wait_for_timeout(1000)
        await o.locator("#ordineLenti label").filter(has_text="Monofocali").first.click(); await o.locator("#formOrdine label").filter(has_text="Antiriflesso").click()
        for k, v in {"OD_sf": "-1.25", "OD_cil": "-0.50", "OD_ax": "90", "OS_sf": "-1", "pd": "63"}.items(): await o.fill(f"#formOrdine [name={k}]", v)
        await foto(o, "TABLET_ottica_preventivo_compilato")
        await o.click("#formOrdine button[type=submit]"); await o.wait_for_timeout(1500); await foto(o, "TABLET_ottica_preventivo_inviato"); print("3 TABLET ordine:", t((await o.inner_text("#ordinePopup"))[-300:]))
        # 4. telefono — attiva l'abbonamento
        await c.reload(); await c.wait_for_timeout(2200); await foto(c, "TEL_cliente_riepilogo_preventivo"); await c.check("#c1"); await c.check("#c2"); await c.check("#c3"); await c.check("#c3"); await c.click("#mpPaga"); await c.wait_for_timeout(900); await foto(c, "TEL_cliente_pagamento", False)
        await c.get_by_role("button", name="Abbonati").click(); await c.wait_for_timeout(2500); await foto(c, "TEL_cliente_abbonamento_attivo"); print("4 TEL attivato:", t(await c.inner_text("#mpTitolo")))
        # 5. laboratorio: nuovo ordine da verificare → chiede la montatura all'ottica
        l = await nuovo(b, "pc"); await l.goto(B + "laboratorio"); await l.wait_for_timeout(600); await l.fill("#pw", "laboratorio1"); await l.click("#fLogin button"); await l.wait_for_timeout(1200)
        print("5 LAB titolo:", await l.title(), "| kpi:", t(await l.inner_text(".kpi")))
        riga = l.locator(f".busta-w[data-u={COD}]"); print("   busta:", t(await riga.inner_text())[:300])
        await riga.locator("summary b").click(); await l.wait_for_timeout(300); print("   ricetta chiusa:", "si apre quando" in await riga.inner_text())
        await foto(l, "PC_LAB_nuovo_ordine_da_verificare")
        rq = riga.locator("button[data-az=richiedi]"); await rq.click(); await l.wait_for_timeout(300); await rq.click(); await l.wait_for_timeout(1200)
        await foto(l, "PC_LAB_montatura_richiesta_all_ottica"); print("   dopo richiesta:", t(await l.inner_text("body"))[:300])
        # 6. tablet ottica: avviso e scheda per il laboratorio
        await o.reload(); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await foto(o, "TABLET_ottica_cruscotto_montatura_da_inviare"); print("6 OTT da fare:", t(await o.inner_text("#cruOtt .fare")))
        await o.locator("#cruOtt .fare button").filter(has_text="laboratorio").click(); await o.wait_for_timeout(1200)
        card = o.locator(f"#clientiLista details.cli[data-u={COD}]")
        if not await card.get_attribute("open"): await card.locator("summary").click(); await o.wait_for_timeout(400)
        print("   card:", t(await card.inner_text())[:600]); await foto(o, "TABLET_ottica_scheda_cliente_avviso")
        async with o.context.expect_page() as pp: await card.locator("[data-stampa-lab]").click()
        sc = await pp.value; await sc.wait_for_timeout(800); await sc.set_viewport_size({"width": 800, "height": 1100}); await foto(sc, "STAMPA_scheda_per_il_laboratorio"); print("   scheda:", t(await sc.inner_text("body"))[:300]); await sc.close()
        # 7. laboratorio: montatura arrivata → ricetta → pronto
        await l.reload(); await l.wait_for_timeout(1200); await l.locator("[data-f=arrivo]").first.click(); await l.wait_for_timeout(300)
        riga = l.locator(f".busta-w[data-u={COD}]"); await riga.locator("button[data-arrivo]").first.click(); await l.wait_for_timeout(500)
        await l.fill("#codMont", "SG-1043"); await foto(l, "PC_LAB_controllo_codice_montatura_arrivata"); await l.locator(f".busta-w[data-u={COD}] button[data-az=disponibile]").first.click(); await l.wait_for_timeout(1200)
        print("7 LAB dopo arrivo:", t(await l.inner_text("body"))[:400]); await foto(l, "PC_LAB_montatura_arrivata_ricetta")
        riga = l.locator(f".busta-w[data-u={COD}]")
        for i in range(5):
            bt = riga.locator(".busta-az button")
            if not await bt.count(): break
            print("   clic:", await bt.first.inner_text()); await bt.first.click(); await l.wait_for_timeout(900)
        await c.reload(); await c.wait_for_timeout(2200); await foto(l, "PC_LAB_occhiale_pronto"); await foto(c, "TEL_cliente_occhiale_pronto"); print("8 TEL:", t(await c.inner_text("#mpTitolo")))
        # consegna in ottica e tempo che passa
        print("consegna:", await arrivo_e_consegna(o, COD, foto))
        await c.reload(); await c.wait_for_timeout(2200); await foto(c, "TEL_cliente_occhiale_consegnato")
        await barra(c, "avanti", 7); await foto(c, "TEL_cliente_dopo_7_giorni_recensione")
        await barra(c, "avanti", 30); await barra(c, "insoluto", 0); await barra(c, "avanti", 7); await foto(c, "TEL_cliente_canone_non_pagato")
        await o.reload(); await o.wait_for_timeout(1500); await foto(o, "TABLET_ottica_cruscotto_insoluto")
        await barra(c, "paga"); await barra(c, "avanti", 182); await barra(c, "fine"); await foto(c, "TEL_cliente_fine_durata_minima_scelte")
        await c.click("[data-fine=riscatta]"); await c.wait_for_timeout(700); await foto(c, "TEL_cliente_conferma_riscatto")
        bt = c.locator("#fineConferma button")
        if await bt.count(): await bt.first.click(); await c.wait_for_timeout(1200)
        await foto(c, "TEL_cliente_dopo_riscatto")
        await pc.reload(); await pc.wait_for_timeout(1500)
        if await pc.is_visible("#passwordPopup"): await pc.fill("#codice", "CAF001"); await pc.fill("#inputPassword", "demo"); await pc.click("#passwordPopup button[type=submit]"); await pc.wait_for_timeout(1500)
        await foto(pc, "PC_CAF_cruscotto_finale")
        # pannello amministratore
        ad = await nuovo(b, "pc"); await ad.goto(B + "admin"); await ad.wait_for_timeout(1200); await foto(ad, "PC_ADMIN_accesso")
        await ad.fill("#admPw", "passwordlunga1"); await ad.press("#admPw", "Enter"); await ad.wait_for_timeout(2500); await foto(ad, "PC_ADMIN_oggi")
        for tb in [x for x in [await y.get_attribute("data-tab") for y in await ad.locator(".schede-adm button").all()] if x]:
            await ad.click(f".schede-adm [data-tab={tb}]"); await ad.wait_for_timeout(900); await foto(ad, "PC_ADMIN_" + tb)
        print("errori:", E); await b.close()
asyncio.run(main())
