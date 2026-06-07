import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/HomeView.vue')
  },
  {
    path: '/agent',
    name: 'agent',
    component: () => import('../pages/AgentView.vue')
  },
  {
    path: '/code',
    name: 'code',
    component: () => import('../pages/CodeView.vue')
  },
  {
    path: '/chat/:id',
    name: 'chat',
    component: () => import('../pages/HomeView.vue')
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../pages/LoginView.vue')
  },
  {
    path: '/social',
    name: 'social',
    component: () => import('../pages/SocialView.vue')
  },
  { path: '/friends', redirect: '/social' },
  { path: '/groups', redirect: '/social' },
  {
    path: '/dm/:userId',
    name: 'dm',
    component: () => import('../pages/DMView.vue')
  },
  {
    path: '/group/:id',
    name: 'group',
    component: () => import('../pages/GroupChatView.vue')
  },
  {
    path: '/collections',
    name: 'collections',
    component: () => import('../pages/CollectionsView.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Auth guard — redirect to login if not authenticated for social routes
router.beforeEach((to, from, next) => {
  const publicRoutes = ['/', '/login']
  const socialRoutes = ['/social', '/friends', '/groups']
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
