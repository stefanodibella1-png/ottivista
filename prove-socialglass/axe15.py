# Modifica 15: controllo automatico dell'accessibilità (axe-core, regole WCAG 2.1 AA) su tutte le schermate principali
import sys, asyncio, json; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
from playwright.async_api import async_playwright
uvN=call("api/utenti",{"cf":cf("PRVGLI60A41C351"),"nome":"GIULIA","cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"documento":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)[1]["univoco"]
uvA=nuovo("PRVMRT60A41C351","MARTA","SG-1043")
TUTTI={}
async def axe(pg, nome, sel=None):
    await pg.add_script_tag(path="axe.min.js")
    r=await pg.evaluate("""async (sel) => { const r = await axe.run(sel || document, {runOnly: {type: "tag", values: ["wcag2a","wcag2aa","wcag21a","wcag21aa"]}, resultTypes: ["violations"]});
      return r.violations.map(v => ({id: v.id, impatto: v.impact, n: v.nodes.length, es: v.nodes.slice(0, 3).map(x => x.target.join(" ") + " :: " + (x.failureSummary || "").split("\\n").slice(1, 2).join(""))})); }""", sel)
    for v in r:
        k=v["id"]; TUTTI.setdefault(k, []).append((nome, v["impatto"], v["n"], v["es"]))
    piccoli=await pg.evaluate("""() => [...document.querySelectorAll('button, a[href], input[type=checkbox], input[type=radio], select, summary')].filter(e => { const r = e.getBoundingClientRect(), st = getComputedStyle(e); return r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && (r.height < 24 || r.width < 24) && !(e.tagName === 'A' && st.display === 'inline'); }).map(e => (e.tagName + ' ' + (e.id ? '#' + e.id : '') + ' «' + (e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 30) + '» ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height)))""")
    print(f"{nome}: {len(r)} problemi", [f'{v["id"]}({v["n"]})' for v in r], "| bersagli sotto 24px:", piccoli[:6], "" if len(piccoli) <= 6 else f"(+{len(piccoli)-6})")
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch()
        ctx=await b.new_context(viewport={"width":390,"height":844}, bypass_csp=True); pg=await ctx.new_page()
        await pg.goto(B); await pg.wait_for_timeout(1200); await axe(pg,"home")
        await pg.goto(B+"?Univoco="+uvN); await pg.wait_for_timeout(1500); await axe(pg,"cliente nuovo")
        await pg.goto(B+"?Univoco="+uvA); await pg.wait_for_timeout(1500); await axe(pg,"cliente attivo")
        await pg.goto(B+"privacy.html"); await pg.wait_for_timeout(800); await axe(pg,"privacy")
        t=await b.new_context(viewport={"width":820,"height":1180}, bypass_csp=True); o=await t.new_page()
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200); await axe(o,"accesso ottica")
        await o.fill("#codiceOttico","OTT07"); await o.fill("#inputPasswordOttico","demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
        await axe(o,"cruscotto ottica")
        await o.locator("#cruOtt button", has_text="I miei clienti").first.click(); await o.wait_for_timeout(1000)
        await o.locator("#clientiLista details.cli").first.evaluate("d => d.open = true"); await axe(o,"clienti ottica")
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200); await o.click("#cruOtt .cru-principale button"); await o.wait_for_timeout(500)
        await o.fill("#ordineCodice", uvA); await o.click("#formOrdineCerca button"); await o.wait_for_timeout(1000); await axe(o,"ordine ottica")
        await o.goto(B+"ottico"); await o.wait_for_timeout(1200); await o.locator("#cruOtt button", has_text="Nuovo cliente").first.click(); await o.wait_for_timeout(800); await axe(o,"nuovo cliente")
        k=await b.new_context(viewport={"width":1200,"height":900}, bypass_csp=True); kp=await k.new_page()
        await kp.goto(B+"caf"); await kp.wait_for_timeout(1200); await axe(kp,"accesso CAF")
        a=await b.new_context(viewport={"width":1200,"height":900}, bypass_csp=True); ap=await a.new_page()
        await ap.goto(B+"admin"); await ap.wait_for_timeout(900); await ap.fill("#admPw","passwordlunga1"); await ap.press("#admPw","Enter"); await ap.wait_for_timeout(1500)
        for tab in ["numeri","clienti","conteggi","magazzino","impostazioni"]:
            await ap.click(f".schede-adm [data-tab={tab}]"); await ap.wait_for_timeout(900); await axe(ap,"pannello "+tab)
        l=await b.new_context(viewport={"width":1280,"height":900}, bypass_csp=True); lp=await l.new_page()
        await lp.goto(B+"laboratorio"); await lp.wait_for_timeout(600); await axe(lp,"accesso laboratorio")
        await lp.fill("#pw","laboratorio1"); await lp.click("#fLogin button"); await lp.wait_for_timeout(1200)
        await lp.click("[data-f=tutti]"); await lp.wait_for_timeout(400); await lp.locator("details.busta").first.evaluate("d => d.open = true"); await axe(lp,"laboratorio")
        await b.close()
    print("\n=== RIEPILOGO PER REGOLA ===")
    for k,v in TUTTI.items():
        print(k, "|", sum(x[2] for x in v), "elementi in", len(v), "schermate |", v[0][1]); [print("    ", e) for e in v[0][3][:3]]
asyncio.run(main())
