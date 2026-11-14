# Modifica 7: arrivo dell'occhiale e consegna con codice, dal tablet dell'ottica (usato dalle prove cliccate)
async def accedi_ottica(o):
    if await o.is_visible("#otticoPopup"):
        await o.fill("#codiceOttico", "OTT07"); await o.fill("#inputPasswordOttico", "demo"); await o.click("#otticoPopup button[type=submit]"); await o.wait_for_timeout(1500)
async def apri_scheda(o, COD, voce):
    bt = o.locator("#cruOtt .fare button").filter(has_text=voce)
    if not await bt.count(): return None
    await bt.first.click(); await o.wait_for_timeout(1200)
    card = o.locator(f"#clientiLista details.cli[data-u={COD}]")
    if not await card.get_attribute("open"): await card.locator("summary").click(); await o.wait_for_timeout(400)
    return card
async def arrivo_e_consegna(o, COD, foto=None, codice=None):
    await o.reload(); await o.wait_for_timeout(1200); await accedi_ottica(o)
    card = await apri_scheda(o, COD, "in arrivo")
    if card:
        if foto: await foto(o, "TABLET_ottica_occhiale_in_arrivo")
        await card.locator("button[data-azione=arrivato]").click(); await o.wait_for_timeout(1500)
        await o.reload(); await o.wait_for_timeout(1200); await accedi_ottica(o)
    card = await apri_scheda(o, COD, "consegnare")
    if not card: return "nessun occhiale da consegnare"
    await card.locator("[data-consegna]").click(); await o.wait_for_timeout(400)
    await o.fill("#codCons", "0000"); await o.locator("#boxCons button").click(); await o.wait_for_timeout(900)
    errore = (await o.inner_text("body")).count("non corrisponde") > 0
    await o.reload(); await o.wait_for_timeout(1200); await accedi_ottica(o)
    card = await apri_scheda(o, COD, "consegnare")
    await card.locator("[data-consegna]").click(); await o.wait_for_timeout(400)
    if foto: await foto(o, "TABLET_ottica_controllo_codice_consegna")
    await o.fill("#codCons", codice or COD[-4:]); await o.locator("#boxCons button").click(); await o.wait_for_timeout(1200)
    return f"codice sbagliato rifiutato: {errore}"
