import asyncio, json, urllib.request
from playwright.async_api import async_playwright
def post(path, body, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode(), headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
A=post("api/admin",{"azione":"imposta","password":"passwordlunga1"}).get("token") or post("api/admin",{"azione":"accedi","password":"passwordlunga1"})["token"]
d=post("api/admin",{"azione":"dati"},A); mont=[m["Codice"] for m in d["montature"]]; print("montature", mont)
conv=d["convenzioni"]["A"]
print("salva listino:", post("api/admin",{"azione":"salvaListino","id":"A","montatura":conv["montatura"],"lenti":[dict(id=k,**v) for k,v in conv["lenti"].items()]+[{"nome":"Progressive premium","desc":"Campo ampio","prezzo":390}],"trattamenti":[dict(id=k,**v) for k,v in conv["trattamenti"].items()]},A).get("ok"))
print("scelta montatura:", post("api/montatura",{"univoco":"SGNUOVO02","codice":mont[0]}))
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); pg=await b.new_page(viewport={"width":390,"height":844}); e=[]; pg.on("pageerror", lambda x: e.append(str(x)))
        await pg.route("**/*", lambda r: r.continue_() if r.request.url.startswith("http://localhost") else r.abort())
        await pg.goto("http://localhost:8823/ottico"); await pg.wait_for_timeout(1200)
        await pg.fill("#codiceOttico","OTT12"); await pg.fill("#inputPasswordOttico","demo"); await pg.click("#otticoPopup button[type=submit]"); await pg.wait_for_timeout(1500)
        await pg.click("#cruOtt .cru-principale button"); await pg.wait_for_timeout(500)
        await pg.fill("#ordineCodice","SGNUOVO02"); await pg.click("#formOrdineCerca button"); await pg.wait_for_timeout(1000)
        lenti=[await x.inner_text() for x in await pg.locator("#ordineLenti label").all()]; print("lenti:", [l.split("\n")[0] for l in lenti])
        await pg.locator("#ordineLenti label").filter(has_text="Progressive premium").click(); await pg.wait_for_timeout(300)
        print("totale:", (await pg.inner_text("#ordineTotale")).replace("\n"," ")[:120])
        add=pg.locator("#formOrdine [name$=_add]").first; print("addizione abilitata:", await add.is_enabled())
        ids=[await x.get_attribute("name") for x in await pg.locator("#formOrdine input, #formOrdine select").all()]; print("campi:", ids)
        await b.close(); print("err", e)
asyncio.run(main())
