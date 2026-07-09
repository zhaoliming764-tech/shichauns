const heroes = [
  { id: "ma", art: "ma-xinyu", name: "马新宇", title: "版式奇谋", maxHp: 4, skill: "对齐", desc: "每回合一次，摸 1 张牌并弃 1 张牌。" },
  { id: "zyp", art: "zeng-yupeng-v2", name: "曾宇鹏", title: "镜头调度", maxHp: 4, skill: "构图", desc: "【提案突袭】造成伤害后摸 1 张牌。" },
  { id: "chj", art: "chen-haojie", name: "陈豪杰", title: "字体铸师", maxHp: 4, skill: "字重", desc: "你的【提案突袭】被闪避后摸 1 张牌。" },
  { id: "zmj", art: "zeng-minjun", name: "曾敏俊", title: "海报重装", maxHp: 4, skill: "厚涂", desc: "每局首次濒危时回复 1 点体力。" },
  { id: "ljl", art: "li-jiale", name: "李佳乐", title: "动效游侠", maxHp: 3, skill: "转场", desc: "每回合首次成为突袭目标时摸 1 张牌。" },
  { id: "rtf", art: "ren-tengfei", name: "任腾飞", title: "策展先锋", maxHp: 4, skill: "布展", desc: "装备后出杀限制放宽。" },
  { id: "gxy", art: "gong-xinyi", name: "龚欣怡", title: "灵感缪斯", maxHp: 3, skill: "共鸣", desc: "使用【灵感补给】时额外摸 1 张牌。" },
];

const rolesForFive = ["主公", "忠臣", "反贼", "反贼", "内奸"];
const phaseSteps = ["准备", "判定", "摸牌", "出牌", "弃牌", "结束"];
const cardTemplates = [
  { key: "sha", type: "attack", name: "提案突袭", text: "对一名角色造成 1 点创意压力。", count: 18, art: "proposal-strike" },
  { key: "shan", type: "defense", name: "临场改稿", text: "响应突袭，抵消一次伤害。", count: 14, art: "quick-revision" },
  { key: "tao", type: "heal", name: "灵感补给", text: "回复 1 点体力，濒危时也可使用。", count: 8, art: "inspiration-supply" },
  { key: "chai", type: "tactic", name: "甲方需求", text: "指定一名角色弃 1 张手牌。", count: 7, art: "client-demand" },
  { key: "nanman", type: "tactic", name: "赶稿通宵", text: "所有其他角色各需响应一次突袭。", count: 5, art: "deadline-night" },
  { key: "wuzhong", type: "tactic", name: "头脑风暴", text: "摸 2 张牌。", count: 6, art: "brainstorm" },
  { key: "equip_tablet", type: "equip", name: "数位板", text: "装备后每回合可多用 1 次【提案突袭】。", count: 4, art: "drawing-tablet" },
];

const state = {
  selectedHero: 0,
  players: [],
  deck: [],
  discard: [],
  current: 0,
  round: 1,
  phase: "setup",
  turnPhase: "准备",
  skillUsed: false,
  attackUsed: 0,
  pendingCardIndex: null,
  pendingResponse: null,
  groupQueue: [],
  gameOver: false,
  winnerCamp: null,
  resultTitle: "",
  resultText: "",
};

const $ = (id) => document.getElementById(id);

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildDeck() {
  const suits = ["黑桃", "红桃", "梅花", "方片"];
  const ranks = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
  const deck = [];
  cardTemplates.forEach((template) => {
    for (let i = 0; i < template.count; i += 1) {
      deck.push({
        id: `${template.key}-${i}-${crypto.randomUUID()}`,
        ...template,
        suit: suits[(i + template.key.length) % suits.length],
        rank: ranks[i % ranks.length],
      });
    }
  });
  return shuffle(deck);
}

function draw(player, count) {
  for (let i = 0; i < count; i += 1) {
    if (!state.deck.length) {
      state.deck = shuffle(state.discard);
      state.discard = [];
      log("弃牌堆重新洗回牌堆。");
    }
    const card = state.deck.pop();
    if (card) player.hand.push(card);
  }
}

