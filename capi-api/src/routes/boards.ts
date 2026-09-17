import { Elysia, t } from 'elysia';
import type { BoardService } from '../services/board-service';

export const boardRoutes = (boards: BoardService) =>
  new Elysia({ prefix: '/api/boards', name: 'boards' })
    .get('/', () => ({ boards: boards.list() }), { detail: { tags: ['boards'], summary: 'List available boards' } })
    .get('/:id', ({ params }) => ({ board: boards.get(params.id) }), {
      params: t.Object({ id: t.String() }),
      detail: { tags: ['boards'], summary: 'Full board definition (tiles, decks, theme)' },
    });
