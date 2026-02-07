import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import PropertyDetail from './pages/PropertyDetail';
import UploadDocument from './pages/UploadDocument';
import DataHub from './pages/DataHub';
import MasterPropertyDetail from './pages/MasterPropertyDetail';
import Settings from './pages/Settings';
import Contacts from './pages/Contacts';
import ContactDetail from './pages/ContactDetail';
import Companies from './pages/Companies';
import CompanyDetail from './pages/CompanyDetail';
import Deals from './pages/Deals';
import DealDetail from './pages/DealDetail';
import DocumentGenerator from './pages/DocumentGenerator';
import ListingSites from './pages/ListingSites';
import PublicListing from './pages/PublicListing';
import Prospecting from './pages/Prospecting';
import Campaigns from './pages/Campaigns';
import Reports from './pages/Reports';
import PublicDealRoom from './pages/PublicDealRoom';
import Playbooks from './pages/Playbooks';
import Syndication from './pages/Syndication';

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
      <Route
        path="/settings"
        element={
          <PrivateRoute>
            <Settings />
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/contacts"
        element={
          <PrivateRoute>
            <Contacts />
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/contacts/:id"
        element={
          <PrivateRoute>
            <ContactDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/companies"
        element={
          <PrivateRoute>
            <Companies />
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/companies/:id"
        element={
          <PrivateRoute>
            <CompanyDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/deals"
        element={
          <PrivateRoute>
            <Deals />
          </PrivateRoute>
        }
      />
      <Route
        path="/crm/deals/:id"
        element={
          <PrivateRoute>
            <DealDetail />
          </PrivateRoute>
        }
      />
      <Route
        path="/documents/generate"
        element={
          <PrivateRoute>
            <DocumentGenerator />
          </PrivateRoute>
        }
      />
      <Route
        path="/listing-sites"
        element={
          <PrivateRoute>
            <ListingSites />
          </PrivateRoute>
        }
      />
      <Route
        path="/prospecting"
        element={
          <PrivateRoute>
            <Prospecting />
          </PrivateRoute>
        }
      />
      <Route
        path="/campaigns"
        element={
          <PrivateRoute>
            <Campaigns />
          </PrivateRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <PrivateRoute>
            <Reports />
          </PrivateRoute>
        }
      />
      <Route
        path="/playbooks"
        element={
          <PrivateRoute>
            <Playbooks />
          </PrivateRoute>
        }
      />
      <Route
        path="/syndication"
        element={
          <PrivateRoute>
            <Syndication />
          </PrivateRoute>
        }
      />
      <Route path="/listing/:slug" element={<PublicListing />} />
      <Route path="/deal-room/:token" element={<PublicDealRoom />} />
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
