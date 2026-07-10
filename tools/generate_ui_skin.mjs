import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "ui-layout.json"), "utf8"));

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, "");
  }
}

loadEnv(path.join(ROOT, ".env.local"));

const args = new Map(process.argv.slice(2).map((value, index, all) => value.startsWith("--") ? [value, all[index + 1]?.startsWith("--") ? true : all[index + 1]] : [value, value]));
const maxAttempts = Number(args.get("--attempts") || 3);
const quality = String(args.get("--quality") || "medium");
const python = process.env.PYTHON || "python";
const candidatesDir = path.join(ROOT, "assets", "generated", "candidates");
const reportsDir = path.join(ROOT, "assets", "generated", "reviews");
fs.mkdirSync(candidatesDir, { recursive: true });
fs.mkdirSync(reportsDir, { recursive: true });

function geometryText() {
  const { width, height } = contract.canvas;
  return Object.entries(contract.slots).map(([name, slot]) => {
    const [x1, y1, x2, y2] = slot.rect;
    return `- ${name}: x=${Math.round(x1 * width)}..${Math.round(x2 * width)}, y=${Math.round(y1 * height)}..${Math.round(y2 * height)}; selector ${slot.selector}; keep inner safe zone empty`;
  }).join("\n");
}

function basePrompt() {
  return `Use case: ui-mockup
Asset type: ${contract.canvas.width}x${contract.canvas.height} commercial game UI master skin
Primary request: create a premium, image-heavy tabletop interface for an original identity strategy card game.
Style: ${contract.style}.
Exact geometry contract (coordinates refer to the final canvas):
${geometryText()}
Constraints: obey every coordinate boundary; strong readable frames; empty functional centers for live HTML text and controls; no characters, cards, icons, readable text, logos or watermark; no franchise-specific assets; all important ornaments stay outside safe zones.
The image will be automatically cropped using these exact rectangles, so misaligned frames are a failed result.`;
}

function runReview(candidate, normalized, reportPath) {
  const result = spawnSync(python, [path.join(ROOT, "tools", "review_ui_skin.py"), "--image", candidate, "--contract", path.join(ROOT, "ui-layout.json"), "--normalized", normalized, "--report", reportPath], { cwd: ROOT, encoding: "utf8" });
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  return { ...report, exitCode: result.status };
}

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing. Expected it in .env.local or the process environment.");
  process.exit(1);
}

let feedback = "";
for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rawPath = path.join(candidatesDir, `${stamp}-attempt-${attempt}.png`);
  const normalizedPath = path.join(candidatesDir, `${stamp}-attempt-${attempt}-normalized.png`);
  const reportPath = path.join(reportsDir, `${stamp}-attempt-${attempt}.json`);
  const prompt = `${basePrompt()}${feedback ? `\nPrevious automated review failed. Correct only these issues:\n${feedback}` : ""}`;
  console.log(`Generating attempt ${attempt}/${maxAttempts}...`);
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1792x1024", quality }),
      signal: AbortSignal.timeout(180_000)
    });
  } catch (error) {
    console.error(`Image API transport failed before OpenAI responded: ${error?.cause?.code || error?.code || error?.message}`);
    console.error("Check that this machine can connect to api.openai.com:443 or configure HTTPS_PROXY, then rerun. Active assets were preserved.");
    process.exit(3);
  }
  if (!response.ok) throw new Error(`Image API ${response.status}: ${(await response.text()).slice(0, 500)}`);
  const body = await response.json();
  fs.writeFileSync(rawPath, Buffer.from(body.data[0].b64_json, "base64"));
  const report = runReview(rawPath, normalizedPath, reportPath);
  console.log(`Review ${report.passed ? "passed" : "failed"}: ${reportPath}`);
  if (report.passed) {
    fs.copyFileSync(normalizedPath, path.join(ROOT, "assets", "generated", "ui-art-table-v4.png"));
    const build = spawnSync(python, [path.join(ROOT, "tools", "build_assets.py")], { cwd: ROOT, stdio: "inherit" });
    if (build.status !== 0) process.exit(build.status ?? 1);
    console.log(`Accepted master: ${normalizedPath}`);
    process.exit(0);
  }
  feedback = report.retryFeedback;
}

console.error(`No candidate passed after ${maxAttempts} attempts. Existing active skin was preserved.`);
process.exit(2);
