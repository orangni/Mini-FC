import { assignedSkill, outfieldSkill, signatureMotion } from "./skills.js";
// Stable original player IDs keep saved/debug integrations compatible; six per side.
export const TEAM_IDS = [
  [0, 1, 2, 6, 7, 8],
  [3, 4, 5, 9, 10, 11],
];
export const FIELD = {
  halfWidth: 23,
  halfLength: 35,
  goalHalf: 5,
  goalHeight: 3.2,
};
export const MATCH_SECONDS = 120;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (x, z) => {
  const d = Math.hypot(x, z);
  return d > 0.001 ? { x: x / d, z: z / d } : { x: 0, z: -1 };
};
const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const turnAngle = (from, to, amount) =>
  from + clamp(wrapAngle(to - from), -amount, amount);
export const DIFFICULTIES = Object.freeze({
  easy: {
    reaction: 0.58,
    positioning: 2.2,
    anticipation: 0.12,
    pressure: 1.15,
    keeperReaction: 0.24,
  },
  normal: {
    reaction: 0.38,
    positioning: 0.9,
    anticipation: 0.25,
    pressure: 0.8,
    keeperReaction: 0.18,
  },
  hard: {
    reaction: 0.19,
    positioning: 0.3,
    anticipation: 0.45,
    pressure: 0.25,
    keeperReaction: 0.1,
  },
});
const dirFor = (team) => (team === 0 ? -1 : 1);
const HOMES = [
  [0, 1],
  [-12, 10],
  [12, 10],
  [-8, 24],
  [8, 24],
  [0, 32],
];

