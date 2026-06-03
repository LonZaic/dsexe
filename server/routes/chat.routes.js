// ══════════════════════════════════════
// Chat Routes — Users, Friends, DMs, Groups
// ══════════════════════════════════════

const { Router } = require('express')
const { authRequired } = require('../auth')
const ctrl = require('../controllers/chat.controller')

const router = Router()

// Users
router.get('/users/search', authRequired, ctrl.searchUsers)
router.get('/users/online', authRequired, ctrl.onlineUsers)

// Friends
router.get('/friends', authRequired, ctrl.getFriends)
router.post('/friends/add', authRequired, ctrl.addFriend)
router.post('/friends/accept', authRequired, ctrl.acceptFriend)
router.post('/friends/reject', authRequired, ctrl.rejectFriend)
router.delete('/friends/:friendId', authRequired, ctrl.removeFriend)

// DMs
router.get('/dm/:friendId', authRequired, ctrl.getDmMessages)
router.post('/dm/:friendId', authRequired, ctrl.sendDmMessage)

// Groups
router.get('/groups', authRequired, ctrl.getUserGroups)
router.get('/groups/all', authRequired, ctrl.getAllGroups)
router.post('/groups', authRequired, ctrl.createGroup)
router.post('/groups/join', authRequired, ctrl.joinGroup)
router.get('/groups/:id', authRequired, ctrl.getGroupDetail)
router.get('/groups/:id/messages', authRequired, ctrl.getGroupMessages)
router.post('/groups/:id/leave', authRequired, ctrl.leaveGroup)

module.exports = router
