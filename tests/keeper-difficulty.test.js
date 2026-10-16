import test from "node:test";
import assert from "node:assert/strict";
import { Match, DIFFICULTIES } from "../src/match.js";
import { shotTrial } from "../tools/shot-balance.mjs";
import { translateText } from "../src/i18n.js";

test("set keepers read long chips and retreat under the descending ball at either goal", () => {
  for (const team of [0, 1])
    for (const z of [0, 8]) {
      const m = new Match({ random: () => 0.5 });
      m.kickoffWait = 0;
      m.ai = (p, dt) => {
        if (p.role === "goalkeeper") m.goalkeeper(p, dt);
      };
      m.players.forEach((p) =>
        Object.assign(p, { x: 21, z: 15, vx: 0, vz: 0 }),
      );
      const shooter = m.players[team ? 3 : 0],
        keeper = m.players[team ? 8 : 11];
      const dir = team ? 1 : -1;
      Object.assign(shooter, { x: 0, z: dir * z, dx: 0, dz: dir });
      Object.assign(keeper, { x: 0, z: dir * 32.7 });
      Object.assign(m.ball, {
        owner: shooter.id,
        x: 0,
        z: dir * (z + 0.75),
        y: 0.35,
      });
      assert.equal(m.shoot(shooter.id, true, { type: "chip", aimX: 0 }), true);
      let deepest = 32.7,
        previous = keeper.z,
        jumped = false;
      for (
        let i = 0;
        i < 240 && !m.stats.saves[1 - team] && !m.score[team];
        i++
      ) {
        m.step(1 / 60);
        assert.ok(
          Math.abs(keeper.z - previous) < 0.3,
          "keeper must move rather than teleport",
        );
        previous = keeper.z;
        deepest = Math.max(deepest, keeper.z * dir);
        jumped ||= keeper.action === "high-save";
      }
      assert.ok(deepest > 33.1, `no retreat: team ${team}, z ${z}`);
      assert.ok(jumped, "descending chip should trigger a high save");
      assert.equal(m.score[team], 0);
      assert.equal(m.stats.saves[1 - team], 1);
    }
});

test("midfield chips are stoppable across difficulties and off-centre shots", () => {
  for (const difficulty of Object.keys(DIFFICULTIES))
    for (const z of [0, -8]) {
      let saves = 0;
      for (const x of [-4, 0, 4])
        for (const seed of [137, 8056, 15975]) {
          if (
            shotTrial({ type: "chip", z, x, seed, difficulty }).outcome ===
            "save"
          )
            saves++;
        }
      assert.ok(saves >= 7, `${difficulty} at ${z}: ${saves}/9 saves`);
    }
});

test("Extra Hard reacts faster and coordinates a second presser while retaining cover and keeper protection", () => {
  const hard = new Match({ difficulty: "hard" }),
    extra = new Match({ difficulty: "extra-hard" });
  assert.ok(extra.config(1).reaction < hard.config(1).reaction);
  assert.ok(extra.config(1).keeperReaction < hard.config(1).keeperReaction);
  assert.ok(extra.config(1).anticipation > hard.config(1).anticipation);
  assert.deepEqual(extra.config(0), DIFFICULTIES.normal);
  assert.deepEqual(
    extra.attributesFor(extra.players[3]),
    hard.attributesFor(hard.players[3]),
  );
  for (const m of [hard, extra]) {
    m.kickoffWait = 0;
    Object.assign(m.players[0], { x: 0, z: -12 });
    Object.assign(m.ball, { owner: 0, x: 0, z: -12.75 });
    Object.assign(m.players[3], { x: 0, z: -14 });
    Object.assign(m.players[4], { x: 3, z: -16 });
    Object.assign(m.players[5], { x: -2, z: -28 });
    Object.assign(m.players[9], { x: 10, z: 0 });
    Object.assign(m.players[10], { x: -12, z: -2 });
    m.buildTactics();
  }
  const plan = extra.tactics[1];
  assert.notEqual(plan.support, undefined);
  assert.notEqual(plan.support, plan.presser);
  assert.notEqual(plan.support, plan.cover);
  assert.equal(hard.tactics[1].support, undefined);
  extra.ai(extra.players[plan.support], 1 / 60);
  assert.ok(
    extra.players[plan.support].stamina < 1,
    "supporting press should use sprint stamina",
  );
  extra.ball.owner = 8;
  extra.buildTactics();
  assert.equal(
    extra.tactics[1].support,
    undefined,
    "do not double-press a keeper holding the ball",
  );
  assert.equal(translateText("Extra Hard", "ko"), "엑스트라 하드");
});
