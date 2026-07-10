import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contract = JSON.parse(fs.readFileSync(path.join(root, "ui-layout.json"), "utf8"));
const css = fs.readFileSync(path.join(root, "styles.css"), "utf8");

for (const [name, slot] of Object.entries(contract.slots)) {
  const [x1, y1, x2, y2] = slot.rect;
  if (!(0 <= x1 && x1 < x2 && x2 <= 1 && 0 <= y1 && y1 < y2 && y2 <= 1)) {
    throw new Error(`${name}: invalid normalized rectangle`);
  }
  for (const selector of slot.selector.split(",").map((value) => value.trim())) {
    if (!css.includes(selector)) throw new Error(`${name}: selector missing from styles.css: ${selector}`);
  }
  const asset = path.join(root, "assets", "processed", "ui", slot.file);
  if (!fs.existsSync(asset)) throw new Error(`${name}: built asset missing: ${slot.file}`);
}

console.log(`ui contract ok: ${Object.keys(contract.slots).length} linked slots`);
