declare module "timesync" {
	export type TimeSyncOptions = {
		server?: string
		peers?: string[]
		delay?: number
		interval?: number | null
		timeout?: number
		repeat?: number
		now?: () => number
	}

	export type TimeSyncInstance = {
		now(): number
		sync(): void
		destroy(): void
		on(event: string, callback: (data: unknown) => void): TimeSyncInstance
		off(event: string, callback?: (data: unknown) => void): TimeSyncInstance
		send(to: string, data: unknown, timeout?: number): Promise<unknown>
		receive(from: string, data: unknown): void
		readonly offset: number
		options: TimeSyncOptions
	}

	// The main export is a function that creates a TimeSyncInstance

	export function create(options?: TimeSyncOptions): TimeSyncInstance
}
