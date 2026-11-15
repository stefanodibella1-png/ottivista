# Modifica 12: la montatura si prenota sempre nell'ottica dove il cliente l'ha scansionata (anche con giacenza non caricata)
import sys, asyncio; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def adm(az, **k): s,r=call("api/admin",{"azione":az,**k},A); return r
def mont(c): m=[x for x in adm("dati")["montature"] if x["Codice"]==c][0]; return m["giacenze"], [(x["ottica"], x["univoco"][-4:], bool(x.get("mancante"))) for x in m.get("riservate", m.get("Riservate", []))]
def reg(base, nome, ottica="OTT07"):
    s,r=call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":ottica,"amico":"","gdpr":True,"documento":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C); return r["univoco"]
def scan(uv, c): s,r=call(f"api/montatura?codice={c}&univoco={uv}"); return r.get("disponibile"), r.get("motivo","")
def scegli(uv, c): s,r=call("api/montatura",{"univoco":uv,"codice":c}); return r.get("errore") or "ok"
def giacenza(): return [(x["univoco"][-4:], x["codice"], x["ottica"]) for x in adm("dati")["coda"] if x["tipo"]=="giacenza"]
m0=[x for x in adm("dati")["montature"] if x["Codice"]=="SG-1042"][0]; print("0 campi montatura:", [k for k in m0 if "iserv" in k or "iacen" in k])
uA=reg("PRVGLI60A41C351","GIULIA"); uB=reg("PRVMRT60A41C351","MARTA"); uC=reg("PRVLRA60A41C351","LAURA"); uD=reg("PRVNNA60A41C351","ANNA","OTT12")
print("1 SG-1042 prima:", mont("SG-1042"), "| A scansiona:", scan(uA,"SG-1042"), "| sceglie:", scegli(uA,"SG-1042"), "| dopo:", mont("SG-1042"))
print("2 B, stessa ottica, stesso pezzo:", scan(uB,"SG-1042"), "|", scegli(uB,"SG-1042"))
print("  A riscansiona la sua (già sua):", scan(uA,"SG-1042"), scegli(uA,"SG-1042"))
print("3 in coda:", giacenza())
print("4 A cambia idea → SG-1043:", scegli(uA,"SG-1043"), "| SG-1042:", mont("SG-1042"), "| SG-1043:", mont("SG-1043"))
print("  ora B prende SG-1042 (pezzo tornato in ottica):", scan(uB,"SG-1042"), scegli(uB,"SG-1042"), "|", mont("SG-1042"))
print("5 carico 2 SG-1044 in OTT07:", adm("magazzino",codice="SG-1044",op="carico",qta=2,a="OTT07").get("ok"), "| C sceglie:", scegli(uC,"SG-1044"), "|", mont("SG-1044"))
print("6 cliente di OTT12 sceglie SG-1044:", scegli(uD,"SG-1044"), "|", mont("SG-1044"))
print("  coda giacenze:", giacenza())
print("7 vista:", adm("giacenzaVista",codice="SG-1043",id=uA), "| coda:", giacenza())
s,r=call("api/clienti",None,T); print("8 esposte OTT07:", [(m["codice"], m["qta"], m["prenotate"], [x["nome"] for x in m["perChi"]]) for m in r["esposte"]])
call("api/benvenuto",{"azione":"consenso","univoco":uA,"si":True})
print("9 A preventivo e pagamento:", call("api/ordine",{"univoco":uA,"lente":"mono","trattamenti":[],"ricetta":{"OD":{"sf":-1},"OS":{"sf":-1},"pd":63}},T)[0], call("api/pagamento",{"univoco":uA,"consensoContratto":True,"consensoAddebito":True,"consensoSuMisura":True})[0])
print("  il lab la chiede all'ottica:", call("api/ordine",{"univoco":uA,"azione":"richiedi"},Lb)[1], "|", mont("SG-1043"))
print("  arriva:", call("api/ordine",{"univoco":uA,"azione":"disponibile","codice":"SG-1043"},Lb)[1], "|", mont("SG-1043"))
from playwright.async_api import async_playwright
async def ui():
    async with async_playwright() as p:
        b=await p.chromium.launch(); E=[]
        o=await b.new_page(viewport={"width":820,"height":1180}); o.on("pageerror", lambda e: E.append(str(e)))
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200)
        if await o.is_visible("#otticoPopup"): await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await o.locator("#cruOtt button", has_text="Montature esposte").first.click(); await o.wait_for_timeout(800)
        print("10 tablet · esposte:", (await o.inner_text("#esposteCorpo")).replace("\n"," | ")[:400]); await o.screenshot(path="m12_esposte.png")
        c=await b.new_page(viewport={"width":390,"height":844}); c.on("pageerror", lambda e: E.append(str(e)))
        uE=reg("PRVLSE60A41C351","ELISA"); await c.goto(B+"?Univoco="+uE); await c.wait_for_timeout(1500)
        await c.click("#mpScan"); await c.wait_for_timeout(900); await c.locator("#video-container input").fill("SG-1042"); await c.locator("#video-container .manuale button").click(); await c.wait_for_timeout(1300)
        print("11 telefono · montatura prenotata da un altro:", (await c.inner_text("body")).replace("\n"," / ")[:200]); await c.screenshot(path="m12_cliente.png")
        print("errori:", E); await b.close()
asyncio.run(ui())
