export const SAVE_KEY = "mini-fc-career-v1";
export const CLUBS = [
  "Mini FC",
  "Harbor Athletic",
  "Neon United",
  "Parkside",
  "Metro Rovers",
  "Coast City",
];
export function newCareer(name, position) {
  return {
    version: 1,
    name: name.trim().slice(0, 20) || "Captain",
    position: ["Striker", "Midfielder", "Defender"].includes(position)
      ? position
      : "Striker",
    attributes: { pace: 60, shooting: 60, passing: 60 },
    xp: 0,
    points: 0,
    season: 1,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goals: 0,
    championships: 0,
    seasonMatch: 0,
    table: freshTable(),
    history: [],
    lastReward: null,
  };
}
function freshTable() {
  return CLUBS.map((name) => ({
    name,
    played: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }));
}
export function overall(career) {
  return Math.round(
    Object.values(career.attributes).reduce((a, b) => a + b, 0) / 3,
  );
}
export function standings(career) {
  return [...career.table].sort(
    (a, b) =>
      b.points - a.points ||
      b.gf - b.ga - (a.gf - a.ga) ||
      b.gf - a.gf ||
      a.name.localeCompare(b.name),
  );
}
function record(table, a, b, ga, gb) {
  const x = table[a],
    y = table[b];
  x.played++;
  y.played++;
  x.gf += ga;
  x.ga += gb;
  y.gf += gb;
  y.ga += ga;
  if (ga > gb) {
    x.wins++;
    x.points += 3;
    y.losses++;
  } else if (ga < gb) {
    y.wins++;
    y.points += 3;
    x.losses++;
  } else {
    x.draws++;
    y.draws++;
    x.points++;
    y.points++;
  }
}
// A five-round round robin: every club plays each other exactly once.
export const FIXTURES = Array.from({ length: 5 }, (_, round) => {
  let ring = [0, 1, 2, 3, 4, 5];
  for (let r = 0; r < round; r++)
    ring = [ring[0], ring[5], ...ring.slice(1, 5)];
  return [
    [ring[0], ring[5]],
    [ring[1], ring[4]],
    [ring[2], ring[3]],
  ];
});
export function opponent(career) {
  return CLUBS[
    FIXTURES[career.seasonMatch]
      .find((pair) => pair.includes(0))
      .find((id) => id !== 0)
  ];
}
export function finishMatch(career, score, stats, random = Math.random) {
  if (career.seasonMatch >= 5)
    throw new Error("Start the next season before playing.");
  const [home, away] = score;
  const win = home > away;
  const xp = 60 + stats.goals * 40 + (win ? 80 : home === away ? 30 : 0);
  const before = Math.floor(career.xp / 100);
  career.xp += xp;
  career.points += Math.floor(career.xp / 100) - before;
  career.played++;
  career.goals += stats.goals;
  if (win) career.wins++;
  else if (home === away) career.draws++;
  else career.losses++;
  const fixtures = FIXTURES[career.seasonMatch];
  fixtures.forEach(([a, b]) => {
    if (a === 0) record(career.table, a, b, home, away);
    else if (b === 0) record(career.table, a, b, away, home);
    else
      record(
        career.table,
        a,
        b,
        Math.floor(random() * 5),
        Math.floor(random() * 5),
      );
  });
  career.seasonMatch++;
  let champion = false;
  if (career.seasonMatch === 5 && standings(career)[0].name === CLUBS[0]) {
    champion = true;
    career.championships++;
    career.points += 3;
  }
  career.lastReward = {
    xp,
    points: Math.floor(career.xp / 100) - before + (champion ? 3 : 0),
    champion,
  };
  career.history.unshift({
    season: career.season,
    score: `${home}–${away}`,
    goals: stats.goals,
  });
  career.history = career.history.slice(0, 10);
  return career.lastReward;
}
export function upgrade(career, attribute) {
  if (
    !Object.hasOwn(career.attributes, attribute) ||
    career.points < 1 ||
    career.attributes[attribute] >= 99
  )
    return false;
  career.points--;
  career.attributes[attribute] = Math.min(99, career.attributes[attribute] + 3);
  return true;
}
export function nextSeason(career) {
  if (career.seasonMatch !== 5) return false;
  career.season++;
  career.seasonMatch = 0;
  career.table = freshTable();
  return true;
}
export function saveCareer(storage, career) {
  storage.setItem(SAVE_KEY, JSON.stringify(career));
}
export function loadCareer(storage) {
  try {
    const c = JSON.parse(storage.getItem(SAVE_KEY));
    if (
      !c ||
      c.version !== 1 ||
      typeof c.name !== "string" ||
      !["Striker", "Midfielder", "Defender"].includes(c.position)
    )
      return null;
    for (const key of [
      "xp",
      "points",
      "season",
      "played",
      "wins",
      "draws",
      "losses",
      "goals",
      "championships",
      "seasonMatch",
    ])
      if (!Number.isSafeInteger(c[key]) || c[key] < 0) return null;
    if (
      c.seasonMatch > 5 ||
      c.season < 1 ||
      !c.attributes ||
      !["pace", "shooting", "passing"].every(
        (k) =>
          Number.isInteger(c.attributes[k]) &&
          c.attributes[k] >= 60 &&
          c.attributes[k] <= 99,
      )
    )
      return null;
    if (
      !Array.isArray(c.table) ||
      c.table.length !== 6 ||
      !c.table.every(
        (r, i) =>
          r.name === CLUBS[i] &&
          ["played", "wins", "draws", "losses", "gf", "ga", "points"].every(
            (k) => Number.isSafeInteger(r[k]) && r[k] >= 0,
          ),
      )
    )
      return null;
    if (!Array.isArray(c.history)) return null;
    return c;
  } catch {
    return null;
  }
}
