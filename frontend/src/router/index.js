import { createRouter, createWebHistory } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth.store.js';
import PublicLayout from '../layouts/PublicLayout.vue';
import UserLayout from '../layouts/UserLayout.vue';
import AdminLayout from '../layouts/AdminLayout.vue';

const routes = [
  {
    path: '/',
    component: PublicLayout,
    children: [
      { path: '', name: 'home', component: () => import('../views/home/HomeView.vue') },
      { path: 'photos', name: 'photos', component: () => import('../views/photos/PhotoListView.vue') },
      { path: 'photos/:id', name: 'photo-detail', component: () => import('../views/photos/PhotoDetailView.vue') },
      { path: 'albums', name: 'albums', component: () => import('../views/albums/AlbumListView.vue') },
      { path: 'albums/:id', name: 'album-detail', component: () => import('../views/albums/AlbumDetailView.vue') },
      { path: 'categories/:id?', redirect: '/photos' },
      { path: 'tags/:id?', redirect: (to) => ({ path: '/photos', query: to.params.id ? { tagId: to.params.id } : {} }) },
      { path: 'timeline', name: 'timeline', component: () => import('../views/timeline/TimelineView.vue') },
      { path: 'map', name: 'map', component: () => import('../views/map/MapView.vue') },
      { path: 'search', redirect: (to) => ({ path: '/photos', query: to.query }) },
      { path: 'about', name: 'about', component: () => import('../views/home/AboutView.vue') },
      { path: 'login', name: 'login', component: () => import('../views/auth/LoginView.vue') },
      { path: 'register', name: 'register', component: () => import('../views/auth/RegisterView.vue') },
      { path: '403', name: 'forbidden', component: () => import('../views/home/ForbiddenView.vue') }
    ]
  },
  {
    path: '/user',
    component: UserLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'user-dashboard', component: () => import('../views/user/UserDashboard.vue') },
      { path: 'photos', name: 'my-photos', component: () => import('../views/user/MyPhotos.vue') },
      { path: 'upload', name: 'upload-photo', component: () => import('../views/user/UploadPhoto.vue') },
      { path: 'albums', name: 'my-albums', component: () => import('../views/user/MyAlbums.vue') },
      { path: 'favorites', name: 'my-favorites', component: () => import('../views/user/MyFavorites.vue') },
      { path: 'comments', name: 'my-comments', component: () => import('../views/user/MyComments.vue') },
      { path: 'profile', name: 'profile', component: () => import('../views/user/Profile.vue') },
      { path: 'password', name: 'change-password', component: () => import('../views/user/ChangePassword.vue') }
    ]
  },
  {
    path: '/admin',
    component: AdminLayout,
    meta: { requiresAuth: true, requiresAdmin: true },
    children: [
      { path: '', name: 'admin-dashboard', component: () => import('../views/admin/AdminDashboard.vue') },
      { path: 'users', name: 'admin-users', component: () => import('../views/admin/AdminUsers.vue') },
      { path: 'photos', name: 'admin-photos', component: () => import('../views/admin/AdminPhotos.vue') },
      { path: 'waterfall', name: 'admin-waterfall-order', component: () => import('../views/admin/AdminWaterfallOrder.vue') },
      { path: 'albums', name: 'admin-albums', component: () => import('../views/admin/AdminAlbums.vue') },
      { path: 'categories', redirect: '/admin/tags' },
      { path: 'tags', name: 'admin-tags', component: () => import('../views/admin/AdminTags.vue') },
      { path: 'comments', name: 'admin-comments', component: () => import('../views/admin/AdminComments.vue') },
      { path: 'settings', name: 'admin-settings', component: () => import('../views/admin/AdminSettings.vue') }
    ]
  },
  { path: '/:pathMatch(.*)*', redirect: '/' }
];

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, savedPosition) => savedPosition || { top: 0 }
});

router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  if (to.meta.requiresAuth) {
    const user = await authStore.ensureSession(true);
    if (!user) {
      ElMessage.warning('请先登录');
      return { name: 'login', query: { redirect: to.fullPath } };
    }
  }
  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    ElMessage.warning('请先登录');
    return { name: 'login', query: { redirect: to.fullPath } };
  }
  if (to.meta.requiresAdmin && !authStore.isAdmin) {
    ElMessage.error('没有后台访问权限');
    return { name: 'forbidden' };
  }
  if ((to.name === 'login' || to.name === 'register') && authStore.isLoggedIn) return { name: 'home' };
});

export default router;
