import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom';
import { ToastProvider } from './ui/ds';
import { Styleguide } from './ui/Styleguide';

// S0: only the styleguide exists. App screens come after the design-system OK (blueprint §6).
const router = createBrowserRouter([
  { path: '/styleguide', element: <Styleguide /> },
  { path: '*', element: <Navigate to="/styleguide" replace /> },
]);

export default function App() {
  return (
    <ToastProvider>
      <RouterProvider router={router} />
    </ToastProvider>
  );
}
