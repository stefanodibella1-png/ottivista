// occhialesubito · importazione del catalogo del fornitore (Shopify) e preparazione dei modelli AR.
// Uso: node scripts/import-catalog.mjs   (gira ogni giorno su GitHub Actions)
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import sharp from "sharp";
import {slimProfile, summary} from "./slim.mjs";

const SOURCE = process.env.SOURCE_URL || "https://lowcostglasses.co.uk";
const OUT = "shop";
const AR_DIR = path.join(OUT, "ar");
const IMG_DIR = path.join(OUT, "img");
const GBP_EUR = Number(process.env.GBP_EUR || 1.17);
const MAX_PRODUCTS = Number(process.env.MAX_PRODUCTS || 100000);
const BUDGET_MS = Number(process.env.BUDGET_MIN || 35)*60000; // oltre questo tempo i modelli AR mancanti si preparano nei giorni seguenti
const T0 = Date.now();
fs.mkdirSync(AR_DIR, {recursive: true});
fs.mkdirSync(IMG_DIR, {recursive: true});

// carica l'analizzatore dello Studio (lo stesso codice del browser)
const ctx = {window: {}, Math, Uint8Array, Int32Array, Uint8ClampedArray, Array, Number, Object, JSON};
ctx.ImageData = class { constructor(w, h){ this.width = w; this.height = h; this.data = new Uint8ClampedArray(w*h*4); } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync("studio-analyze.js", "utf8"), ctx);
const analyze = ctx.window.OVAnalyze.analyze;

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, type = "json", tries = 3){
  for (let i = 0; i < tries; i++){
    try {
      const r = await fetch(url, {headers: {"user-agent": "Mozilla/5.0 (occhialesubito catalog sync)"}});
      if (r.status === 429){ await sleep(4000*(i+1)); continue; }
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return type === "json" ? await r.json() : Buffer.from(await r.arrayBuffer());
    } catch(e){ if (i === tries - 1) throw e; await sleep(1500*(i+1)); }
  }
}

