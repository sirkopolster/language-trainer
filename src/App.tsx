import { useEffect, useState } from 'react';
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './storage/supabaseRepository';
import { ToastProvider } from './ui/ds';
import { ErrorBoundary, RouteError } from './ui/ErrorScreen';
import { Styleguide } from './ui/Styleguide';
import { Login } from './ui/features/auth/Login';
import { Home } from './ui/features/home/Home';
import { ProfileScreen } from './ui/features/profile/ProfileScreen';
import { TestScreen } from './ui/features/test/TestScreen';
import { ReviewScreen } from './ui/features/review/ReviewScreen';
import { LearnScreen } from './ui/features/learn/LearnScreen';
import { LessonScreen } from './ui/features/learn/LessonScreen';

const router = createBrowserRouter([
  { path: '/', element: <Home />, errorElement: <RouteError /> },
  { path: '/p/:profileId', element: <ProfileScreen />, errorElement: <RouteError /> },
  { path: '/t/:testId', element: <TestScreen />, errorElement: <RouteError /> },
  { path: '/t/:testId/review', element: <ReviewScreen />, errorElement: <RouteError /> },
  { path: '/t/:testId/learn', element: <LearnScreen />, errorElement: <RouteError /> },
  { path: '/t/:testId/lesson/:unitId/:n', element: <LessonScreen />, errorElement: <RouteError /> },
  { path: '/styleguide', element: <Styleguide /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setTimeout(() => setSession(s), 0));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return null;
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  return (
    <ErrorBoundary>
      <ToastProvider>
        {!session && path !== '/styleguide' ? <Login /> : <RouterProvider router={router} />}
      </ToastProvider>
    </ErrorBoundary>
  );
}
