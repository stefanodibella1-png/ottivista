# Recupero dei vecchi siti dall'archivio del web (Wayback Machine) + stato dei domini
import json, os, re, time, html, urllib.request, urllib.parse, subprocess
DOMAINS = ["socialglass.it", "biottica.it", "occhialesubito.com"]
OUT = "recupero"
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "Mozilla/5.0 (recupero siti di Stefano)"}
def get(url, tries=6, timeout=90):
    last = None
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:
            last = e
            if "404" in str(e): break
            time.sleep(min(60, 8*(i+1)))
    raise last
def safe(url):
    u = urllib.parse.urlparse(url)
    n = re.sub(r"[^A-Za-z0-9._-]+", "_", (u.netloc + (u.path or "/") + ("_" + u.query if u.query else "")).strip("_"))[:140]
    return n or "index"
def same_site(url, d): return d in urllib.parse.urlparse(url).netloc
ASSET_RE = re.compile(r'(?:src|href|data-src|data-lazy-src|srcset)\s*=\s*["\']([^"\']+)["\']|url\(\s*["\']?([^"\')]+)["\']?\s*\)', re.I)
ASSET_EXT = (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".ico", ".pdf", ".woff", ".woff2")

report = {}
manifest = []
for d in DOMAINS:
    rep = report[d] = {}
    base = f"{OUT}/{d}"; os.makedirs(base, exist_ok=True)
    have = {}
    def save(url, ts, kind, data):
        name = safe(url)
        if kind == "page" and not name.endswith(".html"): name += ".html"
        if kind == "home": name = f"home-{ts}.html"
        open(f"{base}/{name}", "wb").write(data)
        have[(url, kind if kind != "home" else ts)] = name
        manifest.append({"domain": d, "kind": kind, "url": url, "ts": ts, "file": f"{d}/{name}"})
        return name
    # 1) indice completo
    rows = []
    try:
        q = f"https://web.archive.org/cdx/search/cdx?url={d}&matchType=domain&output=json&fl=timestamp,original,mimetype,statuscode&filter=statuscode:200&collapse=urlkey&limit=5000"
        rows = (json.loads(get(q, timeout=180) or b"[]") or [[]])[1:]
    except Exception as e:
        rep["errore_indice"] = str(e)[:200]
    rep["file_archiviati"] = len(rows)
    ts_all = sorted(r[0] for r in rows)
    rep["prima"], rep["ultima"] = (ts_all[0], ts_all[-1]) if ts_all else (None, None)
    # 2) istantanee della home
    snaps = []
    try:
        snaps = [s[0] for s in (json.loads(get(f"https://web.archive.org/cdx/search/cdx?url={d}/&output=json&fl=timestamp,statuscode&filter=statuscode:200&collapse=timestamp:6") or b"[]") or [[]])[1:]]
    except Exception as e:
        rep["errore_istantanee"] = str(e)[:200]
    rep["istantanee_home"] = snaps
    pages = []  # (url, ts, html)
    for ts in snaps:
        try:
            data = get(f"https://web.archive.org/web/{ts}id_/http://{d}/")
            save(f"http://{d}/", ts, "home", data); pages.append((f"http://{d}/", ts, data))
            time.sleep(1.5)
        except Exception: pass
    # 3) altre pagine html dall'indice, oppure seguendo i link della home più recente
    html_rows = [(r[1], r[0]) for r in rows if r[2].startswith("text/html")]
    if not html_rows and pages:
        u0, t0, h0 = pages[-1]
        links = set()
        for m in re.finditer(r'href=["\']([^"\'#]+)["\']', h0.decode("utf8", "ignore"), re.I):
            lk = urllib.parse.urljoin(f"http://{d}/", html.unescape(m.group(1)))
            if same_site(lk, d) and not lk.lower().endswith(ASSET_EXT) and "wp-json" not in lk and "xmlrpc" not in lk:
                links.add(lk.split("#")[0])
        html_rows = [(lk, t0) for lk in sorted(links)][:60]
    for url, ts in html_rows[:150]:
        p = urllib.parse.urlparse(url).path
        if p in ("", "/"): continue
        try:
            data = get(f"https://web.archive.org/web/{ts}id_/{url}", tries=3)
            if b"<html" not in data[:4000].lower() and b"<!doctype" not in data[:400].lower(): continue
            save(url, ts, "page", data); pages.append((url, ts, data)); time.sleep(1.2)
        except Exception: pass
    # 4) immagini, fogli di stile e PDF citati nelle pagine
    assets = {}
    for url, ts, data in pages:
        for m in ASSET_RE.finditer(data.decode("utf8", "ignore")):
            for raw in (m.group(1), m.group(2)):
                if not raw: continue
                for part in raw.split(","):
                    a = part.strip().split(" ")[0]
                    if not a or a.startswith("data:"): continue
                    au = urllib.parse.urljoin(url, html.unescape(a))
                    if same_site(au, d) and urllib.parse.urlparse(au).path.lower().endswith(ASSET_EXT):
                        assets.setdefault(au.split("#")[0], ts)
    for r in rows:
        if r[2].startswith(("image/", "text/css", "application/pdf")): assets.setdefault(r[1], r[0])
    n_ok = 0
    for au, ts in list(assets.items())[:400]:
        try:
            data = get(f"https://web.archive.org/web/{ts}im_/{au}", tries=3)
            if len(data) > 15_000_000: continue
            save(au, ts, "asset", data); n_ok += 1; time.sleep(.6)
        except Exception: pass
    rep["pagine_recuperate"] = len(pages)
    rep["file_recuperati"] = n_ok
    # 5) stato del dominio (solo stato e date)
    try:
        w = subprocess.run(["whois", d], capture_output=True, text=True, timeout=60).stdout
        keep = [l.strip() for l in w.splitlines() if re.match(r"\s*(Status|Domain Status|Created|Creation Date|Expire Date|Registry Expiry Date|Registrar:|No match|NOT FOUND|AVAILABLE)", l, re.I)]
        rep["whois"] = keep[:12] or ["nessun dato: probabilmente libero"]
    except Exception as e:
        rep["whois_errore"] = str(e)[:120]

