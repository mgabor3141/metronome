/**
 * Type declarations for Bun
 * These declarations are used for development only
 * At runtime, Bun provides its own types
 */

declare module "bun" {
  export interface ServerWebSocket<T = undefined> {
    data: T;
    send(message: string | ArrayBufferLike | ArrayBufferView, compress?: boolean): void;
    close(code?: number, reason?: string): void;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    publish(topic: string, message: string | ArrayBufferLike | ArrayBufferView): void;
    isSubscribed(topic: string): boolean;
    remoteAddress: string;
  }

  export interface WebSocketHandler<T = undefined> {
    open?(ws: ServerWebSocket<T>): void | Promise<void>;
    message?(ws: ServerWebSocket<T>, message: string | Buffer): void | Promise<void>;
    close?(ws: ServerWebSocket<T>, code: number, reason: string): void | Promise<void>;
    drain?(ws: ServerWebSocket<T>): void | Promise<void>;
    error?(ws: ServerWebSocket<T>, error: Error): void | Promise<void>;
    ping?(ws: ServerWebSocket<T>, data: Buffer): void | Promise<void>;
    pong?(ws: ServerWebSocket<T>, data: Buffer): void | Promise<void>;
  }

  export interface Server {
    upgrade(
      request: Request,
      options?: {
        headers?: Record<string, string>;
        data?: any;
      }
    ): boolean;
    publish(topic: string, message: string | ArrayBufferLike | ArrayBufferView): void;
    hostname: string;
    port: number;
  }

  export interface ServeOptions<T = undefined> {
    fetch?: (request: Request, server: Server) => Response | Promise<Response> | undefined | null;
    websocket?: WebSocketHandler<T> & {
      perMessageDeflate?: boolean;
    };
    port?: number;
    hostname?: string;
    development?: boolean;
    tls?: {
      key?: string;
      cert?: string;
    };
  }

  export function serve<T = undefined>(options: ServeOptions<T>): Server;
}

// Add Buffer type for TypeScript
declare interface Buffer extends Uint8Array {
  toString(encoding?: string, start?: number, end?: number): string;
}
