import { CanvasTexture, Group, Mesh, MeshPhysicalMaterial, Quaternion, SRGBColorSpace, Vector3 } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { easeInOutCubic, easeOutCubic, linear, type Tweens } from './tween';

const SIZE = 0.3;

const FACE_VALUES = [1, 6, 2, 5, 3, 4] as const;
const FACE_NORMALS = [
  new Vector3(1, 0, 0),
  new Vector3(-1, 0, 0),
  new Vector3(0, 1, 0),
  new Vector3(0, -1, 0),
  new Vector3(0, 0, 1),
  new Vector3(0, 0, -1),
];
const UP = new Vector3(0, 1, 0);
const PIPS: Record<number, [number, number][]> = {
  1: [[0.5, 0.5]],
  2: [[0.25, 0.25], [0.75, 0.75]],
  3: [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]],
  4: [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]],
  5: [[0.25, 0.25], [0.75, 0.25], [0.5, 0.5], [0.25, 0.75], [0.75, 0.75]],
  6: [[0.25, 0.2], [0.75, 0.2], [0.25, 0.5], [0.75, 0.5], [0.25, 0.8], [0.75, 0.8]],
};

function pipTexture(value: number): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#f7f7fb';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#16161f';
  for (const [x, y] of PIPS[value] ?? []) {
    ctx.beginPath();
    ctx.arc(x * 128, y * 128, 11, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

function quaternionForValue(value: number, yaw: number): Quaternion {
  const slot = FACE_VALUES.indexOf(value as (typeof FACE_VALUES)[number]);
  const normal = FACE_NORMALS[slot < 0 ? 0 : slot]!;
  const q = new Quaternion().setFromUnitVectors(normal, UP);
  return new Quaternion().setFromAxisAngle(UP, yaw).multiply(q);
}

export class Dice {
  readonly group = new Group();
  private readonly dice: Mesh<RoundedBoxGeometry, MeshPhysicalMaterial[]>[] = [];
  private readonly rest: Vector3[] = [];
  private rolling = false;

  constructor(private readonly tweens: Tweens) {
    const geometry = new RoundedBoxGeometry(SIZE, SIZE, SIZE, 4, 0.05);
    for (let i = 0; i < 2; i++) {
      const materials = FACE_VALUES.map((v) => new MeshPhysicalMaterial({ map: pipTexture(v), roughness: 0.25, clearcoat: 0.8 }));
      const die = new Mesh(geometry, materials);
      die.castShadow = true;
      die.receiveShadow = true;
      this.dice.push(die);
      this.rest.push(new Vector3());
      this.group.add(die);
    }
  }

  setRest(x: number, z: number): void {
    this.dice.forEach((die, i) => {
      this.rest[i]!.set(x + (i - 0.5) * 0.45, SIZE / 2, z);
      if (!this.rolling) {
        die.position.copy(this.rest[i]!);
        die.quaternion.copy(quaternionForValue(i === 0 ? 3 : 5, 0.3 + i));
      }
    });
  }

  async roll(values: [number, number]): Promise<void> {
    this.rolling = true;
    await Promise.all(this.dice.map((die, i) => this.rollOne(die, this.rest[i]!, values[i] ?? 1, i)));
    this.rolling = false;
  }

  private async rollOne(die: Mesh, rest: Vector3, value: number, index: number): Promise<void> {
    const start = die.position.clone();
    const landing = rest.clone().add(new Vector3((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5 + 0.25));
    const spin = new Vector3(6 + Math.random() * 6, 5 + Math.random() * 6, 6 + Math.random() * 6).multiplyScalar(index % 2 ? -1 : 1);
    const startRotation = die.rotation.clone();
    await this.tweens.run({
      duration: 850,
      ease: linear,
      onUpdate: (t) => {
        die.position.lerpVectors(start, landing, easeOutCubic(t));
        die.position.y = SIZE / 2 + Math.sin(t * Math.PI) * 0.9;
        die.rotation.set(startRotation.x + spin.x * t, startRotation.y + spin.y * t, startRotation.z + spin.z * t);
      },
    });
    const from = die.quaternion.clone();
    const to = quaternionForValue(value, Math.random() * Math.PI * 2);
    await this.tweens.run({
      duration: 380,
      ease: easeInOutCubic,
      onUpdate: (t) => {
        die.quaternion.slerpQuaternions(from, to, t);
        die.position.y = SIZE / 2 + Math.sin(t * Math.PI) * 0.12;
      },
    });

    const settled = die.position.clone();
    await this.tweens.run({ duration: 250, onUpdate: (t) => die.position.lerpVectors(settled, rest, t) });
  }

  dispose(): void {
    for (const die of this.dice) {
      die.geometry.dispose();
      for (const m of die.material) {
        m.map?.dispose();
        m.dispose();
      }
    }
  }
}
