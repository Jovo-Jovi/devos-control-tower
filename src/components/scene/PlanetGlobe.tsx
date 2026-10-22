"use client";

import { useEffect, useRef } from "react";
import styles from "./Planet.module.css";
import { backingSize, centreU, sampleSphere, translateX } from "./sphere";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";
const DARK_QUERY = "(prefers-color-scheme: dark)";

const VERTEX_SOURCE = `attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAGMENT_SOURCE = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D u_tex;
uniform float u_centre;
uniform vec2 u_resolution;
void main() {
  float x = gl_FragCoord.x / u_resolution.x * 2.0 - 1.0;
  float y = 1.0 - gl_FragCoord.y / u_resolution.y * 2.0;
  float radius2 = x * x + y * y;
  if (radius2 > 1.0) {
    float inv = inversesqrt(radius2);
    x *= inv;
    y *= inv;
  }
  float z = sqrt(max(0.0, 1.0 - x * x - y * y));
  float u = u_centre + atan(x, z) / 6.283185307179586;
  float v = 0.5 + asin(clamp(y, -1.0, 1.0)) / 3.141592653589793;
  gl_FragColor = texture2D(u_tex, vec2(u, v));
}`;

type GlobeDraw = {
  gl: WebGLRenderingContext;
  program: WebGLProgram;
  buffer: WebGLBuffer;
  texture: WebGLTexture;
  centre: WebGLUniformLocation;
  resolution: WebGLUniformLocation;
  sampler: WebGLUniformLocation;
};

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createDrawState(gl: WebGLRenderingContext): GlobeDraw | null {
  const vertex = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
  const fragment = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SOURCE);
  if (!vertex || !fragment) return null;
  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "a_pos");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const centre = gl.getUniformLocation(program, "u_centre");
  const resolution = gl.getUniformLocation(program, "u_resolution");
  const sampler = gl.getUniformLocation(program, "u_tex");
  const buffer = gl.createBuffer();
  const texture = gl.createTexture();
  if (!centre || !resolution || !sampler || !buffer || !texture) {
    gl.deleteProgram(program);
    return null;
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  return { gl, program, buffer, texture, centre, resolution, sampler };
}

function uploadTexture(draw: GlobeDraw, image: HTMLImageElement) {
  const { gl, texture } = draw;
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.generateMipmap(gl.TEXTURE_2D);
}

function readStripUrl(strip: HTMLElement): string | null {
  const value = getComputedStyle(strip).backgroundImage;
  const match = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)\s]+))\s*\)/.exec(value);
  if (!match) return null;
  const url = match[1] ?? match[2] ?? match[3];
  return url || null;
}

