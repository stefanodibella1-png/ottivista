# Recupero dei vecchi siti dall'archivio del web (Wayback Machine e archive.today) + stato dei domini
import json, os, re, time, urllib.request, urllib.parse, subprocess
DOMAINS = ["socialglass.it", "biottica.it", "occhialesubito.com"]
OUT = "recupero"
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (recupero siti di Stefano)"}
def get(url, tries=4, timeout=60):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e; time.sleep(3*(i+1))
    raise last
report = {}
for d in DOMAINS:
    rep = report[d] = {}
    # elenco di tutte le pagine archiviate
    try:
        q = f"https://web.archive.org/cdx/search/cdx?url={d}&matchType=domain&output=json&fl=timestamp,original,mimetype,statuscode&filter=statuscode:200&collapse=urlkey&limit=5000"
        rows = json.loads(get(q, timeout=120) or b"[]")
        rows = rows[1:] if rows else []
    except Exception as e:
        rows = []; rep["errore_cdx"] = str(e)
    rep["pagine_archiviate"] = len(rows)
    ts = sorted(r[0] for r in rows)
    rep["prima"] = ts[0] if ts else None; rep["ultima"] = ts[-1] if ts else None
    json.dump(rows, open(f"{OUT}/{d}-indice.json", "w"), indent=0)
    # date delle istantanee della home
    try:
        snaps = json.loads(get(f"https://web.archive.org/cdx/search/cdx?url={d}/&output=json&fl=timestamp,statuscode&collapse=timestamp:6") or b"[]")[1:]
    except Exception: snaps = []
    rep["istantanee_home"] = [s[0] for s in snaps]
    # scarica pagine html e immagini (versione originale, senza la barra di archive.org)
    base = f"{OUT}/{d}"; os.makedirs(base, exist_ok=True)
    n = 0
    for t, url, mime, code in rows:
        if n >= 400: break
        if not (mime.startswith("text/html") or mime.startswith("image/") or mime in ("text/css","application/pdf")): continue
        path = urllib.parse.urlparse(url).path or "/"
        name = re.sub(r"[^A-Za-z0-9._-]+", "_", (urllib.parse.urlparse(url).netloc + path).strip("_"))[:150] or "index"
        if mime.startswith("text/html") and not name.endswith(".html"): name += ".html"
        try:
            data = get(f"https://web.archive.org/web/{t}id_/{url}", tries=2)
            if len(data) > 8_000_000: continue
            open(f"{base}/{name}", "wb").write(data); n += 1
            time.sleep(.4)
        except Exception: pass
    rep["file_scaricati"] = n
    # archive.today
    try:
        page = get(f"https://archive.ph/{d}", tries=2).decode("utf8", "ignore")
        rep["archive_today_link"] = sorted(set(re.findall(r'https://archive\.ph/[A-Za-z0-9]{4,6}', page)))[:30]
    except Exception as e:
        rep["archive_today_errore"] = str(e)[:120]
    # stato del dominio (solo stato e date, niente dati personali)
    try:
        w = subprocess.run(["whois", d], capture_output=True, text=True, timeout=60).stdout
        keep = [l.strip() for l in w.splitlines() if re.match(r"\s*(Status|Domain Status|Created|Creation Date|Expire Date|Registry Expiry Date|Last Update|Updated Date|Registrar:|No match|NOT FOUND|AVAILABLE)", l, re.I)]
        rep["whois"] = keep[:15] or ["nessun dato: probabilmente libero"]
    except Exception as e:
        rep["whois_errore"] = str(e)[:120]
json.dump(report, open(f"{OUT}/report.json", "w"), indent=2, ensure_ascii=False)
print(json.dumps(report, indent=2, ensure_ascii=False))
