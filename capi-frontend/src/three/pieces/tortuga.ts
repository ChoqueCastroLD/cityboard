import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const shell = bodyMaterial(color, { roughness: 0.4, clearcoat: 0.9 });
  const skin = accentMaterial('#6fbf73', { roughness: 0.7 });
  const dark = accentMaterial(DARK, { roughness: 0.6 });
  const plates = accentMaterial('#2c2c38', { roughness: 0.5, transparent: true, opacity: 0.35 });
  part(g, new CylinderGeometry(0.11, 0.12, 0.05, 20), skin, { y: 0.06 });
  part(g, new SphereGeometry(0.12, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), shell, { y: 0.075, sy: 1.1 });
  const plateSpots: Array<[number, number]> = [
    [0, 0],
    [0.06, 0.035],
    [-0.06, 0.035],
    [0.06, -0.045],
    [-0.06, -0.045],
    [0, 0.08],
    [0, -0.08],
  ];
  for (const [x, z] of plateSpots) {
    part(g, new CylinderGeometry(0.028, 0.028, 0.01, 6), plates, { x, y: 0.075 + Math.sqrt(Math.max(0, 0.0144 - x * x - z * z)) * 1.1 + 0.004, z });
  }
  part(g, new SphereGeometry(0.045, 14, 10), skin, { y: 0.09, z: 0.15, sz: 1.2 });
  part(g, new SphereGeometry(0.008, 8, 6), dark, { x: -0.022, y: 0.105, z: 0.18 });
  part(g, new SphereGeometry(0.008, 8, 6), dark, { x: 0.022, y: 0.105, z: 0.18 });
  for (const [x, z, ry] of [
    [0.1, 0.09, -0.6],
    [-0.1, 0.09, 0.6],
    [0.1, -0.09, -2.5],
    [-0.1, -0.09, 2.5],
  ]) {
    part(g, new BoxGeometry(0.09, 0.025, 0.05), skin, { x, y: 0.04, z, ry });
  }
  part(g, new ConeGeometry(0.02, 0.06, 8), skin, { y: 0.05, z: -0.15, rx: -Math.PI / 2 });
  return g;
}