export class Match {
  constructor({
    attributes = { pace: 60, shooting: 60, passing: 60 },
    demo = false,
    random = Math.random,
    career = false,
    position = "Striker",
    teams = null,
    difficulty = "normal",
    assisted = false,
    skillId = "body-feint",
  } = {}) {
    this.attributes = attributes;
    this.random = random;
    this.demo = demo;
    this.assisted = assisted;
    this.career = career;
    this.position = position;
    this.teams = teams;
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : "normal";
    this.possessionChangedAt = 0;
    this.possessionTeam = 0;
    this.shotSerial = 0;
    this.tactics = [];
    this.players = Array.from({ length: 12 }, (_, id) => {
      const team = TEAM_IDS[0].includes(id) ? 0 : 1,
        slot = TEAM_IDS[team].indexOf(id);
      return {
        id,
        team,
        slot,
        skillId: assignedSkill(
          teams?.[team]?.id || (team ? "rival-fc" : "mini-fc"),
          slot,
        ),
        skillTime: 0,
        skillDuration: 0,
        skillSide: 1,
        skillForwardX: 0,
        skillForwardZ: dirFor(team),
        role:
          slot === 5
            ? "goalkeeper"
            : slot >= 3
              ? "defender"
              : slot === 0
                ? "striker"
                : "midfielder",
        x: 0,
        z: 0,
        dx: 0,
        dz: dirFor(team),
        moving: 0,
        vx: 0,
        vz: 0,
        touchPhase: 0,
        thinkTime: 0,
        possessionTime: 0,
        recovery: 0,
        feintTime: 0,
        aiShot: null,
        keeperSeenShot: 0,
        keeperReaction: 0,
        cooldown: 0,
        stamina: 1,
        sprintExhausted: false,
        action: "",
        actionTime: 0,
        skillCooldown: 0,
        tackleCooldown: 0,
        shield: false,
        protected: 0,
        slideTime: 0,
        stunned: 0,
        holdTime: 0,
        saveCooldown: 0,
        diveSide: 1,
      };
    });
    if (career) {
      this.players[0].skillId = outfieldSkill(skillId).id;
      const slot =
        position === "Defender" ? 3 : position === "Midfielder" ? 1 : 0;
      const other = this.players[TEAM_IDS[0][slot]];
      other.slot = 0;
      other.role = "striker";
      this.players[0].slot = slot;
      this.players[0].role = position.toLowerCase();
    }
    this.ball = {
      x: 0,
      z: 0,
      y: 0.35,
      vx: 0,
      vz: 0,
      vy: 0,
      curve: 0,
      owner: null,
      lastTeam: 0,
      lastPlayer: 0,
      userShot: false,
      ignore: -1,
      ignoreTime: 0,
    };
    this.score = [0, 0];
    this.elapsed = 0;
    this.controlled = 0;
    this.finished = false;
    this.events = [];
    this.stats = {
      goals: 0,
      assists: 0,
      shots: 0,
      passes: 0,
      completedPasses: 0,
      tackles: 0,
      interceptions: 0,
      saves: [0, 0],
    };
    this.queuedAction = null;
    this.manualSwitchTime = 0;
    this.kickoff(0);
  }
  kickoff(team) {
    for (const p of this.players) {
      const home = HOMES[p.slot];
      p.x = home[0] * (p.team ? -1 : 1);
      p.z = home[1] * (p.team ? -1 : 1);
      Object.assign(p, {
        cooldown: 0.7,
        vx: 0,
        vz: 0,
        touchPhase: 0,
        thinkTime: 0,
        possessionTime: 0,
        recovery: 0,
        feintTime: 0,
        skillTime: 0,
        aiShot: null,
        tackleCooldown: 0,
        keeperSeenShot: this.shotSerial,
        keeperReaction: 0,
        moving: 0,
        dx: 0,
        dz: dirFor(p.team),
        action: "",
        actionTime: 0,
        protected: 0,
        slideTime: 0,
        stunned: 0,
        shield: false,
        holdTime: 0,
        saveCooldown: 0,
      });
    }
    const p = this.players[TEAM_IDS[team][0]];
    p.x = 0;
    p.z = team ? -1 : 1;
    p.protected = 1.1;
    // Leave room to choose a direction at every restart.
    for (const q of this.players)
      if (q.team !== team && Math.abs(q.z) < 6) q.z = q.team ? -6 : 6;
    this.queuedAction = null;
    this.manualSwitchTime = 0;
    Object.assign(this.ball, {
      x: p.x,
      z: p.z + p.dz * 0.72,
      y: 0.35,
      followOwner: null,
      owner: p.id,
      vx: 0,
      vz: 0,
      vy: 0,
      curve: 0,
      userShot: false,
      ignore: -1,
      ignoreTime: 0,
    });
    for (const q of this.players) {
      q.previousX = q.x;
      q.previousZ = q.z;
    }
    this.ball.previousX = this.ball.x;
    this.ball.previousY = this.ball.y;
    this.ball.previousZ = this.ball.z;
    this.possessionTeam = team;
    this.possessionChangedAt = this.elapsed;
    this.controlled = 0;
    this.kickoffWait = 1.2;
    this.pendingPass = null;
    this.assistCandidate = null;
  }
  // Career identity is an invariant, including before movement and queued actions.
  get controlled() {
    return this.career ? 0 : (this._controlled ?? 0);
  }
  set controlled(id) {
    this._controlled = this.career ? 0 : id;
  }
  takeEvents() {
    return this.events.splice(0);
  }
  isUser(p) {
    return !this.demo && p.team === 0 && (!this.career || p.id === 0);
  }
  attributesFor(p) {
    if (p.team === 0 && (!this.career || p.id === 0)) return this.attributes;
    const r = this.teams?.[p.team]?.ratings;
    return r
      ? { pace: 45 + r.midfield * 0.3, passing: r.midfield, shooting: r.attack }
      : { pace: 62, passing: 65, shooting: 65 };
  }
  nearest(team, point = this.ball, exclude = -1) {
    let closest,
      best = Infinity;
    for (const p of this.players)
      if (p.team === team && p.role !== "goalkeeper" && p.id !== exclude) {
        const d = distance(p, point);
        if (d < best) {
          best = d;
          closest = p;
        }
      }
    return closest;
  }
  switchPlayer() {
    if (this.career || this.finished || this.demo || this.manualSwitchTime > 0)
      return false;
    const target = this.nearest(0, this.ball, this.controlled);
    if (!target) return false;
    this.controlled = target.id;
    this.manualSwitchTime = 0.5;
    this.events.push({ type: "switch" });
    return true;
  }
  canKick(id) {
    return (
      !this.finished &&
      this.kickoffWait <= 0 &&
      this.ball.owner === id &&
      this.players[id].stunned <= 0
    );
  }
  config(team) {
    return DIFFICULTIES[this.demo || team === 1 ? this.difficulty : "normal"];
  }
  release(p, vx, vz, vy) {
    // Kick from the current controlled touch; reconcile only stale external fixtures.
    const close = distance(this.ball, p) < 2.6;
    Object.assign(this.ball, {
      x: close ? this.ball.x : p.x + p.dx * 0.8,
      z: close ? this.ball.z : p.z + p.dz * 0.8,
      y: 0.35,
      owner: null,
      followOwner: null,
      vx,
      vz,
      vy,
      curve: 0,
      lastTeam: p.team,
      lastPlayer: p.id,
      userShot: false,
      ignore: p.id,
      ignoreTime: 0.4,
    });
    p.cooldown = 0.45;
  }
  laneRisk(p, dest) {
    const dx = dest.x - p.x,
      dz = dest.z - p.z,
      length2 = dx * dx + dz * dz;
    let risk = 0;
    for (const q of this.players)
      if (q.team !== p.team && q.role !== "goalkeeper") {
        const t = clamp(
          ((q.x - p.x) * dx + (q.z - p.z) * dz) / Math.max(1, length2),
          0,
          1,
        );
        if (t < 0.08 || t > 0.95) continue;
        const gap = Math.hypot(q.x - p.x - t * dx, q.z - p.z - t * dz);
        risk += Math.max(0, 2.8 - gap);
      }
    return risk;
  }
  passTarget(p, type = "short", aim = null) {
    const directional = aim && Math.hypot(aim.x || 0, aim.z || 0) > 0.15;
    const heading = directional ? unit(aim.x, aim.z) : null;
    let mates = this.players.filter(
      (q) => q.team === p.team && q.id !== p.id && q.role !== "goalkeeper",
    );
    if (heading) {
      const inCone = mates.filter((q) => {
        const d = unit(q.x - p.x, q.z - p.z);
        return d.x * heading.x + d.z * heading.z > 0.15;
      });
      if (inCone.length) mates = inCone;
    }
    const score = (q) => {
      const d = unit(q.x - p.x, q.z - p.z);
      const alignment = heading ? d.x * heading.x + d.z * heading.z : 0;
      const openness = Math.min(10, distance(q, this.nearest(1 - p.team, q)));
      return (
        distance(p, q) * 0.45 -
        (q.z - p.z) * dirFor(p.team) * (type === "through" ? 0.6 : 0.13) -
        openness * (p.role === "goalkeeper" ? 1.7 : 0.65) +
        this.laneRisk(p, q) * (type === "lob" ? 0.3 : 2.8) -
        alignment * 25
      );
    };
    return mates.sort((a, b) => score(a) - score(b))[0];
  }
  pass(id, type = "short", requested = null, aim = null) {
    if (!this.canKick(id)) return false;
    const p = this.players[id],
      dir = dirFor(p.team),
      stats = this.attributesFor(p);
    const target =
      this.players.find(
        (q) =>
          q.id === requested &&
          q.team === p.team &&
          q.id !== id &&
          q.role !== "goalkeeper",
      ) || this.passTarget(p, type, aim);
    if (!target) return false;
    const speed = (type === "through" ? 24 : 20) + stats.passing * 0.09;
    const travel = clamp(distance(p, target) / speed, 0.15, 1.3);
    const lead =
      type === "through"
        ? clamp(4 + target.moving * 0.3, 4, 7)
        : type === "lob"
          ? 1.5
          : 0;
    const dest = {
      x: clamp(target.x + target.vx * travel * 0.6, -21, 21),
      z: clamp(target.z + target.vz * travel * 0.5 + dir * lead, -31, 31),
    };
    if (type === "through") {
      // Choose a nearby running lane instead of leading straight into a marker.
      const candidates = [-3, 0, 3].map((offset) => ({
        x: clamp(dest.x + offset, -20.5, 20.5),
        z: dest.z,
      }));
      candidates.sort(
        (a, b) =>
          this.laneRisk(p, a) -
          this.laneRisk(p, b) +
          Math.abs(a.x - target.x) * 0.15 -
          Math.abs(b.x - target.x) * 0.15,
      );
      dest.x = candidates[0].x;
    }
    const origin = distance(this.ball, p) < 2.6 ? this.ball : p;
    const error =
      (this.random() - 0.5) *
      (100 - stats.passing) *
      (type === "through" ? 0.014 : 0.006);
    const d = unit(dest.x - origin.x + error, dest.z - origin.z);
    const dist = distance(origin, dest);
    let velocity = speed,
      vy = 0.45;
    if (type === "lob") {
      const flight = clamp(dist / 17, 1.05, 2.1);
      velocity = dist / flight;
      vy = 6 * flight;
    }
    this.release(p, d.x * velocity, d.z * velocity, vy);
    p.action = "pass";
    p.actionTime = 0.35;
    this.pendingPass = {
      team: p.team,
      sender: id,
      receiver: target.id,
      time: type === "lob" ? 3.7 : 2.7,
      target: dest,
      technique: type,
      user: this.isUser(p),
    };
    if (this.isUser(p)) {
      this.stats.passes++;
      if (!this.career) this.controlled = target.id;
    }
    this.events.push({
      type: "pass",
      team: p.team,
      player: id,
      receiver: target.id,
      technique: type,
    });
    return true;
  }
  shoot(id, user = false, options = {}) {
    if (!this.canKick(id)) return false;
    const p = this.players[id],
      b = this.ball,
      accuracy = this.attributesFor(p).shooting;
    const type = options.type || "normal",
      power = clamp(options.power ?? 0.35, 0.05, 1);
    const goalZ = dirFor(p.team) * 36,
      dz = Math.abs(goalZ - p.z);
    const angle = Math.atan2(Math.abs(p.x), dz);
    const pressure = this.players.filter(
      (q) => q.team !== p.team && q.role !== "goalkeeper" && distance(p, q) < 4,
    ).length;
    let spread =
      (100 - accuracy) * 0.022 +
      Math.max(0, dz - 18) * 0.045 +
      angle * 1.1 +
      pressure * 0.32 +
      (type === "power" ? Math.max(0, power - 0.65) * 4 : 0);
    if (type === "finesse") spread *= 0.65;
    if (type === "chip") spread *= 1.15;
    if (user && this.assisted) spread *= 0.9;
    const keeper = this.players[TEAM_IDS[1 - p.team][5]];
    const direction = options.direction;
    const directional =
      direction && Math.hypot(direction.x || 0, direction.z || 0) > 0.15;
    const automaticPlacement =
      Math.abs(p.x) < 3 ? (keeper.x >= 0 ? -2.6 : 2.6) : -Math.sign(p.x) * 2.6;
    const directedPlacement =
      directional && Math.abs(direction.x) > 0.15
        ? clamp(
            direction.x / Math.max(0.65, Math.hypot(direction.x, direction.z)),
            -1,
            1,
          ) * 4.1
        : automaticPlacement;
    // Balanced retains directional intent; explicit finesse placement is never blended.
    const placement =
      options.aimX !== undefined
        ? clamp(options.aimX, -4.3, 4.3)
        : user && this.assisted
          ? directedPlacement * 0.65 + automaticPlacement * 0.35
          : directedPlacement;
    const targetX = clamp(
      placement + (this.random() - 0.5) * spread * 2,
      -7.5,
      7.5,
    );
    let speed = 28 + accuracy * 0.09,
      vy = 3,
      curve = 0;
    if (type === "power") {
      speed = 31 + power * 16 + accuracy * 0.04;
      vy = 2.1 + power * 2.6;
    }
    if (type === "chip") {
      const flight = clamp(dz / 14, 1.2, 2.3);
      speed = Math.hypot(targetX - p.x, goalZ - p.z) / flight;
      vy = 6 * flight + 0.45 / flight;
    }
    if (type === "finesse") {
      speed = 25 + accuracy * 0.045;
      vy = 2.7;
      curve = (p.x >= 0 ? -0.34 : 0.34) * dirFor(p.team);
    }
    const origin = distance(b, p) < 2.6 ? b : p;
    const d = unit(targetX - origin.x, goalZ - origin.z),
      travel = Math.hypot(targetX - origin.x, goalZ - origin.z) / speed;
    const offset = -curve * travel * 0.5;
    this.release(
      p,
      (d.x * Math.cos(offset) - d.z * Math.sin(offset)) * speed,
      (d.x * Math.sin(offset) + d.z * Math.cos(offset)) * speed,
      vy,
    );
    b.curve = curve;
    b.shotId = ++this.shotSerial;
    b.userShot = user && p.team === 0 && (!this.career || id === 0);
    p.action = "shot";
    p.actionTime = 0.5;
    this.pendingPass = null;
    if (b.userShot) this.stats.shots++;
    this.events.push({
      type: "shot",
      team: p.team,
      player: id,
      technique: type,
      power,
    });
    return true;
  }
  skill(id = this.controlled, lateral = 1) {
    const p = this.players[id];
    if (!this.canKick(id) || p.skillCooldown > 0 || p.role === "goalkeeper")
      return false;
    if (p.stamina < 0.08 || p.stunned > 0 || p.recovery > 0) return false;
    const signature = outfieldSkill(p.skillId);
    const side = lateral < 0 ? -1 : 1;
    p.skillTime = p.feintTime = p.skillDuration = signature.duration;
    p.skillSide = side;
    p.skillForwardX = p.dx;
    p.skillForwardZ = p.dz;
    const motion = signatureMotion(p.skillId, 0);
    p.vx += (p.dx * motion.forward + p.dz * side * motion.side) * 6.2;
    p.vz += (p.dz * motion.forward - p.dx * side * motion.side) * 6.2;
    p.protected = Math.max(
      p.protected,
      0.45 + this.attributesFor(p).passing * 0.0015,
    );
    p.stamina = Math.max(0, p.stamina - 0.08);
    p.skillCooldown = signature.cooldown + (this.isUser(p) ? 0 : 2);
    p.action = "feint";
    p.actionTime = signature.duration;
    for (const q of this.players)
      if (q.team !== p.team && q.role !== "goalkeeper" && distance(p, q) < 2.8)
        q.stunned = Math.max(q.stunned, this.isUser(p) ? 0.18 : 0.1);
    this.events.push({
      type: "skill",
      player: id,
      team: p.team,
      skillId: signature.id,
    });
    return true;
  }
  tackle(id = this.controlled, slide = false, automatic = false) {
    const p = this.players[id],
      b = this.ball;
    const owner = b.owner === null ? null : this.players[b.owner];
    if (
      this.finished ||
      this.kickoffWait > 0 ||
      p.tackleCooldown > 0 ||
      p.stunned > 0 ||
      p.role === "goalkeeper" ||
      owner?.team === p.team ||
      owner?.role === "goalkeeper"
    )
      return false;
    if (!automatic) {
      p.action = slide ? "slide" : "tackle";
      p.actionTime = slide ? 0.8 : 0.3;
      p.tackleCooldown = slide ? 2 : 0.6;
      if (slide) {
        p.slideTime = 0.3;
        p.recovery = 0.9;
        p.vx = p.dx * 15;
        p.vz = p.dz * 15;
      }
    }
    if (b.y > 1.3 || owner?.protected > 0 || owner?.cooldown > 0) return false;
    const point =
      owner && distance(b, owner) > 2.6
        ? { x: owner.x + owner.dx * 0.8, z: owner.z + owner.dz * 0.8 }
        : b;
    const reach = slide ? 3.25 : automatic ? 1.35 : 2.35;
    if (distance(p, point) > reach) return false;
    const toward = unit(point.x - p.x, point.z - p.z);
    const facing = toward.x * p.dx + toward.z * p.dz;
    const closing =
      (p.vx - (owner?.vx || 0)) * toward.x +
      (p.vz - (owner?.vz || 0)) * toward.z;
    if (automatic) {
      // Require an actual approach to the exposed ball, not a proximity lottery.
      if (closing < 0.9 || facing < 0.55) return false;
      p.tackleCooldown = 0.9;
    }
    const fromOwner = owner ? unit(p.x - owner.x, p.z - owner.z) : null;
    const behindShield =
      owner?.shield && fromOwner.x * owner.dx + fromOwner.z * owner.dz < 0.2;
    if (facing < (slide ? 0.05 : 0.2) || behindShield) {
      if (!automatic && slide) p.recovery = 1.05;
      this.events.push({
        type: "challenge",
        player: id,
        success: false,
        slide,
      });
      return false;
    }
    if (owner) {
      owner.cooldown = 0.8;
      owner.protected = 0;
    }
    p.cooldown = 0.55;
    p.protected = this.isUser(p) ? 0.85 : 0.75;
    p.possessionTime = 0;
    if (slide) {
      const { x, z } = b;
      this.release(p, toward.x * 11, toward.z * 11, 1.6);
      b.x = x;
      b.z = z;
      b.ignore = owner?.id ?? -1;
    } else {
      b.owner = id;
      b.followOwner = null;
      b.userShot = false;
    }
    if (this.possessionTeam !== p.team) {
      this.possessionTeam = p.team;
      this.possessionChangedAt = this.elapsed;
    }
    this.pendingPass = this.assistCandidate = null;
    if (this.isUser(p)) this.stats.tackles++;
    if (automatic) {
      p.action = "tackle";
      p.actionTime = 0.3;
    }
    this.events.push({
      type: "tackle",
      team: p.team,
      player: id,
      slide,
      automatic,
      success: true,
    });
    return true;
  }
  move(p, x, z, sprint, dt) {
    const pace = this.attributesFor(p).pace;
    const assist = this.assisted && !this.demo && p.id === this.controlled;
    if (p.skillTime > 0 && this.ball.owner === p.id) {
      const motion = signatureMotion(
        p.skillId,
        1 - p.skillTime / p.skillDuration,
      );
      x =
        x * 0.35 +
        p.skillForwardX * motion.forward +
        p.skillForwardZ * p.skillSide * motion.side;
      z =
        z * 0.35 +
        p.skillForwardZ * motion.forward -
        p.skillForwardX * p.skillSide * motion.side;
    }
    let mag = Math.hypot(x, z);
    if (p.stunned > 0) {
      x = z = 0;
      mag = 0;
    }
    if (p.slideTime > 0) {
      x = p.dx;
      z = p.dz;
      mag = 1;
    }
    if (p.stamina <= 0.06) p.sprintExhausted = true;
    else if (p.stamina >= 0.24) p.sprintExhausted = false;
    const running = sprint && mag > 0.1 && !p.sprintExhausted && !p.shield;
    p.stamina = clamp(
      p.stamina + dt * (running ? -0.2 : mag > 0.1 ? 0.14 : 0.2),
      0,
      1,
    );
    const d = mag > 0.05 ? unit(x, z) : { x: 0, z: 0 };
    let speed =
      (5.6 + pace * 0.052) *
      Math.min(mag, 1) *
      (running ? (assist ? 1.42 : 1.5) * (0.94 + p.stamina * 0.06) : 1);
    const velocity = Math.hypot(p.vx, p.vz);
    if (running && velocity > 1) {
      const alignment = (p.vx * d.x + p.vz * d.z) / velocity;
      speed *= assist
        ? clamp(0.78 + (alignment + 1) * 0.11, 0.78, 1)
        : clamp(0.5 + (alignment + 1) * 0.25, 0.5, 1);
    }
    if (p.shield && this.ball.owner === p.id) speed *= 0.62;
    if (p.recovery > 0 && p.slideTime <= 0) speed *= 0.48;
    if (p.slideTime > 0) speed = 15;
    const vx = d.x * speed,
      vz = d.z * speed;
    const change = Math.hypot(vx - p.vx, vz - p.vz);
    const acceleration = assist
      ? mag > 0.05
        ? 90 + pace * 0.25
        : 100
      : mag > 0.05
        ? 58 + pace * 0.35
        : 54;
    const blend = change > 0 ? Math.min(1, (acceleration * dt) / change) : 0;
    p.vx += (vx - p.vx) * blend;
    p.vz += (vz - p.vz) * blend;
    if (Math.hypot(p.vx, p.vz) < 0.02) p.vx = p.vz = 0;
    const maxZ = p.role === "goalkeeper" ? 33.5 : 33.3;
    const nextX = p.x + p.vx * dt,
      nextZ = p.z + p.vz * dt;
    p.x = clamp(nextX, -22, 22);
    p.z = clamp(nextZ, -maxZ, maxZ);
    if (p.x !== nextX) p.vx = 0;
    if (p.z !== nextZ) p.vz = 0;
    if (mag > 0.05) {
      const angle = turnAngle(
        Math.atan2(p.dx, p.dz),
        Math.atan2(d.x, d.z),
        dt * (assist ? 18 : running ? 7.5 : 16),
      );
      p.dx = Math.sin(angle);
      p.dz = Math.cos(angle);
    }
    p.moving = Math.hypot(p.vx, p.vz);
  }
  followBall(p, dt) {
    const b = this.ball;
    if (p.role === "goalkeeper") {
      b.x = p.x + p.dx * 0.55;
      b.z = p.z + p.dz * 0.55;
      b.y = 1.6;
      b.vx = b.vz = b.vy = b.curve = 0;
      return;
    }
    let heading = Math.atan2(p.dx, p.dz);
    if (p.skillTime > 0) {
      const motion = signatureMotion(
        p.skillId,
        1 - p.skillTime / p.skillDuration,
      );
      heading =
        Math.atan2(p.skillForwardX, p.skillForwardZ) +
        motion.ball * p.skillSide;
    }
    if (b.followOwner !== p.id) {
      b.followOwner = p.id;
      b.orbit =
        distance(b, p) < 2.6 ? Math.atan2(b.x - p.x, b.z - p.z) : heading;
      if (distance(b, p) > 2.6) {
        b.x = p.x + p.dx * 0.75;
        b.z = p.z + p.dz * 0.75;
      }
      b.vx = p.vx;
      b.vz = p.vz;
    }
    const assist = this.assisted && !this.demo && p.id === this.controlled;
    b.orbit = turnAngle(
      b.orbit,
      heading,
      dt * (assist ? 14 : p.shield ? 12 : 9),
    );
    p.touchPhase += dt * p.moving * 1.7;
    const touch = (assist ? 0.08 : 0.12) * (1 - Math.cos(p.touchPhase));
    const offset = p.shield
      ? 0.72
      : 0.74 +
        Math.min(1, p.moving / 13) *
          (assist
            ? 0.34
            : 0.5 + (100 - this.attributesFor(p).passing) * 0.003) +
        touch;
    const tx = p.x + Math.sin(b.orbit) * offset,
      tz = p.z + Math.cos(b.orbit) * offset;
    const blend = 1 - Math.exp(-dt * 20);
    b.vx += (p.vx + (tx - b.x) * 12 - b.vx) * blend;
    b.vz += (p.vz + (tz - b.z) * 12 - b.vz) * blend;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    const gap = distance(b, p);
    if (gap < 0.7) {
      const d =
        gap > 0.001
          ? unit(b.x - p.x, b.z - p.z)
          : { x: Math.sin(b.orbit), z: Math.cos(b.orbit) };
      b.x = p.x + d.x * 0.7;
      b.z = p.z + d.z * 0.7;
    }
    b.y = 0.35;
    b.vy = b.curve = 0;
  }
  predictBall(time) {
    const b = this.ball;
    // Small bounded integration includes curve, drag and gravity without allocations per substep.
    let x = b.x,
      z = b.z,
      vx = b.vx,
      vz = b.vz;
    const steps = 6,
      dt = time / steps;
    for (let i = 0; i < steps; i++) {
      const oldVX = vx;
      vx -= vz * b.curve * dt;
      vz += oldVX * b.curve * dt;
      const drag = Math.exp(-(b.y < 0.5 ? 0.72 : 0.12) * dt);
      vx *= drag;
      vz *= drag;
      x += vx * dt;
      z += vz * dt;
    }
    return { x, z, y: Math.max(0.35, b.y + b.vy * time - 6 * time * time) };
  }
  keeperHoldLimit(p) {
    return p.skillId === "quick-release" ? 0.75 : 0.85;
  }
  goalkeeper(p, dt) {
    const b = this.ball,
      dir = dirFor(p.team),
      ownZ = -dir * 35;
    if (b.owner === p.id) {
      p.holdTime += dt;
      this.move(p, 0, 0, false, dt);
      if (p.holdTime > this.keeperHoldLimit(p)) {
        const target = this.passTarget(p);
        this.pass(
          p.id,
          this.laneRisk(p, target) > 3 ? "lob" : "short",
          target.id,
        );
        p.holdTime = 0;
      }
      return;
    }
    p.holdTime = 0;
    const owner = b.owner === null ? null : this.players[b.owner];
    const cover =
      owner &&
      this.players.some(
        (q) =>
          q.team === p.team &&
          q.role !== "goalkeeper" &&
          distance(q, owner) < 5 &&
          (q.z - owner.z) * dir < 0,
      );
    const oneOnOne =
      owner &&
      owner.team !== p.team &&
      !cover &&
      Math.abs(b.x) < 10 &&
      Math.abs(ownZ - b.z) < 18;
    const depth =
      2.3 + (oneOnOne ? clamp((18 - Math.abs(ownZ - b.z)) * 0.3, 0, 3.4) : 0);
    let x = clamp(
      b.x * clamp(depth / Math.max(5, Math.abs(ownZ - b.z)), 0.12, 0.62),
      -4.2,
      4.2,
    );
    let z = ownZ + dir * depth;
    const incoming = b.owner === null && b.vz * dir < -2;
    if (incoming) {
      if (b.shotId && p.keeperSeenShot !== b.shotId) {
        p.keeperSeenShot = b.shotId;
        p.keeperReaction = this.config(p.team).keeperReaction;
      }
      const time = clamp((z - b.z) / b.vz, 0, 1.2);
      const intercept = this.predictBall(time);
      if (p.keeperReaction > 0) x = p.x;
      else if (time > 0 && time < 1.2) {
        x = clamp(intercept.x, -5.5, 5.5);
        if (
          Math.abs(x - p.x) > 0.75 &&
          p.saveCooldown <= 0 &&
          time < 0.6 &&
          intercept.y < 3
        ) {
          p.action = "dive";
          p.actionTime = 0.65;
          p.diveSide = Math.sign(x - p.x) || 1;
        }
      }
    }
    const d = unit(x - p.x, z - p.z),
      gap = Math.hypot(x - p.x, z - p.z);
    // A committed keeper backpedals more slowly under a lifted chip.
    const backpedal =
      incoming && b.y > 1.3 && Math.abs(ownZ - p.z) > 3.8 && d.z * dir < 0
        ? 0.42
        : 1;
    this.move(
      p,
      gap > 0.12 ? d.x * Math.min(gap * 1.4, 1) : 0,
      gap > 0.12 ? d.z * Math.min(gap * 1.4, 1) * backpedal : 0,
      p.action === "dive",
      dt,
    );
  }
  trySaves() {
    const b = this.ball;
    if (b.owner !== null || Math.abs(b.z) >= FIELD.halfLength) return false;
    for (const p of this.players)
      if (
        p.role === "goalkeeper" &&
        !(b.ignore === p.id && b.ignoreTime > 0) &&
        p.saveCooldown <= 0 &&
        p.keeperReaction <= 0
      ) {
        const dir = dirFor(p.team),
          inBox = p.z * -dir > 25 && b.z * -dir > 25 && Math.abs(b.x) < 8;
        const diving = p.action === "dive",
          rating = this.teams?.[p.team]?.ratings?.goalkeeper ?? 70;
        const reach = (diving ? 2.25 : 1.25) + (rating - 70) * 0.007;
        const gap = distance(p, b),
          speed = Math.hypot(b.vx, b.vz);
        if (!inBox || gap > reach || b.y > (diving ? 2.65 : 1.9)) continue;
        // Fast shots outside the keeper's planted reach beat a late stretch, deterministically.
        if (speed > 35 && Math.abs(b.x - p.x) > reach * 0.78) continue;
        const catchBall =
          b.y < 1.8 &&
          speed < (p.skillId === "safe-hands" ? 25 : 24) &&
          gap < 1.4;
        this.stats.saves[p.team]++;
        this.assistCandidate = this.pendingPass = null;
        p.action = catchBall ? "catch" : "dive";
        p.actionTime = 0.8;
        p.diveSide = Math.sign(b.x - p.x) || 1;
        p.saveCooldown = 0.75;
        if (catchBall) {
          p.protected = 1.2;
          p.possessionTime = p.holdTime = 0;
          b.owner = p.id;
          b.followOwner = null;
          b.y = 1.6;
          b.userShot = false;
          b.vx = b.vz = b.vy = 0;
          if (this.possessionTeam !== p.team) {
            this.possessionTeam = p.team;
            this.possessionChangedAt = this.elapsed;
          }
        } else {
          b.x = p.x + p.diveSide * 1.5;
          b.z = p.z + dir * 1.3;
          b.vx = p.diveSide * (6 + speed * 0.2);
          b.vz = dir * (8 + speed * 0.22);
          b.vy = 3.8;
          b.userShot = false;
          b.curve = 0;
          b.ignore = p.id;
          b.ignoreTime = 0.6;
        }
        this.events.push({ type: "save", team: p.team, catch: catchBall });
        return true;
      }
    return false;
  }
  buildTactics() {
    const b = this.ball;
    for (const team of [0, 1]) {
      const candidates = this.players.filter(
        (p) => p.team === team && p.role !== "goalkeeper",
      );
      const previous = this.tactics[team]?.presser;
      candidates.sort((a, c) => distance(a, b) - distance(c, b));
      let presser = candidates[0];
      if (
        previous !== undefined &&
        distance(this.players[previous], b) < distance(presser, b) + 1.4
      )
        presser = this.players[previous];
      const cover = candidates
        .filter((p) => p.id !== presser.id)
        .sort((a, c) => a.z * dirFor(team) - c.z * dirFor(team))[0];
      this.tactics[team] = { presser: presser.id, cover: cover.id };
    }
  }
  receiveTarget(p) {
    const b = this.ball,
      pass = this.pendingPass;
    if (!pass || pass.receiver !== p.id) return this.predictBall(0.15);
    // Run into the pass, but don't chase under the ball before a lob descends.
    const estimate = clamp(
      distance(p, b) / Math.max(10, Math.hypot(b.vx, b.vz)),
      0.03,
      0.6,
    );
    const predicted = this.predictBall(estimate);
    if (b.y < 1.8 && distance(p, b) < 8) return predicted;
    return pass.target;
  }
  aiTarget(p) {
    const b = this.ball,
      dir = dirFor(p.team),
      owner = b.owner === null ? null : this.players[b.owner];
    const config = this.config(p.team);
    if (owner?.id === p.id) {
      const threat = this.nearest(1 - p.team, p);
      const goalDistance = Math.abs(dir * 35 - p.z);
      const safe = this.passTarget(
        p,
        distance(p, threat) < 3 ? "short" : "through",
      );
      const progress = (safe.z - p.z) * dir;
      const runPoint = { x: safe.x, z: clamp(safe.z + dir * 5, -31, 31) };
      const safeSpace = Math.max(
        distance(safe, this.nearest(1 - p.team, safe)),
        progress > 5
          ? Math.min(6, distance(runPoint, this.nearest(1 - p.team, runPoint)))
          : 0,
      );
      const openLane = this.laneRisk(p, safe) < 2.3;
      const pressed = distance(p, threat) < 4.5;
      const threatGap = distance(p, threat);
      if (
        p.skillCooldown <= 0 &&
        p.possessionTime > 0.7 &&
        p.protected <= 0 &&
        goalDistance > 12 &&
        threatGap > 1.35 &&
        threatGap < 2.6 &&
        (!openLane || safeSpace < 2.2) &&
        (threat.x - p.x) * p.dx + (threat.z - p.z) * p.dz > 0
      ) {
        const side = (p.x - threat.x) * p.dz - (p.z - threat.z) * p.dx;
        if (this.skill(p.id, side < 0 ? -1 : 1))
          return { x: p.x + p.dx * 3, z: p.z + p.dz * 3 };
      }
      if (p.cooldown <= 0 && p.possessionTime > 0.28) {
        const clearShot = this.laneRisk(p, { x: 0, z: dir * 35 }) < 1.5;
        if (
          goalDistance < 18 &&
          Math.abs(p.x) < 10.5 &&
          (goalDistance < 10 || clearShot || goalDistance < 13.5 || !openLane)
        ) {
          const keeper = this.players[TEAM_IDS[1 - p.team][5]];
          const keeperForward = Math.abs(keeper.z - dir * 35) > 4.5;
          const type =
            keeperForward && goalDistance > 13
              ? "chip"
              : Math.abs(p.x) > 4
                ? "finesse"
                : "normal";
          // Lift over a stranded keeper; otherwise place the shot toward the far post.
          const aimX =
            type === "chip"
              ? clamp(-keeper.x * 0.4, -2, 2)
              : keeper.x >= 0
                ? -3.4
                : 3.4;
          if (
            type === "normal" &&
            goalDistance > 14 &&
            !pressed &&
            this.random() < 0.25
          ) {
            p.aiShot = { remaining: 0.55, total: 0.55, aimX };
            p.action = "charge";
            p.actionTime = 0.55;
          } else this.shoot(p.id, false, { type, aimX });
        } else if (
          openLane &&
          safeSpace > 2.2 &&
          ((pressed &&
            (p.possessionTime > 0.55 || distance(p, threat) < 2.4)) ||
            (progress > 7 && safeSpace > 4 && p.possessionTime > 0.75) ||
            p.possessionTime > 2.5)
        ) {
          this.pass(
            p.id,
            progress > 7 && safeSpace > 4 ? "through" : "short",
            safe.id,
          );
        }
      }
      const avoid =
        distance(p, threat) < 4 ? clamp(p.x - threat.x, -1, 1) * 3 : 0;
      return {
        x: clamp((p.x > 0 ? 2.5 : -2.5) + avoid, -13, 13),
        z: dir * 31.5,
      };
    }
    if (this.pendingPass?.receiver === p.id) return this.receiveTarget(p);
    const lane = HOMES[p.slot][0] * (p.team ? -1 : 1);
    const counter =
      owner?.team === p.team && this.elapsed - this.possessionChangedAt < 3.5;
    if (owner?.team === p.team) {
      let x = lane + owner.x * 0.12,
        z;
      if (p.slot === 0) {
        x = owner.x > 0 ? -4 : 4;
        z = owner.z + dir * (counter ? 13 : 9);
      } else if (p.slot < 3)
        z = owner.z + dir * (p.slot === 1 ? (counter ? 7 : 4) : -1.5);
      else z = owner.z - dir * (p.slot === 3 ? 11 : 15);
      if (owner.role === "goalkeeper")
        z = owner.z + dir * (p.slot >= 3 ? 9 : p.slot === 0 ? 28 : 19);
      if (distance(p, owner) < 5) x += (p.x >= owner.x ? 1 : -1) * 4;
      return { x: clamp(x, -19, 19), z: clamp(z, -29.5, 29.5) };
    }
    const plan = this.tactics[p.team];
    const supportingPress =
      this.pressing &&
      p.team === 0 &&
      this.nearest(0, b, this.controlled).id === p.id;
    if (p.id === plan.presser || supportingPress) {
      const predicted = owner
        ? {
            x: b.x + owner.vx * config.anticipation,
            z: b.z + owner.vz * config.anticipation,
          }
        : this.predictBall(config.anticipation);
      const offset = owner?.role === "goalkeeper" ? 3 : config.pressure;
      const towardOwn = unit(-predicted.x, -dir * 35 - predicted.z);
      return {
        x: predicted.x + towardOwn.x * offset,
        z: predicted.z + towardOwn.z * offset,
      };
    }
    if (p.id === plan.cover) {
      return {
        x: clamp(b.x * 0.55, -12, 12),
        z: clamp(b.z - dir * 9, -29, 29),
      };
    }
    const threats = this.players
      .filter((q) => q.team !== p.team && q.role !== "goalkeeper")
      .sort((a, c) => Math.abs(a.x - lane) - Math.abs(c.x - lane));
    const mark = threats[0];
    const error = Math.sin(this.elapsed * 0.7 + p.id * 2) * config.positioning;
    return {
      x: clamp(mark.x * 0.65 + lane * 0.35 + error, -20, 20),
      z: clamp((mark.z + b.z) * 0.5 - dir * (p.slot >= 3 ? 7 : 3.5), -29, 29),
    };
  }
  ai(p, dt) {
    if (p.role === "goalkeeper") return this.goalkeeper(p, dt);
    if (p.skillTime > 0 && this.ball.owner === p.id) {
      this.move(p, 0, 0, false, dt);
      return;
    }
    if (p.aiShot && this.ball.owner === p.id) {
      p.aiShot.remaining -= dt;
      p.charging = (1 - p.aiShot.remaining / p.aiShot.total) * 0.8;
      this.move(p, 0, 0, false, dt);
      if (p.aiShot.remaining <= 0) {
        this.shoot(p.id, false, {
          type: "power",
          power: 0.8,
          aimX: p.aiShot.aimX,
        });
        p.aiShot = null;
      }
      return;
    }
    p.aiShot = null;
    if (p.thinkTime <= 0 || !p.aiTarget) {
      p.aiTarget = this.aiTarget(p);
      p.thinkTime = this.config(p.team).reaction * (0.9 + this.random() * 0.2);
    }
    let target = p.aiTarget;
    if (this.pendingPass?.receiver === p.id) target = this.receiveTarget(p);
    let x = target.x - p.x,
      z = target.z - p.z;
    const gap = Math.hypot(x, z);
    const d = gap > 0.01 ? unit(x, z) : { x: 0, z: 0 };
    x = d.x * Math.min(1, Math.max(0, gap - 0.2) * 1.5);
    z = d.z * Math.min(1, Math.max(0, gap - 0.2) * 1.5);
    // Steer around nearby teammates; role targets already preserve the larger structure.
    for (const q of this.players)
      if (q.team === p.team && q.id !== p.id) {
        const space = distance(p, q);
        if (space > 0.01 && space < 3.5) {
          const strength =
            (3.5 - space) * (this.ball.owner === p.id ? 0.12 : 0.32);
          x += ((p.x - q.x) / space) * strength;
          z += ((p.z - q.z) / space) * strength;
        }
      }
    const counter =
      this.ball.owner === p.id &&
      this.elapsed - this.possessionChangedAt < 2.8 &&
      distance(p, this.nearest(1 - p.team, p)) > 5;
    this.move(p, x, z, counter, dt);
  }
  rating() {
    return (
      Math.round(
        clamp(
          6 +
            this.stats.goals * 0.9 +
            this.stats.assists * 0.65 +
            this.stats.completedPasses * 0.06 +
            this.stats.tackles * 0.12 -
            Math.max(0, this.score[1] - this.score[0]) * 0.2,
          3,
          10,
        ) * 10,
      ) / 10
    );
  }
  acquire(p) {
    const b = this.ball,
      pass = this.pendingPass;
    if (pass && pass.sender !== p.id && pass.team === p.team) {
      if (pass.user) this.stats.completedPasses++;
      this.assistCandidate = {
        id: pass.sender,
        receiver: p.id,
        team: p.team,
        user: pass.user,
        time: 12,
      };
    } else if (b.lastTeam !== p.team) {
      this.assistCandidate = null;
      if (this.isUser(p)) this.stats.interceptions++;
    }
    const speed = Math.hypot(b.vx, b.vz),
      control = this.attributesFor(p).passing;
    const error = ((Math.max(0, speed - 17) * (100 - control)) / 100) * 0.018;
    p.x = clamp(p.x + p.dx * error, -22, 22);
    p.z = clamp(p.z + p.dz * error, -33.3, 33.3);
    p.action = "touch";
    p.actionTime = 0.25;
    p.cooldown = 0.2 + (100 - control) * 0.002;
    p.protected = Math.max(p.protected, this.isUser(p) ? 0.9 : 0.55);
    b.owner = p.id;
    b.followOwner = null;
    p.possessionTime = 0;
    if (this.possessionTeam !== p.team) {
      this.possessionTeam = p.team;
      this.possessionChangedAt = this.elapsed;
    }
    b.userShot = false;
    this.pendingPass = null;
    if (p.team === 0 && !this.career) this.controlled = p.id;
  }
  // Allow an early tap just before receiving a pass, without repeating it on later players.
  queueAction(input, dt) {
    if (this.queuedAction && (this.queuedAction.time -= dt) <= 0)
      this.queuedAction = null;
    const action = [
      "shoot",
      "chip",
      "finesse",
      "through",
      "lob",
      "pass",
      "skill",
    ].find((key) => input[key]);
    if (action && !this.demo)
      this.queuedAction = {
        action,
        id: this.controlled,
        input: { ...input },
        time: this.assisted ? 0.5 : 0.35,
      };
  }
  tryQueuedAction() {
    const command = this.queuedAction;
    if (!command) return;
    const { action, id, input } = command;
    let success = false;
    if (action === "pass" && this.career && this.ball.owner !== null) {
      const owner = this.players[this.ball.owner];
      if (
        owner.team === 0 &&
        owner.id !== 0 &&
        owner.cooldown <= 0 &&
        (owner.role !== "goalkeeper" ||
          owner.holdTime >= this.keeperHoldLimit(owner))
      )
        success = this.pass(owner.id, "short", 0);
    }
    if (!success && this.ball.owner === id) {
      if (["pass", "through", "lob"].includes(action))
        success = this.pass(
          id,
          action === "pass" ? "short" : action,
          null,
          input.aimDirection || { x: input.x || 0, z: input.z || 0 },
        );
      else if (action === "skill")
        success = this.skill(id, input.aimDirection?.x ?? input.x);
      else
        success = this.shoot(id, true, {
          type: action === "shoot" ? input.shotType || "normal" : action,
          power: input.power,
          aimX: input.aimX,
          direction: input.aimDirection || { x: input.x || 0, z: input.z || 0 },
        });
    }
    if (success) this.queuedAction = null;
  }
  step(dt, input = {}) {
    if (this.finished) return;
    dt = Math.min(dt, 0.05);
    this.queueAction(input, dt);
    this.manualSwitchTime = Math.max(0, this.manualSwitchTime - dt);
    if (this.kickoffWait > 0) {
      this.kickoffWait -= dt;
      return;
    }
    this.elapsed = Math.min(MATCH_SECONDS, this.elapsed + dt);
    if (this.elapsed >= MATCH_SECONDS) {
      this.finished = true;
      this.events.push({ type: "fulltime" });
      return;
    }
    const b = this.ball;
    for (const p of this.players) {
      p.previousX = p.x;
      p.previousZ = p.z;
    }
    b.previousX = b.x;
    b.previousY = b.y;
    b.previousZ = b.z;
    if (
      this.assisted &&
      !this.career &&
      !this.demo &&
      input.press &&
      !this.pressing &&
      b.owner !== null &&
      this.players[b.owner].team === 1 &&
      distance(this.players[this.controlled], b) > 8
    )
      this.switchPlayer();
    this.pressing = !!input.press;
    b.ignoreTime = Math.max(0, b.ignoreTime - dt);
    if (this.pendingPass && (this.pendingPass.time -= dt) <= 0)
      this.pendingPass = null;
    if (this.assistCandidate && (this.assistCandidate.time -= dt) <= 0)
      this.assistCandidate = null;
    this.buildTactics();
    for (const p of this.players) {
      p.possessionTime = b.owner === p.id ? p.possessionTime + dt : 0;
      for (const key of [
        "cooldown",
        "actionTime",
        "skillCooldown",
        "skillTime",
        "tackleCooldown",
        "protected",
        "slideTime",
        "stunned",
        "saveCooldown",
        "recovery",
        "feintTime",
        "thinkTime",
        "keeperReaction",
      ])
        p[key] = Math.max(0, p[key] - dt);
      if (p.actionTime === 0) p.action = "";
      if (b.owner !== p.id || p.stunned > 0 || p.slideTime > 0) {
        p.skillTime = p.feintTime = 0;
      }
      p.shield = p.id === this.controlled && !!input.shield;
      p.charging = p.id === this.controlled ? input.charge || 0 : 0;
      if (p.id === this.controlled && !this.demo) {
        p.aiShot = null;
        if (
          this.pendingPass?.receiver === p.id &&
          b.owner === null &&
          (!this.career || this.assisted) &&
          Math.hypot(input.x || 0, input.z || 0) < 0.12
        ) {
          const target = this.receiveTarget(p),
            d = unit(target.x - p.x, target.z - p.z);
          const strength = Math.min(1, distance(p, target) * 1.2);
          this.move(p, d.x * strength, d.z * strength, false, dt);
        } else if (
          this.assisted &&
          input.press &&
          b.owner !== null &&
          this.players[b.owner].team !== p.team &&
          Math.hypot(input.x || 0, input.z || 0) < 0.15
        ) {
          const owner = this.players[b.owner];
          const gap = distance(p, b);
          const d = unit(b.x - p.x, b.z - p.z);
          this.move(p, gap > 1.1 ? d.x : 0, gap > 1.1 ? d.z : 0, false, dt);
          if (owner.role !== "goalkeeper" && gap < 2.2) this.tackle(p.id);
        } else
          this.move(
            p,
            input.x || 0,
            input.z || 0,
            !!input.sprint || !!input.press,
            dt,
          );
      } else this.ai(p, dt);
    }
    if (!this.demo) {
      if (input.switch) this.switchPlayer();
      this.tryQueuedAction();
      if (input.tackle) this.tackle(this.controlled);
      if (input.slide) this.tackle(this.controlled, true);
    }
    // Two separation sweeps, including exact coincident positions, avoid piles.
    for (let sweep = 0; sweep < 2; sweep++)
      for (let i = 0; i < this.players.length; i++)
        for (let j = i + 1; j < this.players.length; j++) {
          const p = this.players[i],
            q = this.players[j],
            dist = distance(p, q);
          if (dist < 1.2) {
            const d =
                dist > 0.001
                  ? unit(p.x - q.x, p.z - q.z)
                  : unit(i % 2 ? 1 : -1, j % 2 ? 1 : -1),
              push = (1.2 - dist) * 0.5;
            const heldP = p.role === "goalkeeper" && b.owner === p.id,
              heldQ = q.role === "goalkeeper" && b.owner === q.id;
            const pushP = heldP ? 0 : heldQ ? push * 2 : push,
              pushQ = heldQ ? 0 : heldP ? push * 2 : push;
            p.x = clamp(p.x + d.x * pushP, -22, 22);
            p.z = clamp(p.z + d.z * pushP, -33.5, 33.5);
            q.x = clamp(q.x - d.x * pushQ, -22, 22);
            q.z = clamp(q.z - d.z * pushQ, -33.5, 33.5);
          }
        }
    if (b.owner !== null) {
      let p = this.players[b.owner];
      for (const q of this.players)
        if (
          q.team !== p.team &&
          q.role !== "goalkeeper" &&
          q.cooldown <= 0 &&
          distance(q, p) < 2.5
        ) {
          if (this.tackle(q.id, q.slideTime > 0, true)) {
            p = this.players[b.owner ?? q.id];
            break;
          }
        }
      if (b.owner !== null) {
        this.followBall(p, dt);
        b.lastTeam = p.team;
        b.lastPlayer = p.id;
        if (p.team === 0 && p.role !== "goalkeeper" && !this.career)
          this.controlled = p.id;
      }
    } else {
      const oldVX = b.vx;
      b.vx -= b.vz * b.curve * dt;
      b.vz += oldVX * b.curve * dt;
      b.curve *= Math.exp(-dt * 0.35);
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      b.vy -= 12 * dt;
      b.y += b.vy * dt;
      if (b.y < 0.35) {
        b.y = 0.35;
        b.vy = Math.abs(b.vy) > 1 ? -b.vy * 0.4 : 0;
      }
      const drag = Math.exp(-(b.y <= 0.36 ? 0.72 : 0.12) * dt);
      b.vx *= drag;
      b.vz *= drag;
      this.trySaves();
      if (Math.abs(b.x) > 22.7) {
        b.x = clamp(b.x, -22.7, 22.7);
        b.vx *= -0.65;
        this.pendingPass = null;
      }
      if (Math.abs(b.z) >= 35) {
        if (Math.abs(b.x) < FIELD.goalHalf - 0.2 && b.y < FIELD.goalHeight) {
          const team = b.z < 0 ? 0 : 1;
          this.score[team]++;
          if (team === 0 && b.userShot) this.stats.goals++;
          if (
            team === 0 &&
            this.assistCandidate?.user &&
            this.assistCandidate.receiver === b.lastPlayer
          )
            this.stats.assists++;
          this.events.push({ type: "goal", team });
          this.kickoff(1 - team);
          return;
        }
        b.z = clamp(b.z, -34.7, 34.7);
        b.vz *= -0.65;
        this.pendingPass = null;
      }
      if (b.owner === null && b.y < 1.45) {
        let pickup,
          best = Infinity;
        for (const p of this.players)
          if (
            p.role !== "goalkeeper" &&
            !(p.id === b.ignore && b.ignoreTime > 0) &&
            p.stunned <= 0
          ) {
            const gap = distance(p, b);
            const reach =
              0.95 +
              this.attributesFor(p).passing * 0.003 +
              (this.pendingPass?.receiver === p.id ? 0.22 : 0);
            const toward = unit(b.x - p.x, b.z - p.z);
            const visible = toward.x * p.dx + toward.z * p.dz > -0.35;
            if (
              gap < reach &&
              gap < best &&
              (Math.hypot(b.vx, b.vz) < 23 || visible || gap < 0.65)
            ) {
              best = gap;
              pickup = p;
            }
          }
        if (pickup) this.acquire(pickup);
      }
    }
    if (!this.demo) this.tryQueuedAction();
    // In Kick Off, defensive selection stays put until an intentional switch.
    // Passing/receiving can still follow possession; career always stays on player 0.
    if (this.career) this.controlled = 0;
  }
}
