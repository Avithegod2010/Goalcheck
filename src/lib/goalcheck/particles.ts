"use client";

/* =========================================================
   GoalCheck Pro — Particle engine (13 engines)
   Ports + fixes vs original:
   - pauses on document.hidden (RAF auto-pauses, but we also skip work)
   - reacts to audio via injected level getter
   - cursor physics: attract / repel / orbit
   - density/speed from settings
   ========================================================= */

import type { CursorPhysics, ParticleEngineId } from "./types";

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size?: number; radius?: number; len?: number;
  alpha: number;
  hue?: number;
  decay?: number;
  sway?: number; rot?: number; vrot?: number;
  cx?: number; cy?: number; ang?: number; rad?: number; speed?: number; inward?: number;
}

const MATRIX_CHARS = "010101XYZPYQCHECKLIST0123456789";

export interface EngineCtx {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  mode: ParticleEngineId;
  physics: CursorPhysics;
  speed: number;
  density: number;
  audioLevel: () => number;
  accent: string;
}

export class ParticleEngine {
  private e: EngineCtx;
  private particles: Particle[] = [];
  private matrixColumns: number[] = [];
  private fireworkTimer = 10;
  private raf = 0;
  private mouse = { x: -9999, y: -9999, active: false };

  constructor(e: EngineCtx) { this.e = e; }

  setCtx(patch: Partial<EngineCtx>) { Object.assign(this.e, patch); }

  start() {
    this.stop();
    this.resize();
    if (this.e.mode !== "off") {
      this.raf = requestAnimationFrame(this.loop);
    } else {
      this.e.ctx.clearRect(0, 0, this.e.canvas.width, this.e.canvas.height);
    }
  }

  stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    const { canvas } = this.e;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    this.initMode();
  }

  setPointer(x: number, y: number) { this.mouse.x = x; this.mouse.y = y; this.mouse.active = true; }
  clearPointer() { this.mouse.active = false; this.mouse.x = -9999; this.mouse.y = -9999; }

  private densityCount(base: number) {
    return Math.max(8, Math.round(base * (this.e.density / 70)));
  }

  private audioBoost() {
    return 1 + this.e.audioLevel() * 1.5 * 0.5;
  }

  private spawnOne(mode: ParticleEngineId, W: number, H: number): Particle | null {
    const ab = this.audioBoost();
    switch (mode) {
      case "fire": return { x: Math.random() * W, y: H + Math.random() * 100, size: (Math.random() * 4 + 1.5) * ab, vx: (Math.random() - 0.5) * 1.2, vy: -(Math.random() * 2.2 + 0.8), alpha: Math.random() * 0.7 + 0.3, hue: Math.random() > 0.4 ? Math.random() * 25 + 15 : Math.random() * 20 + 35 };
      case "stardust": return { x: Math.random() * W, y: Math.random() * H, size: (Math.random() * 2.5 + 1) * ab, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4, alpha: Math.random() * 0.6 + 0.2 };
      case "bubbles": return { x: Math.random() * W, y: H + Math.random() * 200, radius: (Math.random() * 18 + 8) * ab, vx: (Math.random() - 0.5) * 0.6, vy: -(Math.random() * 1.1 + 0.4), alpha: Math.random() * 0.35 + 0.15, hue: Math.random() * 60 + 280 };
      case "snow": return { x: Math.random() * W, y: -20 - Math.random() * 60, size: (Math.random() * 3 + 1) * ab, vx: (Math.random() - 0.5) * 0.6, vy: Math.random() * 1.2 + 0.4, alpha: Math.random() * 0.6 + 0.3, sway: Math.random() * Math.PI * 2 };
      case "rain": return { x: Math.random() * W, y: Math.random() * -H, len: (Math.random() * 14 + 8) * ab, vx: -0.8, vy: Math.random() * 7 + 9, alpha: Math.random() * 0.4 + 0.25 };
      case "galaxy": { const minDim = Math.min(W, H); const rad = Math.random() * minDim * 0.42 + 12; return { x: 0, y: 0, vx: 0, vy: 0, cx: W / 2, cy: H / 2, ang: Math.random() * Math.PI * 2, rad, size: (Math.random() * 2 + 0.6) * ab, speed: (Math.random() * 0.5 + 0.12) * Math.max(0.15, 1.1 - rad / (minDim * 0.5)), alpha: Math.random() * 0.55 + 0.25, hue: 220 + Math.random() * 100 }; }
      case "vortex": { const minDim = Math.min(W, H); return { x: 0, y: 0, vx: 0, vy: 0, cx: W / 2, cy: H / 2, ang: Math.random() * Math.PI * 2, rad: Math.random() * minDim * 0.46 + 6, size: (Math.random() * 2.4 + 1) * ab, speed: Math.random() * 0.035 + 0.015, inward: Math.random() * 0.35 + 0.12, alpha: Math.random() * 0.6 + 0.3, hue: Math.random() * 60 + 180 }; }
      case "constellation": return { x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.55, vy: (Math.random() - 0.5) * 0.55, size: (Math.random() * 2.2 + 1.2) * ab, alpha: Math.random() * 0.5 + 0.35 };
      case "embers": return { x: -30 - Math.random() * 80, y: Math.random() * H, vx: Math.random() * 6 + 5, vy: -(Math.random() * 1.4 + 0.3), size: (Math.random() * 2 + 0.8) * ab, alpha: Math.random() * 0.6 + 0.3, hue: Math.random() * 40 + 20 };
      case "petals": return { x: Math.random() * W, y: -20 - Math.random() * 60, size: (Math.random() * 5 + 3) * ab, vx: (Math.random() - 0.5) * 1, vy: Math.random() * 1.1 + 0.5, alpha: Math.random() * 0.5 + 0.35, rot: Math.random() * 360, vrot: (Math.random() - 0.5) * 3, hue: Math.random() * 30 + 330 };
      default: return null;
    }
  }

  private initMode() {
    this.particles = [];
    const { canvas, mode } = this.e;
    if (mode === "matrix") {
      const colCount = Math.floor(canvas.width / 20);
      this.matrixColumns = [];
      for (let c = 0; c < colCount; c++) this.matrixColumns.push(Math.random() * -100);
      return;
    }
    if (mode === "off" || mode === "fireworks") return;
    const baseCounts: Record<string, number> = { fire: 65, stardust: 70, bubbles: 35, snow: 80, rain: 90, galaxy: 220, vortex: 160, constellation: 55, embers: 45, petals: 45 };
    const count = this.densityCount(baseCounts[mode] || 60);
    for (let i = 0; i < count; i++) {
      const p = this.spawnOne(mode, canvas.width, canvas.height);
      if (p) {
        if (mode === "fire" || mode === "bubbles" || mode === "petals" || mode === "snow") p.y = Math.random() * canvas.height;
        this.particles.push(p);
      }
    }
  }

  private applyPhysics(p: Particle) {
    const mode = this.e.physics;
    if (!mode || mode === "none" || !this.mouse.active) return;
    const dx = p.x - this.mouse.x;
    const dy = p.y - this.mouse.y;
    const dist2 = dx * dx + dy * dy;
    if (dist2 > 170 * 170 || dist2 < 1) return;
    const dist = Math.sqrt(dist2);
    const fx = dx / dist, fy = dy / dist;
    if (mode === "attract") { p.vx -= fx * 0.09; p.vy -= fy * 0.09; }
    else if (mode === "repel") { p.vx += fx * 0.14; p.vy += fy * 0.14; }
    else if (mode === "orbit") { p.vx += -fy * 0.11; p.vy += fx * 0.11; }
    const sp = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
    if (sp > 6.5) { p.vx = (p.vx / sp) * 6.5; p.vy = (p.vy / sp) * 6.5; }
  }

  private spawnFireworkBurst() {
    const { canvas, density } = this.e;
    const bx = Math.random() * canvas.width;
    const by = Math.random() * canvas.height * 0.55 + 30;
    const hue = Math.random() * 360;
    const n = Math.round(28 * (density / 70));
    for (let i = 0; i < n; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = Math.random() * 3.4 + 0.6;
      this.particles.push({ x: bx, y: by, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd, size: Math.random() * 2.4 + 1, alpha: 1, decay: Math.random() * 0.011 + 0.006, hue: hue + Math.random() * 30 - 15 });
    }
  }

  private loop = () => {
    const { ctx, canvas, mode, speed } = this.e;
    const W = canvas.width, H = canvas.height;
    const ab = this.audioBoost();
    ctx.clearRect(0, 0, W, H);

    if (document.hidden || mode === "off") {
      // battery friendly: skip work when hidden, keep RAF alive
      this.raf = requestAnimationFrame(this.loop);
      return;
    }

    const spd = speed;

    if (mode === "matrix") {
      ctx.font = "14px monospace";
      ctx.fillStyle = "rgba(16, 185, 129, 0.4)";
      const mSpeed = 16 * spd;
      for (let m = 0; m < this.matrixColumns.length; m++) {
        const char = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
        const x = m * 20, y = this.matrixColumns[m];
        ctx.fillText(char, x, y);
        if (y > H && Math.random() > 0.98) this.matrixColumns[m] = 0;
        else this.matrixColumns[m] += mSpeed;
      }
    } else if (mode === "fire") {
      for (const p of this.particles) {
        this.applyPhysics(p);
        p.y += p.vy * spd * ab;
        p.x += p.vx * spd + Math.sin(p.y * 0.02) * 0.5;
        p.alpha -= 0.0035;
        if (p.y < -20 || p.alpha <= 0) {
          const np = this.spawnOne("fire", W, H);
          if (np) { p.y = H + 10; p.x = np.x; p.alpha = np.alpha; p.size = np.size; }
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size ?? 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 100%, 55%, ${p.alpha})`;
        ctx.shadowBlur = 10;
        ctx.shadowColor = `hsla(${p.hue}, 100%, 50%, 0.8)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (mode === "stardust" || mode === "constellation") {
      const linkDist = mode === "constellation" ? 110 : 85;
      const linkAlpha = mode === "constellation" ? 0.35 : 0.15;
      for (let s = 0; s < this.particles.length; s++) {
        const sp2 = this.particles[s];
        this.applyPhysics(sp2);
        sp2.x += sp2.vx * spd; sp2.y += sp2.vy * spd;
        if (sp2.x < 0) sp2.x = W; if (sp2.x > W) sp2.x = 0;
        if (sp2.y < 0) sp2.y = H; if (sp2.y > H) sp2.y = 0;
        ctx.beginPath();
        ctx.arc(sp2.x, sp2.y, sp2.size ?? 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(165, 180, 252, ${sp2.alpha})`;
        ctx.fill();
        for (let n = s + 1; n < this.particles.length; n++) {
          const np2 = this.particles[n];
          const dx = sp2.x - np2.x, dy = sp2.y - np2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < linkDist) {
            ctx.beginPath();
            ctx.moveTo(sp2.x, sp2.y); ctx.lineTo(np2.x, np2.y);
            ctx.strokeStyle = `rgba(165, 180, 252, ${linkAlpha * (1 - dist / linkDist)})`;
            ctx.stroke();
          }
        }
        if (this.mouse.active) {
          const mdx = sp2.x - this.mouse.x, mdy = sp2.y - this.mouse.y;
          const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mdist < 150) {
            ctx.beginPath();
            ctx.moveTo(sp2.x, sp2.y); ctx.lineTo(this.mouse.x, this.mouse.y);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.3 * (1 - mdist / 150)})`;
            ctx.stroke();
          }
        }
      }
    } else if (mode === "bubbles") {
      for (const bp of this.particles) {
        this.applyPhysics(bp);
        bp.y += bp.vy * spd * ab;
        bp.x += bp.vx * spd + Math.sin(bp.y * 0.015) * 0.4;
        if (bp.y < -(bp.radius ?? 10) * 2) {
          const nb = this.spawnOne("bubbles", W, H);
          if (nb) { bp.y = H + (bp.radius ?? 10) * 2; bp.x = nb.x; bp.radius = nb.radius; }
        }
        ctx.beginPath();
        ctx.arc(bp.x, bp.y, bp.radius ?? 10, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${bp.hue}, 75%, 65%, ${bp.alpha})`;
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = `hsla(${bp.hue}, 85%, 75%, ${bp.alpha + 0.2})`;
        ctx.stroke();
      }
    } else if (mode === "snow" || mode === "petals") {
      for (const fp of this.particles) {
        this.applyPhysics(fp);
        fp.sway = (fp.sway || 0) + 0.02 * spd;
        fp.x += (fp.vx + Math.sin(fp.sway) * 0.6) * spd;
        fp.y += fp.vy * spd * ab;
        fp.rot = (fp.rot || 0) + (fp.vrot || 0) * spd;
        if (fp.y > H + 24) {
          const nf = this.spawnOne(mode, W, H);
          if (nf) { fp.y = -20; fp.x = nf.x; fp.size = nf.size; fp.alpha = nf.alpha; }
        }
        if (fp.x < -24) fp.x = W + 20;
        if (fp.x > W + 24) fp.x = -20;
        if (mode === "petals") {
          ctx.save();
          ctx.translate(fp.x, fp.y);
          ctx.rotate(((fp.rot || 0) * Math.PI) / 180);
          ctx.beginPath();
          ctx.ellipse(0, 0, fp.size ?? 4, (fp.size ?? 4) * 0.55, 0, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${fp.hue}, 85%, 80%, ${fp.alpha})`;
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.arc(fp.x, fp.y, fp.size ?? 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${fp.alpha})`;
          ctx.fill();
        }
      }
    } else if (mode === "rain") {
      ctx.lineWidth = 1.4;
      for (const rp of this.particles) {
        this.applyPhysics(rp);
        rp.x += rp.vx * spd;
        rp.y += rp.vy * spd * ab;
        if (rp.y > H + 20) {
          const nr = this.spawnOne("rain", W, H);
          if (nr) { rp.y = -20; rp.x = nr.x; rp.vy = nr.vy; rp.len = nr.len; }
        }
        ctx.beginPath();
        ctx.moveTo(rp.x, rp.y);
        ctx.lineTo(rp.x + rp.vx * 2, rp.y + (rp.len ?? 10));
        ctx.strokeStyle = `rgba(148, 197, 253, ${rp.alpha})`;
        ctx.stroke();
      }
    } else if (mode === "fireworks") {
      this.fireworkTimer -= 1 * spd;
      if (this.fireworkTimer <= 0 || this.particles.length < this.densityCount(30)) {
        this.spawnFireworkBurst();
        this.fireworkTimer = 34 + Math.random() * 40;
      }
      for (let fw = this.particles.length - 1; fw >= 0; fw--) {
        const wp = this.particles[fw];
        this.applyPhysics(wp);
        wp.x += wp.vx * spd; wp.y += wp.vy * spd;
        wp.vy += 0.045 * spd;
        wp.vx *= 0.985; wp.vy *= 0.985;
        wp.alpha -= (wp.decay || 0.01) * spd;
        if (wp.alpha <= 0) { this.particles.splice(fw, 1); continue; }
        ctx.beginPath();
        ctx.arc(wp.x, wp.y, wp.size ?? 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${wp.hue}, 95%, 65%, ${wp.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${wp.hue}, 95%, 60%, ${wp.alpha})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    } else if (mode === "galaxy") {
      for (const gp of this.particles) {
        gp.ang = (gp.ang || 0) + (gp.speed || 0.2) * spd * ab;
        const gx = (gp.cx ?? W / 2) + Math.cos(gp.ang) * (gp.rad ?? 50);
        const gy = (gp.cy ?? H / 2) + Math.sin(gp.ang) * (gp.rad ?? 50) * 0.62;
        ctx.beginPath();
        ctx.arc(gx, gy, gp.size ?? 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${gp.hue}, 85%, 72%, ${gp.alpha})`;
        ctx.fill();
        if (Math.random() < 0.002) {
          gp.rad = (gp.rad ?? 50) + (Math.random() - 0.5) * 14;
          gp.rad = Math.max(8, Math.min(Math.min(W, H) * 0.46, gp.rad));
        }
      }
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, 5 * ab, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
      ctx.shadowBlur = 22;
      ctx.shadowColor = "rgba(180, 160, 255, 0.9)";
      ctx.fill();
      ctx.shadowBlur = 0;
    } else if (mode === "vortex") {
      for (const vp of this.particles) {
        vp.ang = (vp.ang || 0) + (vp.speed || 0.02) * spd * ab;
        vp.rad = (vp.rad ?? 100) - (vp.inward || 0.2) * spd;
        if (vp.rad < 6) {
          const nv = this.spawnOne("vortex", W, H);
          if (nv) {
            vp.rad = Math.min(W, H) * 0.46;
            vp.ang = nv.ang; vp.speed = nv.speed; vp.inward = nv.inward;
          }
        }
        const vx2 = (vp.cx ?? W / 2) + Math.cos(vp.ang ?? 0) * (vp.rad ?? 0);
        const vy2 = (vp.cy ?? H / 2) + Math.sin(vp.ang ?? 0) * (vp.rad ?? 0);
        ctx.beginPath();
        ctx.arc(vx2, vy2, vp.size ?? 2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${vp.hue}, 90%, 68%, ${vp.alpha})`;
        ctx.fill();
      }
    } else if (mode === "embers") {
      for (const ep of this.particles) {
        this.applyPhysics(ep);
        ep.x += ep.vx * spd; ep.y += ep.vy * spd;
        ep.alpha -= 0.004 * spd;
        if (ep.x > W + 40 || ep.alpha <= 0) {
          const ne = this.spawnOne("embers", W, H);
          if (ne) {
            ep.x = -30 - Math.random() * 60;
            ep.y = Math.random() * H;
            ep.vx = ne.vx; ep.vy = ne.vy; ep.alpha = ne.alpha; ep.size = ne.size;
          }
        }
        ctx.beginPath();
        ctx.arc(ep.x, ep.y, ep.size ?? 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${ep.hue}, 95%, 65%, ${ep.alpha})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `hsla(${ep.hue}, 95%, 60%, 0.9)`;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }

    this.raf = requestAnimationFrame(this.loop);
  };
}

/* =========================================================
   Confetti — single-flight loop, self-terminating
   ========================================================= */

export function runConfetti(canvas: HTMLCanvasElement, reduced: boolean): void {
  if (reduced) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ["#6366f1", "#10b981", "#f59e0b", "#ec4899", "#06b6d4", "#f43f5e", "#a855f7"];
  const items = Array.from({ length: 110 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height * 0.3 - 50,
    w: Math.random() * 10 + 6,
    h: Math.random() * 6 + 4,
    color: colors[Math.floor(Math.random() * colors.length)],
    vy: Math.random() * 4.5 + 3,
    vx: (Math.random() - 0.5) * 4,
    rot: Math.random() * 360,
    vrot: (Math.random() - 0.5) * 10,
  }));

  let frame = 0;
  let raf = 0;
  function step() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);
    for (const p of items) {
      p.y += p.vy; p.x += p.vx; p.rot += p.vrot;
      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate((p.rot * Math.PI) / 180);
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx!.restore();
    }
    frame++;
    if (frame < 160) raf = requestAnimationFrame(step);
    else ctx!.clearRect(0, 0, canvas.width, canvas.height);
  }
  cancelAnimationFrame(raf);
  requestAnimationFrame(step);
}