# oscura chiavi e segreti presenti nel codice dei vecchi siti
SECRET_RE = [
    r"AIza[0-9A-Za-z_\-]{35}", r"(?:sk|pk|rk)_(?:live|test)_[0-9A-Za-z]{10,}", r"gh[pousr]_[0-9A-Za-z]{30,}",
    r"xox[baprs]-[0-9A-Za-z\-]{10,}", r"EAA[0-9A-Za-z]{30,}", r"ya29\.[0-9A-Za-z_\-]{20,}", r"AKIA[0-9A-Z]{16}",
    r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----",
    r"(?i)((?:api[_-]?key|secret|token|password|passwd|client_secret|access_token|nonce)[\"']?\s*[:=]\s*[\"'])[^\"']{8,}([\"'])",
    r"(?i)(key=)[0-9A-Za-z_\-]{20,}", r"[0-9A-Za-z_\-]{20,}\.apps\.googleusercontent\.com",
    r"https://hooks\.slack\.com/services/[0-9A-Za-z/]+", r"SG\.[0-9A-Za-z_\-]{20,}\.[0-9A-Za-z_\-]{20,}",
    r"eyJ[0-9A-Za-z_\-]{10,}\.[0-9A-Za-z_\-]{10,}\.[0-9A-Za-z_\-]{10,}",
]
redacted = 0
for root, _, files in os.walk(OUT):
    for fn in files:
        if not fn.endswith((".html", ".css", ".js", ".json", ".txt", ".php")): continue
        p = os.path.join(root, fn)
        try: txt = open(p, "rb").read().decode("utf-8")
        except Exception: continue
        new = txt
        for rx in SECRET_RE:
            new = re.sub(rx, lambda m: (m.group(1) + "[OSCURATO]" + m.group(2)) if m.lastindex and m.lastindex >= 2 else ((m.group(1) if m.lastindex else "") + "[OSCURATO]"), new)
        if new != txt:
            open(p, "w", encoding="utf-8").write(new); redacted += 1
report["_file_con_segreti_oscurati"] = redacted
json.dump(manifest, open(f"{OUT}/manifest.json", "w"), indent=0)
json.dump(report, open(f"{OUT}/report.json", "w"), indent=2, ensure_ascii=False)
print(json.dumps(report, indent=2, ensure_ascii=False))
