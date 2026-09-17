import { CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, glowMaterial, LAVA, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.8, clearcoat: 0.1 });
  const lava = glowMaterial(LAVA, 2.2);
  const smoke = accentMaterial('#9aa0ad', { roughness: 1, transparent: true, opacity: 0.75 });
  part(g, new CylinderGeometry(0.075, 0.19, 0.3, 22), body, { y: 0.15 });
  part(g, new CylinderGeometry(0.058, 0.058, 0.02, 20), lava, { y: 0.305 });
  part(g, new SphereGeometry(0.03, 10, 8), lava, { x: 0.05, y: 0.27, z: 0.06, sy: 0.5 });
  part(g, new SphereGeometry(0.024, 10, 8), lava, { x: -0.07, y: 0.22, z: 0.04, sy: 0.5 });
  part(g, new SphereGeometry(0.02, 10, 8), lava, { x: 0.02, y: 0.17, z: -0.1, sy: 0.5 });
  part(g, new SphereGeometry(0.035, 10, 8), smoke, { x: 0.01, y: 0.36, z: -0.01 });
  part(g, new SphereGeometry(0.028, 10, 8), smoke, { x: -0.03, y: 0.4, z: 0.02 });
  part(g, new SphereGeometry(0.02, 10, 8), smoke, { x: 0.03, y: 0.43, z: -0.02 });
  return g;
}
