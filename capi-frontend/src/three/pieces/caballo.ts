import { BoxGeometry, ConeGeometry, CylinderGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.45 });
  const hair = accentMaterial('#2a1f1a', { roughness: 0.7 });
  const hoof = accentMaterial(DARK, { roughness: 0.6 });
  part(g, new BoxGeometry(0.13, 0.12, 0.24), body, { y: 0.21 });
  part(g, new BoxGeometry(0.11, 0.06, 0.08), body, { y: 0.245, z: 0.12, rx: 0.2 });
  for (const [x, z] of [
    [-0.045, 0.085],
    [0.045, 0.085],
    [-0.045, -0.085],
    [0.045, -0.085],
  ]) {
    part(g, new CylinderGeometry(0.02, 0.017, 0.15, 10), body, { x, y: 0.075, z });
    part(g, new CylinderGeometry(0.019, 0.019, 0.02, 10), hoof, { x, y: 0.01, z });
  }
  part(g, new BoxGeometry(0.07, 0.16, 0.07), body, { y: 0.31, z: 0.14, rx: -0.55 });
  part(g, new BoxGeometry(0.06, 0.06, 0.12), body, { y: 0.39, z: 0.215, rx: 0.15 });
  part(g, new BoxGeometry(0.055, 0.03, 0.05), hoof, { y: 0.375, z: 0.275 });
  part(g, new ConeGeometry(0.014, 0.04, 6), body, { x: -0.022, y: 0.43, z: 0.19 });
  part(g, new ConeGeometry(0.014, 0.04, 6), body, { x: 0.022, y: 0.43, z: 0.19 });
  part(g, new BoxGeometry(0.025, 0.05, 0.16), hair, { y: 0.375, z: 0.13, rx: -0.55 });
  part(g, new CylinderGeometry(0.014, 0.006, 0.16, 8), hair, { y: 0.15, z: -0.15, rx: 0.5 });
  return g;
}
