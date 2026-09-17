import { BoxGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, IVORY, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.6, clearcoat: 0.2 });
  const dark = accentMaterial(DARK, { roughness: 0.6 });
  const snout = accentMaterial(IVORY, { roughness: 0.7 });
  const leg = new CylinderGeometry(0.03, 0.03, 0.09, 10);
  part(g, new SphereGeometry(0.1, 18, 14), body, { y: 0.17, sx: 1.05, sy: 0.85, sz: 1.55 });
  part(g, new SphereGeometry(0.075, 16, 12), body, { y: 0.24, z: 0.14, sx: 1, sy: 0.9, sz: 1.2 });
  part(g, new BoxGeometry(0.075, 0.05, 0.06), snout, { y: 0.215, z: 0.23 });
  part(g, new SphereGeometry(0.012, 8, 6), dark, { x: -0.02, y: 0.225, z: 0.26 });
  part(g, new SphereGeometry(0.012, 8, 6), dark, { x: 0.02, y: 0.225, z: 0.26 });
  part(g, new SphereGeometry(0.014, 8, 6), dark, { x: -0.04, y: 0.27, z: 0.17 });
  part(g, new SphereGeometry(0.014, 8, 6), dark, { x: 0.04, y: 0.27, z: 0.17 });
  part(g, new SphereGeometry(0.022, 10, 8), body, { x: -0.05, y: 0.31, z: 0.12 });
  part(g, new SphereGeometry(0.022, 10, 8), body, { x: 0.05, y: 0.31, z: 0.12 });
  for (const [x, z] of [
    [-0.06, 0.08],
    [0.06, 0.08],
    [-0.06, -0.08],
    [0.06, -0.08],
  ]) {
    part(g, leg, dark, { x, y: 0.045, z });
  }
  return g;
}
