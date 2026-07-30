import type { WatchPartySyncEvent } from '../types';

export interface WatchPartyTransport {
  connect(roomId: string): void;
  disconnect(): void;
  send(event: WatchPartySyncEvent): void;
  onMessage(cb: (event: WatchPartySyncEvent) => void): () => void;
}

// Works across tabs/windows on the same browser — handy for local development
// and for demoing Watch Party without standing up a backend. Swap for
// WebSocketTransport in production.
export class BroadcastChannelTransport implements WatchPartyTransport {
  private channel: BroadcastChannel | null = null;
  private listeners = new Set<(e: WatchPartySyncEvent) => void>();

  connect(roomId: string) {
    // Guard against connect() being called twice without an intervening
    // disconnect() (e.g. React.StrictMode's double effect-invocation in
    // development) — close any previous channel first so it isn't leaked.
    this.channel?.close();
    this.channel = new BroadcastChannel(`watch-party:${roomId}`);
    this.channel.onmessage = (e: MessageEvent) => this.listeners.forEach(cb => cb(e.data));
  }
  disconnect() {
    this.channel?.close();
    this.channel = null;
  }
  send(event: WatchPartySyncEvent) {
    this.channel?.postMessage(event);
  }
  onMessage(cb: (e: WatchPartySyncEvent) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}

// Production transport: point wsUrl at your real-time backend (e.g. a small
// Node/ws or Socket.IO service). The server only needs to fan out every
// received event to the other clients in the same room.
export class WebSocketTransport implements WatchPartyTransport {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: WatchPartySyncEvent) => void>();
  private roomId = '';
  private reconnectAttempts = 0;
  private readonly wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  connect(roomId: string) {
    // See BroadcastChannelTransport.connect() — guard against a duplicate
    // connect() call (e.g. StrictMode) leaking a socket.
    this.ws?.close();
    this.roomId = roomId;
    this.reconnectAttempts = 0;
    this.open();
  }

  private open() {
    const socket = new WebSocket(`${this.wsUrl}?room=${encodeURIComponent(this.roomId)}`);
    this.ws = socket;
    socket.onmessage = (e: MessageEvent) => {
      try {
        const parsed = JSON.parse(e.data) as WatchPartySyncEvent;
        this.listeners.forEach(cb => cb(parsed));
      } catch {
        // ignore malformed frames
      }
    };
    socket.onopen = () => {
      this.reconnectAttempts = 0;
    };
    socket.onclose = () => {
      // Ignore close events from a socket that isn't the current one
      // anymore — otherwise a stale close (from an explicit disconnect(),
      // or from being superseded by a fresh connect()) can still trigger
      // this reconnect logic and spawn an unwanted extra connection.
      if (this.ws !== socket) return;
      if (this.reconnectAttempts >= 6) return;
      const backoff = Math.min(1000 * 2 ** this.reconnectAttempts, 15000);
      this.reconnectAttempts += 1;
      setTimeout(() => this.open(), backoff);
    };
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
  }

  send(event: WatchPartySyncEvent) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }

  onMessage(cb: (e: WatchPartySyncEvent) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }
}
