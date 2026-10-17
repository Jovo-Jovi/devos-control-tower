import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));

const BASELINE_DIR = "docs/design/v3/assets";
const SCENE_DIR = "src/components/scene/assets";
const BYTE_BUDGET = 1048576;

const SPECS = [
  { name: "sky-day.jpg", width: 1600, height: 900, alpha: false, seamless: false, poles: false, map: false },
  { name: "sky-night.jpg", width: 2400, height: 1350, alpha: false, seamless: false, poles: false, map: false },
  { name: "sky-clouds.webp", width: 3200, height: 1100, alpha: true, seamless: true, poles: false, map: false },
  { name: "planet-land.webp", width: 1360, height: 680, alpha: false, seamless: true, poles: true, map: false },
  { name: "planet-clouds.webp", width: 1360, height: 680, alpha: true, seamless: true, poles: true, map: false },
  { name: "planet-lights.webp", width: 1360, height: 680, alpha: true, seamless: true, poles: true, map: false },
  { name: "planet-sphere-map.png", width: 340, height: 340, alpha: false, seamless: false, poles: false, map: true },
];

export const PROMPTS = [
  {
    file: "sky-night.jpg",
    text: "Original science-fiction night sky, 2400 by 1350 pixels, JPEG, no transparency. A deep black zenith, a diagonal band of small stars in three colour temperatures, faint dust lanes, a soft crimson nebula, and a low crimson glow along the horizon. No clouds, moon, planet, vehicle, figure, writing, logo, or brand.",
  },
  {
    file: "sky-day.jpg",
    text: "Original science-fiction day sky, 1600 by 900 pixels, JPEG, no transparency and no clouds. A clear azure zenith, a pale sun glow high in the frame, and a warm pale horizon. No cloud shapes, planet, vehicle, figure, writing, logo, or brand.",
  },
  {
    file: "sky-clouds.webp",
    text: "Original drifting cloud layer, 3200 by 1100 pixels, WebP with transparency, seamless from the left edge to the right edge. Soft white cloud wisps on a fully transparent background, denser toward the top and fading before the bottom. No sky colour, horizon, vehicle, figure, writing, logo, or brand.",
  },
  {
    file: "planet-land.webp",
    text: "Original equirectangular planet surface, 1360 by 680 pixels, WebP without transparency, seamless from the left edge to the right edge. Varied land and shallow seas, with the top and bottom two percent of rows nearly uniform so the poles do not pinch. No clouds, city lights, writing, logo, or brand.",
  },
  {
    file: "planet-clouds.webp",
    text: "Original equirectangular cloud wisps for a planet, 1360 by 680 pixels, WebP with transparency, seamless from the left edge to the right edge. Thin white cloud streaks over a transparent ground, nearly empty at the top and bottom poles. No surface colour, writing, logo, or brand.",
  },
  {
    file: "planet-lights.webp",
    text: "Original equirectangular night lights for a planet, 1360 by 680 pixels, WebP with transparency, seamless from the left edge to the right edge. Small warm lights only where land would be, transparent everywhere else, and empty at the poles. No labels, borders, writing, logo, or brand.",
  },
];

