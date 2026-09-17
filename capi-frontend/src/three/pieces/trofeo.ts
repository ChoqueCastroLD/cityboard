import { BoxGeometry, CylinderGeometry, LatheGeometry, TorusGeometry, Vector2 } from 'three';
import { bodyMaterial, glowMaterial, GOLD, metalMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const gold = metalMaterial(GOLD, 0.18);
  const cup = bodyMaterial(color, { metalness: 0.9, roughness: 0.2, clearcoat: 1 });
  const profile = [
    [0, 0.19],
    [0.04, 0.19],
    [0.045, 0.22],
    [0.06, 0.26],
    [0.085, 0.31],
    [0.095, 0.37],
    [0.09, 0.4],
    [0, 0.4],
  ].map(([x, y]) => new Vector2(x, y));
  part(g, new BoxGeometry(0.16, 0.03, 0.16), gold, { y: 0.015 });
  part(g, new BoxGeometry(0.12, 0.03, 0.12), gold, { y: 0.045 });
  part(g, new CylinderGeometry(0.02, 0.04, 0.1, 14), gold, { y: 0.11 });
  part(g, new CylinderGeometry(0.045, 0.02, 0.03, 14), gold, { y: 0.175 });
  part(g, new LatheGeometry(profile, 28), cup);
  part(g, new TorusGeometry(0.048, 0.012, 8, 20, Math.PI), gold, { x: 0.1, y: 0.31, ry: Math.PI / 2, rz: -Math.PI / 2 });
  part(g, new TorusGeometry(0.048, 0.012, 8, 20, Math.PI), gold, { x: -0.1, y: 0.31, ry: -Math.PI / 2, rz: Math.PI / 2 });
  part(g, new BoxGeometry(0.06, 0.02, 0.005), glowMaterial('#ffffff', 0.8), { y: 0.03, z: 0.081 });
  return g;
}
