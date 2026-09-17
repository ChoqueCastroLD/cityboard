import type { BoardDefinition, GameEvent, GameState } from 'capi-core';
import { useEffect, useState } from 'react';
import type { GameClient } from '../client/GameClient';
import { FLUSH_KEY, presentation, presentationKey } from '../lib/presentation';

const LOG_LIMIT = 150;

const HOLD_TIMEOUT_MS = 10_000;

export interface LogEntry {
  id: number;
  event: GameEvent;
}

interface Batch {
  next: GameState;
  events: GameEvent[];
}

export interface GameView {
  board: BoardDefinition;
  state: GameState;
  log: LogEntry[];
  presence: ReadonlySet<string> | null;
  disconnectDeadlines: ReadonlyMap<string, number>;
}

export function useGameState(client: GameClient): GameView {
  const [board, setBoard] = useState<BoardDefinition>(() => client.board);
  const [state, setState] = useState<GameState>(() => client.getState());
  const [log, setLog] = useState<LogEntry[]>([]);
  const [presence, setPresence] = useState<ReadonlySet<string> | null>(() => client.getPresence());
  const [disconnectDeadlines, setDeadlines] = useState<ReadonlyMap<string, number>>(() => client.getDisconnectDeadlines());

  useEffect(() => {
    let nextId = 0;
    let held: { key: string; batch: Batch; timer: ReturnType<typeof setTimeout> } | null = null;
    const pending: Batch[] = [];

    const finishedEarly = new Set<string>();
    let bypass = false;

    const append = (events: GameEvent[]) => {
      if (events.length === 0) return;
      const entries = events.map((event) => ({ id: nextId++, event }));
      setLog((prev) => [...prev, ...entries].slice(-LOG_LIMIT));
    };

    const show = (batch: Batch): void => {
      const drawn = bypass ? -1 : batch.events.findIndex((e) => e.type === 'CARD_DRAWN');
      if (drawn === -1) {
        setState(batch.next);
        append(batch.events);
        return;
      }
      const event = batch.events[drawn]!;
      append(batch.events.slice(0, drawn + 1));
      const key = event.type === 'CARD_DRAWN' ? presentationKey(event) : '';
      const tail = { next: batch.next, events: batch.events.slice(drawn + 1) };
      if (finishedEarly.delete(key)) {
        show(tail);
        return;
      }
      held = { key, batch: tail, timer: setTimeout(() => release(key), HOLD_TIMEOUT_MS) };
    };

    const flush = (): void => {
      while (!held && pending.length > 0) show(pending.shift()!);
    };

    const release = (key: string): void => {
      if (key === FLUSH_KEY) {
        bypass = true;
        finishedEarly.clear();
        if (held) {
          clearTimeout(held.timer);
          const { batch } = held;
          held = null;
          show(batch);
        }
        flush();
        bypass = false;
        return;
      }
      if (!held || held.key !== key) {
        finishedEarly.add(key);
        return;
      }
      clearTimeout(held.timer);
      const { batch } = held;
      held = null;
      show(batch);
      flush();
    };

    setBoard(client.board);
    setState(client.getState());
    setLog(client.getHistory().map((event) => ({ id: nextId++, event })));
    setPresence(client.getPresence());
    setDeadlines(client.getDisconnectDeadlines());
    const unsubscribeClient = client.subscribe((next, events) => {
      setBoard(client.board);
      setPresence(client.getPresence());
      setDeadlines(client.getDisconnectDeadlines());
      pending.push({ next, events });
      flush();
    });
    const unsubscribePresentation = presentation.subscribe(release);
    return () => {
      unsubscribeClient();
      unsubscribePresentation();
      if (held) clearTimeout(held.timer);
    };
  }, [client]);

  return { board, state, log, presence, disconnectDeadlines };
}
