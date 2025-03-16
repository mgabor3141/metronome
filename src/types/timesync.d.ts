declare module 'timesync' {
  interface TimeSyncOptions {
    server?: string;
    peers?: string[];
    delay?: number;
    interval?: number;
    timeout?: number;
    repeat?: number;
    now?: () => number;
  }

  interface TimeSyncInstance {
    now(): number;
    sync(): void;
    destroy(): void;
    on(event: string, callback: (data: any) => void): TimeSyncInstance;
    off(event: string, callback?: (data: any) => void): TimeSyncInstance;
    send(to: string, data: any, timeout?: number): Promise<any>;
    receive(from: string, data: any): void;
    readonly offset: number;
  }

  interface TimeSyncStatic {
    create(options?: TimeSyncOptions): TimeSyncInstance;
  }

  const timesync: TimeSyncStatic;
  export default timesync;
}
