"use client";

/* =========================================================
   GoalCheck Pro — Web Audio engine v2
   ---------------------------------------------------------
   Upgrades vs v1:
   - ONE shared AudioContext (created lazily on user gesture)
   - Master bus: chime bus + music bus -> compressor -> out
   - Algorithmic reverb (synthesized impulse response) with
     per-voice sends — no external files, zero network
   - 4 chime VOICE PACKS: glass / marimba / bell / chip
   - 5 kinds: tap, complete, pomo-done, celebrate, levelup
   - Music streams rewritten: swing + vinyl crackle lo-fi,
     feedback-delay synthwave, evolving cosmic pads, layered
     rain with droplets & thunder, ocean waves, night forest
   - All synthesis is local (FOSS purity: no samples, no CDN)
   ========================================================= */

import type { ChimePack } from "./types";

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let chimeBus: GainNode | null = null;
let musicBus: GainNode | null = null;
let reverb: ConvolverNode | null = null;
let reverbGain: GainNode | null = null;
let delay: DelayNode | null = null;
let delayFb: GainNode | null = null;

export function ensureAudio(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 24;
    comp.ratio.value = 3;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;
    comp.connect(ctx.destination);

    chimeBus = ctx.createGain();
    chimeBus.gain.value = 0.8;
    chimeBus.connect(comp);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.85;
    musicBus.connect(comp);

    /* algorithmic reverb: 1.9s exponentially-decaying noise IR */
    reverb = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.9);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    reverb.buffer = ir;
    reverbGain = ctx.createGain();
    reverbGain.gain.value = 0.32;
    reverb.connect(reverbGain);
    reverbGain.connect(comp);

    /* shared feedback delay (synthwave arps, cosmic echoes) */
    delay = ctx.createDelay(1.2);
    delay.delayTime.value = 0.29;
    delayFb = ctx.createGain();
    delayFb.gain.value = 0.34;
    const delayTone = ctx.createBiquadFilter();
    delayTone.type = "lowpass";
    delayTone.frequency.value = 2600;
    delay.connect(delayTone);
    delayTone.connect(delayFb);
    delayFb.connect(delay);
    delayTone.connect(musicBus);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

export function setChimeVolume(v: number) {
  if (chimeBus && ctx) chimeBus.gain.setTargetAtTime(Math.max(0, Math.min(1.4, v)), ctx.currentTime, 0.03);
}

function sendReverb(node: AudioNode, amount: number) {
  if (!reverb || amount <= 0) return;
  const g = ctx!.createGain();
  g.gain.value = amount;
  node.connect(g);
  g.connect(reverb);
}

function sendDelay(node: AudioNode, amount: number) {
  if (!delay || amount <= 0) return;
  const g = ctx!.createGain();
  g.gain.value = amount;
  node.connect(g);
  g.connect(delay);
}

/* =========================================================
   CHIME VOICE PACKS
   ========================================================= */

interface VoiceNote { t: number; freq: number; dur: number; vol: number; pan?: number }

