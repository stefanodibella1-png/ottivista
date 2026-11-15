import asyncio, json, urllib.request
from playwright.async_api import async_playwright
def post(p, b):
    r = urllib.request.Request("http://localhost:8823" + p, data=json.dumps(b).encode(), headers={"content-type": "application/json"}, method="POST")
    try: return urllib.request.urlopen(r).status, ""
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read()).get("errore", "")
async def main():
    print("presto (SGV20D, mancano 8 mesi):", post("/api/fine-periodo", {"univoco": "SGV20D", "scelta": "restituisci"}))
    print("negli ultimi 30 giorni (SGV20C):", post("/api/fine-periodo", {"univoco": "SGV20C", "scelta": "riscatta"}))
    async with async_playwright() as p:
        b = await p.chromium.launch(); E = []
        m = await b.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True); m.on("pageerror", lambda e: E.append(str(e)))
        await m.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        for uv in ["SGV20D", "SGV20C"]:
            await m.goto(f"http://localhost:8823/?Univoco={uv}"); await m.wait_for_timeout(1600)
            box = m.locator(".scheda", has_text="Il tuo abbonamento").first; await box.scroll_into_view_if_needed()
            print(uv, "| pulsanti di scelta visibili:", await m.locator("[data-fine]").filter(visible=True).count() if hasattr(m.locator("x"), "filter") else "?", "|", (await box.inner_text())[:200].replace("\n", " · "))
            await box.screenshot(path=f"fine21_{uv}.png")
        print("errori:", E); await b.close()
asyncio.run(main())
