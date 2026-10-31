// Super POPO Racing 本体: レース・ライバル・じゃまもの・ユウタのサポート・ストーリー・メニュー
(() => {
  "use strict";

  const A = window.PopoArt;
  const Input = window.PopoInput;
  const Snd = window.PopoAudio;
  const { STAGES, ENDING, NAMES } = window.PopoStages;

  const W = 384;
  const H = 224;
  const OUT = A.OUTLINE || A.OUT;
  const LANES = [150, 172, 194];
  const WALK_Y = 108;
  const ROAD_Y = 130;
  const VERGE_Y = 206;
  const SIDE_Y = 125; // 歩道に立つ人の足元

  // ポポの速さ (px/秒。10px = 1m)
  const SPD = { normal: 200, brake: 110, dash: 262, pad: 290, turbo: 330 };
  const ITEM_NAMES = { ramune: "ラムネ ターボ！", kasa: "かさ バリア！", niboshi: "にぼし！" };

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  let K = 1;

  // ---------------------------------------------------------------- 入力 (テスト用のボットにも差し替えられる)
  let bot = null;
  const In = {
    held: (b) => (bot ? !!bot.held[b] : Input.held(b)),
    pressed: (b) => (bot ? !!bot.pressed[b] : Input.pressed(b)),
  };
  let tapped = false;
  const ok = () => In.pressed("jump") || In.pressed("start") || tapped;
  const back = () => In.pressed("run");

  // ---------------------------------------------------------------- セーブ
  const SAVE_KEY = "poporacing.save";
  function loadSave() {
    try {
      const s = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (s && typeof s.unlocked === "number") return { unlocked: Math.min(5, Math.max(1, s.unlocked)), best: s.best || {}, cleared: !!s.cleared };
    } catch (e) { /* storage unavailable */ }
    return { unlocked: 1, best: {}, cleared: false };
  }
  let save = loadSave();
  function writeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage unavailable */ }
  }

  // ---------------------------------------------------------------- 状態
  let mode = "title"; // title / select / story / race / result / ending / theend
  let modeT = 0;
  let frame = 0;
  let R = null; // レースの状態
  let story = null;
  let paused = null;
  let selCursor = 0;
  let resCursor = 0;
  let fireworks = [];
  let fwTimer = 0;

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const approach = (v, t, d) => (v < t ? Math.min(t, v + d) : Math.max(t, v - d));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const mod = (a, n) => ((a % n) + n) % n;

  function setMode(m) {
    mode = m;
    modeT = 0;
  }

  // ---------------------------------------------------------------- コース生成
  function genCourse(st) {
    const rnd = A.rng(st.id * 7919 + 3);
    const L = st.length;
    const objs = [];
    const hazards = [];
    Object.entries(st.hazards).forEach(([k, n]) => { for (let i = 0; i < n; i++) hazards.push(k); });
    for (let i = hazards.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [hazards[i], hazards[j]] = [hazards[j], hazards[i]];
    }
    const start = 900;
    const end = L - 700;
    const step = (end - start) / Math.max(1, hazards.length);
    const marks = [];
    hazards.forEach((k, i) => {
      const x = Math.round(start + step * (i + 0.2 + rnd() * 0.6));
      marks.push(x);
      if (k === "cat") {
        const side = rnd() < 0.5 ? -1 : 1;
        objs.push({ type: "cat", x, kind: ["tora", "kuro", "mike"][Math.floor(rnd() * 3)], side, y: side < 0 ? 121 : 214, state: "wait", f: 0, vy: 0, bubble: 0, smart: st.catSmart, re: false });
      } else if (k === "monkey") {
        objs.push({ type: "monkey", x, throws: 2 + (st.id >= 4 ? 1 : 0), cd: 0, state: "sit", pose: 0, f: rnd() * 10 });
      } else if (k === "fish") {
        objs.push({ type: "fish", x, home: x, y: SIDE_Y, state: "idle", t: 0, chaseT: 0, vx: 0, f: 0, max: st.fishSpeed, say: null, sayT: 0 });
      }
    });
    if (st.scooter) {
      const fishes = objs.filter((o) => o.type === "fish");
      if (fishes.length) { const f = fishes[fishes.length - 1]; f.scooter = true; f.max += 20; }
    }
    const placed = [];
    const freeAt = (x, gap) => marks.every((m) => Math.abs(m - x) > 150) && placed.every((p) => Math.abs(p - x) > gap);
    const placeSome = (n, make) => {
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 30; tries++) {
          const x = Math.round(500 + rnd() * (L - 900));
          if (!freeAt(x, 110)) continue;
          placed.push(x);
          objs.push(make(x));
          break;
        }
      }
    };
    placeSome(st.puddle, (x) => { const lane = Math.floor(rnd() * 3); return { type: "puddle", x, lane, y: LANES[lane], w: 30 + Math.floor(rnd() * 3) * 6, splashT: 0 }; });
    placeSome(st.pad, (x) => { const lane = Math.floor(rnd() * 3); return { type: "pad", x, lane, y: LANES[lane], used: 0 }; });
    // こんぺいとう: まっすぐ / ジグザグ
    for (let i = 0; i < st.candy; i++) {
      const x0 = Math.round(400 + rnd() * (L - 700));
      const zig = rnd() < 0.4;
      let lane = Math.floor(rnd() * 3);
      for (let j = 0; j < 5; j++) {
        if (zig && j > 0 && j % 2 === 0) lane = clamp(lane + (rnd() < 0.5 ? -1 : 1), 0, 2);
        objs.push({ type: "candy", x: x0 + j * 22, y: LANES[lane], lane, c: (i + j) % 4, got: false });
      }
    }
    // 背景の小物
    const props = [];
    const kinds = A.THEMES[st.theme].props;
    for (let x = 60; x < L + 600; x += 70 + Math.floor(rnd() * 130)) {
      if (objs.some((o) => (o.type === "monkey" || o.type === "fish") && Math.abs(o.x - x) < 70)) continue;
      props.push({ x, kind: kinds[Math.floor(rnd() * kinds.length)] });
    }
    objs.sort((a, b) => a.x - b.x);
    return { objs, props };
  }

  // ---------------------------------------------------------------- レース開始
  function startRace(si) {
    const st = STAGES[si];
    const { objs, props } = genCourse(st);
    const starts = { mei: [-26, 0], riko: [-26, 2], haruto: [26, 0], sota: [26, 2] };
    R = {
      si, st, L: st.length, t: 0, phase: "count", count: 5.2, goT: 0, cam: -150,
      P: {
        x: 0, y: LANES[1], lane: 1, z: 0, vz: 0, speed: 0, spinT: 0, capt: null, shield: false,
        turboT: 0, boostT: 0, dash: 40, item: null, roll: 0, rollShow: 0, bumpCd: 0, invT: 0,
        finished: false, finishTime: 0, dashing: false, hits: 0, lastLeader: false,
      },
      kids: Object.keys(starts).map((id) => ({
        id, x: starts[id][0], lane: starts[id][1], y: LANES[starts[id][1]], speed: 0, base: st.kids[id],
        laneT: 2 + Math.random() * 3, anim: 0, phase: Math.random() * 6, finished: false, finishTime: 0,
        hop: 0, say: null, sayT: 0, tauntCd: 3, ahead: starts[id][0] > 0,
      })),
      objs, props, proj: [], fx: [],
      yuta: null, yutaIdx: 0, yutaMarks: [0.24, 0.5, 0.76].map((f) => Math.round(f * st.length)),
      call: null, lastPlaceT: 0, callCd: 0, tips: {}, score: 0, candies: 0,
      chasing: 0, goalT: 0, finalRank: 0, leadCalled: false,
    };
    paused = null;
    Snd.stopMusic();
    setMode("race");
  }

  function standings() {
    const P = R.P;
    const all = [{ id: "popo", x: P.x, fin: P.finished, ft: P.finishTime }].concat(R.kids.map((k) => ({ id: k.id, x: k.x, fin: k.finished, ft: k.finishTime })));
    all.sort((a, b) => {
      if (a.fin && b.fin) return a.ft - b.ft;
      if (a.fin) return -1;
      if (b.fin) return 1;
      return b.x - a.x;
    });
    return all;
  }

  // ---------------------------------------------------------------- 演出
  function fxText(text, x, y, col = "#ffffff", dur = 1.1, size = 9) {
    R.fx.push({ kind: "text", text, x, y, col, t: 0, dur, size });
  }
  function burst(x, y, cols, n = 10, sp = 80, up = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = sp * (0.4 + Math.random() * 0.6);
      R.fx.push({ kind: "dot", x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - up, t: 0, dur: 0.5 + Math.random() * 0.4, col: pick(cols), g: 260 });
    }
  }
  function callYuta(text, dur = 2.4, force = false) {
    if (R.call && R.call.t > 0.6 && !force) return false;
    R.call = { text, t: dur, dur };
    Snd.play("call");
    return true;
  }
  function tipOnce(key, text) {
    if (R.tips[key]) return;
    R.tips[key] = true;
    callYuta(text, 2.4, true);
  }
  function say(o, text, dur = 1.6) {
    o.say = text;
    o.sayT = dur;
  }

  // ---------------------------------------------------------------- ポポ
  function hazardHit(src) {
    const P = R.P;
    if (P.turboT > 0) {
      burst(P.x, P.y - 14, ["#ffffff", "#ffe070"], 8);
      Snd.play("block");
      return "turbo";
    }
    if (P.shield) {
      P.shield = false;
      P.invT = 0.8;
      fxText("ガード！", P.x, P.y - 44, "#ffe070");
      burst(P.x, P.y - 20, ["#ffe070", "#ffffff", "#e8343a"], 12);
      Snd.play("block");
      return "shield";
    }
    P.spinT = 0.85;
    P.speed *= 0.5;
    P.hits++;
    P.invT = 1.1;
    Snd.play("spin");
    burst(P.x, P.y - 24, ["#ffe070", "#ffffff"], 6, 50);
    return "hit";
  }

  function changeLane(d) {
    const P = R.P;
    const n = clamp(P.lane + d, 0, 2);
    if (n !== P.lane) P.lane = n;
  }

  function giveItem() {
    const P = R.P;
    if (P.item || P.roll > 0) {
      P.dash = 100;
      fxText("パワー まんたん！", P.x, P.y - 46, "#ffe070");
      Snd.play("powerup");
      return;
    }
    P.roll = 1.0;
  }

  function rollResult() {
    const rank = R.rank || 3;
    const w = rank >= 4 ? { ramune: 5, kasa: 2, niboshi: 3 } : rank === 3 ? { ramune: 3, kasa: 3, niboshi: 3 } : { ramune: 2, kasa: 4, niboshi: 4 };
    let total = 0;
    Object.values(w).forEach((v) => { total += v; });
    let r = Math.random() * total;
    for (const [k, v] of Object.entries(w)) {
      r -= v;
      if (r < 0) return k;
    }
    return "ramune";
  }

  function useItem() {
    const P = R.P;
    if (!P.item || P.roll > 0) return;
    const it = P.item;
    P.item = null;
    fxText(ITEM_NAMES[it], P.x, P.y - 46, "#ffffff");
    if (it === "ramune") {
      P.turboT = 2.8;
      Snd.play("turbo");
    } else if (it === "kasa") {
      P.shield = true;
      Snd.play("powerup");
    } else {
      Snd.play("item");
      R.proj.push({ type: "niboshi", x: P.x, y: P.y - 20, vx: P.speed + 220, vy: -120, t: 0 });
      for (const o of R.objs) {
        if (o.x < P.x - 160 || o.x > P.x + 720) continue;
        if (o.type === "cat" && o.state !== "leave" && o.state !== "eat") {
          o.state = "eat";
          o.vy = o.y < 172 ? -90 : 90;
          o.bubble = 0;
        } else if (o.type === "monkey" && o.state !== "eat") {
          o.state = "eat";
          o.throws = 0;
        } else if (o.type === "fish" && o.state !== "dazed" && o.state !== "eat" && o.state !== "hold") {
          if (o.chasing) stopChase(o);
          o.state = "eat";
          o.t = 0;
          say(o, "おっ！ いい にぼし！", 2);
        }
      }
    }
  }

  function updatePopo(dt) {
    const P = R.P;
    P.bumpCd -= dt;
    P.invT -= dt;
    P.turboT -= dt;
    P.boostT -= dt;
    let target = 0;
    P.dashing = false;
    if (R.phase === "count") {
      target = 0;
    } else if (P.finished) {
      target = 80;
    } else if (P.capt) {
      const c = P.capt;
      c.t += dt;
      c.shake -= dt;
      for (const b of ["jump", "run", "up", "down", "left", "right"]) {
        if (In.pressed(b)) { c.n++; c.shake = 0.08; Snd.play("mash"); }
      }
      if (c.t > 1.2 && !c.helped) {
        c.helped = true;
        c.need = Math.max(c.n + 2, c.need - 3);
        callYuta("おじさん！ ポポは タコじゃ ないよー！", 2.4, true);
      }
      if (c.n >= c.need || c.t > 5) escapeNet();
      P.speed = 0;
    } else if (P.spinT > 0) {
      P.spinT -= dt;
      target = 60;
    } else {
      if (In.pressed("up")) changeLane(-1);
      if (In.pressed("down")) changeLane(1);
      if (In.pressed("jump") && P.z <= 0 && P.vz <= 0) { P.vz = 185; Snd.play("jump"); }
      if (In.pressed("run")) useItem();
      target = SPD.normal;
      if (In.held("left")) target = SPD.brake;
      if (In.held("right") && P.dash > 0) {
        P.dashing = true;
        P.dash = Math.max(0, P.dash - 34 * dt);
        target = SPD.dash;
      }
      if (P.boostT > 0) target = Math.max(target, SPD.pad);
      if (P.turboT > 0) target = SPD.turbo;
    }
    if (!P.capt) {
      if (P.speed < target) P.speed = Math.min(target, P.speed + (P.turboT > 0 ? 400 : 170) * dt);
      else P.speed = Math.max(target, P.speed - (P.spinT > 0 ? 170 : 150) * dt);
    }
    P.x += P.speed * dt;
    P.y = approach(P.y, LANES[P.lane], 170 * dt);
    if (P.z > 0 || P.vz > 0) {
      P.vz -= 640 * dt;
      P.z += P.vz * dt;
      if (P.z <= 0) { P.z = 0; P.vz = 0; Snd.play("land"); }
    }
    // アイテムのルーレット
    if (P.roll > 0) {
      const before = Math.floor(P.roll * 12);
      P.roll -= dt;
      if (Math.floor(P.roll * 12) !== before) Snd.play("roll");
      if (P.roll <= 0) {
        P.roll = 0;
        P.item = rollResult();
        Snd.play("item");
      }
    }
    // スピード線
    if ((P.dashing || P.turboT > 0 || P.boostT > 0) && frame % 2 === 0) {
      R.fx.push({ kind: "line", x: P.x - 24, y: P.y - 8 - Math.random() * 22 - P.z, t: 0, dur: 0.25, col: P.turboT > 0 ? pick(["#ff69b4", "#ffe070", "#6af0ff"]) : "#ffffff" });
    }
    // ゴール
    if (!P.finished && P.x >= R.L) {
      P.finished = true;
      P.finishTime = R.t;
      P.capt = null;
      R.finalRank = R.kids.filter((k) => k.finished).length + 1;
      R.phase = "goal";
      R.goalT = 0;
      Snd.stopMusic();
      Snd.play("goal");
      burst(P.x, P.y - 30, ["#ff69b4", "#ffe070", "#6af0ff", "#ffffff"], 30, 140, 60);
    }
  }

  function escapeNet() {
    const P = R.P;
    const f = P.capt.by;
    P.capt = null;
    P.invT = 1.6;
    P.vz = 150;
    P.speed = 120;
    Snd.play("escape");
    burst(P.x, P.y - 26, ["#ffffff", "#e8e8e8"], 14, 120);
    if (f) {
      if (f.chasing) stopChase(f);
      f.state = "dazed";
      f.t = 0;
      say(f, "あれ？ タコじゃ ない…？", 2.2);
    }
    fxText("ポポ〜！", P.x, P.y - 48, "#ff9ad0");
  }

  // ---------------------------------------------------------------- ライバル
  const TAUNT_PASS = ["おさきに〜！", "まけないぞ！", "へへーん！", "ポポ おそーい！"];
  const TAUNT_PASSED = ["はやっ！", "まってー！", "うちゅうせん ずるい〜！", "くやしい〜！"];

  function updateKids(dt) {
    const P = R.P;
    for (const k of R.kids) {
      k.sayT -= dt;
      k.tauntCd -= dt;
      if (k.hop > 0) k.hop -= dt;
      if (R.phase === "count") continue;
      let target;
      if (k.finished) target = 40;
      else {
        // おいつき補正: ポポと はなれすぎない (ゴール前は よわめる)
        const fade = k.x > R.L * 0.85 ? 0.35 : 1;
        const rb = 1 + clamp((P.x - k.x) / 1800, -0.03, 0.13) * fade;
        target = k.base * rb * (1 + 0.035 * Math.sin(R.t * 0.6 + k.phase));
      }
      k.speed = approach(k.speed, target, 140 * dt);
      k.x += k.speed * dt;
      k.anim += k.speed * dt;
      k.laneT -= dt;
      if (k.laneT <= 0 && !k.finished) {
        k.laneT = 2 + Math.random() * 3.5;
        const opts = [k.lane - 1, k.lane + 1].filter((l) => l >= 0 && l <= 2 && !R.kids.some((o) => o !== k && o.lane === l && Math.abs(o.x - k.x) < 34));
        if (opts.length) k.lane = pick(opts);
      }
      k.y = approach(k.y, LANES[k.lane], 55 * dt);
      if (!k.finished && k.x >= R.L) { k.finished = true; k.finishTime = R.t; }
      // ポポとぶつかる
      if (!P.finished && !P.capt && P.bumpCd <= 0 && P.z < 10 && Math.abs(k.y - P.y) < 9 && Math.abs(k.x - P.x) < 15) {
        P.bumpCd = 0.7;
        if (P.turboT > 0) {
          k.hop = 0.45;
          say(k, "わわっ！", 1);
          Snd.play("bump");
        } else {
          P.speed *= 0.7;
          if (P.x < k.x) P.x -= 2;
          say(k, "わっ！", 1);
          Snd.play("bump");
        }
      }
      // ぬいた・ぬかれた
      const ahead = k.x > P.x;
      if (R.phase === "race" && !P.finished && !P.capt && ahead !== k.ahead && k.tauntCd <= 0 && Math.abs(k.x - R.cam - W / 2) < W / 2) {
        if (ahead) say(k, pick(TAUNT_PASS), 1.4);
        else if (Math.random() < 0.6) say(k, pick(TAUNT_PASSED), 1.4);
        k.tauntCd = 7 + Math.random() * 4;
      }
      k.ahead = ahead;
    }
  }

  // ---------------------------------------------------------------- じゃまもの
  function startChase(o) {
    if (o.chasing) return;
    o.chasing = true;
    R.chasing++;
    if (R.chasing === 1 && R.phase === "race") Snd.playMusic("chase");
  }
  function stopChase(o) {
    if (!o.chasing) return;
    o.chasing = false;
    R.chasing = Math.max(0, R.chasing - 1);
    if (R.chasing === 0 && R.phase === "race") Snd.playMusic(R.st.music);
  }

  function updateObjs(dt) {
    const P = R.P;
    const racing = R.phase === "race" && !P.finished;
    const canHit = racing && !P.capt && P.invT <= 0;
    for (const o of R.objs) {
      if (o.dead) continue;
      if (o.x < R.cam - 260 && o.type !== "fish") continue;
      if (o.x > R.cam + W + 320) break;
      const dx = o.x - P.x;
      switch (o.type) {
        case "candy":
          if (!o.got && Math.abs(dx) < 9 && Math.abs(o.y - P.y) < 10 && P.z < 24 && !P.finished) {
            o.got = true;
            P.dash = Math.min(100, P.dash + 9);
            R.score += 50;
            R.candies++;
            Snd.play("coin");
            burst(o.x, o.y - 14, ["#ffffff", "#ffe070"], 4, 50);
          }
          break;
        case "puddle":
          if (Math.abs(dx) < o.w / 2 && Math.abs(o.y - P.y) < 8 && P.z < 3 && !P.finished && P.turboT <= 0) {
            P.speed *= 1 - 1.5 * dt;
            o.splashT -= dt;
            if (o.splashT <= 0) {
              o.splashT = 0.12;
              burst(P.x - 8, o.y - 2, ["#8ac8f8", "#ffffff"], 3, 50, 70);
            }
            if (!o.hit) { o.hit = true; Snd.play("splash"); }
          }
          break;
        case "pad":
          o.used -= dt;
          if (Math.abs(dx) < 15 && Math.abs(o.y - P.y) < 9 && P.z < 6 && o.used <= 0 && !P.finished) {
            o.used = 1;
            P.boostT = 1.2;
            Snd.play("boost");
          }
          break;
        case "peel":
          if (o.slide) {
            o.x += o.slide * dt;
            o.slideT -= dt;
            if (o.slideT <= 0) o.dead = true;
          } else if (canHit && Math.abs(dx) < 9 && Math.abs(o.y - P.y) < 8 && P.z < 6) {
            hazardHit(o);
            o.slide = 160;
            o.slideT = 0.5;
          }
          break;
        case "cat": updateCat(o, dx, dt, racing, canHit); break;
        case "monkey": updateMonkey(o, dx, dt, racing); break;
        case "fish": updateFish(o, dt, racing); break;
        default: break;
      }
    }
  }

  function updateCat(o, dx, dt, racing, canHit) {
    const P = R.P;
    o.f += dt;
    o.bubble -= dt;
    if (o.state === "wait") {
      if (racing && dx < 175 && dx > 10) {
        o.state = "move";
        o.ty = LANES[P.lane];
        o.bubble = 0.9;
        Snd.play("meow");
        tipOnce("cat", "ねこが くるよ！ レーンを かえて！");
      }
    } else if (o.state === "move") {
      if (o.smart && !o.re && dx < 95 && racing) {
        o.re = true;
        o.ty = LANES[P.lane];
        o.bubble = 0.6;
      }
      o.y = approach(o.y, o.ty, 135 * dt);
      if (o.y === o.ty) o.state = "ready";
    }
    if (o.state === "move" || o.state === "ready") {
      if (dx < -34 || !racing) {
        o.state = "leave";
        o.vy = o.y < 172 ? -130 : 130;
      } else if (canHit && Math.abs(dx) < 13 && Math.abs(o.y - P.y) < 9 && P.z < 14) {
        hazardHit(o);
        Snd.play("meow");
        o.state = "leave";
        o.vy = o.y < 172 ? -170 : 170;
      }
    }
    if (o.state === "leave" || o.state === "eat") {
      o.y += o.vy * dt;
      if (o.state === "eat") o.x += 90 * dt;
      if (o.y < 96 || o.y > 240) o.dead = true;
    }
  }

  function updateMonkey(o, dx, dt, racing) {
    const P = R.P;
    o.f += dt;
    o.cd -= dt;
    o.pose -= dt;
    if (o.state === "sit" && racing && o.throws > 0 && dx < 290 && dx > -30 && o.cd <= 0) {
      o.throws--;
      o.cd = 1.25;
      o.pose = 0.35;
      const tx = P.x + P.speed * 0.95 + 34;
      R.proj.push({ type: "banana", x0: o.x, y0: 72, x1: tx, y1: LANES[P.lane], t: 0, dur: 0.95 });
      Snd.play("throw");
      if (Math.random() < 0.5) Snd.play("kiki");
      tipOnce("monkey", "バナナが とんでくる！ かげを よけて！");
    }
  }

  function updateFish(o, dt, racing) {
    const P = R.P;
    o.t += dt;
    o.sayT -= dt;
    const dx = P.x - o.x;
    switch (o.state) {
      case "idle":
        if (racing && P.x > o.x - 60) {
          o.state = "shout";
          o.t = 0;
          say(o, "タコだー！ まてー！", 1.8);
          Snd.play("shout");
          startChase(o);
          tipOnce("fish", "にげて ポポ！ →で ダッシュだ！");
        }
        break;
      case "shout":
        if (o.t > 0.45) { o.state = "chase"; o.t = 0; o.chaseT = 7; o.vx = P.speed * 0.6; }
        break;
      case "chase": {
        o.chaseT -= dt;
        const desired = dx > 28 ? Math.min(o.max, P.speed + 70) : P.speed + 12;
        o.vx = approach(o.vx, desired, 320 * dt);
        o.y = approach(o.y, clamp(P.y, LANES[0], LANES[2]), 80 * dt);
        if (racing && dx > 0 && dx < 30 && Math.abs(o.y - P.y) < 12 && !P.capt && P.invT <= 0) {
          o.state = "windup";
          o.t = 0;
        }
        if (o.chaseT <= 0 || !racing) {
          o.state = "tired";
          o.t = 0;
          say(o, "はぁ… はぁ…", 2);
          stopChase(o);
        }
        break;
      }
      case "windup":
        o.vx = P.speed + 6;
        o.y = approach(o.y, clamp(P.y, LANES[0], LANES[2]), 60 * dt);
        if (o.t > 0.38) { o.state = "swing"; o.t = 0; Snd.play("net"); say(o, "えいっ！", 0.6); }
        break;
      case "swing":
        o.vx = P.speed * 0.9;
        if (o.t < 0.12 && racing && !P.capt && P.invT <= 0) {
          const ddx = P.x - o.x;
          if (ddx > -4 && ddx < 42 && Math.abs(o.y - P.y) < 13 && P.z < 15) {
            const res = hazardHit(o);
            if (res === "hit") {
              P.spinT = 0;
              P.capt = { need: 10, n: 0, t: 0, by: o, helped: false, shake: 0 };
              P.speed = 0;
              o.state = "hold";
              o.t = 0;
              say(o, "でっかい タコ つかまえたぞー！", 3);
              break;
            }
            if (o.chasing) stopChase(o);
            o.state = "dazed";
            o.t = 0;
            say(o, "うわっ！", 1.2);
            break;
          }
        }
        if (o.t > 0.2) { o.state = "recover"; o.t = 0; }
        break;
      case "recover":
        o.vx = P.speed * 0.55;
        if (o.t > 0.7) {
          o.state = o.chaseT > 0 ? "chase" : "tired";
          o.t = 0;
          if (o.state === "tired") stopChase(o);
        }
        break;
      case "hold":
        o.vx = 0;
        o.x = P.x - 26;
        o.y = P.y;
        if (!P.capt) { o.state = "dazed"; if (o.chasing) stopChase(o); }
        break;
      default:
        o.vx = Math.max(0, o.vx - 260 * dt);
        break;
    }
    o.x += o.vx * dt;
    o.f += o.vx * dt;
  }

  // ---------------------------------------------------------------- とびもの
  function updateProj(dt) {
    const P = R.P;
    for (const p of R.proj) {
      p.t += dt;
      if (p.type === "banana") {
        if (p.t >= p.dur) {
          p.dead = true;
          R.objs.push({ type: "peel", x: p.x1, y: p.y1 });
          R.objs.sort((a, b) => a.x - b.x);
        }
      } else if (p.type === "gift") {
        if (p.t >= p.dur) {
          p.dead = true;
          if (!P.finished) giveItem();
        }
      } else if (p.type === "niboshi") {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
        if (p.t > 1.2) p.dead = true;
      }
    }
    R.proj = R.proj.filter((p) => !p.dead);
  }

  // ---------------------------------------------------------------- ユウタ
  const YUTA_LINES = ["ポポ！ これ つかって！", "おまたせ！ はい アイテム！", "がんばれ ポポ！ うけとって！"];

  function updateYuta(dt) {
    const P = R.P;
    if (!R.yuta && R.phase === "race" && !P.finished && R.yutaIdx < R.yutaMarks.length && P.x >= R.yutaMarks[R.yutaIdx]) {
      R.yutaIdx++;
      R.yuta = { x: R.cam - 40, y: SIDE_Y, speed: P.speed + 150, state: "come", t: 0, f: 0, say: null, sayT: 0 };
    }
    const y = R.yuta;
    if (!y) return;
    y.t += dt;
    y.sayT -= dt;
    if (y.state === "come") {
      y.speed = P.speed + 150;
      if (y.x >= P.x - 8) {
        y.state = "ride";
        y.t = 0;
        say(y, pick(YUTA_LINES), 1.6);
        R.proj.push({ type: "gift", x0: y.x + 6, y0: y.y - 26, t: 0, dur: 0.55 });
        Snd.play("throw");
      }
    } else if (y.state === "ride") {
      y.speed = P.speed;
      if (y.t > 1.6) y.state = "leave";
    } else {
      y.speed = Math.max(0, y.speed - 220 * dt);
      if (y.x < R.cam - 60) R.yuta = null;
    }
    y.x += y.speed * dt;
    y.f += y.speed * dt;
  }

  // ---------------------------------------------------------------- レース全体
  function updateRace(dt) {
    const P = R.P;
    if (R.phase === "count") {
      const prev = Math.ceil(R.count);
      R.count -= dt;
      const now = Math.ceil(R.count);
      if (now !== prev && now >= 1 && now <= 3) Snd.play("count");
      if (R.count <= 0) {
        R.phase = "race";
        R.goT = 1;
        Snd.play("go");
        Snd.playMusic(R.st.music);
        callYuta("いけー！ ポポー！", 1.8, true);
      }
    } else {
      R.t += dt;
    }
    R.goT -= dt;
    updatePopo(dt);
    updateKids(dt);
    updateObjs(dt);
    updateProj(dt);
    updateYuta(dt);
    // 順位
    const order = standings();
    R.rank = order.findIndex((e) => e.id === "popo") + 1;
    if (R.phase === "race") {
      R.callCd -= dt;
      if (R.call) { R.call.t -= dt; if (R.call.t <= 0) R.call = null; }
      if (R.rank === 5) R.lastPlaceT += dt; else R.lastPlaceT = 0;
      if (R.lastPlaceT > 6 && R.callCd <= 0 && R.t > 8) {
        if (callYuta("まけるな ポポ！ パワー あげる！", 2.4, true)) {
          P.dash = Math.min(100, P.dash + 45);
          R.callCd = 22;
          R.lastPlaceT = 0;
        }
      }
      if (R.rank === 1 && !R.leadCalled && R.t > 4) {
        R.leadCalled = true;
        callYuta("1いだ！ すごいよ ポポ！", 2);
      }
    } else if (R.call) {
      R.call.t -= dt;
      if (R.call.t <= 0) R.call = null;
    }
    // 演出
    for (const f of R.fx) {
      f.t += dt;
      if (f.kind === "dot") { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += f.g * dt; }
      if (f.kind === "text") f.y -= 18 * dt;
    }
    R.fx = R.fx.filter((f) => f.t < f.dur);
    // カメラ
    const target = P.x - 150 + clamp((P.speed - 200) * 0.35, -20, 40);
    R.cam = R.phase === "count" ? P.x - 150 : R.cam + (target - R.cam) * Math.min(1, dt * 5);
    // ゴール後
    if (R.phase === "goal") {
      R.goalT += dt;
      if (R.goalT > 3.4) finishRace();
    }
    // ポーズ
    if (In.pressed("start") && R.phase !== "goal") {
      paused = { cursor: 0 };
      Snd.play("pause");
      Snd.stopMusic();
    }
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    const c = Math.floor((t * 100) % 100);
    return `${m}:${String(s).padStart(2, "0")}.${String(c).padStart(2, "0")}`;
  }

  function finishRace() {
    const P = R.P;
    const rows = [{ id: "popo", time: P.finishTime }].concat(R.kids.map((k) => ({
      id: k.id,
      time: k.finished ? k.finishTime : R.t + (R.L - k.x) / Math.max(120, k.base),
    })));
    rows.sort((a, b) => a.time - b.time);
    const rank = rows.findIndex((r) => r.id === "popo") + 1;
    const rankBonus = [5000, 3000, 2000, 1000, 500][rank - 1];
    const par = (R.L / SPD.normal) * 1.12;
    const timeBonus = Math.max(0, Math.round((par - P.finishTime) * 100));
    const total = R.score + rankBonus + timeBonus;
    const clear = rank <= R.st.clearRank;
    R.result = { rows, rank, rankBonus, timeBonus, candy: R.score, total, clear, isNew: false };
    const key = String(R.st.id);
    const prev = save.best[key];
    if (!prev || rank < prev.rank || (rank === prev.rank && total > prev.score)) {
      save.best[key] = { rank, time: Math.round(P.finishTime * 100) / 100, score: total };
      R.result.isNew = true;
    }
    if (clear) {
      save.unlocked = Math.max(save.unlocked, Math.min(5, R.si + 2));
      if (R.si === STAGES.length - 1) save.cleared = true;
    }
    writeSave();
    resCursor = 0;
    Snd.play(clear ? "win" : "lose");
    setMode("result");
  }

  // ---------------------------------------------------------------- 背景・花火
  function drawSky(theme) {
    const T = A.THEMES[theme];
    const bh = 22;
    T.sky.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, i * bh, W, bh + 1); });
    ctx.fillStyle = T.sky[T.sky.length - 1];
    ctx.fillRect(0, bh * T.sky.length, W, ROAD_Y - bh * T.sky.length);
    if (T.night) drawFireworks();
  }

  function updateFireworks(dt, on) {
    fwTimer -= dt;
    if (on && fwTimer <= 0) {
      fwTimer = 0.7 + Math.random() * 1.1;
      const x = 30 + Math.random() * (W - 60);
      const y = 18 + Math.random() * 36;
      const col = pick(["#ff6a9a", "#ffe070", "#6af0ff", "#9aff7a", "#ffffff", "#ffa040"]);
      const n = 26;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const v = 34 + Math.random() * 10;
        fireworks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, dur: 1.3, col });
      }
      if (mode !== "race" || Math.random() < 0.5) Snd.play("firework");
    }
    for (const f of fireworks) { f.t += dt; f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 22 * dt; f.vx *= 1 - dt; }
    fireworks = fireworks.filter((f) => f.t < f.dur);
  }
  function drawFireworks() {
    for (const f of fireworks) {
      if (f.t > f.dur * 0.7 && frame % 2) continue;
      ctx.fillStyle = f.col;
      ctx.fillRect(Math.round(f.x), Math.round(f.y), 2, 2);
    }
  }

  function drawWorld(theme, cam) {
    const T = A.THEMES[theme];
    drawSky(theme);
    const far = A.farLayer(theme);
    const mid = A.midLayer(theme);
    let off = -mod(Math.round(cam * 0.12), A.BG_W);
    for (let x = off; x < W; x += A.BG_W) ctx.drawImage(far, x, 0);
    off = -mod(Math.round(cam * 0.45), A.BG_W);
    for (let x = off; x < W; x += A.BG_W) ctx.drawImage(mid, x, 0);
    const c = Math.round(cam);
    const walk = A.strip(theme, "walk");
    const road = A.strip(theme, "road");
    const verge = A.strip(theme, "verge");
    for (let x = -mod(c, 64); x < W; x += 64) {
      ctx.drawImage(walk, x, WALK_Y);
      ctx.drawImage(road, x, ROAD_Y);
      ctx.drawImage(verge, x, VERGE_Y);
    }
    // レーンの線
    ctx.fillStyle = T.line;
    for (const ly of [161, 183]) {
      for (let x = -mod(c, 32); x < W; x += 32) ctx.fillRect(x, ly, 14, 1);
    }
  }

  // ---------------------------------------------------------------- スプライト
  const puddleSprite = (w) => A.paint(w, 10, (P) => {
    P.ell(w / 2, 5, w / 2, 4.5, "#4a8ad8");
    P.ell(w / 2, 4.5, w / 2 - 2, 3, "#6aaaf0");
    P.r(w / 2 - 6, 3, 5, 1, "#d8f0ff");
    P.r(w / 2 + 3, 5, 3, 1, "#d8f0ff");
  });
  const puddleCache = new Map();
  const padSprite = [0, 1].map((f) => A.paint(30, 12, (P) => {
    P.r(0, 0, 30, 12, "#2a2a3a");
    P.r(1, 1, 28, 10, "#3a3a5a");
    for (let i = 0; i < 3; i++) {
      const x = 4 + i * 8;
      const col = (i + f) % 2 ? "#ffe040" : "#ff9a3a";
      P.line(x, 2, x + 4, 6, col, 2);
      P.line(x + 4, 6, x, 10, col, 2);
    }
  }));
  const shadowSprite = A.paint(28, 6, (P) => P.ell(14, 3, 14, 3, "rgba(0,0,0,0.28)"));
  const netOver = A.paint(46, 40, (P) => {
    for (let y = 0; y < 40; y++) {
      for (let x = 0; x < 46; x++) {
        const dx = (x + 0.5 - 23) / 22;
        const dy = (y + 0.5 - 22) / 20;
        const d = dx * dx + dy * dy;
        if (d > 1 || y > 34) continue;
        if (d > 0.86) P.p(x, y, "#f4f4f4");
        else if ((x + y) % 7 === 0 || (x - y + 140) % 7 === 0) P.p(x, y, "rgba(240,240,240,0.7)");
      }
    }
    P.r(2, 34, 42, 2, "#e0e0e0");
  });
  const giftSprite = A.outline(A.paint(12, 12, (P) => {
    P.r(1, 3, 10, 8, "#ff5a8a");
    P.r(0, 2, 12, 3, "#ff7aa8");
    P.r(5, 2, 2, 9, "#ffe070");
    P.r(3, 0, 2, 2, "#ffe070");
    P.r(7, 0, 2, 2, "#ffe070");
  }));
  const RAINBOW = ["#ff69b4", "#ffb040", "#ffe14a", "#6af06a", "#6ad8ff", "#b07aff"];

  function drawShip(x, gy, z, o = {}) {
    const bob = o.still ? 0 : Math.round(Math.sin(frame / 9));
    const by = Math.round(gy - 14 - z + bob);
    const sx = Math.round(x + (o.shake ? (frame % 2 ? 1 : -1) : 0));
    // かげ
    const sw = Math.max(10, Math.round(28 - z * 0.35));
    ctx.drawImage(shadowSprite, Math.round(x - sw / 2), Math.round(gy - 3), sw, 6);
    ctx.save();
    if (o.spin) {
      ctx.translate(sx, by);
      ctx.rotate(Math.sin(o.spin * 24) * 0.35);
      ctx.translate(-sx, -by);
    }
    // ドーム
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = "#9af0ff";
    ctx.beginPath();
    ctx.ellipse(sx, by - 2, 15, 17, 0, Math.PI, 0);
    ctx.fill();
    ctx.globalAlpha = 1;
    // ポポ
    let look = o.look || "idle";
    let pal = null;
    let key = "normal";
    if (o.turbo) { const i = Math.floor(frame / 3) % RAINBOW.length; pal = { 0: RAINBOW[i], 2: A.shade(RAINBOW[i], 0.8) }; key = "rb" + i; }
    else if (o.shield) { pal = { 4: "#ffd23a" }; key = "shield"; }
    ctx.drawImage(A.popoFrame(look, key, pal), 0, 0, 32, 19, sx - 16, by - 20, 32, 19);
    // 円盤
    ctx.drawImage(A.ship(Math.floor(frame / 8)), sx - 20, by - 6);
    // ふんしゃ
    const fl = o.flame || 0;
    ctx.fillStyle = frame % 4 < 2 ? "#6af0ff" : "#ffffff";
    ctx.fillRect(sx - 3, by + 7, 6, 2);
    if (fl > 0) {
      const len = 4 + fl * 6 + (frame % 3);
      ctx.fillStyle = o.turbo ? RAINBOW[frame % RAINBOW.length] : "#ffb040";
      ctx.fillRect(sx - 20 - len, by, len, 3);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(sx - 20 - Math.floor(len / 2), by + 1, Math.floor(len / 2), 1);
    }
    ctx.restore();
    if (o.shield) {
      ctx.globalAlpha = 0.22 + 0.1 * Math.sin(frame / 6);
      ctx.fillStyle = "#ffe878";
      ctx.beginPath();
      ctx.ellipse(sx, by - 6, 26, 20, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.drawImage(A.itemIcon("kasa"), sx - 7, by - 36);
    }
    return by;
  }

  function bubble(text, x, y, opts = {}) {
    const size = opts.size || 8;
    const tw = Math.ceil(A.jwidth(ctx, text, size));
    const w = tw + 8;
    const h = size + 6;
    let bx = Math.round(x - w / 2);
    bx = clamp(bx, 2, W - w - 2);
    const by = Math.round(y - h - 4);
    ctx.fillStyle = OUT;
    ctx.fillRect(bx - 1, by, w + 2, h);
    ctx.fillRect(bx, by - 1, w, h + 2);
    ctx.fillStyle = opts.bg || "#ffffff";
    ctx.fillRect(bx, by, w, h);
    const tx = clamp(Math.round(x), bx + 3, bx + w - 4);
    ctx.fillStyle = OUT;
    ctx.fillRect(tx - 2, by + h, 5, 1);
    ctx.fillRect(tx - 1, by + h + 1, 3, 1);
    ctx.fillRect(tx, by + h + 2, 1, 1);
    ctx.fillStyle = opts.bg || "#ffffff";
    ctx.fillRect(tx - 1, by + h - 1, 3, 1);
    ctx.fillRect(tx, by + h, 1, 1);
    A.jtext(ctx, text, bx + 4, by + 3, opts.col || "#18141c", { size });
  }

  // ---------------------------------------------------------------- レース描画
  function drawRace() {
    const P = R.P;
    const cam = Math.round(R.cam);
    const sx = (x) => Math.round(x - cam);
    drawWorld(R.st.theme, R.cam);

    // 歩道の小物・木の上のさる・魚屋の店
    for (const p of R.props) {
      const x = sx(p.x);
      if (x < -60 || x > W + 60) continue;
      const img = A.prop(p.kind);
      ctx.drawImage(img, x - Math.floor(img.width / 2), 126 - img.height);
    }
    for (const o of R.objs) {
      if (o.type === "monkey") {
        const x = sx(o.x);
        if (x < -80 || x > W + 80) continue;
        ctx.drawImage(A.perch(), x - 38, 126 - 74);
        const pose = o.state === "eat" ? "eat" : o.pose > 0 ? "throw" : "sit";
        ctx.drawImage(A.monkeyFrame(pose, Math.floor(o.f * 3)), x - 10, 64);
        if (o.state === "eat" && frame % 40 < 20) A.jtext(ctx, "もぐもぐ", x - 14, 52, "#ffffff", { size: 7, outline: OUT });
      } else if (o.type === "fish") {
        const x = sx(o.home);
        if (x < -80 || x > W + 80) continue;
        ctx.drawImage(A.fishShop(), x - 50, 126 - 46);
      }
    }

    // スタートで旗をふるユウタ
    const yx = sx(70);
    if (yx > -30 && yx < W + 30) {
      const img = A.yutaStand(true, R.phase === "count" ? Math.floor(frame / 12) : Math.floor(frame / 6));
      ctx.drawImage(img, yx - 12, SIDE_Y - img.height + 1);
      const fx = yx + (Math.floor(frame / (R.phase === "count" ? 12 : 6)) % 2 ? 5 : 3);
      ctx.fillStyle = "#e8e8f0";
      ctx.fillRect(fx, SIDE_Y - 38, 1, 12);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        ctx.fillStyle = (i + j) % 2 ? "#18141c" : "#ffffff";
        ctx.fillRect(fx + 1 + i * 3, SIDE_Y - 38 + j * 3, 3, 3);
      }
    }

    // スタートとゴールの線
    const drawCheck = (wx) => {
      const x = sx(wx);
      if (x < -20 || x > W + 20) return;
      for (let y = ROAD_Y; y < VERGE_Y; y += 4) {
        for (let i = 0; i < 2; i++) {
          ctx.fillStyle = ((y - ROAD_Y) / 4 + i) % 2 ? "#ffffff" : "#18141c";
          ctx.fillRect(x + i * 4, y, 4, 4);
        }
      }
    };
    drawCheck(40);
    drawCheck(R.L);
    const gx = sx(R.L);
    if (gx > -80 && gx < W + 80) {
      ctx.fillStyle = "#e8e8f0";
      ctx.fillRect(gx + 2, 50, 3, 76);
      ctx.fillStyle = "#e8343a";
      ctx.fillRect(gx - 26, 40, 56, 16);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(gx - 25, 41, 54, 1);
      A.drawText(ctx, "GOAL", gx + 3, 45, "#ffffff", { align: "center", shadow: "#7a1a1a" });
    }

    // 地面のもの
    for (const o of R.objs) {
      if (o.dead) continue;
      const x = sx(o.x);
      if (x < -40 || x > W + 40) continue;
      if (o.type === "puddle") {
        if (!puddleCache.has(o.w)) puddleCache.set(o.w, puddleSprite(o.w));
        ctx.drawImage(puddleCache.get(o.w), x - o.w / 2, o.y - 6);
      } else if (o.type === "pad") {
        ctx.drawImage(padSprite[Math.floor(frame / 6) % 2], x - 15, o.y - 7);
      } else if (o.type === "peel") {
        ctx.drawImage(A.banana(), x - 6, o.y - 7);
      }
    }
    // バナナの落下地点
    for (const p of R.proj) {
      if (p.type !== "banana") continue;
      if (frame % 8 < 5) {
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        const r = 4 + Math.round(p.t * 6);
        ctx.fillRect(sx(p.x1) - r, p.y1 - 2, r * 2, 3);
      }
    }

    // y 順に並べて描く
    const list = [];
    for (const o of R.objs) {
      if (o.dead) continue;
      const x = sx(o.x);
      if (x < -60 || x > W + 60) continue;
      if (o.type === "candy" && !o.got) list.push({ y: o.y - 1, d: () => ctx.drawImage(A.candy(o.c), x - 4, o.y - 16 + Math.round(Math.sin(frame / 8 + o.x) * 1.5)) });
      if (o.type === "cat") list.push({ y: o.y, d: () => drawCat(o, x) });
      if (o.type === "fish") list.push({ y: o.y, d: () => drawFish(o, x) });
    }
    for (const k of R.kids) {
      const x = sx(k.x);
      if (x < -40 || x > W + 40) continue;
      list.push({ y: k.y, d: () => drawKid(k, x) });
    }
    if (R.yuta) {
      const y = R.yuta;
      list.push({ y: y.y, d: () => {
        const img = A.yutaBike(Math.floor(y.f / 9));
        ctx.drawImage(img, sx(y.x) - 16, y.y - img.height + 1);
      } });
    }
    list.push({ y: P.y + 0.5, d: () => drawPopo(sx(P.x)) });
    list.sort((a, b) => a.y - b.y);
    list.forEach((e) => e.d());

    // ゴールの手前の柱
    if (gx > -20 && gx < W + 20) {
      ctx.fillStyle = "#e8e8f0";
      ctx.fillRect(gx + 2, 150, 3, 66);
      ctx.fillStyle = "#18141c";
      ctx.fillRect(gx + 1, 214, 5, 2);
    }

    // とびもの
    for (const p of R.proj) {
      if (p.type === "banana") {
        const k = p.t / p.dur;
        const x = p.x0 + (p.x1 - p.x0) * k;
        const y = p.y0 + (p.y1 - 8 - p.y0) * k - Math.sin(k * Math.PI) * 50;
        ctx.drawImage(A.bananaFly(), sx(x) - 5, Math.round(y) - 5);
      } else if (p.type === "gift") {
        const k = Math.min(1, p.t / p.dur);
        const tx = P.x;
        const ty = P.y - 30 - P.z;
        const x = p.x0 + (tx - p.x0) * k;
        const y = p.y0 + (ty - p.y0) * k - Math.sin(k * Math.PI) * 30;
        ctx.drawImage(giftSprite, sx(x) - 6, Math.round(y) - 6);
      } else if (p.type === "niboshi") {
        ctx.drawImage(A.itemIcon("niboshi"), sx(p.x) - 7, Math.round(p.y) - 7);
      }
    }

    // 吹き出し
    for (const k of R.kids) if (k.sayT > 0) bubble(k.say, sx(k.x), k.y - 30);
    for (const o of R.objs) {
      if (o.type === "fish" && o.sayT > 0 && !o.dead) bubble(o.say, sx(o.x) + 4, o.y - 36, { bg: "#fff0d8" });
      if (o.type === "cat" && o.bubble > 0) A.drawText(ctx, "!", sx(o.x), o.y - 24, "#ffe040", { outline: OUT, scale: 2 });
      if (o.type === "fish" && o.state === "windup") A.drawText(ctx, "!", sx(o.x) - 22, o.y - 40, "#ff4a4a", { outline: OUT, scale: 2 });
    }
    if (R.yuta && R.yuta.sayT > 0) bubble(R.yuta.say, sx(R.yuta.x), R.yuta.y - 32, { bg: "#e8f4ff" });

    // パーティクル・文字
    for (const f of R.fx) {
      const x = sx(f.x);
      if (f.kind === "dot") {
        ctx.fillStyle = f.col;
        ctx.fillRect(x, Math.round(f.y), 2, 2);
      } else if (f.kind === "line") {
        ctx.globalAlpha = 1 - f.t / f.dur;
        ctx.fillStyle = f.col;
        ctx.fillRect(x - 18 - Math.round(f.t * 60), Math.round(f.y), 14, 1);
        ctx.globalAlpha = 1;
      } else if (f.kind === "text") {
        A.jtext(ctx, f.text, x, Math.round(f.y), f.col, { size: f.size, align: "center", outline: OUT });
      }
    }
    drawHud();
  }

  function drawKid(k, x) {
    const info = A.KIDS[k.id];
    let img;
    if (R && R.phase === "count" && info.ride === "run") img = A.kidStand(k.id);
    else if (info.ride === "bike") img = A.kidFrame(k.id, Math.floor(k.anim / 10));
    else if (info.ride === "skate") img = A.kidFrame(k.id, Math.floor(k.anim / 45));
    else img = A.kidFrame(k.id, Math.floor(k.anim / 11));
    const hop = k.hop > 0 ? Math.round(Math.sin((k.hop / 0.45) * Math.PI) * 10) : 0;
    ctx.drawImage(img, x - Math.floor(img.width / 2), Math.round(k.y) - img.height + 1 - hop);
  }

  function drawCat(o, x) {
    const pose = o.state === "wait" ? "sit" : o.state === "ready" ? "pounce" : "run";
    let img = A.catFrame(o.kind, pose, Math.floor(o.f * 8));
    if (o.state === "eat") img = A.flipped(A.catFrame(o.kind, "run", Math.floor(o.f * 8)));
    ctx.drawImage(img, x - 11, Math.round(o.y) - 15);
  }

  function drawFish(o, x) {
    let pose = "stand";
    if (o.state === "chase" || o.state === "recover") pose = "run";
    else if (o.state === "windup") pose = "windup";
    else if (o.state === "swing" || o.state === "hold") pose = "swing";
    else if (o.state === "tired") pose = "tired";
    else if (o.state === "dazed") pose = "dazed";
    const y = Math.round(o.y);
    if (o.scooter && pose !== "dazed" && pose !== "tired") {
      ctx.drawImage(A.fishScooter(Math.floor(o.f / 8)), x - 30, y - 15);
      ctx.drawImage(A.fishFrame(pose === "run" ? "stand" : pose), 0, 0, 48, 28, x - 24, y - 40, 48, 28);
    } else {
      ctx.drawImage(A.fishFrame(pose, Math.floor(o.f / 12)), x - 24, y - 35);
    }
    if (o.state === "dazed" && frame % 30 < 20) {
      for (let i = 0; i < 3; i++) {
        const a = frame / 10 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "#ffe040";
        ctx.fillRect(x - 4 + Math.round(Math.cos(a) * 8), y - 34 + Math.round(Math.sin(a) * 3), 2, 2);
      }
    }
  }

  function drawPopo(x) {
    const P = R.P;
    if (P.invT > 0 && !P.capt && P.spinT <= 0 && frame % 4 < 2) {
      // 無敵中の点滅 (かげだけ描く)
      ctx.drawImage(shadowSprite, x - 14, Math.round(P.y) - 3);
      return;
    }
    let look = "idle";
    if (P.capt) look = "crouch";
    else if (P.z > 2) look = "jump";
    else if (P.spinT > 0) look = ["idle", "walk_left1", "idle", "walk_right1"][Math.floor(frame / 4) % 4];
    else if (P.dashing || P.turboT > 0 || P.boostT > 0) look = "walk_right1";
    const flame = P.turboT > 0 ? 2 : P.dashing || P.boostT > 0 ? 1 : 0;
    const by = drawShip(x, P.y, P.z, { look, turbo: P.turboT > 0, shield: P.shield, spin: P.spinT > 0 ? P.spinT : 0, shake: P.capt && P.capt.shake > 0, flame });
    if (P.spinT > 0) {
      for (let i = 0; i < 3; i++) {
        const a = frame / 6 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = "#ffe040";
        ctx.fillRect(x + Math.round(Math.cos(a) * 12), by - 26 + Math.round(Math.sin(a) * 3), 2, 2);
      }
    }
    if (P.capt) ctx.drawImage(netOver, x - 23, by - 30);
  }

  function drawHud() {
    const P = R.P;
    ctx.fillStyle = "rgba(14,10,36,0.6)";
    ctx.fillRect(0, 0, W, 18);
    // 順位
    const rk = R.phase === "goal" ? R.finalRank : R.rank || 5;
    const rcol = ["#ffd23a", "#d8e0f0", "#ffa860", "#ffffff", "#ffffff"][rk - 1];
    A.drawText(ctx, String(rk), 5, 2, rcol, { scale: 2, shadow: OUT });
    A.drawText(ctx, ["ST", "ND", "RD", "TH", "TH"][rk - 1], 17, 2, rcol, { shadow: OUT });
    A.drawText(ctx, "/5", 18, 10, "#b8a8d8");
    // 進み具合
    const bx = 44;
    const bw = 236;
    ctx.fillStyle = "#3a2a60";
    ctx.fillRect(bx, 8, bw, 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(bx + bw, 3, 1, 11);
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i % 2 ? "#18141c" : "#ffffff"; ctx.fillRect(bx + bw + 1, 3 + i * 3, 3, 3); }
    R.yutaMarks.forEach((m, i) => {
      if (i < R.yutaIdx) return;
      ctx.drawImage(giftSprite, 0, 0, 12, 12, bx + Math.round((m / R.L) * bw) - 3, 5, 7, 7);
    });
    const mark = (x, col, big) => {
      const px = bx + Math.round(clamp(x / R.L, 0, 1) * bw);
      ctx.fillStyle = OUT;
      ctx.fillRect(px - (big ? 3 : 2), big ? 3 : 5, big ? 7 : 5, big ? 11 : 7);
      ctx.fillStyle = col;
      ctx.fillRect(px - (big ? 2 : 1), big ? 4 : 6, big ? 5 : 3, big ? 9 : 5);
    };
    for (const k of R.kids) mark(k.x, A.KIDS[k.id].color, false);
    mark(P.x, "#ff69b4", true);
    // タイム
    A.drawText(ctx, fmtTime(P.finished ? P.finishTime : R.t), W - 5, 5, "#ffffff", { align: "right", shadow: OUT });

    // 下: パワー・のこり距離・アイテム
    ctx.fillStyle = "rgba(14,10,36,0.55)";
    ctx.fillRect(3, 207, 90, 15);
    A.drawText(ctx, "POWER", 6, 211, P.dashing && frame % 6 < 3 ? "#ffffff" : "#ffe070");
    ctx.fillStyle = OUT;
    ctx.fillRect(38, 210, 52, 9);
    ctx.fillStyle = "#3a2a60";
    ctx.fillRect(39, 211, 50, 7);
    const pw = Math.round(P.dash / 2);
    ctx.fillStyle = P.dash >= 100 && frame % 10 < 5 ? "#ffffff" : P.dashing ? "#ff9a3a" : "#ffd23a";
    ctx.fillRect(39, 211, pw, 7);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillRect(39, 211, pw, 1);
    const rest = Math.max(0, Math.ceil((R.L - P.x) / 10));
    ctx.fillStyle = "rgba(14,10,36,0.55)";
    ctx.fillRect(W / 2 - 40, 207, 80, 15);
    A.jtext(ctx, "のこり", W / 2 - 37, 210, "#b8a8d8", { size: 8 });
    A.drawText(ctx, `${rest}M`, W / 2 + 36, 211, "#ffffff", { align: "right" });

    const ix = W - 30;
    const iy = 196;
    ctx.fillStyle = OUT;
    ctx.fillRect(ix - 1, iy - 1, 26, 26);
    ctx.fillStyle = P.item && frame % 30 < 15 ? "#5a3a90" : "#3a2a60";
    ctx.fillRect(ix, iy, 24, 24);
    ctx.fillStyle = "#ffe070";
    ctx.fillRect(ix, iy, 24, 1);
    let icon = null;
    if (P.roll > 0) icon = ["ramune", "kasa", "niboshi"][Math.floor(P.roll * 12) % 3];
    else if (P.item) icon = P.item;
    if (icon) ctx.drawImage(A.itemIcon(icon), ix + 5, iy + 5);
    A.drawText(ctx, "B", ix - 8, iy + 15, P.item ? "#ffe070" : "#7a6a9a", { shadow: OUT });

    // ユウタの声
    if (R.call) {
      const c = R.call;
      const k = Math.min(1, (c.dur - c.t) * 6, c.t * 6);
      const w = Math.ceil(A.jwidth(ctx, c.text, 9)) + 40;
      const x = Math.round(-w + (w + 4) * k);
      const y = 21;
      ctx.fillStyle = OUT;
      ctx.fillRect(x - 1, y - 1, w + 2, 30);
      ctx.fillStyle = "#fff6e8";
      ctx.fillRect(x, y, w, 28);
      ctx.fillStyle = "#ff9a2a";
      ctx.fillRect(x, y, w, 2);
      ctx.drawImage(A.portrait("yuta"), x + 3, y + 3);
      A.jtext(ctx, "ユウタ", x + 31, y + 4, "#e8343a", { size: 7 });
      A.jtext(ctx, c.text, x + 31, y + 14, "#18141c", { size: 9 });
    }

    // あみから にげる
    if (P.capt) {
      const c = P.capt;
      if (frame % 16 < 11) A.jtext(ctx, "ボタン れんだで にげろ！", W / 2, 58, "#ffe040", { size: 14, align: "center", outline: OUT, outlineWidth: 4 });
      ctx.fillStyle = OUT;
      ctx.fillRect(W / 2 - 62, 80, 124, 9);
      ctx.fillStyle = "#3a2a60";
      ctx.fillRect(W / 2 - 60, 82, 120, 5);
      ctx.fillStyle = "#ff69b4";
      ctx.fillRect(W / 2 - 60, 82, Math.round((120 * Math.min(c.n, c.need)) / c.need), 5);
    }

    // カウントダウン・ゴール
    if (R.phase === "count" && R.count <= 3) {
      const n = Math.ceil(R.count);
      A.drawText(ctx, String(n), W / 2, 62, "#ffffff", { align: "center", scale: 6, outline: OUT });
    } else if (R.phase === "count") {
      A.jtext(ctx, `STAGE ${R.st.id}  ${R.st.name}`, W / 2, 60, "#ffffff", { size: 14, align: "center", outline: OUT, outlineWidth: 4 });
      A.jtext(ctx, R.st.tips, W / 2, 84, "#ffe070", { size: 9, align: "center", outline: OUT, outlineWidth: 3 });
    }
    if (R.goT > 0 && R.phase === "race") A.drawText(ctx, "GO!", W / 2, 62, "#ffe040", { align: "center", scale: 6, outline: OUT });
    if (R.phase === "goal") {
      A.drawText(ctx, "GOAL!", W / 2, 50, "#ffe040", { align: "center", scale: 5, outline: OUT });
      const rk2 = R.finalRank;
      A.jtext(ctx, `${rk2}い！`, W / 2, 92, rk2 <= 3 ? "#ffffff" : "#b8c8ff", { size: 16, align: "center", outline: OUT, outlineWidth: 4 });
    }
    if (paused) drawPause();
  }

  function drawPause() {
    ctx.fillStyle = "rgba(10,8,30,0.7)";
    ctx.fillRect(0, 0, W, H);
    A.drawText(ctx, "PAUSE", W / 2, 54, "#ffffff", { align: "center", scale: 3, outline: OUT });
    ["つづける", "やりなおす", "ステージを えらぶ"].forEach((t, i) => {
      const y = 100 + i * 20;
      const on = paused.cursor === i;
      A.jtext(ctx, t, W / 2, y, on ? "#ffe070" : "#b8a8d8", { size: 11, align: "center" });
      if (on) A.drawText(ctx, ">", W / 2 - 60, y + 3, "#ffe070");
    });
  }

  function updatePause() {
    if (In.pressed("up")) { paused.cursor = (paused.cursor + 2) % 3; Snd.play("cursor"); }
    if (In.pressed("down")) { paused.cursor = (paused.cursor + 1) % 3; Snd.play("cursor"); }
    if (In.pressed("run")) { paused = null; Snd.playMusic(R.chasing ? "chase" : R.st.music); return; }
    if (In.pressed("jump") || In.pressed("start") || tapped) {
      Snd.play("select");
      const c = paused.cursor;
      paused = null;
      if (c === 0) Snd.playMusic(R.chasing ? "chase" : R.st.music);
      else if (c === 1) startRace(R.si);
      else { R = null; openSelect(); }
    }
  }

  // ---------------------------------------------------------------- タイトル
  const titleKids = [
    { id: "sota", x: 250, y: LANES[0], anim: 0 },
    { id: "haruto", x: 190, y: LANES[2], anim: 5 },
    { id: "mei", x: 150, y: LANES[0], anim: 10 },
    { id: "riko", x: 110, y: LANES[2], anim: 3 },
  ];
  function drawTitle() {
    const cam = modeT * 140;
    drawWorld("river", cam);
    titleKids.forEach((k) => {
      k.anim += 2.4;
      drawKid({ id: k.id, anim: k.anim, y: k.y, hop: 0 }, Math.round(k.x + Math.sin(modeT * 0.7 + k.x) * 10));
    });
    drawShip(300 + Math.sin(modeT * 0.9) * 14, LANES[1], 6 + Math.sin(modeT * 2) * 3, { look: "walk_right1", flame: 1 });
    ctx.fillStyle = "rgba(14,10,36,0.35)";
    ctx.fillRect(0, 16, W, 84);
    const o = { align: "center", outline: OUT };
    A.drawText(ctx, "SUPER POPO", W / 2, 22, "#ff69b4", { ...o, scale: 4 });
    A.drawText(ctx, "RACING", W / 2, 56, "#ffd23a", { ...o, scale: 4 });
    A.jtext(ctx, "ポポの ちきゅう かけっこ グランプリ", W / 2, 88, "#ffffff", { size: 10, align: "center", outline: OUT, outlineWidth: 3 });
    if (Math.floor(modeT * 2) % 2 === 0) A.jtext(ctx, "Space / Enter / タップで スタート", W / 2, 206, "#ffffff", { size: 9, align: "center", outline: OUT, outlineWidth: 3 });
    if (save.cleared) A.drawText(ctx, "*ALL CLEAR*", W - 6, 4, "#ffd23a", { align: "right", shadow: OUT });
  }

  // ---------------------------------------------------------------- ステージセレクト
  function openSelect() {
    selCursor = Math.min(save.unlocked, STAGES.length) - 1;
    Snd.playMusic("title");
    setMode("select");
  }
  function updateSelect() {
    if (In.pressed("up")) { selCursor = (selCursor + STAGES.length - 1) % STAGES.length; Snd.play("cursor"); }
    if (In.pressed("down")) { selCursor = (selCursor + 1) % STAGES.length; Snd.play("cursor"); }
    if (back()) { Snd.play("cursor"); setMode("title"); return; }
    if (ok()) {
      if (selCursor < save.unlocked) {
        Snd.play("select");
        openStory(selCursor);
      } else {
        Snd.play("bump");
      }
    }
  }
  function drawSelect() {
    const st = STAGES[selCursor];
    const locked = selCursor >= save.unlocked;
    drawWorld(locked ? "river" : st.theme, modeT * 40);
    ctx.fillStyle = "rgba(14,10,36,0.72)";
    ctx.fillRect(0, 0, W, H);
    A.drawText(ctx, "STAGE SELECT", W / 2, 8, "#ffd23a", { align: "center", scale: 2, outline: OUT });
    STAGES.forEach((s, i) => {
      const y = 32 + i * 30;
      const on = i === selCursor;
      const lock = i >= save.unlocked;
      ctx.fillStyle = on ? "#5a3a90" : "#2a1e4a";
      ctx.fillRect(28, y, 328, 26);
      if (on) { ctx.fillStyle = "#ffe070"; ctx.fillRect(28, y, 3, 26); }
      A.drawText(ctx, String(s.id), 40, y + 6, lock ? "#5a4a7a" : "#ffffff", { scale: 2 });
      if (lock) {
        A.jtext(ctx, "？？？", 62, y + 7, "#7a6a9a", { size: 11 });
        A.jtext(ctx, "まえの ステージを 3いいないで クリア", 160, y + 9, "#7a6a9a", { size: 8 });
      } else {
        A.jtext(ctx, s.name, 62, y + 3, "#ffffff", { size: 11 });
        A.drawText(ctx, s.en, 62, y + 17, "#b8a8d8");
        const best = save.best[String(s.id)];
        if (best) {
          const col = ["#ffd23a", "#d8e0f0", "#ffa860", "#8a7aaa", "#8a7aaa"][best.rank - 1];
          ctx.fillStyle = col;
          ctx.fillRect(300, y + 5, 16, 16);
          ctx.fillStyle = OUT;
          ctx.fillRect(300, y + 5, 16, 1);
          A.drawText(ctx, String(best.rank), 308, y + 10, OUT, { align: "center" });
          A.drawText(ctx, fmtTime(best.time), 296, y + 10, "#d8d0f0", { align: "right" });
        }
      }
    });
    A.jtext(ctx, "↑↓ えらぶ　A(Space) けってい　B(X) もどる", W / 2, 186, "#b8a8d8", { size: 9, align: "center" });
    A.jtext(ctx, "3いいないで ゴールすると つぎの ステージへ！", W / 2, 202, "#ffe070", { size: 9, align: "center" });
  }

  // ---------------------------------------------------------------- ストーリー
  function openStory(si) {
    story = { si, lines: STAGES[si].intro, i: 0, chars: 0, theme: STAGES[si].theme, ending: false };
    Snd.playMusic("story");
    setMode("story");
  }
  function openEnding(rank = 1) {
    story = { si: STAGES.length - 1, lines: ENDING(rank), i: 0, chars: 0, theme: "festival", ending: true };
    Snd.playMusic("title");
    setMode("story");
  }
  function storyDone() {
    if (story.ending) { setMode("theend"); Snd.playMusic("festival"); return; }
    startRace(story.si);
  }
  function updateStory(dt) {
    const line = story.lines[story.i];
    const len = line[1].length;
    if (story.chars < len) {
      const before = Math.floor(story.chars);
      story.chars = Math.min(len, story.chars + dt * 30);
      if (Math.floor(story.chars) !== before && before % 2 === 0) Snd.play("talk");
    }
    if (In.pressed("start") && !story.ending) { storyDone(); return; }
    if (ok() || back()) {
      if (story.chars < len) story.chars = len;
      else {
        story.i++;
        story.chars = 0;
        if (story.i >= story.lines.length) storyDone();
      }
    }
  }
  function drawStory() {
    const line = story.lines[Math.min(story.i, story.lines.length - 1)];
    const who = line[0];
    drawWorld(story.theme, modeT * 18);
    // キャラクター (2 倍)
    const big = (img, x, footY, hop) => ctx.drawImage(img, Math.round(x - img.width), Math.round(footY - img.height * 2 + 2 - hop), img.width * 2, img.height * 2);
    const hop = (w) => (w === who && story.chars < line[1].length ? Math.abs(Math.sin(modeT * 12)) * 3 : 0);
    const cast = new Set(story.lines.map((l) => l[0]));
    big(A.yutaStand(who === "yuta", Math.floor(modeT * 4)), 96, 140, hop("yuta"));
    ctx.save();
    ctx.translate(168, 0);
    ctx.scale(2, 2);
    drawShip(0, 69, 8 + hop("popo") / 2, { look: who === "popo" ? "jump" : "idle" });
    ctx.restore();
    if (cast.has("fish")) {
      const img = A.fishFrame(who === "fish" && !story.ending ? "windup" : "stand");
      ctx.drawImage(img, 214, Math.round(140 - img.height * 2 + 2 - hop("fish")), img.width * 2, img.height * 2);
    }
    if (cast.has("haruto")) big(A.kidStand("haruto"), story.ending ? 40 : 346, 140, hop("haruto"));
    // 会話ウィンドウ
    const bx = 8;
    const by = 146;
    ctx.fillStyle = OUT;
    ctx.fillRect(bx - 2, by - 2, W - 12, 74);
    ctx.fillStyle = "#fffaf0";
    ctx.fillRect(bx, by, W - 16, 70);
    ctx.fillStyle = who === "popo" ? "#ff69b4" : who === "fish" ? "#2a6ad8" : who === "yuta" ? "#ff9a2a" : A.KIDS[who].color;
    ctx.fillRect(bx, by, W - 16, 3);
    ctx.drawImage(A.portrait(who), bx + 6, by + 10, 48, 48);
    A.jtext(ctx, NAMES[who], bx + 64, by + 8, "#e8343a", { size: 10 });
    const shown = line[1].slice(0, Math.floor(story.chars));
    shown.split("\n").forEach((t, i) => A.jtext(ctx, t, bx + 64, by + 24 + i * 16, "#18141c", { size: 12 }));
    if (story.chars >= line[1].length && frame % 40 < 26) A.drawText(ctx, ">", W - 20, by + 58, "#e8343a");
    const head = story.ending ? "ENDING" : `STAGE ${STAGES[story.si].id}`;
    A.drawText(ctx, head, 8, 6, "#ffffff", { scale: 2, outline: OUT });
    if (!story.ending) {
      A.jtext(ctx, STAGES[story.si].name, 8 + head.length * 12 + 6, 7, "#ffe070", { size: 11, outline: OUT, outlineWidth: 3 });
      A.jtext(ctx, "Enter: スキップ", W - 6, 8, "#ffffff", { size: 8, align: "right", outline: OUT });
    }
  }

  // ---------------------------------------------------------------- 結果
  function resultOptions() {
    const r = R.result;
    if (r.clear && R.si === STAGES.length - 1) return [["エンディングへ", "ending"], ["もういちど", "retry"]];
    if (r.clear) return [["つぎの ステージへ", "next"], ["もういちど", "retry"], ["ステージを えらぶ", "select"]];
    return [["もういちど", "retry"], ["ステージを えらぶ", "select"]];
  }
  function updateResult() {
    if (modeT < 0.8) return;
    const opts = resultOptions();
    if (In.pressed("up")) { resCursor = (resCursor + opts.length - 1) % opts.length; Snd.play("cursor"); }
    if (In.pressed("down")) { resCursor = (resCursor + 1) % opts.length; Snd.play("cursor"); }
    if (ok()) {
      Snd.play("select");
      const act = opts[resCursor][1];
      const si = R.si;
      if (act === "next") openStory(si + 1);
      else if (act === "retry") startRace(si);
      else if (act === "ending") openEnding(R.result.rank);
      else openSelect();
    }
  }
  function drawResult() {
    const r = R.result;
    drawWorld(R.st.theme, R.cam + modeT * 30);
    ctx.fillStyle = "rgba(14,10,36,0.75)";
    ctx.fillRect(0, 0, W, H);
    const head = r.clear ? "CLEAR!" : "TRY AGAIN";
    A.drawText(ctx, head, W / 2, 8, r.clear ? "#ffd23a" : "#9ab0ff", { align: "center", scale: 3, outline: OUT });
    A.jtext(ctx, r.clear ? `${r.rank}いで ゴール！ やったね！` : `${r.rank}い… 3いいないで クリアだよ`, W / 2, 33, "#ffffff", { size: 10, align: "center" });
    r.rows.forEach((row, i) => {
      const y = 50 + i * 21;
      const me = row.id === "popo";
      if (Math.min(1, modeT * 3 - i * 0.4) <= 0) return;
      ctx.fillStyle = me ? "#7a3a7a" : "#2a1e4a";
      ctx.fillRect(24, y, 200, 19);
      const rc = ["#ffd23a", "#d8e0f0", "#ffa860", "#ffffff", "#ffffff"][i];
      A.drawText(ctx, String(i + 1), 34, y + 6, rc, { align: "center" });
      ctx.drawImage(A.portrait(me ? "popo" : row.id), 44, y + 1, 17, 17);
      A.jtext(ctx, me ? "ポポ" : A.KIDS[row.id].name, 66, y + 4, me ? "#ff9ad0" : "#ffffff", { size: 10 });
      A.drawText(ctx, fmtTime(row.time), 218, y + 6, "#d8d0f0", { align: "right" });
    });
    const sx = 236;
    const line = (label, val, y, col = "#ffffff") => {
      A.jtext(ctx, label, sx, y, "#b8a8d8", { size: 9 });
      A.drawText(ctx, String(val), W - 12, y + 1, col, { align: "right" });
    };
    line("こんぺいとう", r.candy, 54);
    line("じゅんい ボーナス", r.rankBonus, 70);
    line("タイム ボーナス", r.timeBonus, 86);
    ctx.fillStyle = "#5a4a7a";
    ctx.fillRect(sx, 100, W - 12 - sx, 1);
    line("スコア", r.total, 106, "#ffe070");
    if (r.isNew && frame % 30 < 20) A.drawText(ctx, "NEW RECORD!", W - 12, 122, "#ff69b4", { align: "right" });
    if (modeT >= 0.8) {
      resultOptions().forEach(([t], i) => {
        const y = 160 + i * 18;
        const on = i === resCursor;
        A.jtext(ctx, t, 300, y, on ? "#ffe070" : "#b8a8d8", { size: 11, align: "center" });
        if (on) A.drawText(ctx, ">", 240, y + 3, "#ffe070");
      });
    }
  }

  // ---------------------------------------------------------------- エンド
  function drawTheEnd() {
    drawWorld("festival", modeT * 10);
    ctx.fillStyle = "rgba(10,8,30,0.35)";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(140, 0);
    ctx.scale(2, 2);
    drawShip(0, 76, 10, { look: "jump", flame: 0 });
    ctx.restore();
    const y = A.yutaStand(true, Math.floor(modeT * 3));
    ctx.drawImage(y, 196, 152 - y.height * 2, y.width * 2, y.height * 2);
    A.drawText(ctx, "THE END", W / 2, 30, "#ffd23a", { align: "center", scale: 4, outline: OUT });
    A.jtext(ctx, "あそんで くれて ありがとう！", W / 2, 168, "#ffffff", { size: 12, align: "center", outline: OUT, outlineWidth: 3 });
    A.jtext(ctx, "ポポと ユウタの ちきゅう ぼうけんは つづく…", W / 2, 186, "#ffe070", { size: 9, align: "center", outline: OUT, outlineWidth: 3 });
    if (modeT > 2 && frame % 40 < 26) A.jtext(ctx, "Space で タイトルへ", W / 2, 206, "#b8a8d8", { size: 8, align: "center" });
  }

  // ---------------------------------------------------------------- ループ
  function update(dt) {
    modeT += dt;
    const night = (mode === "race" && R && R.st.theme === "festival") || (mode === "story" && story && story.theme === "festival") || mode === "theend" || (mode === "result" && R && R.st.theme === "festival");
    updateFireworks(dt, night);
    if (mode === "title") {
      if (Snd.music !== "title") Snd.playMusic("title");
      if (ok() && modeT > 0.3) { Snd.play("select"); openSelect(); }
    } else if (mode === "select") updateSelect();
    else if (mode === "story") updateStory(dt);
    else if (mode === "race") {
      if (paused) updatePause();
      else updateRace(dt);
    } else if (mode === "result") updateResult();
    else if (mode === "theend") {
      if (modeT > 2 && ok()) setMode("title");
    }
  }

  function draw() {
    ctx.setTransform(K, 0, 0, K, 0, 0);
    ctx.imageSmoothingEnabled = false;
    if (mode === "title") drawTitle();
    else if (mode === "select") drawSelect();
    else if (mode === "story") drawStory();
    else if (mode === "race" && R) drawRace();
    else if (mode === "result") drawResult();
    else if (mode === "theend") drawTheEnd();
  }

  let frozen = false; // テスト用: true にすると止まる
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    Input.update();
    if (!frozen) update(dt);
    tapped = false;
    frame++;
    draw();
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------ 画面サイズ (くっきり表示するため内部解像度も合わせる)
  function fit() {
    const wrap = canvas.parentElement;
    const availW = wrap.clientWidth;
    const touch = document.body.classList.contains("is-touch");
    const landscape = touch && matchMedia("(orientation: landscape) and (max-height: 500px)").matches;
    const top = wrap.getBoundingClientRect().top + window.scrollY;
    const availH = landscape ? window.innerHeight - 16 : window.innerHeight - top - (touch ? 150 : 24);
    let s = Math.min(availW / W, Math.max(availH, 160) / H);
    if (s >= 2) s = Math.floor(s);
    canvas.style.width = `${Math.floor(W * s)}px`;
    canvas.style.height = `${Math.floor(H * s)}px`;
    const dpr = window.devicePixelRatio || 1;
    K = clamp(Math.round(s * dpr), 1, 6);
    canvas.width = W * K;
    canvas.height = H * K;
    ctx.imageSmoothingEnabled = false;
  }

  canvas.addEventListener("pointerdown", () => { tapped = true; Snd.unlock(); });
  Input.on((what) => {
    Snd.unlock();
    if (what === "mute") Snd.toggleMute();
  });
  Input.setupTouch(document.getElementById("touch"));
  if (matchMedia("(pointer: coarse)").matches) document.body.classList.add("is-touch");
  window.addEventListener("resize", fit);
  fit();

  const muteBtn = document.getElementById("mute");
  if (muteBtn) {
    const label = () => { muteBtn.textContent = Snd.muted ? "🔇 音オフ" : "🔊 音オン"; };
    label();
    muteBtn.addEventListener("click", () => { Snd.unlock(); Snd.toggleMute(); label(); muteBtn.blur(); });
    Input.on((w) => { if (w === "mute") label(); });
  }

  // ?stage=3 のように URL で指定すると、そのステージから始められる
  const qs = new URLSearchParams(location.search);
  const qStage = parseInt(qs.get("stage"), 10);
  if (qStage >= 1 && qStage <= STAGES.length) {
    save.unlocked = Math.max(save.unlocked, qStage);
    writeSave();
    openStory(qStage - 1);
  }

  // テスト・デバッグ用
  window.PopoRace = {
    get mode() { return mode; },
    get race() { return R; },
    get save() { return save; },
    startRace, openStory, openEnding, openSelect, setMode, update, draw, standings,
    setBot(b) { bot = b; },
    set frozen(v) { frozen = v; },
    resetSave() { save = { unlocked: 1, best: {}, cleared: false }; writeSave(); },
  };

  requestAnimationFrame(loop);
})();