function voiceNote(c: Ctx, pack: ChimePack, n: VoiceNote) {
  const t = c.currentTime + n.t;
  const vol = n.vol;
  const dur = n.dur;
  const pan = c.createStereoPanner();
  pan.pan.value = n.pan ?? 0;
  pan.connect(chimeBus!);
  sendReverb(pan, pack === "chip" ? 0.05 : 0.28);

  const env = c.createGain();
  env.connect(pan);

  if (pack === "chip") {
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(n.freq, t);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol * 0.5, t + 0.008);
    env.gain.setValueAtTime(vol * 0.5, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(env);
    o.start(t);
    o.stop(t + dur + 0.02);
    return;
  }

  if (pack === "marimba") {
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(n.freq * 1.012, t);
    o.frequency.exponentialRampToValueAtTime(n.freq, t + 0.06);
    const h = c.createOscillator(); /* wooden 4th harmonic */
    h.type = "sine";
    h.frequency.value = n.freq * 4;
    const hg = c.createGain();
    hg.gain.setValueAtTime(vol * 0.18, t);
    hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.8);
    o.connect(env); h.connect(hg); hg.connect(pan);
    o.start(t); o.stop(t + dur);
    h.start(t); h.stop(t + 0.12);
    return;
  }

  if (pack === "bell") {
    /* FM-ish: modulator drives carrier pitch */
    const car = c.createOscillator();
    car.type = "sine";
    car.frequency.value = n.freq;
    const mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.value = n.freq * 3.47;
    const modG = c.createGain();
    modG.gain.setValueAtTime(n.freq * 2.4, t);
    modG.gain.exponentialRampToValueAtTime(n.freq * 0.05, t + dur * 0.5);
    mod.connect(modG);
    modG.connect(car.frequency);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(vol * 0.85, t + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    car.connect(env);
    car.start(t); car.stop(t + dur + 0.05);
    mod.start(t); mod.stop(t + dur + 0.05);
    return;
  }

  /* glass (default): pure sine + shimmering octave partial */
  const o = c.createOscillator();
  o.type = "sine";
  o.frequency.value = n.freq;
  const o2 = c.createOscillator();
  o2.type = "sine";
  o2.frequency.value = n.freq * 2.004;
  const g2 = c.createGain();
  g2.gain.setValueAtTime(vol * 0.22, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.55);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(vol, t + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(env); o2.connect(g2); g2.connect(pan);
  o.start(t); o.stop(t + dur + 0.05);
  o2.start(t); o2.stop(t + dur * 0.6 + 0.05);
}

function packScale(pack: ChimePack, base: number): number {
  /* chip sounds better an octave up, bell slightly lower */
  if (pack === "chip") return base * 2;
  if (pack === "bell") return base;
  return base;
}

export function playChime(kind: "celebrate" | "pomo-done" | "tap" | "complete" | "levelup", pack: ChimePack = "glass", volume = 0.8, priority?: "normal" | "high" | "urgent") {
  const c = ensureAudio();
  if (!c || !chimeBus) return;
  setChimeVolume(volume);
  try {
    const v = 0.16 * Math.max(0.4, Math.min(1.2, volume + 0.2));
    const R = (f: number) => packScale(pack, f);

    if (kind === "tap") {
      voiceNote(c, pack, { t: 0, freq: R(620), dur: 0.14, vol: v * 0.55, pan: 0 });
    } else if (kind === "complete") {
      /* v4 — priority-shaped completion timbre: urgent = brighter rising arpeggio, high = added mid voice */
      if (priority === "urgent") {
        voiceNote(c, pack, { t: 0, freq: R(880), dur: 0.22, vol: v, pan: -0.3 });        /* A5 */
        voiceNote(c, pack, { t: 0.07, freq: R(1108.7), dur: 0.3, vol: v * 1.05, pan: 0 }); /* C#6 */
        voiceNote(c, pack, { t: 0.14, freq: R(1318.5), dur: 0.5, vol: v * 1.15, pan: 0.3 }); /* E6 */
      } else if (priority === "high") {
        voiceNote(c, pack, { t: 0, freq: R(783.99), dur: 0.28, vol: v, pan: -0.2 });     /* G5 */
        voiceNote(c, pack, { t: 0.08, freq: R(987.77), dur: 0.36, vol: v * 1.05, pan: 0 }); /* B5 */
        voiceNote(c, pack, { t: 0.16, freq: R(1046.5), dur: 0.46, vol: v * 1.1, pan: 0.25 }); /* C6 */
      } else {
        voiceNote(c, pack, { t: 0, freq: R(783.99), dur: 0.3, vol: v, pan: -0.2 });   /* G5 */
        voiceNote(c, pack, { t: 0.09, freq: R(1046.5), dur: 0.42, vol: v * 1.1, pan: 0.25 }); /* C6 */
      }
    } else if (kind === "pomo-done") {
      /* warm rising motif C5 E5 G5 C6 with gentle sway */
      voiceNote(c, pack, { t: 0, freq: R(523.25), dur: 0.5, vol: v, pan: -0.3 });
      voiceNote(c, pack, { t: 0.15, freq: R(659.25), dur: 0.5, vol: v, pan: 0 });
      voiceNote(c, pack, { t: 0.3, freq: R(783.99), dur: 0.55, vol: v, pan: 0.3 });
      voiceNote(c, pack, { t: 0.45, freq: R(1046.5), dur: 0.9, vol: v * 1.15, pan: 0 });
    } else if (kind === "celebrate") {
      /* rising major pentatonic sparkle + shimmer noise */
      const notes = [523.25, 587.33, 659.25, 783.99, 1046.5, 1318.5];
      notes.forEach((f, i) => {
        voiceNote(c, pack, { t: i * 0.085, freq: R(f), dur: 0.5 + i * 0.06, vol: v * (0.8 + i * 0.06), pan: (i % 2 ? 1 : -1) * 0.35 });
      });
      /* shimmer */
      const len = Math.floor(c.sampleRate * 0.4);
      const buf = c.createBuffer(1, len, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
      const src = c.createBufferSource();
      src.buffer = buf;
      const hp = c.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 6000;
      const g = c.createGain();
      g.gain.value = v * 0.5;
      src.connect(hp); hp.connect(g); g.connect(chimeBus!);
      sendReverb(g, 0.5);
      src.start(c.currentTime + 0.42);
    } else if (kind === "levelup") {
      /* fanfare: chord stab + ascending run + final chord */
      voiceNote(c, pack, { t: 0, freq: R(392), dur: 0.35, vol: v, pan: -0.3 });      /* G4 */
      voiceNote(c, pack, { t: 0, freq: R(493.88), dur: 0.35, vol: v * 0.8, pan: 0.3 }); /* B4 */
      voiceNote(c, pack, { t: 0, freq: R(587.33), dur: 0.35, vol: v * 0.8, pan: 0 });   /* D5 */
      [523.25, 587.33, 659.25, 783.99, 880].forEach((f, i) => {
        voiceNote(c, pack, { t: 0.22 + i * 0.09, freq: R(f), dur: 0.3, vol: v * 0.85, pan: (i % 2 ? 0.4 : -0.4) });
      });
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        voiceNote(c, pack, { t: 0.72, freq: R(f), dur: 1.1, vol: v * (i === 3 ? 1.1 : 0.8), pan: i === 0 ? -0.4 : i === 3 ? 0.4 : 0 });
      });
    }
  } catch {
    /* autoplay block or no audio hardware — stay silent */
  }
}

