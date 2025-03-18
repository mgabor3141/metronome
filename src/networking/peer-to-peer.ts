import Peer from "peerjs"

export const peer = new Peer()

export const registerPeer = async (): Promise<string> => {
	return new Promise<string>((resolve, reject) => {
		peer.on("open", (id) => {
			console.log(`PeerJS: Registered as ${id}`)
			resolve(id)
		})

		peer.on("error", (err) => {
			console.error("PeerJS error:", err)
			reject(err)
		})
	})
}

export const establishConnections = async (leaderId: string): Promise<void> => {
	const conn = peer.connect(leaderId)

	return new Promise<void>((resolve, reject) => {
		conn.on("open", () => {
			console.log(`PeerJS: Connected to leader ${leaderId}`)
			resolve()
		})

		conn.on("error", (err) => {
			console.error(`PeerJS error: ${err}`)
			reject(err)
		})
	})
}
