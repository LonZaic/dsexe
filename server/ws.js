const { WebSocketServer } = require('ws')
const { user, friend, dm, room } = require('./db')

// Track connected clients: userId -> Set<ws>
const clients = new Map()

function setupWebSocket(server) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    let userId = null

    ws.on('message', (raw) => {
      let msg
      try { msg = JSON.parse(raw) } catch { return }

      switch (msg.type) {
        case 'auth': {
          const u = user.findByToken(msg.token)
          if (!u) {
            ws.send(JSON.stringify({ type: 'error', error: '认证失败' }))
            return
          }
          userId = u.id
          user.setStatus(userId, 'online')

          // Track this connection
          if (!clients.has(userId)) clients.set(userId, new Set())
          clients.get(userId).add(ws)

          // Confirm auth
          ws.send(JSON.stringify({ type: 'authed', userId }))

          // Broadcast online status to all connected friends
          broadcastFriendStatus(userId, 'online')

          // Send current online friends to this user
          sendOnlineFriends(userId, ws)
          break
        }

        case 'dm': {
          if (!userId) return
          const { to, text, aiReply } = msg
          // Save to DB
          const result = dm.send(userId, to, text, aiReply || null)
          const message = {
            id: result.lastInsertRowid,
            sender_id: userId,
            receiver_id: to,
            text,
            ai_reply: aiReply || null,
            created_at: new Date().toISOString()
          }
          // Send to recipient if online
          broadcastToUser(to, { type: 'dm', message })
          // Echo back to sender
          ws.send(JSON.stringify({ type: 'dm_sent', message }))
          break
        }

        case 'group_msg': {
          if (!userId) return
          const { roomId, text, isAi } = msg
          room.sendMessage(roomId, isAi ? null : userId, text, isAi || false)
          const members = room.getMembers(roomId)
          const sender = user.findById(userId)
          const message = {
            room_id: roomId,
            sender_id: isAi ? null : userId,
            sender_name: isAi ? 'DS' : (sender?.name || '未知'),
            text,
            is_ai: isAi ? 1 : 0,
            created_at: new Date().toISOString()
          }
          // Broadcast to all room members
          for (const m of members) {
            broadcastToUser(m.id, { type: 'group_msg', message })
          }
          break
        }

        case 'friend_request': {
          if (!userId) return
          const { to } = msg
          broadcastToUser(to, { type: 'friend_request', from: userId, fromName: user.findById(userId)?.name })
          break
        }

        case 'friend_accepted': {
          if (!userId) return
          const { to } = msg
          broadcastToUser(to, {
            type: 'friend_accepted',
            from: userId,
            fromName: user.findById(userId)?.name,
            status: 'online'
          })
          // Also send updated friend list to both
          sendOnlineFriends(userId, ws)
          const toSockets = clients.get(to)
          if (toSockets) {
            for (const s of toSockets) {
              sendOnlineFriends(to, s)
            }
          }
          break
        }

        case 'typing': {
          if (!userId) return
          const { to, roomId } = msg
          if (to) {
            broadcastToUser(to, { type: 'typing', from: userId, fromName: user.findById(userId)?.name })
          } else if (roomId) {
            const members = room.getMembers(roomId)
            for (const m of members) {
              if (m.id !== userId) {
                broadcastToUser(m.id, { type: 'typing', from: userId, fromName: user.findById(userId)?.name, roomId })
              }
            }
          }
          break
        }
      }
    })

    ws.on('close', () => {
      if (userId) {
        // Remove this connection
        const set = clients.get(userId)
        if (set) {
          set.delete(ws)
          if (set.size === 0) {
            clients.delete(userId)
            user.setStatus(userId, 'offline')
            broadcastFriendStatus(userId, 'offline')
          }
        }
      }
    })

    ws.on('error', () => {
      // Handled by close event
    })
  })

  console.log('[WS] WebSocket server ready on /ws')
}

function broadcastToUser(userId, data) {
  const set = clients.get(userId)
  if (!set) return
  const payload = JSON.stringify(data)
  for (const ws of set) {
    if (ws.readyState === 1) {
      ws.send(payload)
    }
  }
}

// Broadcast to all members of a room (group)
function broadcastToRoom(roomId, data) {
  const { room } = require('./db')
  try {
    const members = room.getMembers(roomId)
    for (const m of members) {
      broadcastToUser(m.id, data)
    }
  } catch {}
}

// Broadcast agent progress to all room members
function broadcastAgentEvent(roomId, event) {
  broadcastToRoom(roomId, { type: 'agent_progress', roomId, event })
}

// Broadcast agent final result
function broadcastAgentResult(roomId, result) {
  broadcastToRoom(roomId, { type: 'agent_done', roomId, result })
}

function broadcastFriendStatus(userId, status) {
  const friends = friend.getList(userId)
  for (const f of friends) {
    broadcastToUser(f.id, {
      type: 'friend_status',
      userId,
      status,
      userName: user.findById(userId)?.name
    })
  }
}

function sendOnlineFriends(userId, ws) {
  const friends = friend.getList(userId)
  const onlineFriends = friends.filter(f => f.status === 'online').map(f => f.id)
  ws.send(JSON.stringify({ type: 'online_friends', userIds: onlineFriends }))
}

module.exports = { setupWebSocket, broadcastToUser, broadcastToRoom, broadcastAgentEvent, broadcastAgentResult }
