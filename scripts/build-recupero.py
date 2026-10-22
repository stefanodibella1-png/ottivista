# Pagina di consultazione dei siti recuperati: recupero/index.html
import json, os, re, html, urllib.parse
OUT = "recupero"
rep = json.load(open(f"{OUT}/report.json"))
NAMES = {"occhialesubito.com": "Occhiale Subito", "socialglass.it": "SocialGlass", "biottica.it": "Biottica"}
def fmt(t): return f"{t[6:8]}/{t[4:6]}/{t[0:4]}" if t and len(t) >= 8 else "—"
def text_of(s):
    t = re.sub(r"<(script|style|noscript)[\s\S]*?</\1>", " ", s, flags=re.I)
    t = re.sub(r"<[^>]+>", " ", t); return html.unescape(re.sub(r"\s+", " ", t)).strip()
sections = []
for d in ["occhialesubito.com", "socialglass.it", "biottica.it"]:
    r = rep.get(d, {}); folder = f"{OUT}/{d}"
    homes = sorted(f for f in os.listdir(folder) if f.startswith("home-")) if os.path.isdir(folder) else []
    for f in homes:
        ts = f[5:19]; p = f"{folder}/{f}"
        s = open(p, encoding="utf-8", errors="ignore").read()
        if "data-recupero" in s: continue
        def fix(m):
            attr, q, link = m.group(1), m.group(2), m.group(3)
            if link.startswith(("data:", "#", "mailto:", "tel:", "javascript:")): return m.group(0)
            absu = urllib.parse.urljoin(f"http://{d}/", html.unescape(link))
            if d in urllib.parse.urlparse(absu).netloc or absu.startswith("http"):
                mode = "im_" if attr.lower() in ("src", "srcset") or re.search(r"\.(css|png|jpe?g|gif|svg|webp|woff2?|ico)(\?|$)", absu, re.I) else ""
                if d in urllib.parse.urlparse(absu).netloc:
                    return f'{attr}={q}https://web.archive.org/web/{ts}{mode}/{absu}{q}'
            return m.group(0)
        s = re.sub(r'(href|src)=(["\'])([^"\']+)\2', fix, s)
        bar = f'<div data-recupero style="position:sticky;top:0;z-index:2147483647;background:#F2D96B;color:#111;font:600 13px Arial,sans-serif;padding:7px 10px">Copia recuperata · {html.escape(d)} · {fmt(ts)} · <a href="../index.html" style="color:#111">torna all\'elenco</a></div>'
        s = re.sub(r"(<body[^>]*>)", lambda m: m.group(1) + bar, s, count=1, flags=re.I)
        open(p, "w", encoding="utf-8").write(s)
    last = homes[-1] if homes else None
    txt = text_of(open(f"{folder}/{last}", encoding="utf-8", errors="ignore").read()).replace("Copia recuperata", "")[:2500] if last else ""
    snaps = "".join(f'<a class="chip" href="{d}/{f}">{fmt(f[5:19])}</a>' for f in homes)
    wb = "".join(f'<a class="chip" href="https://web.archive.org/web/{t}/{d}/" target="_blank" rel="noopener">{fmt(t)}</a>' for t in r.get("istantanee_home", []))
    who = " · ".join(html.escape(x) for x in r.get("whois", []))
    free = any(re.search(r"AVAILABLE|No match", x, re.I) for x in r.get("whois", []))
    sections.append(f'''<section>
  <div class="hd"><h2>{html.escape(NAMES.get(d, d))} <small>{d}</small></h2><span class="pill {'ok' if free else ''}">{'Dominio libero' if free else 'Dominio registrato'}</span></div>
  <p class="sum">{len(homes)} copie della home recuperate · {r.get("file_archiviati", 0)} file nell'archivio</p>
  <div class="row">{f'<a class="btn" href="{d}/{last}">Apri l\'ultima versione</a>' if last else ''}<a class="btn ghost" href="https://web.archive.org/web/*/{d}/*" target="_blank" rel="noopener">Archivio completo</a></div>
  {f'<h3>Copie recuperate</h3><div class="chips">{snaps}</div>' if snaps else ''}
  {f'<h3>Sull\'archivio del web</h3><div class="chips">{wb}</div>' if wb else ''}
  {f'<h3>Testi della home</h3><p class="txt">{html.escape(txt)}</p>' if txt else ''}
  <p class="who">{who}</p>
</section>''')
page = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Siti recuperati</title>
<style>
body{{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1B1B22;background:#F7F5F2}}
main{{max-width:860px;margin:0 auto;padding:16px}}
h1{{font-size:28px;margin:8px 0 2px}} h2{{font-size:22px;margin:0}} h2 small{{font-size:14px;color:#6B6A75;font-weight:500;margin-left:6px}} h3{{font-size:14px;margin:16px 0 6px;text-transform:uppercase;letter-spacing:.05em;color:#6B6A75}}
section{{background:#fff;border-radius:18px;padding:18px;margin:14px 0;border:1px solid #ECEAF0}}
.hd{{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}}
.pill{{font-size:12.5px;font-weight:700;padding:4px 10px;border-radius:999px;background:#ECEAF0}} .pill.ok{{background:#E6F4EC;color:#1B8A4B}}
.sum{{color:#6B6A75;margin:4px 0 12px}} .row{{display:flex;gap:8px;flex-wrap:wrap}}
.btn{{background:#1B1B22;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700}}
.btn.ghost{{background:#fff;color:#1B1B22;border:2px solid #1B1B22}}
.chips{{display:flex;gap:6px;flex-wrap:wrap}} .chip{{border:1px solid #ddd;border-radius:999px;padding:4px 10px;text-decoration:none;color:#1B1B22;font-size:13px}}
.txt{{font-size:13.5px;color:#444;background:#F7F5F2;border-radius:10px;padding:10px;max-height:220px;overflow:auto;margin:0}}
.who{{font:12px ui-monospace,Menlo,monospace;color:#888;margin:12px 0 0}}
</style></head><body><main>
<h1>Siti recuperati</h1><p class="sum">Copie dei tuoi vecchi siti trovate nell'archivio del web. Le immagini si vedono solo se l'archivio le aveva salvate.</p>
{"".join(sections)}
</main></body></html>'''
open(f"{OUT}/index.html", "w", encoding="utf-8").write(page); print("ok")
