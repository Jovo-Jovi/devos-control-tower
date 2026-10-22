import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const nextRequire = createRequire(require.resolve("next/package.json"));

const V32_DIR = "docs/design/v3/assets/v3.2";
const SCENE_DIR = "src/components/scene/assets";
const BYTE_BUDGET = 3847962;

const SPECS = [
  { name: "bg-day.jpg", width: 2560, height: 1440, format: "jpeg", seamless: false, source: V32_DIR },
  { name: "bg-night.jpg", width: 2560, height: 1440, format: "jpeg", seamless: false, source: V32_DIR },
  { name: "bg-day-portrait.jpg", width: 1440, height: 2560, format: "jpeg", seamless: false, source: V32_DIR },
  { name: "bg-night-portrait.jpg", width: 1440, height: 2560, format: "jpeg", seamless: false, source: V32_DIR },
  { name: "sky-clouds.webp", width: 2048, height: 1152, format: "webp", seamless: true, source: V32_DIR },
  { name: "planet-day.webp", width: 2048, height: 1024, format: "webp", seamless: true, source: V32_DIR },
  { name: "planet-crimson.webp", width: 2048, height: 1024, format: "webp", seamless: true, source: V32_DIR },
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

async function inspect(sharp, file) {
  const meta = await sharp(file).metadata();
  const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
  return {
    width: meta.width,
    height: meta.height,
    format: meta.format,
    seam: seamMeans(data, info.width, info.height, info.channels),
  };
}

async function verify() {
  const sharp = loadSharp();
  const present = readdirSync(SCENE_DIR);
  const expected = new Set(SPECS.map((spec) => spec.name));
  let failed = false;

  for (const spec of SPECS) {
    if (!present.includes(spec.name)) {
      failed = true;
      console.log(`${spec.name} FAIL missing`);
    }
  }
  for (const name of [...present].sort()) {
    if (!expected.has(name)) {
      failed = true;
      console.log(`${name} FAIL not in the scene set`);
    }
  }

  const seams = [];
  let bytes = 0;
  for (const spec of SPECS) {
    if (!present.includes(spec.name)) continue;
    const scenePath = path.join(SCENE_DIR, spec.name);
    const sourcePath = path.join(spec.source, spec.name);
    bytes += statSync(scenePath).size;
    const reasons = [];
    if (!existsSync(sourcePath) || sha256(scenePath) !== sha256(sourcePath)) reasons.push("sha256");
    if (!sharp) {
      reasons.push("sharp unavailable");
    } else {
      try {
        const image = await inspect(sharp, scenePath);
        if (image.width !== spec.width || image.height !== spec.height) {
          reasons.push(`size ${image.width}x${image.height}`);
        }
        if (image.format !== spec.format) reasons.push(`format ${image.format}`);
        if (spec.seamless) {
          if (image.seam.length < 3) reasons.push(`channels ${image.seam.length}`);
          else seams.push({ name: spec.name, seam: image.seam });
        }
      } catch {
        reasons.push("unreadable");
      }
    }
    if (reasons.length) {
      failed = true;
      console.log(`${spec.name} FAIL ${reasons.join("; ")}`);
    } else {
      console.log(`${spec.name} ok`);
    }
  }

  for (const item of seams) {
    const [red, green, blue] = item.seam;
    console.log(`${item.name} seam ${red.toFixed(2)} ${green.toFixed(2)} ${blue.toFixed(2)}`);
  }

  if (failed || bytes > BYTE_BUDGET) process.exit(1);
  console.log(`art: ${SPECS.length} file(s) ok, ${bytes} bytes`);
}

async function main() {
  const [command] = process.argv.slice(2);
  if (command === "verify") {
    await verify();
    return;
  }
  console.error("usage: node scripts/scene/art.mjs verify");
  process.exit(1);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
