/**
 * WebSocket endpoint for group code management
 */
import type { APIRoute } from "astro"
import { generateGroupCode } from "../../utils/code-utils"
import type { GroupStateUpdate } from "../../metronome/providers/GroupProvider.svelte"

// Type definitions
type Group = {
	code: string
	members: Set<string> // Set of peerIDs
	leader: string // peerID of the leader
}

// In-memory store for group management
const groups = new Map<string, Group>() // groupCode -> Group
const clients = new Map<string, WebSocket>() // peerID -> WebSocket
const memberToGroup = new Map<string, string>() // peerID -> groupCode

/**
 * Creates a new group with the given code and leader
 */
const createGroup = (code: string, leaderId: string): Group => {
	const group: Group = {
		code,
		members: new Set([leaderId]),
		leader: leaderId,
	}
	groups.set(code, group)
	memberToGroup.set(leaderId, code)
	console.log(`Created new group ${code} with leader ${leaderId}`)
	return group
}

/**
 * Adds a member to an existing group
 */
const addMemberToGroup = (code: string, peerId: string): boolean => {
	const group = groups.get(code)
	if (!group) return false

	group.members.add(peerId)
	memberToGroup.set(peerId, code)
	console.log(
		`Added member ${peerId} to group ${code}. Group size: ${group.members.size}`,
	)
	return true
}

/**
 * Removes a member from their group
 */
const removeMemberFromGroup = (peerId: string): void => {
	const groupCode = memberToGroup.get(peerId)
	if (!groupCode) return

	const group = groups.get(groupCode)
	if (!group) return

	// Remove the member
	group.members.delete(peerId)
	memberToGroup.delete(peerId)

	console.log(
		`Removed member ${peerId} from group ${groupCode}. Group size: ${group.members.size}`,
	)

	// If the group is now empty, remove it
	if (group.members.size === 0) {
		groups.delete(groupCode)
		console.log(`Group ${groupCode} is now empty and has been removed`)
		return
	}

	// If the leader left, assign a new leader
	if (group.leader === peerId) {
		// Pick the first member as the new leader
		const newLeader = Array.from(group.members)[0]

		if (!newLeader) throw new Error("No members left in group")

		group.leader = newLeader
		console.log(`Assigned new leader ${newLeader} for group ${groupCode}`)
	}
}

/**
 * Broadcasts a message to all members in a group
 */
const broadcastToGroup = (
	groupCode: string,
	message: Omit<GroupStateUpdate, "needInitialState">,
	excludePeerId?: string,
): void => {
	const group = groups.get(groupCode)
	if (!group) return

	const messageStr = JSON.stringify(message)

	for (const peerId of group.members) {
		if (excludePeerId && peerId === excludePeerId) continue

		const socket = clients.get(peerId)
		if (socket && socket.readyState === WebSocket.OPEN) {
			socket.send(messageStr)
		}
	}
}

/**
 * Sends group update to all members
 */
const broadcastGroupUpdate = (groupCode: string): void => {
	const group = groups.get(groupCode)
	if (!group) return

	broadcastToGroup(groupCode, {
		type: "groupUpdate",
		groupCode: groupCode,
		members: Array.from(group.members),
		leader: group.leader,
	})
}

/**
 * WebSocket handler for group code management
 */
export const GET: APIRoute = (ctx) => {
	if (ctx.request.headers.get("upgrade") === "websocket") {
		const { response, socket } = ctx.locals.upgradeWebSocket()

		let peerId: string
		let groupCode: string

		socket.onmessage = async (event: MessageEvent<Blob>) => {
			const message = JSON.parse(await event.data.text())
			console.log("Received message:", message)

			if (message.type === "register") {
				peerId = message.peerId

				// Validate peerID
				if (!peerId) {
					throw new Error("peerID not provided")
				}

				// Store the client connection
				clients.set(peerId, socket)

				if (message.groupCode) {
					// Join existing group if it exists
					if (groups.has(message.groupCode)) {
						addMemberToGroup(message.groupCode, peerId)
					} else {
						// Create a new group with the provided code
						createGroup(message.groupCode, peerId)
					}
					groupCode = message.groupCode
				} else {
					// Generate a new unique group code
					let newCode = generateGroupCode()
					const maxAttempts = 10
					let attempts = 0

					// Ensure the code is unique
					while (groups.has(newCode) && attempts < maxAttempts) {
						newCode = generateGroupCode()
						attempts++
					}

					// Create a new group
					createGroup(newCode, peerId)
					groupCode = newCode
				}

				// Broadcast group update to all members
				broadcastGroupUpdate(groupCode)
			}
		}

		// Handle WebSocket close
		socket.onclose = () => {
			console.log(`Client disconnected from ${groupCode}: ${peerId}`)
			removeMemberFromGroup(peerId)
			clients.delete(peerId)
			broadcastGroupUpdate(groupCode)
		}

		// Handle WebSocket errors
		socket.onerror = (error) => {
			console.error(`WebSocket error for client ${peerId}:`, error)
			removeMemberFromGroup(peerId)
			clients.delete(peerId)
			broadcastGroupUpdate(groupCode)
		}

		return response
	}

	return new Response("Upgrade required", { status: 426 })
}
