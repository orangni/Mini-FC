import { getClub, CLUB_DATABASE } from "./clubs.js";
import { outfieldSkill } from "./skills.js";
export const SAVE_KEY = "mini-fc-career-v1";
export const CLUBS = [
  "Mini FC",
  "Harbor Athletic",
  "Neon United",
  "Parkside",
  "Metro Rovers",
  "Coast City",
];
export function newCareer(
  name,
  position,
  clubId = "mini-fc",
  skillId = "body-feint",
) {
  return {
    version: 3,
    skillId: outfieldSkill(skillId).id,
    clubId: getClub(clubId).id,
    assists: 0,
    ratingTotal: 0,
    lastRating: 6,
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
    table: freshTable(clubId),
    history: [],
    lastReward: null,
    ...careerDefaults(clubId),
  };
}
export function freshTable(clubId = "mini-fc") {
  const club = getClub(clubId);
  const sameLeague = CLUB_DATABASE.filter(
    (c) => c.league === club.league && c.id !== club.id,
  );
  const others = CLUB_DATABASE.filter(
    (c) => c.id !== club.id && c.league !== club.league,
  );
  const names =
    club.id === "mini-fc"
      ? CLUBS
      : [
          club.name,
          ...[...sameLeague, ...others].slice(0, 5).map((c) => c.name),
        ];
  return names.map((name) => ({
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
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rounded = (v) => Math.round(v * 100) / 100;
export const SEASON_MATCHES = 10;
function strength(id) {
  return getClub(id).ratings.midfield;
}
function careerDefaults(clubId) {
  return {
    age: 18,
    potential: 84,
    trust: 45,
    form: 50,
    sharpness: 55,
    fitness: 100,
    reputation: 8,
    injuryMatches: 0,
    retired: false,
    appearances: 0,
    starts: 0,
    minutes: 0,
    matchesCompleted: 0,
    clubIndex: 0,
    contract: { years: 2 },
    weeklySalary: 500,
    marketValue: 150000,
    earnings: 0,
    offers: [],
    pendingMove: null,
    loan: null,
    activityFixture: null,
    promiseStarts: 0,
    event: null,
    news: [],
    fixtureLog: [],
    seasonStats: {
      appearances: 0,
      starts: 0,
      minutes: 0,
      goals: 0,
      assists: 0,
      ratingTotal: 0,
    },
    records: { mostGoals: 0, bestRating: 6, bestOverall: 60 },
    clubHistory: [
      {
        clubId: getClub(clubId).id,
        from: 1,
        to: null,
        appearances: 0,
        goals: 0,
        assists: 0,
      },
    ],
    seasonHistory: [],
  };
}
export function overall(career) {
  const w =
    career.position === "Striker"
      ? [0.2, 0.55, 0.25]
      : career.position === "Defender"
        ? [0.4, 0.15, 0.45]
        : [0.2, 0.2, 0.6];
  return Math.round(
    ["pace", "shooting", "passing"].reduce(
      (sum, k, i) => sum + career.attributes[k] * w[i],
      0,
    ),
  );
}
export function fixtureId(c) {
  return `${c.season}:${c.seasonMatch}`;
}
export function currentClub(c) {
  return c.table[c.clubIndex || 0];
}
export function selection(c) {
  if (c.retired) return { role: "retired", entryMinute: null, minutes: 0 };
  if (c.contract.years === 0 && !c.loan)
    return { role: "bench", entryMinute: null, minutes: 0 };
  if (c.injuryMatches > 0)
    return { role: "injured", entryMinute: null, minutes: 0 };
  const competition = 56 + Math.max(0, strength(c.clubId) - overall(c)) * 0.25;
  const score = c.trust + (c.form - 50) * 0.12 + (c.sharpness - 50) * 0.08;
  if (c.fitness >= 55 && (c.promiseStarts > 0 || score >= competition))
    return { role: "starter", entryMinute: 0, minutes: 90 };
  if (c.fitness >= 40 && score >= 36)
    return {
      role: "substitute",
      entryMinute: score >= 46 ? 60 : 75,
      minutes: score >= 46 ? 30 : 15,
    };
  return { role: "bench", entryMinute: null, minutes: 0 };
}
export function matchAttributes(c) {
  return Object.fromEntries(
    Object.entries(c.attributes).map(([k, v]) => [
      k,
      clamp(
        v * (0.95 + c.sharpness * 0.0005) * (0.97 + c.form * 0.0006),
        40,
        99,
      ),
    ]),
  );
}
function grow(c, k, amount) {
  if (amount > 0 && overall(c) >= c.potential) return;
  c.attributes[k] = rounded(
    clamp(c.attributes[k] + amount, 40, Math.min(99, c.potential + 4)),
  );
}
export function activity(c, kind) {
  if (
    c.retired ||
    c.seasonMatch >= 10 ||
    c.activityFixture === fixtureId(c) ||
    !["pace", "shooting", "passing", "recovery"].includes(kind)
  )
    return false;
  if (c.injuryMatches > 0 && kind !== "recovery") return false;
  c.activityFixture = fixtureId(c);
  if (kind === "recovery") {
    c.fitness = clamp(c.fitness + 10, 0, 100);
    c.sharpness = clamp(c.sharpness + 1, 0, 100);
  } else {
    grow(c, kind, 0.14);
    c.fitness = clamp(c.fitness - 5, 0, 100);
    c.sharpness = clamp(c.sharpness + 4, 0, 100);
    c.trust = clamp(c.trust + 2, 0, 100);
  }
  return true;
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
const FIRST_LEG = Array.from({ length: 5 }, (_, round) => {
  let ring = [0, 1, 2, 3, 4, 5];
  for (let r = 0; r < round; r++)
    ring = [ring[0], ring[5], ...ring.slice(1, 5)];
  return [
    [ring[0], ring[5]],
    [ring[1], ring[4]],
    [ring[2], ring[3]],
  ];
});
export const FIXTURES = [
  ...FIRST_LEG,
  ...FIRST_LEG.map((round) => round.map(([a, b]) => [b, a])),
];
export function opponent(career) {
  if (career.seasonMatch >= 10) return "";
  const index = career.clubIndex || 0;
  return career.table[
    FIXTURES[career.seasonMatch]
      .find((pair) => pair.includes(index))
      .find((id) => id !== index)
  ].name;
}
export function finishMatch(career, score, stats = {}, random = Math.random) {
  const supplied = stats.fixtureId;
  if (supplied && career.fixtureLog.some((row) => row.id === supplied))
    return null;
  if (career.retired || career.seasonMatch >= 10)
    throw new Error("Start the next season before playing.");
  const id = fixtureId(career);
  if (supplied && supplied !== id) throw new Error("Stale career fixture.");
  if (
    !Array.isArray(score) ||
    score.length !== 2 ||
    !score.every((v) => Number.isSafeInteger(v) && v >= 0)
  )
    throw new Error("Invalid score.");
  const [home, away] = score,
    win = home > away;
  const minutes = clamp(Math.round(stats.minutes ?? 90), 0, 90),
    appeared = minutes > 0;
  const started = appeared && (stats.started ?? minutes === 90);
  const goals = appeared ? clamp(Math.floor(stats.goals || 0), 0, home) : 0;
  const assists = appeared
    ? clamp(Math.floor(stats.assists || 0), 0, home - goals)
    : 0;
  const rating = appeared
    ? clamp(stats.rating ?? 6 + goals * 0.9 + assists * 0.65, 3, 10)
    : null;
  const xp =
    (appeared ? 60 : 20) + goals * 40 + (win ? 80 : home === away ? 30 : 0);
  const before = Math.floor(career.xp / 100),
    oldTrust = career.trust;
  career.xp += xp;
  career.points += Math.floor(career.xp / 100) - before;
  career.matchesCompleted++;
  career.played += appeared ? 1 : 0;
  career.appearances = career.played;
  career.starts += started ? 1 : 0;
  career.minutes += minutes;
  career.goals += goals;
  career.assists += assists;
  if (appeared) {
    career.lastRating = rating;
    career.ratingTotal += rating;
    career.form = rounded(
      clamp(career.form * 0.7 + ((rating - 3) / 7) * 100 * 0.3, 0, 100),
    );
    career.trust = rounded(
      clamp(career.trust + (rating - 6.4) * 2.5 + (started ? 0.5 : 1), 0, 100),
    );
    career.reputation = rounded(
      clamp(
        career.reputation + Math.max(-0.5, (rating - 6) * 0.7) + goals * 0.15,
        0,
        100,
      ),
    );
    career.sharpness = clamp(career.sharpness + 3 + minutes / 18, 0, 100);
    if (career.age < 30)
      for (const k of ["pace", "shooting", "passing"])
        grow(
          career,
          k,
          (0.025 + Math.max(0, rating - 6) * 0.02) * (minutes / 90),
        );
  } else {
    career.sharpness = clamp(career.sharpness - 3, 0, 100);
    if (!career.injuryMatches) career.trust = clamp(career.trust - 0.5, 0, 100);
  }
  career.fitness = rounded(
    clamp(
      career.fitness +
        10 -
        (minutes / 90) * (19 + (1 - (stats.stamina ?? 0.6)) * 5),
      0,
      100,
    ),
  );
  const injuredBefore = career.injuryMatches > 0;
  if (injuredBefore) career.injuryMatches--;
  else if (appeared && random() < (career.fitness < 50 ? 0.045 : 0.015))
    career.injuryMatches = 1;
  if (career.promiseStarts > 0 && appeared) career.promiseStarts--;
  if (win) career.wins++;
  else if (home === away) career.draws++;
  else career.losses++;
  const index = career.clubIndex || 0;
  for (const [a, b] of FIXTURES[career.seasonMatch]) {
    if (a === index) record(career.table, a, b, home, away);
    else if (b === index) record(career.table, a, b, away, home);
    else
      record(
        career.table,
        a,
        b,
        Math.floor(random() * 5),
        Math.floor(random() * 5),
      );
  }
  const season = career.seasonStats;
  for (const [key, value] of Object.entries({
    appearances: appeared ? 1 : 0,
    starts: started ? 1 : 0,
    minutes,
    goals,
    assists,
    ratingTotal: rating || 0,
  }))
    season[key] += value;
  const club = career.clubHistory.at(-1);
  club.appearances += appeared ? 1 : 0;
  club.goals += goals;
  club.assists += assists;
  career.earnings += career.contract.years > 0 ? career.weeklySalary * 5 : 0;
  career.records.mostGoals = Math.max(career.records.mostGoals, goals);
  career.records.bestRating = Math.max(career.records.bestRating, rating || 0);
  career.records.bestOverall = Math.max(
    career.records.bestOverall,
    overall(career),
  );
  const entry = {
    id,
    season: career.season,
    round: career.seasonMatch,
    clubId: career.clubId,
    score: `${home}–${away}`,
    goals,
    assists,
    rating,
    minutes,
    started,
    simulated: !!stats.simulated,
  };
  career.fixtureLog.push(entry);
  career.history.unshift(entry);
  career.history = career.history.slice(0, 40);
  career.seasonMatch++;
  let champion = false;
  if (career.seasonMatch === 10) {
    champion = standings(career)[0].name === currentClub(career).name;
    if (champion) {
      career.championships++;
      career.points += 3;
      career.reputation = clamp(career.reputation + 4, 0, 100);
    }
    career.seasonHistory.push({
      season: career.season,
      clubId: career.clubId,
      matches: 10,
      rank:
        standings(career).findIndex(
          (r) => r.name === currentClub(career).name,
        ) + 1,
      ...season,
    });
    career.seasonHistory = career.seasonHistory.slice(-40);
  }
  career.marketValue = Math.round(
    Math.max(1, overall(career) - 40) ** 2 *
      400 *
      (1 + career.reputation / 60) *
      (career.age < 25 ? 1.25 : career.age > 31 ? 0.65 : 1),
  );
  career.lastReward = {
    xp,
    points: Math.floor(career.xp / 100) - before + (champion ? 3 : 0),
    champion,
    minutes,
    started,
    rating,
    trustChange: rounded(career.trust - oldTrust),
    injured: career.injuryMatches > 0,
  };
  career.offers = career.offers.filter(
    (o) => o.season === career.season && o.expires >= career.seasonMatch,
  );
  if (career.seasonMatch % 2 === 0) careerEvent(career, random);
  return career.lastReward;
}
export function upgrade(career, attribute) {
  if (
    !Object.hasOwn(career.attributes, attribute) ||
    career.points < 1 ||
    career.attributes[attribute] >= Math.min(99, career.potential + 4) ||
    overall(career) >= career.potential ||
    career.retired ||
    career.seasonMatch >= 10 ||
    career.activityFixture === fixtureId(career)
  )
    return false;
  career.points--;
  career.activityFixture = fixtureId(career);
  career.fitness = clamp(career.fitness - 3, 0, 100);
  career.sharpness = clamp(career.sharpness + 3, 0, 100);
  career.trust = clamp(career.trust + 1, 0, 100);
  grow(career, attribute, 0.4);
  return true;
}
function news(c, text) {
  c.news.unshift({ season: c.season, round: c.seasonMatch, text });
  c.news = c.news.slice(0, 8);
}
export function careerEvent(c, random = Math.random) {
  if (!c.event) {
    const type =
      c.contract.years <= 1 && c.seasonMatch >= 6
        ? "renewal"
        : c.lastRating >= 7.5 && c.form > 60
          ? "praise"
          : c.trust < 58
            ? "opportunity"
            : "competition";
    c.event = { id: `${fixtureId(c)}:${type}`, type };
  }
  if (
    c.offers.length < 2 &&
    (c.season > 1 || selection(c).role !== "starter")
  ) {
    const candidates = CLUB_DATABASE.filter(
      (club) =>
        club.id !== c.clubId &&
        club.id !== c.loan?.parentClubId &&
        club.ratings.midfield <= overall(c) + 12 + c.reputation * 0.15,
    );
    if (candidates.length && random() < 0.7) {
      const club =
        candidates[
          Math.floor(random() * candidates.length) % candidates.length
        ];
      if (!c.offers.some((o) => o.clubId === club.id))
        c.offers.push({
          id: `${fixtureId(c)}:${club.id}`,
          clubId: club.id,
          type:
            c.season === 1 && strength(c.clubId) - overall(c) > 10
              ? "loan"
              : "transfer",
          salary: Math.round(400 + overall(c) * 8 + c.reputation * 35),
          years: 2,
          season: c.season,
          expires: Math.min(10, c.seasonMatch + 4),
        });
    }
  }
}
export function respondEvent(c, choice) {
  if (!c.event || !["accept", "alternative"].includes(choice)) return false;
  const type = c.event.type;
  if (type === "renewal")
    return renewContract(c, choice === "alternative" ? "salary" : "standard");
  if (type === "opportunity") {
    if (choice === "accept") {
      c.promiseStarts = 1;
      c.trust = clamp(c.trust + 2, 0, 100);
    } else c.fitness = clamp(c.fitness + 8, 0, 100);
  } else if (type === "praise") {
    if (choice === "accept") c.trust = clamp(c.trust + 3, 0, 100);
    else {
      c.reputation = clamp(c.reputation + 2, 0, 100);
      c.trust = clamp(c.trust - 1, 0, 100);
    }
  } else {
    if (choice === "accept") {
      c.sharpness = clamp(c.sharpness + 6, 0, 100);
      c.fitness = clamp(c.fitness - 4, 0, 100);
      c.trust = clamp(c.trust + 1, 0, 100);
    } else c.fitness = clamp(c.fitness + 5, 0, 100);
  }
  news(c, type + ":" + choice);
  c.event = null;
  return true;
}
export function renewContract(c, choice = "standard") {
  if (c.retired || c.contract.years > 1 || c.renewalFixture === fixtureId(c))
    return false;
  c.renewalFixture = fixtureId(c);
  if (choice === "salary" && c.trust < 65) {
    c.trust = clamp(c.trust - 2, 0, 100);
    news(c, "renewal:declined");
    c.event = null;
    return false;
  }
  c.contract.years = 2;
  c.weeklySalary = Math.round(
    c.weeklySalary * (choice === "salary" ? 1.3 : 1.15),
  );
  c.event = null;
  news(c, "renewal:signed");
  return true;
}
function moveClub(c, offer) {
  const old = c.clubId,
    oldIndex = c.clubIndex;
  c.clubHistory.at(-1).to = c.season;
  c.clubId = offer.clubId;
  const index = c.table.findIndex(
    (row) => row.name === getClub(offer.clubId).name,
  );
  if (index >= 0) c.clubIndex = index;
  c.trust = clamp(
    42 + c.reputation * 0.12 - (strength(c.clubId) - overall(c)) * 0.2,
    25,
    65,
  );
  if (offer.type === "loan")
    c.loan = {
      parentClubId: old,
      parentClubIndex: oldIndex,
      parentSalary: c.weeklySalary,
      returnSeason: c.season + 1,
    };
  else {
    c.loan = null;
    c.contract = { years: offer.years };
    c.weeklySalary = offer.salary;
  }
  if (offer.type === "loan") c.weeklySalary = offer.salary;
  if (offer.promised) c.promiseStarts = 1;
  c.clubHistory.push({
    clubId: c.clubId,
    from: c.season,
    to: null,
    loan: offer.type === "loan",
    appearances: 0,
    goals: 0,
    assists: 0,
  });
  news(c, offer.type + ":joined");
}
export function acceptOffer(c, id, choice = "standard") {
  if (
    c.retired ||
    c.pendingMove ||
    !["standard", "salary", "role"].includes(choice)
  )
    return false;
  const offer = c.offers.find(
    (o) => o.id === id && o.season === c.season && o.expires >= c.seasonMatch,
  );
  if (!offer) return false;
  const deal = { ...offer };
  if (choice === "salary") {
    deal.salary = Math.round(deal.salary * 1.1);
    deal.years++;
  }
  if (choice === "role") {
    deal.salary = Math.round(deal.salary * 0.9);
    deal.promised = true;
  }
  if (c.table.some((r) => r.name === getClub(deal.clubId).name))
    moveClub(c, deal);
  else {
    c.pendingMove = deal;
    news(c, "transfer:scheduled");
  }
  c.offers = c.offers.filter((o) => o.id !== id);
  return true;
}
export function retire(c) {
  if (c.age < 32 || c.retired) return false;
  c.retired = true;
  c.clubHistory.at(-1).to = c.season;
  return true;
}
export function nextSeason(career) {
  if (career.seasonMatch !== 10 || career.retired) return false;
  career.season++;
  career.age++;
  career.contract.years = Math.max(0, career.contract.years - 1);
  if (career.pendingMove) {
    const offer = career.pendingMove;
    career.pendingMove = null;
    moveClub(career, offer);
  } else if (career.loan && career.season >= career.loan.returnSeason) {
    const parent = career.loan.parentClubId;
    moveClub(career, {
      clubId: parent,
      type: "return",
      years: career.contract.years,
      salary: career.loan.parentSalary ?? career.weeklySalary,
    });
  }
  if (career.age >= 30)
    for (const k of ["pace", "shooting", "passing"])
      grow(career, k, k === "pace" ? -0.35 : -0.15);
  career.seasonMatch = 0;
  career.clubIndex = 0;
  career.table = freshTable(career.clubId);
  career.fixtureLog = [];
  career.activityFixture = null;
  career.fitness = 100;
  career.sharpness = clamp(career.sharpness - 5, 30, 100);
  career.offers = [];
  career.event =
    career.contract.years === 0
      ? { id: `${career.season}:renewal`, type: "renewal" }
      : null;
  career.seasonStats = {
    appearances: 0,
    starts: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    ratingTotal: 0,
  };
  if (career.age >= 40) retire(career);
  career.records.bestOverall = Math.max(
    career.records.bestOverall,
    overall(career),
  );
  return true;
}
function backup(storage, raw) {
  if (!raw) return;
  let old;
  try {
    old = JSON.parse(raw);
  } catch {
    if (!storage.getItem(SAVE_KEY + "-backup-corrupt"))
      storage.setItem(SAVE_KEY + "-backup-corrupt", raw);
    return;
  }
  if ([1, 2].includes(old?.version)) {
    const key = SAVE_KEY + "-backup-v" + old.version;
    if (!storage.getItem(key)) storage.setItem(key, raw);
  }
}
export function saveCareer(storage, career) {
  backup(storage, storage.getItem(SAVE_KEY));
  storage.setItem(SAVE_KEY, JSON.stringify(career));
}
function validBase(c) {
  if (
    !c ||
    ![1, 2, 3].includes(c.version) ||
    typeof c.name !== "string" ||
    c.name.length > 20 ||
    !["Striker", "Midfielder", "Defender"].includes(c.position)
  )
    return false;
  const max = c.version === 3 ? 10 : 5;
  if (
    ![
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
    ].every((k) => Number.isSafeInteger(c[k]) && c[k] >= 0) ||
    c.season < 1 ||
    c.seasonMatch > max
  )
    return false;
  if (
    !c.attributes ||
    !["pace", "shooting", "passing"].every(
      (k) =>
        Number.isFinite(c.attributes[k]) &&
        c.attributes[k] >= (c.version === 3 ? 40 : 60) &&
        c.attributes[k] <= 99,
    )
  )
    return false;
  return (
    Array.isArray(c.table) &&
    c.table.length === 6 &&
    new Set(c.table.map((r) => r.name)).size === 6 &&
    c.table.every(
      (r) =>
        typeof r.name === "string" &&
        r.name.length > 0 &&
        r.name.length <= 80 &&
        ["played", "wins", "draws", "losses", "gf", "ga", "points"].every(
          (k) => Number.isSafeInteger(r[k]) && r[k] >= 0,
        ) &&
        r.played === c.seasonMatch &&
        r.wins + r.draws + r.losses === r.played,
    ) &&
    Array.isArray(c.history)
  );
}
export function loadCareer(storage) {
  try {
    const raw = storage.getItem(SAVE_KEY),
      c = JSON.parse(raw);
    if (!validBase(c)) return null;
    const oldVersion = c.version;
    if (c.version === 1) {
      c.clubId = "mini-fc";
      c.assists = 0;
      c.ratingTotal = c.played * 6;
      c.lastRating = 6;
    }
    if (
      typeof c.clubId !== "string" ||
      !Number.isSafeInteger(c.assists) ||
      c.assists < 0 ||
      !Number.isFinite(c.ratingTotal) ||
      c.ratingTotal < 0 ||
      !Number.isFinite(c.lastRating) ||
      c.lastRating < 0 ||
      c.lastRating > 10
    )
      return null;
    c.skillId = outfieldSkill(c.skillId).id;
    if (oldVersion < 3) {
      Object.assign(c, { ...careerDefaults(c.clubId), ...c, version: 3 });
      c.potential = Math.max(84, ...Object.values(c.attributes));
      const oldSeason = c.history.filter((row) => row.season === c.season);
      c.seasonStats = {
        appearances: c.seasonMatch,
        starts: c.seasonMatch,
        minutes: c.seasonMatch * 90,
        goals: oldSeason.reduce((n, r) => n + (r.goals || 0), 0),
        assists: oldSeason.reduce((n, r) => n + (r.assists || 0), 0),
        ratingTotal: oldSeason.reduce((n, r) => n + (r.rating || 6), 0),
      };
      c.appearances = c.played;
      c.minutes = c.played * 90;
      c.starts = c.played;
      c.matchesCompleted = c.wins + c.draws + c.losses;
      c.clubHistory = [
        {
          clubId: c.clubId,
          from: 1,
          to: null,
          appearances: c.played,
          goals: c.goals,
          assists: c.assists,
        },
      ];
      c.records = {
        mostGoals: Math.max(0, ...c.history.map((r) => r.goals || 0)),
        bestRating: c.lastRating,
        bestOverall: overall(c),
      };
      c.fixtureLog = Array.from({ length: c.seasonMatch }, (_, round) => ({
        id: `${c.season}:${round}`,
        round,
        migrated: true,
      }));
      if (c.seasonMatch === 5) {
        c.seasonHistory.push({
          season: c.season,
          clubId: c.clubId,
          matches: 5,
          legacy: true,
          table: structuredClone(c.table),
        });
        c.season++;
        c.seasonMatch = 0;
        c.table = freshTable(c.clubId);
        c.fixtureLog = [];
        c.seasonStats = {
          appearances: 0,
          starts: 0,
          minutes: 0,
          goals: 0,
          assists: 0,
          ratingTotal: 0,
        };
      }
      c.news = [
        { season: c.season, round: c.seasonMatch, text: "migration:ten-match" },
      ];
    }
    if (!validV3(c)) return null;
    if (oldVersion < 3) {
      try {
        backup(storage, raw);
        storage.setItem(SAVE_KEY, JSON.stringify(c));
      } catch {
        /* Keep playing in memory; saveCareer still requires a successful backup. */
      }
    }
    return c;
  } catch {
    return null;
  }
}
function validV3(c) {
  if (
    ![
      "age",
      "potential",
      "trust",
      "form",
      "sharpness",
      "fitness",
      "reputation",
      "weeklySalary",
      "marketValue",
      "earnings",
      "appearances",
      "starts",
      "minutes",
      "matchesCompleted",
      "injuryMatches",
      "promiseStarts",
    ].every((k) => Number.isFinite(c[k]) && c[k] >= 0)
  )
    return false;
  if (
    !Number.isInteger(c.age) ||
    c.age < 18 ||
    c.potential < 40 ||
    c.age > 100 ||
    c.potential > 99 ||
    ["trust", "form", "sharpness", "fitness", "reputation"].some(
      (k) => c[k] > 100,
    ) ||
    ![0, 1, 2, 3, 4, 5].includes(c.clubIndex) ||
    !c.contract ||
    !Number.isInteger(c.contract.years) ||
    c.contract.years < 0 ||
    c.contract.years > 10 ||
    typeof c.retired !== "boolean"
  )
    return false;
  if (
    c.appearances !== c.played ||
    c.starts > c.played ||
    c.injuryMatches > 2 ||
    c.minutes > c.appearances * 90 ||
    c.matchesCompleted < c.played
  )
    return false;
  if (
    !c.seasonStats ||
    ![
      "appearances",
      "starts",
      "minutes",
      "goals",
      "assists",
      "ratingTotal",
    ].every((k) => Number.isFinite(c.seasonStats[k]) && c.seasonStats[k] >= 0)
  )
    return false;
  if (
    !Array.isArray(c.fixtureLog) ||
    c.fixtureLog.length !== c.seasonMatch ||
    new Set(c.fixtureLog.map((r) => r.id)).size !== c.fixtureLog.length ||
    !c.fixtureLog.every((r, i) => r.id === `${c.season}:${i}`)
  )
    return false;
  if (
    !Array.isArray(c.clubHistory) ||
    !c.clubHistory.length ||
    !c.clubHistory.every(
      (r) =>
        typeof r.clubId === "string" &&
        ["appearances", "goals", "assists"].every(
          (k) => Number.isFinite(r[k]) && r[k] >= 0,
        ),
    ) ||
    !Array.isArray(c.news) ||
    !Array.isArray(c.seasonHistory) ||
    !c.records ||
    !["mostGoals", "bestRating", "bestOverall"].every(
      (k) => Number.isFinite(c.records[k]) && c.records[k] >= 0,
    )
  )
    return false;
  const validOffer = (o) =>
    o &&
    typeof o.id === "string" &&
    CLUB_DATABASE.some((club) => club.id === o.clubId) &&
    ["loan", "transfer"].includes(o.type) &&
    Number.isFinite(o.salary) &&
    o.salary >= 0 &&
    Number.isInteger(o.years) &&
    o.years > 0 &&
    o.years <= 5 &&
    Number.isInteger(o.season) &&
    Number.isInteger(o.expires);
  return (
    Array.isArray(c.offers) &&
    c.offers.length <= 2 &&
    c.offers.every(validOffer) &&
    (!c.pendingMove || validOffer(c.pendingMove)) &&
    (!c.loan || typeof c.loan.parentClubId === "string") &&
    (!c.event ||
      ["renewal", "praise", "opportunity", "competition"].includes(
        c.event.type,
      ))
  );
}
