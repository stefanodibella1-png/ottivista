# Costruisce le pagine di consultazione dei siti recuperati: recupero/index.html
# - collega le copie scaricate (con link e immagini riscritti in locale)
# - collega ogni pagina e ogni istantanea della home su web.archive.org
import json, os, re, html, urllib.parse
OUT = "recupero"
rep = json.load(open(f"{OUT}/report.json"))

def local_name(url, mime=""):
    u = urllib.parse.urlparse(url)
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", (u.netloc + (u.path or "/")).strip("_"))[:150] or "index"
    if mime.startswith("text/html") and not name.endswith(".html"): name += ".html"
    return name

def fmt_ts(t):
    return f"{t[6:8]}/{t[4:6]}/{t[0:4]}" if t and len(t) >= 8 else "—"

sections = []
for d, r in rep.items():
    rows = json.load(open(f"{OUT}/{d}-indice.json")) if os.path.exists(f"{OUT}/{d}-indice.json") else []
    folder = f"{OUT}/{d}"
    have = set(os.listdir(folder)) if os.path.isdir(folder) else set()
    # mappa url originale -> file locale (per riscrivere i link)
    url2file = {}
    for t, url, mime, code in rows:
        n = local_name(url, mime)
        if n in have:
            for v in {url, url.replace("http://", "https://"), url.replace("https://", "http://")}:
                url2file[v.rstrip("/")] = n
                url2file[v] = n
    # riscrive le pagine html scaricate
    for t, url, mime, code in rows:
        n = local_name(url, mime)
        if not mime.startswith("text/html") or n not in have: continue
        p = f"{folder}/{n}"
        try:
            src = open(p, "rb").read().decode("utf-8", "ignore")
        except Exception:
            continue
        def fix(m):
            attr, q, link = m.group(1), m.group(2), m.group(3)
            absu = urllib.parse.urljoin(url, html.unescape(link))
            key = absu.split("#")[0]
            for k in (key, key.rstrip("/"), key.split("?")[0], key.split("?")[0].rstrip("/")):
                if k in url2file:
                    return f'{attr}={q}{url2file[k]}{q}'
            if absu.startswith("http") and d in urllib.parse.urlparse(absu).netloc:
                return f'{attr}={q}https://web.archive.org/web/{t}/{absu}{q}'
            return m.group(0)
        src = re.sub(r'(href|src)=(["\'])([^"\']+)\2', fix, src)
        banner = f'<div style="position:sticky;top:0;z-index:99999;background:#F2D96B;color:#111;font:600 13px Arial;padding:6px 10px">Copia recuperata dall\'archivio del web · {html.escape(d)} · {fmt_ts(t)} · <a href="../index.html" style="color:#111">torna all\'elenco</a></div>'
        src = re.sub(r"(<body[^>]*>)", r"\1" + banner, src, count=1, flags=re.I) if re.search(r"<body", src, re.I) else banner + src
        open(p, "w", encoding="utf-8").write(src)
    pages = [(t, url, mime) for t, url, mime, code in rows if mime.startswith("text/html")]
    imgs = [(t, url, mime) for t, url, mime, code in rows if mime.startswith("image/")]
    pages.sort(key=lambda x: (len(urllib.parse.urlparse(x[1]).path), x[1]))
    home_local = next((local_name(u, m) for t, u, m in pages if local_name(u, m) in have and urllib.parse.urlparse(u).path in ("", "/", "/index.html", "/index.php")), None)
    li_pages = "".join(
        f'<li><span class="u">{html.escape(urllib.parse.urlparse(u).path or "/")}</span>'
        + (f' <a href="{html.escape(d)}/{html.escape(local_name(u, m))}">copia recuperata</a>' if local_name(u, m) in have else "")
        + f' <a href="https://web.archive.org/web/{t}/{html.escape(u)}" target="_blank" rel="noopener">archivio {fmt_ts(t)}</a></li>'
        for t, u, m in pages[:300])
    gal = "".join(
        f'<a href="{html.escape(d)}/{html.escape(local_name(u, m))}" target="_blank"><img loading="lazy" src="{html.escape(d)}/{html.escape(local_name(u, m))}" alt=""></a>'
        for t, u, m in imgs if local_name(u, m) in have)
    snaps = r.get("istantanee_home", [])
    li_snaps = " ".join(f'<a class="chip" href="https://web.archive.org/web/{s}/{d}/" target="_blank" rel="noopener">{fmt_ts(s)}</a>' for s in snaps)
    who = "<br>".join(html.escape(x) for x in r.get("whois", []))
    arch = " ".join(f'<a class="chip" href="{html.escape(x)}" target="_blank" rel="noopener">{html.escape(x.rsplit("/",1)[-1])}</a>' for x in r.get("archive_today_link", []))
    sections.append(f'''
<section>
  <h2>{html.escape(d)}</h2>
  <p class="sum"><b>{r.get("pagine_archiviate", 0)}</b> file archiviati · dal {fmt_ts(r.get("prima"))} al {fmt_ts(r.get("ultima"))} · <b>{r.get("file_scaricati", 0)}</b> recuperati qui</p>
  <div class="row">
    {f'<a class="btn" href="{html.escape(d)}/{html.escape(home_local)}">Apri la home recuperata</a>' if home_local else ""}
    <a class="btn ghost" href="https://web.archive.org/web/*/{html.escape(d)}/*" target="_blank" rel="noopener">Tutto l'archivio di {html.escape(d)}</a>
  </div>
  {f'<h3>Home nel tempo</h3><div class="chips">{li_snaps}</div>' if snaps else ""}
  {f'<h3>archive.today</h3><div class="chips">{arch}</div>' if arch else ""}
  {f'<h3>Immagini recuperate</h3><div class="gal">{gal}</div>' if gal else ""}
  {f'<h3>Pagine</h3><ul>{li_pages}</ul>' if li_pages else "<p>Nessuna pagina archiviata.</p>"}
  <h3>Stato del dominio</h3><p class="who">{who or "—"}</p>
</section>''')

