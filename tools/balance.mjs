import { Match } from "../src/match.js";
import { pathToFileURL } from "node:url";
export function simulate(seed, difficulty = "normal") {
  const initialSeed = seed;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const m = new Match({ demo: true, difficulty, random });
  const data = {
    seed: initialSeed,
    difficulty,
    goals: 0,
    shots: 0,
    passes: 0,
    completed: 0,
    switches: 0,
    tackles: 0,
    interceptions: 0,
    saves: 0,
    clusterPairs: 0,
    samples: 0,
    maxPlayerSpeed: 0,
    maxBallSpeed: 0,
    longestHold: 0,
    shotLocations: [],
    techniques: {},
  };
  let possession = 0;
  for (let frame = 0; frame < 60 * 210 && !m.finished; frame++) {
    const pass = m.pendingPass ? { ...m.pendingPass } : null;
    const before = m.players.map((p) => ({ x: p.x, z: p.z }));
    const restarting = m.kickoffWait > 0;
    m.step(1 / 60);
    const events = m.takeEvents();
    for (const e of events) {
      if (e.type === "shot") {
        data.shots++;
        const shooter = m.players[e.player ?? m.ball.lastPlayer];
        data.shotLocations.push({ x: shooter.x, z: shooter.z });
        data.techniques[e.technique] = (data.techniques[e.technique] || 0) + 1;
      }
      if (e.type === "pass") data.passes++;
      if (e.type === "tackle") data.tackles++;
      if (e.type === "save") data.saves++;
    }
    if (m.ball.owner !== null) {
      const team = m.players[m.ball.owner].team;
      if (team !== possession && !restarting) {
        data.switches++;
        possession = team;
      }
      if (
        pass &&
        !m.pendingPass &&
        !events.some(
          (e) => e.type === "save" || e.type === "goal" || e.type === "tackle",
        )
      ) {
        if (team === pass.team && m.ball.owner !== pass.sender)
          data.completed++;
        else if (team !== pass.team) data.interceptions++;
      }
    }
    if (!restarting && !events.some((e) => e.type === "goal")) {
      m.players.forEach((p, i) => {
        data.maxPlayerSpeed = Math.max(
          data.maxPlayerSpeed,
          Math.hypot(p.x - before[i].x, p.z - before[i].z) * 60,
        );
      });
      data.longestHold = Math.max(
        data.longestHold,
        ...m.players.map((p) => p.possessionTime || 0),
      );
      data.maxBallSpeed = Math.max(
        data.maxBallSpeed,
        Math.hypot(m.ball.vx, m.ball.vz, m.ball.vy),
      );
      if (frame % 30 === 0) {
        data.samples++;
        for (let i = 0; i < 12; i++)
          for (let j = i + 1; j < 12; j++)
            if (
              m.players[i].team === m.players[j].team &&
              Math.hypot(
                m.players[i].x - m.players[j].x,
                m.players[i].z - m.players[j].z,
              ) < 2.5
            )
              data.clusterPairs++;
      }
    }
    if (
      !m.players.every((p) =>
        [p.x, p.z, p.vx ?? 0, p.vz ?? 0, p.dx, p.dz].every(Number.isFinite),
      ) ||
      ![m.ball.x, m.ball.y, m.ball.z, m.ball.vx, m.ball.vz, m.ball.vy].every(
        Number.isFinite,
      )
    )
      throw new Error(`Nonfinite state: ${initialSeed}/${frame}`);
  }
  if (!m.finished) throw new Error(`Match stuck: ${initialSeed}`);
  data.goals = m.score[0] + m.score[1];
  data.score = m.score;
  return data;
}
export function runBalance(
  count = 12,
  difficulties = ["easy", "normal", "hard"],
) {
  const rows = [];
  for (const difficulty of difficulties)
    for (let i = 0; i < count; i++)
      rows.push(simulate(123456 + i * 7919, difficulty));
  const summary = difficulties.map((difficulty) => {
    const a = rows.filter((r) => r.difficulty === difficulty),
      sum = (k) => a.reduce((v, r) => v + r[k], 0);
    return {
      difficulty,
      matches: a.length,
      goals: sum("goals") / a.length,
      shots: sum("shots") / a.length,
      passes: sum("passes") / a.length,
      passCompletion: sum("completed") / Math.max(1, sum("passes")),
      possessionSwitches: sum("switches") / a.length,
      tackles: sum("tackles") / a.length,
      interceptions: sum("interceptions") / a.length,
      saves: sum("saves") / a.length,
      closeTeammatePairs: sum("clusterPairs") / sum("samples"),
      peakPlayerSpeed: Math.max(...a.map((r) => r.maxPlayerSpeed)),
      peakBallSpeed: Math.max(...a.map((r) => r.maxBallSpeed)),
      longestHold: Math.max(...a.map((r) => r.longestHold)),
    };
  });
  return { summary, matches: rows };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const count = Math.max(1, Number(process.argv[2]) || 12);
  const difficulties = process.argv[3]
    ? [process.argv[3]]
    : ["easy", "normal", "hard"];
  console.log(JSON.stringify(runBalance(count, difficulties), null, 2));
}
