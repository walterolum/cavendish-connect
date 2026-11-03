import { lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './scroll-to-top';
import { AppLayout, AuthLayout, PasswordGate, PublicLayout, RequireAdmin, RequireAuth } from '../components/layout/layouts';

// Each page is its own chunk, so the first load only ships what the visitor sees.
const HomePage = lazy(() => import('../pages/home/HomePage'));
const ExplorePage = lazy(() => import('../pages/explore/ExplorePage'));
const MarketLayout = lazy(() => import('../components/market/MarketLayout'));
const MarketHomePage = lazy(() => import('../pages/marketplace/MarketHomePage'));
const MarketplacePage = lazy(() => import('../pages/marketplace/MarketplacePage'));
const ListingDetailPage = lazy(() => import('../pages/marketplace/ListingDetailPage'));
const CreateListingPage = lazy(() => import('../pages/marketplace/CreateListingPage'));
const ServicesLayout = lazy(() => import('../components/services/ServicesLayout'));
const ServicesHomePage = lazy(() => import('../pages/services/ServicesHomePage'));
const ServicesPage = lazy(() => import('../pages/services/ServicesPage'));
const ServiceDetailPage = lazy(() => import('../pages/services/ServiceDetailPage'));
const CreateServicePage = lazy(() => import('../pages/services/CreateServicePage'));
const StaysHomePage = lazy(() => import('../pages/accommodation/StaysHomePage'));
const AccommodationPage = lazy(() => import('../pages/accommodation/AccommodationPage'));
const PropertyDetailPage = lazy(() => import('../pages/accommodation/PropertyDetailPage'));
const CreateAccommodationPage = lazy(() => import('../pages/accommodation/CreateAccommodationPage'));
const PostPage = lazy(() => import('../pages/post/PostPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const ProfilePage = lazy(() => import('../pages/profile/ProfilePage'));
const FavoritesPage = lazy(() => import('../pages/profile/FavoritesPage'));
const NotificationsPage = lazy(() => import('../pages/profile/NotificationsPage'));
const MessagesPage = lazy(() => import('../pages/messages/MessagesPage'));
const ConversationPage = lazy(() => import('../pages/messages/ConversationPage'));
const Login = lazy(() => import('../pages/auth/Login'));
const Register = lazy(() => import('../pages/auth/Register'));
const SetPasswordPage = lazy(() => import('../pages/auth/SetPasswordPage'));
const HelpPage = lazy(() => import('../pages/misc/HelpPage'));
const OrdersPage = lazy(() => import('../pages/orders/OrdersPage'));
const NotFoundPage = lazy(() => import('../pages/misc/NotFoundPage'));

const AdminLayout = lazy(() => import('../components/admin/AdminLayout'));
const AdminDashboard = lazy(() => import('../pages/admin/AdminDashboard'));
const AdminUsers = lazy(() => import('../pages/admin/AdminUsers'));
const AdminListings = lazy(() => import('../pages/admin/AdminListings'));
const AdminReports = lazy(() => import('../pages/admin/AdminReports'));
const AdminVerifications = lazy(() => import('../pages/admin/AdminVerifications'));
const AdminSettings = lazy(() => import('../pages/admin/AdminSettings'));
const AdminAuditLogs = lazy(() => import('../pages/admin/AdminAuditLogs'));
const AdminEvents = lazy(() => import('../pages/admin/AdminEvents'));
const AdminAppearance = lazy(() => import('../pages/admin/AdminAppearance'));

export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <PasswordGate />
      <Routes>
        {/* Services Hub: same navy-sidebar shell as the market */}
        <Route path="services" element={<ServicesLayout />}>
          <Route index element={<ServicesHomePage />} />
          <Route path="browse" element={<ServicesPage />} />
          <Route element={<RequireAuth />}>
            <Route path="create" element={<CreateServicePage />} />
            <Route path=":slug/edit" element={<CreateServicePage />} />
          </Route>
          <Route path=":slug" element={<ServiceDetailPage />} />
        </Route>

        {/* Campus Market: its own shell with the navy sidebar */}
        <Route path="marketplace" element={<MarketLayout />}>
          <Route index element={<MarketHomePage />} />
          <Route path="browse" element={<MarketplacePage />} />
          <Route path="my-listings" element={<Navigate to="/dashboard?tab=listings" replace />} />
          <Route element={<RequireAuth />}>
            <Route path="create" element={<CreateListingPage />} />
            <Route path=":slug/edit" element={<CreateListingPage />} />
          </Route>
          <Route path=":slug" element={<ListingDetailPage />} />
        </Route>

        {/* Public site */}
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="explore" element={<ExplorePage />} />

          <Route path="accommodation" element={<StaysHomePage />} />
          <Route path="accommodation/search" element={<AccommodationPage />} />
          <Route path="help" element={<HelpPage />} />

          {/* Signed-in only */}
          <Route element={<RequireAuth />}>
            <Route path="post" element={<PostPage />} />
            <Route path="accommodation/create" element={<CreateAccommodationPage />} />
            <Route path="accommodation/:slug/edit" element={<CreateAccommodationPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="orders" element={<OrdersPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="favorites" element={<FavoritesPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="messages" element={<MessagesPage />} />
          </Route>

          <Route path="accommodation/:slug" element={<PropertyDetailPage />} />

          {/* Old links keep working */}
          <Route path="my-listings" element={<Navigate to="/dashboard" replace />} />

          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Full-height chat */}
        <Route element={<AppLayout />}>
          <Route element={<RequireAuth />}>
            <Route path="messages/:id" element={<ConversationPage />} />
          </Route>
        </Route>

        {/* Focused sign-in and account screens */}
        <Route element={<AuthLayout />}>
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
          <Route path="set-password" element={<SetPasswordPage />} />
        </Route>

        {/* Admin console */}
        <Route
          path="admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="reports" element={<AdminReports />} />
          <Route path="verification" element={<AdminVerifications />} />
          <Route path="appearance" element={<AdminAppearance />} />
          <Route path="events" element={<AdminEvents />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="audit-logs" element={<AdminAuditLogs />} />
        </Route>
      </Routes>
    </>
  );
}
