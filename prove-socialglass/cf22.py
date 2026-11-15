import json, urllib.request
B = "http://localhost:8823"
def call(p, b=None, tok=None):
    h = {"content-type": "application/json"}
    if tok: h["authorization"] = "Bearer " + tok
    r = urllib.request.Request(B + p, data=json.dumps(b).encode() if b is not None else None, headers=h, method="POST" if b is not None else "GET")
    try: x = urllib.request.urlopen(r); return x.status, json.loads(x.read())
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read())
s, t = call("/api/login", {"ruolo": "caf", "codice": "CAF001", "password": "demo"}); tok = t["token"]
base = {"nome": "GIULIO", "cognome": "BIANCHI", "datanascita": "1975-02-12", "sesso": "M", "nato": "CATANIA", "prefisso": "+39", "cellulare": "3331112223", "ottica": "OTT07", "gdpr": True, "documento": True,
        "residenza": {"indirizzo": "Via Etnea 1", "cap": "95124", "comune": "CATANIA", "provincia": "CT"}}
import sys; sys.path.insert(0, ".")
def cfx(s15):
    ODD={**{str(i):v for i,v in enumerate([1,0,5,7,9,13,15,17,19,21])}, **dict(zip("ABCDEFGHIJKLMNOPQRSTUVWXYZ",[1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23]))}
    ev = lambda c: int(c) if c.isdigit() else ord(c)-65
    return s15 + chr(65 + sum(ODD[c] if i%2==0 else ev(c) for i,c in enumerate(s15)) % 26)
vero = cfx("BNCGLI75B12C351")
casi = [("comune inesistente", {**base, "cf": cfx("BNCGLI75B12Z999")}),
        ("luogo diverso (codice di Belpasso, dichiarato Catania)", {**base, "cf": cfx("BNCGLI75B12A766")}),
        ("senza spunta del documento", {**base, "cf": vero, "documento": False}),
        ("registrazione corretta", {**base, "cf": vero}),
        ("stesso codice con omocodia", {**base, "cf": cfx("BNCGLI75B12C35M")}),
        ("stessa persona, altro comune e luogo dichiarato coerente", {**base, "cf": cfx("BNCGLI75B12A766"), "nato": "BELPASSO"})]
for nome, b in casi:
    s, r = call("/api/utenti", b, tok); print(f"{nome}: {s} {r.get('errore') or r.get('univoco')}")
s, r = call("/api/utenti?cf=" + cfx("BNCGLI75B12C35M"), None, tok); print("verifica con omocodia trova:", r.get("univoco"), r.get("nome"))
