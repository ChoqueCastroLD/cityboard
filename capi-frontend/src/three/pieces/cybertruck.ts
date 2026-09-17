import { BoxGeometry, CylinderGeometry, ExtrudeGeometry, Shape } from 'three';
import { accentMaterial, bodyMaterial, DARK, metalMaterial, part, piece, SILVER } from './parts';

const WIDTH = 0.19;

function bodyGeometry(): ExtrudeGeometry {
  const profile = new Shape();
  profile.moveTo(0.21, 0.05);
  profile.lineTo(0.21, 0.11);
  profile.lineTo(0.06, 0.15);
  profile.lineTo(-0.03, 0.235);
  profile.lineTo(-0.21, 0.175);
  profile.lineTo(-0.21, 0.05);
  profile.closePath();
  const geometry = new ExtrudeGeometry(profile, { depth: WIDTH, bevelEnabled: false });
  geometry.rotateY(-Math.PI / 2);
  geometry.translate(WIDTH / 2, 0, 0);
  return geometry;
}

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { metalness: 0.65, roughness: 0.28, clearcoat: 1 });
  const glass = accentMaterial('#141a24', { roughness: 0.15, metalness: 0.4 });
  const rubber = accentMaterial(DARK, { roughness: 0.85 });
  const rim = metalMaterial(SILVER, 0.35);
  part(g, bodyGeometry(), body);
  part(g, new BoxGeometry(WIDTH - 0.03, 0.01, 0.13), glass, { y: 0.196, z: 0.015, rx: -0.75 });
  part(g, new BoxGeometry(WIDTH - 0.03, 0.05, 0.01), glass, { y: 0.2, z: -0.075, rx: -0.32 });
  part(g, new BoxGeometry(WIDTH - 0.05, 0.005, 0.14), rubber, { y: 0.178, z: -0.13 });
  for (const [x, z] of [
    [-0.095, 0.12],
    [0.095, 0.12],
    [-0.095, -0.12],
    [0.095, -0.12],
  ]) {
    part(g, new CylinderGeometry(0.048, 0.048, 0.035, 18), rubber, { x, y: 0.048, z, rz: Math.PI / 2 });
    part(g, new CylinderGeometry(0.026, 0.026, 0.038, 12), rim, { x, y: 0.048, z, rz: Math.PI / 2 });
  }
  part(g, new BoxGeometry(WIDTH - 0.02, 0.012, 0.01), accentMaterial('#ffffff', { emissive: '#ffffff', emissiveIntensity: 0.9 }), { y: 0.105, z: 0.212 });
  part(g, new BoxGeometry(WIDTH - 0.02, 0.012, 0.01), accentMaterial('#ff2a2a', { emissive: '#ff2a2a', emissiveIntensity: 0.9 }), { y: 0.17, z: -0.212 });
  return g;
}
