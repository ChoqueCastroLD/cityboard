import { useEffect, useState } from 'react';
import type { ChatMessage, GameClient } from '../client/GameClient';

export interface ChatView {
  messages: ChatMessage[];
  unread: number;
  markRead: () => void;
}

export function useChat(client: GameClient, open: boolean): ChatView {
  const [messages, setMessages] = useState<ChatMessage[]>(() => client.getChat());
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    setMessages(client.getChat());
    return client.subscribeChat((all, fresh) => {
      setMessages(all);
      if (fresh && fresh.playerId !== client.myPlayerId && !open) setUnread((n) => n + 1);
    });
  }, [client, open]);

  useEffect(() => {
    if (open) setUnread(0);
  }, [open, messages.length]);

  return { messages, unread, markRead: () => setUnread(0) };
}
