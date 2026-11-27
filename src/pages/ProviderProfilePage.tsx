import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  Flag,
  Heart,
  MapPin,
  MessageSquare,
  Star,
} from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import { useAuth } from '../context/AuthContext.tsx';
import { ServiceListing } from '../types/index.ts';
import { formatCurrency, formatTimestamp } from '../lib/utils.ts';
import { ImageWithFallback } from '../components/ui/ImageWithFallback.tsx';
import { VerificationSummary } from '../components/ui/VerificationSummary.tsx';

interface ProviderProfilePageProps {
  slug: string;
  navigate: (to: string) => void;
  onBookService: (providerId: string, service: ServiceListing | null, mode: 'direct' | 'quote') => void;
}

export function ProviderProfilePage({ slug, navigate, onBookService }: ProviderProfilePageProps) {
  const {
    providers,
    services,
    reviews,
    getProviderRatingStats,
    isFavorited,
    toggleFavorite,
  } = useMarketplace();
  const { firebaseUser } = useAuth();

  const [reportingReviewId, setReportingReviewId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [reportStatus, setReportStatus] = useState<string | null>(null);

  const provider = useMemo(
    () => providers.find((p) => p.slug === slug || p.uid === slug),
    [providers, slug]
  );

  const providerServices = useMemo(
    () =>
      provider
        ? services.filter((s) => s.providerId === provider.uid && s.status === 'active')
        : [],
    [services, provider]
  );

  const providerReviews = useMemo(
    () =>
      provider
        ? reviews.filter((r) => r.providerId === provider.uid && !r.isHidden)
        : [],
    [reviews, provider]
  );

  if (!provider) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display text-2xl font-bold text-[#132238]">
          Professional profile not found
        </h1>
        <p className="text-sm text-[#667085]">
          This profile may have been moved or is no longer active.
        </p>
        <button
          type="button"
          onClick={() => navigate('/services')}
          className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold"
        >
          Browse Professionals
        </button>
      </div>
    );
  }

  const stats = getProviderRatingStats(provider.uid);
  const displayTitle = provider.businessName || provider.displayName;
  const favorited = isFavorited(provider.uid);

  const handleReportReview = async (reviewId: string) => {
    if (!firebaseUser || !reportReason.trim()) return;
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        isReported: true,
        reportReason: reportReason.trim().slice(0, 400),
        updatedAt: serverTimestamp(),
      });
      setReportingReviewId(null);
      setReportReason('');
      setReportStatus('Review flagged for administrator inspection.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${reviewId}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      <button
        type="button"
        onClick={() => navigate('/services')}
        className="inline-flex items-center gap-2 text-sm font-medium text-[#667085] hover:text-[#132238] mb-6"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Services
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Main Column */}
        <div className="lg:col-span-8 space-y-8">
          {/* Header Card */}
          <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6">
            <div className="w-28 h-28 rounded-2xl overflow-hidden shrink-0 border border-[#E6EAF0]">
              <ImageWithFallback
                src={provider.photoUrl || provider.portfolioUrls?.[0]}
                alt={displayTitle}
                fallbackLabel={displayTitle}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  {provider.isSponsored && (
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[#3977D5] mb-1">
                      Sponsored Profile
                    </div>
                  )}
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#132238]">
                    {displayTitle}
                  </h1>
                  {provider.businessName && provider.displayName !== provider.businessName && (
                    <p className="text-sm text-[#667085]">Managed by {provider.displayName}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!firebaseUser) navigate('/login');
                    else void toggleFavorite(provider);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#182230] hover:bg-[#F7F9FC]"
                >
                  <Heart className={`w-4 h-4 ${favorited ? 'fill-[#DC5353] text-[#DC5353]' : ''}`} />
                  {favorited ? 'Saved' : 'Save'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[#667085]">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[#0D9488]" />
                  {provider.city}
                  {provider.serviceAreas?.length ? ` · ${provider.serviceAreas.join(', ')}` : ''}
                </span>
                <span aria-hidden="true">·</span>
                <span className="capitalize">{provider.providerType}</span>
                {provider.yearsExperience ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{provider.yearsExperience} yrs experience</span>
                  </>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm pt-1">
                {stats.reviewCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[#132238]">
                    <Star className="w-4 h-4 fill-[#E9A23B] text-[#E9A23B]" />
                    <span className="font-mono-num">{stats.avgRating.toFixed(1)}</span>
                    <span className="font-normal text-[#667085]">
                      ({stats.reviewCount} verified {stats.reviewCount === 1 ? 'review' : 'reviews'})
                    </span>
                  </span>
                ) : (
                  <span className="text-[#667085] text-xs">No verified reviews yet</span>
                )}

                {provider.languages?.length ? (
                  <span className="text-xs text-[#667085]">
                    Languages: {provider.languages.join(', ')}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Bio */}
          <section className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-3">
            <h2 className="font-display text-lg font-bold text-[#132238]">About</h2>
            <p className="text-sm text-[#182230] leading-relaxed whitespace-pre-line">
              {provider.bio || 'This professional has not added a detailed biography yet.'}
            </p>
          </section>

          {/* Service Listings */}
          <section className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="font-display text-lg font-bold text-[#132238]">Services & Pricing</h2>
            {providerServices.length === 0 ? (
              <div className="p-5 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-[#132238]">Custom Service Quotations</div>
                  <p className="text-xs text-[#667085] mt-1">
                    Describe your job to receive a direct quotation from this professional.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onBookService(provider.uid, null, 'quote')}
                  className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] whitespace-nowrap"
                >
                  Request a Quote
                </button>
              </div>
            ) : (
              <div className="divide-y divide-[#E6EAF0]">
                {providerServices.map((srv) => (
                  <div key={srv.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="text-xs text-[#667085]">{srv.categoryName}</div>
                      <h3 className="font-display text-base font-bold text-[#132238]">{srv.title}</h3>
                      <p className="text-sm text-[#667085] leading-relaxed">{srv.description}</p>
                      {srv.estimatedDurationMins && (
                        <div className="text-xs text-[#98A2B3] inline-flex items-center gap-1 pt-1">
                          <Clock className="w-3.5 h-3.5" />
                          Est. {srv.estimatedDurationMins} mins
                        </div>
                      )}
                    </div>
                    <div className="sm:text-right shrink-0 space-y-2">
                      <div className="font-mono-num text-base font-bold text-[#132238]">
                        {srv.pricingModel === 'quote'
                          ? 'Custom Quote'
                          : srv.pricingModel === 'starting_at'
                          ? `From ${formatCurrency(srv.price, srv.currency)}`
                          : srv.pricingModel === 'hourly'
                          ? `${formatCurrency(srv.price, srv.currency)} / hr`
                          : formatCurrency(srv.price, srv.currency)}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onBookService(provider.uid, srv, srv.pricingModel === 'quote' ? 'quote' : 'direct')
                        }
                        className="w-full sm:w-auto px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E]"
                      >
                        {srv.pricingModel === 'quote' ? 'Request Quote' : 'Book Service'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Portfolio Gallery */}
          {provider.portfolioUrls && provider.portfolioUrls.length > 0 && (
            <section className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-4">
              <h2 className="font-display text-lg font-bold text-[#132238]">Completed Work & Portfolio</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {provider.portfolioUrls.map((url, idx) => (
                  <div key={idx} className="h-40 rounded-xl overflow-hidden border border-[#E6EAF0]">
                    <ImageWithFallback
                      src={url}
                      alt={`${displayTitle} work sample ${idx + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Verified Reviews */}
          <section className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-[#132238]">
                Verified Booking Reviews ({providerReviews.length})
              </h2>
            </div>

            {reportStatus && (
              <p className="text-xs text-[#0D9488]">{reportStatus}</p>
            )}

            {providerReviews.length === 0 ? (
              <p className="text-sm text-[#667085]">
                No verified booking reviews yet. Only customers who complete a booking can review this professional.
              </p>
            ) : (
              <div className="divide-y divide-[#E6EAF0]">
                {providerReviews.map((rev) => (
                  <div key={rev.id} className="py-5 first:pt-0 last:pb-0 space-y-3">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-[#132238]">
                          {rev.customerName}
                        </div>
                        <div className="text-xs text-[#667085]">
                          {rev.serviceTitle ? `${rev.serviceTitle} · ` : ''}
                          {formatTimestamp(rev.createdAt)} · Verified Booking
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="inline-flex items-center gap-1 font-mono-num text-sm font-bold text-[#132238]">
                          <Star className="w-4 h-4 fill-[#E9A23B] text-[#E9A23B]" />
                          {rev.overallRating.toFixed(1)}
                        </span>
                        {firebaseUser && (
                          <button
                            type="button"
                            onClick={() => setReportingReviewId(reportingReviewId === rev.id ? null : rev.id)}
                            title="Report inappropriate review"
                            className="text-[#98A2B3] hover:text-[#DC5353]"
                          >
                            <Flag className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-[#182230] leading-relaxed">{rev.comment}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#667085]">
                      <span>Professionalism: {rev.professionalism}/5</span>
                      <span>Quality: {rev.quality}/5</span>
                      <span>Punctuality: {rev.punctuality}/5</span>
                      <span>Communication: {rev.communication}/5</span>
                    </div>

                    {rev.providerResponse && (
                      <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] text-xs text-[#182230]">
                        <span className="font-semibold text-[#132238]">Response from {displayTitle}: </span>
                        {rev.providerResponse}
                      </div>
                    )}

                    {reportingReviewId === rev.id && (
                      <div className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] flex gap-2">
                        <input
                          type="text"
                          value={reportReason}
                          onChange={(e) => setReportReason(e.target.value)}
                          placeholder="Reason for reporting this review..."
                          className="flex-1 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => void handleReportReview(rev.id)}
                          className="px-3 py-1.5 rounded-lg bg-[#DC5353] text-white text-xs font-semibold"
                        >
                          Submit
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Sidebar: Action Panel & Trust */}
        <aside className="lg:col-span-4 space-y-6">
          <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4 sticky top-24">
            <div className="pb-4 border-b border-[#E6EAF0]">
              <div className="text-xs text-[#667085]">Starting rate</div>
              <div className="font-mono-num text-2xl font-bold text-[#132238] mt-0.5">
                {provider.startingPrice && provider.startingPrice > 0
                  ? formatCurrency(provider.startingPrice)
                  : 'Custom Quote'}
              </div>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => onBookService(provider.uid, providerServices[0] || null, 'direct')}
                className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] transition-colors flex items-center justify-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Book a Service
              </button>
              <button
                type="button"
                onClick={() => onBookService(provider.uid, null, 'quote')}
                className="w-full py-2.5 px-4 rounded-lg border border-[#E6EAF0] bg-white text-[#132238] text-sm font-semibold hover:bg-[#F7F9FC] transition-colors flex items-center justify-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Request a Quote
              </button>
            </div>

            <div className="pt-4 border-t border-[#E6EAF0]">
              <h3 className="font-display text-sm font-bold text-[#132238] mb-3">
                Verification & Trust
              </h3>
              <VerificationSummary provider={provider} />
            </div>

            {provider.workingHours && (
              <div className="pt-4 border-t border-[#E6EAF0]">
                <h3 className="font-display text-sm font-bold text-[#132238] mb-2.5">
                  Working Hours (EAT)
                </h3>
                <div className="space-y-1.5 text-xs">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const slot = provider.workingHours?.[day];
                    return (
                      <div key={day} className="flex justify-between text-[#667085]">
                        <span>{day}</span>
                        <span className="font-mono-num text-[#182230]">
                          {slot?.enabled ? `${slot.open} – ${slot.close}` : 'Closed'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
