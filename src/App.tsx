import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './auth/ProtectedRoute';
import OfflineBanner from './components/OfflineBanner';

const AuthPage = lazy(() => import('./pages/AuthPage'));
const HomePage = lazy(() => import('./pages/HomePage'));
const LessonPage = lazy(() => import('./pages/LessonPage'));

function PageFallback() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-center text-sm text-muted">
      Loading...
    </div>
  );
}

export default function App() {
  return (
    <>
      <OfflineBanner />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <HomePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/lesson/:lessonId"
            element={
              <ProtectedRoute>
                <LessonPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}
