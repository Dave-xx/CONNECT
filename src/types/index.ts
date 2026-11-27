export type UserRole = 'customer' | 'provider' | 'admin';

export type VerificationStatus =
  | 'not_submitted'
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'additional_info_required'
  | 'suspended';

export type PricingModel = 'fixed' | 'starting_at' | 'hourly' | 'per_unit' | 'quote';

export type BookingStatus =
  | 'requested'
  | 'awaiting_quotation'
  | 'quotation_sent'
  | 'awaiting_customer_approval'
  | 'confirmed'
  | 'provider_en_route'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'disputed';

export type PaymentMethod =
  | 'mpesa_pending'
  | 'cash_outside_platform'
  | 'bank_transfer'
  | 'card_pending';

export type PaymentStatus =
  | 'unpaid'
  | 'awaiting_confirmation'
  | 'paid_outside_platform'
  | 'refunded';

export type DisputeStatus =
  | 'open'
  | 'under_investigation'
  | 'awaiting_response'
  | 'resolved'
  | 'closed';

export interface SavedAddress {
  id: string;
  label: string;
  city: string;
  area: string;
  streetNote: string;
}

export interface UserAccount {
  uid: string;
  email: string;
  fullName: string;
  phone?: string;
  photoUrl?: string;
  role: UserRole;
  city?: string;
  area?: string;
  country?: string;
  preferredCurrency?: string;
  savedAddresses?: SavedAddress[];
  servicePreferences?: string[];
  notificationPrefs?: {
    inApp: boolean;
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  onboardingCompleted: boolean;
  isSuspended: boolean;
  createdAt: any;
  updatedAt: any;
}

export interface ServiceCategory {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconName: string;
  imageUrl?: string;
  sortOrder: number;
  isActive: boolean;
  subcategories?: string[];
  createdAt?: any;
  updatedAt?: any;
}

export interface WorkingHoursDay {
  enabled: boolean;
  open: string;
  close: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface WorkingHoursMap {
  [day: string]: WorkingHoursDay;
}

export interface ProviderProfile {
  uid: string;
  slug: string;
  displayName: string;
  businessName?: string;
  providerType: 'individual' | 'business';
  bio?: string;
  city: string;
  serviceAreas?: string[];
  categories?: string[];
  languages?: string[];
  yearsExperience?: number;
  startingPrice?: number;
  photoUrl?: string;
  portfolioUrls?: string[];
  workingHours?: WorkingHoursMap & {
    maxBookingsPerDay?: number;
    leadTimeHours?: number;
    daysOff?: string[];
  };
  emergencyAvailable?: boolean;
  availableToday?: boolean;
  verificationStatus: VerificationStatus;
  identityVerified: boolean;
  phoneVerified: boolean;
  businessVerified: boolean;
  credentialsVerified: boolean;
  subscriptionTier: 'free' | 'pro' | 'business';
  isSponsored: boolean;
  isSuspended: boolean;
  avgRating: number;
  reviewCount: number;
  completedJobsCount: number;
  profileViews?: number;
  createdAt?: any;
  updatedAt?: any;
}

export interface ProviderVerificationPrivate {
  uid: string;
  nationalIdLast4?: string;
  idDocumentLabel: string;
  businessRegNumber?: string;
  qualificationsSummary?: string;
  certificationsList?: string[];
  adminReviewNotes?: string;
  reviewedBy?: string;
  submittedAt?: any;
  updatedAt?: any;
}

export interface ServiceListing {
  id: string;
  providerId: string;
  providerName: string;
  categorySlug: string;
  categoryName: string;
  title: string;
  description: string;
  pricingModel: PricingModel;
  price: number;
  currency: string;
  estimatedDurationMins?: number;
  city: string;
  serviceAreas?: string[];
  terms?: string;
  status: 'active' | 'paused' | 'archived';
  isSponsored?: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface QuotationLineItem {
  label: string;
  detail: string;
  amount: number;
}

export interface Booking {
  id: string;
  referenceCode: string;
  customerId: string;
  customerName: string;
  providerId: string;
  providerName: string;
  serviceId?: string;
  serviceTitle: string;
  categorySlug?: string;
  bookingType: 'direct' | 'quote';
  jobDescription: string;
  city: string;
  area: string;
  exactAddress?: string;
  scheduledDate: string;
  scheduledTime: string;
  price: number;
  commissionAmount?: number;
  currency: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  quotationNotes?: string;
  quotationItems?: QuotationLineItem[];
  quotationExpiry?: string;
  estimatedDuration?: string;
  cancellationReason?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface BookingMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  body: string;
  readByCustomer: boolean;
  readByProvider: boolean;
  createdAt?: any;
}

export interface VerifiedReview {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  providerId: string;
  serviceTitle?: string;
  overallRating: number;
  professionalism: number;
  quality: number;
  punctuality: number;
  communication: number;
  comment: string;
  providerResponse?: string;
  isReported: boolean;
  reportReason?: string;
  isHidden: boolean;
  createdAt?: any;
  updatedAt?: any;
}

export interface FavoriteProvider {
  id: string;
  customerId: string;
  providerId: string;
  providerName?: string;
  createdAt?: any;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'booking' | 'quote' | 'message' | 'review' | 'verification' | 'dispute' | 'system';
  link?: string;
  isRead: boolean;
  createdAt?: any;
}

export interface DisputeCase {
  id: string;
  bookingId: string;
  bookingReference?: string;
  customerId: string;
  providerId: string;
  openedBy: string;
  reason: string;
  description: string;
  providerResponse?: string;
  status: DisputeStatus;
  resolutionNotes?: string;
  createdAt?: any;
  updatedAt?: any;
}

export interface SubscriptionPlanConfig {
  id: 'free' | 'pro' | 'business';
  name: string;
  monthlyPriceKsh: number;
  maxServices: number;
  features: string[];
}

export interface PlatformSettings {
  id: string;
  commissionRatePercent: number;
  defaultCurrency: string;
  defaultTimezone: string;
  supportedCities: string[];
  supportedCountries: string[];
  mpesaStatus: 'not_configured' | 'sandbox_ready' | 'live';
  subscriptionPlans?: SubscriptionPlanConfig[];
  updatedAt?: any;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  action: string;
  targetType: string;
  targetId: string;
  details?: string;
  createdAt?: any;
}

export interface SmartSearchIntent {
  categorySlug: string;
  keywords: string[];
  location: string;
  availableTodayOnly: boolean;
  emergencyOnly: boolean;
  clarifyingQuestion: string;
  summary: string;
  usedFallback?: boolean;
}
