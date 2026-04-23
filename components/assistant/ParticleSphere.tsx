"use client";

import { useEffect, useRef } from "react";

import type { AssistantVisualState } from "@/types/assistant-ui";

type ParticleSphereProps = {
  state: AssistantVisualState;
  /** 렌더 크기(px). 외부에서 responsive 값을 넘겨 쓴다. */
  size: number;
  className?: string;
};

/**
 * 3D 파티클 구 (순수 Canvas 2D).
 *
 * 외부 의존성 없이 구현하기 위해 three.js 계열은 쓰지 않는다.
 * 구현 개념:
 *   - 단위 구 위에 골고루 분포된 N 개의 점을 미리 생성한다 (fibonacci sphere).
 *   - 매 프레임 y 축(그리고 약한 x 축) 회전 행렬을 적용한 뒤 z 값에 기반해
 *     2D 로 투영한다. z 가 클수록 큰 원 + 더 진한 알파.
 *   - state 별로 회전 속도, 진폭(breathing), glow, desaturation 을 점진적으로
 *     target 값으로 보간해 애니메이션이 뚝뚝 끊기지 않게 한다.
 *
 * 성능:
 *   - N=180 정도로 유지. 60fps 에서도 미미.
 *   - DPR(devicePixelRatio) 2 까지 대응. 그 이상은 clamp 해서 저사양 보호.
 *   - reduce-motion 환경에서는 회전을 멈추고 breathing 만 아주 약하게 유지.
 */