function initSetup() {
  $("heroSelect").innerHTML = heroes.map((hero, index) => `
    <button class="hero-option ${index === state.selectedHero ? "selected" : ""}" data-hero="${index}" type="button">
      <div class="portrait cutout-portrait"><img src="./assets/processed/heroes/${hero.art}.png" alt="${hero.name}" /></div>
      <div class="hero-info">
        <strong>${hero.name}</strong>
        <span>${hero.title} · ${hero.skill}</span>
        <span>${hero.desc}</span>
      </div>
    </button>
  `).join("");
  document.querySelectorAll(".hero-option").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedHero = Number(button.dataset.hero);
      initSetup();
    });
  });
}

function startGame() {
  const chosen = heroes[state.selectedHero];
  const rivals = shuffle(heroes.filter((hero) => hero.id !== chosen.id)).slice(0, 4);
  const roles = shuffle(rolesForFive);
  state.players = [chosen, ...rivals].map((hero, index) => ({
    ...hero,
    seat: index,
    role: roles[index],
    hp: hero.maxHp + (roles[index] === "主公" ? 1 : 0),
    maxHp: hero.maxHp + (roles[index] === "主公" ? 1 : 0),
    hand: [],
    equipment: [],
    alive: true,
    isHuman: index === 0,
    revived: false,
    marked: false,
    hitFlash: false,
  }));
  state.deck = buildDeck();
  state.discard = [];
  state.current = 0;
  state.round = 1;
  state.phase = "play";
  state.turnPhase = "准备";
  state.skillUsed = false;
  state.attackUsed = 0;
  state.pendingCardIndex = null;
  state.pendingResponse = null;
  state.groupQueue = [];
  state.gameOver = false;
  state.winnerCamp = null;
  state.resultTitle = "";
  state.resultText = "";
  state.players.forEach((player) => draw(player, 4));
  $("setup").classList.add("hidden");
  $("game").classList.remove("hidden");
  const lord = getLord();
  log(`身份局开始。你的身份是【${state.players[0].role}】，本局主公是 ${lord.name}。`);
  beginTurn(lord.seat);
  window.setTimeout(animateOpeningDeal, 180);
}

function getLord() {
  return state.players.find((player) => player.role === "主公") || state.players[0];
}

function getCamp(player) {
  if (!player) return "unknown";
  if (player.role === "反贼") return "rebel";
  if (player.role === "内奸") return "traitor";
  return "lord";
}

function beginTurn(index) {
  if (state.gameOver) return;
  const player = state.players[index];
  if (!player.alive) return nextTurn();
  state.current = index;
  state.skillUsed = false;
  state.attackUsed = 0;
  state.pendingCardIndex = null;
  state.pendingResponse = null;
  state.groupQueue = [];
  state.phase = player.isHuman ? "play" : "ai";
  state.turnPhase = "准备";
  state.players.forEach((item) => { item.marked = false; });
  log(`${player.name} 的回合开始。`);
  render();
  state.turnPhase = "判定";
  log(`${player.name} 的判定区为空。`);
  render();
  state.turnPhase = "摸牌";
  draw(player, 2);
  state.turnPhase = "出牌";
  render();
  if (!player.isHuman) window.setTimeout(aiPlay, 520);
}

function nextTurn() {
  if (state.gameOver) return;
  let next = state.current;
  do {
    next = (next + 1) % state.players.length;
    if (next === 0) state.round += 1;
  } while (!state.players[next].alive);
  beginTurn(next);
}

function maxAttacks(player) {
  return player.equipment.some((card) => card.key === "equip_tablet") || player.skill === "布展" ? 2 : 1;
}

function canUseCard(player, card) {
  if (!card || state.pendingResponse || state.current !== 0 || state.phase !== "play" || state.gameOver) return false;
  if (card.key === "shan") return false;
  if (card.key === "sha") return state.attackUsed < maxAttacks(player);
  if (card.key === "tao") return player.hp < player.maxHp;
  return true;
}

function needsTarget(card) {
  return card.key === "sha" || card.key === "chai";
}