function strip(html){ return String(html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim(); }
function parseSize(p){
  const txt = strip(p.body_html);
  const m = txt.match(/(\d{2})\s*[-–□x]\s*(\d{2})\s*[-–□x]\s*(\d{3})/);
  const mm = (p.tags || []).map(t => (/^(\d{2,3})mm$/i.exec(t) || [])[1]).filter(Boolean).map(Number);
  const out = {};
  if (m){ out.lens = +m[1]; out.bridge = +m[2]; out.temple = +m[3]; }
  // tag in mm: frontale (125-155), altezza lente (25-60)
  const front = mm.find(v => v >= 120 && v <= 160 && v !== out.temple);
  const height = mm.find(v => v >= 25 && v <= 60 && v !== out.lens && v !== out.bridge);
  if (front) out.front = front;
  if (height) out.height = height;
  if (!out.lens && mm.length){
    const lens = mm.find(v => v >= 40 && v <= 62), bridge = mm.find(v => v >= 12 && v <= 24), temple = mm.find(v => v >= 130 && v <= 155 && v !== front);
    if (lens && bridge) Object.assign(out, {lens, bridge, temple: temple || 145});
  }
  return out.lens ? out : null;
}
const CATS = [
  ["Uomo", /men's|uomo|\bmen\b/i], ["Donna", /women|donna/i], ["Bambino", /kids|child|bambin/i],
  ["Sole", /sunglass/i], ["Tondi", /round/i], ["Quadrati", /square/i], ["Rettangolari", /rectang/i],
  ["Cat-eye", /cat.?eye/i], ["Aviator", /aviator/i], ["Metallo", /metal/i], ["Acetato", /plastic|acetate/i]
];
function categories(p){
  const tags = (p.tags || []).join(" | ") + " " + p.title;
  return CATS.filter(([, re]) => re.test(tags)).map(([n]) => n);
}
function colorOf(p){
  const known = ["Black","Tortoise","Havana","Clear","Blue","Red","Pink","Green","Gold","Silver","Brown","Grey","Gray","Purple","Nude","Crystal","White","Yellow","Orange","Gunmetal","Rose Gold"];
  const it = {Black:"Nero",Tortoise:"Tartaruga",Havana:"Havana",Clear:"Trasparente",Blue:"Blu",Red:"Rosso",Pink:"Rosa",Green:"Verde",Gold:"Oro",Silver:"Argento",Brown:"Marrone",Grey:"Grigio",Gray:"Grigio",Purple:"Viola",Nude:"Nude",Crystal:"Cristallo",White:"Bianco",Yellow:"Giallo",Orange:"Arancione",Gunmetal:"Canna di fucile","Rose Gold":"Oro rosa"};
  const hay = `${p.title} ${(p.tags || []).join(" ")}`;
  const found = known.filter(c => new RegExp(`\\b${c}\\b`, "i").test(hay));
  return [...new Set(found.map(c => it[c]))].slice(0, 3);
}

async function tryAR(p, size){
  for (const im of (p.images || []).slice(0, 3)){
    try {
      const buf = await get(im.src.replace(/\?.*$/, "") + "?width=900", "buf");
      const {data, info} = await sharp(buf).flatten({background: "#ffffff"}).resize({width: 900, height: 900, fit: "inside", withoutEnlargement: true}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
      const img = {width: info.width, height: info.height, data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.length)};
      for (const thr of [60, 45]){
        const res = analyze(img, {threshold: thr, lens: size.lens, bridge: size.bridge});
        if (!res.ok) continue;
        const sym = res.checks[1].ok, bridgeOk = res.checks[2].ok;
        const front = res.profile.front;
        const plausible = front > 2*size.lens && front < 2*size.lens + size.bridge + 30;
        if (!(sym && plausible)) continue;
        void bridgeOk;
        const file = `${p.handle}.jpg`;
        await sharp(Buffer.from(res.tex.data.buffer), {raw: {width: res.tex.width, height: res.tex.height, channels: 4}})
          .resize({width: Math.min(1024, res.tex.width)}).jpeg({quality: 84}).toFile(path.join(AR_DIR, file));
        const prof = res.profile;
        prof.tex.data = `shop/ar/${file}`;
        return {profile: prof, threshold: thr, image: im.src};
      }
    } catch(e){ /* immagine non leggibile: si prova la successiva */ }
  }
  return null;
}

async function main(){
  const all = [];
  for (let page = 1; page < 60; page++){
    const j = await get(`${SOURCE}/products.json?limit=250&page=${page}`);
    if (!j.products || !j.products.length) break;
    all.push(...j.products); await sleep(600);
  }
  console.log(`prodotti letti: ${all.length}`);
  const prev = fs.existsSync(path.join(OUT, "catalog.json")) ? JSON.parse(fs.readFileSync(path.join(OUT, "catalog.json"), "utf8")) : {items: []};
  const prevById = new Map(prev.items.map(i => [i.id, i]));
  const items = [];
  let arOk = 0, noSize = 0;
  for (const p of all.slice(0, MAX_PRODUCTS)){
    const tagStr = (p.tags || []).join(" ").toLowerCase();
    if (/lens|accessor|case|gift|cleaning/i.test(p.product_type || "") || /gift card/i.test(p.title)) continue;
    if (!/glasses|sunglass|frame/.test(tagStr + " " + (p.product_type || "").toLowerCase()) && !(p.images || []).length) continue;
    const v = (p.variants || [])[0] || {};
    const size = parseSize(p);
    const item = {
      id: String(p.id), handle: p.handle, name: p.title, vendor: p.vendor,
      priceGBP: Number(v.price || 0), compareGBP: Number(v.compare_at_price || 0) || null,
      available: (p.variants || []).some(x => x.available !== false),
      images: (p.images || []).slice(0, 6).map(i => i.src),
      size, cats: categories(p), colors: colorOf(p),
      desc: strip(p.body_html).slice(0, 600),
      updated: p.updated_at
    };
    if (!size){ noSize++; items.push(item); continue; }
    const old = prevById.get(item.id);
    if (old && old.ar && old.updated === item.updated && fs.existsSync(path.join(AR_DIR, `${p.handle}.json`))){
      item.ar = old.ar; arOk++; items.push(item); continue;
    }
    if (old && old.arTried === item.updated){ items.push(item); continue; }
    if (Date.now() - T0 > BUDGET_MS){ items.push(item); continue; }
    const ar = await tryAR(p, size);
    item.arTried = item.updated;
    if (items.length % 40 === 0) console.log(`… ${items.length} elaborate, ${arOk} con AR, ${Math.round((Date.now()-T0)/60000)} min`);
    if (ar){
      arOk++;
      const full = slimProfile(Object.assign(ar.profile, {calibro: {lens: size.lens, bridge: size.bridge, temple: size.temple || 145},
        mat: /metal|titanium/i.test(tagStr) ? "metallo" : "acetato"}));
      fs.writeFileSync(path.join(AR_DIR, `${p.handle}.json`), JSON.stringify(full));
      item.ar = summary(full);
      item.arImage = ar.image;
    }
    items.push(item);
  }
  const out = {source: SOURCE, generated: new Date().toISOString(), gbpEur: GBP_EUR, count: items.length, arCount: arOk, items};
  fs.writeFileSync(path.join(OUT, "catalog.json"), JSON.stringify(out));
  console.log(`montature: ${items.length} · con AR: ${arOk} · senza misure: ${noSize}`);
}
main().catch(e => { console.error(e); process.exit(1); });
