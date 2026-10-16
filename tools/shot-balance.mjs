import { Match } from "../src/match.js";
import { pathToFileURL } from "node:url";
export function shotTrial({
  type = "normal",
  seed = 1,
  x = 0,
  z = -22,
  keeperZ = -32.7,
  power = 0.5,
  difficulty = "normal",
} = {}) {
  let value = seed;
  const random = () => {
    value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
    return value / 4294967296;
  };
  const m = new Match({ assisted: true, career: true, random, difficulty });
  m.kickoffWait = 0;
  m.ai = (p, dt) => {
    if (p.role === "goalkeeper") m.goalkeeper(p, dt);
  };
  m.players.forEach((p, i) =>
    Object.assign(p, {
      x: p.team ? 21 : -21,
      z: 15 + i * 0.3,
      cooldown: 0,
      protected: 0,
    }),
  );
  Object.assign(m.players[0], { x, z, dx: 0, dz: -1 });
  Object.assign(m.players[11], { x: 0, z: keeperZ });
  Object.assign(m.ball, { owner: 0, x, z: z - 0.75, y: 0.35 });
  m.shoot(0, true, { type, power });
  let peak = 0;
  for (let i = 0; i < 240; i++) {
    m.step(1 / 60);
    peak = Math.max(peak, m.ball.y);
    if (m.score[0]) return { outcome: "goal", peak };
    if (m.stats.saves[1]) return { outcome: "save", peak };
    if (m.ball.z < -30 && m.ball.vz > 0) return { outcome: "wide", peak };
  }
  return { outcome: "miss", peak };
}
export function shotBalance() {
  const rows = [];
  for (const scenario of [
    { name: "box", keeperZ: -32.7, z: -22 },
    { name: "one-on-one", keeperZ: -28, z: -18 },
  ])
    for (const type of ["normal", "finesse", "chip", "power"]) {
      const row = {
        scenario: scenario.name,
        type,
        attempts: 0,
        goals: 0,
        saves: 0,
        misses: 0,
      };
      for (const x of [-5, 0, 5])
        for (let i = 0; i < 20; i++) {
          const result = shotTrial({
            ...scenario,
            x,
            type,
            power: type === "power" ? 1 : 0.5,
            seed: 137 + i * 7919,
          });
          row.attempts++;
          if (result.outcome === "goal") row.goals++;
          else if (result.outcome === "save") row.saves++;
          else row.misses++;
        }
      rows.push(row);
    }
  return rows;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  console.log(JSON.stringify(shotBalance(), null, 2));