function playCard(cardIndex, targetIndex = null) {
  const player = state.players[0];
  const card = player.hand[cardIndex];
  if (!canUseCard(player, card)) {
    log(card?.key === "shan" ? "【临场改稿】只能在响应窗口中打出。" : "这张牌当前不能使用。");
    return;
  }
  if (needsTarget(card) && targetIndex === null) {
    showTargets(cardIndex);
    return;
  }
  animatePlayedCard(card, { cardIndex, sourceSeat: player.seat });
  player.hand.splice(cardIndex, 1);
  if (card.key === "sha") state.attackUsed += 1;
  resolveCard(player, card, targetIndex);
  if (card.type !== "equip") state.discard.push(card);
  state.pendingCardIndex = null;
  checkWin();
  render();
}

function showTargets(cardIndex) {
  const card = state.players[0].hand[cardIndex];
  state.pendingCardIndex = cardIndex;
  render();
}

function resolveCard(user, card, targetIndex) {
  if (card.key === "sha") attack(user, state.players[targetIndex], false);
  if (card.key === "tao") usePeach(user);
  if (card.key === "chai") dismantle(user, state.players[targetIndex]);
  if (card.key === "nanman") startGroupAttack(user);
  if (card.key === "wuzhong") {
    draw(user, 2);
    log(`${user.name} 使用【头脑风暴】，摸 2 张牌。`);
  }
  if (card.key === "equip_tablet") {
    user.equipment = user.equipment.filter((item) => item.key !== "equip_tablet");
    user.equipment.push(card);
    log(`${user.name} 装备【数位板】。`);
  }
}

function animatePlayedCard(card, options = {}) {
  if (!card || typeof document === "undefined") return;
  const table = document.querySelector(".table");
  if (!table) return;
  const source =
    options.cardIndex !== undefined
      ? document.querySelector(`#hand .card[data-card="${options.cardIndex}"]`)
      : document.querySelector(`.player-card[data-seat="${options.sourceSeat}"]`);
  const sourceRect = source?.getBoundingClientRect();
  const tableRect = table.getBoundingClientRect();
  if (!sourceRect) return;

  const fx = document.createElement("div");
  fx.className = `play-fx-card ${card.type}`;
  fx.innerHTML = `
    <span class="play-fx-art" style="background-image: url('./assets/processed/cards/${card.art}.jpg')"></span>
    <strong>${card.name}</strong>
  `;
  const startX = sourceRect.left + sourceRect.width / 2 - 42;
  const startY = sourceRect.top + sourceRect.height / 2 - 58;
  const endX = tableRect.left + tableRect.width / 2 - 42;
  const endY = tableRect.top + tableRect.height / 2 - 58;
  fx.style.left = `${startX}px`;
  fx.style.top = `${startY}px`;
  fx.style.setProperty("--dx", `${endX - startX}px`);
  fx.style.setProperty("--dy", `${endY - startY}px`);
  document.body.appendChild(fx);
  window.setTimeout(() => fx.remove(), 760);
}

function animateOpeningDeal() {
  if (typeof document === "undefined" || !state.players.length) return;
  const deckPile = document.querySelector(".deck-pile");
  const deckRect = deckPile?.getBoundingClientRect();
  if (!deckRect) return;

  const dealTargets = [];
  state.players.forEach((player) => {
    const target = player.isHuman ? document.querySelector(".hand-wrap") : document.querySelector(`.player-card[data-seat="${player.seat}"]`);
    if (!target) return;
    for (let index = 0; index < 4; index += 1) {
      dealTargets.push({ element: target, offset: index - 1.5 });
    }
  });
  const humanHand = document.querySelector(".hand-wrap");
  if (humanHand) {
    dealTargets.push({ element: humanHand, offset: -0.5, bonus: true }, { element: humanHand, offset: 0.5, bonus: true });
  }

  dealTargets.forEach((target, index) => {
    window.setTimeout(() => {
      animateDealCard(deckRect, target.element, target.offset, target.bonus);
    }, index * 78);
  });
}

function animateDealCard(deckRect, targetElement, offset = 0, bonus = false) {
  const targetRect = targetElement.getBoundingClientRect();
  const fx = document.createElement("div");
  fx.className = `deal-fx-card ${bonus ? "bonus-draw" : ""}`;
  const startX = deckRect.left + deckRect.width / 2 - 28;
  const startY = deckRect.top + deckRect.height / 2 - 42;
  const endX = targetRect.left + targetRect.width / 2 - 28 + offset * 18;
  const endY = targetRect.top + targetRect.height / 2 - 42 + (targetElement.classList.contains("hand-wrap") ? 22 : 0);
  fx.style.left = `${startX}px`;
  fx.style.top = `${startY}px`;
  fx.style.setProperty("--dx", `${endX - startX}px`);
  fx.style.setProperty("--dy", `${endY - startY}px`);
  fx.style.setProperty("--rot-end", `${offset * 7}deg`);
  document.body.appendChild(fx);
  window.setTimeout(() => fx.remove(), 920);
}

