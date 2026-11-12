# crea una cliente con occhiali consegnati, passando dalle stesse API dell'app (copia di prova)
import json, urllib.request, sys
def call(path, body=None, tok=None):
    r=urllib.request.Request("http://localhost:8823/"+path, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type":"application/json", **({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return json.load(e)
O={c:v for c,v in zip("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ",[1,0,5,7,9,13,15,17,19,21,1,0,5,7,9,13,15,17,19,21,2,4,18,20,11,3,6,8,12,14,16,10,22,25,24,23])}
E={c:(int(c) if c.isdigit() else ord(c)-65) for c in "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"}
def cf(b): return b+chr(65+sum(O[c] if i%2==0 else E[c] for i,c in enumerate(b))%26)
def crea(base, nome, cognome, data, sesso, mont):
    C=call("api/login",{"ruolo":"caf","codice":"CAF001","password":"demo"})["token"]
    r=call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":cognome,"nato":"CATANIA","datanascita":data,"sesso":sesso,"prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True},C)
    uv=r["univoco"]; call("api/montatura",{"univoco":uv,"codice":mont})
    T=call("api/login",{"ruolo":"ottico","codice":"OTT07","password":"demo"})["token"]
    call("api/ordine",{"univoco":uv,"lente":"mono","trattamenti":["ar"],"ricetta":{"OD":{"sf":-1,"cil":None,"ax":None,"add":None},"OS":{"sf":-1,"cil":None,"ax":None,"add":None},"pd":63}},T)
    call("api/pagamento",{"univoco":uv,"consensoContratto":True,"consensoAddebito":True,"consensoSuMisura":True})
    A=call("api/admin",{"azione":"imposta","password":"passwordlunga1"}).get("token") or call("api/admin",{"azione":"accedi","password":"passwordlunga1"})["token"]
    call("api/admin",{"azione":"salvaLab","nome":"Lab Demo","attivo":True,"password":"laboratorio1"},A)
    Lb=call("api/login",{"ruolo":"lab","password":"laboratorio1"})["token"]
    for az in ["ritirata","pronto"]: call("api/ordine",{"univoco":uv,"azione":az},Lb)
    print(call("api/ordine",{"univoco":uv,"azione":"consegnato"},T).get("stato"), uv)
    return uv
if __name__=="__main__":
    uv=crea(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5], sys.argv[6]); open(f"cli_{sys.argv[2]}.txt","w").write(uv)