/* =========================================================
   Audio-Reactive Studio — synthesized generative streams + FFT
   ========================================================= */

export interface AudioStudioState {
  running: boolean;
  currentStream: string;
}

const studio = {
  analyser: null as AnalyserNode | null,
  dataArr: null as Uint8Array<ArrayBuffer> | null,
  running: false,
  currentStream: "",
  schedulerTimer: null as ReturnType<typeof setInterval> | null,
  nextNoteTime: 0,
  step: 0,
  whiteNoise: null as AudioBuffer | null,
  brownNoise: null as AudioBuffer | null,
  liveNodes: [] as (OscillatorNode | AudioBufferSourceNode)[],
  bedNodes: [] as (AudioBufferSourceNode | OscillatorNode | GainNode)[],
  micStream: null as MediaStream | null,
  nextThunderAt: 0,
  reactLevel: 0,
};

function makeNoiseBuffer(c: Ctx, brown: boolean): AudioBuffer {
  const len = c.sampleRate * 3;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  if (!brown) {
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } else {
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.021 * w) / 1.021;
      d[i] = last * 3.2;
    }
  }
  return buf;
}

function ensureStudioGraph(): boolean {
  const c = ensureAudio();
  if (!c || !musicBus) return false;
  if (!studio.analyser) {
    studio.analyser = c.createAnalyser();
    studio.analyser.fftSize = 128;
    studio.analyser.smoothingTimeConstant = 0.78;
    studio.dataArr = new Uint8Array(studio.analyser.frequencyBinCount);
    musicBus.connect(studio.analyser); /* analyser taps the music bus (pass-through) */
    studio.whiteNoise = makeNoiseBuffer(c, false);
    studio.brownNoise = makeNoiseBuffer(c, true);
  }
  return true;
}

function tone(t: number, freq: number, dur: number, type: OscillatorType, vol: number, filterFreq?: number, dest?: AudioNode, detune = 0) {
  const c = ctx!;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  let node: AudioNode = osc;
  if (filterFreq) {
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterFreq;
    osc.connect(f);
    node = f;
  }
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  node.connect(g);
  g.connect(dest ?? musicBus!);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  studio.liveNodes.push(osc);
  return g;
}

function kick(t: number, vol = 0.5) {
  const c = ctx!;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(46, t + 0.12);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
  osc.connect(g); g.connect(musicBus!);
  osc.start(t); osc.stop(t + 0.22);
  studio.liveNodes.push(osc);
}

function noiseHit(t: number, dur: number, vol: number, filterType: BiquadFilterType, filterFreq: number, dest?: AudioNode) {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = studio.whiteNoise!;
  src.loop = true;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest ?? musicBus!);
  src.start(t); src.stop(t + dur + 0.05);
  studio.liveNodes.push(src);
}