function attack(user, target, group = false) {
  if (!target?.alive) return;
  if (target.skill === "转场" && !target.marked) {
    draw(target, 1);
    target.marked = true;
    log(`${target.name} 发动【转场】，摸 1 张牌。`);
  }
  const dodgeIndex = target.hand.findIndex((card) => card.key === "shan");
  if (target.isHuman && dodgeIndex >= 0) {
    state.pendingResponse = {
      kind: "dodge",
      sourceSeat: user.seat,
      targetSeat: target.seat,
      group,
    };
    log(`${target.name} 需要响应【临场改稿】。`);
    render();
    return;
  }
  if (!target.isHuman && dodgeIndex >= 0 && Math.random() > 0.24) {
    state.discard.push(target.hand.splice(dodgeIndex, 1)[0]);
    log(`${target.name} 打出【临场改稿】，闪避 ${group ? "群体压力" : `${user.name} 的突袭`}。`);
    if (user.skill === "字重") {
      draw(user, 1);
      log(`${user.name} 发动【字重】，摸 1 张牌。`);
    }
    return;
  }
  applyDamage(target, 1, user);
}

function resolveDodge(useCard) {
  const response = state.pendingResponse;
  if (!response || response.kind !== "dodge") return;
  const source = state.players[response.sourceSeat];
  const target = state.players[response.targetSeat];
  if (useCard) {
    const index = target.hand.findIndex((card) => card.key === "shan");
    if (index >= 0) {
      state.discard.push(target.hand.splice(index, 1)[0]);
      log(`${target.name} 打出【临场改稿】，避开突袭。`);
      if (source.skill === "字重") {
        draw(source, 1);
        log(`${source.name} 发动【字重】，摸 1 张牌。`);
      }
    }
  } else {
    applyDamage(target, 1, source);
  }
  state.pendingResponse = null;
  continueAfterResponse();
}

function applyDamage(target, amount, source) {
  target.hp -= amount;
  triggerHitFeedback(target, amount);
  log(`${target.name} 受到 ${amount} 点压力，当前体力 ${Math.max(target.hp, 0)}/${target.maxHp}。`);
  if (source.skill === "构图") {
    draw(source, 1);
    log(`${source.name} 发动【构图】，摸 1 张牌。`);
  }
  if (target.hp <= 0) enterDying(target, source);
}

function triggerHitFeedback(target, amount) {
  if (typeof document === "undefined") return;
  target.hitFlash = true;
  const table = document.querySelector(".table");
  const targetCard = document.querySelector(`.player-card[data-seat="${target.seat}"]`);
  table?.classList.add("screen-shake");
  if (targetCard) {
    const rect = targetCard.getBoundingClientRect();
    const fx = document.createElement("div");
    fx.className = "damage-pop";
    fx.textContent = `-${amount}`;
    fx.style.left = `${rect.left + rect.width / 2}px`;
    fx.style.top = `${rect.top + rect.height * 0.34}px`;
    document.body.appendChild(fx);
    window.setTimeout(() => fx.remove(), 760);
  }
  window.setTimeout(() => {
    target.hitFlash = false;
    table?.classList.remove("screen-shake");
    render();
  }, 520);
}

function enterDying(target, source) {
  const peachIndex = target.hand.findIndex((card) => card.key === "tao");
  if (target.isHuman && peachIndex >= 0) {
    state.pendingResponse = { kind: "peach", targetSeat: target.seat, sourceSeat: source.seat };
    log(`${target.name} 进入濒危，需要决定是否使用【灵感补给】。`);
    render();
    return;
  }
  if (!target.isHuman && peachIndex >= 0) {
    state.discard.push(target.hand.splice(peachIndex, 1)[0]);
    target.hp = 1;
    log(`${target.name} 使用【灵感补给】，回到 1 点体力。`);
    return;
  }
  if (target.skill === "厚涂" && !target.revived) {
    target.revived = true;
    target.hp = 1;
    log(`${target.name} 发动【厚涂】，首次濒危回复 1 点体力。`);
    return;
  }
  killPlayer(target, source);
}

