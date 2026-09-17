import { CylinderGeometry, MeshPhysicalMaterial, OctahedronGeometry, TorusGeometry } from 'three';
import { glowMaterial, GOLD, metalMaterial, part, piece } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const gem = new MeshPhysicalMaterial({
    color,
    metalness: 0,
    roughness: 0.05,
    transmission: 0.55,
    thickness: 0.3,
    ior: 2.4,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.95,
  });
  gem.userData.body = true;
  const gold = metalMaterial(GOLD, 0.2);
  part(g, new CylinderGeometry(0.11, 0.13, 0.03, 24), gold, { y: 0.015 });
  part(g, new TorusGeometry(0.075, 0.012, 8, 24), gold, { y: 0.06, rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    part(g, new CylinderGeometry(0.008, 0.008, 0.12, 6), gold, { x: Math.sin(a) * 0.07, y: 0.11, z: Math.cos(a) * 0.07, rx: Math.cos(a) * -0.35, rz: Math.sin(a) * 0.35 });
  }
  part(g, new OctahedronGeometry(0.11, 0), gem, { y: 0.22, sy: 1.35 });
  part(g, new OctahedronGeometry(0.014, 0), glowMaterial('#ffffff', 1.6), { x: 0.07, y: 0.3, z: 0.05 });
  part(g, new OctahedronGeometry(0.01, 0), glowMaterial('#ffffff', 1.6), { x: -0.06, y: 0.16, z: 0.07 });
  return g;
}
