/**
 * AudioVisualizer – Animated orb that reacts to voice activity.
 *
 * States:
 *  - idle:           subtle slow pulse (indigo)
 *  - listening:      gentle breathing (indigo)
 *  - user-speaking:  expanding ripples driven by mic energy (cyan)
 *  - ai-responding:  pulsing glow (purple)
 */

import { useEffect, useRef } from "react";
import type { ChatPhase } from "../types/gemini";
import type { VADState } from "../lib/vad-analyzer";

interface Props {
  chatPhase: ChatPhase;
  vadState: VADState;
}

// Colour palette
const COLORS: Record<ChatPhase, { core: string; glow: string }> = {
  idle: { core: "#6366f1", glow: "rgba(99,102,241,0.25)" },
  listening: { core: "#818cf8", glow: "rgba(129,140,248,0.3)" },
  "user-speaking": { core: "#22d3ee", glow: "rgba(34,211,238,0.35)" },
  "ai-responding": { core: "#a78bfa", glow: "rgba(167,139,250,0.35)" },
};

export function AudioVisualizer({ chatPhase, vadState }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const phaseRef = useRef(chatPhase);
  const energyRef = useRef(vadState.smoothedEnergy);

  phaseRef.current = chatPhase;
  energyRef.current = vadState.smoothedEnergy;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", resize);

    let t = 0;

    const draw = () => {
      t += 0.016; // ~60 fps
      const W = canvas.width / dpr;
      const H = canvas.height / dpr;
      const cx = W / 2;
      const cy = H / 2;

      ctx.clearRect(0, 0, W, H);

      const phase = phaseRef.current;
      const energy = energyRef.current;
      const { core, glow } = COLORS[phase];

      // Base radius
      const baseR = Math.min(W, H) * 0.18;

      // Dynamic radius influenced by energy and phase
      let dynScale = 1;
      if (phase === "user-speaking") {
        dynScale = 1 + Math.min(energy * 12, 0.5);
      } else if (phase === "ai-responding") {
        dynScale = 1 + 0.12 * Math.sin(t * 4);
      } else if (phase === "listening") {
        dynScale = 1 + 0.05 * Math.sin(t * 1.5);
      } else {
        dynScale = 1 + 0.03 * Math.sin(t * 0.8);
      }

      const r = baseR * dynScale;

      // ---- Outer glow rings ----
      const ringCount = phase === "user-speaking" ? 4 : 2;
      for (let i = ringCount; i > 0; i--) {
        const ringR =
          r +
          i * 18 +
          (phase === "user-speaking" ? energy * 60 : 0) +
          Math.sin(t * 2 + i) * 4;
        const alpha = (0.12 - i * 0.025) * (phase === "idle" ? 0.5 : 1);

        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = glow.replace(
          /[\d.]+\)$/,
          `${Math.max(0, alpha)})`,
        );
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // ---- Outer glow (radial gradient) ----
      const glowR = r * 2.2;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, glowR);
      grad.addColorStop(0, glow);
      grad.addColorStop(1, "transparent");
      ctx.beginPath();
      ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();

      // ---- Main orb ----
      const orbGrad = ctx.createRadialGradient(
        cx - r * 0.3,
        cy - r * 0.3,
        0,
        cx,
        cy,
        r,
      );
      orbGrad.addColorStop(0, lightenColor(core, 40));
      orbGrad.addColorStop(0.7, core);
      orbGrad.addColorStop(1, darkenColor(core, 30));

      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.fill();

      // ---- Inner highlight ----
      ctx.beginPath();
      ctx.arc(cx - r * 0.2, cy - r * 0.2, r * 0.35, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fill();

      animRef.current = requestAnimationFrame(draw);
    };

    animRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}

// ---- colour helpers -------------------------------------------------------

function lightenColor(hex: string, pct: number): string {
  return adjustColor(hex, pct);
}

function darkenColor(hex: string, pct: number): string {
  return adjustColor(hex, -pct);
}

function adjustColor(hex: string, pct: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + pct));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + pct));
  const b = Math.min(255, Math.max(0, (num & 0xff) + pct));
  return `rgb(${r},${g},${b})`;
}
