export class Input {
  constructor(onPause) {
    this.keys = new Set();
    this.axes = { x: 0, z: 0 };
    this.actions = { pass: false, shoot: false };
    this.sprint = false;
    this.active = false;
    this.joystick = document.querySelector("#joystick");
    this.stick = document.querySelector("#stick");
    this.pointer = null;
    this.sprintPointers = new Set();
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
      if (!e.repeat) {
        if (e.code === "Space") this.actions.pass = true;
        if (e.code === "KeyJ") this.actions.shoot = true;
      }
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
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
    this.joystick.addEventListener("pointerdown", (e) => {
      if (!this.active || this.pointer !== null) return;
      e.preventDefault();
      this.pointer = e.pointerId;
      this.joystick.setPointerCapture(e.pointerId);
      this.updateStick(e);
    });
    this.joystick.addEventListener("pointermove", (e) => {
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
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      this.joystick.addEventListener(event, release);
    for (const [id, action] of [
      ["pass-button", "pass"],
      ["shoot-button", "shoot"],
    ]) {
      const button = document.getElementById(id);
      button.addEventListener("pointerdown", (e) => {
        if (!this.active) return;
        e.preventDefault();
        this.actions[action] = true;
        button.classList.add("pressed");
        button.setPointerCapture(e.pointerId);
      });
      for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
        button.addEventListener(event, () =>
          button.classList.remove("pressed"),
        );
    }
    const sprint = document.getElementById("sprint-button");
    sprint.addEventListener("pointerdown", (e) => {
      if (!this.active) return;
      e.preventDefault();
      sprint.setPointerCapture(e.pointerId);
      this.sprintPointers.add(e.pointerId);
      this.sprint = true;
      sprint.classList.add("pressed");
    });
    for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
      sprint.addEventListener(event, (e) => {
        this.sprintPointers.delete(e.pointerId);
        this.sprint = this.sprintPointers.size > 0;
        if (!this.sprint) sprint.classList.remove("pressed");
      });
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
    const k = this.keys;
    const value = {
      x:
        this.axes.x +
        (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) -
        (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0),
      z:
        this.axes.z +
        (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) -
        (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0),
      sprint: this.sprint || k.has("ShiftLeft") || k.has("ShiftRight"),
      ...this.actions,
    };
    this.actions.pass = this.actions.shoot = false;
    return value;
  }
  reset() {
    this.keys.clear();
    this.axes = { x: 0, z: 0 };
    this.pointer = null;
    this.sprint = false;
    this.sprintPointers.clear();
    this.actions.pass = this.actions.shoot = false;
    this.stick.style.transform = "translate(0px, 0px)";
    document
      .querySelectorAll(".pressed")
      .forEach((e) => e.classList.remove("pressed"));
  }
}