page = f'''<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>Siti recuperati</title>
<style>
body{{margin:0;font:15px/1.5 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1B1B22;background:#F7F5F2}}
main{{max-width:900px;margin:0 auto;padding:16px}}
h1{{font-size:26px;margin:8px 0 4px}} h2{{font-size:22px;margin:0 0 4px}} h3{{font-size:15px;margin:16px 0 6px}}
section{{background:#fff;border-radius:16px;padding:16px;margin:14px 0;border:1px solid #ECEAF0}}
.sum{{color:#6B6A75;margin:0 0 10px}} .row{{display:flex;gap:8px;flex-wrap:wrap}}
.btn{{background:#1B1B22;color:#fff;text-decoration:none;padding:10px 16px;border-radius:999px;font-weight:700}}
.btn.ghost{{background:#fff;color:#1B1B22;border:2px solid #1B1B22}}
.chips{{display:flex;gap:6px;flex-wrap:wrap}} .chip{{border:1px solid #ddd;border-radius:999px;padding:3px 9px;text-decoration:none;color:#1B1B22;font-size:13px}}
.gal{{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}} .gal img{{width:100%;aspect-ratio:1;object-fit:contain;background:#F7F5F2;border-radius:8px}}
ul{{padding-left:18px;margin:0}} li{{margin:3px 0;font-size:14px}} li a{{margin-left:6px}} .u{{font-family:ui-monospace,Menlo,monospace;font-size:13px;word-break:break-all}}
.who{{font-family:ui-monospace,Menlo,monospace;font-size:12.5px;color:#444}}
</style></head><body><main>
<h1>Siti recuperati</h1><p class="sum">Copie dei vecchi siti trovate nell'archivio del web (Wayback Machine). Pagina privata, non indicizzata.</p>
{"".join(sections)}
</main></body></html>'''
open(f"{OUT}/index.html", "w", encoding="utf-8").write(page)
print("ok")