function resolvePeach(useCard) {
  const response = state.pendingResponse;
  if (!response || response.kind !== "peach") return;
  const target = state.players[response.targetSeat];
  const source = state.players[response.sourceSeat];
  if (useCard) {
    const index = target.hand.findIndex((card) => card.key === "tao");
    if (index >= 0) {
      state.discard.push(target.hand.splice(index, 1)[0]);
      target.hp = 1;
      log(`${target.name} 使用【灵感补给】，脱离濒危。`);
    }
  } else if (target.skill === "厚涂" && !target.revived) {
    target.revived = true;
    target.hp = 1;
    log(`${target.name} 发动【厚涂】，回复 1 点体力。`);
  } else {
    killPlayer(target, source);
  }
  state.pendingResponse = null;
  continueAfterResponse();
}

function continueAfterResponse() {
  checkWin();
  render();
  if (state.gameOver) return;
  if (state.groupQueue.length) {
    window.setTimeout(continueGroupAttack, 360);
    return;
  }
  if (state.phase === "ai") window.setTimeout(finishAiTurn, 500);
}

function killPlayer(target, source) {
  target.alive = false;
  target.hp = 0;
  log(`${target.name} 被 ${source.name} 击败，身份为 ${target.role}。`);
  if (target.role === "反贼") {
    draw(source, 3);
    log(`${source.name} 击败反贼，奖励摸 3 张牌。`);
  }
  if (source.role === "主公" && target.role === "忠臣") {
    state.discard.push(...source.hand, ...source.equipment);
    source.hand = [];
    source.equipment = [];
    log(`${source.name} 误伤忠臣，弃置所有手牌和装备。`);
  }
}

function usePeach(player) {
  const before = player.hp;
  player.hp = Math.min(player.maxHp, player.hp + 1);
  log(`${player.name} 使用【灵感补给】，回复 ${player.hp - before} 点体力。`);
  if (player.skill === "共鸣") {
    draw(player, 1);
    log(`${player.name} 发动【共鸣】，额外摸 1 张牌。`);
  }
}

function dismantle(user, target) {
  if (!target?.alive) return;
  if (target.hand.length) {
    state.discard.push(target.hand.pop());
    log(`${user.name} 使用【甲方需求】，${target.name} 弃 1 张手牌。`);
  } else {
    log(`${target.name} 没有手牌，【甲方需求】落空。`);
  }
}

function startGroupAttack(user) {
  state.groupQueue = state.players.filter((player) => player.alive && player !== user).map((player) => player.seat);
  log(`${user.name} 使用【赶稿通宵】，所有其他角色依次响应。`);
  continueGroupAttack(user.seat);
}

function continueGroupAttack(sourceSeat = state.current) {
  if (!state.groupQueue.length || state.gameOver) return;
  const source = state.players[sourceSeat];
  const targetSeat = state.groupQueue.shift();
  const target = state.players[targetSeat];
  if (target?.alive) attack(source, target, true);
  if (!state.pendingResponse && state.groupQueue.length) window.setTimeout(() => continueGroupAttack(sourceSeat), 260);
}

function useSkill() {
  const player = state.players[0];
  if (state.current !== 0 || state.skillUsed || state.pendingResponse || state.gameOver) return;
  if (player.skill === "对齐") {
    draw(player, 1);
    if (player.hand.length) state.discard.push(player.hand.pop());
    state.skillUsed = true;
    log(`${player.name} 发动【对齐】，摸 1 弃 1。`);
  } else {
    log(`【${player.skill}】是被动或触发技能。`);
  }
  render();
}

function endHumanTurn() {
  if (state.current !== 0 || state.phase !== "play" || state.pendingResponse) return;
  state.pendingCardIndex = null;
  $("targetRow").innerHTML = "";
  discardToLimit(state.players[0]);
  endPhase(state.players[0]);
  nextTurn();
}

function discardToLimit(player) {
  state.turnPhase = "弃牌";
  const limit = Math.max(player.hp, 0);
  let discarded = 0;
  while (player.hand.length > limit) {
    state.discard.push(player.hand.pop());
    discarded += 1;
  }
  if (discarded) log(`${player.name} 弃 ${discarded} 张牌，手牌调整至 ${player.hand.length} 张。`);
}

