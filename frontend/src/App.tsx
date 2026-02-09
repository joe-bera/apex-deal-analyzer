import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/upload" element={<UploadDocument />} />
      <Route path="/properties/:id" element={<PropertyDetail />} />
      <Route path="/data-hub" element={<DataHub />} />
      <Route path="/data-hub/:id" element={<MasterPropertyDetail />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/crm/contacts" element={<Contacts />} />
      <Route path="/crm/contacts/:id" element={<ContactDetail />} />
      <Route path="/crm/companies" element={<Companies />} />
      <Route path="/crm/companies/:id" element={<CompanyDetail />} />
      <Route path="/crm/deals" element={<Deals />} />
      <Route path="/crm/deals/:id" element={<DealDetail />} />
      <Route path="/documents/generate" element={<DocumentGenerator />} />
      <Route path="/listing-sites" element={<ListingSites />} />
      <Route path="/prospecting" element={<Prospecting />} />
      <Route path="/campaigns" element={<Campaigns />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/playbooks" element={<Playbooks />} />
      <Route path="/syndication" element={<Syndication />} />
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
