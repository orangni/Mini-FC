import * as THREE from "three";

export class Renderer {
  constructor(canvas, quality = "high") {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setClearColor(0x101e29);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x101e29, 95, 165);
    this.camera = new THREE.PerspectiveCamera(47, 1, 0.1, 220);
    this.camera.position.set(0, 62, 53);
    this.look = new THREE.Vector3();
    this.scene.add(new THREE.HemisphereLight(0xd6eeff, 0x36533c, 2.5));
    const sun = new THREE.DirectionalLight(0xffedce, 2.1);
    sun.position.set(-30, 60, 25);
    this.scene.add(sun);
    this.materials = new Map();
    this.pitch();
    this.stadium();
    this.models = Array.from({ length: 6 }, (_, i) => this.footballer(i));
    this.ball = new THREE.Group();
    this.ball.add(
      new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.36, 1),
        this.mat(0xf4f4e9),
      ),
    );
    for (const [x, y, z] of [
      [0, 0.34, 0],
      [0.3, 0, 0],
      [-0.3, 0, 0],
      [0, 0, 0.3],
      [0, 0, -0.3],
    ]) {
      const patch = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.12, 0),
        this.mat(0x15202d),
      );
      patch.position.set(x, y, z);
      this.ball.add(patch);
    }
    this.scene.add(this.ball);
    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.48, 12),
      new THREE.MeshBasicMaterial({
        color: 0x0b251e,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.y = 0.055;
    this.scene.add(this.ballShadow);
    this.marker = new THREE.Mesh(
      new THREE.ConeGeometry(0.55, 0.9, 3),
      this.mat(0xfcce65),
    );
    this.marker.rotation.z = Math.PI;
    this.scene.add(this.marker);
    this.ring = new THREE.Mesh(
      new THREE.RingGeometry(0.85, 1.05, 28),
      new THREE.MeshBasicMaterial({ color: 0xfcce65, side: THREE.DoubleSide }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.scene.add(this.ring);
    this.quality = quality;
    this.resize();
    window.addEventListener("resize", () => this.resize());
    canvas.addEventListener("webglcontextlost", (e) => {
      e.preventDefault();
      window.dispatchEvent(new CustomEvent("mini-context-lost"));
    });
    canvas.addEventListener("webglcontextrestored", () =>
      window.location.reload(),
    );
  }
  mat(color) {
    if (!this.materials.has(color))
      this.materials.set(
        color,
        new THREE.MeshLambertMaterial({ color, flatShading: true }),
      );
    return this.materials.get(color);
  }
  box(x, y, z, w, h, d, color, parent = this.scene) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      this.mat(color),
    );
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }
  line(points, color = 0xc3e7bd) {
    const geometry = new THREE.BufferGeometry().setFromPoints(
      points.map(([x, z]) => new THREE.Vector3(x, 0.045, z)),
    );
    this.scene.add(
      new THREE.Line(geometry, new THREE.LineBasicMaterial({ color })),
    );
  }
  rectangle(x1, z1, x2, z2) {
    this.line([
      [x1, z1],
      [x2, z1],
      [x2, z2],
      [x1, z2],
      [x1, z1],
    ]);
  }
  pitch() {
    this.box(0, -0.3, 0, 56, 0.55, 86, 0x214f41);
    for (let i = 0; i < 10; i++)
      this.box(
        0,
        -0.035,
        -31.5 + i * 7,
        46,
        0.06,
        7,
        i % 2 ? 0x318a62 : 0x2b7e59,
      );
    this.rectangle(-23, -35, 23, 35);
    this.line([
      [-23, 0],
      [23, 0],
    ]);
    this.line(
      Array.from({ length: 65 }, (_, i) => [
        Math.cos((i / 64) * Math.PI * 2) * 7,
        Math.sin((i / 64) * Math.PI * 2) * 7,
      ]),
    );
    for (const side of [-1, 1]) {
      this.rectangle(-13, side * 35, 13, side * 23);
      this.rectangle(-7, side * 35, 7, side * 30);
      const spot = new THREE.Mesh(
        new THREE.CircleGeometry(0.18, 10),
        this.mat(0xd4eacf),
      );
      spot.rotation.x = -Math.PI / 2;
      spot.position.set(0, 0.05, side * 26);
      this.scene.add(spot);
      const goal = new THREE.Group();
      goal.position.z = side * 35;
      this.scene.add(goal);
      this.box(-5, 1.6, 0, 0.18, 3.2, 0.18, 0xf4f4e6, goal);
      this.box(5, 1.6, 0, 0.18, 3.2, 0.18, 0xf4f4e6, goal);
      this.box(0, 3.2, 0, 10.2, 0.18, 0.18, 0xf4f4e6, goal);
      const vertices = [],
        segment = (a, b) => vertices.push(...a, ...b);
      for (let x = -5; x <= 5; x += 0.5) {
        segment([x, 0, side * 2.8], [x, 3.2, side * 2.8]);
        segment([x, 3.2, 0], [x, 3.2, side * 2.8]);
      }
      for (let y = 0; y <= 3.3; y += 0.4) {
        segment([-5, y, side * 2.8], [5, y, side * 2.8]);
        for (const x of [-5, 5]) segment([x, y, 0], [x, y, side * 2.8]);
      }
      for (let z = 0; z <= 2.8; z += 0.5)
        for (const x of [-5, 5]) segment([x, 0, side * z], [x, 3.2, side * z]);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute(
        "position",
        new THREE.Float32BufferAttribute(vertices, 3),
      );
      goal.add(
        new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({
            color: 0xb4d7cc,
            transparent: true,
            opacity: 0.48,
          }),
        ),
      );
      for (const x of [-23, 23]) {
        this.box(x, 0.75, side * 35, 0.08, 1.5, 0.08, 0xe4e4c6);
        this.box(x + 0.35, 1.4, side * 35, 0.7, 0.45, 0.04, 0xf8c45c);
      }
    }
    const center = new THREE.Mesh(
      new THREE.CircleGeometry(0.18, 10),
      this.mat(0xd4eacf),
    );
    center.rotation.x = -Math.PI / 2;
    center.position.y = 0.05;
    this.scene.add(center);
  }
  stadium() {
    for (const x of [-1, 1]) {
      this.box(x * 26.3, 0.65, 0, 0.5, 1.3, 78, 0x101f2d);
      for (let i = 0; i < 3; i++)
        this.box(
          x * (30 + i * 2),
          0.5 + i * 1.25,
          0,
          3,
          1,
          80,
          i % 2 ? 0x2d4855 : 0x203847,
        );
    }
    for (const z of [-1, 1]) {
      this.box(0, 0.65, z * 41, 54, 1.3, 0.5, 0x101f2d);
      for (let i = 0; i < 3; i++)
        this.box(
          0,
          0.5 + i * 1.25,
          z * (44 + i * 2),
          71,
          1,
          3,
          i % 2 ? 0x2d4855 : 0x203847,
        );
    }
    const crowd = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.7, 0.9, 0.6),
      this.mat(0xffffff),
      480,
    );
    const transform = new THREE.Object3D(),
      palette = [0x5a8490, 0xdfaf70, 0x397d71, 0xc26058, 0xadb7a1];
    let n = 0;
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 40; i++) {
          transform.position.set(
            side * (30 + row * 2),
            1.4 + row * 1.25,
            -38 + i * 1.95,
          );
          transform.updateMatrix();
          crowd.setMatrixAt(n, transform.matrix);
          crowd.setColorAt(
            n++,
            new THREE.Color(palette[(i * 7 + row) % palette.length]),
          );
        }
    for (const side of [-1, 1])
      for (let row = 0; row < 3; row++)
        for (let i = 0; i < 40; i++) {
          transform.position.set(
            -33 + i * 1.7,
            1.4 + row * 1.25,
            side * (44 + row * 2),
          );
          transform.updateMatrix();
          crowd.setMatrixAt(n, transform.matrix);
          crowd.setColorAt(
            n++,
            new THREE.Color(palette[(i * 3 + row) % palette.length]),
          );
        }
    crowd.instanceMatrix.needsUpdate = true;
    this.scene.add(crowd);
    const boardCanvas = document.createElement("canvas");
    boardCanvas.width = 1024;
    boardCanvas.height = 64;
    const ctx = boardCanvas.getContext("2d");
    ctx.fillStyle = "#142938";
    ctx.fillRect(0, 0, 1024, 64);
    ctx.font = "bold 28px sans-serif";
    ctx.fillStyle = "#f6cb65";
    ctx.textAlign = "center";
    ctx.fillText(
      "MINI FC     /     SMALL PITCH. BIG MOMENTS.     /     MINI FC",
      512,
      43,
    );
    const texture = new THREE.CanvasTexture(boardCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    for (const z of [-40.65, 40.65]) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(48, 1.2),
        new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
      );
      mesh.position.set(0, 0.75, z);
      this.scene.add(mesh);
    }
    for (const x of [-32, 32])
      for (const z of [-37, 37]) {
        this.box(x, 7, z, 0.4, 14, 0.4, 0x647e88);
        const light = this.box(x, 14, z, 4, 1.3, 0.7, 0xdbe8d5);
        light.rotation.x = -0.2;
      }
  }
  footballer(id) {
    const root = new THREE.Group();
    this.scene.add(root);
    const body = new THREE.Group();
    root.add(body);
    const jersey = id < 3 ? 0xf5c553 : 0xec6b60,
      skin = [0xc89068, 0x855838, 0xe3b28a][id % 3];
    this.box(0, 1.35, 0, 0.82, 0.85, 0.48, jersey, body);
    this.box(0, 0.88, 0, 0.74, 0.25, 0.45, id < 3 ? 0x173b35 : 0x263b55, body);
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.37, 1),
      this.mat(skin),
    );
    head.position.y = 2.02;
    body.add(head);
    this.box(0, 2.27, 0.02, 0.5, 0.17, 0.48, 0x252222, body);
    this.box(
      0,
      1.49,
      0.252,
      0.12,
      0.43,
      0.02,
      id < 3 ? 0x173b35 : 0xf4e9cf,
      body,
    );
    this.box(0, 2.02, 0.35, 0.12, 0.12, 0.13, skin, body);
    const legs = [],
      arms = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.22, 0.85, 0);
      body.add(leg);
      this.box(0, -0.27, 0, 0.23, 0.55, 0.23, skin, leg);
      this.box(0, -0.54, 0, 0.24, 0.23, 0.25, 0xe4e8d8, leg);
      this.box(0, -0.71, 0.09, 0.27, 0.14, 0.43, 0x15212b, leg);
      legs.push(leg);
      const arm = new THREE.Group();
      arm.position.set(side * 0.51, 1.64, 0);
      body.add(arm);
      this.box(0, -0.27, 0, 0.22, 0.62, 0.24, skin, arm);
      arms.push(arm);
    }
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 12),
      new THREE.MeshBasicMaterial({
        color: 0x092c25,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.06;
    root.add(shadow);
    return { root, body, legs, arms, phase: id };
  }
  resize() {
    const width = window.innerWidth,
      height = window.innerHeight;
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, this.quality === "low" ? 1 : 1.7),
    );
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  setQuality(quality) {
    this.quality = quality;
    this.resize();
  }
  draw(match, dt, menu) {
    match.players.forEach((p, i) => {
      const m = this.models[i];
      m.root.position.set(p.x, 0, p.z);
      m.body.rotation.y = Math.atan2(p.dx, p.dz);
      m.phase += dt * p.moving * 1.8;
      const swing = Math.sin(m.phase) * Math.min(p.moving / 12, 0.8);
      m.legs[0].rotation.x = swing;
      m.legs[1].rotation.x = -swing;
      m.arms[0].rotation.x = -swing * 0.7;
      m.arms[1].rotation.x = swing * 0.7;
      m.body.position.y = p.moving > 0 ? Math.abs(Math.sin(m.phase)) * 0.08 : 0;
    });
    const b = match.ball;
    this.ball.position.set(b.x, b.y, b.z);
    this.ball.rotation.x += b.vz * dt * 0.8;
    this.ball.rotation.z -= b.vx * dt * 0.8;
    this.ballShadow.position.set(b.x, 0.065, b.z);
    this.ballShadow.scale.setScalar(1 + b.y * 0.08);
    const p = match.players[match.controlled];
    this.marker.visible = this.ring.visible = !menu;
    this.marker.position.set(
      p.x,
      3.35 + Math.sin(performance.now() * 0.004) * 0.1,
      p.z,
    );
    this.ring.position.set(p.x, 0.085, p.z);
    const focusX = menu ? 2 : b.x * 0.35,
      focusZ = menu ? 0 : b.z * 0.63,
      lerp = 1 - Math.exp(-dt * 3.5);
    this.look.lerp(new THREE.Vector3(focusX, 0, focusZ), lerp);
    const portrait = this.camera.aspect < 1;
    this.camera.position.lerp(
      new THREE.Vector3(
        this.look.x * 0.5 + (menu ? 21 : 0),
        portrait ? 85 : 57,
        this.look.z + (portrait ? 62 : 44),
      ),
      lerp,
    );
    this.camera.lookAt(this.look);
    this.renderer.render(this.scene, this.camera);
  }
}