function aiPlay() {
  const ai = state.players[state.current];
  if (!ai?.alive || ai.isHuman) return;
  playAiHeal(ai);
  playAiBrainstorm(ai);
  playAiTactic(ai);
  playAiAttack(ai);
  if (!state.pendingResponse) finishAiTurn();
}

function finishAiTurn() {
  if (state.gameOver || state.phase !== "ai") return;
  discardToLimit(state.players[state.current]);
  endPhase(state.players[state.current]);
  checkWin();
  render();
  if (!state.gameOver) window.setTimeout(nextTurn, 620);
}

function endPhase(player) {
  state.turnPhase = "结束";
  log(`${player.name} 的回合结束。`);
}

function takeCard(player, predicate) {
  const index = player.hand.findIndex(predicate);
  return index >= 0 ? player.hand.splice(index, 1)[0] : null;
}

function playAiHeal(ai) {
  if (ai.hp > ai.maxHp - 2) return;
  const card = takeCard(ai, (item) => item.key === "tao");
  if (!card) return;
  animatePlayedCard(card, { sourceSeat: ai.seat });
  resolveCard(ai, card);
  state.discard.push(card);
}

function playAiBrainstorm(ai) {
  if (Math.random() < 0.46) return;
  const card = takeCard(ai, (item) => item.key === "wuzhong");
  if (!card) return;
  animatePlayedCard(card, { sourceSeat: ai.seat });
  resolveCard(ai, card);
  state.discard.push(card);
}

function playAiTactic(ai) {
  if (Math.random() < 0.52) return;
  const card = takeCard(ai, (item) => item.key === "chai");
  if (!card) return;
  const target = chooseAiTarget(ai);
  animatePlayedCard(card, { sourceSeat: ai.seat });
  resolveCard(ai, card, target.seat);
  state.discard.push(card);
}

function playAiAttack(ai) {
  const attackLimit = maxAttacks(ai);
  for (let used = 0; used < attackLimit; used += 1) {
    const card = takeCard(ai, (item) => item.key === "sha");
    if (!card) return;
    const target = chooseAiTarget(ai);
    animatePlayedCard(card, { sourceSeat: ai.seat });
    resolveCard(ai, card, target.seat);
    state.discard.push(card);
    if (state.pendingResponse || !target.alive || Math.random() < 0.55) return;
  }
}

function chooseAiTarget(ai) {
  const alive = state.players.filter((player) => player.alive && player !== ai);
  const lord = getLord();
  if (ai.role === "反贼") return lord.alive ? lord : alive[0];
  if (ai.role === "忠臣" || ai.role === "主公") return alive.find((player) => player.role === "反贼") || alive.find((player) => player.role === "内奸") || alive[0];
  if (ai.role === "内奸") return alive.sort((a, b) => a.hp - b.hp)[0];
  return alive.find((player) => player.role === "反贼") || alive[0];
}

function checkWin() {
  const lord = getLord();
  const alive = state.players.filter((player) => player.alive);
  const rebels = state.players.some((player) => player.alive && player.role === "反贼");
  const traitor = state.players.some((player) => player.alive && player.role === "内奸");
  const onlyTraitor = alive.length === 1 && alive[0].role === "内奸";
  if (onlyTraitor) endGame("内奸扫清全场，内奸获胜。", "traitor");
  else if (!lord.alive) endGame("主公倒下，反贼阵营获胜。", "rebel");
  else if (!rebels && !traitor) endGame("所有威胁清除，主公阵营获胜。", "lord");
}

function endGame(message, winnerCamp) {
  state.gameOver = true;
  state.phase = "ended";
  state.turnPhase = "结束";
  state.pendingResponse = null;
  state.winnerCamp = winnerCamp;
  const humanWon = getCamp(state.players[0]) === winnerCamp;
  state.resultTitle = humanWon ? "胜利" : "失败";
  state.resultText = `${message} 你的身份是【${state.players[0].role}】。`;
  log(message);
  render();
}

