"use client";

/* =========================================================
   Effects layer: particle canvas, confetti, theme ripple, XP floats
   FIX vs original: honours prefers-reduced-motion + "reduce effects"
   setting; pauses particle work when tab hidden; ripple uses normal
   blending on light themes (CSS) instead of washed-out screen blend.
   ========================================================= */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { bus, useStore } from "@/lib/goalcheck/store";
import { ParticleEngine, runConfetti } from "@/lib/goalcheck/particles";
import { playChime } from "@/lib/goalcheck/audio";
import { isLightTheme } from "@/lib/goalcheck/themes";
import { GC_THEME_VARS } from "@/lib/goalcheck/themes";
import { hasFeature } from "@/lib/goalcheck/editions";

export default function Effects() {
  const reduceEffects = useStore((s) => s.settings.reduceEffects);
  const particles = useStore((s) => s.particles);
  const physics = useStore((s) => s.settings.cursorPhysics);
  const speed = useStore((s) => s.settings.simSpeed);
  const density = useStore((s) => s.settings.simDensity);
  const theme = useStore((s) => s.theme);
  const chimePack = useStore((s) => s.settings.chimePack);
  const chimeVolume = useStore((s) => s.settings.chimeVolume);
  const customTheme = useStore((s) => s.customTheme);

  const particleCanvas = useRef<HTMLCanvasElement>(null);
  const confettiCanvas = useRef<HTMLCanvasElement>(null);
  const rippleRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<ParticleEngine | null>(null);
  const [xpFloats, setXpFloats] = useState<{ id: number; text: string; x: number; y: number }[]>([]);

  /* system reduced-motion (external store, lint-safe) */
  const sysReduced = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false
  );

  const reduced = reduceEffects || sysReduced;

  /* theme attribute + light flag on <html> */
  useEffect(() => {
    document.documentElement.setAttribute("data-gc-theme", theme);
    document.documentElement.setAttribute("data-gc-light", isLightTheme(theme) ? "1" : "0");
  }, [theme]);

  /* reduce-effects body class */
  useEffect(() => {
    document.documentElement.classList.toggle("gc-reduce", reduced);
  }, [reduced]);

  /* v4 — custom shared theme (JSON import) injected as CSS var overrides */
  useEffect(() => {
    const el = document.documentElement;
    if (!customTheme || Object.keys(customTheme).length === 0) {
      GC_THEME_VARS.forEach((name) => el.style.removeProperty(name));
      return;
    }
    GC_THEME_VARS.forEach((name) => {
      const v = customTheme[name];
      if (v) el.style.setProperty(name, v);
      else el.style.removeProperty(name);
    });
    return () => {
      GC_THEME_VARS.forEach((name) => el.style.removeProperty(name));
    };
  }, [customTheme]);

  /* particle engine lifecycle */
  useEffect(() => {
    if (!particleCanvas.current) return;
    const ctx2d = particleCanvas.current.getContext("2d");
    if (!ctx2d) return;

    if (reduced || particles === "off") {
      engineRef.current?.stop();
      engineRef.current = null;
      ctx2d.clearRect(0, 0, particleCanvas.current.width, particleCanvas.current.height);
      return;
    }

    const engine = new ParticleEngine({
      canvas: particleCanvas.current,
      ctx: ctx2d,
      mode: particles,
      physics,
      speed,
      density,
      audioLevel: () => (window as unknown as { __gcAudioLevel?: number }).__gcAudioLevel ?? 0,
      accent: "",
    });
    engineRef.current = engine;
    engine.start();

    const onResize = () => engine.resize();
    const onMove = (e: PointerEvent) => engine.setPointer(e.clientX, e.clientY);
    const onLeave = () => engine.clearPointer();
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseleave", onLeave);
    return () => {
      engine.stop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", onLeave);
    };
  }, [particles, physics, speed, density, reduced]);

  /* bus: confetti / ripple / chime / xp floats */
  useEffect(() => {
    let confettiRunning = false;
    return bus.on((e) => {
      if (e.type === "confetti") {
        if (reduced || confettiRunning || !confettiCanvas.current) return;
        confettiRunning = true;
        runConfetti(confettiCanvas.current, false);
        setTimeout(() => { confettiRunning = false; }, 2800);
      } else if (e.type === "chime") {
        const st = useStore.getState().settings;
        playChime(e.kind, st.chimePack, st.chimeVolume, e.priority);
      } else if (e.type === "ripple") {
        if (reduced || !hasFeature("ripple") || !rippleRef.current) return;
        const r = rippleRef.current;
        r.style.setProperty("--ripple-x", (e.x ?? window.innerWidth * 0.85) + "px");
        r.style.setProperty("--ripple-y", (e.y ?? window.innerHeight * 0.05) + "px");
        r.classList.remove("animating");
        void r.offsetWidth;
        r.classList.add("animating");
      } else if (e.type === "xp") {
        if (!useStore.getState().settings.rpgEnabled) return;
        const id = Date.now() + Math.random();
        setXpFloats((f) => [...f.slice(-6), { id, text: e.text, x: e.x, y: e.y }]);
        setTimeout(() => setXpFloats((f) => f.filter((x) => x.id !== id)), 1300);
      }
    });
  }, [reduced, chimePack, chimeVolume]);

  return (
    <>
      <canvas
        ref={particleCanvas}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 h-full w-full"
      />
      <canvas
        ref={confettiCanvas}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[9999] h-full w-full"
      />
      <div ref={rippleRef} className="gc-ripple" aria-hidden="true" />
      {xpFloats.map((f) => (
        <div key={f.id} className="xp-float" style={{ left: f.x, top: f.y - 18 }}>
          {f.text}
        </div>
      ))}
    </>
  );
}
