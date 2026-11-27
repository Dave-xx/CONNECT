import { useState } from 'react';
import { ShieldAlert, Lock } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { MarketplaceProvider, useMarketplace } from './context/MarketplaceContext.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { Navbar } from './components/layout/Navbar.tsx';
import { Footer } from './components/layout/Footer.tsx';
import { BookingModal } from './components/marketplace/BookingModal.tsx';
import { useRouter } from './hooks/useRouter.ts';
import { ProviderProfile, ServiceListing } from './types/index.ts';

import { LandingPage } from './pages/LandingPage.tsx';
import { ServicesDiscoveryPage } from './pages/ServicesDiscoveryPage.tsx';
import { ProviderProfilePage } from './pages/ProviderProfilePage.tsx';
import {
  AboutPage,
  BecomeProviderPage,
  ContactPage,
  HelpPage,
  HowItWorksPage,
  LegalPage,
} from './pages/StaticPages.tsx';
import { AuthPages } from './pages/AuthPages.tsx';
import { CustomerDashboard } from './pages/CustomerDashboard.tsx';
import { ProviderDashboard } from './pages/ProviderDashboard.tsx';
import { AdminDashboard } from './pages/AdminDashboard.tsx';

interface BookingModalState {
  provider: ProviderProfile;
  initialService?: ServiceListing | null;
  initialMode?: 'direct' | 'quote';
}

