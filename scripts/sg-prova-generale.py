# SocialGlass · prova generale sul sito vero con Stripe in modalità TEST (gira nel workflow socialglass-prova-generale).
# Clienti di prova «PROVA» del CAF001 / ottica OTT07; alla fine si cancellano (clienti, abbonamenti e clienti Stripe di prova, prenotazioni).
import os, sys, json, time, hmac, hashlib, base64, subprocess, urllib.request, urllib.parse, asyncio, traceback
from playwright.async_api import async_playwright

SITO = os.environ.get("SITO", "https://socialglass.vercel.app").rstrip("/")
SK = os.environ["STRIPE_SECRET_KEY"]; SEG = os.environ["SESSION_SECRET"]
assert SK.startswith(("sk_test_", "rk_test_")), "La prova generale gira solo con Stripe in modalità TEST"
OUT = "pg"; os.makedirs(OUT, exist_ok=True)
RIS, CLIENTI, CLIENTI_STRIPE = [], [], set()
def esito(passo, ok, dettaglio=""):
    RIS.append((passo, ok, str(dettaglio)[:300])); print(("OK  " if ok else "KO  ") + passo + (" · " + str(dettaglio)[:300] if dettaglio else ""), flush=True)

# --- accessi: CAF e ottica con le password di prova, laboratorio e amministratore con un accesso firmato (vale 2 ore)
def firma(ruolo, id_):
    body = base64.urlsafe_b64encode(json.dumps({"exp": int(time.time()*1000) + 2*3600e3, "ruolo": ruolo, "id": id_}).encode()).decode().rstrip("=")
    return body + "." + base64.urlsafe_b64encode(hmac.new(SEG.encode(), body.encode(), hashlib.sha256).digest()).decode().rstrip("=")
def call(path, body=None, tok=None, metodo=None):
    r = urllib.request.Request(SITO + "/" + path, data=json.dumps(body).encode() if body is not None else None, method=metodo,
        headers={"Content-Type": "application/json", **({"Authorization": "Bearer " + tok} if tok else {})})
    try: x = urllib.request.urlopen(r, timeout=60); return x.status, json.load(x)
    except urllib.error.HTTPError as e:
        try: return e.code, json.load(e)
        except Exception: return e.code, {}
def stripe(metodo, path, params=None):
    data = urllib.parse.urlencode(params or {}, doseq=True).encode() if metodo != "GET" else None
    url = "https://api.stripe.com/v1/" + path + ("?" + urllib.parse.urlencode(params or {}, doseq=True) if metodo == "GET" and params else "")
    r = urllib.request.Request(url, data=data, method=metodo, headers={"Authorization": "Bearer " + SK})
    try: return json.load(urllib.request.urlopen(r, timeout=60))
    except urllib.error.HTTPError as e: raise RuntimeError("Stripe: " + e.read().decode()[:300])
def aiuto(*a):
    r = subprocess.run(["node", "scripts/sg-pg-aiuto.cjs", *map(str, a)], capture_output=True, text=True, timeout=180)
    if r.returncode: raise RuntimeError("aiuto " + " ".join(map(str, a)) + ": " + r.stderr.strip()[-300:])
    return json.loads(r.stdout.strip().splitlines()[-1])
