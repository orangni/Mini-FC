import test from "node:test";
import assert from "node:assert/strict";
import { shotBalance, shotTrial } from "../tools/shot-balance.mjs";
import { translateText } from "../src/i18n.js";
import {
  OUTFIELD_SKILLS,
  KEEPER_SKILLS,
  skillLabel,
  skillDescription,
} from "../src/skills.js";
import { Match } from "../src/match.js";
test("normal and finesse shots can score without a full power charge, but a keeper can still save them", () => {
  const rows = shotBalance();
  for (const type of ["normal", "finesse"]) {
    const row = rows.find((r) => r.scenario === "box" && r.type === type);
    assert.ok(row.goals >= 10 && row.goals < 45, JSON.stringify(row));
    assert.ok(row.saves > 0);
  }
  const chip = rows.filter((r) => r.type === "chip");
  assert.ok(
    chip.find((r) => r.scenario === "one-on-one").goals >
      chip.find((r) => r.scenario === "box").goals + 15,
  );
  const power = rows.find((r) => r.scenario === "box" && r.type === "power");
  assert.ok(power.misses > 0);
});
test("chip shots still have a real arc and high saves are possible from the goal line", () => {
  assert.ok(
    shotTrial({ type: "chip", keeperZ: -28, z: -18, seed: 137 }).peak > 2.5,
  );
  const m = new Match();
  m.kickoffWait = 0;
  Object.assign(m.players[11], {
    x: 0,
    z: -32.7,
    action: "high-save",
    actionTime: 0.4,
    saveCooldown: 0,
  });
  Object.assign(m.ball, {
    owner: null,
    x: 0,
    z: -32.2,
    y: 2.7,
    vx: 0,
    vz: -15,
  });
  assert.equal(m.trySaves(), true);
});
test("sixteen selectable signatures have separate English and Korean names and descriptions", () => {
  assert.equal(OUTFIELD_SKILLS.length, 16);
  assert.equal(new Set(OUTFIELD_SKILLS.map((s) => s.id)).size, 16);
  for (const s of [...OUTFIELD_SKILLS, ...KEEPER_SKILLS]) {
    assert.ok(/[가-힣]/.test(skillLabel(s, "ko")));
    assert.ok(/[가-힣]/.test(skillDescription(s, "ko")));
    assert.ok(!/[가-힣]/.test(skillLabel(s, "en")));
    assert.ok(!/[가-힣]/.test(skillDescription(s, "en")));
    assert.ok(skillDescription(s, "en").length > 20);
  }
});
test("language helpers translate menus and dynamic career/score text without changing canonical English", () => {
  for (const [source, expected] of [
    ["PASS", "패스"],
    ["← MAIN MENU", "← 메인 메뉴"],
    ["NEXT FIXTURE / 2 OF 5", "다음 경기 / 5경기 중 2번째"],
    ["3 upgrade points", "성장 포인트 3점"],
    ["Season 2 standings", "시즌 2 순위"],
    ["#7 · STRIKER · YOU", "#7 · 공격수 · 내 선수"],
  ]) {
    assert.equal(translateText(source, "ko"), expected);
    assert.equal(translateText(source, "en"), source);
  }
  for (const name of ["Spin Captain", "constructor", "__proto__"])
    assert.equal(translateText(name, "ko"), name);
  assert.equal(translateText("   PASS  ", "ko"), "   패스  ");
});
