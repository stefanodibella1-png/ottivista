# Modifica 2: scritture contemporanee, stato CHIUSO e storico dei passaggi
import json, urllib.request, time, hmac, hashlib, threading
B="http://localhost:8823/"
def call(path, body=None, tok=None, raw=None, headers=None):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r=urllib.request.Request(B+path, data=data, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {}), **(headers or {})})
    try: x=urllib.request.urlopen(r); return x.status, json.load(x)
    except urllib.error.HTTPError as e: return e.code, json.load(e)
from crea_cliente import cf
A=call("api/admin",{"azione":"imposta","password":"passwordlunga1"})[1].get("token") or call("api/admin",{"azione":"accedi","password":"passwordlunga1"})[1]["token"]
call("api/admin",{"azione":"salvaLab","nome":"Lab Demo","attivo":True,"password":"laboratorio1"},A)
C=call("api/login",{"ruolo":"caf","codice":"CAF001","password":"demo"})[1]["token"]
T=call("api/login",{"ruolo":"ottico","codice":"OTT07","password":"demo"})[1]["token"]
Lb=call("api/login",{"ruolo":"lab","codice":"LAB","password":"laboratorio1"})[1]["token"]
def nuovo(base, nome, mont):
    s,r=call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01" if nome!="LUCIA" else "1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)
    assert s==200, r
    uv=r["univoco"]; print(" scelta:", call("api/montatura",{"univoco":uv,"codice":mont})[0]); call("api/benvenuto",{"azione":"consenso","univoco":uv,"si":True})
    print(" preventivo:", call("api/ordine",{"univoco":uv,"lente":"mono","trattamenti":["ar"],"ricetta":{"OD":{"sf":-1},"OS":{"sf":-1},"pd":63}},T)[0])
    print(" pagamento:", call("api/pagamento",{"univoco":uv,"consensoContratto":True,"consensoAddebito":True,"consensoSuMisura":True})[0])
    return uv
def scheda(uv): return call("api/admin",{"azione":"scheda","id":uv},A)[1]["cliente"]
def parallelo(*reqs):
    out=[None]*len(reqs)
    def go(i,a): out[i]=call(*a[0], **a[1]) if isinstance(a,tuple) and len(a)==2 and isinstance(a[1],dict) and isinstance(a[0],tuple) else call(*a)
    th=[threading.Thread(target=go,args=(i,a)) for i,a in enumerate(reqs)]
    [t.start() for t in th]; [t.join() for t in th]; return out
import sys
base = sys.argv[1] if len(sys.argv)>1 else "PRVLCU60A41C351"
uv = nuovo(base, "LUCIA", "SG-1043")
c = scheda(uv); print("1 stato:", c["stato"], "| lab:", (c["ordine"].get("lab") or {}).get("stato"), "| versione:", c["versione"])
# A) due tocchi contemporanei del laboratorio: «Montatura disponibile» + «Ritira dall'ottico»
r = parallelo(("api/ordine",{"univoco":uv,"azione":"disponibile"},Lb), ("api/ordine",{"univoco":uv,"azione":"richiedi"},Lb))
print("A due tocchi insieme:", [(s, x.get("errore") or "ok") for s,x in r])
c = scheda(uv); print("  dopo: lab", c["ordine"]["lab"]["stato"], "| versione", c["versione"])
# B) avviso Stripe (canone pagato) nello stesso istante di una nota del laboratorio: niente deve andare perso
ev = {"id":"evt_1","type":"invoice.paid","data":{"object":{"id":"in_prova_1","amount_paid":990,"billing_reason":"subscription_cycle","subscription_details":{"metadata":{"univoco":uv}}}}}
payload = json.dumps(ev).encode(); t = str(int(time.time()))
sig = hmac.new(b"whsec_prova", (t+".").encode()+payload, hashlib.sha256).hexdigest()
h = {"Stripe-Signature": f"t={t},v1={sig}"}
prima = (c["ordine"].get("pagamento") or {}).get("ratePagate")
r = parallelo(("api/stripe-webhook", None, None, payload, h), ("api/ordine",{"univoco":uv,"azione":"nota","nota":"lenti antiriflesso premium"},Lb))
print("B webhook + nota insieme:", [(s, x.get("errore") or "ok") for s,x in r])
if r[0][0] == 409: print("  Stripe riprova:", call("api/stripe-webhook", None, None, payload, h)[0])
if r[1][0] == 409: print("  il laboratorio riprova:", call("api/ordine",{"univoco":uv,"azione":"nota","nota":"lenti antiriflesso premium"},Lb)[0])
c = scheda(uv); pg = c["ordine"]["pagamento"]
print("  canoni pagati:", prima, "→", pg.get("ratePagate"), "| nota lab:", c["ordine"]["lab"].get("note"))
# C) passaggio non permesso: consegnare un occhiale ancora in laboratorio
print("C consegna troppo presto:", call("api/ordine",{"univoco":uv,"azione":"consegnato"},T))
# D) recesso → stato CHIUSO e storico
print("D recesso:", call("api/ordine",{"univoco":uv,"azione":"recesso"},T)[0])
c = scheda(uv); print("  stato:", c["stato"], "| esito:", c["ordine"]["pagamento"].get("esito"))
print("  ripeto il recesso:", call("api/ordine",{"univoco":uv,"azione":"recesso"},T)[1].get("errore"))
s,cli = call(f"api/benvenuto?univoco={uv}&espositore="); print("  pagina cliente vede:", cli.get("stato"), "| chiuso:", cli.get("chiuso"))
print("E storico:"); [print("   ", p["chi"], "|", p.get("az",""), "|", p["da"], "→", p["a"]) for p in c["passi"]]
