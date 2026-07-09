import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../game.js", import.meta.url), "utf8");
const elements = new Map();
const mkEl = () => ({
  classList: { add() {}, remove() {}, contains() { return false; } },
  innerHTML: "",
  textContent: "",
  disabled: false,
  style: { setProperty() {} },
  insertAdjacentHTML() {},
  addEventListener() {},
  querySelectorAll() { return []; },
});

const documentStub = {
  getElementById(id) {
    if (!elements.has(id)) elements.set(id, mkEl());
    return elements.get(id);
  },
  querySelectorAll() { return []; },
};

const context = {
  console,
  crypto: { randomUUID: () => Math.random().toString(16).slice(2) },
  document: documentStub,
  window: { setTimeout: () => {} },
  setTimeout: () => {},
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "game.js" });

const heroCount = vm.runInContext("heroes.length", context);
const deckSize = vm.runInContext("buildDeck().length", context);
const phaseCount = vm.runInContext("phaseSteps.length", context);
const cardKeys = vm.runInContext("cardTemplates.map(card => card.key).join(',')", context);

if (heroCount !== 7) throw new Error(`expected 7 heroes, got ${heroCount}`);
if (deckSize !== 62) throw new Error(`expected 62 cards, got ${deckSize}`);
if (phaseCount !== 6) throw new Error(`expected 6 phases, got ${phaseCount}`);
for (const key of ["sha", "shan", "tao", "chai", "nanman", "wuzhong", "equip_tablet"]) {
  if (!cardKeys.includes(key)) throw new Error(`missing card key ${key}`);
}

console.log("smoke ok");
