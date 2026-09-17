import { MOUSE, PerspectiveCamera, Spherical, TOUCH, Vector3 } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Side } from 'capi-core';
import type { BoardLayout } from './layout';

const FILL_Y = 0.9;
const FILL_X_LANDSCAPE = 1.3;

export const READ_POLAR = 0.86;
const PORTRAIT_POLAR = 0.62;

const PAN_RADIUS = 5;

const FOLLOW_OFFSET = 1.0;

const SMOOTH_MS = 240;

const SIDE_AZIMUTH: Record<Side, number> = { bottom: 0, left: -Math.PI / 2, top: Math.PI, right: Math.PI / 2 };

interface View {
  target: Vector3;
  azimuth: number;
  polar: number;
  radius: number;
}

const cloneView = (v: View): View => ({ target: v.target.clone(), azimuth: v.azimuth, polar: v.polar, radius: v.radius });
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export class CameraRig {
  readonly camera: PerspectiveCamera;
  readonly controls: OrbitControls;
  private readonly corners: Vector3[];
  private readonly home: View = { target: new Vector3(), azimuth: 0, polar: READ_POLAR, radius: 12 };
  private goal: View | null = null;

  private readonly anchor = new Vector3();
  private focused = false;
  private fitted = false;
  private lastTime = 0;
  private readonly onStart = () => (this.goal = null);

  constructor(
    domElement: HTMLElement,
    private readonly layout: BoardLayout,
  ) {
    this.camera = new PerspectiveCamera(45, 1, 0.1, 100);
    this.controls = new OrbitControls(this.camera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minPolarAngle = 0.25;
    this.controls.maxPolarAngle = 1.3;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 40;
    this.controls.enablePan = true;
    this.controls.screenSpacePanning = false;
    this.controls.panSpeed = 0.6;
    this.controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
    this.controls.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };
    this.controls.addEventListener('start', this.onStart);
    const hw = layout.width / 2 + 0.4;
    const hd = layout.depth / 2 + 0.4;
    this.corners = [new Vector3(-hw, 0, -hd), new Vector3(hw, 0, -hd), new Vector3(-hw, 0, hd), new Vector3(hw, 0, hd)];
  }

  fit(aspect: number): void {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();

    const limitX = aspect < 1 ? 0.98 : FILL_X_LANDSCAPE;
    const limitY = FILL_Y;

    this.home.polar = aspect < 1 ? PORTRAIT_POLAR : READ_POLAR;
    const savedPosition = this.camera.position.clone();
    const savedQuaternion = this.camera.quaternion.clone();
    const target = new Vector3(0, 0, 0);
    const right = new Vector3();
    const up = new Vector3();
    let radius = 12;
    for (let round = 0; round < 8; round++) {
      radius = this.searchRadius(target, limitX, limitY);
      const box = this.projectedBox(target, radius);

      const centerY = aspect < 1 ? 0 : -0.04;
      const halfHeight = radius * Math.tan((this.camera.fov * Math.PI) / 360);
      this.camera.matrixWorld.extractBasis(right, up, new Vector3());
      const dy = (box.minY + box.maxY) / 2 - centerY;
      const dx = (box.minX + box.maxX) / 2;
      if (Math.abs(dy) < 0.005 && Math.abs(dx) < 0.005) break;
      target.addScaledVector(up, dy * halfHeight).addScaledVector(right, dx * halfHeight * aspect);
    }
    radius = this.searchRadius(target, limitX, limitY);
    this.home.target.copy(target);
    this.home.radius = radius;

    this.camera.position.copy(savedPosition);
    this.camera.quaternion.copy(savedQuaternion);
    if (!this.fitted) {
      this.fitted = true;
      this.applyView(this.home);
    } else if (!this.focused) {
      this.goal = cloneView(this.home);
    }
  }

  focusPoint(point: Vector3 | null, side: Side | null): void {
    this.focused = point !== null;
    if (!point) {
      this.goal = cloneView(this.home);
      return;
    }
    this.goal = {
      target: point.clone().setY(0),
      azimuth: side ? SIDE_AZIMUTH[side] : this.currentAzimuth(),
      polar: this.home.polar,
      radius: this.home.radius * 0.42,
    };
  }

  cancel(): void {
    this.goal = null;
    this.focused = false;
  }

  recenter(): void {
    const cur = this.currentView();
    this.focused = false;
    this.goal = { target: this.home.target.clone(), azimuth: cur.azimuth, polar: cur.polar, radius: Math.max(cur.radius, this.home.radius) };
  }

  follow(point: Vector3, side: Side): void {
    if (this.focused) return;
    const offset = new Vector3(point.x - this.home.target.x, 0, point.z - this.home.target.z);
    if (offset.length() > FOLLOW_OFFSET) offset.setLength(FOLLOW_OFFSET);
    this.goal = {
      target: this.home.target.clone().add(offset),
      azimuth: SIDE_AZIMUTH[side],
      polar: this.home.polar,
      radius: this.home.radius,
    };
  }

  update(time: number): void {
    const dt = this.lastTime ? Math.min(100, time - this.lastTime) : 16;
    this.lastTime = time;
    if (this.goal) this.approach(this.goal, 1 - Math.exp(-dt / SMOOTH_MS));
    this.clampPan();
    this.controls.update();
  }

  dispose(): void {
    this.controls.removeEventListener('start', this.onStart);
    this.controls.dispose();
  }

  private projectedBox(target: Vector3, radius: number): { minX: number; maxX: number; minY: number; maxY: number; behind: boolean } {
    this.camera.position.setFromSpherical(new Spherical(radius, this.home.polar, 0)).add(target);
    this.camera.lookAt(target);
    this.camera.updateMatrixWorld();
    const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, behind: false };
    for (const corner of this.corners) {
      const ndc = corner.clone().project(this.camera);
      if (ndc.z > 1 || ndc.z < -1) box.behind = true;
      box.minX = Math.min(box.minX, ndc.x); box.maxX = Math.max(box.maxX, ndc.x);
      box.minY = Math.min(box.minY, ndc.y); box.maxY = Math.max(box.maxY, ndc.y);
    }
    return box;
  }

  private searchRadius(target: Vector3, limitX: number, limitY: number): number {
    let lo = 3, hi = 40;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      const box = this.projectedBox(target, mid);
      const fits = !box.behind && box.minX >= -limitX && box.maxX <= limitX && box.minY >= -limitY && box.maxY <= limitY;
      if (fits) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  private currentView(): View {
    const offset = this.camera.position.clone().sub(this.controls.target);
    const s = new Spherical().setFromVector3(offset);
    return { target: this.controls.target.clone(), azimuth: s.theta, polar: s.phi, radius: s.radius };
  }

  private applyView(view: View): void {
    this.anchor.copy(view.target);
    this.controls.target.copy(view.target);
    this.camera.position.setFromSpherical(new Spherical(view.radius, view.polar, view.azimuth)).add(view.target);
    this.camera.lookAt(view.target);
  }

  private currentAzimuth(): number {
    return this.currentView().azimuth;
  }

  azimuth(): number {
    return this.currentAzimuth();
  }

  viewerSide(): Side {
    const az = this.currentAzimuth();
    let best: Side = 'bottom';
    let bestDiff = Infinity;
    for (const side of Object.keys(SIDE_AZIMUTH) as Side[]) {
      const diff = Math.abs(wrapAngle(az - SIDE_AZIMUTH[side]));
      if (diff < bestDiff) {
        bestDiff = diff;
        best = side;
      }
    }
    return best;
  }

  private approach(goal: View, k: number): void {
    const cur = this.currentView();
    const dAz = wrapAngle(goal.azimuth - cur.azimuth);
    const next: View = {
      target: cur.target.lerp(goal.target, k),
      azimuth: cur.azimuth + dAz * k,
      polar: cur.polar + (goal.polar - cur.polar) * k,
      radius: cur.radius + (goal.radius - cur.radius) * k,
    };
    this.applyView(next);
    const done = Math.abs(dAz) < 0.002 && Math.abs(goal.radius - cur.radius) < 0.01 && cur.target.distanceTo(goal.target) < 0.01;
    if (done) {
      this.applyView(goal);
      this.goal = null;
    }
  }

  private clampPan(): void {
    if (this.goal) return;
    const t = this.controls.target;
    const dx = t.x - this.anchor.x;
    const dz = t.z - this.anchor.z;
    const d = Math.hypot(dx, dz);
    if (d > PAN_RADIUS) {
      const s = PAN_RADIUS / d;
      const delta = new Vector3(dx - dx * s, 0, dz - dz * s);
      t.sub(delta);
      this.camera.position.sub(delta);
    }
  }
}

export const sideAzimuth = (side: Side) => SIDE_AZIMUTH[side];