function chord(t: number, freqs: number[], dur: number, type: OscillatorType, vol: number, filterFreq: number, dest?: AudioNode) {
  freqs.forEach((fq, i) => tone(t, fq, dur, type, vol / Math.sqrt(freqs.length), filterFreq, dest, i % 2 ? 5 : -5));
}

/* ---------- persistent beds (rain / waves / forest) ---------- */

function startBed(kind: string) {
  if (studio.bedNodes.length) return;
  const c = ctx!;
  const stopAt = Number.POSITIVE_INFINITY;

  const loopNoise = (brown: boolean) => {
    const src = c.createBufferSource();
    src.buffer = brown ? studio.brownNoise! : studio.whiteNoise!;
    src.loop = true;
    return src;
  };

  if (kind === "rain") {
    /* layer 1: mid rain hiss */
    const s1 = loopNoise(false);
    const f1 = c.createBiquadFilter();
    f1.type = "bandpass"; f1.frequency.value = 1100; f1.Q.value = 0.5;
    const g1 = c.createGain(); g1.gain.value = 0.11;
    s1.connect(f1); f1.connect(g1); g1.connect(musicBus!);
    /* layer 2: low rumble */
    const s2 = loopNoise(true);
    const f2 = c.createBiquadFilter();
    f2.type = "lowpass"; f2.frequency.value = 160;
    const g2 = c.createGain(); g2.gain.value = 0.16;
    s2.connect(f2); f2.connect(g2); g2.connect(musicBus!);
    /* gentle breathing on the hiss */
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = c.createGain(); lg.gain.value = 0.035;
    lfo.connect(lg); lg.connect(g1.gain);
    s1.start(); s2.start(); lfo.start();
    studio.bedNodes = [s1, s2, lfo, g1, g2];
  } else if (kind === "waves") {
    /* brown-noise surf with two slow swell LFOs out of phase */
    const s = loopNoise(true);
    const f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 420;
    const g = c.createGain(); g.gain.value = 0.085;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.075;
    const lg = c.createGain(); lg.gain.value = 0.075;
    lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.045;
    const lg2 = c.createGain(); lg2.gain.value = 0.04;
    lfo2.connect(lg2); lg2.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(musicBus!);
    s.start(); lfo.start(); lfo2.start();
    studio.bedNodes = [s, lfo, lfo2, g];
  } else if (kind === "forest") {
    /* soft wind bed */
    const s = loopNoise(false);
    const f = c.createBiquadFilter();
    f.type = "lowpass"; f.frequency.value = 300;
    const g = c.createGain(); g.gain.value = 0.05;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.09;
    const lg = c.createGain(); lg.gain.value = 0.03;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(musicBus!);
    s.start(); lfo.start();
    studio.bedNodes = [s, lfo, g];
  }
  void stopAt;
}

function stopBeds() {
  studio.bedNodes.forEach((n) => {
    try {
      if ("stop" in n) (n as OscillatorNode | AudioBufferSourceNode).stop();
    } catch { /* already stopped */ }
    try { n.disconnect(); } catch { /* noop */ }
  });
  studio.bedNodes = [];
}

