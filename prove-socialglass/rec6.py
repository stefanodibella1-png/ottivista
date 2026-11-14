# Modifica 6: «Inizio lavorazione» e annullamento
import sys; sys.argv=[sys.argv[0]]
exec(open("conc.py").read().split("import sys\nbase")[0])
def mont(cod):
    d=call("api/admin",{"azione":"dati"},A)[1]; m=[x for x in d["montature"] if x.get("Codice")==cod]
    return [f'{x["tipo"]} {x["dove"]} {x["qta"]:+d}' for x in (m[0].get("Movimenti") or [])[:2]] if m else "?"
def lab(uv, az): s,r=call("api/ordine",{"univoco":uv,"azione":az},Lb); return r.get("errore") or "ok"
def recesso(uv): s,r=call("api/ordine",{"univoco":uv,"azione":"recesso"},T); return r.get("errore") or ("ok · " + (r.get("montatura") or ""))
call("api/admin",{"azione":"magazzino","codice":"SG-1043","op":"carico","qta":1,"a":"LAB"},A)
uv=nuovo("PRVDNL60A41C351","DANIELA","SG-1043")
print("1 montatura in laboratorio:", lab(uv,"disponibile"), "| ultimi movimenti:", mont("SG-1043"))
print("  pronto senza «Inizio lavorazione»:", lab(uv,"pronto"))
print("  annullamento (lenti non ancora iniziate):", recesso(uv), "| ultimi movimenti:", mont("SG-1043"))
print("  il laboratorio prova a iniziare:", lab(uv,"inizia"))
uv=nuovo("PRVLNE60A41C351","ELENA","SG-1044")
print("2 chiesta all'ottica:", lab(uv,"richiedi"), "→ inizio lavorazione mentre viaggia:", lab(uv,"inizia"))
print("  annullamento:", recesso(uv))
print("  arriva la montatura:", lab(uv,"disponibile"), "| lab:", scheda(uv)["ordine"]["lab"]["stato"])
print("  pronto:", lab(uv,"pronto"), "| stato:", scheda(uv)["stato"])
uv=nuovo("PRVFNC60A41C351","FRANCESCA","SG-1042")
print("3 annullamento prima della verifica del laboratorio:", recesso(uv))
d=call("api/admin",{"azione":"dati"},A)[1]; print("4 rimborsi da fare:", [(x["nome"], x["importo"]) for x in d.get("rimborsi",[])])
print("  rimborso fatto:", call("api/admin",{"azione":"rimborsato","id":uv},A)[0], "| ancora da fare:", len(call("api/admin",{"azione":"dati"},A)[1].get("rimborsi",[])), "| esito:", scheda(uv)["ordine"]["pagamento"]["esito"])
print("  di nuovo:", call("api/admin",{"azione":"rimborsato","id":uv},A)[1].get("errore"))