function loadSharp() {
  try {
    return nextRequire("sharp");
  } catch {
    return null;
  }
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function seamMeans(data, width, height, channels) {
  const sums = Array.from({ length: channels }, () => 0);
  for (let y = 0; y < height; y += 1) {
    const left = y * width * channels;
    const right = (y * width + width - 1) * channels;
    for (let channel = 0; channel < channels; channel += 1) {
      sums[channel] += Math.abs(data[left + channel] - data[right + channel]);
    }
  }
  return sums.map((sum) => sum / height);
}

function luminanceStd(data, width, channels, startRow, rowCount) {
  const values = [];
  for (let y = startRow; y < startRow + rowCount; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * channels;
      values.push(0.2126 * data[index] + 0.7152 * data[index + 1] + 0.0722 * data[index + 2]);
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function poleStds(data, width, height, channels) {
  const rows = Math.max(1, Math.round(height * 0.02));
  return {
    top: luminanceStd(data, width, channels, 0, rows),
    bottom: luminanceStd(data, width, channels, height - rows, rows),
  };
}

async function measure(sharp, file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    alpha: Boolean(meta.hasAlpha),
    bytes: statSync(file).size,
    seam: seamMeans(data, info.width, info.height, info.channels),
    poles: poleStds(data, info.width, info.height, info.channels),
  };
}

function expectedFormat(name) {
  if (name.endsWith(".jpg")) return "jpeg";
  if (name.endsWith(".webp")) return "webp";
  return "png";
}

async function judge(sharp, file, spec) {
  if (!sharp) return "sharp unavailable";
  const baselinePath = path.join(BASELINE_DIR, spec.name);
  const candidate = await measure(sharp, file);
  const baseline = await measure(sharp, baselinePath);
  const reasons = [];
  if (candidate.width !== spec.width || candidate.height !== spec.height) {
    reasons.push(`size ${candidate.width}x${candidate.height}`);
  }
  if (candidate.format !== expectedFormat(spec.name)) reasons.push(`format ${candidate.format}`);
  if (candidate.alpha !== spec.alpha) reasons.push(`alpha ${candidate.alpha}`);
  if (candidate.bytes > baseline.bytes * 2) reasons.push(`bytes ${candidate.bytes}`);
  if (spec.seamless) {
    candidate.seam.forEach((value, channel) => {
      const limit = Math.max(8, baseline.seam[channel]);
      if (value > limit) reasons.push(`seam channel ${channel} ${value.toFixed(2)} > ${limit.toFixed(2)}`);
    });
  }
  if (spec.poles) {
    for (const edge of ["top", "bottom"]) {
      const limit = Math.max(12, baseline.poles[edge]);
      if (candidate.poles[edge] > limit) {
        reasons.push(`pole ${edge} ${candidate.poles[edge].toFixed(2)} > ${limit.toFixed(2)}`);
      }
    }
  }
  return reasons.length ? reasons.join("; ") : "";
}

function printPrompts() {
  for (const prompt of PROMPTS) console.log(`${prompt.file}\n${prompt.text}\n`);
}

async function checkDir(dir) {
  const sharp = loadSharp();
  const present = new Set(readdirSync(dir));
  let failed = false;
  for (const spec of SPECS.filter((item) => !item.map)) {
    if (!present.has(spec.name)) continue;
    const reason = await judge(sharp, path.join(dir, spec.name), spec);
    if (reason) {
      failed = true;
      console.log(`${spec.name} FAIL ${reason}`);
    } else {
      console.log(`${spec.name} PASS`);
    }
  }
  process.exit(failed ? 1 : 0);
}

async function verify() {
  const sharp = loadSharp();
  let bytes = 0;
  let failed = false;
  for (const spec of SPECS) {
    const scenePath = path.join(SCENE_DIR, spec.name);
    const baselinePath = path.join(BASELINE_DIR, spec.name);
    bytes += statSync(scenePath).size;
    if (sha256(scenePath) === sha256(baselinePath)) {
      console.log(`${spec.name} baseline`);
      continue;
    }
    if (spec.map) {
      failed = true;
      console.log(`${spec.name} FAIL map must stay the baseline`);
      continue;
    }
    const reason = await judge(sharp, scenePath, spec);
    if (reason) {
      failed = true;
      console.log(`${spec.name} FAIL ${reason}`);
    } else {
      console.log(`${spec.name} replaced`);
    }
  }
  if (failed || bytes > BYTE_BUDGET) process.exit(1);
  console.log(`art: ${SPECS.length} file(s) ok, ${bytes} bytes`);
}

async function main() {
  const [command, dir] = process.argv.slice(2);
  if (command === "prompts") {
    printPrompts();
    return;
  }
  if (command === "check") {
    await checkDir(dir);
    return;
  }
  if (command === "verify") {
    await verify();
    return;
  }
  console.error("usage: node scripts/scene/art.mjs <prompts|check <dir>|verify>");
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
