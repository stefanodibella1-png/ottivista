# Modifica 3: pagamenti contati una volta sola
import sys; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def ev(id_, tipo, obj):
    p=json.dumps({"id":id_,"type":tipo,"data":{"object":obj}}).encode(); t=str(int(time.time()))
    s=hmac.new(b"whsec_prova",(t+".").encode()+p,hashlib.sha256).hexdigest()
    return call("api/stripe-webhook",None,None,p,{"Stripe-Signature":f"t={t},v1={s}"})[0]
uv = nuovo("PRVMRT60A41C351", "MARTA", "SG-1044")
md={"subscription_details":{"metadata":{"univoco":uv}}}
def pg(): return scheda(uv)["ordine"]["pagamento"]
def riga(t): p=pg(); print(f"{t:<52} canoni {p.get('ratePagate')} | insoluto {'sì' if p.get('insoluto') else 'no'} | messaggi {len((p.get('insoluto') or {}).get('messaggi') or [])}")
riga("0 attivato")
ev("evt_a","invoice.paid",{"id":"in_1","amount_paid":1980,"billing_reason":"subscription_create",**md}); riga("1 primo canone (fattura iniziale)")
ev("evt_b","invoice.paid",{"id":"in_2","amount_paid":990,"billing_reason":"subscription_cycle",**md}); riga("2 secondo canone")
ev("evt_b","invoice.paid",{"id":"in_2","amount_paid":990,"billing_reason":"subscription_cycle",**md}); riga("3 stesso avviso ripetuto")
ev("evt_b2","invoice.paid",{"id":"in_2","amount_paid":990,"billing_reason":"subscription_cycle",**md}); riga("4 avviso diverso, stessa fattura")
ev("evt_c","invoice.payment_failed",{"id":"in_3","amount_due":990,"attempt_count":1,**md}); riga("5 terzo canone non pagato")
ev("evt_c","invoice.payment_failed",{"id":"in_3","amount_due":990,"attempt_count":1,**md}); riga("6 stesso avviso ripetuto (niente 2° messaggio)")
ev("evt_d","invoice.paid",{"id":"in_3","amount_paid":990,"billing_reason":"subscription_cycle",**md}); riga("7 il cliente paga")
ev("evt_e","invoice.payment_failed",{"id":"in_3","amount_due":990,"attempt_count":2,**md}); riga("8 avviso vecchio di mancato pagamento")
ev("evt_f","customer.subscription.deleted",{"id":"sub_altro","metadata":{"univoco":uv}}); print("9 chiusura di un abbonamento doppio → stato:", scheda(uv)["stato"])
fatt=[x for x in call("api/admin",{"azione":"dati"},A)[1].get("fatture",[]) if x.get("univoco")==uv] if False else None
