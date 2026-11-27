import { Heart, MapPin, ShieldCheck, Star, Clock } from 'lucide-react';
import { ProviderProfile } from '../../types/index.ts';
import { formatCurrency } from '../../lib/utils.ts';
import { ImageWithFallback } from '../ui/ImageWithFallback.tsx';

interface ProviderCardProps {
  provider: ProviderProfile;
  avgRating: number;
  reviewCount: number;
  isFavorited: boolean;
  layout?: 'grid' | 'list';
  onViewProfile: () => void;
  onBook: () => void;
  onToggleFavorite: () => void;
}

export function ProviderCard({
  provider,
  avgRating,
  reviewCount,
  isFavorited,
  layout = 'grid',
  onViewProfile,
  onBook,
  onToggleFavorite,
}: ProviderCardProps) {
  const isVerified = provider.verificationStatus === 'approved' && provider.identityVerified;
  const displayTitle = provider.businessName || provider.displayName;
  const categoryLabel = (provider.categories || [])
    .slice(0, 2)
    .map((c) => c.replace(/-/g, ' '))
    .join(', ');

  return (
    <article
      className={`bg-white border border-[#E6EAF0] rounded-2xl overflow-hidden transition-all duration-150 hover:border-[#0D9488]/50 ${
        layout === 'list' ? 'flex flex-col md:flex-row' : 'flex flex-col'
      }`}
    >
      <div className={layout === 'list' ? 'md:w-64 shrink-0 relative' : 'h-48 relative'}>
        <ImageWithFallback
          src={provider.photoUrl || provider.portfolioUrls?.[0]}
          alt={`${displayTitle} service profile`}
          fallbackLabel={displayTitle}
          className="w-full h-full object-cover"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={isFavorited ? `Remove ${displayTitle} from favorites` : `Save ${displayTitle} to favorites`}
          className="absolute top-3 right-3 w-9 h-9 rounded-lg bg-white/95 border border-[#E6EAF0] flex items-center justify-center text-[#182230] hover:text-[#DC5353] transition-colors"
        >
          <Heart className={`w-4 h-4 ${isFavorited ? 'fill-[#DC5353] text-[#DC5353]' : ''}`} />
        </button>
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <div>
              {provider.isSponsored && (
                <div className="text-[11px] font-semibold uppercase tracking-wider text-[#3977D5] mb-1">
                  Sponsored Placement
                </div>
              )}
              <h3 className="font-display text-lg font-bold text-[#132238] leading-snug">
                <button
                  type="button"
                  onClick={onViewProfile}
                  className="text-left hover:text-[#0D9488] transition-colors"
                >
                  {displayTitle}
                </button>
              </h3>
            </div>
            {isVerified && (
              <span
                title="Identity verified by ServiceConnect admins"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#16A36A] shrink-0"
              >
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                Verified
              </span>
            )}
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#667085]">
            <span className="capitalize">{categoryLabel || 'General Services'}</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-[#98A2B3]" aria-hidden="true" />
              {provider.city}
              {provider.serviceAreas?.length ? ` (${provider.serviceAreas.slice(0, 2).join(', ')})` : ''}
            </span>
          </div>

          <p className="mt-3 text-sm text-[#667085] line-clamp-2 leading-relaxed">
            {provider.bio || 'Local professional offering scheduled bookings and transparent quotations.'}
          </p>
        </div>

        <div className="pt-3 border-t border-[#E6EAF0] space-y-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5">
              {reviewCount > 0 ? (
                <>
                  <Star className="w-3.5 h-3.5 fill-[#E9A23B] text-[#E9A23B]" aria-hidden="true" />
                  <span className="font-semibold text-[#182230] font-mono-num">{avgRating.toFixed(1)}</span>
                  <span className="text-[#667085]">({reviewCount} verified)</span>
                </>
              ) : (
                <span className="text-[#667085]">New · 0 verified reviews</span>
              )}
            </div>

            <div className="text-right">
              {provider.startingPrice && provider.startingPrice > 0 ? (
                <span className="font-semibold text-[#132238] font-mono-num">
                  From {formatCurrency(provider.startingPrice)}
                </span>
              ) : (
                <span className="text-[#667085]">Quote on request</span>
              )}
            </div>
          </div>

          {(provider.availableToday || provider.emergencyAvailable) && (
            <div className="flex items-center gap-2 text-xs text-[#0D9488] font-medium">
              <Clock className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {provider.emergencyAvailable ? 'Emergency callouts available' : 'Available today'}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onViewProfile}
              className="flex-1 py-2 px-3 rounded-lg border border-[#E6EAF0] text-sm font-medium text-[#182230] hover:bg-[#F7F9FC] transition-colors whitespace-nowrap"
            >
              View Profile
            </button>
            <button
              type="button"
              onClick={onBook}
              className="flex-1 py-2 px-3 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] transition-colors whitespace-nowrap"
            >
              {provider.startingPrice && provider.startingPrice > 0 ? 'Book Now' : 'Request Quote'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
