import { ConeGeometry, CylinderGeometry, SphereGeometry, TorusGeometry } from 'three';
import { bodyMaterial, glowMaterial, GOLD, metalMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const velvet = bodyMaterial(color, { roughness: 0.55, clearcoat: 0.3 });
  const gold = metalMaterial(GOLD, 0.2);
  const jewel = glowMaterial('#ff5f9e', 0.9);
  part(g, new CylinderGeometry(0.12, 0.12, 0.13, 24), velvet, { y: 0.125 });
  part(g, new TorusGeometry(0.125, 0.024, 12, 32), gold, { y: 0.07, rx: Math.PI / 2 });
  part(g, new TorusGeometry(0.125, 0.018, 12, 32), gold, { y: 0.19, rx: Math.PI / 2 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const x = Math.sin(a) * 0.12;
    const z = Math.cos(a) * 0.12;
    part(g, new ConeGeometry(0.03, 0.12, 8), gold, { x, y: 0.25, z, rx: -Math.cos(a) * 0.18, rz: Math.sin(a) * 0.18 });
    part(g, new SphereGeometry(0.018, 10, 8), jewel, { x: x * 1.02, y: 0.315, z: z * 1.02 });
    part(g, new SphereGeometry(0.014, 10, 8), jewel, { x: Math.sin(a) * 0.126, y: 0.125, z: Math.cos(a) * 0.126 });
  }
  part(g, new SphereGeometry(0.04, 14, 12), velvet, { y: 0.2, sy: 0.4 });
  part(g, new SphereGeometry(0.022, 12, 10), gold, { y: 0.215 });
  part(g, new SphereGeometry(0.014, 10, 8), glowMaterial('#ffffff', 1.4), { y: 0.245 });
  return g;
}
