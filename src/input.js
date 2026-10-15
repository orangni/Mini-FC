export function shotGesture(milliseconds, dx = 0, dy = 0) {
  if (dy < -30 && Math.abs(dy) > Math.abs(dx))
    return { shoot: true, shotType: "chip", power: 0.5 };
  if (Math.abs(dx) > 30)
    return {
      shoot: true,
      shotType: "finesse",
      power: 0.5,
      aimX: Math.max(-4.3, Math.min(4.3, dx / 20)),
    };
  return {
    shoot: true,
    shotType: milliseconds > 220 ? "power" : "normal",
    power: Math.max(0.15, Math.min(1, milliseconds / 1100)),
  };
}
export class Input {
  constructor(onPause) {
    this.keys = new Set();
    this.axes = { x: 0, z: 0 };
    this.actions = {};
    this.active = false;
    this.sprint = false;
    this.press = false;
    this.shield = false;
    this.sprintPointers = new Set();
    this.pointer = null;
    this.shooting = null;
    this.buttonHolds = new Map();
    this.joystick = document.querySelector("#joystick");
    this.stick = document.querySelector("#stick");
    this.zone = document.querySelector("#joystick-zone") || this.joystick;
    window.addEventListener("keydown", (e) => {
      if (/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      if (e.code === "Escape" && !e.repeat) {
        onPause();
        return;
      }
      if (!this.active) return;
      if (
        ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
          e.code,
        )
      )
        e.preventDefault();
      this.keys.add(e.code);
      if (e.repeat) return;
      const map = {
        Space: "pass",
        KeyE: "through",
        KeyL: "lob",
        KeyK: "chip",
        KeyF: "finesse",
        KeyC: "skill",
        KeyR: "tackle",
        KeyX: "slide",
        KeyQ: "switch",
      };
      if (map[e.code]) this.actions[map[e.code]] = true;
      if (e.code === "KeyJ") this.beginShot("keyboard", 0, 0);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
      if (e.code === "KeyJ" && this.active) this.endShot("keyboard", 0, 0);
    });
    window.addEventListener("blur", () => {
      this.reset();
      onPause(true);
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.reset();
        onPause(true);
      }
    });
    this.zone.addEventListener("pointerdown", (e) => {
      if (!this.active || this.pointer !== null || e.target.closest("button"))
        return;
      e.preventDefault();
      this.pointer = e.pointerId;
      const rect = this.zone.getBoundingClientRect(),
        r = this.joystick.offsetWidth / 2;
      if (this.zone !== this.joystick) {
        this.joystick.style.left = `${Math.max(0, Math.min(rect.width - r * 2, e.clientX - rect.left - r))}px`;
        this.joystick.style.bottom = `${Math.max(0, Math.min(rect.height - r * 2, rect.bottom - e.clientY - r))}px`;
      }
      this.zone.setPointerCapture(e.pointerId);
      this.updateStick(e);
    });
    this.zone.addEventListener("pointermove", (e) => {
      if (e.pointerId === this.pointer) {
        e.preventDefault();
        this.updateStick(e);
      }
    });
    const release = (e) => {
      if (e.pointerId === this.pointer) {
        this.pointer = null;
        this.axes = { x: 0, z: 0 };
        this.stick.style.transform = "translate(0px, 0px)";
      }
    };
    for (const target of new Set([this.zone, this.joystick]))
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        target.addEventListener(event, release);
    for (const [id, action] of [
      ["pass-button", "pass"],
      ["through-button", "through"],
      ["chip-button", "chip"],
      ["skill-button", "skill"],
      ["tackle-button", "tackle"],
      ["slide-button", "slide"],
      ["switch-button", "switch"],
      ["shoot-button", "shoot"],
      ["sprint-button", "sprint"],
      ["press-button", "press"],
    ]) {
      const button = document.getElementById(id);
      if (!button) continue;
      button.addEventListener("pointerdown", (e) => {
        if (!this.active) return;
        e.preventDefault();
        button.setPointerCapture(e.pointerId);
        button.classList.add("pressed");
        this.buttonHolds.set(e.pointerId, {
          action,
          at: performance.now(),
          x: e.clientX,
          y: e.clientY,
        });
        if (action === "shoot")
          this.beginShot(e.pointerId, e.clientX, e.clientY);
        else if (action === "sprint") {
          this.sprintPointers.add(e.pointerId);
          this.sprint = true;
        } else if (action === "press") this.press = true;
        else if (action === "skill") this.shield = true;
        else if (action !== "pass") this.actions[action] = true;
      });
      button.addEventListener("pointermove", (e) => {
        if (this.shooting?.id === e.pointerId) {
          this.shooting.dx = e.clientX - this.shooting.x;
          this.shooting.dy = e.clientY - this.shooting.y;
        }
      });
      const end = (e, cancel = false) => {
        const hold = this.buttonHolds.get(e.pointerId);
        this.buttonHolds.delete(e.pointerId);
        button.classList.remove("pressed");
        if (action === "sprint") {
          this.sprintPointers.delete(e.pointerId);
          this.sprint = this.sprintPointers.size > 0;
        }
        if (action === "press") this.press = false;
        if (action === "skill") this.shield = false;
        if (!hold) return;
        const elapsed = performance.now() - hold.at;
        if (action === "shoot") {
          if (cancel) this.shooting = null;
          else this.endShot(e.pointerId, e.clientX, e.clientY);
        }
        if (!cancel && this.active && action === "pass")
          this.actions[elapsed > 350 ? "lob" : "pass"] = true;
        if (!cancel && this.active && action === "skill" && elapsed < 350)
          this.actions.skill = true;
      };
      button.addEventListener("pointerup", (e) => end(e));
      for (const event of ["pointercancel", "lostpointercapture"])
        button.addEventListener(event, (e) => end(e, true));
    }
  }
  beginShot(id, x, y) {
    if (!this.shooting)
      this.shooting = { id, x, y, dx: 0, dy: 0, at: performance.now() };
  }
  endShot(id, x, y) {
    if (this.shooting?.id !== id) return;
    Object.assign(
      this.actions,
      shotGesture(
        performance.now() - this.shooting.at,
        x - this.shooting.x,
        y - this.shooting.y,
      ),
    );
    this.shooting = null;
  }
  charge() {
    return this.shooting
      ? Math.min(1, (performance.now() - this.shooting.at) / 1100)
      : 0;
  }
  setContext(attacking, career) {
    if (this.context === `${attacking}:${career}`) return;
    this.context = `${attacking}:${career}`;
    document.querySelectorAll("[data-phase]").forEach((button) => {
      button.hidden =
        button.dataset.phase !== (attacking ? "attack" : "defend") ||
        (button.id === "switch-button" && career);
    });
    if (!attacking) this.shooting = null;
  }
  updateStick(e) {
    const r = this.joystick.getBoundingClientRect(),
      radius = r.width * 0.32;
    let x = e.clientX - r.left - r.width / 2,
      z = e.clientY - r.top - r.height / 2;
    const d = Math.hypot(x, z);
    if (d > radius) {
      x *= radius / d;
      z *= radius / d;
    }
    this.axes = { x: x / radius, z: z / radius };
    this.stick.style.transform = `translate(${x}px, ${z}px)`;
  }
  read() {
    const k = this.keys,
      actions = this.actions;
    this.actions = {};
    return {
      x:
        this.axes.x +
        (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
        (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0),
      z:
        this.axes.z +
        (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) -
        (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0),
      sprint: this.sprint || k.has("ShiftLeft") || k.has("ShiftRight"),
      press: this.press || k.has("KeyP"),
      shield: this.shield || k.has("KeyV"),
      ...actions,
    };
  }
  reset() {
    this.keys.clear();
    this.axes = { x: 0, z: 0 };
    this.pointer = null;
    this.sprint = this.press = this.shield = false;
    this.sprintPointers.clear();
    this.buttonHolds.clear();
    this.shooting = null;
    this.actions = {};
    this.stick.style.transform = "translate(0px, 0px)";
    this.joystick.style.left = "";
    this.joystick.style.bottom = "";
    document
      .querySelectorAll(".pressed")
      .forEach((e) => e.classList.remove("pressed"));
  }
}
