"use client";

import { useEffect, useRef } from "react";
import styles from "./Scene.module.css";
import { createStars, DESKTOP_STAR_COUNT, PHONE_STAR_COUNT, type Star } from "./stars";

const PHONE_QUERY = "(max-width: 47.5rem)";
const DARK_QUERY = "(prefers-color-scheme: dark)";
const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

type Painter = {
  stars: Star[];
  sprite: HTMLCanvasElement;
};

function themeIsDark() {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "dark") return true;
  if (explicit === "light") return false;
  return window.matchMedia(DARK_QUERY).matches;
}

function starCount() {
  const narrow = window.matchMedia(PHONE_QUERY).matches;
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  const base = narrow ? PHONE_STAR_COUNT : DESKTOP_STAR_COUNT;
  return cores <= 4 || memory <= 4 ? Math.round(base / 2) : base;
}

function pixelRatioCap() {
  const cores = navigator.hardwareConcurrency || 8;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  return cores <= 4 || memory <= 4 ? 1.25 : 2;
}

function makeSprite() {
  const size = 64;
  const sprite = document.createElement("canvas");
  sprite.width = size;
  sprite.height = size;
  const context = sprite.getContext("2d");
  if (!context) return sprite;
  const glow = context.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  glow.addColorStop(0, "rgba(255,255,255,1)");
  glow.addColorStop(0.16, "rgba(255,252,246,0.9)");
  glow.addColorStop(0.42, "rgba(255,244,230,0.28)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, size, size);
  return sprite;
}

function skyFraction(width: number, height: number) {
  return height > width * 1.15 ? 0.7 : 0.56;
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    const painter: Painter = { stars: createStars(starCount()), sprite: makeSprite() };
    const reduceQuery = window.matchMedia(REDUCE_QUERY);
    const phoneQuery = window.matchMedia(PHONE_QUERY);
    const darkQuery = window.matchMedia(DARK_QUERY);
    let frame = 0;
    let running = false;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, pixelRatioCap());
      const width = Math.max(1, Math.round(bounds.width * ratio));
      const height = Math.max(1, Math.round(bounds.height * ratio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      return { width: bounds.width, height: bounds.height, ratio };
    };

    const draw = (now: number) => {
      const { width, height, ratio } = resize();
      const pixelsWide = canvas.width;
      const pixelsHigh = canvas.height;
      context.clearRect(0, 0, pixelsWide, pixelsHigh);
      const seconds = reduceQuery.matches ? 0 : now / 1000;
      const sky = height * skyFraction(width, height);
      for (const star of painter.stars) {
        const wave = 0.5 + 0.5 * Math.sin((seconds / star.period) * Math.PI * 2 + star.phase);
        const floor = star.bright ? 0.35 : 0.42;
        const alpha = star.alpha * (floor + (1 - floor) * wave);
        const x = (((star.x * width + star.drift * seconds) % width) + width) % width;
        const y = star.y * sky + Math.sin(seconds * 0.07 + star.phase) * (reduceQuery.matches ? 0 : 5);
        const halo = star.halo * ratio;
        context.globalAlpha = alpha;
        context.drawImage(painter.sprite, x * ratio - halo / 2, y * ratio - halo / 2, halo, halo);
      }
      context.globalAlpha = 1;
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    const tick = (now: number) => {
      draw(now);
      if (running) frame = requestAnimationFrame(tick);
    };

    const start = () => {
      const hidden = document.visibilityState === "hidden";
      const paused = document.documentElement.hasAttribute("data-scene-paused");
      const animate = !reduceQuery.matches && !hidden && !paused && themeIsDark();
      if (!animate) {
        stop();
        draw(0);
        return;
      }
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const rebuild = () => {
      painter.stars = createStars(starCount());
      start();
    };

    const observer = new ResizeObserver(() => start());
    observer.observe(canvas);
    const themeObserver = new MutationObserver(() => start());
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "data-scene-paused"],
    });
    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);
    reduceQuery.addEventListener("change", start);
    darkQuery.addEventListener("change", start);
    phoneQuery.addEventListener("change", rebuild);
    start();

    return () => {
      stop();
      observer.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceQuery.removeEventListener("change", start);
      darkQuery.removeEventListener("change", start);
      phoneQuery.removeEventListener("change", rebuild);
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.starfield} data-starfield />;
}
