// separa la geometria AR dal catalogo: catalog.json leggero + shop/ar/<handle>.json per ogni modello
import fs from "node:fs";
export function dp(pts, eps){
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length-1] = 1;
  const st = [[0, pts.length-1]];
  while (st.length){
    const [a, b] = st.pop(); let md = 0, mi = -1;
    const [ax, ay] = pts[a], [bx, by] = pts[b], dx = bx-ax, dy = by-ay, L = Math.hypot(dx, dy) || 1;
    for (let i = a+1; i < b; i++){ const d = Math.abs((pts[i][0]-ax)*dy - (pts[i][1]-ay)*dx)/L; if (d > md){ md = d; mi = i; } }
    if (md > eps){ keep[mi] = 1; st.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
const r1 = v => Math.round(v*10)/10;
export function slimProfile(p){
  const s = pts => dp(pts, .12).map(q => [r1(q[0]), r1(q[1])]);
  return Object.assign({}, p, {outer: s(p.outer), holes: p.holes.map(s), hinge: p.hinge.map(q => [r1(q[0]), r1(q[1])]),
    h: r1(p.h), front: r1(p.front), tex: {data: p.tex.data, repeat: p.tex.repeat.map(v => +v.toFixed(6)), offset: p.tex.offset.map(v => +v.toFixed(6))}});
}
export function summary(p){ return {front: p.front, h: p.h, mat: p.mat, calibro: p.calibro}; }
if (process.argv[1] && process.argv[1].endsWith("slim.mjs")){
  const f = "shop/catalog.json", c = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const it of c.items){
    if (it.ar && it.ar.outer){
      const sp = slimProfile(it.ar);
      fs.writeFileSync(`shop/ar/${it.handle}.json`, JSON.stringify(sp));
      it.ar = summary(sp);
    }
  }
  fs.writeFileSync(f, JSON.stringify(c));
  console.log("ok", (fs.statSync(f).size/1e6).toFixed(2) + " MB");
}
