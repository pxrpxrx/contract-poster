import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const MODEL = process.env.POLL_MODEL || "flux";
const OUT_DIR = process.argv[2] || "assets/images";

const JOBS = [
  {
    file: "hero-soldier.jpg",
    w: 1024,
    h: 1280,
    prompt:
      "Soviet constructivist propaganda poster, heroic Russian soldier in modern military uniform looking forward with determination, bold diagonal composition, limited palette of crimson red deep black and gold, geometric shapes, red star motif, dramatic angular lighting, textured paper grain, agitprop style, Rodchenko and El Lissitzky inspired, high contrast, no text",
  },
  {
    file: "unit-bpla.jpg",
    w: 1280,
    h: 1024,
    prompt:
      "Soviet constructivist propaganda poster, military drone operator with FPV quadcopter drone flying, bold diagonal geometric composition, crimson red black and gold palette, red star, radio waves and beam lines, agitprop poster style, Rodchenko inspired, high contrast, textured paper grain, no text",
  },
  {
    file: "map-russia.jpg",
    w: 1280,
    h: 1024,
    prompt:
      "Soviet constructivist poster, stylized map of Russia as bold geometric red silhouette on black background with gold location markers and radiating lines, agitprop style, El Lissitzky inspired, flat geometric, high contrast, textured paper grain, no text",
  },
  {
    file: "hero-bg.jpg",
    w: 1600,
    h: 1200,
    prompt:
      "Abstract Soviet constructivist background texture, bold diagonal red black and gold geometric rays and stripes radiating from corner, red star motif, agitprop poster style, grain texture, flat vector shapes, no text, no people",
  },
  {
    file: "cta-banner.png",
    w: 1600,
    h: 900,
    prompt:
      "Soviet constructivist propaganda banner, group of heroic soldiers marching in bold diagonal formation, crimson red black gold palette, red star, dynamic angular composition, agitprop poster style, Rodchenko inspired, high contrast, textured grain, no text",
  },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const job of JOBS) {
  const enc = encodeURIComponent(job.prompt);
  const url = `https://image.pollinations.ai/prompt/${enc}?width=${job.w}&height=${job.h}&nologo=true&model=${MODEL}&seed=${Math.floor(Math.random() * 100000)}`;
  const out = `${OUT_DIR}/${job.file}`;
  process.stdout.write(`Generating ${job.file} (${job.w}x${job.h})... `);
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`FAILED HTTP ${res.status}`);
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, buf);
    console.log(`OK ${(buf.length / 1024).toFixed(0)}KB`);
  } catch (e) {
    console.log(`ERROR ${e.message}`);
  }
}
console.log("Done.");