O = {c: v for c, v in zip("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ", [1,0,5,7,9,13,15,17,19,21,1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23])}
E = {c: (int(c) if c.isdigit() else ord(c) - 65) for c in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
def cf(b): return b + chr(65 + sum(O[c] if i % 2 == 0 else E[c] for i, c in enumerate(b)) % 26)
A = firma("admin", "admin"); LB = firma("lab", "LAB")
C = call("api/login", {"ruolo": "caf", "codice": "CAF001", "password": "demo"})[1].get("token")
T = call("api/login", {"ruolo": "ottico", "codice": "OTT07", "password": "demo"})[1].get("token")
def adm(az, **k): return call("api/admin", {"azione": az, **k}, A)
def stato(uv): s, r = adm("scheda", id=uv); return r.get("cliente") or {}
def attendi(cond, sec=90, passo=3):
    t0 = time.time()
    while time.time() - t0 < sec:
        try:
            v = cond()
            if v: return v
        except Exception: pass
        time.sleep(passo)
    return None
def registra(base, nome, data):
    s, r = call("api/utenti", {"cf": cf(base), "nome": nome, "cognome": "PROVA", "nato": "CATANIA", "datanascita": data, "sesso": "F", "prefisso": "+39", "cellulare": "3330000099",
        "ottica": "OTT07", "amico": "", "gdpr": True, "residenza": {"indirizzo": "Via Etnea 1", "cap": "95124", "comune": "CATANIA", "provincia": "CT"}}, C)
    if s != 200: raise RuntimeError(f"registrazione {nome}: {s} {r}")
    CLIENTI.append(r["univoco"]); return r["univoco"]
RICETTA = {"OD": {"sf": -1.25, "cil": -0.5, "ax": 90}, "OS": {"sf": -1}, "pd": 63}

async def paga_stripe(ctx, uv, metodo="carta", iban=None, nome_pag="Prova Generale"):
    """dalla pagina del cliente: «Attiva l'abbonamento» → pagina di Stripe → carta 4242 o IBAN di prova → ritorno al sito"""
    pg = await ctx.new_page()
    await pg.goto(f"{SITO}/?Univoco={uv}"); await pg.wait_for_timeout(2500)
    for sel in ["#c1", "#c2", "#c3"]:
        if await pg.locator(sel).count(): await pg.check(sel)
    await pg.click("#mpPaga"); await pg.wait_for_url("**checkout.stripe.com/**", timeout=60000)
    await pg.wait_for_selector("#email, #cardNumber, [data-testid=card-accordion-item-button], #payment-method-accordion-item-title-card", state="visible", timeout=45000); await pg.wait_for_timeout(1500)
    await pg.screenshot(path=f"{OUT}/stripe-{metodo}-{uv}.png", full_page=True)
    if await pg.locator("#email").count() and await pg.locator("#email").is_editable(): await pg.fill("#email", f"prova.generale+{uv.lower()}@example.com")
    if metodo == "carta":
        if not await pg.locator("#cardNumber").is_visible():
            for s in ["[data-testid=card-accordion-item-button]", "#payment-method-accordion-item-title-card", "text=Carta"]:
                if await pg.locator(s).count(): await pg.locator(s).first.click(); await pg.wait_for_timeout(800); break
        await pg.fill("#cardNumber", "4242424242424242"); await pg.fill("#cardExpiry", "12 / 34"); await pg.fill("#cardCvc", "123"); await pg.fill("#billingName", nome_pag)
    else:
        for s in ["[data-testid=sepa_debit-accordion-item-button]", "#payment-method-accordion-item-title-sepa_debit", "text=SEPA"]:
            if await pg.locator(s).count(): await pg.locator(s).first.click(); await pg.wait_for_timeout(800); break
        await pg.fill("#iban", iban); await pg.fill("#billingName", nome_pag)
        for sel, v in [("#billingAddressLine1", "Via Etnea 1"), ("#billingPostalCode", "95124"), ("#billingLocality", "Catania")]:
            if await pg.locator(sel).count() and await pg.locator(sel).is_visible(): await pg.fill(sel, v)
    if await pg.locator("#enableStripePass").count() and await pg.locator("#enableStripePass").is_checked(): await pg.uncheck("#enableStripePass")
    await pg.screenshot(path=f"{OUT}/stripe-{metodo}-compilato-{uv}.png", full_page=True)
    await pg.locator("button[type=submit]").last.click()
    await pg.wait_for_url(lambda u: "checkout.stripe.com" not in u, timeout=90000); await pg.wait_for_timeout(4000)
    await pg.screenshot(path=f"{OUT}/ritorno-{metodo}-{uv}.png", full_page=True); await pg.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        tel = await b.new_context(viewport={"width": 390, "height": 844}, locale="it-IT")
        tab = await b.new_context(viewport={"width": 820, "height": 1180}, locale="it-IT")
        pc = await b.new_context(viewport={"width": 1280, "height": 900}, locale="it-IT")
        ERR = []
        for c in (tel, tab, pc): c.on("page", lambda pg: pg.on("pageerror", lambda e: ERR.append(str(e)[:200])))
        # magazzino: 3 pezzi per montatura di prova in OTT07 (alla fine si rimette com'era)
        s, d = adm("dati"); prima = {m["Codice"]: dict(m.get("giacenze") or {}) for m in d.get("montature", []) if m["Codice"] in ("SG-1042", "SG-1043", "SG-1044")}
        for m in prima: adm("magazzino", codice=m, op="carico", qta=3, a="OTT07")
        esito("0 accessi e magazzino di prova", bool(C and T), f"giacenze prima: {prima}")
        try:
            # ===== A · percorso completo con carta 4242 =====
            uvA = registra("PRVGLI71A41C351", "GIULIA", "1971-01-01"); esito("A1 registrazione dal CAF", True, uvA)
            pg = await tel.new_page(); await pg.goto(f"{SITO}/?Univoco={uvA}"); await pg.wait_for_timeout(2500); await pg.screenshot(path=f"{OUT}/A1-telefono-benvenuto.png", full_page=True)
            await pg.check("#cSan"); await pg.click("#cSanOk"); await pg.wait_for_timeout(1500)
            await pg.click("#mpScan"); await pg.wait_for_timeout(1000); await pg.locator("#video-container input").fill("SG-1043"); await pg.locator("#video-container .manuale button").click(); await pg.wait_for_timeout(2000)
            await pg.get_by_role("button", name="Scelgo questa montatura").click(); await pg.wait_for_timeout(2500); await pg.screenshot(path=f"{OUT}/A2-telefono-montatura.png", full_page=True)
            c = stato(uvA); esito("A2 consenso e montatura dal telefono", c.get("stato") == "MONTATURA SCELTA" and bool(c.get("consensoSanitario")), c.get("stato"))
            o = await tab.new_page(); await o.goto(f"{SITO}/ottico"); await o.wait_for_timeout(2000)
            if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(2500)
            await o.screenshot(path=f"{OUT}/A3-tablet-cruscotto.png", full_page=True)
            await o.click("#cruOtt .cru-principale button"); await o.wait_for_timeout(800); await o.fill("#ordineCodice", uvA); await o.click("#formOrdineCerca button"); await o.wait_for_timeout(2500)
            for k, v in {"OD_sf": "-1,25", "OD_cil": "-0,50", "OD_ax": "90", "OS_sf": "-1", "pd": "63"}.items(): await o.fill(f"#formOrdine [name={k}]", v)
            await o.screenshot(path=f"{OUT}/A3-tablet-preventivo.png", full_page=True); await o.click("#ordineInvia"); await o.wait_for_timeout(3000)
            c = stato(uvA); esito("A3 preventivo dal tablet dell'ottica", c.get("stato") == "IN ATTESA PAGAMENTO", (c.get("ordine") or {}).get("prezzi"))
            await paga_stripe(tel, uvA, "carta")
            c = attendi(lambda: (lambda x: x if x.get("stato") == "ABBONAMENTO ATTIVO - IN LAVORAZIONE" else None)(stato(uvA)), 120)
            pgA = (c or {}).get("ordine", {}).get("pagamento", {}); esito("A4 pagamento con carta 4242 su Stripe → abbonamento attivo", bool(c), {k: pgA.get(k) for k in ("stato", "ratePagate", "abbonamento", "cliente")})
            if pgA.get("cliente"): CLIENTI_STRIPE.add(pgA["cliente"])
            sub = stripe("GET", f"subscriptions/{pgA.get('abbonamento')}") if pgA.get("abbonamento") else {}
            esito("A5 Stripe: abbonamento attivo e prima fattura pagata", sub.get("status") == "active", f"stato {sub.get('status')}")
            await pg.goto(f"{SITO}/?Univoco={uvA}"); await pg.wait_for_timeout(2500); await pg.screenshot(path=f"{OUT}/A5-telefono-attivo.png", full_page=True)
            lab = (c or {}).get("ordine", {}).get("lab", {})
            if lab:
                r1 = call("api/ordine", {"univoco": uvA, "azione": "richiedi"}, LB)[1]; r2 = call("api/ordine", {"univoco": uvA, "azione": "montaturaSpedita"}, T)[1]
                r3 = call("api/ordine", {"univoco": uvA, "azione": "disponibile", "codice": "SG-1043"}, LB)[1]; r4 = call("api/ordine", {"univoco": uvA, "azione": "inizia"}, LB)[1]
                r5 = call("api/ordine", {"univoco": uvA, "azione": "pronto", "spedisci": True}, LB)[1]
                esito("A6 laboratorio: richiesta, spedizione dall'ottica, controllo codice, lavorazione, spedito", all(x.get("ok") for x in (r1, r2, r3, r4, r5)), [lab.get("stato"), r1, r2, r3, r4, r5])
            else:
                esito("A6 laboratorio non attivo sul sito: l'ottica segna pronto", call("api/ordine", {"univoco": uvA, "azione": "pronto"}, T)[1].get("ok"))
            l = await pc.new_page(); await l.goto(f"{SITO}/laboratorio"); await l.wait_for_timeout(1500)
            await l.evaluate(f"sessionStorage.setItem('sg_lab', '{LB}')"); await l.reload(); await l.wait_for_timeout(2500)
            await l.click("[data-f=tutti]"); await l.fill("#cerca", uvA); await l.wait_for_timeout(800); await l.screenshot(path=f"{OUT}/A6-pc-laboratorio.png", full_page=True)   # solo la busta di prova
            r6 = call("api/ordine", {"univoco": uvA, "azione": "arrivato"}, T)[1] if lab else {"ok": True}
            await o.goto(f"{SITO}/ottico"); await o.wait_for_timeout(2500); await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(2000)
            card = o.locator(f"#clientiLista details.cli[data-u={uvA}]"); await card.evaluate("d => d.open = true"); await card.locator("[data-consegna]").click(); await o.wait_for_timeout(500)
            await o.fill("#codCons", uvA[-4:]); await card.screenshot(path=f"{OUT}/A7-tablet-consegna.png"); await o.locator("#boxCons [data-azione=consegnato]").click(); await o.wait_for_timeout(2500)
            c = stato(uvA); esito("A7 arrivo in ottica e consegna con il codice della tessera", c.get("stato") == "CONSEGNATO", [r6, c.get("stato")])
            await pg.goto(f"{SITO}/?Univoco={uvA}"); await pg.wait_for_timeout(2500); await pg.screenshot(path=f"{OUT}/A7-telefono-consegnato.png", full_page=True)

            # ===== B · rinnovo mensile non pagato, sollecito e pagamento =====
            subid, cus = pgA.get("abbonamento"), pgA.get("cliente")
            pmko = stripe("POST", "payment_methods/pm_card_chargeCustomerFail/attach", {"customer": cus})["id"]
            stripe("POST", f"subscriptions/{subid}", {"default_payment_method": pmko})
            try: stripe("POST", f"subscriptions/{subid}", {"billing_cycle_anchor": "now", "proration_behavior": "none"})
            except Exception as e: print("  (rinnovo forzato:", str(e)[:120], ")")
            # la fattura del rinnovo si chiude e si prova a pagare subito (Stripe altrimenti aspetta circa un'ora)
            for i in stripe("GET", "invoices", {"subscription": subid, "limit": 5})["data"]:
                if i["status"] == "draft": i = stripe("POST", f"invoices/{i['id']}/finalize")
                if i["status"] == "open":
                    try: stripe("POST", f"invoices/{i['id']}/pay")
                    except Exception as e: print("  pagamento rifiutato come previsto:", str(e)[:100])
            c = attendi(lambda: (lambda x: x if (x.get("ordine") or {}).get("pagamento", {}).get("insoluto") else None)(stato(uvA)), 120)
            esito("B1 canone mensile rifiutato dalla carta → insoluto sul sito", bool(c), ((c or {}).get("ordine") or {}).get("pagamento", {}).get("insoluto"))
            s, d = adm("dati"); esito("B2 il caso compare in «Da risolvere»", any(x["univoco"] == uvA and x["tipo"] == "insoluto" for x in d.get("coda", [])))
            await pg.goto(f"{SITO}/?Univoco={uvA}"); await pg.wait_for_timeout(2500); await pg.screenshot(path=f"{OUT}/B2-telefono-insoluto.png", full_page=True)
            pmok = stripe("POST", "payment_methods/pm_card_visa/attach", {"customer": cus})["id"]; stripe("POST", f"subscriptions/{subid}", {"default_payment_method": pmok})
            inv = [i for i in stripe("GET", "invoices", {"subscription": subid, "limit": 5})["data"] if i["status"] == "open"]
            if inv: stripe("POST", f"invoices/{inv[0]['id']}/pay", {"payment_method": pmok})
            c = attendi(lambda: (lambda x: x if not (x.get("ordine") or {}).get("pagamento", {}).get("insoluto") else None)(stato(uvA)), 120)
            esito("B3 il cliente paga → insoluto chiuso e canone contato", bool(c) and (c["ordine"]["pagamento"].get("ratePagate") or 0) >= 2, (c or {}).get("ordine", {}).get("pagamento", {}).get("ratePagate"))

            # ===== C · recesso e rimborso con Stripe (test) =====
            uvB = registra("PRVMRT71A41C351", "MARTA", "1971-01-01")
            call("api/benvenuto", {"azione": "consenso", "univoco": uvB, "si": True}); call("api/montatura", {"univoco": uvB, "codice": "SG-1044"})
            call("api/ordine", {"univoco": uvB, "lente": "mono", "trattamenti": [], "ricetta": RICETTA}, T)
            await paga_stripe(tel, uvB, "carta")
            c = attendi(lambda: (lambda x: x if x.get("stato") == "ABBONAMENTO ATTIVO - IN LAVORAZIONE" else None)(stato(uvB)), 120); pgB = (c or {}).get("ordine", {}).get("pagamento", {})
            if pgB.get("cliente"): CLIENTI_STRIPE.add(pgB["cliente"])
            rr = call("api/ordine", {"univoco": uvB, "azione": "recesso"}, T)[1]
            s, d = adm("dati"); in_coda = any(x["univoco"] == uvB and x["tipo"] == "rimborso" for x in d.get("coda", []))
            s, rb = adm("rimborsa", id=uvB)
            ref = stripe("GET", "refunds", {"limit": 10})["data"]; nostri = [x for x in ref if (x.get("metadata") or {}).get("univoco") == uvB]
            esito("C1 recesso dall'ottica, caso in coda, rimborso con Stripe dal pannello", bool(rr.get("ok")) and in_coda and s == 200 and bool(nostri),
                  f"rimborso {rb.get('importo')} € · rimborsi Stripe: {[(x['amount']/100, x['status']) for x in nostri]}")
            sb = stripe("GET", f"subscriptions/{pgB.get('abbonamento')}") if pgB.get("abbonamento") else {}
            esito("C2 Stripe: abbonamento del recesso chiuso", sb.get("status") == "canceled", sb.get("status"))

            # ===== D · IBAN (SEPA) di prova =====
            uvC = registra("PRVLRA71A41C351", "LAURA", "1971-01-01")
            call("api/benvenuto", {"azione": "consenso", "univoco": uvC, "si": True}); call("api/montatura", {"univoco": uvC, "codice": "SG-1042"})
            call("api/ordine", {"univoco": uvC, "lente": "mono", "trattamenti": [], "ricetta": RICETTA}, T)
            try:
                await paga_stripe(tel, uvC, "sepa", iban="DE89370400440532013000")
                c = attendi(lambda: (lambda x: x if x.get("stato") in ("PAGAMENTO IN VERIFICA", "ABBONAMENTO ATTIVO - IN LAVORAZIONE") else None)(stato(uvC)), 120)
                esito("D1 pagamento con IBAN → «pagamento in verifica»", bool(c), (c or {}).get("stato"))
                if (c or {}).get("ordine", {}).get("pagamento", {}).get("cliente"): CLIENTI_STRIPE.add(c["ordine"]["pagamento"]["cliente"])
                c = attendi(lambda: (lambda x: x if x.get("stato") == "ABBONAMENTO ATTIVO - IN LAVORAZIONE" else None)(stato(uvC)), 420, 10)
                esito("D2 la banca (di prova) conferma → abbonamento attivo", bool(c), (c or stato(uvC)).get("stato"))
            except Exception as e:
                esito("D1 pagamento con IBAN", False, "SEPA non disponibile nella pagina di Stripe (va attivato nella dashboard Stripe) · " + str(e)[:150])

            # ===== E · acquisto dell'usato a fine periodo (date spostate indietro di un anno sul cliente A) =====
            aiuto("sposta", uvA, 370)
            s, r = call("api/fine-periodo", {"univoco": uvA, "scelta": "riscatta"})
            fat = attendi(lambda: ((stato(uvA).get("ordine") or {}).get("pagamento", {}).get("riscatto") or {}).get("fattura"), 60)
            if fat:
                try: stripe("POST", f"invoices/{fat}/pay", {"payment_method": pmok})
                except Exception as e: print("  pagamento del riscatto:", str(e)[:120])
            c = attendi(lambda: (lambda x: x if "RISCATTATO" in str((x.get("ordine") or {}).get("pagamento", {}).get("esito")) else None)(stato(uvA)), 150)
            esito("E1 acquisto dell'usato a fine periodo: fattura Stripe pagata → occhiale del cliente", bool(c), [r, (c or stato(uvA)).get("ordine", {}).get("pagamento", {}).get("esito")])
            await pg.goto(f"{SITO}/?Univoco={uvA}"); await pg.wait_for_timeout(2500); await pg.screenshot(path=f"{OUT}/E1-telefono-riscatto.png", full_page=True)

            # ===== F · controllo notturno sui soli clienti di prova e pannello =====
            for uv in CLIENTI: aiuto("controlla", uv)
            esito("F1 controllo notturno sui clienti di prova senza errori", True)
            a = await pc.new_page(); await a.goto(f"{SITO}/admin"); await a.wait_for_timeout(1200); await a.evaluate(f"sessionStorage.setItem('sg_admin', '{A}')"); await a.reload(); await a.wait_for_timeout(3000)
            # solo la scheda del cliente di prova (le altre schermate del pannello contengono clienti veri)
            await a.click(f".schede-adm [data-tab=clienti]"); await a.wait_for_timeout(2500); await a.locator(f"[data-scheda={uvA}]").first.click(); await a.wait_for_timeout(2500)
            await a.screenshot(path=f"{OUT}/F1-pc-scheda-cliente-prova.png", full_page=True)
            esito("F2 nessun errore nelle pagine aperte", not ERR, ERR[:5])
        except Exception as e:
            esito("ERRORE INATTESO", False, f"{type(e).__name__}: {str(e)[:400]}"); traceback.print_exc()
            try:
                for i, pgx in enumerate([x for c in (tel, tab, pc) for x in c.pages]): await pgx.screenshot(path=f"{OUT}/errore-{i}.png", full_page=True)
            except Exception: pass
        finally:
            # ===== pulizia: clienti di prova, abbonamenti e clienti Stripe di prova, prenotazioni, magazzino
            for uv in CLIENTI:
                s, r = adm("elimina", tipo="cliente", id=uv, chiudiAbbonamento=True); print("eliminato", uv, s, r)
            try: print("prenotazioni tolte:", aiuto("riserve", ",".join(CLIENTI)))
            except Exception as e: print("prenotazioni:", e)
            for cus in CLIENTI_STRIPE:
                try: stripe("DELETE", f"customers/{cus}")
                except Exception as e: print("cliente Stripe:", e)
            s, d = adm("dati")
            for m, g in prima.items():
                ora = next((x.get("giacenze") or {} for x in d.get("montature", []) if x["Codice"] == m), {})
                for dove in set(g) | set(ora):
                    if (ora.get(dove) or 0) != (g.get(dove) or 0): adm("magazzino", codice=m, op="rettifica", qta=g.get(dove) or 0, a=dove, nota="ripristino dopo la prova generale")
            s, d = adm("dati"); dopo = {m["Codice"]: m.get("giacenze") for m in d.get("montature", []) if m["Codice"] in prima}
            esito("Z pulizia: clienti di prova cancellati e magazzino com'era", all(stato(uv) == {} for uv in CLIENTI) and all((dopo.get(m) or {}) == {k: v for k, v in g.items() if v} for m, g in prima.items()), f"magazzino dopo: {dopo}")
            await b.close()
    with open(f"{OUT}/resoconto.md", "w", encoding="utf-8") as f:
        f.write("# Prova generale SocialGlass (Stripe test)\n\n" + "\n".join(f"- {'✅' if ok else '❌'} {p}{' — ' + d if d else ''}" for p, ok, d in RIS) + "\n")
    print("\n".join(f"{'✅' if ok else '❌'} {p}" for p, ok, d in RIS))
    sys.exit(0 if all(ok for _, ok, _ in RIS) else 1)
asyncio.run(main())
