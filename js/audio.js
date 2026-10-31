// チップチューン風の効果音と BGM (WebAudio の矩形波・三角波・ノイズだけで鳴らす)
(() => {
  "use strict";

  let ac = null;
  let master = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem("poporacing.muted") === "1"; } catch (e) { /* storage unavailable */ }

  function ensure() {
    if (ac) {
      if (ac.state === "suspended") ac.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = muted ? 0 : 0.22;
    master.connect(ac.destination);
    musicGain = ac.createGain();
    musicGain.gain.value = 0.55;
    musicGain.connect(master);
    sfxGain = ac.createGain();
    sfxGain.gain.value = 0.9;
    sfxGain.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function tone(type, freq, start, dur, vol, dest, slideTo) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, start + dur);
    g.gain.setValueAtTime(vol, start);
    g.gain.setValueAtTime(vol, start + dur * 0.7);
    g.gain.linearRampToValueAtTime(0.0001, start + dur);
    o.connect(g);
    g.connect(dest);
    o.start(start);
    o.stop(start + dur + 0.02);
  }

  function noise(start, dur, vol, dest, hp = 1000) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = hp;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    s.connect(f);
    f.connect(g);
    g.connect(dest);
    s.start(start);
    s.stop(start + dur + 0.02);
  }

  const NOTE_INDEX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freqOf(name) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(name);
    if (!m) return 0;
    let n = NOTE_INDEX[m[1]] + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0);
    const midi = (Number(m[3]) + 1) * 12 + n;
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // 連続した音符を鳴らす (効果音用ジングル)
  function seq(notes, step, type = "square", vol = 0.3) {
    const t = ac.currentTime;
    notes.forEach((n, i) => {
      if (n) tone(type, freqOf(n), t + i * step, step * 0.95, vol, sfxGain);
    });
  }

  const SFX = {
    jump() { tone("square", 300, ac.currentTime, 0.14, 0.22, sfxGain, 760); },
    land() { tone("triangle", 140, ac.currentTime, 0.06, 0.35, sfxGain, 80); },
    coin() {
      const t = ac.currentTime;
      tone("square", 1319, t, 0.05, 0.18, sfxGain);
      tone("square", 1760, t + 0.05, 0.12, 0.18, sfxGain);
    },
    boost() { tone("sawtooth", 220, ac.currentTime, 0.35, 0.12, sfxGain, 880); },
    turbo() {
      const t = ac.currentTime;
      tone("sawtooth", 180, t, 0.6, 0.14, sfxGain, 1200);
      seq(["C6", "E6", "G6", "C7"], 0.05, "square", 0.16);
    },
    splash() { noise(ac.currentTime, 0.18, 0.25, sfxGain, 1800); },
    spin() {
      const t = ac.currentTime;
      for (let i = 0; i < 5; i++) tone("square", 900 - i * 120, t + i * 0.07, 0.06, 0.18, sfxGain, 500 - i * 60);
    },
    bump() { tone("triangle", 200, ac.currentTime, 0.12, 0.45, sfxGain, 90); },
    meow() {
      const t = ac.currentTime;
      tone("square", 700, t, 0.08, 0.12, sfxGain, 1100);
      tone("square", 1100, t + 0.08, 0.16, 0.12, sfxGain, 600);
    },
    kiki() { seq(["A6", "C7", "A6", "C7"], 0.045, "square", 0.12); },
    throw() { tone("triangle", 500, ac.currentTime, 0.2, 0.3, sfxGain, 1200); },
    shout() { seq(["D5", "D5", "F5"], 0.07, "sawtooth", 0.1); },
    net() {
      const t = ac.currentTime;
      noise(t, 0.12, 0.35, sfxGain, 600);
      tone("square", 300, t, 0.25, 0.2, sfxGain, 90);
    },
    mash() { tone("square", 500 + Math.random() * 300, ac.currentTime, 0.04, 0.14, sfxGain); },
    escape() { seq(["C6", "G6", "C7"], 0.06, "square", 0.2); },
    block() {
      const t = ac.currentTime;
      tone("triangle", 1200, t, 0.15, 0.3, sfxGain, 600);
      noise(t, 0.08, 0.2, sfxGain, 3000);
    },
    roll() { tone("square", 1200, ac.currentTime, 0.025, 0.1, sfxGain); },
    item() { seq(["G5", "C6", "E6", "G6"], 0.06, "square", 0.2); },
    powerup() { seq(["C5", "E5", "G5", "C6", "E6", "G6"], 0.05, "square", 0.2); },
    call() { seq(["E6", "G6"], 0.07, "square", 0.14); },
    count() { tone("square", 660, ac.currentTime, 0.18, 0.22, sfxGain); },
    go() { tone("square", 1320, ac.currentTime, 0.5, 0.22, sfxGain); },
    goal() { seq(["C6", "D6", "E6", "G6", null, "E6", "G6", "C7"], 0.09, "square", 0.22); },
    win() { seq(["G5", "C6", "E6", "G6", null, "E6", "G6", null, null, "A6", "A6", "A6", "B6", "C7"], 0.1, "square", 0.22); },
    lose() { seq(["G5", "E5", "C5", null, "D5", "B4", "G4"], 0.14, "triangle", 0.4); },
    select() { tone("square", 880, ac.currentTime, 0.07, 0.18, sfxGain, 1320); },
    cursor() { tone("square", 660, ac.currentTime, 0.03, 0.12, sfxGain); },
    pause() { seq(["E6", "C6", "E6", "C6"], 0.07, "square", 0.18); },
    talk() { tone("square", 900 + Math.random() * 200, ac.currentTime, 0.02, 0.06, sfxGain); },
    firework() {
      const t = ac.currentTime;
      tone("triangle", 120, t, 0.3, 0.3, sfxGain, 40);
      noise(t + 0.05, 0.5, 0.15, sfxGain, 800);
    },
  };

  // ------------------------------------------------------------- BGM (すべてオリジナル曲)
  // 1 トークン = 8 分音符。"-" は前の音を伸ばす、"." は休符
  const SONGS = {
    title: {
      bpm: 132,
      lead: "C5 . E5 G5 C6 . G5 E5 F5 . A5 . G5 - - . E5 . G5 C6 E6 . D6 C6 B5 . G5 . A5 B5 C6 . " +
        "A5 . C6 A5 F5 . A5 C6 G5 . E5 G5 C6 . E5 . F5 . E5 . D5 . G5 . C5 - - - - - . .",
      bass: "C3 . G3 . C3 . G3 . F2 . C3 . F2 . C3 . A2 . E3 . A2 . E3 . G2 . D3 . G2 . D3 . " +
        "F2 . C3 . F2 . C3 . C3 . G3 . C3 . G3 . F2 . C3 . G2 . D3 . C3 . G3 . C3 . . .",
      drums: "k . h . s . h .",
    },
    story: {
      bpm: 100,
      lead: "C5 . E5 . G5 . E5 . F5 . A5 . G5 - - . E5 . G5 . C6 . B5 . A5 . F5 . G5 - - .",
      bass: "C3 . . . G2 . . . F2 . . . G2 . . . A2 . . . E2 . . . F2 . . . G2 . . .",
      drums: "k . . . h . . .",
    },
    river: {
      bpm: 150,
      lead: "F5 . A5 . C6 . A5 . Bb5 A5 G5 F5 G5 - - . E5 . G5 . Bb5 . G5 . A5 G5 F5 E5 F5 - - . " +
        "D5 . F5 . A5 . D6 . C6 Bb5 A5 G5 A5 - - . Bb5 . A5 . G5 . E5 . F5 . . . F5 - - .",
      bass: "F3 . C4 . F3 . C4 . C3 . G3 . C3 . G3 . C3 . G3 . C3 . G3 . F3 . C4 . F3 . A3 . " +
        "D3 . A3 . D3 . A3 . Bb2 . F3 . Bb2 . F3 . C3 . G3 . C3 . G3 . F3 . C4 . F3 . . .",
      drums: "k . h . s . h h",
    },
    town: {
      bpm: 140,
      lead: "G5 . G5 Bb5 . G5 F5 . G5 - - . D5 . F5 . G5 . G5 Bb5 . C6 Bb5 . G5 - - . . . . . " +
        "C6 . C6 Bb5 . G5 F5 . G5 - - . F5 . D5 . F5 . F5 G5 . F5 D5 . C5 - D5 - G4 - - .",
      bass: "G2 . G3 . G2 G2 G3 . G2 . G3 . F2 . F3 . G2 . G3 . G2 G2 G3 . Bb2 . Bb3 . C3 . D3 . " +
        "C3 . C4 . C3 C3 C4 . Bb2 . Bb3 . Bb2 Bb2 Bb3 . F2 . F3 . F2 F2 F3 . G2 . D3 . G2 . . .",
      drums: "k . s . . k s h",
    },
    forest: {
      bpm: 156,
      lead: "D5 F#5 A5 . F#5 A5 D6 . B5 . A5 . F#5 . E5 . D5 F#5 A5 . B5 A5 F#5 . E5 - - - - - - . " +
        "G5 . B5 . A5 . F#5 . G5 F#5 E5 D5 E5 . . . F#5 . A5 . G5 . E5 . D5 - - - D5 . . .",
      bass: "D3 . A3 . D3 . A3 . G2 . D3 . G2 . D3 . D3 . A3 . D3 . A3 . A2 . E3 . A2 . E3 . " +
        "G2 . D3 . G2 . D3 . A2 . E3 . A2 . E3 . D3 . A3 . A2 . E3 . D3 . A3 . D3 . . .",
      drums: "k h s h k h s s",
    },
    port: {
      bpm: 128,
      lead: "A4 . C5 . E5 . A5 . G5 - E5 . D5 - C5 . D5 . E5 . G5 . E5 . D5 - - - - - - . " +
        "F5 . E5 . D5 . C5 . B4 - C5 . D5 - E5 . C5 . B4 . A4 . G4 . A4 - - - - - - .",
      bass: "A2 . E3 . A3 . E3 . F2 . C3 . F3 . C3 . G2 . D3 . G3 . D3 . A2 . E3 . A3 . E3 . " +
        "D3 . A3 . D3 . A3 . E2 . B2 . E3 . B2 . F2 . C3 . G2 . D3 . A2 . E3 . A2 . . .",
      drums: "k . h . s . h .",
    },
    festival: {
      bpm: 168,
      lead: "E5 G5 A5 . A5 G5 A5 C6 D6 . C6 A5 G5 . E5 . D5 E5 G5 . G5 E5 G5 A5 C6 . A5 G5 E5 - - . " +
        "A5 . A5 . C6 A5 G5 E5 G5 . G5 . A5 G5 E5 D5 E5 . E5 G5 A5 . G5 E5 D5 . C5 D5 E5 - - .",
      bass: "A2 . A3 . A2 . A3 . A2 . A3 . G2 . G3 . A2 . A3 . A2 . E3 . G2 . D3 . A2 . . . " +
        "C3 . G3 . C3 . G3 . G2 . D3 . G2 . D3 . A2 . E3 . A2 . E3 . G2 . D3 . A2 . A2 .",
      drums: "k s . s k . s s",
    },
    chase: {
      bpm: 176,
      lead: "E5 E5 G5 E5 A5 . G5 E5 D5 D5 F5 D5 G5 . F5 D5 C5 C5 E5 C5 F5 . E5 C5 B4 . D5 . G5 - - .",
      bass: "A2 A3 A2 A3 A2 A3 A2 A3 G2 G3 G2 G3 G2 G3 G2 G3 F2 F3 F2 F3 F2 F3 F2 F3 E2 E3 E2 E3 G2 G3 G2 G3",
      drums: "k h s h k k s h",
    },
  };

  function parseTrack(str) {
    return str.trim().split(/\s+/);
  }

  let current = null; // { name, song, step, nextTime, timer }

  function scheduleStep(song, step, time) {
    const eighth = 60 / song.bpm / 2;
    const voices = [["lead", "square", 0.16], ["bass", "triangle", 0.4]];
    for (const [key, type, vol] of voices) {
      const track = song[key];
      const tok = track[step % track.length];
      if (tok === "." || tok === "-") continue;
      let len = 1;
      while (track[(step + len) % track.length] === "-" && len < track.length) len++;
      tone(type, freqOf(tok), time, eighth * len * 0.92, vol, musicGain);
    }
    const dr = song.drums[step % song.drums.length];
    if (dr === "k") tone("triangle", 140, time, 0.08, 0.5, musicGain, 50);
    else if (dr === "s") noise(time, 0.08, 0.18, musicGain, 1500);
    else if (dr === "h") noise(time, 0.025, 0.08, musicGain, 6000);
  }

  function playMusic(name) {
    if (!ensure()) return;
    if (current && current.name === name) return;
    stopMusic();
    const raw = SONGS[name];
    if (!raw) return;
    const song = { bpm: raw.bpm, lead: parseTrack(raw.lead), bass: parseTrack(raw.bass), drums: parseTrack(raw.drums) };
    current = { name, song, step: 0, nextTime: ac.currentTime + 0.08 };
    const eighth = 60 / song.bpm / 2;
    current.timer = setInterval(() => {
      if (!current) return;
      while (current.nextTime < ac.currentTime + 0.15) {
        scheduleStep(current.song, current.step, current.nextTime);
        current.step++;
        current.nextTime += eighth;
      }
    }, 25);
  }

  function stopMusic() {
    if (current) clearInterval(current.timer);
    current = null;
  }

  function play(name) {
    if (!ensure() || !SFX[name]) return;
    SFX[name]();
  }

  function setMuted(m) {
    muted = m;
    try { localStorage.setItem("poporacing.muted", m ? "1" : "0"); } catch (e) { /* storage unavailable */ }
    if (master) master.gain.value = m ? 0 : 0.22;
  }

  window.PopoAudio = {
    unlock: ensure,
    play,
    playMusic,
    stopMusic,
    toggleMute() { setMuted(!muted); return muted; },
    get muted() { return muted; },
    get music() { return current ? current.name : null; },
  };
})();
