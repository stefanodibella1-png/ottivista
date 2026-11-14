# Modifica 14: secondo fattore dell'amministratore, password cifrate, cambio password, limite tentativi
import sys, hmac, hashlib, struct, time, base64; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def codice(seg, d=0):
    k=base64.b32decode(seg); c=struct.pack(">Q", int(time.time()//30)+d); h=hmac.new(k,c,hashlib.sha1).digest(); o=h[-1]&15
    return str((struct.unpack(">I",h[o:o+4])[0]&0x7fffffff)%1000000).zfill(6)
def adm(az, tok=A, **k): s,r=call("api/admin",{"azione":az,**k},tok); return s,r
s,r=adm("dati"); print("1 sicurezza:", r["sicurezza"])
s,r=adm("totpNuovo"); seg=r["segreto"]; print("2 nuovo segreto:", len(seg), r["link"][:40])
print("  codice sbagliato:", adm("totpAttiva",codice="000000")[1].get("errore","")[:40])
s,r=adm("totpAttiva",codice=codice(seg)); ris=r["riserva"]; print("  attivato:", r.get("ok"), "| codici di riserva:", len(ris), ris[0])
print("3 accesso solo password:", call("api/admin",{"azione":"accedi","password":"passwordlunga1"}))
print("  password sbagliata + codice:", call("api/admin",{"azione":"accedi","password":"sbagliata","codice":codice(seg)})[1])
time.sleep(1)
s,r=call("api/admin",{"azione":"accedi","password":"passwordlunga1","codice":codice(seg,1)}); print("  codice del prossimo intervallo (orologio avanti):", s, bool(r.get("token")))
s,r=call("api/admin",{"azione":"accedi","password":"passwordlunga1","codice":codice(seg,1)}); print("  stesso codice riusato:", s, r.get("errore","")[:50])
s,r=call("api/admin",{"azione":"accedi","password":"passwordlunga1","codice":ris[0]}); print("4 codice di riserva:", s, bool(r.get("token")), "| rimasti:", r.get("riservaRimasti"))
s,r=call("api/admin",{"azione":"accedi","password":"passwordlunga1","codice":ris[0]}); print("  lo stesso di nuovo:", s)
A2=call("api/admin",{"azione":"accedi","password":"passwordlunga1","codice":ris[1].lower()})[1]["token"]; print("  riserva scritta minuscola:", bool(A2))
print("5 cambio password senza quella attuale:", adm("cambiaPassword",A2,nuova="nuovapassword123")[1])
print("  con quella attuale:", adm("cambiaPassword",A2,attuale="passwordlunga1",nuova="nuovapassword123")[1])
print("6 disattiva con codice sbagliato:", adm("totpDisattiva",A2,password="nuovapassword123",codice="111111")[1])
s,r=adm("totpDisattiva",A2,password="nuovapassword123",codice=codice(seg)); print("  disattiva:", r)
print("  ora basta la password:", bool(call("api/admin",{"azione":"accedi","password":"nuovapassword123"})[1].get("token")))
adm("cambiaPassword",A2,attuale="nuovapassword123",nuova="passwordlunga1")
print("7 password in chiaro dei CAF/ottiche:", adm("dati",A2)[1]["sicurezza"]["inChiaro"])
print("  login CAF001 la cifra:", "token" in call("api/login",{"ruolo":"caf","codice":"CAF001","password":"demo"})[1], "| restano:", adm("dati",A2)[1]["sicurezza"]["inChiaro"])
print("  e si entra ancora:", "token" in call("api/login",{"ruolo":"caf","codice":"CAF001","password":"demo"})[1])
r=urllib.request.Request(B+"api/scadenze?tutto=1", headers={"Authorization":"Bearer prova"}); import json as J; e=J.load(urllib.request.urlopen(r))["esiti"]
print("  controllo notturno:", [x for x in e if "password" in str(x)], "| restano:", adm("dati",A2)[1]["sicurezza"]["inChiaro"])
print("8 tentativi:", [call("api/login",{"ruolo":"ottico","codice":"ZZZ999","password":"x"})[0] for _ in range(10)])
print("  codici cliente inesistenti:", [call(f"api/benvenuto?univoco=SGNONCE{i:02d}&espositore=")[0] for i in range(12)])