function rasteriseStrip(image: HTMLImageElement): ImageData | null {
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (width < 1 || height < 1) return null;
  try {
    const offscreen = new OffscreenCanvas(width, height);
    const context = offscreen.getContext("2d", { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    return context.getImageData(0, 0, width, height);
  } catch {
    return null;
  }
}

function texel(coord: number, size: number, wrap: boolean): number {
  let index = Math.floor(coord * size);
  if (wrap) {
    index %= size;
    if (index < 0) index += size;
    return index;
  }
  if (index < 0) return 0;
  if (index >= size) return size - 1;
  return index;
}

export function PlanetGlobe({ side }: { side: "day" | "crimson" }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const spin = parent.querySelector("[data-planet-spin]");
    const turn = parent.querySelector("[data-planet-turn]");
    const strip = parent.querySelector("[data-planet-strip]");
    if (!(spin instanceof HTMLElement) || !(turn instanceof HTMLElement) || !(strip instanceof HTMLElement)) return;

    let stopped = false;
    let frame = 0;
    let looping = false;
    let requested = "";
    let generation = 0;
    let drawState: GlobeDraw | null = null;
    let context2d: CanvasRenderingContext2D | null = null;
    let source: ImageData | null = null;
    let imageEl: HTMLImageElement | null = null;
    let mode: "webgl" | "2d" | "none" = "none";
    const reduceQuery = window.matchMedia(REDUCE_QUERY);
    const darkQuery = window.matchMedia(DARK_QUERY);
    const html = document.documentElement;

    const shouldLoop = () =>
      canvas.getAttribute("data-planet-renderer") === "webgl" &&
      !reduceQuery.matches &&
      document.visibilityState !== "hidden" &&
      !html.hasAttribute("data-scene-paused");

    const syncSize = () => {
      const rect = canvas.getBoundingClientRect();
      const next = backingSize(rect.width, window.devicePixelRatio || 1);
      if (canvas.width !== next || canvas.height !== next) {
        canvas.width = next;
        canvas.height = next;
      }
    };

    const readCentre = () => {
      const tile = Number.parseFloat(getComputedStyle(canvas).getPropertyValue("--planet-tile-inline"));
      const turnX = translateX(getComputedStyle(turn).transform);
      const spinX = translateX(getComputedStyle(spin).transform);
      return centreU(spinX, turnX, tile);
    };

    const paint2d = () => {
      if (!context2d || !source) return;
      syncSize();
      const centre = readCentre();
      const width = canvas.width;
      const height = canvas.height;
      const pixels = context2d.createImageData(width, height);
      const output = pixels.data;
      const input = source.data;
      const srcWidth = source.width;
      const srcHeight = source.height;
      for (let row = 0; row < height; row += 1) {
        const y0 = ((row + 0.5) / height) * 2 - 1;
        for (let column = 0; column < width; column += 1) {
          let x = ((column + 0.5) / width) * 2 - 1;
          let y = y0;
          const radius2 = x * x + y * y;
          if (radius2 > 1) {
            const inv = 1 / Math.sqrt(radius2);
            x *= inv;
            y *= inv;
          }
          const sample = sampleSphere(x, y, centre) ?? sampleSphere(x * (1 - 1e-6), y * (1 - 1e-6), centre);
          const offset = (row * width + column) * 4;
          if (!sample) {
            output[offset + 3] = 255;
            continue;
          }
          const texX = texel(sample.u, srcWidth, true);
          const texY = texel(sample.v, srcHeight, false);
          const sourceOffset = (texY * srcWidth + texX) * 4;
          output[offset] = input[sourceOffset] ?? 0;
          output[offset + 1] = input[sourceOffset + 1] ?? 0;
          output[offset + 2] = input[sourceOffset + 2] ?? 0;
          output[offset + 3] = 255;
        }
      }
      context2d.putImageData(pixels, 0, 0);
      canvas.setAttribute("data-planet-drawn", "");
    };

    const paintWebgl = () => {
      if (!drawState || drawState.gl.isContextLost()) return;
      const { gl } = drawState;
      syncSize();
      const centre = readCentre();
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(drawState.program);
      gl.bindBuffer(gl.ARRAY_BUFFER, drawState.buffer);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, drawState.texture);
      gl.uniform1i(drawState.sampler, 0);
      gl.uniform1f(drawState.centre, centre);
      gl.uniform2f(drawState.resolution, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
      if (gl.isContextLost()) return;
      canvas.setAttribute("data-planet-drawn", "");
    };

    const draw = () => {
      if (mode === "2d") paint2d();
      else paintWebgl();
    };

    const stopLoop = () => {
      looping = false;
      cancelAnimationFrame(frame);
      canvas.removeAttribute("data-planet-running");
    };

    const tick = () => {
      if (!looping || stopped) return;
      draw();
      if (looping) frame = requestAnimationFrame(tick);
    };

    const canDraw = () => {
      if (mode === "webgl") return drawState !== null;
      if (mode === "2d") return context2d !== null && source !== null;
      return false;
    };

    const reevaluate = () => {
      if (stopped || !canDraw()) return;
      if (shouldLoop()) {
        if (looping) return;
        looping = true;
        canvas.setAttribute("data-planet-running", "");
        frame = requestAnimationFrame(tick);
        return;
      }
      stopLoop();
      draw();
    };

    const onContextLost = (event: Event) => {
      event.preventDefault();
      drawState = null;
      stopLoop();
      canvas.removeAttribute("data-planet-drawn");
    };

    const onContextRestored = () => {
      if (stopped || mode !== "webgl" || !imageEl) return;
      const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
      if (!gl || gl.isContextLost()) return;
      const created = createDrawState(gl);
      if (!created) {
        mode = "none";
        canvas.setAttribute("data-planet-renderer", "none");
        return;
      }
      drawState = created;
      uploadTexture(drawState, imageEl);
      canvas.setAttribute("data-planet-renderer", "webgl");
      reevaluate();
    };

    const boot = (image: HTMLImageElement) => {
      const gl = canvas.getContext("webgl", { alpha: false, antialias: false });
      if (gl) {
        const created = createDrawState(gl);
        if (!created) {
          canvas.setAttribute("data-planet-renderer", "none");
          gl.getExtension("WEBGL_lose_context")?.loseContext();
          return false;
        }
        drawState = created;
        mode = "webgl";
        canvas.setAttribute("data-planet-renderer", "webgl");
        uploadTexture(drawState, image);
        canvas.addEventListener("webglcontextlost", onContextLost);
        canvas.addEventListener("webglcontextrestored", onContextRestored);
        return true;
      }
      const flat = canvas.getContext("2d");
      if (!flat) {
        mode = "none";
        canvas.setAttribute("data-planet-renderer", "none");
        return false;
      }
      const pixels = rasteriseStrip(image);
      if (!pixels) {
        mode = "none";
        canvas.setAttribute("data-planet-renderer", "none");
        return false;
      }
      context2d = flat;
      source = pixels;
      mode = "2d";
      canvas.setAttribute("data-planet-renderer", "2d");
      return true;
    };

    const adopt = (image: HTMLImageElement) => {
      imageEl = image;
      if (mode === "webgl") {
        if (!drawState) return false;
        uploadTexture(drawState, image);
        return true;
      }
      if (mode === "2d") {
        const pixels = rasteriseStrip(image);
        if (!pixels) return false;
        source = pixels;
        return true;
      }
      return boot(image);
    };

    const load = async (url: string) => {
      const token = generation + 1;
      generation = token;
      const image = new Image();
      image.src = url;
      try {
        await image.decode();
      } catch {
        return;
      }
      if (stopped || token !== generation) return;
      if (!adopt(image)) return;
      reevaluate();
    };

    const ensureImage = () => {
      const url = readStripUrl(strip);
      if (!url || url === requested) {
        reevaluate();
        return;
      }
      requested = url;
      void load(url);
    };

    const waitReady = new MutationObserver(() => {
      if (!html.hasAttribute("data-scene-ready")) return;
      waitReady.disconnect();
      ensureImage();
    });

    const themeObserver = new MutationObserver(() => {
      ensureImage();
    });
    themeObserver.observe(html, {
      attributes: true,
      attributeFilter: ["data-theme", "data-scene-paused", "data-scene-ready"],
    });

    const onVisibility = () => reevaluate();
    const onQuery = () => ensureImage();
    const onResize = () => reevaluate();
    const onTurnEnd = () => reevaluate();
    document.addEventListener("visibilitychange", onVisibility);
    reduceQuery.addEventListener("change", onQuery);
    darkQuery.addEventListener("change", onQuery);
    window.addEventListener("resize", onResize);
    turn.addEventListener("transitionend", onTurnEnd);

    if (readStripUrl(strip) || html.hasAttribute("data-scene-ready")) ensureImage();
    else waitReady.observe(html, { attributes: true, attributeFilter: ["data-scene-ready"] });

    return () => {
      stopped = true;
      stopLoop();
      waitReady.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      reduceQuery.removeEventListener("change", onQuery);
      darkQuery.removeEventListener("change", onQuery);
      window.removeEventListener("resize", onResize);
      turn.removeEventListener("transitionend", onTurnEnd);
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      drawState?.gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  return <canvas ref={canvasRef} className={styles.canvas} data-planet-canvas={side} aria-hidden="true" />;
}
