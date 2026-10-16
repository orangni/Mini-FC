import test from "node:test";
import assert from "node:assert/strict";
import { runBalance, simulate } from "../tools/balance.mjs";

test("seeded 6v6 matches finish on every difficulty with stable velocities and meaningful football", () => {
  const result = runBalance(4);
  for (const row of result.matches) {
    assert.ok(row.shots > 0, `${row.difficulty}/${row.seed}: no shots`);
    assert.ok(row.passes > 5);
    assert.ok(row.completed > 0);
    assert.ok(row.maxPlayerSpeed < 30, `player velocity ${row.maxPlayerSpeed}`);
    assert.ok(row.maxBallSpeed < 60, `ball velocity ${row.maxBallSpeed}`);
    assert.ok(row.longestHold < 15, `stuck carrier: ${row.longestHold}`);
    assert.ok(row.switches < 150);
    assert.ok(row.clusterPairs / row.samples < 0.8);
  }
  for (const summary of result.summary) {
    assert.ok(summary.goals > 0);
    assert.ok(summary.shots > 3);
    assert.ok(summary.passCompletion > 0.3 && summary.passCompletion < 1);
  }
});
test("seeded simulations reproduce all goals, passes, tackles and save outcomes", () => {
  assert.deepEqual(simulate(98765, "normal"), simulate(98765, "normal"));
});
