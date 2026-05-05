import { createRouter, createWebHashHistory } from 'vue-router';
import LoginView from './views/LoginView.vue';
import ProductsView from './views/ProductsView.vue';
import ProductEditView from './views/ProductEditView.vue';
import DashboardView from './views/DashboardView.vue';
import ImportView from './views/ImportView.vue';
import UsersView from './views/UsersView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', redirect: '/products' },
    { path: '/login', name: 'login', component: LoginView, meta: { public: true } },
    { path: '/products', name: 'products', component: ProductsView },
    { path: '/products/new', name: 'product-new', component: ProductEditView, props: () => ({ productId: null }) },
    { path: '/products/:id/edit', name: 'product-edit', component: ProductEditView, props: (r) => ({ productId: r.params.id }) },
    { path: '/users', name: 'users', component: UsersView },
    { path: '/dashboard', name: 'dashboard', component: DashboardView },
    { path: '/import', name: 'import', component: ImportView },
  ],
});

router.beforeEach((to) => {
  if (to.meta.public) return true;
  const t = localStorage.getItem('zhili_admin_token');
  if (!t) return { name: 'login', query: { redirect: to.fullPath } };
  return true;
});

export default router;
