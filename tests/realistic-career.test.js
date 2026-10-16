import test from "node:test";
import assert from "node:assert/strict";
import {
  newCareer,
  FIXTURES,
  fixtureId,
  finishMatch,
  nextSeason,
  standings,
  activity,
  selection,
  upgrade,
  overall,
  respondEvent,
  acceptOffer,
  renewContract,
  retire,
  saveCareer,
  loadCareer,
  SAVE_KEY,
} from "../src/career.js";
import { Match } from "../src/match.js";
import { simulateTo, performance } from "../src/career-match.js";
const store = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v),
  };
};
test("ten-round double round robin, complete standings and idempotent fixture/award handling", () => {
  assert.equal(FIXTURES.length, 10);
  const games = FIXTURES.flat().map((pair) => [...pair].sort().join(":"));
  assert.equal(new Set(games).size, 15);
  for (const id of new Set(games))
    assert.equal(games.filter((x) => x === id).length, 2);
  const c = newCareer("Prospect", "Striker");
  for (let i = 0; i < 10; i++) {
    const id = fixtureId(c);
    finishMatch(
      c,
      [3, 0],
      { goals: 1, minutes: 90, started: true, fixtureId: id },
      () => 0.5,
    );
    const saved = JSON.stringify(c);
    assert.equal(finishMatch(c, [3, 0], { goals: 1, fixtureId: id }), null);
    assert.equal(JSON.stringify(c), saved);
    assert.ok(c.table.every((row) => row.played === i + 1));
  }
  assert.equal(c.championships, 1);
  assert.equal(standings(c)[0].name, "Mini FC");
  assert.throws(() => finishMatch(c, [0, 0], {}));
  assert.equal(nextSeason(c), true);
  assert.equal(nextSeason(c), false);
  assert.equal(c.age, 19);
  assert.equal(c.seasonMatch, 0);
});
test("selection, optional training, gradual potential-limited growth, injuries and retirement", () => {
  const c = newCareer("Prospect", "Striker", "arsenal");
  assert.equal(selection(c).role, "substitute");
  assert.equal(activity(c, "shooting"), true);
  assert.equal(activity(c, "recovery"), false);
  c.points = 5;
  assert.equal(upgrade(c, "pace"), false);
  finishMatch(
    c,
    [2, 0],
    { goals: 1, rating: 8, minutes: 30, started: false },
    () => 0.5,
  );
  assert.ok(c.attributes.shooting > 60 && c.attributes.shooting < 61);
  assert.equal(c.played, 1);
  assert.equal(c.starts, 0);
  assert.equal(c.minutes, 30);
  c.trust = 90;
  c.sharpness = 90;
  assert.equal(selection(c).role, "starter");
  c.injuryMatches = 1;
  assert.equal(selection(c).role, "injured");
  finishMatch(c, [0, 1], { minutes: 0 }, () => 0.5);
  assert.equal(c.injuryMatches, 0);
  assert.equal(c.played, 1);
  c.trust = 10;
  assert.equal(selection(c).role, "bench");
  c.event = { type: "opportunity", id: "chance" };
  assert.equal(respondEvent(c, "accept"), true);
  assert.equal(selection(c).role, "starter");
  assert.equal(respondEvent(c, "accept"), false);
  c.age = 32;
  assert.equal(retire(c), true);
  assert.equal(selection(c).role, "retired");
  assert.throws(() => finishMatch(c, [0, 0], {}));
});
test("substitute simulation and full simulation use the football engine with consistent minutes", () => {
  const c = newCareer("Sub", "Midfielder"),
    id = fixtureId(c);
  const m = new Match({
    career: true,
    careerEntry: 80,
    initialFitness: 80,
    random: () => 0.5,
  });
  simulateTo(m, 80);
  assert.equal(m.controlled, 0);
  assert.equal(m.careerActive, true);
  assert.equal(m.careerStarted, false);
  assert.equal(m.stats.goals, 0);
  simulateTo(m);
  const stats = performance(m, id, true);
  assert.equal(stats.minutes, 30);
  assert.ok(stats.goals <= m.score[0]);
  finishMatch(c, m.score, stats, () => 0.5);
  assert.equal(c.minutes, 30);
  assert.equal(c.starts, 0);
  const bench = new Match({
    career: true,
    careerEntry: null,
    random: () => 0.5,
  });
  simulateTo(bench);
  assert.equal(performance(bench, "bench").minutes, 0);
  assert.equal(bench.stats.goals, 0);
});
test("midseason transfers retain fixture count and standings; outside-group moves wait for season end", () => {
  const c = newCareer("Mover", "Striker", "arsenal");
  finishMatch(c, [1, 0], { goals: 1 }, () => 0.5);
  const snapshot = JSON.stringify(c.table);
  c.offers = [
    {
      id: "move",
      clubId: "chelsea",
      type: "transfer",
      salary: 1200,
      years: 2,
      season: 1,
      expires: 5,
    },
  ];
  assert.equal(acceptOffer(c, "move", "salary"), true);
  assert.equal(c.clubId, "chelsea");
  assert.equal(c.seasonMatch, 1);
  assert.equal(c.weeklySalary, 1320);
  assert.equal(JSON.stringify(c.table), snapshot);
  assert.ok(c.clubIndex > 0);
  c.offers = [
    {
      id: "future",
      clubId: "barcelona",
      type: "transfer",
      salary: 3000,
      years: 2,
      season: 1,
      expires: 10,
    },
  ];
  assert.equal(acceptOffer(c, "future"), true);
  assert.equal(c.clubId, "chelsea");
  assert.equal(c.pendingMove.clubId, "barcelona");
  while (c.seasonMatch < 10) finishMatch(c, [1, 1], { minutes: 30 }, () => 0.5);
  nextSeason(c);
  assert.equal(c.clubId, "barcelona");
  assert.equal(c.seasonMatch, 0);
  assert.equal(c.clubHistory.length, 3);
  c.contract.years = 1;
  c.trust = 80;
  assert.equal(renewContract(c, "salary"), true);
  assert.equal(c.contract.years, 2);
  const loan = newCareer("Loan", "Striker", "arsenal");
  loan.offers = [
    {
      id: "loan",
      clubId: "chelsea",
      type: "loan",
      salary: 900,
      years: 1,
      season: 1,
      expires: 10,
    },
  ];
  acceptOffer(loan, "loan");
  assert.equal(loan.loan.parentClubId, "arsenal");
  assert.equal(loan.weeklySalary, 900);
  while (loan.seasonMatch < 10)
    finishMatch(loan, [1, 1], { minutes: 0 }, () => 0.5);
  nextSeason(loan);
  assert.equal(loan.clubId, "arsenal");
  assert.equal(loan.weeklySalary, 500);
  assert.equal(loan.loan, null);
});
test("v1/v2 migration backs up exact data, extends an unfinished season and archives completed legacy seasons", () => {
  const legacy = (rounds) => {
    const c = newCareer("Old captain", "Midfielder");
    for (let i = 0; i < rounds; i++)
      finishMatch(c, [2, 0], { goals: 1 }, () => 0.5);
    c.version = 2;
    for (const k of [
      "age",
      "potential",
      "trust",
      "form",
      "sharpness",
      "fitness",
      "reputation",
      "injuryMatches",
      "retired",
      "appearances",
      "starts",
      "minutes",
      "matchesCompleted",
      "clubIndex",
      "contract",
      "weeklySalary",
      "marketValue",
      "earnings",
      "offers",
      "pendingMove",
      "loan",
      "activityFixture",
      "promiseStarts",
      "event",
      "news",
      "fixtureLog",
      "seasonStats",
      "records",
      "clubHistory",
      "seasonHistory",
    ])
      delete c[k];
    return c;
  };
  for (const rounds of [2, 5]) {
    const old = legacy(rounds),
      s = store(),
      raw = JSON.stringify(old);
    s.setItem(SAVE_KEY, raw);
    const c = loadCareer(s);
    assert.ok(c);
    assert.equal(s.getItem(SAVE_KEY + "-backup-v2"), raw);
    assert.equal(c.xp, old.xp);
    assert.equal(c.goals, old.goals);
    assert.equal(c.seasonMatch, rounds === 5 ? 0 : 2);
    assert.equal(c.season, rounds === 5 ? 2 : 1);
    assert.equal(c.fixtureLog.length, c.seasonMatch);
    saveCareer(s, c);
    assert.deepEqual(loadCareer(s), c);
  }
  const old = legacy(1);
  old.version = 1;
  const raw = JSON.stringify(old),
    s = store();
  s.setItem(SAVE_KEY, raw);
  assert.ok(loadCareer(s));
  assert.equal(s.getItem(SAVE_KEY + "-backup-v1"), raw);
  const readonly = {
    getItem: (k) => (k === SAVE_KEY ? raw : null),
    setItem: () => {
      throw new Error("quota");
    },
  };
  assert.ok(loadCareer(readonly));
  assert.throws(() => saveCareer(readonly, loadCareer(readonly)));
});
test("one seeded full season supports training, selection, actual match simulation, events and persistent statistics", () => {
  let seed = 7103;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const c = newCareer("Season runner", "Striker"),
    s = store();
  for (let i = 0; i < 10; i++) {
    activity(c, c.fitness < 70 ? "recovery" : "shooting");
    if (c.event) respondEvent(c, "accept");
    const pick = selection(c);
    const m = new Match({
      career: true,
      careerEntry:
        pick.entryMinute === null ? null : (pick.entryMinute / 90) * 120,
      initialFitness: c.fitness,
      random,
    });
    simulateTo(m);
    finishMatch(c, m.score, performance(m, fixtureId(c), true), random);
    saveCareer(s, c);
    assert.deepEqual(loadCareer(s), c);
  }
  assert.equal(c.matchesCompleted, 10);
  assert.equal(
    c.table.reduce((sum, r) => sum + r.played, 0),
    60,
  );
  assert.ok(c.minutes <= c.played * 90);
  assert.ok(overall(c) >= 60 && overall(c) < 66);
  assert.equal(c.fixtureLog.length, 10);
  assert.ok(Number.isFinite(c.marketValue));
});