function AppShell() {
  const { pathname, searchParams, navigate } = useRouter();
  const { firebaseUser, account, isAdmin, loading, signOut } = useAuth();
  const { providers } = useMarketplace();
  const [bookingModal, setBookingModal] = useState<BookingModalState | null>(null);
  const [bookingToast, setBookingToast] = useState<string | null>(null);

  const openBookingForProvider = (
    provider: ProviderProfile,
    initialService: ServiceListing | null = null,
    initialMode: 'direct' | 'quote' = 'direct'
  ) => {
    setBookingModal({ provider, initialService, initialMode });
  };

  const openBookingByProviderId = (
    providerId: string,
    service: ServiceListing | null,
    mode: 'direct' | 'quote'
  ) => {
    const provider = providers.find((p) => p.uid === providerId);
    if (!provider) return;
    setBookingModal({ provider, initialService: service, initialMode: mode });
  };

  const isWorkspaceRoute =
    pathname.startsWith('/app') ||
    pathname.startsWith('/provider') ||
    pathname.startsWith('/admin');

  const isAuthRoute = pathname === '/login' || pathname === '/register';

  const renderSuspendedGate = () => (
    <div className="max-w-lg mx-auto my-20 px-4">
      <div className="bg-white border border-[#DC5353]/30 rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#DC5353]/10 text-[#DC5353] flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-[#132238]">Account Suspended</h1>
        <p className="text-sm text-[#667085] leading-relaxed">
          Your ServiceConnect account has been suspended by an administrator. If you believe this is an error, please contact support.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/contact')}
            className="px-4 py-2 rounded-lg bg-[#132238] text-white text-sm font-semibold"
          >
            Contact Support
          </button>
          <button
            type="button"
            onClick={() => void signOut()}
            className="px-4 py-2 rounded-lg border border-[#E6EAF0] text-sm font-semibold text-[#667085]"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );

  const renderAuthGate = (title: string, subtitle: string) => (
    <div className="max-w-lg mx-auto my-20 px-4">
      <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-xl bg-[#E6F6F3] text-[#0D9488] flex items-center justify-center mx-auto">
          <Lock className="w-6 h-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-[#132238]">{title}</h1>
        <p className="text-sm text-[#667085] leading-relaxed">{subtitle}</p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="px-5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm font-semibold text-[#182230]"
          >
            Explore Services
          </button>
        </div>
      </div>
    </div>
  );

  const renderRoute = () => {
    if (loading && isWorkspaceRoute) {
      return (
        <div className="max-w-7xl mx-auto px-4 py-20 text-center text-sm text-[#667085]">
          Loading your workspace...
        </div>
      );
    }

    if (account?.isSuspended && isWorkspaceRoute) {
      return renderSuspendedGate();
    }

    // Public routes
    if (pathname === '/' || pathname === '') {
      return (
        <LandingPage
          navigate={navigate}
          onBookProvider={(p) => openBookingForProvider(p)}
        />
      );
    }

    if (pathname === '/services' || pathname.startsWith('/services/')) {
      const categorySlug = pathname.startsWith('/services/')
        ? decodeURIComponent(pathname.replace('/services/', '').split('/')[0])
        : undefined;
      return (
        <ServicesDiscoveryPage
          categoryParam={categorySlug}
          searchParams={searchParams}
          navigate={navigate}
          onBookProvider={(p) => openBookingForProvider(p)}
        />
      );
    }

    if (pathname.startsWith('/providers/')) {
      const slug = decodeURIComponent(pathname.replace('/providers/', '').split('/')[0]);
      return (
        <ProviderProfilePage
          slug={slug}
          navigate={navigate}
          onBookService={openBookingByProviderId}
        />
      );
    }

    if (pathname === '/how-it-works') return <HowItWorksPage navigate={navigate} />;
    if (pathname === '/become-a-provider') return <BecomeProviderPage navigate={navigate} />;
    if (pathname === '/about') return <AboutPage navigate={navigate} />;
    if (pathname === '/contact') return <ContactPage />;
    if (pathname === '/help') return <HelpPage navigate={navigate} />;
    if (pathname === '/privacy') return <LegalPage type="privacy" />;
    if (pathname === '/terms') return <LegalPage type="terms" />;
    if (pathname === '/login') {
      return <AuthPages mode="login" searchParams={searchParams} navigate={navigate} />;
    }
    if (pathname === '/register') {
      return <AuthPages mode="register" searchParams={searchParams} navigate={navigate} />;
    }

    // Customer Workspace
    if (pathname === '/app' || pathname.startsWith('/app/')) {
      if (!firebaseUser) {
        return renderAuthGate(
          'Sign in to open your workspace',
          'Access your service bookings, saved professionals, quotations, and messages.'
        );
      }
      const subPath = pathname === '/app' ? '/app/dashboard' : pathname;
      return (
        <CustomerDashboard
          subPath={subPath}
          navigate={navigate}
          onBookProvider={(p) => openBookingForProvider(p)}
        />
      );
    }

    // Provider Workspace
    if (pathname === '/provider' || pathname.startsWith('/provider/')) {
      if (!firebaseUser) {
        return renderAuthGate(
          'Sign in to access Provider Studio',
          'Manage your professional profile, verification documents, service listings, and customer bookings.'
        );
      }
      if (account?.role !== 'provider' && !isAdmin) {
        return (
          <div className="max-w-lg mx-auto my-20 px-4">
            <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center space-y-4">
              <h1 className="font-display text-xl font-bold text-[#132238]">
                Provider Account Required
              </h1>
              <p className="text-sm text-[#667085] leading-relaxed">
                You are currently signed in with a Customer profile. Complete provider onboarding to list services and accept bookings.
              </p>
              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => navigate('/register?role=provider')}
                  className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
                >
                  Become a Provider
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/app/dashboard')}
                  className="px-5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm font-semibold text-[#182230]"
                >
                  Back to Customer Workspace
                </button>
              </div>
            </div>
          </div>
        );
      }
      const subPath = pathname === '/provider' ? '/provider/dashboard' : pathname;
      return <ProviderDashboard subPath={subPath} navigate={navigate} />;
    }

    // Admin Workspace
    if (pathname === '/admin' || pathname.startsWith('/admin/')) {
      if (!firebaseUser || !isAdmin) {
        return renderAuthGate(
          'Administrator Access Required',
          'This section is restricted to authorized ServiceConnect platform administrators.'
        );
      }
      const subPath = pathname === '/admin' ? '/admin/dashboard' : pathname;
      return <AdminDashboard subPath={subPath} navigate={navigate} />;
    }

    // Fallback 404
    return (
      <div className="max-w-lg mx-auto my-24 px-4 text-center space-y-4">
        <div className="font-mono-num text-sm font-bold text-[#0D9488]">404</div>
        <h1 className="font-display text-2xl font-bold text-[#132238]">Page not found</h1>
        <p className="text-sm text-[#667085]">
          The page you are looking for does not exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold"
          >
            Go Home
          </button>
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="px-5 py-2.5 rounded-lg border border-[#E6EAF0] bg-white text-sm font-semibold text-[#182230]"
          >
            Browse Services
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F9FC] text-[#182230]">
      <Navbar currentPath={pathname} navigate={navigate} />

      {bookingToast && (
        <div className="bg-[#16A36A] text-white text-xs sm:text-sm py-2.5 px-4 text-center font-medium">
          <span>Booking request {bookingToast} recorded. </span>
          <button
            type="button"
            onClick={() => {
              setBookingToast(null);
              navigate('/app/bookings');
            }}
            className="underline font-semibold ml-1"
          >
            View in My Bookings
          </button>
          <button
            type="button"
            onClick={() => setBookingToast(null)}
            className="ml-4 opacity-80 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      <main className="flex-1">{renderRoute()}</main>

      {!isWorkspaceRoute && !isAuthRoute && <Footer navigate={navigate} />}

      {bookingModal && (
        <BookingModal
          provider={bookingModal.provider}
          initialService={bookingModal.initialService}
          initialMode={bookingModal.initialMode}
          onClose={() => setBookingModal(null)}
          onSuccess={(ref) => setBookingToast(ref)}
          onRequireLogin={() => {
            setBookingModal(null);
            navigate('/login');
          }}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <MarketplaceProvider>
          <AppShell />
        </MarketplaceProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
