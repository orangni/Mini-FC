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
  } = {}) {
    this.attributes = attributes;
    this.random = random;
    this.demo = demo;
    this.career = career;
    this.position = position;
    this.teams = teams;
    this.players = Array.from({ length: 12 }, (_, id) => {
      const team = TEAM_IDS[0].includes(id) ? 0 : 1,
        slot = TEAM_IDS[team].indexOf(id);
      return {
        id,
        team,
        slot,
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
      x: 0,
      z: 0,
      y: 0.35,
      owner: p.id,
      vx: 0,
      vz: 0,
      vy: 0,
      curve: 0,
      userShot: false,
      ignore: -1,
      ignoreTime: 0,
    });
    this.controlled = 0;
    this.kickoffWait = 1.2;
    this.pendingPass = null;
    this.assistCandidate = null;
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
    if (this.career || this.finished || this.demo) return false;
    const target = this.nearest(0, this.ball, this.controlled);
    if (!target) return false;
    this.controlled = target.id;
    this.manualSwitchTime = 1.5;
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
  release(p, vx, vz, vy) {
    // Start from the actual foot, including actions taken in the same frame as movement.
    Object.assign(this.ball, {
      x: p.x + p.dx * 0.95,
      z: p.z + p.dz * 0.95,
      y: 0.35,
      owner: null,
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
  pass(id, type = "short", requested = null) {
    if (!this.canKick(id)) return false;
    const p = this.players[id],
      dir = dirFor(p.team),
      stats = this.attributesFor(p);
    const mates = this.players.filter(
      (q) => q.team === p.team && q.id !== id && q.role !== "goalkeeper",
    );
    const score = (q) =>
      distance(p, q) -
      (p.role === "goalkeeper"
        ? Math.min(distance(this.nearest(1 - p.team, q), q), 10) * 2
        : 0) -
      (q.z - p.z) * dir * (type === "through" ? 1.2 : 0.35) -
      (this.nearest(1 - p.team, q)
        ? Math.min(distance(this.nearest(1 - p.team, q), q), 8) * 0.3
        : 0);
    mates.sort((a, b) => score(a) - score(b));
    const target = mates.find((q) => q.id === requested) || mates[0];
    const lead = type === "through" ? 8 : type === "lob" ? 3 : 0;
    const dest = {
      x: clamp(target.x + target.dx * lead * 0.25, -21, 21),
      z: clamp(target.z + dir * lead, -31, 31),
    };
    const error =
      (this.random() - 0.5) *
      (100 - stats.passing) *
      (type === "through" ? 0.04 : 0.015);
    const d = unit(dest.x - p.x + error, dest.z - p.z),
      dist = distance(p, dest);
    let speed = (type === "through" ? 27 : 22) + stats.passing * 0.09,
      vy = 0.6;
    if (type === "lob") {
      const flight = clamp(dist / 17, 0.9, 2);
      speed = dist / flight;
      vy = 6 * flight;
    }
    this.release(p, d.x * speed, d.z * speed, vy);
    p.action = "pass";
    p.actionTime = 0.35;
    this.pendingPass = {
      team: p.team,
      sender: p.id,
      receiver: target.id,
      time: type === "lob" ? 3.5 : 2.5,
      target: dest,
      user: this.isUser(p),
    };
    if (this.isUser(p)) {
      this.stats.passes++;
      if (!this.career) this.controlled = target.id;
    }
    this.events.push({ type: "pass", technique: type });
    return true;
  }
  shoot(id, user = false, options = {}) {
    if (!this.canKick(id)) return false;
    const p = this.players[id],
      b = this.ball,
      accuracy = this.attributesFor(p).shooting;
    const type = options.type || "normal",
      power = clamp(options.power ?? 0.35, 0.05, 1),
      goalZ = dirFor(p.team) * 36;
    const dz = Math.abs(goalZ - p.z),
      angle = Math.atan2(Math.abs(p.x), dz);
    const pressure = this.players.filter(
      (q) => q.team !== p.team && q.role !== "goalkeeper" && distance(p, q) < 4,
    ).length;
    const spread =
      (100 - accuracy) * 0.035 +
      Math.max(0, dz - 16) * 0.07 +
      angle * 2 +
      pressure * 0.65 +
      (type === "power" ? power * 1.2 : 0);
    const keeper = this.players[TEAM_IDS[1 - p.team][5]];
    const placement =
      options.aimX !== undefined
        ? clamp(options.aimX, -4.4, 4.4)
        : Math.abs(p.x) < 3
          ? keeper.x >= 0
            ? -2.6
            : 2.6
          : -Math.sign(p.x) * 2.6;
    const targetX = clamp(
      placement + (this.random() - 0.5) * spread * 2,
      -8,
      8,
    );
    let speed = 27 + accuracy * 0.11,
      vy = 3,
      curve = 0;
    if (type === "power") {
      speed = 30 + power * 17 + accuracy * 0.045;
      vy = 2 + power * 3.1;
    }
    if (type === "chip") {
      const flight = clamp(dz / 17, 0.85, 2);
      speed = Math.hypot(targetX - p.x, goalZ - p.z) / flight;
      vy = 6 * flight + 0.4 / flight;
    }
    if (type === "finesse") {
      speed = 24 + accuracy * 0.055;
      vy = 2.7;
      curve = (p.x >= 0 ? -0.5 : 0.5) * dirFor(p.team);
    }
    const d = unit(targetX - p.x, goalZ - p.z),
      travel = Math.hypot(targetX - p.x, goalZ - p.z) / speed;
    const offset = -curve * travel * 0.5;
    const vx = d.x * Math.cos(offset) - d.z * Math.sin(offset),
      vz = d.x * Math.sin(offset) + d.z * Math.cos(offset);
    this.release(p, vx * speed, vz * speed, vy);
    b.curve = curve;
    b.userShot = user && p.team === 0 && (!this.career || id === 0);
    p.action = "shot";
    p.actionTime = 0.5;
    this.pendingPass = null;
    if (b.userShot) this.stats.shots++;
    this.events.push({ type: "shot", technique: type, power });
    return true;
  }
  skill(id = this.controlled, lateral = 1) {
    const p = this.players[id];
    if (!this.canKick(id) || p.skillCooldown > 0 || p.role === "goalkeeper")
      return false;
    const side = lateral < 0 ? -1 : 1;
    p.x = clamp(p.x + p.dz * side * 1.25, -21.5, 21.5);
    p.z = clamp(p.z - p.dx * side * 1.25, -33, 33);
    p.protected = 0.48 + this.attributesFor(p).passing * 0.002;
    p.skillCooldown = 2.5;
    p.action = "feint";
    p.actionTime = 0.5;
    for (const q of this.players)
      if (q.team !== p.team && distance(p, q) < 2.8) q.stunned = 0.22;
    this.events.push({ type: "skill" });
    return true;
  }
  tackle(id = this.controlled, slide = false, automatic = false) {
    const p = this.players[id],
      owner = this.ball.owner === null ? null : this.players[this.ball.owner];
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
      p.actionTime = slide ? 0.7 : 0.3;
      p.tackleCooldown = slide ? 2.2 : 0.65;
    }
    if (slide && !automatic) {
      p.slideTime = 0.28;
      p.cooldown = 0.5;
    }
    const target = owner || this.ball,
      reach = slide ? 3.3 : automatic ? 1.45 : 2.4;
    if (
      distance(p, target) > reach ||
      this.ball.y > 1.3 ||
      owner?.protected > 0 ||
      owner?.cooldown > 0
    )
      return false;
    // A missed contact attempt must not become 60 new dice rolls per second.
    if (automatic) p.tackleCooldown = 0.85;
    const facing = unit(target.x - p.x, target.z - p.z),
      dot = facing.x * p.dx + facing.z * p.dz;
    const chance = clamp(
      (slide ? 0.87 : automatic ? 0.62 : 0.93) -
        (owner?.shield ? 0.48 : 0) -
        (dot < -0.2 ? 0.3 : 0),
      0.12,
      0.98,
    );
    if (this.random() > chance) {
      if (slide) p.stunned = 0.45;
      return false;
    }
    if (owner) {
      owner.cooldown = 0.85;
      owner.protected = 0;
    }
    p.cooldown = 0.6;
    p.protected = 0.75;
    p.tackleCooldown = slide ? 2.2 : 0.6;
    if (slide) {
      this.release(p, facing.x * 10, facing.z * 10, 1.8);
      this.ball.ignore = owner?.id ?? -1;
    } else {
      this.ball.owner = id;
      this.ball.userShot = false;
    }
    this.pendingPass = this.assistCandidate = null;
    if (this.isUser(p)) this.stats.tackles++;
    if (automatic) {
      p.action = "tackle";
      p.actionTime = 0.3;
    }
    this.events.push({ type: "tackle", slide, success: true });
    return true;
  }
  move(p, x, z, sprint, dt) {
    if (p.stunned > 0) {
      p.moving = 0;
      return;
    }
    if (p.slideTime > 0) {
      x = p.dx;
      z = p.dz;
    }
    const mag = Math.hypot(x, z);
    if (mag < 0.05) {
      p.moving = 0;
      p.stamina = Math.min(1, p.stamina + dt * 0.18);
      return;
    }
    if (p.stamina <= 0.06) p.sprintExhausted = true;
    else if (p.stamina >= 0.24) p.sprintExhausted = false;
    const d = unit(x, z),
      running = sprint && !p.sprintExhausted;
    p.stamina = clamp(p.stamina + dt * (running ? -0.23 : 0.13), 0, 1);
    let speed =
      (6.5 + this.attributesFor(p).pace * 0.035) *
      (running ? 1.48 : 1) *
      Math.min(mag, 1);
    if (p.shield && this.ball.owner === p.id) speed *= 0.58;
    if (p.slideTime > 0) speed *= 1.9;
    const minZ = p.role === "goalkeeper" ? -33.5 : -33.3,
      maxZ = -minZ;
    p.x = clamp(p.x + d.x * speed * dt, -22, 22);
    p.z = clamp(p.z + d.z * speed * dt, minZ, maxZ);
    p.dx = d.x;
    p.dz = d.z;
    p.moving = speed;
  }
  goalkeeper(p, dt) {
    const b = this.ball,
      dir = dirFor(p.team),
      ownZ = -dir * 35;
    if (b.owner === p.id) {
      p.holdTime += dt;
      p.moving = 0;
      if (p.holdTime > 0.85) {
        this.pass(p.id);
        p.holdTime = 0;
      }
      return;
    }
    p.holdTime = 0;
    let x = clamp(b.x * 0.42, -3.8, 3.8),
      z = ownZ + dir * 2.6;
    const toward = b.owner === null && b.vz * dir < -2;
    if (toward) {
      const time = (z - b.z) / b.vz;
      if (time > 0 && time < 1.1) {
        x = clamp(b.x + b.vx * time, -5.5, 5.5);
        if (Math.abs(x - p.x) > 1 && p.saveCooldown <= 0 && time < 0.6) {
          p.action = "dive";
          p.actionTime = 0.7;
          p.diveSide = Math.sign(x - p.x);
        }
      }
    }
    const d = unit(x - p.x, z - p.z),
      gap = Math.hypot(x - p.x, z - p.z);
    if (gap > 0.15)
      this.move(
        p,
        d.x * Math.min(gap, 1),
        d.z * Math.min(gap, 1),
        p.action === "dive",
        dt,
      );
    else p.moving = 0;
  }
  trySaves() {
    const b = this.ball;
    if (b.owner !== null || Math.abs(b.z) >= FIELD.halfLength) return false;
    for (const p of this.players)
      if (p.role === "goalkeeper" && p.saveCooldown <= 0) {
        const dir = dirFor(p.team),
          inBox = p.z * -dir > 25 && b.z * -dir > 25 && Math.abs(b.x) < 8;
        const diving = p.action === "dive",
          reach = diving ? 2.5 : 1.3;
        if (!inBox || distance(p, b) > reach || b.y > (diving ? 2.8 : 1.9))
          continue;
        const speed = Math.hypot(b.vx, b.vz),
          rating = this.teams?.[p.team]?.ratings?.goalkeeper ?? 70;
        if (speed > 36 && this.random() > rating / 100) {
          p.saveCooldown = 0.6;
          continue;
        }
        const catchBall =
          b.y < 1.8 && (speed < 23 || this.random() < 0.38 + rating * 0.001);
        this.stats.saves[p.team]++;
        this.assistCandidate = this.pendingPass = null;
        p.action = catchBall ? "catch" : "dive";
        p.actionTime = 0.8;
        p.diveSide = Math.sign(b.x - p.x) || 1;
        p.saveCooldown = 1.0;
        if (catchBall) p.protected = 1.2;
        if (catchBall) {
          b.owner = p.id;
          b.y = 1.6;
          b.userShot = false;
          p.holdTime = 0;
          b.vx = b.vz = b.vy = 0;
        } else {
          b.x = p.x + p.diveSide * 1.5;
          b.z = p.z + dir * 1.3;
          b.vx = p.diveSide * (6 + speed * 0.22);
          b.vz = dir * (8 + speed * 0.25);
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
  ai(p, dt) {
    if (p.role === "goalkeeper") return this.goalkeeper(p, dt);
    const b = this.ball,
      dir = dirFor(p.team),
      owner = b.owner === null ? null : this.players[b.owner];
    let target;
    if (owner?.id === p.id) {
      const goalDistance = Math.abs(dir * 35 - p.z),
        threat = this.nearest(1 - p.team, p);
      if (p.cooldown <= 0 && goalDistance < 18 && Math.abs(p.x) < 12)
        this.shoot(p.id, false, {
          type: this.random() < 0.15 ? "finesse" : "normal",
        });
      else if (
        p.cooldown <= 0 &&
        threat &&
        distance(p, threat) < 4 &&
        this.random() < dt * 3.5
      )
        this.pass(p.id, this.random() < 0.25 ? "through" : "short");
      target = { x: (p.x > 0 ? 1 : -1) * 4, z: dir * 31 };
    } else if (this.pendingPass?.receiver === p.id) {
      target = this.pendingPass.target || {
        x: b.x + b.vx * 0.15,
        z: b.z + b.vz * 0.15,
      };
      if (b.y < 1.8 && distance(p, b) < 6)
        target = { x: b.x + b.vx * 0.1, z: b.z + b.vz * 0.1 };
    } else if (owner?.team === p.team) {
      const attacking = p.slot < 3,
        lane = HOMES[p.slot][0] * (p.team ? -1 : 1);
      target = {
        x: clamp(
          lane + owner.x * 0.15 + Math.sin(this.elapsed * 0.5 + p.id) * 1.5,
          -19,
          19,
        ),
        z: clamp(owner.z + dir * (attacking ? 8 + p.slot * 2 : -11), -29, 29),
      };
      if (distance(p, owner) < 6)
        target.x = clamp(p.x + (p.x >= owner.x ? 1 : -1) * 5, -20, 20);
    } else if (
      this.nearest(p.team).id === p.id ||
      (this.pressing &&
        p.team === 0 &&
        this.nearest(0, b, this.controlled).id === p.id)
    ) {
      target = { x: b.x + b.vx * 0.12, z: b.z + b.vz * 0.12 };
    } else {
      const opponents = this.players.filter(
        (q) => q.team !== p.team && q.role !== "goalkeeper",
      );
      const mark = opponents[p.slot],
        lane = HOMES[p.slot][0] * (p.team ? -1 : 1);
      target = {
        x: clamp(mark.x * 0.5 + lane * 0.5, -20, 20),
        z: clamp((mark.z + b.z) * 0.3 - dir * (p.slot >= 3 ? 15 : 5), -29, 29),
      };
    }
    const gap = distance(p, target);
    if (gap > 0.65) {
      const d = unit(target.x - p.x, target.z - p.z);
      this.move(p, d.x, d.z, false, dt);
    } else p.moving = 0;
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
    if (pass?.receiver === p.id && pass.team === p.team) {
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
    p.protected = Math.max(p.protected, this.isUser(p) ? 0.8 : 0.55);
    b.owner = p.id;
    b.userShot = false;
    this.pendingPass = null;
    if (p.team === 0 && !this.career) this.controlled = p.id;
  }
  // Allow an early tap just before receiving a pass, without repeating it on later players.
  queueAction(input, dt) {
    if (this.queuedAction && (this.queuedAction.time -= dt) <= 0)
      this.queuedAction = null;
    const action = ["shoot", "chip", "finesse", "through", "lob", "pass", "skill"]
      .find((key) => input[key]);
    if (action && !this.demo)
      this.queuedAction = {
        action, id: this.controlled, input: { ...input }, time: 0.35,
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
        owner.team === 0 && owner.id !== 0 && owner.cooldown <= 0 &&
        (owner.role !== "goalkeeper" || owner.holdTime >= 0.85)
      )
        success = this.pass(owner.id, "short", 0);
    }
    if (!success && this.ball.owner === id) {
      if (["pass", "through", "lob"].includes(action))
        success = this.pass(id, action === "pass" ? "short" : action);
      else if (action === "skill") success = this.skill(id, input.x);
      else
        success = this.shoot(id, true, {
          type: action === "shoot" ? input.shotType || "normal" : action,
          power: input.power,
          aimX: input.aimX,
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
    this.pressing = !!input.press;
    b.ignoreTime = Math.max(0, b.ignoreTime - dt);
    if (this.pendingPass && (this.pendingPass.time -= dt) <= 0)
      this.pendingPass = null;
    if (this.assistCandidate && (this.assistCandidate.time -= dt) <= 0)
      this.assistCandidate = null;
    for (const p of this.players) {
      for (const key of [
        "cooldown",
        "actionTime",
        "skillCooldown",
        "tackleCooldown",
        "protected",
        "slideTime",
        "stunned",
        "saveCooldown",
      ])
        p[key] = Math.max(0, p[key] - dt);
      if (p.actionTime === 0) p.action = "";
      p.shield = p.id === this.controlled && !!input.shield;
      if (p.id === this.controlled && !this.demo)
        this.move(
          p,
          input.x || 0,
          input.z || 0,
          !!input.sprint || !!input.press,
          dt,
        );
      else this.ai(p, dt);
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
          distance(q, p) < 1.45
        ) {
          if (this.tackle(q.id, q.slideTime > 0, true)) {
            p = this.players[b.owner ?? q.id];
            break;
          }
        }
      if (b.owner !== null) {
        const offset = p.shield
          ? 0.55
          : 0.85 + (100 - this.attributesFor(p).passing) * 0.0025;
        b.x = p.x + p.dx * offset;
        b.z = p.z + p.dz * offset;
        b.y = p.role === "goalkeeper" ? 1.6 : 0.35;
        b.vx = b.vz = b.vy = b.curve = 0;
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
          best = 1.4;
        for (const p of this.players)
          if (
            p.role !== "goalkeeper" &&
            !(p.id === b.ignore && b.ignoreTime > 0) &&
            p.stunned <= 0
          ) {
            const gap = distance(p, b);
            if (gap < best) {
              best = gap;
              pickup = p;
            }
          }
        if (pickup) this.acquire(pickup);
      }
    }
    if (!this.demo) this.tryQueuedAction();
    if (this.career) this.controlled = 0;
    else if (
      this.manualSwitchTime <= 0 &&
      b.owner !== null &&
      this.players[b.owner].team === 1 &&
      distance(this.players[this.controlled], b) > 9
    )
      this.controlled = this.nearest(0).id;
  }
}
