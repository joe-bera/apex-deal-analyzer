import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import PropertyDetail from './pages/PropertyDetail';
import UploadDocument from './pages/UploadDocument';
import DataHub from './pages/DataHub';
import MasterPropertyDetail from './pages/MasterPropertyDetail';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/upload"
        element={
          <PrivateRoute>
            <UploadDocument />
          </PrivateRoute>
        }
      />
      <Route
        path="/properties/:id"
        element={
          <PrivateRoute>
            <PropertyDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/data-hub"
        element={
          <PrivateRoute>
            <DataHub />
          </PrivateRoute>
        }
      />
      <Route
        path="/data-hub/:id"
        element={
          <PrivateRoute>
            <MasterPropertyDetail />
          </PrivateRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
