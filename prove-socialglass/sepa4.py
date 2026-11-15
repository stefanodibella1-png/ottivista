# Modifica 4: pagamento con IBAN (SEPA) — carta, IBAN confermato, IBAN rifiutato
import sys; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def ev(id_, tipo, obj):
    p=json.dumps({"id":id_,"type":tipo,"data":{"object":obj}}).encode(); t=str(int(time.time()))
    s=hmac.new(b"whsec_prova",(t+".").encode()+p,hashlib.sha256).hexdigest()
    return call("api/stripe-webhook",None,None,p,{"Stripe-Signature":f"t={t},v1={s}"})[0]
def fino_al_preventivo(base, nome, mont):
    s,r=call("api/utenti",{"cf":cf(base),"nome":nome,"cognome":"PROVA","nato":"CATANIA","datanascita":"1960-01-01","sesso":"F","prefisso":"+39","cellulare":"3330000099","ottica":"OTT07","amico":"","gdpr":True,"documento":True,"residenza":{"indirizzo":"Via Etnea 1","cap":"95124","comune":"CATANIA","provincia":"CT"}},C)
    uv=r["univoco"]; call("api/montatura",{"univoco":uv,"codice":mont}); call("api/benvenuto",{"azione":"consenso","univoco":uv,"si":True})
    call("api/ordine",{"univoco":uv,"lente":"mono","trattamenti":["ar"],"ricetta":{"OD":{"sf":-1},"OS":{"sf":-1},"pd":63}},T); return uv
def sess(uv, stato, n): return {"id":f"cs_{uv}_{n}","client_reference_id":uv,"payment_status":stato,"status":"complete","subscription":f"sub_{uv}","customer":"cus_1"}
def busta(uv): s,l=call("api/clienti",None,Lb); return [b for b in l.get("buste",[]) if b["univoco"]==uv]
def stato(uv): c=scheda(uv); return c["stato"], (c["ordine"].get("pagamento") or {}).get("stato"), (c["ordine"].get("lab") or {}).get("stato")
print("C — carta")
uv=fino_al_preventivo("PRVCRL60A41C351","CARLA","SG-1042"); ev("e1","checkout.session.completed",sess(uv,"paid",1))
print("  stato:", stato(uv), "| buste in laboratorio:", len(busta(uv)))
print("A — IBAN confermato dalla banca")
uv=fino_al_preventivo("PRVBNC60A41C351","BIANCA","SG-1043"); ev("e2","checkout.session.completed",sess(uv,"unpaid",1))
print("  richiesta inviata:", stato(uv), "| buste in laboratorio:", len(busta(uv)))
s,cli=call(f"api/benvenuto?univoco={uv}&espositore="); print("  pagina cliente:", cli.get("stato"))
ev("e3","invoice.payment_failed",{"id":"in_x","amount_due":1980,"attempt_count":1,"subscription_details":{"metadata":{"univoco":uv}}}); print("  avviso di fattura non pagata durante la verifica:", stato(uv))
print("  la banca riprova a pagare? ottica prova il preventivo:", call("api/ordine",{"univoco":uv,"lente":"mono","trattamenti":[],"ricetta":{"OD":{"sf":-2},"OS":{"sf":-2},"pd":63}},T)[1].get("errore"))
ev("e4","checkout.session.async_payment_succeeded",sess(uv,"paid",1)); print("  banca conferma:", stato(uv), "| buste in laboratorio:", len(busta(uv)))
ev("e4b","checkout.session.async_payment_succeeded",sess(uv,"paid",1)); print("  conferma ripetuta:", stato(uv))
print("B — IBAN rifiutato dalla banca")
uv=fino_al_preventivo("PRVRSN60A41C351","ROSSANA","SG-1044"); ev("e5","checkout.session.completed",sess(uv,"unpaid",1))
ev("e6","checkout.session.async_payment_failed",sess(uv,"unpaid",1)); c=scheda(uv)
print("  banca rifiuta:", stato(uv), "| buste in laboratorio:", len(busta(uv)))
s,l=call("api/clienti",None,T); x=[k for k in l["clienti"] if k["univoco"]==uv][0]; print("  avviso per l'ottica:", (x.get("avviso") or {}).get("testo"))
ev("e7","customer.subscription.deleted",{"id":f"sub_{uv}","metadata":{"univoco":uv}}); print("  Stripe conferma la chiusura dell'abbonamento:", stato(uv))
print("  riprova con la carta:", call("api/pagamento",{"univoco":uv,"consensoContratto":True,"consensoAddebito":True,"consensoSuMisura":True})[0], stato(uv))
open("sepa_uv.txt","w").write(uv)
