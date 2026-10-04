import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'GameSelector',
    component: () => import('../views/GameSelector.vue')
  },
  {
    path: '/truth-or-dare',
    name: 'TruthOrDareHome',
    component: () => import('../games/truth-or-dare/views/Home.vue')
  },
  {
    path: '/truth-or-dare/local',
    name: 'TruthOrDareLocal',
    component: () => import('../games/truth-or-dare/views/LocalGame.vue')
  },
  {
    path: '/truth-or-dare/room/:id',
    name: 'TruthOrDareRoom',
    component: () => import('../games/truth-or-dare/views/Room.vue')
  },
  {
    path: '/truth-or-dare/tests',
    name: 'TruthOrDareTests',
    component: () => import('../games/truth-or-dare/views/TestTools.vue')
  },
  {
    path: '/flight-chess',
    name: 'FlightChess',
    component: () => import('../games/flight-chess/FlightChess.vue')
  },
  {
    path: '/secret-match',
    name: 'SecretMatch',
    component: () => import('../games/secret-match/SecretMatch.vue')
  },
  {
    path: '/warmup-ladder',
    name: 'WarmupLadder',
    component: () => import('../games/warmup-ladder/WarmupLadder.vue')
  },
  {
    path: '/body-map',
    name: 'BodyMap',
    component: () => import('../games/body-map/BodyMap.vue')
  },
  {
    path: '/power-play',
    name: 'PowerPlay',
    component: () => import('../games/power-play/PowerPlay.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
