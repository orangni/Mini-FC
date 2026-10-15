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

export class Match {
  constructor({
    attributes = { pace: 60, shooting: 60, passing: 60 },
    demo = false,
    random = Math.random,
  } = {}) {
    this.attributes = attributes;
    this.random = random;
    this.demo = demo;
    this.players = Array.from({ length: 6 }, (_, id) => ({
      id,
      team: id < 3 ? 0 : 1,
      x: 0,
      z: 0,
      dx: 0,
      dz: id < 3 ? -1 : 1,
      moving: 0,
      cooldown: 0,
      stamina: 1,
    }));
    this.ball = {
      x: 0,
      z: 0,
      y: 0.35,
      vx: 0,
      vz: 0,
      vy: 0,
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
    this.stats = { goals: 0, shots: 0, passes: 0, completedPasses: 0 };
    this.kickoff(0);
  }
  kickoff(team) {
    const positions = [
      [0, 6],
      [-12, 17],
      [11, 24],
      [0, -8],
      [12, -19],
      [-10, -26],
    ];
    this.players.forEach((p, i) => {
      [p.x, p.z] = positions[i];
      p.cooldown = 0.7;
      p.moving = 0;
      p.dx = 0;
      p.dz = p.team === 0 ? -1 : 1;
    });
    const p = this.players[team === 0 ? 0 : 3];
    p.x = 0;
    p.z = team === 0 ? 1 : -1;
    Object.assign(this.ball, {
      x: 0,
      z: 0,
      y: 0.35,
      owner: p.id,
      vx: 0,
      vz: 0,
      vy: 0,
      userShot: false,
      ignore: -1,
      ignoreTime: 0,
    });
    this.controlled = 0;
    this.kickoffWait = 1.2;
    this.pendingPass = null;
  }
  takeEvents() {
    return this.events.splice(0);
  }
  nearest(team, point = this.ball) {
    return this.players
      .filter((p) => p.team === team)
      .sort((a, b) => distance(a, point) - distance(b, point))[0];
  }
  pass(id) {
    const b = this.ball,
      p = this.players[id];
    if (this.finished || this.kickoffWait > 0 || b.owner !== id) return false;
    const mates = this.players.filter((q) => q.team === p.team && q.id !== id);
    const dir = p.team === 0 ? -1 : 1;
    mates.sort(
      (a, c) =>
        distance(p, a) +
        (a.z - p.z) * dir * -0.45 -
        (distance(p, c) + (c.z - p.z) * dir * -0.45),
    );
    const target = mates[0];
    const d = unit(target.x - p.x, target.z - p.z);
    const speed = 22 + (p.team === 0 ? this.attributes.passing : 60) * 0.09;
    this.release(p, d.x * speed, d.z * speed, 0.6);
    this.pendingPass = { team: p.team, receiver: target.id, time: 2.5 };
    if (p.team === 0 && !this.demo) {
      this.stats.passes++;
      this.controlled = target.id;
    }
    this.events.push({ type: "pass" });
    return true;
  }
  shoot(id, user = false) {
    const p = this.players[id],
      b = this.ball;
    if (this.finished || this.kickoffWait > 0 || b.owner !== id) return false;
    const accuracy = p.team === 0 ? this.attributes.shooting : 65;
    const goalZ = p.team === 0 ? -36 : 36;
    const targetX = clamp(
      -p.x * 0.09 + (this.random() - 0.5) * (4.7 - accuracy * 0.04),
      -3.7,
      3.7,
    );
    const d = unit(targetX - p.x, goalZ - p.z);
    this.release(
      p,
      d.x * (27 + accuracy * 0.11),
      d.z * (27 + accuracy * 0.11),
      3.0,
    );
    b.userShot = user && p.team === 0;
    this.pendingPass = null;
    if (user) this.stats.shots++;
    this.events.push({ type: "shot" });
    return true;
  }
  release(p, vx, vz, vy) {
    Object.assign(this.ball, {
      owner: null,
      vx,
      vz,
      vy,
      lastTeam: p.team,
      lastPlayer: p.id,
      userShot: false,
      ignore: p.id,
      ignoreTime: 0.45,
    });
    p.cooldown = 0.45;
  }
  ai(p, dt) {
    const b = this.ball,
      dir = p.team === 0 ? -1 : 1;
    const owner = b.owner === null ? null : this.players[b.owner];
    let target;
    if (owner?.id === p.id) {
      const goalDistance = Math.abs(dir * 35 - p.z);
      const threat = this.players.some(
        (q) => q.team !== p.team && distance(q, p) < 3.8,
      );
      if (p.cooldown <= 0 && goalDistance < 25 && Math.abs(p.x) < 18) {
        this.shoot(p.id);
        p.cooldown = 1;
      } else if (p.cooldown <= 0 && threat && this.random() < dt * 2.4) {
        this.pass(p.id);
        p.cooldown = 1;
      }
      target = { x: Math.sin(this.elapsed * 0.5 + p.id) * 3, z: dir * 34 };
    } else if (this.pendingPass?.receiver === p.id) {
      // Meet the pass instead of running away from a ball in flight.
      target = { x: b.x + b.vx * 0.15, z: b.z + b.vz * 0.15 };
    } else if (owner?.team === p.team) {
      const lane = p.id % 3 === 1 ? -11 : 11;
      target = {
        x: clamp(owner.x * 0.2 + lane, -19, 19),
        z: clamp(owner.z + dir * (p.id % 3 === 2 ? -5 : 9), -29, 29),
      };
    } else if (this.nearest(p.team).id === p.id || distance(p, b) < 6) {
      target = { x: b.x + b.vx * 0.12, z: b.z + b.vz * 0.12 };
    } else {
      // One cover defender stays between the ball and the home goal.
      const lane = p.id % 3 === 1 ? -8 : 8;
      target = {
        x: clamp(b.x * 0.55 + lane, -18, 18),
        z: clamp(b.z - dir * (p.id % 3 === 2 ? 13 : 7), -29, 29),
      };
    }
    const d = distance(p, target);
    if (d > 0.6) {
      const v = unit(target.x - p.x, target.z - p.z);
      this.move(p, v.x, v.z, false, dt);
    } else p.moving = 0;
  }
  move(p, x, z, sprint, dt) {
    const mag = Math.hypot(x, z);
    if (mag < 0.05) {
      p.moving = 0;
      p.stamina = Math.min(1, p.stamina + dt * 0.18);
      return;
    }
    const d = unit(x, z);
    const running = sprint && p.stamina > 0.06;
    p.stamina = clamp(p.stamina + dt * (running ? -0.23 : 0.13), 0, 1);
    const pace = p.team === 0 ? this.attributes.pace : 62;
    const speed =
      (6.5 + pace * 0.035) * (running ? 1.48 : 1) * Math.min(mag, 1);
    p.x = clamp(p.x + d.x * speed * dt, -22, 22);
    p.z = clamp(p.z + d.z * speed * dt, -33.3, 33.3);
    p.dx = d.x;
    p.dz = d.z;
    p.moving = speed;
  }
  step(dt, input = {}) {
    if (this.finished) return;
    dt = Math.min(dt, 0.05);
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
    b.ignoreTime = Math.max(0, b.ignoreTime - dt);
    if (this.pendingPass) {
      this.pendingPass.time -= dt;
      if (this.pendingPass.time <= 0) this.pendingPass = null;
    }
    for (const p of this.players) {
      p.cooldown = Math.max(0, p.cooldown - dt);
      if (p.id === this.controlled && !this.demo)
        this.move(p, input.x || 0, input.z || 0, !!input.sprint, dt);
      else this.ai(p, dt);
    }
    if (!this.demo && input.pass) this.pass(this.controlled);
    if (!this.demo && input.shoot) this.shoot(this.controlled, true);
    // Soft separation keeps tackles readable and avoids stacked footballers.
    for (let i = 0; i < 6; i++)
      for (let j = i + 1; j < 6; j++) {
        const p = this.players[i],
          q = this.players[j],
          dist = distance(p, q);
        if (dist < 1.1 && dist > 0.001) {
          const push = (1.1 - dist) * 0.5;
          const x = ((p.x - q.x) / dist) * push,
            z = ((p.z - q.z) / dist) * push;
          p.x += x;
          p.z += z;
          q.x -= x;
          q.z -= z;
        }
      }
    if (b.owner !== null) {
      let p = this.players[b.owner];
      const tackler = this.players.find(
        (q) =>
          q.team !== p.team &&
          q.cooldown <= 0 &&
          p.cooldown <= 0 &&
          distance(q, p) < 1.65,
      );
      if (tackler) {
        b.owner = tackler.id;
        p.cooldown = 0.9;
        tackler.cooldown = 0.7;
        this.pendingPass = null;
        b.userShot = false;
        p = tackler;
        this.events.push({ type: "tackle" });
      }
      b.x = p.x + p.dx * 0.95;
      b.z = p.z + p.dz * 0.95;
      b.y = 0.35;
      b.vx = b.vz = b.vy = 0;
      b.lastTeam = p.team;
      b.lastPlayer = p.id;
      if (p.team === 0) this.controlled = p.id;
    } else {
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
          this.events.push({ type: "goal", team });
          this.kickoff(1 - team);
          return;
        }
        b.z = clamp(b.z, -34.7, 34.7);
        b.vz *= -0.65;
        this.pendingPass = null;
      }
      if (b.y < 1.45) {
        const pickup = this.players
          .filter(
            (p) =>
              !(p.id === b.ignore && b.ignoreTime > 0) && distance(p, b) < 1.45,
          )
          .sort((p, q) => distance(p, b) - distance(q, b))[0];
        if (pickup) {
          if (
            this.pendingPass?.team === 0 &&
            pickup.id === this.pendingPass.receiver
          )
            this.stats.completedPasses++;
          this.pendingPass = null;
          b.owner = pickup.id;
          b.userShot = false;
          pickup.cooldown = Math.max(pickup.cooldown, 0.35);
          if (pickup.team === 0) this.controlled = pickup.id;
        }
      }
    }
    // Off-ball control follows the closest teammate when possession is lost.
    if (
      b.owner !== null &&
      this.players[b.owner].team === 1 &&
      distance(this.players[this.controlled], b) > 9
    )
      this.controlled = this.nearest(0).id;
  }
}
