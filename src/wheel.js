import * as THREE from "three";
import { createWheelLettering } from "./wheel-type.js";
import { targetRotation, spinProgress } from "./data.js";

const LAMP_COUNT = 48;
const TAU = Math.PI * 2;
const FINISH_MS = 230;
const WHEEL_RADIUS = 3.04;
const MAX_WHEEL_ADVANCE = 0.41;
const WHEEL_FINISH = {
  sun: { metal: "#bb8551", plate: "#47332a", signal: "#ffbf75", idle: "#422519", lamp: "#ffbd6e" },
  moon: { metal: "#80a8c9", plate: "#253758", signal: "#9aeeff", idle: "#1c354b", lamp: "#80cbea" },
};

function reflectionTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  const ambient = ctx.createLinearGradient(0, 0, 0, 256);
  ambient.addColorStop(0, "#898e9a");
  ambient.addColorStop(0.43, "#394655");
  ambient.addColorStop(0.67, "#19212c");
  ambient.addColorStop(1, "#352521");
  ctx.fillStyle = ambient;
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#fff1da";
  ctx.fillRect(103, 32, 132, 26);
  ctx.fillRect(114, 65, 102, 6);
  ctx.fillStyle = "#b3e8ff";
  ctx.fillRect(366, 67, 22, 105);
  ctx.fillStyle = "#e5f6ff";
  ctx.fillRect(310, 110, 118, 8);
  const texture = new THREE.CanvasTexture(canvas);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export class ArcadeWheel {
  constructor(host, { onTick = () => {}, onDone = () => {} } = {}) {
    this.host = host;
    this.onTick = onTick;
    this.onDone = onDone;
    this.angle = 0;
    this.reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    try {
      this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      host.classList.add("no-webgl");
      host.innerHTML = '<div class="fallback-wheel">☀</div>';
      return;
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    host.append(this.renderer.domElement);
    this.renderer.domElement.setAttribute("aria-hidden", "true");
    this.scene = new THREE.Scene();
    this.reflection = reflectionTexture();
    this.scene.environment = this.reflection;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0, -0.4, 11.8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x302045, 1.5));
    [
      [0xfff2cd, 57, [-3, 5, 6]],
      [0xa0d6ff, 43, [4, 1, 4]],
      [0xffb763, 16, [0, -4, 4]],
    ].forEach(([color, intensity, position], index) => {
      const light = new THREE.PointLight(color, intensity, 25);
      light.position.set(...position);
      this.scene.add(light);
      if (index === 2) {
        this.spinLight = light;
        this.spinLightHome = light.position.clone();
      }
    });
    this.root = new THREE.Group();
    this.root.rotation.set(0.19, -0.23, 0);
    this.scene.add(this.root);
    this.rotor = new THREE.Group();
    this.root.add(this.rotor);
    this.hasResult = false;
    this.mat = (color, metalness = 0, roughness = 0.4) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const ring = (r, t, z, mat) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 16, 128), mat);
      m.position.z = z;
      this.root.add(m);
      return m;
    };
    const alloy = this.mat("#bb8551", 0.75, 0.22);
    const gunmetal = this.mat("#47332a", 0.62, 0.44);
    const recess = this.mat("#101721", 0.31, 0.51);
    this.trimMaterial = alloy;
    this.plateMaterial = gunmetal;

    // Axial cross-section. The lip surrounds the inset face, and the broader
    // rear flange and rotating ribs are exposed when the drum tilts.
    const profile = [
      [2.34, -0.52], [2.68, -0.52], [2.77, -0.43], [2.77, -0.35],
      [2.64, -0.29], [2.64, 0.06], [2.77, 0.13], [2.77, 0.24],
      [2.70, 0.30], [2.48, 0.30], [2.38, 0.19], [2.34, -0.52],
    ];
    const shell = new THREE.Mesh(
      new THREE.LatheGeometry(profile.map(([radius, z]) => new THREE.Vector2(radius, z)), 96),
      gunmetal,
    );
    shell.rotation.x = Math.PI / 2;
    this.root.add(shell);
    ring(2.715, 0.037, -0.43, alloy);
    ring(2.706, 0.041, 0.276, alloy);
    ring(2.49, 0.036, 0.258, alloy);
    ring(2.56, 0.07, 0.202, recess);
    ring(0.52, 0.037, 0.35, alloy);
    const backing = new THREE.Mesh(new THREE.CircleGeometry(2.55, 96), recess);
    backing.position.z = -0.12;
    this.root.add(backing);
    const ribs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.107, 0.103, 0.28), alloy, 36);
    const fixture = new THREE.Object3D();
    for (let i = 0; i < ribs.count; i++) {
      const angle = i / ribs.count * TAU;
      fixture.position.set(2.64 * Math.cos(angle), 2.64 * Math.sin(angle), -0.14);
      fixture.rotation.z = angle;
      fixture.updateMatrix();
      ribs.setMatrixAt(i, fixture.matrix);
    }
    this.rotor.add(ribs);
    this.lamps = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.127, 0.088, 0.034),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      LAMP_COUNT,
    );
    const sockets = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.177, 0.14, 0.037),
      recess,
      LAMP_COUNT,
    );
    const lamp = new THREE.Object3D();
    for (let i = 0; i < LAMP_COUNT; i++) {
      const angle = i / LAMP_COUNT * TAU;
      lamp.position.set(2.602 * Math.cos(angle), 2.602 * Math.sin(angle), 0.312);
      lamp.rotation.z = angle - Math.PI / 2;
      lamp.updateMatrix();
      sockets.setMatrixAt(i, lamp.matrix);
      lamp.position.z = 0.337;
      lamp.updateMatrix();
      this.lamps.setMatrixAt(i, lamp.matrix);
    }
    this.root.add(sockets, this.lamps);
    this.lampColor = new THREE.Color();
    this.lampSignal = new THREE.Color();
    this.lampIdle = new THREE.Color();
    this.hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.55, 0.27, 48),
      alloy,
    );
    this.hub.rotation.x = Math.PI / 2;
    this.hub.position.z = 0.35;
    this.root.add(this.hub);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 64),
      this.mat("#12202e", 0.42, 0.31),
    );
    face.position.z = 0.49;
    this.root.add(face);
    ring(0.389, 0.021, 0.473, gunmetal);
    const loader = new THREE.TextureLoader();
    const loadBadge = (name) => {
      const texture = loader.load(`${import.meta.env.BASE_URL}assets/${name}`);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.magFilter = THREE.NearestFilter;
      return texture;
    };
    this.badges = { sun: loadBadge("hub-sun.png"), moon: loadBadge("hub-moon.png") };
    this.badge = new THREE.Mesh(
      new THREE.PlaneGeometry(0.57, 0.57),
      new THREE.MeshBasicMaterial({
        map: this.badges.sun,
        transparent: true,
        alphaTest: 0.5,
        toneMapped: false,
      }),
    );
    this.badge.position.z = 0.498;
    this.root.add(this.badge);
    this.pointer = new THREE.Group();
    this.pointer.position.set(0, 2.84, 0.37);
    this.root.add(this.pointer);
    this.pointerMaterial = new THREE.MeshStandardMaterial({
      color: WHEEL_FINISH.sun.signal,
      roughness: 0.36,
      metalness: 0.32,
    });
    const shape = new THREE.Shape();
    shape.moveTo(-0.14, 0.16);
    shape.lineTo(0.14, 0.16);
    shape.lineTo(0, -0.22);
    shape.closePath();
    this.pointer.add(
      new THREE.Mesh(
        new THREE.ExtrudeGeometry(shape, {
          depth: 0.12,
          bevelEnabled: true,
          bevelSegments: 3,
          steps: 1,
          bevelSize: 0.04,
          bevelThickness: 0.03,
        }).translate(0, -0.16, 0),
        this.pointerMaterial,
      ),
    );
    const pivot = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.097, 0.14, 8), alloy);
    pivot.rotation.x = Math.PI / 2;
    pivot.position.z = 0.14;
    this.pointer.add(pivot);
    this.segments = new THREE.Group();
    this.rotor.add(this.segments);
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(host);
    this.frame = this.frame.bind(this);
    this.renderer.setAnimationLoop(this.frame);
    this.visibility = () =>
      this.renderer.setAnimationLoop(document.hidden ? null : this.frame);
    document.addEventListener("visibilitychange", this.visibility);
  }
  setPlaces(places, mode) {
    this.places = places;
    this.wedges = [];
    this.mode = mode;
    this.hasResult = false;
    if (places.length && !this.spinning)
      this.angle = targetRotation(this.angle, 0, places.length, 0);
    if (!this.renderer) return;
    const finish = WHEEL_FINISH[mode];
    this.trimMaterial.color.set(finish.metal);
    this.trimMaterial.emissive.set(finish.idle);
    this.trimMaterial.emissiveIntensity = 0.08;
    this.plateMaterial.color.set(finish.plate);
    this.pointerMaterial.color.set(finish.signal);
    this.pointerMaterial.emissive.set(finish.signal);
    this.pointerMaterial.emissiveIntensity = 0.16;
    this.spinLight.color.set(finish.lamp);
    this.badge.material.map = this.badges[mode];
    this.lampIdle.set(finish.idle);
    this.lampSignal.set(finish.signal);
    this.paintLamps();
    while (this.segments.children.length) {
      let m = this.segments.children[0];
      this.segments.remove(m);
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    const colors =
      mode === "sun"
        ? ["#814433", "#69542c", "#935d37", "#315354"]
        : ["#2b4167", "#276075", "#453e68", "#345465"];
    places.forEach((p, i) => {
      let start = (i / places.length) * Math.PI * 2,
        end = ((i + 1) / places.length) * Math.PI * 2,
        gap = 0.012;
      let s = new THREE.Shape();
      s.absarc(0, 0, 2.36, start + gap, end - gap, false);
      s.lineTo(Math.cos(end - gap) * 0.52, Math.sin(end - gap) * 0.52);
      s.absarc(0, 0, 0.52, end - gap, start + gap, true);
      s.closePath();
      const wedge = new THREE.Mesh(
        new THREE.ExtrudeGeometry(s, {
          depth: 0.16,
          bevelEnabled: true,
          bevelSegments: 3,
          bevelSize: 0.035,
          bevelThickness: 0.03,
          curveSegments: 40,
          steps: 1,
        }),
        new THREE.MeshPhysicalMaterial({
          color: colors[i % 4],
          metalness: 0.27,
          roughness: 0.49,
          clearcoat: 0.54,
          clearcoatRoughness: 0.33,
        }),
      );
      wedge.position.z = 0.015;
      wedge.userData.baseColor = wedge.material.color.clone();
      this.segments.add(wedge);
      this.wedges.push(wedge);
    });
    if (places.length) {
      const texture = new THREE.CanvasTexture(
        createWheelLettering(places, mode),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(
        4,
        this.renderer.capabilities.getMaxAnisotropy(),
      );
      const lettering = new THREE.Mesh(
        new THREE.PlaneGeometry(5.4, 5.4),
        new THREE.MeshBasicMaterial({
          map: texture,
          transparent: true,
          toneMapped: false,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
        }),
      );
      lettering.position.z = 0.245;
      lettering.renderOrder = 3;
      this.segments.add(lettering);
    }
  }
  resize() {
    if (!this.renderer) return;
    const { width, height } = this.host.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(Math.round(width), Math.round(height), false);
    this.camera.aspect = width / height;
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const availableAngle = Math.atan(Math.tan(halfFov) * Math.min(1, this.camera.aspect) * 0.94);
    // Fit the whole tilted drum, including the pointer, at its closest position.
    this.camera.position.z = MAX_WHEEL_ADVANCE + WHEEL_RADIUS / Math.sin(availableAngle);
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }
  spin(index, power = 0.4) {
    if (this.spinning || !this.places.length) return;
    this.spinning = true;
    this.wedges?.forEach((wedge) => {
      wedge.material.color.copy(wedge.userData.baseColor);
      wedge.material.emissiveIntensity = 0;
    });
    this.start = performance.now();
    this.from = this.angle;
    this.to = targetRotation(
      this.angle,
      index,
      this.places.length,
      5 + Math.round(power * 4),
    );
    this.index = index;
    this.duration = this.reduced ? 150 : 3300 + power * 1600;
    this.finishDuration = this.reduced ? 0 : FINISH_MS;
    if (this.spinLight) this.spinLight.color.set(WHEEL_FINISH[this.mode].lamp);
    this.lastTick = -1;
    this.pointerHit = this.start - 200;
    if (!this.renderer)
      this.timer = setTimeout(() => {
        this.spinning = false;
        this.onDone(index);
      }, this.duration + this.finishDuration);
  }
  paintLamps(phase = 0, intensity = 0, result = false) {
    for (let i = 0; i < LAMP_COUNT; i++) {
      const distance = (i - phase + LAMP_COUNT) % LAMP_COUNT;
      const sweep = Math.max(0, 1 - distance / 11) * intensity;
      const echo = Math.max(0, 1 - Math.abs(distance - 24) / 8) * intensity * 0.47;
      const atPointer = Math.abs(i - LAMP_COUNT / 4) <= 1;
      const level = result && atPointer ? 1 : Math.max(sweep, echo, i % 6 === 0 ? 0.43 : 0.13);
      this.lamps.setColorAt(i, this.lampColor.copy(this.lampIdle).lerp(this.lampSignal, level));
    }
    this.lamps.instanceColor.needsUpdate = true;
  }

  frame(t) {
    if (!this.host.clientWidth || !this.host.clientHeight) return;
    const drift = this.reduced ? 0 : Math.sin(t * 0.0014);
    let tiltX = 0.19 + drift * 0.018;
    let tiltY = -0.23 + drift * 0.035;
    let lift = 0;
    if (this.spinning) {
      const elapsed = Math.max(0, t - this.start);
      const p = Math.min(1, elapsed / this.duration);
      const settle = this.finishDuration
        ? THREE.MathUtils.clamp((elapsed - this.duration) / this.finishDuration, 0, 1)
        : p;
      this.angle = this.reduced
        ? (p < 1 ? this.from : this.to)
        : this.from + (this.to - this.from) * spinProgress(p);
      if (!this.reduced) {
        const sweep = -1.44 + p * TAU * 1.8;
        const power = Math.sin(Math.PI * p) ** 0.7;
        const kick = Math.sin(Math.PI * Math.min(1, p * 8));
        const recoil = p < 1 ? 0 : Math.sin(settle * TAU) * (1 - settle) ** 2;
        tiltX += power * 0.13 + kick * 0.08 - recoil * 0.12;
        tiltY += Math.sin(p * TAU) * power * 0.28;
        lift = kick * 0.23 + power * 0.18;
        this.spinLight.position.set(3.6 * Math.cos(sweep), 3.6 * Math.sin(sweep), 4.2);
        this.spinLight.intensity = 16 + 53 * power;
        if (p < 1) {
          this.paintLamps(THREE.MathUtils.euclideanModulo(sweep / TAU * LAMP_COUNT, LAMP_COUNT), 0.4 + power * 0.60);
          const sinceHit = t - this.pointerHit;
          this.pointer.rotation.z = -Math.sin(sinceHit * 0.054) *
            Math.exp(-sinceHit / 32) * (0.18 + power * 0.20);
        } else {
          this.angle = this.to + recoil * 0.075;
          this.pointer.rotation.z = -recoil * 0.37;
          this.paintLamps(LAMP_COUNT / 4, (1 - settle) * 0.72, true);
        }
      }
      let tick = Math.floor(this.angle / ((Math.PI * 2) / 64));
      if (!this.reduced && p < 1 && tick !== this.lastTick) {
        this.lastTick = tick;
        this.onTick(
          p,
          Math.floor(
            (((((Math.PI / 2 - this.angle) % (Math.PI * 2)) + Math.PI * 2) %
              (Math.PI * 2)) /
              (Math.PI * 2)) *
              this.places.length,
          ),
        );
        if (t - this.pointerHit >= 52) this.pointerHit = t;
      }
      if (p === 1 && settle === 1) {
        this.spinning = false;
        this.hasResult = true;
        this.angle = this.to;
        this.paintLamps(0, 0, true);
        this.pointer.rotation.z = 0;
        this.spinLight.position.copy(this.spinLightHome);
        this.spinLight.intensity = 16;
        const finish = WHEEL_FINISH[this.mode];
        this.wedges.forEach(({ material }, index) => {
          if (index === this.index) {
            material.color.lerp(this.lampSignal, 0.21);
            material.emissive.set(finish.signal);
            material.emissiveIntensity = 0.19;
          } else {
            material.color.multiplyScalar(0.61);
          }
        });
        this.onDone(this.index);
      }
    } else if (!this.reduced && !this.hasResult) {
      this.paintLamps((t * 0.0065) % LAMP_COUNT, 0.25);
    }
    this.rotor.rotation.z = this.angle;
    this.root.rotation.set(tiltX, tiltY, 0);
    this.root.position.z = lift;
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    clearTimeout(this.timer);
    document.removeEventListener("visibilitychange", this.visibility);
    this.resizeObserver?.disconnect();
    this.renderer?.setAnimationLoop(null);
    if (this.badge) {
      this.badge.material.map = null;
      Object.values(this.badges).forEach((texture) => texture.dispose());
    }
    this.scene?.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) {
        o.material.map?.dispose();
        o.material.dispose();
      }
    });
    this.reflection?.dispose();
    this.renderer?.dispose();
  }
}
