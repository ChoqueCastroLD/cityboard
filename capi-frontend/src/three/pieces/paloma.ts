import { BoxGeometry, ConeGeometry, CylinderGeometry, SphereGeometry } from 'three';
import { accentMaterial, bodyMaterial, DARK, ORANGE, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.45 });
  const light = accentMaterial('#f6f1ff', { roughness: 0.55 });
  const beak = accentMaterial(ORANGE, { roughness: 0.5 });
  const dark = accentMaterial(DARK, { roughness: 0.6 });
  part(g, new SphereGeometry(0.075, 18, 12), body, { y: 0.17, sz: 1.5, sy: 0.9 });
  part(g, new SphereGeometry(0.048, 16, 12), light, { y: 0.225, z: 0.115 });
  part(g, new ConeGeometry(0.013, 0.04, 8), beak, { y: 0.22, z: 0.165, rx: Math.PI / 2 });
  part(g, new SphereGeometry(0.008, 8, 6), dark, { x: -0.02, y: 0.238, z: 0.148 });
  part(g, new SphereGeometry(0.008, 8, 6), dark, { x: 0.02, y: 0.238, z: 0.148 });
  part(g, new BoxGeometry(0.2, 0.012, 0.085), body, { x: -0.13, y: 0.24, z: -0.01, rz: 0.55, ry: 0.25 });
  part(g, new BoxGeometry(0.2, 0.012, 0.085), body, { x: 0.13, y: 0.24, z: -0.01, rz: -0.55, ry: -0.25 });
  part(g, new BoxGeometry(0.11, 0.01, 0.09), body, { y: 0.16, z: -0.14, rx: 0.35 });
  part(g, new CylinderGeometry(0.006, 0.006, 0.07, 6), beak, { x: -0.02, y: 0.105, z: 0.03 });
  part(g, new CylinderGeometry(0.006, 0.006, 0.07, 6), beak, { x: 0.02, y: 0.105, z: 0.03 });
  part(g, new BoxGeometry(0.03, 0.006, 0.045), beak, { x: -0.02, y: 0.07, z: 0.045 });
  part(g, new BoxGeometry(0.03, 0.006, 0.045), beak, { x: 0.02, y: 0.07, z: 0.045 });
  g.position.y = -0.065;
  return g;
}
