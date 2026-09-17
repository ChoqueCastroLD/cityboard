import { BoxGeometry, ConeGeometry, CylinderGeometry, Shape, ShapeGeometry } from 'three';
import { accentMaterial, bodyMaterial, DoubleSideAccent, IVORY, part, piece, WOOD } from './parts';

export function build(color: string): ReturnType<typeof piece> {
  const g = piece();
  const body = bodyMaterial(color, { roughness: 0.45 });
  const wood = accentMaterial(WOOD, { roughness: 0.85 });
  const sail = DoubleSideAccent(IVORY, { roughness: 0.9 });
  part(g, new BoxGeometry(0.16, 0.07, 0.24), body, { y: 0.045 });
  part(g, new ConeGeometry(0.08, 0.12, 4), body, { y: 0.045, z: 0.18, rx: Math.PI / 2, ry: Math.PI / 4, sx: 1, sy: 1, sz: 0.85 });
  part(g, new BoxGeometry(0.14, 0.02, 0.22), wood, { y: 0.09 });
  part(g, new BoxGeometry(0.08, 0.05, 0.07), wood, { y: 0.125, z: -0.07 });
  part(g, new CylinderGeometry(0.012, 0.012, 0.3, 8), wood, { y: 0.24, z: 0.02 });
  const shape = new Shape();
  shape.moveTo(0, 0.02);
  shape.lineTo(0.13, 0.02);
  shape.quadraticCurveTo(0.08, 0.12, 0.13, 0.22);
  shape.lineTo(0, 0.22);
  shape.closePath();
  part(g, new ShapeGeometry(shape), sail, { x: 0.012, y: 0.14, z: 0.02, ry: Math.PI / 2 });
  const jib = new Shape();
  jib.moveTo(0, 0.03);
  jib.lineTo(0.1, 0.03);
  jib.lineTo(0, 0.17);
  jib.closePath();
  part(g, new ShapeGeometry(jib), sail, { x: -0.012, y: 0.15, z: 0.03, ry: -Math.PI / 2 });
  part(g, new BoxGeometry(0.04, 0.025, 0.003), accentMaterial('#ff3b30'), { x: 0.02, y: 0.385, z: 0.02 });
  return g;
}
