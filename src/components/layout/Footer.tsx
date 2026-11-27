export function Footer({ navigate }: { navigate: (to: string) => void }) {
  const link = (label: string, path: string) => (
    <a
      href={path}
      onClick={(e) => {
        e.preventDefault();
        navigate(path);
      }}
      className="text-sm text-[#667085] hover:text-[#132238] transition-colors"
    >
      {label}
    </a>
  );

  return (
    <footer className="bg-white border-t border-[#E6EAF0] mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#E6EAF0]">
          <div className="space-y-3">
            <div className="font-display text-lg font-bold text-[#132238]">ServiceConnect</div>
            <p className="text-sm text-[#667085] leading-relaxed max-w-xs">
              Find trusted local professionals across Nairobi, Mombasa, Kisumu, Nakuru, Eldoret, and expanding African markets.
            </p>
            <p className="text-xs text-[#98A2B3]">
              Default currency: KSh · Africa/Nairobi
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#132238] mb-3">Marketplace</h3>
            <ul className="space-y-2.5">
              <li>{link('Explore Services', '/services')}</li>
              <li>{link('How It Works', '/how-it-works')}</li>
              <li>{link('Become a Provider', '/become-a-provider')}</li>
              <li>{link('Sign In / Register', '/login')}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#132238] mb-3">Company & Support</h3>
            <ul className="space-y-2.5">
              <li>{link('About ServiceConnect', '/about')}</li>
              <li>{link('Help Center & FAQ', '/help')}</li>
              <li>{link('Contact Support', '/contact')}</li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-[#132238] mb-3">Trust & Legal</h3>
            <ul className="space-y-2.5">
              <li>{link('Privacy Policy (Kenya DPA)', '/privacy')}</li>
              <li>{link('Terms of Service', '/terms')}</li>
            </ul>
          </div>
        </div>

        <div className="pt-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-[#98A2B3]">
          <span>© {new Date().getFullYear()} ServiceConnect. All rights reserved.</span>
          <span>Find Trusted Professionals. Get Things Done.</span>
        </div>
      </div>
    </footer>
  );
}
