import { BoxGeometry, ConeGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, ORANGE, part, piece, WHITE } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.45 });
  const belly = accentMaterial(WHITE, { roughness: 0.6 });
  const orange = accentMaterial(ORANGE, { roughness: 0.5 });
  const dark = accentMaterial(DARK, { roughness: 0.6 });
  part(g, new SphereGeometry(0.11, 20, 14), body, { y: 0.15, sy: 1.35 });
  part(g, new SphereGeometry(0.085, 18, 12), belly, { y: 0.14, z: 0.075, sy: 1.25, sz: 0.55 });
  part(g, new SphereGeometry(0.075, 18, 12), body, { y: 0.32 });
  part(g, new SphereGeometry(0.05, 14, 10), belly, { y: 0.31, z: 0.045, sz: 0.6 });
  part(g, new ConeGeometry(0.022, 0.06, 10), orange, { y: 0.31, z: 0.1, rx: Math.PI / 2 });
  part(g, new SphereGeometry(0.011, 8, 6), dark, { x: -0.028, y: 0.335, z: 0.062 });
  part(g, new SphereGeometry(0.011, 8, 6), dark, { x: 0.028, y: 0.335, z: 0.062 });
  part(g, new BoxGeometry(0.03, 0.14, 0.06), body, { x: -0.12, y: 0.17, rz: 0.35 });
  part(g, new BoxGeometry(0.03, 0.14, 0.06), body, { x: 0.12, y: 0.17, rz: -0.35 });
  part(g, new BoxGeometry(0.06, 0.02, 0.09), orange, { x: -0.045, y: 0.01, z: 0.04 });
  part(g, new BoxGeometry(0.06, 0.02, 0.09), orange, { x: 0.045, y: 0.01, z: 0.04 });
  return g;
}
