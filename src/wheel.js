import * as THREE from "three";
import { createWheelLettering } from "./wheel-type.js";
import { targetRotation, spinProgress } from "./data.js";
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
    this.renderer.toneMappingExposure = 1.4;
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
    ].forEach(([c, i, p]) => {
      let l = new THREE.PointLight(c, i, 25);
      l.position.set(...p);
      this.scene.add(l);
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
    const gold = this.mat("#d6ad63", 0.85, 0.24),
      navy = this.mat("#162342", 0.6, 0.28);
    this.trimMaterial = gold;
    ring(2.58, 0.13, -0.12, navy);
    ring(2.47, 0.065, 0.18, gold);
    ring(2.7, 0.035, -0.1, gold);
    ring(0.47, 0.055, 0.31, gold);
    const back = new THREE.Mesh(
      new THREE.CylinderGeometry(2.58, 2.58, 0.26, 128),
      navy,
    );
    back.rotation.x = Math.PI / 2;
    back.position.z = -0.14;
    this.root.add(back);
    for (let i = 0; i < 64; i++) {
      let a = (i / 64) * Math.PI * 2;
      let pin = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), gold);
      pin.position.set(Math.cos(a) * 2.58, Math.sin(a) * 2.58, 0.12);
      this.rotor.add(pin);
    }
    this.hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.44, 0.47, 0.2, 64),
      gold,
    );
    this.hub.rotation.x = Math.PI / 2;
    this.hub.position.z = 0.29;
    this.root.add(this.hub);
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(0.38, 64),
      this.mat("#f6cf73", 0.55, 0.24),
    );
    face.position.z = 0.4;
    this.hubFace = face;
    this.root.add(face);
    this.pointer = new THREE.Group();
    this.pointer.position.set(0, 2.72, 0.35);
    this.root.add(this.pointer);
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
        }),
        gold,
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
    this.trimMaterial.color.set(mode === "sun" ? "#d6ad63" : "#91bac7");
    this.trimMaterial.emissive.set(mode === "sun" ? "#b6792a" : "#5e9eab");
    this.trimMaterial.emissiveIntensity = 0.12;
    this.hubFace.material.color.set(mode === "sun" ? "#f6cf73" : "#a8d1d8");
    while (this.segments.children.length) {
      let m = this.segments.children[0];
      this.segments.remove(m);
      m.geometry.dispose();
      m.material.map?.dispose();
      m.material.dispose();
    }
    const colors =
      mode === "sun"
        ? ["#ca9e4e", "#bcba89", "#d1b980", "#8caa98"]
        : ["#57798e", "#839eab", "#6c8580", "#a2aca1"];
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
        this.mat(colors[i % 4], 0.28, 0.34),
      );
      wedge.position.z = 0.015;
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
    this.wedges?.forEach((w) => {
      w.material.emissiveIntensity = 0;
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
    this.duration = this.reduced ? 150 : 3800 + power * 1700;
    this.lastTick = -1;
    if (!this.renderer)
      this.timer = setTimeout(() => {
        this.spinning = false;
        this.onDone(index);
      }, this.duration);
  }
  frame(t) {
    if (!this.host.clientWidth || !this.host.clientHeight) return;
    if (this.spinning) {
      let p = Math.min(1, (t - this.start) / this.duration);
      this.angle = this.from + (this.to - this.from) * spinProgress(p);
      let tick = Math.floor(this.angle / ((Math.PI * 2) / 64));
      if (tick !== this.lastTick) {
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
        this.pointer.rotation.z = -0.17 * (1 - p);
      }
      if (p === 1) {
        this.spinning = false;
        this.pointer.rotation.z = 0;
        this.wedges[this.index].material.emissive.set(
          this.mode === "sun" ? "#ca8e32" : "#61a7bb",
        );
        this.wedges[this.index].material.emissiveIntensity = 0.5;
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
