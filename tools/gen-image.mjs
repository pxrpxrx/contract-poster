import { writeFileSync } from "node:fs";

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("Missing GEMINI_API_KEY env var");
  process.exit(1);
}

const [, , prompt, outPath, modelArg, aspectArg] = process.argv;
if (!prompt || !outPath) {
  console.error('Usage: node gen-image.mjs "<prompt>" <outPath> [model] [aspectRatio]');
  process.exit(1);
}

const model = modelArg || "gemini-2.5-flash-image";
const aspectRatio = aspectArg || "1:1";

const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

const body = {
  contents: [{ parts: [{ text: prompt }] }],
  generationConfig: {
    responseModalities: ["IMAGE"],
    imageConfig: { aspectRatio },
  },
};

const res = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  console.error(await res.text());
  process.exit(1);
}

const data = await res.json();
const parts = data?.candidates?.[0]?.content?.parts || [];
const imgPart = parts.find((p) => p.inlineData?.data);
if (!imgPart) {
  console.error("No image in response:");
  console.error(JSON.stringify(data).slice(0, 800));
  process.exit(1);
}

writeFileSync(outPath, Buffer.from(imgPart.inlineData.data, "base64"));
console.log(`OK -> ${outPath} (${imgPart.inlineData.mimeType})`);
