/* OttiVista Studio · analisi della foto frontale di una montatura.
   Input: ImageData (sfondo chiaro uniforme), calibro, soglia.
   Output: profilo in mm pronto per OVProfile.build, più i contorni in pixel per l'anteprima. */
(function(){
  "use strict";

  function median(a){ const b = Array.from(a).sort((x,y) => x-y); return b[b.length >> 1]; }

  // stima del colore di sfondo dai bordi dell'immagine
  function bgColor(d, w, h){
    const r = [], g = [], b = [];
    const take = (x, y) => { const i = (y*w + x)*4; r.push(d[i]); g.push(d[i+1]); b.push(d[i+2]); };
    for (let x = 0; x < w; x += 2){ take(x, 0); take(x, 1); take(x, h-1); take(x, h-2); }
    for (let y = 0; y < h; y += 2){ take(0, y); take(1, y); take(w-1, y); take(w-2, y); }
    return [median(r), median(g), median(b)];
  }

  // sfondo locale: compensa luce non uniforme, vignettatura e ombre leggere del foglio
  function localBg(d, w, h){
    const G = 24, cw = Math.ceil(w/G), ch = Math.ceil(h/G), gx = Math.ceil(w/cw), gy = Math.ceil(h/ch);
    const cell = new Float32Array(gx*gy*3);
    for (let cy = 0; cy < gy; cy++) for (let cx = 0; cx < gx; cx++){
      const px = [];
      for (let y = cy*ch; y < Math.min(h, (cy+1)*ch); y += 2) for (let x = cx*cw; x < Math.min(w, (cx+1)*cw); x += 2){ const j = (y*w + x)*4; px.push([d[j] + d[j+1] + d[j+2], j]); }
      px.sort((a, b) => b[0] - a[0]);
      const n = Math.max(1, Math.round(px.length*.25)); let r = 0, g = 0, b = 0;   // il 25% più chiaro = sfondo
      for (let i = 0; i < n; i++){ const j = px[i][1]; r += d[j]; g += d[j+1]; b += d[j+2]; }
      const k = (cy*gx + cx)*3; cell[k] = r/n; cell[k+1] = g/n; cell[k+2] = b/n;
    }
    // smussatura 3x3 (mediana) per non farsi ingannare da celle coperte dalla montatura
    const sm = new Float32Array(cell.length);
    for (let cy = 0; cy < gy; cy++) for (let cx = 0; cx < gx; cx++) for (let c = 0; c < 3; c++){
      const v = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++){ const xx = cx + dx, yy = cy + dy; if (xx >= 0 && yy >= 0 && xx < gx && yy < gy) v.push(cell[(yy*gx + xx)*3 + c]); }
      sm[(cy*gx + cx)*3 + c] = Math.max(...v.sort((a, b) => a - b).slice(Math.floor(v.length/2)));
    }
    const out = new Float32Array(w*h*3);
    for (let y = 0; y < h; y++){
      const fy = Math.min(gy - 1.001, Math.max(0, y/ch - .5)), y0 = fy | 0, ty = fy - y0;
      for (let x = 0; x < w; x++){
        const fx = Math.min(gx - 1.001, Math.max(0, x/cw - .5)), x0 = fx | 0, tx = fx - x0;
        const a = (y0*gx + x0)*3, b = a + 3, c = a + gx*3, e = c + 3, o = (y*w + x)*3;
        for (let k = 0; k < 3; k++) out[o + k] = (sm[a + k]*(1 - tx) + sm[b + k]*tx)*(1 - ty) + (sm[c + k]*(1 - tx) + sm[e + k]*tx)*ty;
      }
    }
    return out;
  }

  function morph(m, w, h, r, dilate){
    const tmp = new Uint8Array(w*h), out = new Uint8Array(w*h);
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        let v = dilate ? 0 : 1;
        for (let k = -r; k <= r; k++){
          const xx = x + k; const s = xx < 0 || xx >= w ? 0 : m[y*w + xx];
          if (dilate ? s : !s){ v = dilate ? 1 : 0; break; }
        }
        tmp[y*w + x] = v;
      }
    }
    for (let y = 0; y < h; y++){
      for (let x = 0; x < w; x++){
        let v = dilate ? 0 : 1;
        for (let k = -r; k <= r; k++){
          const yy = y + k; const s = yy < 0 || yy >= h ? 0 : tmp[yy*w + x];
          if (dilate ? s : !s){ v = dilate ? 1 : 0; break; }
        }
        out[y*w + x] = v;
      }
    }
    return out;
  }

  // etichettatura delle componenti connesse (4-connessione)
  function label(mask, w, h, value){
    const lab = new Int32Array(w*h).fill(-1), comps = [];
    const stack = new Int32Array(w*h);
    for (let i = 0; i < w*h; i++){
      if (mask[i] !== value || lab[i] !== -1) continue;
      const id = comps.length; let sp = 0; stack[sp++] = i; lab[i] = id;
      let area = 0, minx = w, miny = h, maxx = 0, maxy = 0, sx = 0, sy = 0, border = false;
      while (sp){
        const p = stack[--sp], x = p % w, y = (p / w) | 0;
        area++; sx += x; sy += y;
        if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
        if (x === 0 || y === 0 || x === w-1 || y === h-1) border = true;
        if (x > 0 && mask[p-1] === value && lab[p-1] === -1){ lab[p-1] = id; stack[sp++] = p-1; }
        if (x < w-1 && mask[p+1] === value && lab[p+1] === -1){ lab[p+1] = id; stack[sp++] = p+1; }
        if (y > 0 && mask[p-w] === value && lab[p-w] === -1){ lab[p-w] = id; stack[sp++] = p-w; }
        if (y < h-1 && mask[p+w] === value && lab[p+w] === -1){ lab[p+w] = id; stack[sp++] = p+w; }
      }
      comps.push({id, area, minx, miny, maxx, maxy, cx: sx/area, cy: sy/area, border});
    }
    return {lab, comps};
  }

  // riempie i buchi di una maschera (tutto ciò che non è raggiungibile dal bordo)
  function fill(mask, w, h){
    const out = new Uint8Array(w*h).fill(1), stack = new Int32Array(w*h); let sp = 0;
    const push = p => { if (out[p] === 1 && !mask[p]){ out[p] = 0; stack[sp++] = p; } };
    for (let x = 0; x < w; x++){ push(x); push((h-1)*w + x); }
    for (let y = 0; y < h; y++){ push(y*w); push(y*w + w-1); }
    while (sp){
      const p = stack[--sp], x = p % w, y = (p / w) | 0;
      if (x > 0) push(p-1); if (x < w-1) push(p+1); if (y > 0) push(p-w); if (y < h-1) push(p+w);
    }
    return out;
  }

  // contorno ordinato di una maschera piena (marching squares)
  function trace(mask, w, h){
    const get = (x, y) => (x >= 0 && y >= 0 && x < w && y < h) ? mask[y*w + x] : 0;
    let sx = -1, sy = -1;
    find: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y*w + x]){ sx = x; sy = y; break find; }
    if (sx < 0) return [];
    let x = sx, y = sy, prev = 0, next = 0; const pts = [];
    const UP = 1, DOWN = 2, LEFT = 3, RIGHT = 4;
    let guard = 0;
    do {
      const s = get(x-1, y-1) | (get(x, y-1) << 1) | (get(x-1, y) << 2) | (get(x, y) << 3);
      prev = next;
      switch (s){
        case 1: next = UP; break; case 2: next = RIGHT; break; case 3: next = RIGHT; break;
        case 4: next = LEFT; break; case 5: next = UP; break;
        case 6: next = prev === UP ? LEFT : RIGHT; break;
        case 7: next = RIGHT; break; case 8: next = DOWN; break;
        case 9: next = prev === RIGHT ? UP : DOWN; break;
        case 10: next = DOWN; break; case 11: next = DOWN; break;
        case 12: next = LEFT; break; case 13: next = UP; break; case 14: next = LEFT; break;
        default: return pts;
      }
      if (next !== prev) pts.push([x, y]);
      if (next === UP) y--; else if (next === DOWN) y++; else if (next === LEFT) x--; else x++;
    } while ((x !== sx || y !== sy) && ++guard < w*h*4);
    return pts;
  }

  function simplify(pts, eps){
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
  function chaikin(pts, it){
    let p = pts;
    for (let k = 0; k < it; k++){
      const o = [];
      for (let i = 0; i < p.length; i++){
        const a = p[i], b = p[(i+1)%p.length];
        o.push([a[0]*.75 + b[0]*.25, a[1]*.75 + b[1]*.25], [a[0]*.25 + b[0]*.75, a[1]*.25 + b[1]*.75]);
      }
      p = o;
    }
    return p;
  }
  function resample(pts, step){
    const out = []; let acc = 0;
    for (let i = 0; i < pts.length; i++){
      const a = pts[i], b = pts[(i+1)%pts.length], L = Math.hypot(b[0]-a[0], b[1]-a[1]);
      if (i === 0) out.push(a);
      let t = step - acc;
      while (t < L){ out.push([a[0] + (b[0]-a[0])*t/L, a[1] + (b[1]-a[1])*t/L]); t += step; }
      acc = L - (t - step);
    }
    return out;
  }
  function smoothContour(raw, scale){
    return resample(chaikin(simplify(raw, .9*scale), 2), 1.2*scale);
  }

  function hex(r, g, b){ return "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join(""); }

  // prova la sensibilità scelta e, se non basta, altre vicine: restituisce il primo risultato valido
  function analyze(img, opts){
    const cache = {lb: localBg(img.data, img.width, img.height)};
    const base = opts.threshold || 60, tries = [base];
    for (const t of [base - 15, base + 15, base - 28, base + 30, base + 50, 35, 90, 120]) if (t >= 20 && t <= 160 && !tries.includes(t)) tries.push(t);
    let first = null;
    for (const t of tries){
      const r = analyzeOnce(img, Object.assign({}, opts, {threshold: t}), cache);
      if (r.ok){ r.threshold = t; if (t !== base) r.checks.push({ok: true, txt: `Sensibilità regolata in automatico a ${t}`}); return r; }
      if (!first) first = r;
    }
    return first;
  }
  function analyzeOnce(img, opts, cache){
    const {width: w, height: h, data: d} = img;
    const thr = opts.threshold || 60;
    const bg = bgColor(d, w, h), lb = cache.lb;
    // maschera della montatura: pixel lontani dallo sfondo locale (luce non uniforme compensata)
    let m = new Uint8Array(w*h);
    for (let i = 0, j = 0; i < w*h; i++, j += 4){
      const o = i*3, dr = d[j]-lb[o], dg = d[j+1]-lb[o+1], db = d[j+2]-lb[o+2];
      const dist = Math.sqrt(dr*dr*.3 + dg*dg*.59 + db*db*.11) * 1.7 + Math.max(0, (lb[o]+lb[o+1]+lb[o+2] - d[j]-d[j+1]-d[j+2])/3) * .4;
      // ombra sul foglio: più scura dello sfondo ma con lo stesso colore → non è montatura
      const sb = lb[o] + lb[o+1] + lb[o+2] + 1, sp = d[j] + d[j+1] + d[j+2] + 1, ratio = sp/sb;
      const chroma = Math.abs(d[j]/sp - lb[o]/sb) + Math.abs(d[j+1]/sp - lb[o+1]/sb) + Math.abs(d[j+2]/sp - lb[o+2]/sb);
      m[i] = dist > thr && !(ratio > .6 && chroma < .03) ? 1 : 0;
    }
    const R = Math.max(1, Math.round(Math.min(w, h)/500));
    m = morph(morph(m, w, h, R, true), w, h, R, false);   // chiusura: salda i bordi sottili
    m = morph(morph(m, w, h, 1, false), w, h, 1, true);   // apertura: toglie i puntini

    // la montatura = componente più grande che non tocca il bordo
    const {lab, comps} = label(m, w, h, 1);
    const cand = comps.filter(c => !c.border && c.area > w*h*.002).sort((a, b) => b.area - a.area);
    if (!cand.length) return {ok:false, msg:"Montatura non trovata: inquadra tutta la montatura con un po' di sfondo libero attorno, su un foglio bianco."};
    // pezzi della stessa montatura (es. ponte sottile o trasparente che li separa): si uniscono quelli grandi e affiancati
    const big = cand[0], parts = cand.filter(c => c === big || (c.area > big.area*.25 && c.maxy > big.miny && c.miny < big.maxy));
    const F = parts.reduce((a, c) => ({id: -1, area: a.area + c.area, minx: Math.min(a.minx, c.minx), miny: Math.min(a.miny, c.miny), maxx: Math.max(a.maxx, c.maxx), maxy: Math.max(a.maxy, c.maxy)}), {area: 0, minx: w, miny: h, maxx: 0, maxy: 0});
    const ids = new Set(parts.map(c => c.id));
    const frame = new Uint8Array(w*h);
    for (let i = 0; i < w*h; i++) if (ids.has(lab[i])) frame[i] = 1;

    // le lenti = zone di sfondo racchiuse dalla montatura
    const solid = fill(frame, w, h);
    const holeMask = new Uint8Array(w*h);
    for (let i = 0; i < w*h; i++) if (solid[i] && !frame[i]) holeMask[i] = 1;
    const H = label(holeMask, w, h, 1);
    const holes = H.comps.filter(c => c.area > F.area*.15).sort((a, b) => b.area - a.area).slice(0, 2).sort((a, b) => a.cx - b.cx);
    if (holes.length < 2) return {ok:false, msg: parts.length > 1 && holes.length === 0
      ? "Vedo la montatura ma le lenti non sono chiuse da un bordo (montatura a giorno o con filo di nylon): per ora lo Studio funziona con montature a giro completo."
      : "Non trovo due lenti aperte: togli le lenti demo se hanno etichette o riflessi forti, oppure muovi la sensibilità.", bg, frame};

    // contorni in pixel
    const sc = Math.max(1, Math.min(w, h)/700);
    const outerPx = smoothContour(trace(solid, w, h), sc);
    const holesPx = holes.map(c => {
      const hm = new Uint8Array(w*h);
      for (let i = 0; i < w*h; i++) if (H.lab[i] === c.id) hm[i] = 1;
      return smoothContour(trace(fill(hm, w, h), w, h), sc);
    });

    // scala dal calibro: la luce visibile è ~1 mm più piccola della lente (scanalatura)
    const lensMm = opts.lens, bridgeMm = opts.bridge;
    const wA = holes[0].maxx - holes[0].minx + 1, wB = holes[1].maxx - holes[1].minx + 1;
    const ppm = ((wA + wB)/2) / (lensMm - 1);
    const cx = (holes[0].cx + holes[1].cx)/2, cy = (holes[0].cy + holes[1].cy)/2;
    const bridgePx = holes[1].minx - holes[0].maxx;
    const toMm = p => [(p[0] - cx)/ppm, -(p[1] - cy)/ppm];
    const outer = outerPx.map(toMm), holesMm = holesPx.map(hh => hh.map(toMm));
    const hMm = ((holes[0].maxy - holes[0].miny) + (holes[1].maxy - holes[1].miny))/2/ppm + 1;
    const frontMm = (F.maxx - F.minx)/ppm;

    // cerniere: punto più esterno nella metà alta della lente
    const hinge = [-1, 1].map(s => {
      let best = null;
      for (const p of outer) if (Math.sign(p[0]) === s && p[1] > -hMm*.1 && p[1] < hMm*.55 && (!best || Math.abs(p[0]) > Math.abs(best[0]))) best = p;
      if (!best) best = outer.reduce((a, p) => Math.abs(p[0]) > Math.abs(a[0]) && Math.sign(p[0]) === s ? p : a, [s*frontMm/2, hMm*.25]);
      return [best[0] - s*1.6, best[1]];
    });

    // colori reali
    let r = 0, g = 0, b = 0, n = 0, tr = 0, tg = 0, tb = 0, tn = 0;
    const edge = (F.maxx - F.minx)*.1;
    for (let y = F.miny; y <= F.maxy; y++) for (let x = F.minx; x <= F.maxx; x++){
      const i = y*w + x; if (!frame[i]) continue;
      const j = i*4; r += d[j]; g += d[j+1]; b += d[j+2]; n++;
      if (x < F.minx + edge || x > F.maxx - edge){ tr += d[j]; tg += d[j+1]; tb += d[j+2]; tn++; }
    }
    const frameColor = hex(r/n, g/n, b/n), templeColor = tn ? hex(tr/tn, tg/tn, tb/tn) : frameColor;

    // texture: ritaglio della foto con lo sfondo sostituito dal colore medio della montatura
    const pad = Math.round(4*sc);
    const bx0 = Math.max(0, F.minx - pad), by0 = Math.max(0, F.miny - pad);
    const bw = Math.min(w, F.maxx + pad + 1) - bx0, bh = Math.min(h, F.maxy + pad + 1) - by0;
    const near = morph(frame, w, h, Math.max(2, Math.round(3*sc)), true);
    const tex = new ImageData(bw, bh);
    for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++){
      const i = (y + by0)*w + (x + bx0), j = i*4, k = (y*bw + x)*4;
      if (frame[i]){ tex.data[k] = d[j]; tex.data[k+1] = d[j+1]; tex.data[k+2] = d[j+2]; }
      else if (near[i]){ tex.data[k] = r/n*.6 + d[j]*.4; tex.data[k+1] = g/n*.6 + d[j+1]*.4; tex.data[k+2] = b/n*.6 + d[j+2]*.4; }
      else { tex.data[k] = r/n; tex.data[k+1] = g/n; tex.data[k+2] = b/n; }
      tex.data[k+3] = 255;
    }
    const repeat = [ppm/bw, ppm/bh];
    const offset = [(cx - bx0)/bw, 1 - (cy - by0)/bh];

    // controlli di qualità
    const sym = Math.abs(wA - wB)/((wA + wB)/2);
    const bridgeMeas = bridgePx/ppm - 1;
    const checks = [
      {ok: true, txt: "Due lenti trovate"},
      {ok: sym < .06, txt: sym < .06 ? "Foto frontale: lenti simmetriche" : `Lenti diverse del ${Math.round(sym*100)}%: la foto non è frontale`},
      {ok: Math.abs(bridgeMeas - bridgeMm) <= 2.5, txt: `Ponte misurato ${bridgeMeas.toFixed(1)} mm (calibro ${bridgeMm})`},
    ];
    return {ok:true, bg, frame, outerPx, holesPx, ppm, cx, cy, checks, tex, texBox:[bx0, by0, bw, bh],
      profile:{ v:1, h: +hMm.toFixed(1), front: +frontMm.toFixed(1), outer, holes: holesMm, hinge,
        tex:{repeat, offset}, frameColor, templeColor }};
  }

  window.OVAnalyze = { analyze };
})();