function render() {
  if (!state.players[0]) return;
  const selectedPendingCard = state.pendingCardIndex !== null ? state.players[0].hand[state.pendingCardIndex] : null;
  if (state.pendingCardIndex !== null && (!selectedPendingCard || !needsTarget(selectedPendingCard))) {
    state.pendingCardIndex = null;
  }
  $("roundLabel").textContent = state.gameOver ? "对局结束" : `第 ${state.round} 轮`;
  $("deckCount").textContent = `牌堆 ${state.deck.length}`;
  $("deckPileCount").textContent = state.deck.length;
  $("discardPileCount").textContent = state.discard.length;
  $("phaseLabel").textContent = state.gameOver ? "胜负已定" : `${state.players[state.current]?.name || ""} 的回合`;
  $("hintLabel").textContent = getHintText();
  const activePhaseIndex = Math.max(0, phaseSteps.indexOf(state.turnPhase));
  $("phaseRail").innerHTML = phaseSteps.map((phase, index) => `
    <div class="phase-step ${state.turnPhase === phase ? "active" : ""} ${index < activePhaseIndex ? "done" : ""}">
      <span class="phase-dot">${index + 1}</span>
      <span class="phase-name">${phase}</span>
    </div>
  `).join("");

  const pendingCard = state.pendingCardIndex !== null ? state.players[0].hand[state.pendingCardIndex] : null;
  const renderPlayer = (player, index, revealRole = false) => {
    const targetable = isTargetable(player, pendingCard);
    const showRole = revealRole || player.role === "主公" || !player.alive || state.gameOver;
    return `
    <article class="player-card ${index === state.current ? "current" : ""} ${player.alive ? "" : "dead"} ${targetable ? "targetable" : ""} ${player.hitFlash ? "hit-flash" : ""}" data-seat="${player.seat}">
      <div class="role-token ${showRole ? "" : "hidden-role"}">${showRole ? player.role.slice(0, 1) : "?"}</div>
      <div class="portrait cutout-portrait"><img src="./assets/processed/heroes/${player.art}.png" alt="${player.name}" /></div>
      <div class="player-info">
        <strong>${player.name}</strong>
        <span>${player.title} · ${player.skill}</span>
        <div class="meta">
          <span>${player.isHuman || showRole ? player.role : "身份未明"}</span>
          <span>${player.hand.length} 手牌</span>
        </div>
        <div class="meta">
          <span>${player.equipment.length ? "数位板已装备" : "无装备"}</span>
          <div class="hp">${Array.from({ length: Math.max(player.hp, 0) }, () => `<i class="heart"></i>`).join("")}</div>
        </div>
      </div>
    </article>
  `;
  };

  $("opponents").innerHTML = state.players.slice(1).map((player) => renderPlayer(player, player.seat, !player.alive)).join("");
  $("selfPlayer").innerHTML = renderPlayer(state.players[0], 0, true);
  bindTargetablePlayers();
  renderTargetButtons(pendingCard);
  renderHand();
  renderResponse();
  renderEndModal();
}

function isTargetable(player, card) {
  if (!card || !player.alive || player.isHuman || state.pendingResponse || state.current !== 0 || state.phase !== "play") return false;
  return needsTarget(card);
}

function bindTargetablePlayers() {
  document.querySelectorAll(".player-card.targetable").forEach((cardEl) => {
    cardEl.addEventListener("click", () => {
      if (state.pendingCardIndex === null) return;
      const seat = Number(cardEl.dataset.seat);
      $("targetRow").innerHTML = "";
      playCard(state.pendingCardIndex, seat);
    });
  });
}

function renderTargetButtons(card) {
  if (!card || !needsTarget(card)) {
    $("targetRow").innerHTML = "";
    return;
  }
  $("targetRow").innerHTML = state.players
    .filter((player) => isTargetable(player, card))
    .map((player) => `<button class="target" data-target="${player.seat}" type="button">${player.name}</button>`)
    .join("");
  document.querySelectorAll(".target").forEach((button) => {
    button.addEventListener("click", () => {
      if (state.pendingCardIndex === null) return;
      $("targetRow").innerHTML = "";
      playCard(state.pendingCardIndex, Number(button.dataset.target));
    });
  });
}