export default function ParticleSphere({
  state,
  size,
  className,
}: ParticleSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<AssistantVisualState>(state);

  // state prop 이 바뀌면 rAF 루프가 읽는 ref 도 맞춰둔다.
  // ref 는 commit 이후에 쓰여야 하므로 effect 에서 동기화한다.
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    );
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const points = generateFibonacciSphere(180);

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // 애니메이션 파라미터. target 값을 향해 매 프레임 lerp 한다.
    const anim = {
      yaw: 0,
      pitchWobble: 0,
      breathing: 0,
      time: 0,
      // 이 세 값은 상태에 따라 바뀌는 target.
      speedCurrent: 0.15,
      speedTarget: 0.15,
      amplitudeCurrent: 1.0,
      amplitudeTarget: 1.0,
      glowCurrent: 0.25,
      glowTarget: 0.25,
      // error 색 보간
      dangerCurrent: 0,
      dangerTarget: 0,
    };

    let rafId = 0;
    let last = performance.now();

    function configureFor(state: AssistantVisualState) {
      switch (state) {
        case "idle":
          anim.speedTarget = prefersReducedMotion ? 0.02 : 0.18;
          anim.amplitudeTarget = 1.0;
          anim.glowTarget = 0.22;
          anim.dangerTarget = 0;
          break;
        case "focused":
          anim.speedTarget = prefersReducedMotion ? 0.03 : 0.32;
          anim.amplitudeTarget = 1.06;
          anim.glowTarget = 0.35;
          anim.dangerTarget = 0;
          break;
        case "thinking":
          anim.speedTarget = prefersReducedMotion ? 0.05 : 0.9;
          anim.amplitudeTarget = 1.1;
          anim.glowTarget = 0.55;
          anim.dangerTarget = 0;
          break;
        case "responding":
          anim.speedTarget = prefersReducedMotion ? 0.05 : 0.7;
          anim.amplitudeTarget = 1.14;
          anim.glowTarget = 0.6;
          anim.dangerTarget = 0;
          break;
        case "error":
          anim.speedTarget = prefersReducedMotion ? 0.02 : 0.25;
          anim.amplitudeTarget = 0.96;
          anim.glowTarget = 0.45;
          anim.dangerTarget = 1;
          break;
        default: {
          const _exhaustive: never = state;
          void _exhaustive;
        }
      }
    }

    configureFor(stateRef.current);

    function draw(now: number) {
      if (!ctx) return;
      const dt = Math.min(50, now - last) / 1000;
      last = now;

      configureFor(stateRef.current);

      // 부드러운 보간. dt-독립 lerp.
      anim.speedCurrent = lerp(anim.speedCurrent, anim.speedTarget, 1 - Math.exp(-dt * 4));
      anim.amplitudeCurrent = lerp(anim.amplitudeCurrent, anim.amplitudeTarget, 1 - Math.exp(-dt * 4));
      anim.glowCurrent = lerp(anim.glowCurrent, anim.glowTarget, 1 - Math.exp(-dt * 4));
      anim.dangerCurrent = lerp(anim.dangerCurrent, anim.dangerTarget, 1 - Math.exp(-dt * 3));

      anim.time += dt;
      anim.yaw += anim.speedCurrent * dt;
      anim.pitchWobble = Math.sin(anim.time * 0.6) * 0.15;
      anim.breathing = Math.sin(anim.time * 1.5) * 0.03;

      const w = canvas!.width;
      const h = canvas!.height;

      ctx.clearRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;
      // 구 반지름: 캔버스 안쪽으로 조금 여유를 둔다.
      const r =
        (Math.min(w, h) / 2) *
        0.78 *
        (anim.amplitudeCurrent + anim.breathing);

      // 뒤에서 앞으로 그리도록 z 정렬.
      const sinY = Math.sin(anim.yaw);
      const cosY = Math.cos(anim.yaw);
      const sinX = Math.sin(anim.pitchWobble);
      const cosX = Math.cos(anim.pitchWobble);

      const projected: Array<{ x: number; y: number; z: number }> = [];
      for (const p of points) {
        // Y-axis rotation
        const x1 = p.x * cosY + p.z * sinY;
        const z1 = -p.x * sinY + p.z * cosY;
        const y1 = p.y;
        // X-axis wobble
        const y2 = y1 * cosX - z1 * sinX;
        const z2 = y1 * sinX + z1 * cosX;
        projected.push({ x: x1, y: y2, z: z2 });
      }
      projected.sort((a, b) => a.z - b.z);

      // danger 보간: blue-white -> red
      const baseR = 180 + anim.dangerCurrent * 60;
      const baseG = 192 - anim.dangerCurrent * 90;
      const baseB = 240 - anim.dangerCurrent * 150;

      // 배경 glow
      const glowAlpha = 0.08 + anim.glowCurrent * 0.22;
      const glowRadius = r * 1.45;
      const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, glowRadius);
      grad.addColorStop(0, `rgba(${baseR | 0}, ${baseG | 0}, ${baseB | 0}, ${glowAlpha})`);
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // 점
      for (const p of projected) {
        // z ∈ [-1, 1]. 앞쪽 점일수록 밝고 큼.
        const depth = (p.z + 1) / 2; // 0..1
        const alpha = 0.15 + depth * 0.85;
        const dotR = (0.7 + depth * 2.2) * (dpr * 0.8);
        const x = cx + p.x * r;
        const y = cy + p.y * r;
        ctx.fillStyle = `rgba(${baseR | 0}, ${baseG | 0}, ${baseB | 0}, ${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, dotR, 0, Math.PI * 2);
        ctx.fill();
      }

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        width: size,
        height: size,
        display: "block",
      }}
    />
  );
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * 단위 구 위에 점을 골고루 분포. 황금각을 이용한 fibonacci sphere.
 */
function generateFibonacciSphere(
  n: number,
): Array<{ x: number; y: number; z: number }> {
  const pts: Array<{ x: number; y: number; z: number }> = [];
  const offset = 2 / n;
  const increment = Math.PI * (3 - Math.sqrt(5)); // 황금각
  for (let i = 0; i < n; i++) {
    const y = i * offset - 1 + offset / 2;
    const r = Math.sqrt(1 - y * y);
    const phi = i * increment;
    const x = Math.cos(phi) * r;
    const z = Math.sin(phi) * r;
    pts.push({ x, y, z });
  }
  return pts;
}
