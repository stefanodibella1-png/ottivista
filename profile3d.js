/* OttiVista · costruzione del modello 3D da un profilo digitalizzato con lo Studio.
   Profilo (unità: mm, origine = centro tra le lenti all'altezza dei centri lente, y verso l'alto):
   { v, id, name, calibro:{lens,bridge,temple}, mat, depth, h, front,
     outer:[[x,y]...], holes:[[[x,y]...],[[x,y]...]], hinge:[[x,y],[x,y]],
     tex:{data, repeat:[rx,ry], offset:[ox,oy]}, frameColor, templeColor } */
(function(){
  "use strict";
  const WRAP = 260;
  function bend(geo, R){
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++){ const x = p.getX(i); p.setZ(i, p.getZ(i) - x*x/(2*R)); }
    p.needsUpdate = true; geo.computeVertexNormals();
  }
  function grow(pts, d){
    let area = 0;
    for (let i = 0; i < pts.length; i++){ const a = pts[i], b = pts[(i+1)%pts.length]; area += a[0]*b[1] - b[0]*a[1]; }
    const sg = area > 0 ? 1 : -1, n = pts.length, out = [];
    for (let i = 0; i < n; i++){
      const p = pts[(i-1+n)%n], c = pts[i], q = pts[(i+1)%n];
      const e1 = [c[0]-p[0], c[1]-p[1]], e2 = [q[0]-c[0], q[1]-c[1]];
      const l1 = Math.hypot(e1[0], e1[1]) || 1, l2 = Math.hypot(e2[0], e2[1]) || 1;
      let nx = e1[1]/l1*sg + e2[1]/l2*sg, ny = -e1[0]/l1*sg - e2[0]/l2*sg;
      const ln = Math.hypot(nx, ny) || 1; nx /= ln; ny /= ln;
      out.push([c[0] + nx*d, c[1] + ny*d]);
    }
    return out;
  }
  function mark(mesh, part, own){ mesh.name = part; mesh.userData.part = part; if (own) mesh.userData.ownMat = true; return mesh; }

  function build(THREE, P){
    const g = new THREE.Group();
    const V2 = p => new THREE.Vector2(p[0], p[1]);
    const metal = P.mat === "metallo";
    const depth = P.depth || (metal ? 1.6 : 4.4);

    // frontale con la texture reale della foto
    const shape = new THREE.Shape(P.outer.map(V2));
    for (const h of P.holes) shape.holes.push(new THREE.Path(h.map(V2)));
    const front = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelThickness:depth*.18, bevelSize:Math.min(.55, depth*.14), bevelSegments:2, curveSegments:1});
    front.translate(0, 0, -depth);
    bend(front, WRAP);
    const tex = new THREE.TextureLoader().load(P.tex.data, () => { if (typeof P.onReady === "function") P.onReady(); });
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.repeat.set(P.tex.repeat[0], P.tex.repeat[1]);
    tex.offset.set(P.tex.offset[0], P.tex.offset[1]);
    tex.anisotropy = 4;
    const frontMat = new THREE.MeshPhysicalMaterial({
      map: tex, roughness: metal ? .3 : .32, metalness: metal ? .55 : 0,
      clearcoat: metal ? .4 : 1, clearcoatRoughness: .07, side: THREE.DoubleSide });
    g.add(mark(new THREE.Mesh(front, frontMat), "frame", true));

    // lenti
    for (const h of P.holes){
      const lg = new THREE.ShapeGeometry(new THREE.Shape(grow(h, .6).map(V2)), 4);
      lg.translate(0, 0, -depth*.5);
      bend(lg, WRAP);
      g.add(mark(new THREE.Mesh(lg, new THREE.MeshBasicMaterial()), "lens"));
    }

    // cerniere e aste nel colore reale
    const templeMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(P.templeColor || P.frameColor || "#222222"),
      roughness: metal ? .28 : .3, metalness: metal ? .9 : 0, clearcoat: metal ? .2 : 1, clearcoatRoughness: .08 });
    const tlen = (P.calibro && P.calibro.temple) || 145;
    for (let i = 0; i < 2; i++){
      const hp = P.hinge[i], s = Math.sign(hp[0]) || (i ? 1 : -1);
      const zx = -(hp[0]*hp[0])/(2*WRAP);
      const hinge = new THREE.BoxGeometry(4.5, metal ? 2.6 : 4, 7, 1, 1, 1);
      hinge.translate(hp[0], hp[1], zx - 4);
      g.add(mark(new THREE.Mesh(hinge, templeMat), "temple", true));
      const k = tlen/145;
      const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(hp[0], hp[1], zx - 6),
        new THREE.Vector3(hp[0] + s*3.5, hp[1], zx - 45*k),
        new THREE.Vector3(hp[0] + s*6, hp[1] - 1.5, zx - 98*k),
        new THREE.Vector3(hp[0] + s*3, hp[1] - 20, zx - 124*k)]);
      const tg = new THREE.TubeGeometry(path, 48, metal ? .95 : 1.7, 10, false);
      if (!metal){ tg.translate(-hp[0], -hp[1], 0); tg.scale(.75, 1.6, 1); tg.translate(hp[0], hp[1], 0); }
      g.add(mark(new THREE.Mesh(tg, templeMat), "temple", true));
    }

    // naselli per le montature in metallo
    if (metal){
      const inner = Math.min(...P.holes[1].map(p => p[0]));
      for (const s of [-1, 1]){
        const pad = new THREE.SphereGeometry(1, 16, 12); pad.scale(1.5, 3.4, 1.1); pad.rotateZ(s*.35);
        pad.translate(s*(inner + 1.2), -3.5, -5.5);
        g.add(mark(new THREE.Mesh(pad, new THREE.MeshBasicMaterial()), "pads"));
      }
    }
    return g;
  }
  window.OVProfile = { build, bend, grow };
})();
