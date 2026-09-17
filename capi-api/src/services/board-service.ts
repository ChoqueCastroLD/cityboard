import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { type BoardDefinition, validateBoard } from 'capi-core';
import { notFound } from '../http-error';

export interface BoardSummary {
  id: string;
  name: string;
  description?: string;
  tileCount: number;
  currency: BoardDefinition['currency'];
  theme?: BoardDefinition['theme'];
  thumbnail?: string;
}

export class BoardService {
  private readonly boards = new Map<string, BoardDefinition>();

  static async load(extraDir: string | null): Promise<BoardService> {
    const service = new BoardService();
    const bundled = resolve(import.meta.dir, '../../../capi-core/boards');
    for (const dir of [bundled, extraDir].filter((d): d is string => !!d)) {
      await service.loadDir(dir);
    }
    return service;
  }

  private async loadDir(dir: string): Promise<void> {
    let files: string[];
    try {
      files = (await readdir(dir)).filter((f) => f.endsWith('.json'));
    } catch {
      console.warn(`[boards] cannot read ${dir}`);
      return;
    }
    for (const file of files) {
      const board = JSON.parse(await readFile(join(dir, file), 'utf8')) as BoardDefinition;
      const issues = validateBoard(board);
      if (issues.length > 0) {
        console.warn(`[boards] skipping ${file}: ${issues.map((i) => `${i.path} ${i.message}`).join('; ')}`);
        continue;
      }
      this.boards.set(board.id, board);
    }
  }

  list(): BoardSummary[] {
    return [...this.boards.values()].map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      tileCount: b.tiles.length,
      currency: b.currency,
      theme: b.theme,
      thumbnail: b.tiles.find((t) => 'image' in t && t.image)?.image,
    }));
  }

  get(id: string): BoardDefinition {
    const board = this.boards.get(id);
    if (!board) throw notFound(`board ${id}`);
    return board;
  }
}
