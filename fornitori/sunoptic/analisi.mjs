// Analisi del sito Sunoptic (solo lettura, rispettando robots.txt): struttura, numero di modelli, foto per modello.
const BASE = process.env.BASE || "https://www.sunoptic.com";
const UA = "Mozilla/5.0 (compatible; OttiVistaCatalogo/1.0; +https://github.com/stefanodibella1-png/ottivista)";
const note = (t, m) => console.log(`::notice title=${t}::${String(m).replace(/\n/g, " ").slice(0, 3500)}`);
const get = async (u, tipo = "text") => { const r = await fetch(u, {headers: {"User-Agent": UA, "Accept-Language": "it,en"}, redirect: "follow"}); return {status: r.status, url: r.url, body: r.ok ? await r[tipo]() : "", ct: r.headers.get("content-type") || ""}; };
const pausa = ms => new Promise(r => setTimeout(r, ms));
const out = {};
const h = await get(BASE); out.home = {status: h.status, url: h.url, ct: h.ct, len: h.body.length};
note("Home", `${h.status} ${h.url} · ${h.body.length} caratteri · titolo: ${(h.body.match(/<title[^>]*>([^<]*)/i) || [])[1] || "-"}`);
const origin = new URL(h.url || BASE).origin;
const rb = await get(origin + "/robots.txt"); note("robots.txt", rb.status + " · " + rb.body.slice(0, 1500).split("\n").join(" | "));
const disallow = [...rb.body.matchAll(/^Disallow:\s*(\S+)/gim)].map(m => m[1]);
// sitemap
const sms = [...rb.body.matchAll(/^Sitemap:\s*(\S+)/gim)].map(m => m[1]); if (!sms.length) sms.push(origin + "/sitemap.xml", origin + "/sitemap_index.xml");
const urls = new Set(); const visti = new Set();
async function leggiSitemap(u, liv = 0){
  if (visti.has(u) || liv > 3) return; visti.add(u);
  const r = await get(u); if (r.status !== 200) return;
  const locs = [...r.body.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(m => m[1].replace(/&amp;/g, "&"));
  if (/<sitemapindex/i.test(r.body)) for (const l of locs) { await leggiSitemap(l, liv + 1); await pausa(300); }
  else locs.forEach(l => urls.add(l));
}
for (const s of sms) await leggiSitemap(s);
note("Sitemap", `${visti.size} file · ${urls.size} indirizzi · ${[...visti].slice(0, 8).join(" ")}`);
// indirizzi che sembrano prodotti
const tutti = [...urls];
const gruppi = {}; for (const u of tutti){ const p = new URL(u).pathname.split("/").filter(Boolean); const k = p.slice(0, Math.min(2, p.length - 1)).join("/") || "/"; gruppi[k] = (gruppi[k] || 0) + 1; }
note("Sezioni del sito", Object.entries(gruppi).sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, n]) => `${k}: ${n}`).join(" · "));
// pagine prodotto: /en/<categoria>/<modello>
let prodotti = tutti.filter(u => { const p = new URL(u).pathname.split("/").filter(Boolean); return p[0] === "en" && p.length >= 3 && /frames|glasses|sunglasses/.test(p[1]); });
const cat = {}; for (const u of prodotti){ const c = new URL(u).pathname.split("/")[2]; cat[c] = (cat[c] || 0) + 1; }
note("Modelli per categoria (en)", Object.entries(cat).map(([k, n]) => `${k}: ${n}`).join(" · "));
prodotti = [prodotti.find(u => /sunoptic-metal-frames/.test(u)), prodotti.find(u => /sunoptic-acetate/.test(u)), prodotti.find(u => /montana-acetate/.test(u)), prodotti.find(u => /kids/.test(u))].filter(Boolean).concat(prodotti);
if (!prodotti.length){
  // senza sitemap: link dalla home
  const links = [...h.body.matchAll(/href="([^"#]+)"/g)].map(m => new URL(m[1], origin).href).filter(u => u.startsWith(origin));
  note("Link dalla home", [...new Set(links)].slice(0, 60).join(" "));
  prodotti = [...new Set(links)].filter(u => /product|prodott|frame|montatur|collection|collezion|eyewear|shop/i.test(u));
}
note("Prodotti stimati", `${prodotti.length} · esempi: ${prodotti.slice(0, 6).join(" ")}`);
// 3 pagine di esempio: foto, dati strutturati, login
for (const u of prodotti.filter(u => !disallow.some(d => d !== "/" && new URL(u).pathname.startsWith(d))).slice(0, 2)){
  await pausa(1500);
  const r = await get(u); const b = r.body;
  const imgs = [...new Set([...b.matchAll(/(?:src|data-src|data-zoom-image|href)="([^"]+\.(?:jpe?g|png|webp)(?:\?[^"]*)?)"/gi)].map(m => new URL(m[1].replace(/&amp;/g, "&"), u).href))].filter(x => !/logo|icon|sprite|flag|payment/i.test(x));
  const og = (b.match(/property="og:image"\s+content="([^"]+)"/i) || [])[1] || "";
  const ld = [...b.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1].trim().slice(0, 600));
  const login = /login|accedi|sign in|area riservata|password/i.test(b) ? "sì (parole di accesso presenti)" : "no";
  const prezzo = /€|eur|price/i.test(b) ? "presente" : "assente";
  note("Pagina " + new URL(u).pathname.slice(0, 60), `${r.status} · ${imgs.length} immagini · og:image ${og || "-"} · login ${login} · prezzo ${prezzo} · titolo ${(b.match(/<title[^>]*>([^<]*)/i) || [])[1] || "-"}`);
  note("Immagini " + new URL(u).pathname.slice(0, 40), imgs.slice(0, 12).join(" "));
  const tutte = [...new Set([...b.matchAll(/(?:https?:)?\/\/[^"'\s)]+?\.(?:jpe?g|png|webp)/gi)].map(m => m[0]))].filter(x => !/banner|logo|icon|flag/i.test(x));
  note("Tutte le immagini " + new URL(u).pathname.slice(0, 40), tutte.length + " · " + tutte.slice(0, 15).join(" "));
  const testo = b.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  const i = testo.search(/M3|TRC|Size|Calibr|Colour|Color/); note("Testo " + new URL(u).pathname.slice(0, 40), testo.slice(Math.max(0, i - 200), i + 1800));
  for (const k of ["login", "Log in", "price", "Price", "dealer", "retailer"]){ const j = b.indexOf(k); if (j > 0) note("Parola " + k, b.slice(j - 150, j + 150).replace(/\s+/g, " ")); }
  const api = [...new Set([...b.matchAll(/["'](\/?(?:api|graphql|data)\/[^"']{3,120})["']/gi)].map(m => m[1]))].slice(0, 20);
  const scripts = [...b.matchAll(/<script[^>]+src="([^"]+)"/gi)].map(m => m[1]).slice(0, 15);
  note("Script e API " + new URL(u).pathname.slice(0, 40), "api: " + api.join(" ") + " · script: " + scripts.join(" "));
  if (ld.length) note("Dati strutturati " + new URL(u).pathname.slice(0, 40), ld.join(" | "));
}
