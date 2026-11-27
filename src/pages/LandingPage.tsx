import React, { useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  ShieldCheck,
  ArrowRight,
  ChevronDown,
  Lock,
  MessageSquare,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { GENERATED_IMAGES, KENYA_CITIES, POPULAR_SEARCHES } from '../data/marketplaceSeed.ts';
import { ProviderProfile } from '../types/index.ts';
import { CategoryIcon } from '../components/ui/CategoryIcon.tsx';
import { ImageWithFallback } from '../components/ui/ImageWithFallback.tsx';
import { ProviderCard } from '../components/marketplace/ProviderCard.tsx';
import { generateSafeId } from '../lib/utils.ts';

interface LandingPageProps {
  navigate: (to: string) => void;
  onBookProvider: (provider: ProviderProfile) => void;
}

const FAQS = [
  {
    q: 'How does ServiceConnect verify professionals?',
    a: 'Every professional who applies for verification submits national identification, phone verification, and—where applicable—business registration and trade certificates. An authorized ServiceConnect administrator reviews submissions before granting a Verified badge.',
  },
  {
    q: 'How do bookings and quotations work?',
    a: 'For services with clear fixed or starting prices, you can request a direct booking immediately. For custom repairs or renovations, request a quote so professionals can review your description and send an itemized KSh estimate before you confirm.',
  },
  {
    q: 'How are payments handled?',
    a: 'You can arrange direct settlement with your provider (cash or M-Pesa upon completion). Integrated M-Pesa Daraja STK Push and card gateways are architected for verified rollout once live merchant credentials are configured.',
  },
  {
    q: 'Is my home address visible publicly?',
    a: 'No. Your exact street address and gate details are never shown publicly. Only the city and neighborhood are used for matching, and your exact address is shared exclusively with your chosen provider on a booking.',
  },
];

export function LandingPage({ navigate, onBookProvider }: LandingPageProps) {
  const {
    categories,
    providers,
    reviews,
    getProviderRatingStats,
    isFavorited,
    toggleFavorite,
  } = useMarketplace();
  const { firebaseUser } = useAuth();

  const [queryText, setQueryText] = useState('');
  const [locationText, setLocationText] = useState('');
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [newsletterState, setNewsletterState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  // Only show verified, non-suspended providers in promoted verified section
  const verifiedProviders = useMemo(
    () =>
      providers
        .filter((p) => p.verificationStatus === 'approved' && p.identityVerified && !p.isSuspended)
        .slice(0, 6),
    [providers]
  );

  // Genuine platform statistics — hidden if 0
  const genuineStats = useMemo(() => {
    const verifiedCount = providers.filter(
      (p) => p.verificationStatus === 'approved' && p.identityVerified && !p.isSuspended
    ).length;
    const completedSum = providers.reduce((acc, p) => acc + (p.completedJobsCount || 0), 0);
    const visibleReviews = reviews.filter((r) => !r.isHidden);
    const avgSatisfaction =
      visibleReviews.length > 0
        ? (visibleReviews.reduce((s, r) => s + r.overallRating, 0) / visibleReviews.length).toFixed(1)
        : null;
    const activeCities = new Set(providers.map((p) => p.city).filter(Boolean)).size;

    const items: Array<{ label: string; value: string }> = [];
    if (verifiedCount > 0) items.push({ label: 'Verified Professionals', value: String(verifiedCount) });
    if (completedSum > 0) items.push({ label: 'Completed Bookings', value: String(completedSum) });
    if (avgSatisfaction) items.push({ label: 'Customer Satisfaction', value: `${avgSatisfaction} / 5` });
    if (activeCities > 0) items.push({ label: 'Cities Active', value: String(activeCities) });
    return items;
  }, [providers, reviews]);

  const handleHeroSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (queryText.trim()) params.set('q', queryText.trim());
    if (locationText.trim()) params.set('location', locationText.trim());
    navigate(`/services${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const handleNewsletter = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newsletterEmail.trim().toLowerCase();
    if (!email || !email.includes('@')) return;
    setNewsletterState('saving');
    try {
      await setDoc(doc(db, 'newsletter_subscribers', generateSafeId('sub')), {
        email,
        createdAt: serverTimestamp(),
      });
      setNewsletterState('done');
      setNewsletterEmail('');
    } catch {
      setNewsletterState('error');
    }
  };

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-white border-b border-[#E6EAF0]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#0D9488] mb-3">
                Kenya Local Services Marketplace
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-extrabold tracking-tight text-[#132238] leading-[1.1] max-w-2xl" style={{ textWrap: 'balance' }}>
                Find the Right Professional. Get the Job Done.
              </h1>
              <p className="mt-5 text-base sm:text-lg text-[#667085] leading-relaxed max-w-xl">
                Discover trusted local professionals for your home, business and everyday needs. Compare, connect and book with confidence.
              </p>

              {/* Search Bar */}
              <form
                onSubmit={handleHeroSearch}
                className="mt-8 bg-[#F7F9FC] border border-[#E6EAF0] rounded-2xl p-2 sm:p-2.5 flex flex-col sm:flex-row gap-2"
              >
                <div className="flex-1 flex items-center gap-2.5 bg-white border border-[#E6EAF0] rounded-xl px-3.5 py-2.5">
                  <Search className="w-4 h-4 text-[#98A2B3] shrink-0" aria-hidden="true" />
                  <input
                    type="text"
                    value={queryText}
                    onChange={(e) => setQueryText(e.target.value)}
                    placeholder="Try plumber, electrician, cleaner or mechanic..."
                    aria-label="What service do you need?"
                    className="w-full text-sm text-[#182230] placeholder:text-[#98A2B3] focus:outline-none"
                  />
                </div>
                <div className="sm:w-56 flex items-center gap-2.5 bg-white border border-[#E6EAF0] rounded-xl px-3.5 py-2.5">
                  <MapPin className="w-4 h-4 text-[#98A2B3] shrink-0" aria-hidden="true" />
                  <input
                    type="text"
                    list="kenya-city-suggestions"
                    value={locationText}
                    onChange={(e) => setLocationText(e.target.value)}
                    placeholder="Choose your area..."
                    aria-label="Where do you need it?"
                    className="w-full text-sm text-[#182230] placeholder:text-[#98A2B3] focus:outline-none"
                  />
                  <datalist id="kenya-city-suggestions">
                    {KENYA_CITIES.map((c) => (
                      <option key={c.city} value={c.city} />
                    ))}
                  </datalist>
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] transition-colors whitespace-nowrap shrink-0"
                >
                  Search
                </button>
              </form>

              {/* Popular Searches */}
              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[#667085]">
                <span className="font-medium text-[#182230]">Popular:</span>
                {POPULAR_SEARCHES.map((term, idx) => (
                  <React.Fragment key={term}>
                    <button
                      type="button"
                      onClick={() => navigate(`/services?q=${encodeURIComponent(term)}`)}
                      className="hover:text-[#0D9488] underline decoration-[#E6EAF0] underline-offset-4 transition-colors"
                    >
                      {term}
                    </button>
                    {idx < POPULAR_SEARCHES.length - 1 && (
                      <span aria-hidden="true" className="text-[#98A2B3]">·</span>
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[300px] lg:min-h-[420px] rounded-2xl overflow-hidden border border-[#E6EAF0] relative">
                <ImageWithFallback
                  src={GENERATED_IMAGES.heroServicePro}
                  alt="Electrical technician inspecting a modern residential panel in Nairobi"
                  fallbackLabel="Verified Professionals Across Kenya"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-[#0D1B2A]/85 via-[#0D1B2A]/45 to-transparent text-white">
                  <div className="text-xs font-medium text-[#E6F6F3]">Nairobi · Mombasa · Kisumu · Nakuru · Eldoret</div>
                  <div className="text-sm font-semibold mt-0.5">
                    Transparent profiles, KSh quotations, and admin-reviewed credentials.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Genuine Trust Indicators Strip (only rendered when real data exists) */}
          {genuineStats.length > 0 && (
            <div className="mt-10 pt-8 border-t border-[#E6EAF0] grid grid-cols-2 sm:grid-cols-4 gap-6">
              {genuineStats.map((stat) => (
                <div key={stat.label}>
                  <div className="font-mono-num text-2xl sm:text-3xl font-bold text-[#132238]">
                    {stat.value}
                  </div>
                  <div className="text-xs text-[#667085] mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Popular Service Categories */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#132238]">
              Explore Service Categories
            </h2>
            <p className="text-sm text-[#667085] mt-1.5">
              Browse 16 local service categories configured for residential and commercial needs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/services')}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D9488] hover:text-[#0F766E] whitespace-nowrap"
          >
            View all services
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        {/* Highlighted Photography Strip for Top Visual Categories */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
          {[
            { slug: 'plumbing', title: 'Plumbing & Water Systems', img: GENERATED_IMAGES.plumbing },
            { slug: 'cleaning-services', title: 'Home & Office Cleaning', img: GENERATED_IMAGES.cleaning },
            { slug: 'automotive-services', title: 'Automotive Diagnostics', img: GENERATED_IMAGES.automotive },
            { slug: 'carpentry', title: 'Carpentry & Custom Fitouts', img: GENERATED_IMAGES.renovation },
          ].map((item) => (
            <button
              key={item.slug}
              type="button"
              onClick={() => navigate(`/services/${item.slug}`)}
              className="group relative h-44 rounded-2xl overflow-hidden border border-[#E6EAF0] text-left"
            >
              <ImageWithFallback
                src={item.img}
                alt={item.title}
                fallbackLabel={item.title}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0D1B2A]/85 via-[#0D1B2A]/25 to-transparent flex items-end p-4">
                <span className="font-display text-base font-bold text-white">{item.title}</span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {activeCategories.map((cat) => (
            <button
              key={cat.slug}
              type="button"
              onClick={() => navigate(`/services/${cat.slug}`)}
              className="bg-white border border-[#E6EAF0] rounded-xl p-4 text-left hover:border-[#0D9488] transition-colors duration-150 flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-lg bg-[#E6F6F3] text-[#0D9488] flex items-center justify-center shrink-0">
                <CategoryIcon name={cat.iconName} className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="font-display text-sm font-bold text-[#132238] truncate">
                  {cat.name}
                </div>
                <p className="text-xs text-[#667085] mt-1 line-clamp-2 leading-relaxed">
                  {cat.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Featured Verified Professionals */}
      <section className="bg-white border-y border-[#E6EAF0] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#132238]">
                Verified Professionals
              </h2>
              <p className="text-sm text-[#667085] mt-1.5">
                Only professionals whose identity documents have been reviewed and approved by administrators appear here.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/services?verified=1')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0D9488] hover:text-[#0F766E] whitespace-nowrap"
            >
              Browse verified directory
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {verifiedProviders.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {verifiedProviders.map((prov) => {
                const stats = getProviderRatingStats(prov.uid);
                return (
                  <ProviderCard
                    key={prov.uid}
                    provider={prov}
                    avgRating={stats.avgRating}
                    reviewCount={stats.reviewCount}
                    isFavorited={isFavorited(prov.uid)}
                    onViewProfile={() => navigate(`/providers/${prov.slug}`)}
                    onBook={() => onBookProvider(prov)}
                    onToggleFavorite={() => {
                      if (!firebaseUser) {
                        navigate('/login');
                      } else {
                        void toggleFavorite(prov);
                      }
                    }}
                  />
                );
              })}
            </div>
          ) : (
            <div className="bg-[#F7F9FC] border border-[#E6EAF0] rounded-2xl p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
              <div>
                <h3 className="font-display text-lg font-bold text-[#132238]">
                  Verified marketplace onboarding is open
                </h3>
                <p className="text-sm text-[#667085] mt-1 max-w-2xl">
                  ServiceConnect never fabricates verification badges or sample profiles. Professionals can register and submit documents for admin verification, or customers can browse all active listings.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => navigate('/services')}
                  className="px-4 py-2.5 rounded-lg border border-[#E6EAF0] bg-white text-sm font-semibold text-[#182230] hover:bg-[#F7F9FC]"
                >
                  Explore Directory
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/become-a-provider')}
                  className="px-4 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
                >
                  Apply as a Professional
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="max-w-2xl mb-10">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#132238]">
            How ServiceConnect Works
          </h2>
          <p className="text-sm text-[#667085] mt-2">
            A structured workflow built for clarity from initial search to completed review.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-[#E6EAF0] pt-8">
          {[
            {
              step: '01. Find a professional',
              body: 'Search by service, neighborhood, or describe your issue with Smart Search to filter matching professionals in your city.',
            },
            {
              step: '02. Compare and book',
              body: 'Inspect verified credentials, transparent pricing, and real customer reviews. Book directly at fixed rates or request a custom quotation.',
            },
            {
              step: '03. Get the job done',
              body: 'Coordinate securely via booking-linked messaging, track arrival and completion status, and leave a verified booking review.',
            },
          ].map((item) => (
            <div key={item.step} className="space-y-2.5">
              <h3 className="font-display text-lg font-bold text-[#132238]">{item.step}</h3>
              <p className="text-sm text-[#667085] leading-relaxed">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Protection & Trust Pillars */}
      <section className="bg-[#132238] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
                Built around safety, privacy, and accountability
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Designed in alignment with Kenya&apos;s Data Protection Act and strict marketplace moderation standards.
              </p>
              <button
                type="button"
                onClick={() => navigate('/services')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Try Smart Service Search
              </button>
            </div>
            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[
                {
                  icon: ShieldCheck,
                  title: 'Admin-Reviewed Verification',
                  desc: 'Identity and business documents are inspected manually before any verified badge appears.',
                },
                {
                  icon: Lock,
                  title: 'Private Address Protection',
                  desc: 'Exact street addresses remain private and are shared only with the provider you book.',
                },
                {
                  icon: CheckCircle2,
                  title: 'Verified Booking Reviews',
                  desc: 'Only customers with completed bookings can submit ratings, preventing fake feedback.',
                },
                {
                  icon: MessageSquare,
                  title: 'Structured Dispute Resolution',
                  desc: 'Dedicated dispute tracking and admin mediation when a job does not go as agreed.',
                },
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <div
                    key={p.title}
                    className="p-5 rounded-xl bg-white/5 border border-white/10 space-y-2"
                  >
                    <Icon className="w-5 h-5 text-[#E6F6F3]" aria-hidden="true" />
                    <h3 className="font-display text-base font-bold text-white">{p.title}</h3>
                    <p className="text-xs text-slate-300 leading-relaxed">{p.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Become a Provider CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 sm:p-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#132238]">
              Grow Your Business with ServiceConnect.
            </h2>
            <p className="text-sm text-[#667085] mt-2 leading-relaxed">
              Create your professional profile, publish transparent service listings in KSh, manage bookings and availability, and build verified customer reviews across Kenyan cities.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/become-a-provider')}
            className="px-6 py-3 rounded-lg bg-[#132238] text-white text-sm font-semibold hover:bg-[#0D1B2A] transition-colors whitespace-nowrap shrink-0"
          >
            Join as a Service Provider
          </button>
        </div>
      </section>

      {/* FAQ + Newsletter */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <h2 className="font-display text-2xl font-bold text-[#132238] mb-5">
              Frequently Asked Questions
            </h2>
            <div className="divide-y divide-[#E6EAF0] border-y border-[#E6EAF0]">
              {FAQS.map((item, idx) => (
                <div key={item.q} className="py-4">
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left font-medium text-sm sm:text-base text-[#132238]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-[#667085] shrink-0 transition-transform duration-150 ${
                        openFaq === idx ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {openFaq === idx && (
                    <p className="mt-2.5 text-sm text-[#667085] leading-relaxed">{item.a}</p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8">
              <h3 className="font-display text-xl font-bold text-[#132238]">
                Marketplace updates & city launches
              </h3>
              <p className="text-sm text-[#667085] mt-2 leading-relaxed">
                Receive updates as ServiceConnect expands across Kenyan towns and East African cities.
              </p>
              <form onSubmit={handleNewsletter} className="mt-5 space-y-3">
                <input
                  type="email"
                  required
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address for newsletter"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
                />
                <button
                  type="submit"
                  disabled={newsletterState === 'saving'}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] disabled:opacity-50"
                >
                  {newsletterState === 'saving' ? 'Subscribing...' : 'Subscribe'}
                </button>
                {newsletterState === 'done' && (
                  <p className="text-xs text-[#16A36A]">Subscribed. Thank you for joining ServiceConnect updates.</p>
                )}
                {newsletterState === 'error' && (
                  <p className="text-xs text-[#DC5353]">Could not subscribe right now. Please try again.</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
