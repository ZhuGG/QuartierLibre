import * as THREE from "three";
import { createWheelLettering } from "./wheel-type.js";
import { targetRotation, spinProgress } from "./data.js";

const LAMP_COUNT = 48;
const TAU = Math.PI * 2;
const FINISH_MS = 230;
const WHEEL_FINISH = {
  sun: { metal: "#9c7350", signal: "#ffbf75", idle: "#48352a", lamp: "#ffbd6e" },
  moon: { metal: "#668d9f", signal: "#a1dfed", idle: "#263d4d", lamp: "#80cbea" },
};
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
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    this.camera.position.set(0, -0.4, 11.8);
    this.camera.lookAt(0, 0, 0);
    this.scene.add(new THREE.HemisphereLight(0xe8f0ff, 0x23264b, 3));
    [
      [0xfff2cd, 35, [-3, 5, 7]],
      [0xa0bdff, 26, [4, 1, 5]],
      [0xffb763, 15, [0, -5, 2]],
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
    this.root.rotation.x = 0.1;
    this.scene.add(this.root);
    this.rotor = new THREE.Group();
    this.root.add(this.rotor);
    this.mat = (color, metalness = 0, roughness = 0.4) =>
      new THREE.MeshStandardMaterial({ color, metalness, roughness });
    const ring = (r, t, z, mat) => {
      const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 16, 128), mat);
      m.position.z = z;
      this.root.add(m);
      return m;
    };
    const gold = this.mat("#9c7350", 0.55, 0.35),
      navy = this.mat("#182833", 0.43, 0.42);
    this.trimMaterial = gold;
    ring(2.62, 0.15, -0.15, navy);
    ring(2.48, 0.046, 0.18, gold);
    ring(2.74, 0.045, -0.12, gold);
    ring(2.66, 0.024, 0.03, navy);
    ring(0.49, 0.042, 0.32, gold);
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(2.58, 2.58, 0.26, 128),
      navy,
    );
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.14;
    this.root.add(back);
    this.lamps = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.073, 0.125, 0.036),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
      LAMP_COUNT,
    );
    const lamp = new THREE.Object3D();
    for (let i = 0; i < LAMP_COUNT; i++) {
      const angle = i / LAMP_COUNT * TAU;
      lamp.position.set(2.59 * Math.cos(angle), 2.59 * Math.sin(angle), 0.15);
      lamp.rotation.z = angle - Math.PI / 2;
      lamp.updateMatrix();
      this.lamps.setMatrixAt(i, lamp.matrix);
    }
    this.root.add(this.lamps);
    this.lampColor = new THREE.Color();
    this.lampSignal = new THREE.Color();
    this.lampIdle = new THREE.Color();
    this.hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.47, 0.2, 64),
      gold,
    );
    this.hub.rotation.x = Math.PI / 2;
    this.hub.position.z = 0.29;
    this.root.add(this.hub);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 64),
      this.mat("#1b2e36", 0.26, 0.54),
    );
    face.position.z = 0.4;
    this.root.add(face);
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
    this.badge.position.z = 0.415;
    this.root.add(this.badge);
    this.pointer = new THREE.Group();
    this.pointer.position.set(0, 2.88, 0.35);
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
    if (places.length && !this.spinning)
      this.angle = targetRotation(this.angle, 0, places.length, 0);
    if (!this.renderer) return;
    const finish = WHEEL_FINISH[mode];
    this.trimMaterial.color.set(finish.metal);
    this.trimMaterial.emissive.set(finish.idle);
    this.trimMaterial.emissiveIntensity = 0.08;
    this.pointerMaterial.color.set(finish.signal);
    this.pointerMaterial.emissive.set(finish.signal);
    this.pointerMaterial.emissiveIntensity = 0.16;
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
        ? ["#653a29", "#52432c", "#784d31", "#354b4b"]
        : ["#253b51", "#2e505d", "#343d58", "#43515d"];
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
        this.mat(colors[i % 4], 0.2, 0.58),
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
    this.camera.position.z = 9.1;
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
      const sweep = Math.max(0, 1 - distance / 10) * intensity;
      const atPointer = Math.abs(i - LAMP_COUNT / 4) <= 1;
      const level = result && atPointer ? 0.92 : Math.max(sweep, i % 6 === 0 ? 0.26 : 0.07);
      this.lamps.setColorAt(i, this.lampColor.copy(this.lampIdle).lerp(this.lampSignal, level));
    }
    this.lamps.instanceColor.needsUpdate = true;
  }

  frame(t) {
    if (!this.host.clientWidth || !this.host.clientHeight) return;
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
        const sweep = -this.angle * 0.58;
        const power = Math.sin(Math.PI * p) ** 0.7;
        this.spinLight.position.set(3.6 * Math.cos(sweep), 3.6 * Math.sin(sweep), 4.2);
        this.spinLight.intensity = 15 + 32 * power;
        if (p < 1) {
          this.paintLamps(THREE.MathUtils.euclideanModulo(-this.angle / TAU * LAMP_COUNT, LAMP_COUNT), power * 0.8);
          const sinceHit = t - this.pointerHit;
          this.pointer.rotation.z = -Math.sin(sinceHit * 0.054) *
            Math.exp(-sinceHit / 32) * (0.18 + power * 0.20);
        } else {
          const spring = Math.sin(settle * TAU) * (1 - settle) ** 2;
          this.angle = this.to + spring * 0.075;
          this.pointer.rotation.z = -spring * 0.21;
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
        this.angle = this.to;
        this.paintLamps(0, 0, true);
        this.pointer.rotation.z = 0;
        this.spinLight.position.copy(this.spinLightHome);
        this.spinLight.color.set(0xffb763);
        this.spinLight.intensity = 15;
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
    }
    this.rotor.rotation.z = this.angle;
    this.root.rotation.y = this.reduced ? 0 : Math.sin(t * 0.0005) * 0.025;
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
    this.renderer?.dispose();
  }
}
