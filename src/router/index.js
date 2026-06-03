import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/HomeView.vue')
  },
  {
    path: '/chat/:id',
    name: 'chat',
    component: () => import('../pages/ChatView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginView.vue')
  },
  {
    path: '/friends',
    name: 'friends',
    component: () => import('../pages/FriendsView.vue')
  },
  {
    path: '/dm/:userId',
    name: 'dm',
    component: () => import('../pages/DMView.vue')
  },
  {
    path: '/groups',
    name: 'groups',
    component: () => import('../pages/GroupListView.vue')
  },
  {
    path: '/group/:id',
    name: 'group',
    component: () => import('../pages/GroupChatView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Auth guard — redirect to login if not authenticated for social routes
router.beforeEach((to, from, next) => {
  const publicRoutes = ['/', '/login']
  const socialRoutes = ['/friends', '/groups']
  const socialPrefixes = ['/dm/', '/group/']

  const isSocial = socialRoutes.includes(to.path) ||
    socialPrefixes.some(p => to.path.startsWith(p))

  if (isSocial) {
    const token = localStorage.getItem('bbot_token')
    if (!token) {
      next('/login')
      return
    }
  }
  next()
})

export default router
