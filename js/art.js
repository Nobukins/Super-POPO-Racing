// ドット絵アセット: 子どもたち・ユウタ・ねこ・さる・さかなやのおやじ・UFO・背景をすべてコードで 8bit 風に生成する
(() => {
  "use strict";

  const OUT = "#18141c";

  // ---------------------------------------------------------------- helpers
  function canvasOf(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }

  // fn(P, g): P は整数座標で塗るための小さな道具箱
  function paint(w, h, fn) {
    const c = canvasOf(w, h);
    const g = c.getContext("2d");
    const P = {
      g,
      p(x, y, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
      r(x, y, rw, rh, col) { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(rw), Math.round(rh)); },
      // 塗りつぶし楕円 (中心 cx,cy は 0.5 刻みで指定するときれい)
      ell(cx, cy, rx, ry, col) {
        g.fillStyle = col;
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
          const dy = (y + 0.5 - cy) / ry;
          if (Math.abs(dy) > 1) continue;
          const half = rx * Math.sqrt(1 - dy * dy);
          const x0 = Math.round(cx - half);
          const x1 = Math.round(cx + half);
          if (x1 > x0) g.fillRect(x0, y, x1 - x0, 1);
        }
      },
      // 太さ t の線 (手足・自転車のフレーム用)
      line(x0, y0, x1, y1, col, t = 1) {
        g.fillStyle = col;
        const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))));
        for (let i = 0; i <= n; i++) {
          const x = x0 + ((x1 - x0) * i) / n;
          const y = y0 + ((y1 - y0) * i) / n;
          g.fillRect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t);
        }
      },
      ring(cx, cy, rad, col) {
        g.fillStyle = col;
        for (let a = 0; a < 64; a++) {
          const t = (a / 64) * Math.PI * 2;
          g.fillRect(Math.round(cx + Math.cos(t) * rad - 0.5), Math.round(cy + Math.sin(t) * rad - 0.5), 1, 1);
        }
      },
    };
    fn(P, g);
    return c;
  }

  // 透明なピクセルのうち、となりに色があるところを黒でふちどる
  function outline(c, col = OUT) {
    const g = c.getContext("2d");
    const img = g.getImageData(0, 0, c.width, c.height);
    const d = img.data;
    const w = c.width;
    const h = c.height;
    const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const mark = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) mark.push(x, y);
      }
    }
    g.fillStyle = col;
    for (let i = 0; i < mark.length; i += 2) g.fillRect(mark[i], mark[i + 1], 1, 1);
    return c;
  }

  function flipped(c) {
    const f = canvasOf(c.width, c.height);
    const g = f.getContext("2d");
    g.translate(c.width, 0);
    g.scale(-1, 1);
    g.drawImage(c, 0, 0);
    return f;
  }

  function shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => Math.max(0, Math.min(255, Math.round(v * k)));
    const r = f((n >> 16) & 255);
    const gg = f((n >> 8) & 255);
    const b = f(n & 255);
    return "#" + ((1 << 24) | (r << 16) | (gg << 8) | b).toString(16).slice(1);
  }

  function rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const cache = new Map();
  function cached(key, make) {
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }

  // ---------------------------------------------------------------- 人 (子ども・ユウタ・おやじ)
  // look: { skin, hair, style: short|pig|pony|cap|spike, shirt, pants, shoes, cap }
  function head(P, x, y, look, mouth) {
    const { skin, hair } = look;
    P.r(x + 1, y, 6, 8, skin);
    P.r(x, y + 1, 8, 6, skin);
    // 髪 (右向きなので後ろ = 左)
    P.r(x + 1, y - 1, 6, 2, hair);
    P.r(x, y, 8, 2, hair);
    P.r(x, y + 2, 2, 4, hair);
    if (look.style === "spike") { P.p(x + 1, y - 2, hair); P.p(x + 4, y - 2, hair); P.p(x - 1, y + 1, hair); }
    if (look.style === "pig") { P.r(x - 3, y + 2, 3, 3, hair); P.p(x - 1, y + 2, look.ribbon || "#ff5a7a"); }
    if (look.style === "pony") { P.r(x - 3, y + 1, 3, 2, hair); P.r(x - 4, y + 3, 2, 3, hair); }
    if (look.style === "cap") {
      P.r(x, y - 1, 8, 3, look.cap);
      P.r(x + 6, y + 1, 4, 1, look.cap);
      P.p(x + 3, y, "#ffffff");
    }
    // 目・ほっぺ
    P.r(x + 6, y + 3, 1, 2, OUT);
    P.p(x + 7, y + 5, "#ff9a9a");
    if (mouth) P.r(x + 6, y + 6, 2, 1, "#b0303a");
  }

  // 走るポーズ (4 コマ) / 立ち / 手をふる
  function runner(look, pose, f) {
    return outline(paint(24, 28, (P) => {
      const { skin, shirt, pants, shoes } = look;
      const back = shade(skin, 0.8);
      const bob = pose === "run" && f % 2 === 1 ? -1 : 0;
      // 足
      let legs;
      if (pose === "run") {
        legs = [
          [[12, 19], [15, 22], [17, 25]], [[11, 19], [10, 23], [7, 25]],
        ];
        if (f === 1) legs = [[[12, 19], [13, 23], [12, 26]], [[11, 19], [9, 22], [10, 24]]];
        if (f === 2) legs = [legs[1].map((p) => p), legs[0].map((p) => p)];
        if (f === 3) legs = [[[11, 19], [9, 22], [10, 24]], [[12, 19], [13, 23], [12, 26]]];
      } else {
        legs = [[[11, 19], [11, 23], [11, 26]], [[13, 19], [13, 23], [13, 26]]];
      }
      legs.forEach((leg, i) => {
        const col = i === 1 ? back : skin;
        P.line(leg[0][0], leg[0][1] + bob, leg[1][0], leg[1][1] + bob, col, 2);
        P.line(leg[1][0], leg[1][1] + bob, leg[2][0], leg[2][1], col, 2);
        P.r(leg[2][0] - 1, leg[2][1], 3, 2, i === 1 ? shade(shoes, 0.8) : shoes);
      });
      // 体
      P.r(9, 17 + bob, 6, 3, pants);
      P.r(9, 10 + bob, 6, 7, shirt);
      if (look.stripe) P.r(9, 13 + bob, 6, 1, look.stripe);
      // うで
      const sh = [11, 11 + bob];
      if (pose === "run") {
        const fwd = f === 0 || f === 3;
        P.line(sh[0], sh[1], fwd ? 8 : 15, sh[1] + 3, back, 2);
        P.line(sh[0] + 1, sh[1], fwd ? 15 : 8, sh[1] + 3, skin, 2);
        P.line(fwd ? 15 : 8, sh[1] + 3, fwd ? 16 : 7, sh[1] + 1, skin, 2);
      } else if (pose === "wave") {
        P.line(sh[0], sh[1] + 1, 11, sh[1] + 6, back, 2);
        P.line(sh[0] + 2, sh[1], f ? 17 : 15, f ? sh[1] - 6 : sh[1] - 7, skin, 2);
      } else {
        P.line(sh[0] - 1, sh[1] + 1, 9, sh[1] + 6, back, 2);
        P.line(sh[0] + 3, sh[1] + 1, 14, sh[1] + 6, skin, 2);
      }
      P.r(10, 10 + bob, 4, 2, shirt);
      head(P, 8, 2 + bob, look, pose === "wave");
    }));
  }

  // 自転車 (4 コマ)
  function biker(look, bike, f) {
    return outline(paint(32, 31, (P) => {
      const { skin, shirt, pants, shoes } = look;
      const th = (f / 4) * Math.PI * 2;
      const wheel = (cx, cy) => {
        P.ring(cx, cy, 5, "#2a2a32");
        P.ring(cx, cy, 4, "#2a2a32");
        P.line(cx + Math.cos(th) * 3, cy + Math.sin(th) * 3, cx - Math.cos(th) * 3, cy - Math.sin(th) * 3, "#c8c8d0");
        P.line(cx + Math.cos(th + 1.57) * 3, cy + Math.sin(th + 1.57) * 3, cx - Math.cos(th + 1.57) * 3, cy - Math.sin(th + 1.57) * 3, "#c8c8d0");
        P.p(cx, cy, "#e8e8f0");
      };
      wheel(6.5, 24.5);
      wheel(24.5, 24.5);
      // 奥の足
      const crank = [15, 24];
      const p1 = [crank[0] + Math.cos(th) * 3, crank[1] + Math.sin(th) * 3];
      const p2 = [crank[0] - Math.cos(th) * 3, crank[1] - Math.sin(th) * 3];
      const hip = [12, 15];
      const knee = (pd) => [(hip[0] + pd[0]) / 2 + 3, (hip[1] + pd[1]) / 2 - 2];
      const k2 = knee(p2);
      P.line(hip[0], hip[1], k2[0], k2[1], shade(pants, 0.8), 2);
      P.line(k2[0], k2[1], p2[0], p2[1], shade(skin, 0.8), 2);
      // フレーム
      const fc = bike;
      P.line(6.5, 24.5, 15, 24, fc, 1);
      P.line(15, 24, 12, 17, fc, 2);
      P.line(12, 18, 22, 17, fc, 2);
      P.line(15, 24, 22, 17, fc, 1);
      P.line(22, 16, 24.5, 24.5, fc, 2);
      P.line(6.5, 24.5, 12, 17, fc, 1);
      P.r(10, 15, 4, 2, "#3a3040");
      P.r(21, 13, 2, 3, "#3a3040");
      P.r(21, 13, 4, 1, "#3a3040");
      // からだ
      P.line(hip[0], hip[1] - 1, 15, 9, shirt, 4);
      P.line(15, 10, 22, 13, skin, 2);
      P.r(13, 8, 4, 3, shirt);
      // 手前の足
      const k1 = knee(p1);
      P.line(hip[0], hip[1], k1[0], k1[1], pants, 2);
      P.line(k1[0], k1[1], p1[0], p1[1], skin, 2);
      P.r(p1[0] - 1, p1[1], 3, 1, shoes);
      P.r(crank[0] - 1, crank[1] - 1, 2, 2, "#8a8a98");
      head(P, 14, 1, look, false);
    }));
  }

  // スケボー (2 コマ)
  function skater(look, f) {
    return outline(paint(26, 28, (P) => {
      const { skin, shirt, pants, shoes } = look;
      P.r(3, 23, 19, 2, "#e0603a");
      P.r(2, 22, 2, 1, "#e0603a");
      P.r(21, 22, 2, 1, "#e0603a");
      P.r(5, 25, 3, 2, "#3a3040");
      P.r(17, 25, 3, 2, "#3a3040");
      if (f === 0) {
        P.line(11, 18, 8, 22, shade(skin, 0.8), 2);
        P.line(13, 18, 16, 22, skin, 2);
        P.r(6, 21, 4, 2, shoes); P.r(15, 21, 4, 2, shoes);
      } else {
        P.line(11, 18, 5, 25, shade(skin, 0.8), 2);
        P.r(3, 25, 4, 2, shade(shoes, 0.8));
        P.line(13, 18, 15, 22, skin, 2);
        P.r(14, 21, 4, 2, shoes);
      }
      P.r(10, 16, 6, 3, pants);
      P.r(10, 9, 6, 7, shirt);
      P.line(11, 10, 6, 13, shade(skin, 0.8), 2);
      P.line(14, 10, 20, 12, skin, 2);
      head(P, 9, 1, look, false);
    }));
  }

  const KIDS = {
    haruto: { name: "ハルト", ride: "run", look: { skin: "#f6c8a0", hair: "#2a1a10", style: "spike", shirt: "#3a7ae8", stripe: "#ffffff", pants: "#2a2a5a", shoes: "#ffffff" }, color: "#3a7ae8" },
    mei: { name: "メイ", ride: "run", look: { skin: "#f8d0b0", hair: "#4a2a18", style: "pig", ribbon: "#ff4a6a", shirt: "#ffd23a", pants: "#e85a3a", shoes: "#ff8ac0" }, color: "#ffd23a" },
    sota: { name: "ソウタ", ride: "bike", bike: "#28b858", look: { skin: "#eebc90", hair: "#1a1410", style: "short", shirt: "#ffffff", stripe: "#28b858", pants: "#2a3a6a", shoes: "#3a3040" }, color: "#28b858" },
    riko: { name: "リコ", ride: "skate", look: { skin: "#f6c8a0", hair: "#6a3a1a", style: "pony", shirt: "#9a5ae8", pants: "#3a3a4a", shoes: "#ffffff" }, color: "#b07aff" },
  };
  const YUTA = { name: "ユウタ", look: { skin: "#f6c8a0", hair: "#2a1a10", style: "cap", cap: "#e8343a", shirt: "#ff9a2a", stripe: "#ffe070", pants: "#3a5ab0", shoes: "#ffffff" }, bike: "#3a8ae8" };

  function kidFrame(id, f) {
    const k = KIDS[id];
    if (k.ride === "bike") return cached(`kid|${id}|${f % 4}`, () => biker(k.look, k.bike, f % 4));
    if (k.ride === "skate") return cached(`kid|${id}|${f % 2}`, () => skater(k.look, f % 2));
    return cached(`kid|${id}|${f % 4}`, () => runner(k.look, "run", f % 4));
  }
  function kidStand(id) {
    return cached(`kidstand|${id}`, () => runner(KIDS[id].look, "stand", 0));
  }
  function yutaBike(f) { return cached(`yuta|bike|${f % 4}`, () => biker(YUTA.look, YUTA.bike, f % 4)); }
  function yutaStand(wave, f = 0) { return cached(`yuta|${wave ? "wave" : "stand"}|${f % 2}`, () => runner(YUTA.look, wave ? "wave" : "stand", f % 2)); }

  // ---------------------------------------------------------------- さかなやのおやじ
  // pose: run0-3 / windup / swing / stand / tired / dazed / bike0-3
  function fishman(pose, f = 0) {
    return outline(paint(48, 36, (P) => {
      const skin = "#e8a070";
      const back = shade(skin, 0.8);
      const ox = 8; // 網を後ろに振りかぶるときの余白
      const boot = "#2a2a34";
      const bob = pose === "run" && f % 2 ? -1 : 0;
      const sit = pose === "dazed";
      const bend = pose === "tired" ? 3 : 0;
      // 足 (長ぐつ)
      if (sit) {
        P.r(ox + 9, 31, 14, 3, boot);
      } else if (pose === "run") {
        const a = f % 2 === 0 ? [[ox + 13, 27], [ox + 18, 33], [ox + 10, 27], [ox + 6, 33]] : [[ox + 12, 27], [ox + 13, 33], [ox + 11, 27], [ox + 11, 31]];
        const order = f >= 2 ? [2, 0] : [0, 2];
        order.forEach((i, n) => {
          P.line(a[i][0], a[i][1] + bob, a[i + 1][0], a[i + 1][1] - 1, n ? boot : shade(boot, 0.7), 4);
        });
      } else {
        P.r(ox + 9, 27, 4, 7, shade(boot, 0.7));
        P.r(ox + 15, 27, 4, 7, boot);
        P.r(ox + 15, 32, 6, 2, boot);
      }
      const y0 = (sit ? 6 : 0) + bob + bend;
      // 体 (白シャツ + 紺の前かけ)
      P.ell(ox + 15, y0 + 20, 8, 8, "#f4f4f0");
      P.r(ox + 9, y0 + 17, 13, 12, "#2a3a6a");
      P.r(ox + 10, y0 + 16, 11, 1, "#2a3a6a");
      P.r(ox + 12, y0 + 19, 7, 3, "#3a5090");
      P.r(ox + 7, y0 + 13, 15, 4, "#f4f4f0");
      // 頭
      const hx = ox + 10 + (pose === "tired" ? 2 : 0);
      const hy = y0 + 2;
      P.r(hx + 1, hy, 10, 11, skin);
      P.r(hx, hy + 1, 12, 9, skin);
      P.r(hx + 1, hy - 1, 10, 2, "#2a1a14");
      P.r(hx, hy + 1, 12, 3, "#ffffff"); // はちまき
      P.r(hx - 4, hy + 1, 4, 2, "#ffffff");
      P.r(hx - 5, hy + 3, 3, 2, "#ffffff");
      P.r(hx + 8, hy + 5, 2, 1, "#2a1a14"); // まゆ
      if (pose === "dazed") {
        P.p(hx + 8, hy + 6, OUT); P.p(hx + 9, hy + 7, OUT); P.p(hx + 9, hy + 6, OUT); P.p(hx + 8, hy + 7, OUT);
      } else {
        P.r(hx + 9, hy + 6, 1, 2, OUT);
      }
      for (let i = 0; i < 4; i++) P.p(hx + 5 + i * 2, hy + 10, "#9a6a50"); // ひげ
      P.p(hx + 11, hy + 7, "#d07050");
      const shout = pose === "windup" || pose === "swing" || pose === "run" || pose === "bike";
      P.r(hx + 9, hy + 9, 3, shout ? 2 : 1, shout ? "#a02a2a" : "#7a3a2a");
      // うでと網
      const hand = pose === "windup" ? [ox + 6, y0 + 4] : pose === "swing" ? [ox + 27, y0 + 20] : pose === "tired" ? [ox + 20, y0 + 26] : [ox + 24, y0 + 15];
      P.line(ox + 18, y0 + 14, hand[0], hand[1], skin, 3);
      P.line(ox + 10, y0 + 15, ox + 8, y0 + 22, back, 3);
      let tip;
      if (pose === "windup") tip = [ox - 5, y0 + 3];
      else if (pose === "swing") tip = [ox + 38, y0 + 24];
      else if (pose === "tired") tip = [ox + 30, y0 + 32];
      else if (pose === "dazed") tip = null;
      else tip = [ox + 33, y0 + 2];
      if (tip) {
        P.line(hand[0], hand[1], tip[0], tip[1], "#a07040", 1);
        P.ell(tip[0], tip[1], 4.5, 4.5, "rgba(230,230,230,0.55)");
        P.ring(tip[0], tip[1], 4, "#e8e8e8");
        P.line(tip[0] - 3, tip[1], tip[0] + 3, tip[1], "#c8c8c8");
        P.line(tip[0], tip[1] - 3, tip[0], tip[1] + 3, "#c8c8c8");
      }
    }));
  }
  function fishFrame(pose, f = 0) { return cached(`fish|${pose}|${pose === "run" ? f % 4 : 0}`, () => fishman(pose, f % 4)); }

  // おやじのスクーター (ステージ 5)。体は fishFrame を上に重ねて描く
  function fishScooter(f) {
    return cached(`fishscoot|${f % 2}`, () => outline(paint(52, 16, (P) => {
      P.ell(10.5, 10.5, 4.5, 4.5, "#2a2a32");
      P.ell(40.5, 10.5, 4.5, 4.5, "#2a2a32");
      P.p(10 + (f % 2), 10, "#c8c8d0"); P.p(40 + (f % 2), 10, "#c8c8d0");
      P.r(8, 3, 30, 6, "#e85a3a");
      P.r(36, 0, 4, 8, "#e85a3a");
      P.r(4, 1, 10, 4, "#c8c8d0");
      P.r(1, 0, 4, 6, "#6a4a2a");
    })));
  }

  // ---------------------------------------------------------------- ねこ (左向き)
  const CAT_PAL = {
    tora: { fur: "#f0a040", dark: "#c0682a", belly: "#ffe8c8" },
    kuro: { fur: "#3a3448", dark: "#24202e", belly: "#5a5470" },
    mike: { fur: "#f4f0ea", dark: "#d88a40", belly: "#ffffff" },
  };
  function cat(kind, pose, f) {
    const c = CAT_PAL[kind];
    return outline(paint(22, 16, (P) => {
      const run = pose === "run";
      const by = pose === "pounce" ? 6 : 9;
      // しっぽ
      const tw = f % 2;
      if (pose === "sit") { P.line(15, 12, 19, 8 - tw, c.fur, 2); P.line(19, 8 - tw, 19, 4 - tw, c.fur, 2); }
      else P.line(16, by, 20, by - 4 + tw * 2, c.fur, 2);
      // 体
      if (pose === "sit") {
        P.ell(12, 10.5, 5, 4.5, c.fur);
        P.ell(10, 11.5, 2.5, 3, c.belly);
        P.r(8, 13, 2, 2, c.fur); P.r(12, 13, 2, 2, c.fur);
        P.r(14, 8, 1, 3, c.dark); P.r(16, 9, 1, 3, c.dark);
      } else {
        P.ell(12, by, 6, 3.5, c.fur);
        P.r(11, by - 3, 1, 3, c.dark); P.r(14, by - 3, 1, 3, c.dark);
        const legs = run ? (f % 2 ? [[6, 3], [9, 4], [14, 4], [17, 3]] : [[8, 4], [7, 3], [16, 3], [15, 4]]) : [[7, 3], [10, 3], [14, 3], [16, 3]];
        if (pose === "pounce") legs.splice(0, 4, [5, 2], [8, 2], [17, 3], [19, 3]);
        legs.forEach(([x, l], i) => P.r(x, by + 2, 2, l, i % 2 ? c.dark : c.fur));
      }
      // 頭
      const hx = pose === "sit" ? 3 : 1;
      const hy = pose === "sit" ? 3 : by - 6;
      P.r(hx, hy + 1, 7, 5, c.fur);
      P.r(hx + 1, hy, 5, 7, c.fur);
      P.r(hx, hy - 2, 2, 3, c.fur); P.r(hx + 5, hy - 2, 2, 3, c.fur);
      P.p(hx + 1, hy - 1, "#ff9ab0"); P.p(hx + 5, hy - 1, "#ff9ab0");
      P.r(hx + 1, hy + 2, 1, 2, OUT);
      P.r(hx + 4, hy + 2, 1, 2, OUT);
      P.p(hx + 2, hy + 4, "#ff6a8a");
      if (kind === "mike") { P.r(hx + 4, hy, 3, 2, c.dark); P.r(14, 7, 4, 3, "#3a3448"); }
    }));
  }
  function catFrame(kind, pose, f = 0) { return cached(`cat|${kind}|${pose}|${f % 2}`, () => cat(kind, pose, f % 2)); }

  // ---------------------------------------------------------------- さる (木の上・左向き)
  function monkey(pose, f) {
    return outline(paint(20, 20, (P) => {
      const fur = "#9a5a2a";
      const face = "#f4b49a";
      P.line(14, 14, 18, 18 - (f % 2), fur, 2); // しっぽ
      P.ell(11, 13, 5, 5, fur);
      P.ell(10, 14, 3, 3, face);
      P.r(7, 17, 3, 2, fur); P.r(12, 17, 3, 2, fur);
      // 頭
      P.ell(8, 6, 5, 5, fur);
      P.ell(3.5, 6, 1.8, 1.8, face);
      P.ell(13, 6, 1.8, 1.8, face);
      P.ell(8, 7, 3.5, 3, face);
      P.p(6, 6, OUT); P.p(9, 6, OUT);
      P.r(7, 9, 2, 1, pose === "eat" ? "#b0303a" : "#c06a5a");
      if (pose === "throw") {
        P.line(12, 10, 16, 2, fur, 2);
        P.ell(16, 1.5, 2.5, 1.5, "#ffe040");
      } else if (pose === "eat") {
        P.line(8, 12, 7, 10, fur, 2);
        P.ell(6, 10, 2.5, 1.5, "#ffe040");
      } else {
        P.line(12, 11, 14, 15, fur, 2);
        P.line(7, 11, 5, 15, fur, 2);
      }
    }));
  }
  function monkeyFrame(pose, f = 0) { return cached(`monkey|${pose}|${f % 2}`, () => monkey(pose, f % 2)); }

  // ---------------------------------------------------------------- 小物
  const banana = () => cached("banana", () => outline(paint(12, 8, (P) => {
    P.r(3, 3, 6, 3, "#ffe040");
    P.line(3, 4, 0, 6, "#ffe040", 2);
    P.line(8, 4, 11, 6, "#ffe040", 2);
    P.line(5, 3, 5, 0, "#ffe040", 2);
    P.r(4, 4, 4, 1, "#fff6a0");
    P.p(6, 2, "#6a4a1a");
  })));
  const bananaFly = () => cached("bananafly", () => outline(paint(10, 10, (P) => {
    P.line(2, 7, 7, 2, "#ffe040", 3);
    P.p(8, 1, "#6a4a1a");
    P.line(3, 6, 6, 3, "#fff6a0");
  })));
  const CANDY_COLORS = [["#ff7ab8", "#ffd0e8"], ["#ffe040", "#fff8b0"], ["#6ad8ff", "#d0f4ff"], ["#8ae86a", "#e0ffd0"]];
  const candy = (i) => cached(`candy|${i}`, () => outline(paint(9, 9, (P) => {
    const [c, l] = CANDY_COLORS[i % 4];
    P.ell(4.5, 4.5, 3, 3, c);
    P.p(4, 0, c); P.p(4, 8, c); P.p(0, 4, c); P.p(8, 4, c);
    P.p(1, 1, c); P.p(7, 1, c); P.p(1, 7, c); P.p(7, 7, c);
    P.r(3, 3, 2, 1, l);
  })));

  // アイテム (14x14)
  const ITEM_ICON = {
    ramune: () => outline(paint(14, 14, (P) => {
      P.r(5, 0, 4, 2, "#6ae0ff");
      P.r(4, 2, 6, 3, "#9af0ff");
      P.ell(7, 3.5, 1.5, 1.5, "#2a8ad8");
      P.r(5, 5, 4, 1, "#9af0ff");
      P.r(3, 6, 8, 8, "#9af0ff");
      P.r(4, 8, 6, 3, "#ffffff");
      P.r(5, 9, 4, 1, "#2a6ad8");
      P.r(4, 6, 1, 7, "#d8faff");
    })),
    kasa: () => outline(paint(14, 14, (P) => {
      P.ell(7, 5, 6.5, 4.5, "#e8343a");
      P.r(0, 5, 14, 3, "rgba(0,0,0,0)");
      P.g.clearRect(0, 6, 14, 8);
      P.line(1, 5, 13, 5, "#ffffff");
      P.line(7, 1, 7, 5, "#ffe070");
      P.line(7, 5, 7, 12, "#a07040");
      P.r(5, 12, 3, 1, "#a07040");
    })),
    niboshi: () => outline(paint(14, 14, (P) => {
      P.ell(6.5, 7, 5, 2.5, "#c0c8d8");
      P.r(3, 6, 7, 1, "#e8ecf8");
      P.line(11, 7, 13, 4, "#a0a8b8", 2);
      P.line(11, 7, 13, 10, "#a0a8b8", 2);
      P.p(3, 6, OUT);
      P.r(5, 8, 4, 1, "#8a92a8");
    })),
  };
  const itemIcon = (name) => cached(`item|${name}`, ITEM_ICON[name]);

  // UFO の円盤 (Super POPO Land と同じ形)
  function saucer(w, h, body, light, dark, frame) {
    return paint(w, h, (P) => {
      const cx = w / 2;
      const cy = h / 2 - 1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x + 0.5 - cx) / (w / 2 - 0.5);
          const dy = (y + 0.5 - cy) / (h / 2 - 1.5);
          const d = dx * dx + dy * dy;
          if (d > 1) continue;
          let col = y < cy - 1 ? light : y < cy + 2 ? body : dark;
          if (d > 0.8) col = OUT;
          P.p(x, y, col);
        }
      }
      const n = Math.max(3, Math.floor(w / 9));
      for (let i = 0; i < n; i++) {
        const x = Math.round(cx - ((n - 1) * 8) / 2 + i * 8) - 1;
        P.r(x, Math.round(cy), 2, 2, (i + frame) % 3 === 0 ? "#ffd23a" : (i + frame) % 3 === 1 ? "#ff69b4" : "#6af0ff");
      }
    });
  }
  const ship = (f) => cached(`ship|${f % 3}`, () => saucer(40, 14, "#a8b0c8", "#e8ecf8", "#6a7090", f % 3));

  // ---------------------------------------------------------------- 顔アイコン (会話用 24x24)
  function portrait(who) {
    return cached(`face|${who}`, () => {
      if (who === "popo") {
        const fr = popoFrame("idle");
        return paint(24, 24, (P, g) => { g.drawImage(fr, 4, 2, 24, 24, 0, 0, 24, 24); });
      }
      return outline(paint(24, 24, (P) => {
        if (who === "fish") {
          const skin = "#e8a070";
          P.ell(12, 13, 10, 10, skin);
          P.r(3, 3, 18, 3, "#2a1a14");
          P.r(2, 6, 20, 4, "#ffffff");
          P.r(0, 7, 3, 2, "#ffffff");
          P.r(7, 12, 3, 1, "#2a1a14"); P.r(15, 12, 3, 1, "#2a1a14");
          P.r(8, 14, 2, 2, OUT); P.r(15, 14, 2, 2, OUT);
          P.r(11, 16, 3, 2, "#d07050");
          P.r(9, 19, 7, 2, "#a02a2a");
          for (let i = 0; i < 6; i++) P.p(6 + i * 2 + (i % 2), 21, "#9a6a50");
          return;
        }
        const look = who === "yuta" ? YUTA.look : KIDS[who].look;
        P.ell(12, 13, 9, 9, look.skin);
        P.r(4, 3, 16, 5, look.hair);
        P.r(3, 6, 3, 8, look.hair);
        P.r(18, 6, 3, 6, look.hair);
        if (look.style === "cap") {
          P.r(3, 2, 18, 5, look.cap);
          P.r(5, 7, 16, 2, look.cap);
          P.r(10, 3, 3, 2, "#ffffff");
        }
        if (look.style === "pig") { P.r(0, 9, 3, 5, look.hair); P.r(21, 9, 3, 5, look.hair); }
        P.r(8, 12, 2, 3, OUT); P.r(15, 12, 2, 3, OUT);
        P.r(5, 16, 3, 2, "#ff9a9a"); P.r(17, 16, 3, 2, "#ff9a9a");
        P.r(10, 18, 5, 1, "#b0303a"); P.r(11, 19, 3, 1, "#b0303a");
      }));
    });
  }

  // ---------------------------------------------------------------- font (5x7, ASCII)
  const GLYPHS = {
    A: "01110100011000111111100011000110001", B: "11110100011000111110100011000111110",
    C: "01110100011000010000100001000101110", D: "11110100011000110001100011000111110",
    E: "11111100001000011110100001000011111", F: "11111100001000011110100001000010000",
    G: "01110100011000010111100011000101111", H: "10001100011000111111100011000110001",
    I: "01110001000010000100001000010001110", J: "00111000100001000010000101001001100",
    K: "10001100101010011000101001001010001", L: "10000100001000010000100001000011111",
    M: "10001110111010110101100011000110001", N: "10001100011100110101100111000110001",
    O: "01110100011000110001100011000101110", P: "11110100011000111110100001000010000",
    Q: "01110100011000110001101011001001101", R: "11110100011000111110101001001010001",
    S: "01111100001000001110000010000111110", T: "11111001000010000100001000010000100",
    U: "10001100011000110001100011000101110", V: "10001100011000110001100010101000100",
    W: "10001100011000110101101011010101010", X: "10001100010101000100010101000110001",
    Y: "10001100010101000100001000010000100", Z: "11111000010001000100010001000011111",
    0: "01110100011001110101110011000101110", 1: "00100011000010000100001000010001110",
    2: "01110100010000100010001000100011111", 3: "11111000100010000010000011000101110",
    4: "00010001100101010010111110001000010", 5: "11111100001111000001000011000101110",
    6: "00110010001000011110100011000101110", 7: "11111000010001000100010000100001000",
    8: "01110100011000101110100011000101110", 9: "01110100011000101111000010001001100",
    "-": "00000000000000011111000000000000000", "*": "00000000001000101010001000101010001",
    "!": "00100001000010000100001000000000100", ".": "00000000000000000000000000110001100",
    ":": "00000011000110000000011000110000000", "?": "01110100010000100010001000000000100",
    "/": "00001000010001000100010001000010000", "'": "00100001000100000000000000000000000",
    ",": "00000000000000000000011000010001000", "<": "00010001000100010000010000010000010",
    ">": "01000001000001000001000100010001000", "+": "00000001000010011111001000010000000",
    "(": "00010001000100001000010000010000010", ")": "01000001000001000010000100010001000",
    '"': "01010010100101000000000000000000000",
  };

  const fontCache = new Map();
  function glyphCanvas(ch, color) {
    const key = ch + color;
    if (fontCache.has(key)) return fontCache.get(key);
    const bits = GLYPHS[ch];
    const c = paint(5, 7, (P) => {
      if (!bits) return;
      for (let i = 0; i < 35; i++) if (bits[i] === "1") P.p(i % 5, Math.floor(i / 5), color);
    });
    fontCache.set(key, c);
    return c;
  }

  // ASCII のドット文字
  function drawText(ctx, text, x, y, color = "#fff", opts = {}) {
    const scale = opts.scale || 1;
    const str = String(text).toUpperCase();
    const width = str.length * 6 * scale - scale;
    let sx = x;
    if (opts.align === "center") sx = Math.round(x - width / 2);
    else if (opts.align === "right") sx = x - width;
    const drawRun = (col, ox, oy) => {
      for (let i = 0; i < str.length; i++) {
        const ch = str[i];
        if (ch === " ") continue;
        ctx.drawImage(glyphCanvas(ch, col), sx + i * 6 * scale + ox, y + oy, 5 * scale, 7 * scale);
      }
    };
    if (opts.outline) {
      for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) drawRun(opts.outline, ox * scale, oy * scale);
    } else if (opts.shadow) {
      drawRun(opts.shadow, scale, scale);
    }
    drawRun(color, 0, 0);
    return width;
  }

  // 日本語の文字 (ブラウザのフォントで描く)
  const JFONT = '"Hiragino Maru Gothic ProN", "Hiragino Kaku Gothic ProN", "BIZ UDPGothic", "Meiryo", "Noto Sans JP", "Noto Sans CJK JP", "IPAPGothic", "IPAGothic", sans-serif';
  function jtext(ctx, text, x, y, color = "#fff", opts = {}) {
    const size = opts.size || 8;
    ctx.save();
    ctx.font = `bold ${size}px ${JFONT}`;
    ctx.textAlign = opts.align || "left";
    ctx.textBaseline = "top";
    if (opts.outline) {
      ctx.lineJoin = "round";
      ctx.lineWidth = opts.outlineWidth || 2.5;
      ctx.strokeStyle = opts.outline;
      ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  }
  function jwidth(ctx, text, size = 8) {
    ctx.save();
    ctx.font = `bold ${size}px ${JFONT}`;
    const w = ctx.measureText(text).width;
    ctx.restore();
    return w;
  }

  // ---------------------------------------------------------------- POPO
  const POPO = window.POPO_SPRITES;
  function popoFrame(name, variantKey = "normal", override = null) {
    return cached(`popo|${name}|${variantKey}`, () => paint(POPO.size, POPO.size, (P) => {
      const pal = {};
      POPO.palette.forEach((col, i) => { pal[String(i)] = col; });
      if (override) Object.entries(override).forEach(([i, col]) => { pal[String(i)] = col; });
      const rows = POPO.frames[name];
      for (let y = 0; y < rows.length; y++) {
        for (let x = 0; x < POPO.size; x++) {
          const col = pal[rows[y][x]];
          if (col) P.p(x, y, col);
        }
      }
    }));
  }

  // ---------------------------------------------------------------- 背景
  // 各テーマ: 空の色 / 遠景 / 中景 / 歩道 / 道 / 手前 の組み合わせ
  const THEMES = {
    river: {
      sky: ["#58b4ff", "#6cc0ff", "#86ceff", "#a4dcff", "#c4ebff"],
      walk: ["#5cb84a", "#4aa03a", "#7ad05a"], road: ["#d0a878", "#c09868", "#e0bc90"], line: "rgba(255,255,255,0.45)",
      verge: ["#4aa03a", "#3a8a2e", "#68c050"], props: ["tree", "sign", "pole", "tree", "bench", "flower"],
    },
    town: {
      sky: ["#7ab8e8", "#8ac4ec", "#9ad0f0", "#acdcf4", "#c0e6f8"],
      walk: ["#c8c0b0", "#a8a090", "#e0d8c8"], road: ["#b86a5a", "#9a5848", "#c87a6a"], line: "rgba(255,240,220,0.5)",
      verge: ["#a8a090", "#888070", "#c8c0b0"], props: ["vending", "post", "nobori", "bicycle", "vending", "pole"],
    },
    forest: {
      sky: ["#80d0f0", "#90d8f0", "#a4e0f0", "#b8e8f0", "#cceff0"],
      walk: ["#3a9a40", "#2a7a30", "#5ab850"], road: ["#b08858", "#987448", "#c49a68"], line: "rgba(255,255,255,0.25)",
      verge: ["#2a8a30", "#1a6a24", "#4aa848"], props: ["bigtree", "lantern", "bigtree", "jizo", "bush"],
    },
    port: {
      sky: ["#ff8a5a", "#ff9a68", "#ffae78", "#ffc490", "#ffdcaa"],
      walk: ["#a8a8b0", "#88889a", "#c0c0c8"], road: ["#7a8090", "#68707e", "#8a90a0"], line: "rgba(255,255,255,0.5)",
      verge: ["#2a5aa0", "#1a4a88", "#4a7ac0"], props: ["bollard", "crate", "gullpost", "bollard", "netpile"], sea: true,
    },
    festival: {
      sky: ["#0a0a2a", "#10103a", "#181848", "#20205a", "#2a2a6a"],
      walk: ["#5a5a70", "#46465a", "#6a6a84"], road: ["#4a4a60", "#3e3e52", "#5a5a72"], line: "rgba(255,220,160,0.35)",
      verge: ["#46465a", "#363648", "#5a5a70"], props: ["lanternpost", "yataiflag", "lanternpost", "goldfish"], night: true,
    },
  };

  const BG_W = 512;

  function farLayer(name) {
    const R = rng(name.length * 977 + 13);
    return paint(BG_W, 120, (P, g) => {
      if (name === "river") {
        for (let x = 0; x < BG_W; x++) {
          const h = 30 + Math.sin(x / 40) * 10 + Math.sin(x / 13) * 4;
          P.r(x, 82 - h, 1, h + 10, "#94b8dc");
        }
        for (let i = 0; i < 26; i++) {
          const x = Math.floor(R() * BG_W);
          const w = 8 + Math.floor(R() * 14);
          const h = 8 + Math.floor(R() * 18);
          P.r(x, 84 - h, w, h, "#aac4e0");
          for (let wy = 84 - h + 3; wy < 82; wy += 4) for (let wx = x + 2; wx < x + w - 1; wx += 3) P.p(wx, wy, "#c8dcf0");
        }
      } else if (name === "town") {
        for (let i = 0; i < 20; i++) {
          const x = i * 26 + Math.floor(R() * 8);
          const h = 30 + Math.floor(R() * 34);
          P.r(x, 70 - h, 22, h, "#9ab0c8");
          for (let wy = 74 - h; wy < 66; wy += 6) for (let wx = x + 3; wx < x + 20; wx += 5) P.r(wx, wy, 2, 3, "#c4d4e4");
        }
      } else if (name === "forest") {
        for (let x = 0; x < BG_W; x++) {
          const h1 = 46 + Math.sin(x / 50) * 16 + Math.sin(x / 17) * 5;
          P.r(x, 92 - h1, 1, h1, "#6ab08a");
          const h2 = 26 + Math.sin(x / 31 + 2) * 10;
          P.r(x, 96 - h2, 1, h2, "#4a9a6a");
        }
      } else if (name === "port") {
        P.ell(300, 66, 18, 18, "#fff0a0");
        P.r(0, 70, BG_W, 50, "#3a6ab0");
        for (let y = 72; y < 120; y += 3) for (let i = 0; i < 18; i++) P.r(Math.floor(R() * BG_W), y, 4 + Math.floor(R() * 8), 1, "#5a8ad0");
        for (let y = 72; y < 100; y += 2) P.r(292 - (y - 72) / 3, y, 16 + (y - 72) / 1.5, 1, "#ffd88a");
        for (let x = 40; x < 140; x++) { const h = 10 * Math.sin(((x - 40) / 100) * Math.PI); P.r(x, 70 - h, 1, h, "#7a6a9a"); }
        // 遠くの船
        P.r(400, 62, 30, 6, "#4a4a6a"); P.r(410, 54, 10, 8, "#4a4a6a"); P.r(414, 48, 2, 6, "#4a4a6a");
        // とうだい
        P.r(200, 30, 8, 40, "#ffffff"); P.r(200, 40, 8, 5, "#e8343a"); P.r(200, 55, 8, 5, "#e8343a");
        P.r(198, 26, 12, 5, "#3a3a4a"); P.r(201, 22, 6, 4, "#ffe070");
      } else if (name === "festival") {
        for (let i = 0; i < 90; i++) P.p(Math.floor(R() * BG_W), Math.floor(R() * 60), R() < 0.3 ? "#ffffff" : "#8a8ac8");
        for (let x = 0; x < BG_W; x++) {
          const h = 34 + Math.sin(x / 60) * 12 + Math.sin(x / 19) * 4;
          P.r(x, 100 - h, 1, h, "#16163a");
        }
        // 五重の塔のシルエット
        const px = 360;
        for (let i = 0; i < 5; i++) {
          P.r(px - 14 + i * 2, 50 + i * 9, 28 - i * 4 + 0, 3, "#0a0a24");
          P.r(px - 8 + i, 53 + i * 9, 16 - i * 2, 6, "#0a0a24");
        }
        P.r(px - 1, 34, 2, 16, "#0a0a24");
        P.r(px - 12, 96, 24, 8, "#0a0a24");
      }
    });
  }

  function shopFront(P, x, w, awning, label, labelCol, wall) {
    P.r(x, 44, w, 68, wall);
    P.r(x, 44, w, 2, shade(wall, 0.8));
    for (let wy = 50; wy < 70; wy += 10) for (let wx = x + 4; wx < x + w - 8; wx += 12) { P.r(wx, wy, 8, 7, "#9ac8e8"); P.r(wx, wy, 8, 1, "#d8f0ff"); }
    P.r(x + 2, 74, w - 4, 12, "#fff6e0");
    P.r(x, 86, w, 6, awning);
    for (let i = 0; i < w; i += 8) P.r(x + i, 86, 4, 6, "#ffffff");
    for (let i = 0; i < w; i += 4) P.r(x + i, 92, 2, 1, awning);
    P.r(x + 2, 93, w - 4, 19, "#3a2a2a");
    P.r(x + 4, 95, w - 8, 15, "#5a4a40");
    P.g.save();
    P.g.font = `bold 9px ${JFONT}`;
    P.g.textAlign = "center";
    P.g.textBaseline = "middle";
    P.g.fillStyle = labelCol;
    P.g.fillText(label, x + w / 2, 80.5);
    P.g.restore();
  }

  function midLayer(name) {
    const R = rng(name.length * 331 + 7);
    return paint(BG_W, 120, (P, g) => {
      if (name === "river") {
        P.r(0, 78, BG_W, 8, "#6ac85a");
        for (let i = 0; i < 12; i++) {
          const x = Math.floor(R() * BG_W);
          P.r(x, 70, 10, 8, ["#f4e8d8", "#e8d8c8", "#d8e8f0"][i % 3]); P.r(x - 1, 67, 12, 3, ["#c84a3a", "#3a6ab0", "#5a5a6a"][i % 3]);
        }
        P.r(0, 86, BG_W, 16, "#3a8ad8");
        for (let i = 0; i < 40; i++) P.r(Math.floor(R() * BG_W), 88 + Math.floor(R() * 12), 6, 1, "#8ac8f8");
        // てっきょう
        const bx = 120;
        P.r(bx, 60, 200, 4, "#c84a3a");
        for (let i = 0; i <= 10; i++) { P.line(bx + i * 20, 60, bx + i * 20 + 10, 46, "#c84a3a", 2); P.line(bx + i * 20 + 10, 46, bx + i * 20 + 20, 60, "#c84a3a", 2); }
        P.r(bx, 45, 200, 2, "#c84a3a");
        for (const px of [bx + 40, bx + 100, bx + 160]) P.r(px, 64, 6, 24, "#a8a8b0");
        P.r(0, 102, BG_W, 18, "#5cb84a");
        for (let x = 0; x < BG_W; x += 3) P.p(x, 102 + (x % 2), "#7ad05a");
      } else if (name === "town") {
        const shops = [
          ["さかな", "#2a6ad8", "#ffffff"], ["やおや", "#3ab84a", "#1a5a1a"], ["パン", "#e8a03a", "#7a3a1a"],
          ["くすり", "#d83a3a", "#1a3a8a"], ["おもちゃ", "#9a5ae8", "#c82a6a"], ["たいやき", "#e85a3a", "#5a2a1a"],
        ];
        let x = 0;
        shops.forEach(([label, aw, col], i) => {
          const w = 80 + (i % 2) * 6;
          shopFront(P, x, w, aw, label, col, ["#f4e8d0", "#e8dcc8", "#f0e0e0", "#e0e8f0"][i % 4]);
          x += w + 1;
        });
        // アーケードの屋根
        P.r(0, 30, BG_W, 6, "#d8d0c0");
        for (let i = 0; i < BG_W; i += 16) P.r(i, 30, 2, 14, "#a8a090");
        for (let i = 0; i < BG_W; i += 64) { P.r(i + 30, 36, 6, 8, "#ff5a4a"); P.r(i + 31, 37, 4, 6, "#ffd23a"); }
      } else if (name === "forest") {
        for (let i = 0; i < 22; i++) {
          const x = i * 24 + Math.floor(R() * 10);
          const h = 50 + Math.floor(R() * 26);
          P.r(x + 8, 112 - h / 2, 5, h / 2, "#6a4a2a");
          P.ell(x + 10, 112 - h / 2 - 10, 16, 18, i % 2 ? "#2a8a3a" : "#3a9a48");
          P.ell(x + 6, 112 - h / 2 - 16, 8, 8, "#4aaa58");
        }
        // とりい
        const tx = 300;
        P.r(tx, 52, 4, 60, "#e8343a"); P.r(tx + 36, 52, 4, 60, "#e8343a");
        P.r(tx - 8, 46, 56, 5, "#2a2a2a"); P.r(tx - 6, 50, 52, 3, "#e8343a"); P.r(tx - 2, 60, 44, 3, "#e8343a");
        P.r(tx + 17, 53, 6, 7, "#2a2a2a");
      } else if (name === "port") {
        for (let i = 0; i < 4; i++) {
          const x = i * 128 + 8;
          P.r(x, 62, 96, 50, ["#c8a888", "#a8b8c8", "#c89888", "#b8c0a8"][i]);
          P.r(x - 4, 56, 104, 6, "#6a6a7a");
          P.r(x + 30, 80, 36, 32, "#5a5a6a");
          for (let y = 82; y < 112; y += 3) P.r(x + 30, y, 36, 1, "#4a4a5a");
          P.g.save(); P.g.font = `bold 9px ${JFONT}`; P.g.fillStyle = "#ffffff"; P.g.textAlign = "center"; P.g.textBaseline = "middle";
          P.g.fillText(["うおいちば", "そうこ", "れいとう", "あみ"][i], x + 48, 70); P.g.restore();
        }
        // クレーン
        P.r(470, 20, 4, 92, "#e8a03a"); P.r(430, 20, 70, 4, "#e8a03a"); P.line(440, 24, 440, 50, "#3a3a3a");
      } else if (name === "festival") {
        const stalls = [["たこやき", "#e8343a"], ["わたあめ", "#ff7ab8"], ["きんぎょ", "#3a8ae8"], ["やきそば", "#e8a03a"], ["かきごおり", "#3ab8a8"]];
        stalls.forEach(([label, col], i) => {
          const x = i * 102 + 6;
          P.r(x, 70, 90, 42, "#5a3a2a");
          P.r(x + 4, 86, 82, 22, "#ffd88a");
          P.r(x, 60, 90, 12, col);
          for (let j = 0; j < 90; j += 10) P.r(x + j, 60, 5, 12, "#ffffff");
          P.r(x + 10, 74, 70, 11, "#fff6e0");
          P.g.save(); P.g.font = `bold 9px ${JFONT}`; P.g.fillStyle = col; P.g.textAlign = "center"; P.g.textBaseline = "middle";
          P.g.fillText(label, x + 45, 80); P.g.restore();
          P.r(x + 2, 72, 2, 40, "#3a2a1a"); P.r(x + 86, 72, 2, 40, "#3a2a1a");
        });
        // ちょうちんのひも
        for (let x = 0; x < BG_W; x++) P.p(x, 40 + Math.round(Math.sin((x / BG_W) * Math.PI * 8) * 4), "#2a2a2a");
        for (let i = 0; i < BG_W; i += 32) {
          const y = 42 + Math.round(Math.sin((i / BG_W) * Math.PI * 8) * 4);
          P.ell(i + 4, y + 5, 4, 5, i % 64 ? "#ff6a3a" : "#ffffff");
          P.r(i + 1, y + 5, 7, 1, "#c03a2a");
          P.r(i + 2, y, 5, 1, "#2a2a2a"); P.r(i + 2, y + 10, 5, 1, "#2a2a2a");
        }
      }
    });
  }

  // 歩道 (y=108..130) / 道 (130..206) / 手前 (206..224) のくり返しタイル (幅 64)
  function stripTile(name, part) {
    const th = THEMES[name];
    const R = rng(name.length * 53 + part.length);
    const h = part === "walk" ? 22 : part === "road" ? 76 : 18;
    const [base, dark, light] = th[part];
    return paint(64, h, (P) => {
      P.r(0, 0, 64, h, base);
      if (part === "walk") {
        if (name === "town" || name === "port" || name === "festival") {
          for (let x = 0; x < 64; x += 16) P.r(x, 0, 1, h, dark);
          P.r(0, 10, 64, 1, dark);
        } else {
          for (let i = 0; i < 40; i++) P.p(Math.floor(R() * 64), Math.floor(R() * h), i % 2 ? dark : light);
          if (name === "river") for (let i = 0; i < 6; i++) { const x = Math.floor(R() * 64); const y = 4 + Math.floor(R() * 12); P.p(x, y, "#ffffff"); P.p(x + 1, y, "#ffe040"); }
        }
        P.r(0, h - 3, 64, 3, name === "forest" || name === "river" ? "#8a6a4a" : "#d8d8d8");
        P.r(0, h - 1, 64, 1, "#6a6a6a");
      } else if (part === "road") {
        if (name === "town") {
          for (let y = 0; y < h; y += 6) for (let x = (y / 6) % 2 ? 0 : 8; x < 64; x += 16) P.r(x, y, 1, 6, dark);
          for (let y = 0; y < h; y += 6) P.r(0, y, 64, 1, dark);
        } else if (name === "festival") {
          for (let y = 0; y < h; y += 10) for (let x = (y / 10) % 2 ? 0 : 10; x < 64; x += 20) P.r(x, y, 1, 10, dark);
          for (let y = 0; y < h; y += 10) P.r(0, y, 64, 1, dark);
        } else {
          for (let i = 0; i < 70; i++) P.p(Math.floor(R() * 64), Math.floor(R() * h), i % 2 ? dark : light);
        }
        P.r(0, h - 2, 64, 2, shade(base, 0.7));
      } else {
        if (th.sea) {
          for (let i = 0; i < 20; i++) P.r(Math.floor(R() * 64), 3 + Math.floor(R() * (h - 3)), 5, 1, light);
          P.r(0, 0, 64, 3, "#c0c0c8");
        } else {
          for (let i = 0; i < 40; i++) P.p(Math.floor(R() * 64), Math.floor(R() * h), i % 2 ? dark : light);
          P.r(0, 0, 64, 2, shade(base, 0.75));
        }
      }
    });
  }

  // 歩道に立つ小物 (下端が y=126)
  function prop(kind) {
    return cached(`prop|${kind}`, () => {
      switch (kind) {
        case "tree": return outline(paint(30, 46, (P) => {
          P.r(13, 26, 5, 20, "#7a5030");
          P.ell(15, 16, 13, 14, "#3a9a3a"); P.ell(11, 11, 6, 6, "#5ab850"); P.ell(20, 20, 6, 5, "#2a8a30");
        }));
        case "bigtree": return outline(paint(40, 70, (P) => {
          P.r(16, 30, 8, 40, "#6a4424"); P.line(24, 40, 34, 30, "#6a4424", 3);
          P.ell(20, 20, 18, 19, "#2a7a34"); P.ell(14, 14, 9, 8, "#3a9a44"); P.ell(28, 26, 8, 7, "#1e6a28");
        }));
        case "sign": return outline(paint(16, 34, (P, g) => {
          P.r(7, 14, 2, 20, "#c8c8d0");
          P.ell(8, 8, 7, 7, "#e8343a"); P.ell(8, 8, 5, 5, "#ffffff");
          P.r(6, 4, 3, 3, OUT); P.line(7, 7, 7, 11, OUT, 2); P.line(7, 11, 5, 13, OUT); P.line(7, 11, 10, 12, OUT);
        }));
        case "pole": return outline(paint(14, 80, (P) => {
          P.r(5, 0, 4, 80, "#9a9a9a"); P.r(0, 8, 14, 2, "#7a7a7a"); P.r(1, 6, 2, 2, "#d8d8d8"); P.r(11, 6, 2, 2, "#d8d8d8");
          P.r(4, 30, 6, 10, "#ffe040");
        }));
        case "bench": return outline(paint(24, 14, (P) => {
          P.r(0, 2, 24, 3, "#c87a3a"); P.r(0, 7, 24, 2, "#c87a3a"); P.r(2, 9, 2, 5, "#5a5a5a"); P.r(20, 9, 2, 5, "#5a5a5a");
        }));
        case "flower": return outline(paint(14, 10, (P) => {
          for (let i = 0; i < 4; i++) { P.r(1 + i * 3, 4, 1, 6, "#3a8a2a"); P.r(i * 3, 2, 3, 3, ["#ff6a9a", "#ffe040", "#ffffff", "#ff9a3a"][i]); }
        }));
        case "vending": return outline(paint(16, 30, (P) => {
          P.r(0, 0, 16, 30, "#e8343a"); P.r(2, 3, 12, 12, "#e8f4ff");
          for (let i = 0; i < 4; i++) { P.r(3 + i * 3, 5, 2, 4, ["#3a8ae8", "#ffe040", "#3ab84a", "#ff7a3a"][i]); P.r(3 + i * 3, 10, 2, 4, ["#ff7ab8", "#ffffff", "#9a5ae8", "#3a8ae8"][i]); }
          P.r(3, 18, 10, 2, "#2a2a2a"); P.r(3, 23, 10, 4, "#2a2a2a");
        }));
        case "post": return outline(paint(12, 26, (P) => {
          P.r(1, 0, 10, 20, "#e8343a"); P.r(1, 0, 10, 2, "#c8242a"); P.r(3, 5, 6, 1, OUT); P.r(4, 20, 4, 6, "#3a3a3a");
        }));
        case "nobori": return outline(paint(14, 50, (P, g) => {
          P.r(1, 0, 2, 50, "#a07040"); P.r(3, 2, 10, 34, "#3ab8e8"); P.r(3, 2, 10, 2, "#ffffff");
          g.save(); g.font = `bold 8px ${JFONT}`; g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "top";
          ["や", "す", "い"].forEach((ch, i) => g.fillText(ch, 8, 6 + i * 9)); g.restore();
        }));
        case "bicycle": return outline(paint(24, 16, (P) => {
          P.ring(5, 10, 4.5, "#3a3a3a"); P.ring(19, 10, 4.5, "#3a3a3a");
          P.line(5, 10, 11, 10, "#3a8ae8"); P.line(11, 10, 9, 4, "#3a8ae8"); P.line(9, 5, 17, 5, "#3a8ae8"); P.line(17, 4, 19, 10, "#3a8ae8"); P.line(11, 10, 17, 5, "#3a8ae8");
          P.r(15, 1, 2, 3, "#3a3a3a"); P.r(14, 1, 4, 1, "#3a3a3a"); P.r(7, 3, 4, 1, "#3a3a3a"); P.r(15, 3, 6, 3, "#c8c8c8");
        }));
        case "lantern": return outline(paint(16, 30, (P) => {
          P.r(2, 4, 12, 4, "#9a9a9a"); P.r(5, 0, 6, 4, "#9a9a9a"); P.r(4, 8, 8, 8, "#b8b8b8"); P.r(6, 10, 4, 4, "#ffe08a");
          P.r(2, 16, 12, 2, "#9a9a9a"); P.r(6, 18, 4, 9, "#a8a8a8"); P.r(3, 27, 10, 3, "#9a9a9a");
        }));
        case "jizo": return outline(paint(14, 22, (P) => {
          P.ell(7, 5, 4.5, 4.5, "#b8b8b0"); P.ell(7, 15, 6, 7, "#b8b8b0"); P.r(2, 10, 10, 4, "#e8343a"); P.p(5, 5, OUT); P.p(9, 5, OUT);
        }));
        case "bush": return outline(paint(26, 14, (P) => { P.ell(13, 8, 12, 6, "#2a8a30"); P.ell(8, 6, 5, 4, "#4aaa48"); P.ell(18, 7, 5, 4, "#3a9a3a"); }));
        case "bollard": return outline(paint(12, 14, (P) => { P.r(2, 4, 8, 10, "#3a3a44"); P.ell(6, 4, 5, 3, "#4a4a56"); P.r(3, 6, 6, 1, "#ffe040"); }));
        case "crate": return outline(paint(26, 20, (P, g) => {
          for (let i = 0; i < 2; i++) { P.r(0, 10 - i * 9, 26 - i * 4, 9, "#3a8ae8"); P.r(1, 11 - i * 9, 24 - i * 4, 2, "#8ac8f8"); }
          P.ell(8, 2, 4, 1.5, "#c0c8d8"); P.ell(15, 3, 4, 1.5, "#d8a0a0");
        }));
        case "gullpost": return outline(paint(16, 34, (P) => {
          P.r(6, 10, 4, 24, "#8a6a4a"); P.ell(8, 6, 5, 3, "#ffffff"); P.r(3, 4, 4, 3, "#ffffff"); P.p(4, 5, OUT); P.r(1, 5, 2, 1, "#ffb03a"); P.r(10, 5, 4, 2, "#8a8a98");
        }));
        case "netpile": return outline(paint(26, 12, (P) => {
          P.ell(13, 8, 12, 4.5, "#3a8a6a"); for (let x = 2; x < 25; x += 3) P.line(x, 4, x + 2, 12, "#2a6a4a"); P.ell(6, 6, 2, 2, "#ff8a3a"); P.ell(20, 7, 2, 2, "#ff8a3a");
        }));
        case "lanternpost": return paint(14, 50, (P) => {
          P.r(6, 14, 2, 36, "#3a2a1a"); P.r(2, 12, 10, 2, "#3a2a1a");
          P.ell(7, 6, 6, 7, "rgba(255,200,90,0.35)");
          P.ell(7, 6, 4, 5, "#ff6a3a"); P.r(3, 6, 8, 1, "#c03a2a"); P.r(4, 0, 6, 1, "#2a2a2a"); P.r(4, 11, 6, 1, "#2a2a2a");
          P.r(6, 3, 2, 3, "#ffe0a0");
        });
        case "yataiflag": return outline(paint(14, 46, (P, g) => {
          P.r(1, 0, 2, 46, "#a07040"); P.r(3, 2, 10, 30, "#e8343a");
          g.save(); g.font = `bold 8px ${JFONT}`; g.fillStyle = "#ffffff"; g.textAlign = "center"; g.textBaseline = "top";
          ["ま", "つ", "り"].forEach((ch, i) => g.fillText(ch, 8, 5 + i * 9)); g.restore();
        }));
        case "goldfish": return outline(paint(24, 14, (P) => {
          P.r(0, 2, 24, 12, "#3a8ae8"); P.r(2, 4, 20, 8, "#8ad8ff");
          P.ell(8, 7, 2.5, 1.5, "#ff5a2a"); P.ell(15, 9, 2.5, 1.5, "#ff5a2a"); P.ell(19, 6, 2, 1.2, "#ffffff");
        }));
        default: return paint(1, 1, () => {});
      }
    });
  }

  // さるの止まり木 (歩道の上の木)
  const perch = () => cached("perch", () => outline(paint(44, 74, (P) => {
    P.r(18, 30, 8, 44, "#6a4424");
    P.line(24, 34, 40, 28, "#6a4424", 4);
    P.ell(22, 18, 20, 17, "#2a7a34"); P.ell(12, 12, 8, 7, "#3a9a44"); P.ell(32, 22, 8, 7, "#1e6a28");
  })));

  // 魚屋の店先 (おやじが待っている所)
  const fishShop = () => cached("fishshop", () => outline(paint(56, 46, (P, g) => {
    P.r(0, 8, 56, 38, "#f4ecdc");
    P.r(0, 0, 56, 10, "#2a6ad8");
    for (let i = 0; i < 56; i += 8) P.r(i, 0, 4, 10, "#ffffff");
    g.save(); g.font = `bold 9px ${JFONT}`; g.fillStyle = "#2a6ad8"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText("うおまさ", 28, 16); g.restore();
    P.r(2, 24, 52, 4, "#a07040");
    P.r(4, 28, 48, 18, "#6a4a2a");
    for (let i = 0; i < 5; i++) { P.ell(10 + i * 9, 25, 4, 1.5, ["#c0c8d8", "#e89a8a", "#c0c8d8", "#f0b060", "#c0c8d8"][i]); }
  })));

  window.PopoArt = {
    OUT, THEMES, BG_W, KIDS, YUTA,
    paint, outline, flipped, shade, rng,
    drawText, jtext, jwidth, popoFrame,
    kidFrame, kidStand, yutaBike, yutaStand, fishFrame, fishScooter, catFrame, monkeyFrame,
    banana, bananaFly, candy, itemIcon, ship, portrait, prop, perch, fishShop,
    farLayer: (n) => cached(`far|${n}`, () => farLayer(n)),
    midLayer: (n) => cached(`mid|${n}`, () => midLayer(n)),
    strip: (n, part) => cached(`strip|${n}|${part}`, () => stripTile(n, part)),
  };
})();
