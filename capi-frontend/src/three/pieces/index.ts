import { Box3, Group, type Material, Mesh, Vector3 } from 'three';
import { build as barco } from './barco';
import { build as caballo } from './caballo';
import { build as cactus } from './cactus';
import { build as capibara } from './capibara';
import { build as cybertruck } from './cybertruck';
import { build as moto } from './moto';
import { build as formula1 } from './formula1';
import { build as rata } from './rata';
import { build as cubo } from './cubo';
import { build as piramide } from './piramide';
import { build as paloma } from './paloma';
import { build as pinguino } from './pinguino';
import { build as stickman } from './stickman';
import { build as torres } from './torres';
import { build as cohete } from './cohete';
import { build as cometa } from './cometa';
import { build as corona } from './corona';
import { build as diamante } from './diamante';
import { build as dragon } from './dragon';
import { build as fenix } from './fenix';
import { build as guitarra } from './guitarra';
import { build as mate } from './mate';
import { build as pawn } from './pawn';
import { build as pulpo } from './pulpo';
import { build as satelite } from './satelite';
import { build as sombrero } from './sombrero';
import { build as tortuga } from './tortuga';
import { build as trofeo } from './trofeo';
import { build as tucan } from './tucan';
import { build as volcan } from './volcan';

const BUILDERS: Record<string, (color: string) => Group> = {
  capibara,
  tucan,
  cactus,
  volcan,
  barco,
  guitarra,
  mate,
  cometa,
  tortuga,
  pulpo,
  cohete,
  sombrero,
  pinguino,
  caballo,
  cybertruck,
  stickman,
  torres,
  paloma,
  moto,
  formula1,
  rata,
  cubo,
  piramide,
  corona,
  dragon,
  fenix,
  trofeo,
  diamante,
  satelite,
  pawn,
};

export const PIECE_SHAPES = Object.keys(BUILDERS).filter((id) => id !== 'pawn');

export function buildPiece(shape: string, color: string): Group {
  const group = (BUILDERS[shape] ?? pawn)(color);
  group.userData.shape = BUILDERS[shape] ? shape : 'pawn';
  group.traverse((object) => {
    if (object instanceof Mesh) object.castShadow = true;
  });
  return group;
}

export function pieceMeshes(group: Group): Mesh[] {
  const meshes: Mesh[] = [];
  group.traverse((object) => {
    if (object instanceof Mesh) meshes.push(object);
  });
  return meshes;
}

export function pieceHeight(group: Group): number {
  const box = new Box3().setFromObject(group);
  const size = new Vector3();
  box.getSize(size);
  return size.y;
}

export function setPieceColor(group: Group, color: string): void {
  for (const mesh of pieceMeshes(group)) {
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (material.userData.body && 'color' in material) (material as Material & { color: { set(c: string): void } }).color.set(color);
      if (material.userData.body && 'emissive' in material && (material as Material & { emissiveIntensity?: number }).emissiveIntensity) {
        (material as Material & { emissive: { set(c: string): void } }).emissive.set(color);
      }
    }
  }
}

export function disposePiece(group: Group): void {
  for (const mesh of pieceMeshes(group)) {
    mesh.geometry.dispose();
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) material.dispose();
  }
  group.removeFromParent();
}