function renderEndModal() {
  const modal = $("endModal");
  if (!modal) return;
  if (!state.gameOver) {
    modal.classList.add("hidden");
    return;
  }
  modal.classList.remove("hidden");
  modal.classList.toggle("victory", state.resultTitle === "胜利");
  modal.classList.toggle("defeat", state.resultTitle !== "胜利");
  $("endTitle").textContent = state.resultTitle;
  $("endText").textContent = state.resultText;
  $("endRoles").innerHTML = state.players.map((player) => `
    <span class="${player.alive ? "" : "dead-role"}">${player.name} / ${player.role}</span>
  `).join("");
}

function renderHand() {
  const human = state.players[0];
  $("hand").innerHTML = human.hand.map((card, index) => {
    const disabled = !canUseCard(human, card);
    const selected = index === state.pendingCardIndex ? "selected-card" : "";
    const mid = (human.hand.length - 1) / 2;
    const rot = ((index - mid) * 4.2).toFixed(2);
    const lift = (Math.abs(index - mid) * 5).toFixed(1);
    return `
      <button class="card ${card.type} ${selected}" style="--rot:${rot}deg; --lift:${lift}px" data-card="${index}" ${disabled ? "disabled" : ""} type="button">
        <span class="card-corner"><b>${card.rank}</b><em>${card.suit}</em></span>
        <span class="card-art" style="background-image: url('./assets/processed/cards/${card.art}.jpg')"></span>
        <strong>${card.name}</strong>
        <span class="card-desc">${card.text}</span>
      </button>
    `;
  }).join("");
  document.querySelectorAll(".card").forEach((button) => {
    button.addEventListener("click", () => playCard(Number(button.dataset.card)));
  });
  $("skillBtn").disabled = state.current !== 0 || state.skillUsed || state.pendingResponse || state.gameOver;
  $("endBtn").disabled = state.current !== 0 || state.pendingResponse || state.gameOver;
  $("handTip").textContent = `本回合突袭 ${state.attackUsed}/${maxAttacks(human)}，体力 ${human.hp}/${human.maxHp}`;
}

function renderResponse() {
  const modal = $("responseModal");
  if (!state.pendingResponse) {
    modal.classList.add("hidden");
    $("responseTitle").textContent = "响应";
    $("responseText").textContent = "";
    $("responseActions").innerHTML = "";
    return;
  }
  const response = state.pendingResponse;
  const target = state.players[response.targetSeat];
  modal.classList.remove("hidden");
  if (response.kind === "dodge") {
    $("responseTitle").textContent = "请响应【临场改稿】";
    $("responseText").textContent = `${target.name} 正被突袭。你可以打出一张【临场改稿】，否则受到 1 点压力。`;
    $("responseActions").innerHTML = `
      <button class="secondary" id="useDodgeBtn" type="button">打出临场改稿</button>
      <button class="ghost" id="skipDodgeBtn" type="button">不响应</button>
    `;
    $("useDodgeBtn").addEventListener("click", () => resolveDodge(true));
    $("skipDodgeBtn").addEventListener("click", () => resolveDodge(false));
  }
  if (response.kind === "peach") {
    $("responseTitle").textContent = "濒危求救";
    $("responseText").textContent = `${target.name} 体力降至 0。是否使用【灵感补给】脱离濒危？`;
    $("responseActions").innerHTML = `
      <button class="secondary" id="usePeachBtn" type="button">使用灵感补给</button>
      <button class="ghost" id="skipPeachBtn" type="button">放弃</button>
    `;
    $("usePeachBtn").addEventListener("click", () => resolvePeach(true));
    $("skipPeachBtn").addEventListener("click", () => resolvePeach(false));
  }
}

function getHintText() {
  if (state.pendingResponse) return "等待响应";
  if (state.pendingCardIndex !== null) {
    const card = state.players[0]?.hand[state.pendingCardIndex];
    return card ? `选择【${card.name}】的目标` : "选择目标";
  }
  return state.current === 0 ? "选择手牌或结束出牌" : "电脑正在行动";
}

function log(message) {
  const time = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  $("log").insertAdjacentHTML("beforeend", `<p><strong>${time}</strong> ${message}</p>`);
}

$("startBtn").addEventListener("click", startGame);
$("restartBtn").addEventListener("click", () => window.location.reload());
$("skillBtn").addEventListener("click", useSkill);
$("endBtn").addEventListener("click", endHumanTurn);

initSetup();
