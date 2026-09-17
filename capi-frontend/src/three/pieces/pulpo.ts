import { CatmullRomCurve3, SphereGeometry, TubeGeometry, Vector3 } from 'three';
import { accentMaterial, bodyMaterial, DARK, part, piece, WHITE } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.35, clearcoat: 1 });
  const white = accentMaterial(WHITE, { roughness: 0.4 });
  const dark = accentMaterial(DARK, { roughness: 0.5 });
  part(g, new SphereGeometry(0.1, 20, 16), body, { y: 0.2, sy: 1.25 });
  part(g, new SphereGeometry(0.026, 12, 10), white, { x: -0.04, y: 0.2, z: 0.085 });
  part(g, new SphereGeometry(0.026, 12, 10), white, { x: 0.04, y: 0.2, z: 0.085 });
  part(g, new SphereGeometry(0.013, 10, 8), dark, { x: -0.04, y: 0.2, z: 0.106 });
  part(g, new SphereGeometry(0.013, 10, 8), dark, { x: 0.04, y: 0.2, z: 0.106 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const curl = i % 2 === 0 ? 1 : -1;
    const curve = new CatmullRomCurve3([
      new Vector3(dx * 0.05, 0.11, dz * 0.05),
      new Vector3(dx * 0.11, 0.05, dz * 0.11),
      new Vector3(dx * 0.17, 0.02, dz * 0.17),
      new Vector3(dx * 0.2 - dz * 0.03 * curl, 0.05, dz * 0.2 + dx * 0.03 * curl),
    ]);
    part(g, new TubeGeometry(curve, 10, 0.022, 7, false), body);
    part(g, new SphereGeometry(0.02, 8, 6), body, { x: dx * 0.2 - dz * 0.03 * curl, y: 0.05, z: dz * 0.2 + dx * 0.03 * curl });
  }
  return g;
}
