import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  MapPin,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  ShieldCheck,
  Map as MapIcon,
  X,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { KENYA_CITIES } from '../data/marketplaceSeed.ts';
import { ProviderProfile, SmartSearchIntent } from '../types/index.ts';
import { ProviderCard } from '../components/marketplace/ProviderCard.tsx';

interface ServicesDiscoveryPageProps {
  categoryParam?: string;
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
  onBookProvider: (provider: ProviderProfile) => void;
}

export function ServicesDiscoveryPage({
  categoryParam,
  searchParams,
  navigate,
  onBookProvider,
}: ServicesDiscoveryPageProps) {
  const {
    categories,
    providers,
    services,
    loadingPublic,
    getProviderRatingStats,
    isFavorited,
    toggleFavorite,
  } = useMarketplace();
  const { firebaseUser } = useAuth();

  const [queryText, setQueryText] = useState(searchParams.get('q') || '');
  const [debouncedQuery, setDebouncedQuery] = useState(searchParams.get('q') || '');
  const [selectedCategory, setSelectedCategory] = useState(categoryParam || searchParams.get('category') || '');
  const [selectedCity, setSelectedCity] = useState(searchParams.get('location') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(searchParams.get('verified') === '1');
  const [availableTodayOnly, setAvailableTodayOnly] = useState(false);
  const [emergencyOnly, setEmergencyOnly] = useState(false);
  const [providerType, setProviderType] = useState<'all' | 'individual' | 'business'>('all');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [minRating, setMinRating] = useState<number>(0);
  const [sortBy, setSortBy] = useState<'relevance' | 'rating' | 'reviews' | 'price_asc' | 'price_desc'>('relevance');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [showAreaCoverage, setShowAreaCoverage] = useState(false);

  // AI Smart Search State
  const [aiQuery, setAiQuery] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<SmartSearchIntent | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('sc_recent_searches');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    if (categoryParam !== undefined) {
      setSelectedCategory(categoryParam);
    }
  }, [categoryParam]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(queryText);
      if (queryText.trim().length >= 3) {
        setRecentSearches((prev) => {
          const next = [queryText.trim(), ...prev.filter((item) => item !== queryText.trim())].slice(0, 5);
          try {
            localStorage.setItem('sc_recent_searches', JSON.stringify(next));
          } catch {
            // ignore storage errors
          }
          return next;
        });
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [queryText]);

  const activeCategories = useMemo(
    () => categories.filter((c) => c.isActive).sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const runSmartSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch('/api/ai/smart-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: aiQuery.trim(),
          categories: activeCategories.map((c) => ({ slug: c.slug, name: c.name })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAiError(data.error || 'Could not interpret search right now.');
      } else {
        setAiResult(data);
        if (data.categorySlug) setSelectedCategory(data.categorySlug);
        if (data.location) setSelectedCity(data.location);
        if (data.availableTodayOnly) setAvailableTodayOnly(true);
        if (data.emergencyOnly) setEmergencyOnly(true);
        if (Array.isArray(data.keywords) && data.keywords.length && !data.categorySlug) {
          setQueryText(data.keywords.join(' '));
        }
      }
    } catch {
      setAiError('Network error while analyzing your request. Standard filters remain active.');
    } finally {
      setAiLoading(false);
    }
  };

  const filteredProviders = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    const loc = selectedCity.trim().toLowerCase();
    const maxP = maxPrice ? Number(maxPrice) : null;

    const list = providers.filter((p) => {
      if (p.isSuspended) return false;
      if (verifiedOnly && !(p.verificationStatus === 'approved' && p.identityVerified)) return false;
      if (availableTodayOnly && !p.availableToday) return false;
      if (emergencyOnly && !p.emergencyAvailable) return false;
      if (providerType !== 'all' && p.providerType !== providerType) return false;

      if (selectedCategory) {
        const hasCat = (p.categories || []).includes(selectedCategory);
        const hasServiceInCat = services.some(
          (s) => s.providerId === p.uid && s.status === 'active' && s.categorySlug === selectedCategory
        );
        if (!hasCat && !hasServiceInCat) return false;
      }

      if (loc) {
        const cityMatch = p.city.toLowerCase().includes(loc);
        const areaMatch = (p.serviceAreas || []).some((a) => a.toLowerCase().includes(loc));
        if (!cityMatch && !areaMatch) return false;
      }

      if (maxP && Number.isFinite(maxP)) {
        const minProviderPrice = p.startingPrice || 0;
        if (minProviderPrice > maxP) return false;
      }

      const ratingStats = getProviderRatingStats(p.uid);
      if (minRating > 0 && ratingStats.avgRating < minRating) return false;

      if (q) {
        const provServices = services.filter((s) => s.providerId === p.uid && s.status === 'active');
        const haystack = [
          p.displayName,
          p.businessName || '',
          p.bio || '',
          p.city,
          ...(p.serviceAreas || []),
          ...(p.categories || []),
          ...provServices.map((s) => `${s.title} ${s.description} ${s.categoryName}`),
        ]
          .join(' ')
          .toLowerCase();
        const terms = q.split(/\s+/).filter(Boolean);
        if (!terms.every((t) => haystack.includes(t))) return false;
      }

      return true;
    });

    return [...list].sort((a, b) => {
      const ra = getProviderRatingStats(a.uid);
      const rb = getProviderRatingStats(b.uid);
      if (sortBy === 'rating') return rb.avgRating - ra.avgRating;
      if (sortBy === 'reviews') return rb.reviewCount - ra.reviewCount;
      if (sortBy === 'price_asc') return (a.startingPrice || 999999) - (b.startingPrice || 999999);
      if (sortBy === 'price_desc') return (b.startingPrice || 0) - (a.startingPrice || 0);
      // Relevance: Verified first, then sponsored (only if verified or active), then rating
      const aScore = (a.verificationStatus === 'approved' ? 10 : 0) + (a.isSponsored ? 3 : 0) + ra.avgRating;
      const bScore = (b.verificationStatus === 'approved' ? 10 : 0) + (b.isSponsored ? 3 : 0) + rb.avgRating;
      return bScore - aScore;
    });
  }, [
    providers,
    services,
    debouncedQuery,
    selectedCategory,
    selectedCity,
    verifiedOnly,
    availableTodayOnly,
    emergencyOnly,
    providerType,
    maxPrice,
    minRating,
    sortBy,
    getProviderRatingStats,
  ]);

  const clearFilters = () => {
    setQueryText('');
    setSelectedCategory('');
    setSelectedCity('');
    setVerifiedOnly(false);
    setAvailableTodayOnly(false);
    setEmergencyOnly(false);
    setProviderType('all');
    setMaxPrice('');
    setMinRating(0);
    setAiResult(null);
    if (categoryParam) navigate('/services');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Header & AI Smart Search */}
      <div className="mb-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-[#132238]">
              {selectedCategory
                ? activeCategories.find((c) => c.slug === selectedCategory)?.name || 'Explore Services'
                : 'Explore Local Professionals'}
            </h1>
            <p className="text-sm text-[#667085] mt-1">
              Search real registered professionals by trade, neighborhood, rating, and availability.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAreaCoverage((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#E6EAF0] bg-white text-sm font-medium text-[#182230] hover:bg-[#F7F9FC] self-start"
          >
            <MapIcon className="w-4 h-4 text-[#0D9488]" />
            {showAreaCoverage ? 'Hide Area Coverage' : 'View Service Areas'}
          </button>
        </div>

        {/* ServiceConnect Intelligence Assistant */}
        <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
          <form onSubmit={runSmartSearch} className="flex flex-col md:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0]">
              <Sparkles className="w-4 h-4 text-[#0D9488] shrink-0" />
              <input
                type="text"
                value={aiQuery}
                onChange={(e) => setAiQuery(e.target.value)}
                placeholder="Describe what you need: e.g., My kitchen sink is leaking and I need someone in Westlands today"
                className="w-full bg-transparent text-sm text-[#182230] placeholder:text-[#98A2B3] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={aiLoading || aiQuery.trim().length < 3}
              className="px-5 py-2.5 rounded-xl bg-[#132238] text-white text-sm font-semibold hover:bg-[#0D1B2A] disabled:opacity-50 whitespace-nowrap"
            >
              {aiLoading ? 'Matching...' : 'Smart Match'}
            </button>
          </form>

          {aiResult && (
            <div className="mt-3 pt-3 border-t border-[#E6EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="text-[#182230]">
                <span className="font-semibold text-[#0D9488]">Smart Match:</span> {aiResult.summary}{' '}
                {aiResult.clarifyingQuestion && (
                  <span className="text-[#667085]">— {aiResult.clarifyingQuestion}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setAiResult(null)}
                className="text-[#667085] hover:text-[#182230] self-start sm:self-auto"
              >
                Dismiss
              </button>
            </div>
          )}
          {aiError && <p className="mt-2 text-xs text-[#DC5353]">{aiError}</p>}
        </div>

        {/* Location Coverage View (Honest structured area map when Maps API key isn't active) */}
        {showAreaCoverage && (
          <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-bold text-[#132238]">
                  Active Kenyan Cities & Neighborhoods
                </h2>
                <p className="text-xs text-[#667085]">
                  Click any city or neighborhood to filter professionals covering that area.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAreaCoverage(false)}
                className="p-1.5 rounded-lg text-[#667085] hover:bg-[#F7F9FC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {KENYA_CITIES.map((c) => {
                const countInCity = providers.filter((p) => p.city === c.city && !p.isSuspended).length;
                return (
                  <div key={c.city} className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0]">
                    <div className="flex items-center justify-between mb-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCity(c.city)}
                        className="font-display text-sm font-bold text-[#132238] hover:text-[#0D9488]"
                      >
                        {c.city}
                      </button>
                      <span className="font-mono-num text-xs text-[#667085]">
                        {countInCity} {countInCity === 1 ? 'pro' : 'pros'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-[#667085]">
                      {c.areas.map((area) => (
                        <button
                          key={area}
                          type="button"
                          onClick={() => setSelectedCity(area)}
                          className={`hover:text-[#0D9488] ${
                            selectedCity.toLowerCase() === area.toLowerCase() ? 'text-[#0D9488] font-semibold' : ''
                          }`}
                        >
                          {area}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Main Discovery Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Filters Sidebar */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-[#132238] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[#0D9488]" />
                Filters
              </h2>
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-[#0D9488] hover:underline"
              >
                Reset
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">Keyword</label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E6EAF0] bg-[#F7F9FC]">
                <Search className="w-3.5 h-3.5 text-[#98A2B3]" />
                <input
                  type="text"
                  value={queryText}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="Plumber, solar, sofa..."
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
              </div>
              {recentSearches.length > 0 && !queryText && (
                <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-[#667085]">
                  <span>Recent:</span>
                  {recentSearches.map((rs) => (
                    <button
                      key={rs}
                      type="button"
                      onClick={() => setQueryText(rs)}
                      className="text-[#0D9488] hover:underline"
                    >
                      {rs}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm bg-white focus:outline-none focus:border-[#0D9488]"
              >
                <option value="">All Categories</option>
                {activeCategories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                City or Neighborhood
              </label>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-[#E6EAF0] bg-[#F7F9FC]">
                <MapPin className="w-3.5 h-3.5 text-[#98A2B3]" />
                <input
                  type="text"
                  list="filter-city-list"
                  value={selectedCity}
                  onChange={(e) => setSelectedCity(e.target.value)}
                  placeholder="Nairobi, Westlands..."
                  className="w-full bg-transparent text-sm focus:outline-none"
                />
                <datalist id="filter-city-list">
                  {KENYA_CITIES.flatMap((c) => [c.city, ...c.areas]).map((loc) => (
                    <option key={loc} value={loc} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                Max Starting Price (KSh)
              </label>
              <input
                type="number"
                min={0}
                step={500}
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                placeholder="e.g., 5000"
                className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                Minimum Rating
              </label>
              <select
                value={minRating}
                onChange={(e) => setMinRating(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm bg-white focus:outline-none focus:border-[#0D9488]"
              >
                <option value={0}>Any rating</option>
                <option value={4}>4.0+ stars</option>
                <option value={4.5}>4.5+ stars</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                Provider Type
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 bg-[#F7F9FC] rounded-lg border border-[#E6EAF0]">
                {(['all', 'individual', 'business'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setProviderType(t)}
                    className={`py-1.5 text-xs font-medium rounded-md capitalize transition-colors ${
                      providerType === t
                        ? 'bg-white text-[#132238] border border-[#E6EAF0]'
                        : 'text-[#667085]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-[#E6EAF0]">
              <label className="flex items-center gap-2.5 text-sm text-[#182230] cursor-pointer">
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="rounded border-[#E6EAF0] text-[#0D9488] focus:ring-[#0D9488]"
                />
                <ShieldCheck className="w-4 h-4 text-[#16A36A]" />
                <span>Verified providers only</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[#182230] cursor-pointer">
                <input
                  type="checkbox"
                  checked={availableTodayOnly}
                  onChange={(e) => setAvailableTodayOnly(e.target.checked)}
                  className="rounded border-[#E6EAF0] text-[#0D9488] focus:ring-[#0D9488]"
                />
                <span>Available today</span>
              </label>
              <label className="flex items-center gap-2.5 text-sm text-[#182230] cursor-pointer">
                <input
                  type="checkbox"
                  checked={emergencyOnly}
                  onChange={(e) => setEmergencyOnly(e.target.checked)}
                  className="rounded border-[#E6EAF0] text-[#0D9488] focus:ring-[#0D9488]"
                />
                <span>Emergency availability</span>
              </label>
            </div>
          </div>
        </aside>

        {/* Results Panel */}
        <div className="lg:col-span-9 space-y-5">
          <div className="bg-white border border-[#E6EAF0] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#667085]">
              Showing <span className="font-semibold text-[#132238] font-mono-num">{filteredProviders.length}</span>{' '}
              {filteredProviders.length === 1 ? 'professional' : 'professionals'}
            </div>

            <div className="flex items-center gap-3">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort results"
                className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-medium text-[#182230] bg-white focus:outline-none focus:border-[#0D9488]"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="rating">Sort: Highest Rated</option>
                <option value="reviews">Sort: Most Reviewed</option>
                <option value="price_asc">Price: Lowest First</option>
                <option value="price_desc">Price: Highest First</option>
              </select>

              <div className="flex items-center gap-1 p-1 bg-[#F7F9FC] border border-[#E6EAF0] rounded-lg">
                <button
                  type="button"
                  onClick={() => setLayout('grid')}
                  aria-label="Grid view"
                  className={`p-1.5 rounded ${layout === 'grid' ? 'bg-white text-[#132238]' : 'text-[#667085]'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setLayout('list')}
                  aria-label="List view"
                  className={`p-1.5 rounded ${layout === 'list' ? 'bg-white text-[#132238]' : 'text-[#667085]'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {loadingPublic ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="bg-white border border-[#E6EAF0] rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          ) : filteredProviders.length === 0 ? (
            <div className="bg-white border border-[#E6EAF0] rounded-2xl p-10 text-center space-y-3">
              <h3 className="font-display text-lg font-bold text-[#132238]">
                No matching professionals found
              </h3>
              <p className="text-sm text-[#667085] max-w-md mx-auto">
                Try broadening your city/neighborhood filter, clearing price caps, or resetting filters. If you are a skilled professional in this category, join ServiceConnect to be listed here.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="px-4 py-2 rounded-lg border border-[#E6EAF0] text-sm font-medium text-[#182230] hover:bg-[#F7F9FC]"
                >
                  Clear All Filters
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/become-a-provider')}
                  className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
                >
                  Register as a Provider
                </button>
              </div>
            </div>
          ) : (
            <div className={layout === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-6' : 'space-y-4'}>
              {filteredProviders.map((prov) => {
                const stats = getProviderRatingStats(prov.uid);
                return (
                  <ProviderCard
                    key={prov.uid}
                    provider={prov}
                    avgRating={stats.avgRating}
                    reviewCount={stats.reviewCount}
                    isFavorited={isFavorited(prov.uid)}
                    layout={layout}
                    onViewProfile={() => navigate(`/providers/${prov.slug}`)}
                    onBook={() => onBookProvider(prov)}
                    onToggleFavorite={() => {
                      if (!firebaseUser) navigate('/login');
                      else void toggleFavorite(prov);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
