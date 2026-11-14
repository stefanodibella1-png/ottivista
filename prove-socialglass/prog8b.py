import asyncio
exec(open("prog8.py").read().split("from playwright")[0].split('uv=fino_alla_montatura("PRVNNA60A41C351"')[0])
uv=fino_alla_montatura("PRVRSL60A41C351","ROSALIA","SG-1042")
print("preventivo:", prev(uv,"prog",h={"OD":22,"OS":21.5},pdm={"OD":31.5,"OS":32}), "| pagamento:", call("api/pagamento",{"univoco":uv,"consensoContratto":True,"consensoAddebito":True,"consensoSuMisura":True})[0])
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); l=await b.new_page(viewport={"width":1280,"height":900})
        await l.goto("http://localhost:8823/laboratorio"); await l.wait_for_timeout(700); await l.fill("#pw","laboratorio1"); await l.click("#fLogin button"); await l.wait_for_timeout(1200)
        r=l.locator(f".busta-w[data-u={uv}]"); await r.locator("summary b").click(); await l.wait_for_timeout(300)
        t=" ".join((await r.inner_text()).split()); i=t.find("Distanza pupillare"); print("busta del laboratorio:", t[i:i+150]); await b.close()
asyncio.run(main())
