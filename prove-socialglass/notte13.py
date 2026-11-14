# Modifica 13: controllo notturno a lotti, stato per l'allarme, copia a pezzi
# Server: NOTTE_MAX=4 CRON_SECRET=prova STRIPE_WEBHOOK_SECRET=whsec_prova node srv.js
import sys, json, threading; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def sc(q=""):
    r=urllib.request.Request(B+"api/scadenze"+q, headers={"Authorization":"Bearer prova"}); x=urllib.request.urlopen(r); return x.status, x.read().decode(), dict(x.headers)
for i,(b,n) in enumerate([("PRVGLI60A41C351","GIULIA"),("PRVMRT60A41C351","MARTA"),("PRVLRA60A41C351","LAURA"),("PRVNNA60A41C351","ANNA"),("PRVLSE60A41C351","ELISA"),("PRVCRL60A41C351","CARLA")]):
    call("api/utenti",{"cf":cf(b),"nome":n,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)
print("0 senza chiave:", call("api/scadenze")[0])
giri=[]
for k in range(10):
    s,t,h=sc(); j=json.loads(t); giri.append((j.get("fatto"), j.get("controllati"), j.get("totale"))); 
    if j.get("fatto"): break
print("1 lotti:", giri)
s,t,h=sc(); print("2 dopo la fine (non rifà niente):", json.loads(t))
n=call("api/health")[1]["notte"]; print("3 health:", n)
d=call("api/admin",{"azione":"dati"},A)[1]; print("  pannello:", {k: d["notte"][k] for k in ("fatto","controllati","lotti","azioni")}, "| errori:", d["notte"]["errori"])
s,t,h=sc("?nuovo=1"); print("4 nuovo giro forzato:", json.loads(t))
# due chiamate insieme: una lavora, l'altra aspetta
out=[None,None]
def go(i): out[i]=json.loads(sc("?nuovo=1" if i==0 else "")[1])
th=[threading.Thread(target=go,args=(i,)) for i in (0,1)]; th[0].start(); import time; time.sleep(0.05); th[1].start(); [x.join() for x in th]
print("5 insieme:", out)
s,t,h=sc("?copia=1&parte=0"); print("6 copia parte 0:", s, h.get("X-Copia-Data"), h.get("X-Copia-Parti"), len(t))
N=int(h.get("X-Copia-Parti")); testo=t+"".join(sc(f"?copia=1&parte={i}")[1] for i in range(1,N)); print("  ricostruita:", list(json.loads(testo).keys())[:6])
try: sc("?copia=1&parte=99")
except urllib.error.HTTPError as e: print("  parte inesistente:", e.code)
print("7 esito copia:", sc("?backup=manca-password")[1], call("api/health")[1]["copiaEsterna"]["stato"])
print("  giro completo per le prove (data):", json.loads(sc("?tutto=1")[1]).get("ok"))
