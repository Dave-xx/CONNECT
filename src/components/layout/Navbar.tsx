import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.tsx';

interface NavbarProps {
  currentPath: string;
  navigate: (to: string) => void;
}

export function Navbar({ currentPath, navigate }: NavbarProps) {
  const { firebaseUser, account, isAdmin } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardRoute = isAdmin
    ? '/admin/dashboard'
    : account?.role === 'provider'
    ? '/provider/dashboard'
    : '/app/dashboard';

  const navItems = [
    { label: 'Explore Services', path: '/services' },
    { label: 'How It Works', path: '/how-it-works' },
    { label: 'Become a Provider', path: '/become-a-provider' },
    { label: 'About', path: '/about' },
    { label: 'Help', path: '/help' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E6EAF0]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
          }}
          className="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0D9488] rounded-md"
        >
          <span className="w-8 h-8 rounded-lg bg-[#132238] text-white flex items-center justify-center font-bold text-sm tracking-tight">
            SC
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-[#132238]">
            ServiceConnect
          </span>
        </a>

        {/* Zone 2: 5 Single-Line Text Nav Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#667085]" aria-label="Primary navigation">
          {navItems.map((item) => {
            const active = currentPath === item.path || (item.path !== '/' && currentPath.startsWith(item.path));
            return (
              <a
                key={item.path}
                href={item.path}
                onClick={(e) => {
                  e.preventDefault();
                  navigate(item.path);
                }}
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors duration-150 ${
                  active
                    ? 'text-[#132238] border-[#0D9488]'
                    : 'border-transparent hover:text-[#132238] hover:border-[#E6EAF0]'
                }`}
              >
                {item.label}
              </a>
            );
          })}
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => navigate(firebaseUser ? dashboardRoute : '/login')}
            className="hidden sm:inline-flex items-center justify-center px-4 py-2 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0D9488]"
          >
            {firebaseUser ? 'Open Workspace' : 'Get Started'}
          </button>

          <button
            type="button"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setMobileOpen((v) => !v)}
            className="lg:hidden p-2 rounded-lg text-[#182230] hover:bg-[#F7F9FC] transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#E6EAF0] bg-white px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => {
                setMobileOpen(false);
                navigate(item.path);
              }}
              className="block w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium text-[#182230] hover:bg-[#F7F9FC]"
            >
              {item.label}
            </button>
          ))}
          <div className="pt-2 border-t border-[#E6EAF0]">
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                navigate(firebaseUser ? dashboardRoute : '/login');
              }}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
            >
              {firebaseUser ? 'Open Workspace' : 'Sign In / Get Started'}
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
