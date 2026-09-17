import { CylinderGeometry, SphereGeometry } from 'three';
import { bodyMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.4, clearcoat: 0.9 });
  const limb = (length: number) => new CylinderGeometry(0.016, 0.016, length, 10);
  part(g, new SphereGeometry(0.055, 18, 14), body, { y: 0.375 });
  part(g, new CylinderGeometry(0.02, 0.02, 0.17, 10), body, { y: 0.235 });
  part(g, new SphereGeometry(0.022, 10, 8), body, { y: 0.32 });
  part(g, limb(0.14), body, { x: -0.03, y: 0.25, z: 0.03, rx: 0.7, rz: 0.35 });
  part(g, limb(0.14), body, { x: 0.03, y: 0.25, z: -0.03, rx: -0.7, rz: -0.35 });
  part(g, limb(0.15), body, { x: -0.022, y: 0.075, z: 0.035, rx: -0.45 });
  part(g, limb(0.15), body, { x: 0.022, y: 0.075, z: -0.035, rx: 0.45 });
  part(g, new SphereGeometry(0.02, 10, 8), body, { x: -0.022, y: 0.012, z: 0.07 });
  part(g, new SphereGeometry(0.02, 10, 8), body, { x: 0.022, y: 0.012, z: -0.07 });
  return g;
}
