import { CylinderGeometry, LatheGeometry, SphereGeometry, TorusGeometry, Vector2 } from 'three';
import { accentMaterial, bodyMaterial, LEAF, metalMaterial, part, piece, SILVER } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.5, clearcoat: 0.5 });
  const profile = [
    [0, 0],
    [0.06, 0],
    [0.075, 0.02],
    [0.09, 0.07],
    [0.095, 0.13],
    [0.08, 0.19],
    [0.07, 0.22],
    [0.075, 0.25],
    [0, 0.25],
  ].map(([x, y]) => new Vector2(x, y));
  part(g, new LatheGeometry(profile, 28), body);
  part(g, new TorusGeometry(0.072, 0.012, 8, 24), metalMaterial(SILVER), { y: 0.25, rx: Math.PI / 2 });
  part(g, new CylinderGeometry(0.068, 0.068, 0.02, 20), accentMaterial(LEAF, { roughness: 0.9 }), { y: 0.245 });
  for (const [x, z] of [
    [0.02, 0.01],
    [-0.025, 0.02],
    [0, -0.03],
    [0.03, -0.02],
  ]) {
    part(g, new SphereGeometry(0.02, 8, 6), accentMaterial(LEAF, { roughness: 0.9 }), { x, y: 0.26, z, sy: 0.6 });
  }
  part(g, new CylinderGeometry(0.009, 0.009, 0.24, 8), metalMaterial(SILVER, 0.2), { x: 0.05, y: 0.34, z: -0.02, rz: -0.35, rx: 0.15 });
  part(g, new SphereGeometry(0.014, 8, 6), metalMaterial(SILVER, 0.2), { x: 0.09, y: 0.45, z: -0.035 });
  return g;
}
