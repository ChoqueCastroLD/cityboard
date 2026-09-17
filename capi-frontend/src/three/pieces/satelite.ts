import { BoxGeometry, CylinderGeometry, LatheGeometry, SphereGeometry, Vector2 } from 'three';
import { accentMaterial, bodyMaterial, glowMaterial, metalMaterial, part, piece, SILVER } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { metalness: 0.6, roughness: 0.3, clearcoat: 1 });
  const panel = accentMaterial('#1e3a8a', { metalness: 0.4, roughness: 0.35 });
  const grid = accentMaterial('#93c5fd', { metalness: 0.2, roughness: 0.5 });
  const metal = metalMaterial(SILVER, 0.3);
  const dishProfile = [
    [0, 0],
    [0.03, 0.005],
    [0.05, 0.02],
    [0.06, 0.04],
  ].map(([x, y]) => new Vector2(x, y));
  part(g, new CylinderGeometry(0.03, 0.03, 0.06, 12), metal, { y: 0.03 });
  part(g, new BoxGeometry(0.1, 0.12, 0.1), body, { y: 0.14 });
  part(g, new BoxGeometry(0.02, 0.018, 0.09), metal, { x: 0.1, y: 0.16 });
  part(g, new BoxGeometry(0.02, 0.018, 0.09), metal, { x: -0.1, y: 0.16 });
  part(g, new BoxGeometry(0.16, 0.008, 0.09), panel, { x: 0.19, y: 0.16 });
  part(g, new BoxGeometry(0.16, 0.008, 0.09), panel, { x: -0.19, y: 0.16 });
  for (const x of [0.15, 0.19, 0.23, -0.15, -0.19, -0.23]) {
    part(g, new BoxGeometry(0.003, 0.01, 0.09), grid, { x, y: 0.16 });
  }
  part(g, new LatheGeometry(dishProfile, 20), metal, { y: 0.22, z: 0.06, rx: -0.9 });
  part(g, new CylinderGeometry(0.004, 0.004, 0.06, 6), metal, { y: 0.25, z: 0.09, rx: -0.9 });
  part(g, new CylinderGeometry(0.006, 0.006, 0.09, 6), metal, { y: 0.245 });
  part(g, new SphereGeometry(0.012, 10, 8), glowMaterial('#ff375f', 2), { y: 0.295 });
  return g;
}