/* one-shot droplets / crickets / thunder scheduled per step */
function scheduleAmbience(kind: string, step: number, t: number) {
  const c = ctx!;
  if (kind === "rain") {
    /* droplet plinks: random chance each 8th */
    if (Math.random() < 0.55) {
      const f = 1400 + Math.random() * 2400;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.09);
      g.gain.setValueAtTime(0.045 + Math.random() * 0.04, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      const pan = c.createStereoPanner();
      pan.pan.value = Math.random() * 1.6 - 0.8;
      o.connect(g); g.connect(pan); pan.connect(musicBus!);
      sendReverb(pan, 0.2);
      o.start(t); o.stop(t + 0.12);
      studio.liveNodes.push(o);
    }
    /* distant thunder every ~20s */
    if (t > studio.nextThunderAt) {
      studio.nextThunderAt = t + 16 + Math.random() * 14;
      const src = c.createBufferSource();
      src.buffer = studio.brownNoise!;
      src.loop = true;
      const f = c.createBiquadFilter();
      f.type = "lowpass"; f.frequency.setValueAtTime(90, t);
      f.frequency.exponentialRampToValueAtTime(240, t + 1.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.22, t + 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      src.connect(f); f.connect(g); g.connect(musicBus!);
      sendReverb(g, 0.4);
      src.start(t); src.stop(t + 3.4);
      studio.liveNodes.push(src);
    }
  } else if (kind === "waves") {
    /* occasional splash */
    if (Math.random() < 0.14) {
      noiseHit(t + Math.random() * 0.4, 0.28, 0.05, "bandpass", 1600 + Math.random() * 900);
    }
  } else if (kind === "forest") {
    /* cricket chirps: 3 quick pulses, pattern repeats with variation */
    if (step % 3 === 0 && Math.random() < 0.9) {
      const base = 3900 + Math.random() * 700;
      const pan = c.createStereoPanner();
      pan.pan.value = Math.random() * 1.4 - 0.7;
      pan.connect(musicBus!);
      sendReverb(pan, 0.15);
      for (let i = 0; i < 3; i++) {
        const o = c.createOscillator();
        const g = c.createGain();
        const st = t + i * 0.075 + Math.random() * 0.02;
        o.type = "sine";
        o.frequency.value = base;
        g.gain.setValueAtTime(0.0001, st);
        g.gain.linearRampToValueAtTime(0.06, st + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.055);
        o.connect(g); g.connect(pan);
        o.start(st); o.stop(st + 0.07);
        studio.liveNodes.push(o);
      }
    }
  }
}

/* ---------- music schedulers ---------- */

const LOFI_CHORDS = [
  [174.61, 220.0, 261.63, 329.63, 415.3],   /* Fmaj7add9-ish */
  [164.81, 196.0, 246.94, 293.66, 392.0],   /* Em7-ish */
  [146.83, 174.61, 220.0, 261.63, 349.23],  /* Dm7-ish */
  [130.81, 164.81, 196.0, 246.94, 329.63],  /* Cmaj7-ish */
];
const LOFI_BASS = [43.65, 41.2, 36.71, 32.7];
const PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
let melodyDeg = 2;

function scheduleSynthStep(kind: string, step: number, t: number) {
  const bar = Math.floor(step / 8);
  const s = step % 8;
  const swing = kind === "lofi" && s % 2 === 1 ? 0.055 : 0;
  const tt = t + swing;

  if (kind === "lofi") {
    if (s === 0) kick(tt, 0.42);
    if (s === 4) { kick(tt, 0.3); noiseHit(tt, 0.14, 0.1, "bandpass", 1800); } /* snare-ish */
    if (s % 2 === 1) noiseHit(tt, 0.045, 0.045 + (s === 7 ? 0.03 : 0), "highpass", 8200); /* hats w/ velocity */
    if (s === 0) {
      chord(tt, LOFI_CHORDS[bar % 4], 1.7, "triangle", 0.085, 1350);
      tone(tt, LOFI_BASS[bar % 4] * 2, 0.7, "sine", 0.15, 320);
    }
    /* vinyl crackle: sparse ticks */
    if (Math.random() < 0.3) noiseHit(tt + Math.random() * 0.3, 0.014, 0.02 + Math.random() * 0.025, "highpass", 5200);
    /* lazy pentatonic melody random-walk on backbeats */
    if ((s === 2 || s === 6) && Math.random() < 0.75) {
      melodyDeg = Math.max(0, Math.min(PENTA.length - 1, melodyDeg + (Math.random() < 0.5 ? -1 : 1)));
      const g = tone(tt, PENTA[melodyDeg] * 2, 0.6, "sine", 0.05);
      sendReverb(g, 0.3);
      sendDelay(g, 0.12);
    }
  } else if (kind === "synthwave") {
    if (s === 0 || s === 4) kick(tt);
    if (s === 4) noiseHit(tt, 0.16, 0.1, "bandpass", 1600);
    if (s % 2 === 1) noiseHit(tt, 0.04, 0.045, "highpass", 9000);
    const rootArps = [[220.0, 261.63, 329.63, 440.0], [174.61, 220.0, 261.63, 349.23], [130.81, 164.81, 196.0, 261.63], [196.0, 246.94, 293.66, 392.0]];
    const cs = rootArps[bar % 4];
    /* driving bass eighths */
    if (s % 2 === 0) tone(tt, cs[0] / 2, 0.16, "sawtooth", 0.09, 500);
    /* arp through feedback delay */
    const ag = tone(tt, cs[step % 4] * 2, 0.13, "sawtooth", 0.05, 2600);
    sendDelay(ag, 0.4);
    if (s === 0) {
      chord(tt, cs, 1.5, "sawtooth", 0.032, 950);
      const pg = tone(tt, cs[0] * 2, 1.3, "square", 0.03, 700);
      sendReverb(pg, 0.25);
    }
  } else if (kind === "cosmic") {
    const pad = [
      [130.81, 196.0, 261.63, 392.0],
      [146.83, 220.0, 293.66, 440.0],
      [110.0, 164.81, 220.0, 329.63],
      [123.47, 185.0, 246.94, 369.99],
    ];
    if (s === 0) {
      chord(t, pad[bar % 4], 3.4, "sine", 0.08, 1200);
      /* detuned shimmer octave */
      chord(t, pad[bar % 4].map((f) => f * 2), 3.0, "sine", 0.02, 2400);
    }
    if (s === 0 || s === 5) {
      const g = tone(t + Math.random() * 0.25, PENTA[Math.floor(Math.random() * PENTA.length)], 1.9, "sine", 0.038);
      sendReverb(g, 0.55);
      sendDelay(g, 0.3);
    }
  } else if (kind === "rain" || kind === "waves" || kind === "forest") {
    if (step === 0) startBed(kind);
    if (kind === "rain") {
      if (step % 8 === 0) tone(t, 55, 1.2, "sine", 0.13, 130); /* sub pulse anchor */
    }
    scheduleAmbience(kind, step, t);
  }
}

export function stopAudioStream() {
  if (studio.schedulerTimer) { clearInterval(studio.schedulerTimer); studio.schedulerTimer = null; }
  studio.liveNodes.forEach((n) => { try { n.stop(); } catch { /* already stopped */ } });
  studio.liveNodes = [];
  stopBeds();
  if (studio.micStream) {
    studio.micStream.getTracks().forEach((t) => t.stop());
    studio.micStream = null;
  }
  studio.running = false;
  studio.reactLevel = 0;
}

export function isStudioRunning() {
  return studio.running;
}

export function getReactLevel() {
  return studio.running ? studio.reactLevel : 0;
}

export async function startAudioStream(kind: string): Promise<boolean> {
  if (!ensureStudioGraph() || !ctx) return false;
  stopAudioStream();
  studio.currentStream = kind;
  studio.step = 0;
  studio.nextThunderAt = ctx.currentTime + 12;

  if (kind === "mic") {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      studio.micStream = stream;
      if (ctx.state === "suspended") void ctx.resume();
      const src = ctx.createMediaStreamSource(stream);
      src.connect(studio.analyser!); // analyser only — no speaker feedback
      studio.running = true;
      return true;
    } catch {
      return false;
    }
  }

  if (ctx.state === "suspended") void ctx.resume();
  const stepDur = kind === "lofi" ? 60 / 78 / 2 : kind === "synthwave" ? 60 / 112 / 2 : 0.5;
  studio.nextNoteTime = ctx.currentTime + 0.08;
  studio.schedulerTimer = setInterval(() => {
    if (!ctx) return;
    while (studio.nextNoteTime < ctx.currentTime + 0.45) {
      scheduleSynthStep(kind, studio.step, studio.nextNoteTime);
      studio.nextNoteTime += stepDur;
      studio.step++;
    }
  }, 160);
  studio.running = true;
  return true;
}

/** Reads the current FFT frame; returns { bins, bass, mid, treble } or null. */
export function readFft(): { bins: Uint8Array<ArrayBuffer>; bass: number; mid: number; treble: number } | null {
  if (!studio.running || !studio.analyser || !studio.dataArr) return null;
  studio.analyser.getByteFrequencyData(studio.dataArr);
  const bins = studio.dataArr;
  let bass = 0, mid = 0, treble = 0;
  for (let b = 0; b <= 5; b++) bass += bins[b];
  for (let m = 6; m <= 25; m++) mid += bins[m];
  for (let t = 26; t < bins.length; t++) treble += bins[t];
  bass = bass / (6 * 255);
  mid = mid / (20 * 255);
  treble = treble / (Math.max(1, bins.length - 26) * 255);
  const target = bass * 0.5 + mid * 0.35 + treble * 0.15;
  studio.reactLevel = studio.reactLevel * 0.7 + target * 0.3;
  (window as unknown as { __gcAudioLevelRaw?: number }).__gcAudioLevelRaw = studio.reactLevel;
  return { bins, bass, mid, treble };
}
