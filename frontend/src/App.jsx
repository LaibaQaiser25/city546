import { lazy, Suspense } from 'react';
import { Toaster } from 'react-hot-toast';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import PublicLayout from './layouts/PublicLayout';
import { CategoryPage, LatestPage, SearchPage } from './pages/FeedPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import PostDetailPage from './pages/PostDetailPage';
import { PageSpinner } from './components/ui/States';

// Admin code is split into its own chunk — public readers never download it.
const AdminLayout = lazy(() => import('./layouts/AdminLayout'));
const DashboardPage = lazy(() => import('./pages/admin/DashboardPage'));
const ManagePostsPage = lazy(() => import('./pages/admin/ManagePostsPage'));
const CreatePostPage = lazy(() => import('./pages/admin/PostEditorPages').then((m) => ({ default: m.CreatePostPage })));
const AIStylePage = lazy(() => import('./pages/admin/AIStylePage'));
const EditPostPage = lazy(() => import('./pages/admin/PostEditorPages').then((m) => ({ default: m.EditPostPage })));

const withSuspense = (element) => <Suspense fallback={<PageSpinner />}>{element}</Suspense>;

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/latest', element: <LatestPage /> },
      { path: '/category/:slug', element: <CategoryPage /> },
      { path: '/search', element: <SearchPage /> },
      { path: '/news/:id', element: <PostDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '/admin/login', element: <LoginPage /> },
  {
    path: '/admin',
    element: <ProtectedRoute />,
    children: [
      {
        element: withSuspense(<AdminLayout />),
        children: [
          { index: true, element: withSuspense(<DashboardPage />) },
          { path: 'posts', element: withSuspense(<ManagePostsPage />) },
          { path: 'posts/new', element: withSuspense(<CreatePostPage />) },
          { path: 'posts/:id/edit', element: withSuspense(<EditPostPage />) },
          { path: 'ai-style', element: withSuspense(<AIStylePage />) },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
        <Toaster
          position="top-center"
          gutter={10}
          toastOptions={{
            duration: 3500,
            className: '!rounded-xl !bg-navy-900 !px-4 !py-3 !text-sm !font-medium !text-white !shadow-xl dark:!bg-white dark:!text-navy-900',
            success: { iconTheme: { primary: '#d4a93d', secondary: '#0c1a3d' } },
            error: { iconTheme: { primary: '#e11d2e', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
