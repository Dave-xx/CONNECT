import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  UserCheck,
  Briefcase,
  CalendarCheck,
  FileText,
  MessageSquare,
  Wallet,
  Star,
  Clock,
  LogOut,
  Sparkles,
  Plus,
  CheckCircle2,
  AlertCircle,
  Pause,
  Play,
  Archive,
} from 'lucide-react';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import {
  Booking,
  PricingModel,
  ProviderProfile,
  ProviderVerificationPrivate,
  QuotationLineItem,
  ServiceListing,
  WorkingHoursMap,
} from '../types/index.ts';
import { DEFAULT_WORKING_HOURS, KENYA_CITIES } from '../data/marketplaceSeed.ts';
import {
  formatCurrency,
  generateSafeId,
  getBookingStatusLabel,
  getVerificationStatusLabel,
  slugify,
} from '../lib/utils.ts';
import { BookingMessagesPanel } from '../components/messaging/BookingMessagesPanel.tsx';
import { VerificationSummary } from '../components/ui/VerificationSummary.tsx';

interface ProviderDashboardProps {
  subPath: string;
  navigate: (to: string) => void;
}

export function ProviderDashboard({ subPath, navigate }: ProviderDashboardProps) {
  const { firebaseUser, account, signOut, getIdToken } = useAuth();
  const {
    providers,
    categories,
    services,
    providerBookings,
    reviews,
    settings,
    createNotification,
  } = useMarketplace();

  const activeTab = subPath.replace('/provider/', '').split('/')[0] || 'dashboard';
  const uid = firebaseUser?.uid || '';

  const myProvider = useMemo(
    () => providers.find((p) => p.uid === uid) || null,
    [providers, uid]
  );

  const myServices = useMemo(
    () => services.filter((s) => s.providerId === uid),
    [services, uid]
  );

  const myReviews = useMemo(
    () => reviews.filter((r) => r.providerId === uid && !r.isHidden),
    [reviews, uid]
  );

  // Profile form state
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [providerType, setProviderType] = useState<'individual' | 'business'>('individual');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('Nairobi');
  const [areasText, setAreasText] = useState('Westlands, Kilimani');
  const [selectedCats, setSelectedCats] = useState<string[]>(['plumbing']);
  const [languagesText, setLanguagesText] = useState('English, Swahili');
  const [yearsExp, setYearsExp] = useState('3');
  const [startingPrice, setStartingPrice] = useState('1500');
  const [portfolioText, setPortfolioText] = useState('');

  // Verification submission state
  const [verifPrivate, setVerifPrivate] = useState<ProviderVerificationPrivate | null>(null);
  const [idLast4, setIdLast4] = useState('');
  const [idDocLabel, setIdDocLabel] = useState('Kenya National ID');
  const [bizRegNo, setBizRegNo] = useState('');
  const [qualsSummary, setQualsSummary] = useState('');

  // Service modal/form state
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editingService, setEditingService] = useState<ServiceListing | null>(null);
  const [srvTitle, setSrvTitle] = useState('');
  const [srvCat, setSrvCat] = useState('plumbing');
  const [srvDesc, setSrvDesc] = useState('');
  const [srvModel, setSrvModel] = useState<PricingModel>('fixed');
  const [srvPrice, setSrvPrice] = useState('1500');
  const [srvDuration, setSrvDuration] = useState('60');
  const [srvTerms, setSrvTerms] = useState('');

  // Quotation modal state
  const [quoteBooking, setQuoteBooking] = useState<Booking | null>(null);
  const [quoteItems, setQuoteItems] = useState<QuotationLineItem[]>([
    { label: 'Labor & Assessment', detail: 'On-site work', amount: 1500 },
  ]);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [quoteDuration, setQuoteDuration] = useState('2 hours');
  const [quoteExpiry, setQuoteExpiry] = useState(() => {
    const d = new Date(Date.now() + 7 * 86_400_000);
    return d.toISOString().split('T')[0];
  });

  // Availability state
  const [workingHours, setWorkingHours] = useState<WorkingHoursMap>(DEFAULT_WORKING_HOURS);
  const [availableToday, setAvailableToday] = useState(true);
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [maxBookingsPerDay, setMaxBookingsPerDay] = useState(6);

  // Messaging & reviews state
  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [replyTexts, setReplyTexts] = useState<Record<string, string>>({});

  // UI feedback
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    if (myProvider) {
      setDisplayName(myProvider.displayName || '');
      setBusinessName(myProvider.businessName || '');
      setProviderType(myProvider.providerType || 'individual');
      setBio(myProvider.bio || '');
      setCity(myProvider.city || 'Nairobi');
      setAreasText((myProvider.serviceAreas || []).join(', '));
      setSelectedCats(myProvider.categories || ['plumbing']);
      setLanguagesText((myProvider.languages || []).join(', '));
      setYearsExp(String(myProvider.yearsExperience ?? 2));
      setStartingPrice(String(myProvider.startingPrice ?? 1500));
      setPortfolioText((myProvider.portfolioUrls || []).join('\n'));
      if (myProvider.workingHours) {
        setWorkingHours(myProvider.workingHours);
        if (myProvider.workingHours.maxBookingsPerDay) {
          setMaxBookingsPerDay(myProvider.workingHours.maxBookingsPerDay);
        }
      }
      setAvailableToday(Boolean(myProvider.availableToday));
      setEmergencyAvailable(Boolean(myProvider.emergencyAvailable));
    } else if (account) {
      setDisplayName(account.fullName || '');
      setCity(account.city || 'Nairobi');
      setAreasText(account.area || 'Westlands');
    }
  }, [myProvider, account]);

  useEffect(() => {
    if (!uid) return;
    getDoc(doc(db, 'providers', uid, 'private', 'verification'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as ProviderVerificationPrivate;
          setVerifPrivate(data);
          setIdLast4(data.nationalIdLast4 || '');
          setIdDocLabel(data.idDocumentLabel || 'Kenya National ID');
          setBizRegNo(data.businessRegNumber || '');
          setQualsSummary(data.qualificationsSummary || '');
        }
      })
      .catch(() => {
        // Not submitted yet
      });
  }, [uid]);

  const kpis = useMemo(() => {
    const newReq = providerBookings.filter((b) =>
      ['requested', 'awaiting_quotation'].includes(b.status)
    ).length;
    const confirmed = providerBookings.filter((b) =>
      ['confirmed', 'provider_en_route', 'in_progress'].includes(b.status)
    ).length;
    const completed = providerBookings.filter((b) => b.status === 'completed');
    const totalEarnings = completed.reduce((sum, b) => sum + (b.price || 0), 0);
    const pendingPayments = providerBookings
      .filter((b) => ['confirmed', 'in_progress', 'completed'].includes(b.status) && b.paymentStatus !== 'paid_outside_platform')
      .reduce((sum, b) => sum + (b.price || 0), 0);
    const avgRating =
      myReviews.length > 0
        ? (myReviews.reduce((s, r) => s + r.overallRating, 0) / myReviews.length).toFixed(1)
        : '—';
    return { newReq, confirmed, completedCount: completed.length, totalEarnings, pendingPayments, avgRating };
  }, [providerBookings, myReviews]);

  const callAiAssist = async (mode: 'bio' | 'service_description' | 'quote_draft', input: string, context = '') => {
    setAiBusy(true);
    setErrorMsg(null);
    try {
      const token = await getIdToken();
      const res = await fetch('/api/ai/provider-assist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ mode, input, context }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'AI Assistant unavailable right now.');
        return null;
      }
      return data;
    } catch {
      setErrorMsg('Failed to reach AI Assistant.');
      return null;
    } finally {
      setAiBusy(false);
    }
  };

  const ensureProviderDocExists = async () => {
    if (myProvider) return;
    const base = businessName.trim() || displayName.trim() || account?.fullName || 'Professional';
    await setDoc(doc(db, 'providers', uid), {
      uid,
      slug: `${slugify(base)}-${uid.slice(0, 5)}`,
      displayName: displayName.trim() || account?.fullName || 'Professional',
      businessName: businessName.trim(),
      providerType,
      bio: bio.trim(),
      city,
      serviceAreas: areasText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
      categories: selectedCats.length ? selectedCats : ['home-repairs'],
      languages: languagesText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
      yearsExperience: Number(yearsExp) || 1,
      startingPrice: Number(startingPrice) || 0,
      photoUrl: firebaseUser?.photoURL || '',
      portfolioUrls: [],
      workingHours,
      emergencyAvailable,
      availableToday,
      verificationStatus: 'not_submitted',
      identityVerified: false,
      phoneVerified: Boolean(account?.phone),
      businessVerified: false,
      credentialsVerified: false,
      subscriptionTier: 'free',
      isSponsored: false,
      isSuspended: false,
      avgRating: 0,
      reviewCount: 0,
      completedJobsCount: 0,
      profileViews: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await ensureProviderDocExists();
      const base = businessName.trim() || displayName.trim();
      await updateDoc(doc(db, 'providers', uid), {
        slug: myProvider?.slug || `${slugify(base)}-${uid.slice(0, 5)}`,
        displayName: displayName.trim().slice(0, 120),
        businessName: businessName.trim().slice(0, 140),
        providerType,
        bio: bio.trim().slice(0, 1500),
        city,
        serviceAreas: areasText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
        categories: selectedCats.length ? selectedCats : ['home-repairs'],
        languages: languagesText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10),
        yearsExperience: Math.max(0, Math.min(80, Number(yearsExp) || 0)),
        startingPrice: Math.max(0, Number(startingPrice) || 0),
        portfolioUrls: portfolioText
          .split('\n')
          .map((u) => u.trim())
          .filter((u) => u.startsWith('http') || u.startsWith('/src/'))
          .slice(0, 12),
        updatedAt: serverTimestamp(),
      });
      setStatusMsg('Professional profile updated.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `providers/${uid}`);
    }
  };

  const handleSubmitVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    if (!idDocLabel.trim()) {
      setErrorMsg('Please specify your ID document type.');
      return;
    }
    try {
      await ensureProviderDocExists();
      const verRef = doc(db, 'providers', uid, 'private', 'verification');
      if (verifPrivate) {
        await updateDoc(verRef, {
          nationalIdLast4: idLast4.trim().slice(0, 12),
          idDocumentLabel: idDocLabel.trim().slice(0, 200),
          businessRegNumber: bizRegNo.trim().slice(0, 80),
          qualificationsSummary: qualsSummary.trim().slice(0, 1000),
          updatedAt: serverTimestamp(),
        });
      } else {
        await setDoc(verRef, {
          uid,
          nationalIdLast4: idLast4.trim().slice(0, 12),
          idDocumentLabel: idDocLabel.trim().slice(0, 200),
          businessRegNumber: bizRegNo.trim().slice(0, 80),
          qualificationsSummary: qualsSummary.trim().slice(0, 1000),
          submittedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      if (
        !myProvider ||
        ['not_submitted', 'rejected', 'additional_info_required'].includes(myProvider.verificationStatus)
      ) {
        await updateDoc(doc(db, 'providers', uid), {
          verificationStatus: 'pending_review',
          updatedAt: serverTimestamp(),
        });
      }
      setStatusMsg('Verification details submitted for administrator review.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `providers/${uid}/private/verification`);
    }
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await ensureProviderDocExists();
      const catObj = categories.find((c) => c.slug === srvCat);
      const id = editingService ? editingService.id : generateSafeId('srv');
      const payload = {
        providerId: uid,
        providerName: businessName.trim() || displayName.trim() || account?.fullName || 'Provider',
        categorySlug: srvCat,
        categoryName: catObj?.name || srvCat,
        title: srvTitle.trim().slice(0, 140),
        description: srvDesc.trim().slice(0, 1500),
        pricingModel: srvModel,
        price: srvModel === 'quote' ? 0 : Math.max(0, Number(srvPrice) || 0),
        currency: settings.defaultCurrency || 'KSh',
        estimatedDurationMins: Math.max(15, Number(srvDuration) || 60),
        city,
        serviceAreas: areasText.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 20),
        terms: srvTerms.trim().slice(0, 800),
        status: editingService?.status || 'active',
        updatedAt: serverTimestamp(),
      };
      if (editingService) {
        await updateDoc(doc(db, 'services', id), payload);
      } else {
        await setDoc(doc(db, 'services', id), {
          ...payload,
          isSponsored: false,
          createdAt: serverTimestamp(),
        });
      }
      setShowServiceForm(false);
      setEditingService(null);
      setSrvTitle('');
      setSrvDesc('');
      setStatusMsg(editingService ? 'Service updated.' : 'Service listing published.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'services');
    }
  };

  const handleUpdateBookingStatus = async (b: Booking, nextStatus: Booking['status']) => {
    try {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        userId: b.customerId,
        title: `Booking ${b.referenceCode}: ${getBookingStatusLabel(nextStatus)}`,
        body: `${b.providerName} updated your ${b.serviceTitle} booking status.`,
        type: 'booking',
        link: '/app/bookings',
      });
      setStatusMsg(`Booking ${b.referenceCode} marked as ${getBookingStatusLabel(nextStatus)}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${b.id}`);
    }
  };

  const handleSubmitQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quoteBooking) return;
    const total = quoteItems.reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
    if (total <= 0) {
      setErrorMsg('Quotation total must be greater than KSh 0.');
      return;
    }
    try {
      await updateDoc(doc(db, 'bookings', quoteBooking.id), {
        status: 'quotation_sent',
        price: total,
        quotationNotes: quoteNotes.trim().slice(0, 1500),
        quotationItems: quoteItems.slice(0, 10),
        quotationExpiry: quoteExpiry,
        estimatedDuration: quoteDuration.trim().slice(0, 80),
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        userId: quoteBooking.customerId,
        title: `Quotation received (${quoteBooking.referenceCode})`,
        body: `${quoteBooking.providerName} sent a quotation of ${formatCurrency(total, quoteBooking.currency)}.`,
        type: 'quote',
        link: '/app/bookings',
      });
      setQuoteBooking(null);
      setStatusMsg(`Quotation sent for ${quoteBooking.referenceCode}.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${quoteBooking.id}`);
    }
  };

  const handleSaveAvailability = async () => {
    try {
      await ensureProviderDocExists();
      await updateDoc(doc(db, 'providers', uid), {
        workingHours: { ...workingHours, maxBookingsPerDay },
        availableToday,
        emergencyAvailable,
        updatedAt: serverTimestamp(),
      });
      setStatusMsg('Availability schedule saved.');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `providers/${uid}`);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, path: '/provider/dashboard' },
    { id: 'profile', label: 'Profile & Verification', icon: UserCheck, path: '/provider/profile' },
    { id: 'services', label: 'Services', icon: Briefcase, path: '/provider/services' },
    { id: 'bookings', label: 'Bookings', icon: CalendarCheck, path: '/provider/bookings' },
    { id: 'quotes', label: 'Quotations', icon: FileText, path: '/provider/quotes' },
    { id: 'availability', label: 'Availability', icon: Clock, path: '/provider/availability' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/provider/messages' },
    { id: 'earnings', label: 'Earnings & Plan', icon: Wallet, path: '/provider/earnings' },
    { id: 'reviews', label: 'Reviews', icon: Star, path: '/provider/reviews' },
  ];

  const activeMessageBooking =
    providerBookings.find((b) => b.id === selectedBookingId) || providerBookings[0] || null;

  return (
    <div className="min-h-[82vh] bg-[#F7F9FC] pb-20 lg:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="hidden lg:block lg:col-span-3">
          <div className="bg-white border border-[#E6EAF0] rounded-2xl p-4 space-y-1 sticky top-20">
            <div className="px-3 py-2 mb-2 border-b border-[#E6EAF0]">
              <div className="text-xs text-[#667085]">Provider Dashboard</div>
              <div className="font-display text-sm font-bold text-[#132238] truncate">
                {myProvider?.businessName || myProvider?.displayName || account?.fullName}
              </div>
              <div className="text-[11px] font-medium text-[#0D9488] mt-0.5">
                {getVerificationStatusLabel(myProvider?.verificationStatus || 'not_submitted')}
              </div>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active ? 'bg-[#E6F6F3] text-[#0D9488]' : 'text-[#667085] hover:bg-[#F7F9FC] hover:text-[#132238]'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="pt-2 border-t border-[#E6EAF0] mt-2">
              <button
                type="button"
                onClick={() => void signOut().then(() => navigate('/'))}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[#DC5353] hover:bg-[#DC5353]/10"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          {statusMsg && (
            <div className="p-3.5 rounded-xl bg-[#16A36A]/10 border border-[#16A36A]/30 text-xs font-medium text-[#16A36A] flex items-center justify-between">
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{statusMsg}</span>
              <button type="button" onClick={() => setStatusMsg(null)} className="underline">Dismiss</button>
            </div>
          )}
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-[#DC5353]/10 border border-[#DC5353]/30 text-xs font-medium text-[#DC5353] flex items-center justify-between">
              <span className="flex items-center gap-2"><AlertCircle className="w-4 h-4" />{errorMsg}</span>
              <button type="button" onClick={() => setErrorMsg(null)} className="underline">Dismiss</button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#132238]">
                    Welcome back, {myProvider?.displayName || account?.fullName || 'Professional'}.
                  </h1>
                  <p className="text-sm text-[#667085] mt-0.5">
                    Manage your requests, active bookings, quotations, and verification status.
                  </p>
                </div>
                {myProvider && (
                  <button
                    type="button"
                    onClick={() => navigate(`/providers/${myProvider.slug}`)}
                    className="px-4 py-2 rounded-lg border border-[#E6EAF0] bg-white text-xs font-semibold text-[#132238] hover:bg-[#F7F9FC] self-start"
                  >
                    View Public Profile
                  </button>
                )}
              </div>

              {(!myProvider || myProvider.verificationStatus !== 'approved') && (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="text-sm font-bold text-[#132238]">
                      Verification Status: {getVerificationStatusLabel(myProvider?.verificationStatus || 'not_submitted')}
                    </div>
                    <p className="text-xs text-[#667085] mt-1">
                      Submit your National ID and qualifications so administrators can verify your profile for featured customer discovery.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate('/provider/profile')}
                    className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold whitespace-nowrap"
                  >
                    Complete Verification
                  </button>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'New Requests', value: kpis.newReq },
                  { label: 'Confirmed Bookings', value: kpis.confirmed },
                  { label: 'Completed Jobs', value: kpis.completedCount },
                  { label: 'Total Earnings', value: formatCurrency(kpis.totalEarnings) },
                ].map((k) => (
                  <div key={k.label} className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                    <div className="text-xs text-[#667085]">{k.label}</div>
                    <div className="font-mono-num text-xl sm:text-2xl font-bold text-[#132238] mt-1">
                      {k.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#132238]">
                    Performance Analytics
                  </h2>
                  <div className="grid grid-cols-2 gap-4 text-sm pt-1">
                    <div>
                      <div className="text-xs text-[#667085]">Verified Rating</div>
                      <div className="font-mono-num text-lg font-bold text-[#132238]">
                        {kpis.avgRating} ({myReviews.length})
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#667085]">Active Listings</div>
                      <div className="font-mono-num text-lg font-bold text-[#132238]">
                        {myServices.filter((s) => s.status === 'active').length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#667085]">Total Requests</div>
                      <div className="font-mono-num text-lg font-bold text-[#132238]">
                        {providerBookings.length}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[#667085]">Completion Rate</div>
                      <div className="font-mono-num text-lg font-bold text-[#132238]">
                        {providerBookings.length > 0
                          ? `${Math.round((kpis.completedCount / providerBookings.length) * 100)}%`
                          : '—'}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#132238]">
                    Incoming Requests
                  </h2>
                  {providerBookings.filter((b) => ['requested', 'awaiting_quotation'].includes(b.status)).length === 0 ? (
                    <p className="text-sm text-[#667085]">No pending requests right now.</p>
                  ) : (
                    <div className="space-y-3">
                      {providerBookings
                        .filter((b) => ['requested', 'awaiting_quotation'].includes(b.status))
                        .slice(0, 3)
                        .map((b) => (
                          <div key={b.id} className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#132238] truncate">{b.serviceTitle}</div>
                              <div className="text-xs text-[#667085] truncate">
                                {b.customerName} · {b.area} · {b.scheduledDate}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => navigate('/provider/bookings')}
                              className="px-3 py-1.5 rounded-lg bg-[#0D9488] text-white text-xs font-semibold shrink-0"
                            >
                              Respond
                            </button>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'profile' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Profile & Verification</h1>

              <form onSubmit={handleSaveProfile} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#132238]">Public Business Profile</h2>
                  <button
                    type="button"
                    disabled={aiBusy}
                    onClick={async () => {
                      const res = await callAiAssist('bio', bio || `${displayName} in ${city} offering ${selectedCats.join(', ')}`);
                      if (res?.text) setBio(res.text);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#132238] hover:border-[#0D9488]"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                    {aiBusy ? 'Polishing...' : 'AI Improve Bio'}
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Display Name</label>
                    <input type="text" required value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Business Name (Optional)</label>
                    <input type="text" value={businessName} onChange={(e) => setBusinessName(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Primary City</label>
                    <select value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm bg-white">
                      {KENYA_CITIES.map((c) => <option key={c.city} value={c.city}>{c.city}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Neighborhoods Served (comma-separated)</label>
                    <input type="text" value={areasText} onChange={(e) => setAreasText(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Starting Price (KSh)</label>
                    <input type="number" min={0} value={startingPrice} onChange={(e) => setStartingPrice(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Years Experience</label>
                    <input type="number" min={0} value={yearsExp} onChange={(e) => setYearsExp(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">Categories</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-36 overflow-y-auto p-3 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC]">
                    {categories.filter((c) => c.isActive).map((c) => {
                      const checked = selectedCats.includes(c.slug);
                      return (
                        <label key={c.slug} className="flex items-center gap-2 text-xs cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedCats((prev) =>
                                checked ? prev.filter((x) => x !== c.slug) : [...prev, c.slug]
                              )
                            }
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">Biography</label>
                  <textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">Portfolio Image URLs (one per line)</label>
                  <textarea rows={2} value={portfolioText} onChange={(e) => setPortfolioText(e.target.value)} placeholder="https://..." className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-mono-num" />
                </div>

                <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]">
                  Save Public Profile
                </button>
              </form>

              {/* Verification Submission */}
              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-base font-bold text-[#132238]">Identity & Credential Verification</h2>
                    <p className="text-xs text-[#667085] mt-0.5">
                      Protected records visible only to you and ServiceConnect administrators.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-[#0D9488]">
                    {getVerificationStatusLabel(myProvider?.verificationStatus || 'not_submitted')}
                  </span>
                </div>

                {verifPrivate?.adminReviewNotes && (
                  <div className="p-3.5 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] text-xs text-[#182230]">
                    <span className="font-semibold">Admin Review Note: </span>
                    {verifPrivate.adminReviewNotes}
                  </div>
                )}

                {myProvider && <VerificationSummary provider={myProvider} />}

                <form onSubmit={handleSubmitVerification} className="space-y-4 pt-3 border-t border-[#E6EAF0]">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">ID Document Type</label>
                      <input type="text" required value={idDocLabel} onChange={(e) => setIdDocLabel(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">ID Number (Last 4 digits)</label>
                      <input type="text" maxLength={8} value={idLast4} onChange={(e) => setIdLast4(e.target.value)} placeholder="e.g., 4829" className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">Business Registration No. (if applicable)</label>
                      <input type="text" value={bizRegNo} onChange={(e) => setBizRegNo(e.target.value)} placeholder="BN-XXXXXX or PVT-XXXXXX" className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">Trade Qualifications / NCA / EPRA License</label>
                      <input type="text" value={qualsSummary} onChange={(e) => setQualsSummary(e.target.value)} placeholder="Certificate details or license class" className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                    </div>
                  </div>
                  <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#132238] text-white text-sm font-semibold hover:bg-[#0D1B2A]">
                    Submit for Admin Verification
                  </button>
                </form>
              </div>
            </div>
          )}

          {activeTab === 'services' && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#132238]">Service Listings</h1>
                  <p className="text-sm text-[#667085]">Create fixed-price, starting-price, hourly, or quote services.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEditingService(null);
                    setSrvTitle('');
                    setSrvDesc('');
                    setShowServiceForm(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
                >
                  <Plus className="w-4 h-4" /> Add Service
                </button>
              </div>

              {showServiceForm && (
                <form onSubmit={handleSaveService} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-display text-base font-bold text-[#132238]">
                      {editingService ? 'Edit Service' : 'New Service Listing'}
                    </h2>
                    <button
                      type="button"
                      disabled={aiBusy || !srvTitle.trim()}
                      onClick={async () => {
                        const res = await callAiAssist('service_description', `${srvTitle}: ${srvDesc}`, `Category: ${srvCat}`);
                        if (res?.text) setSrvDesc(res.text);
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                      {aiBusy ? 'Writing...' : 'AI Polish Description'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">Service Title</label>
                      <input type="text" required minLength={3} value={srvTitle} onChange={(e) => setSrvTitle(e.target.value)} placeholder="e.g., Plumbing Leak Inspection" className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">Category</label>
                      <select value={srvCat} onChange={(e) => setSrvCat(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm bg-white">
                        {categories.filter((c) => c.isActive).map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#182230] mb-1">Pricing Model</label>
                      <select value={srvModel} onChange={(e) => setSrvModel(e.target.value as PricingModel)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm bg-white">
                        <option value="fixed">Fixed Price</option>
                        <option value="starting_at">Starting Price</option>
                        <option value="hourly">Hourly Rate</option>
                        <option value="per_unit">Per-Unit Pricing</option>
                        <option value="quote">Custom Quotation</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#182230] mb-1">Price (KSh)</label>
                        <input type="number" min={0} disabled={srvModel === 'quote'} value={srvPrice} onChange={(e) => setSrvPrice(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num disabled:bg-[#F7F9FC]" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-[#182230] mb-1">Est. Mins</label>
                        <input type="number" min={15} step={15} value={srvDuration} onChange={(e) => setSrvDuration(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Description</label>
                    <textarea required minLength={10} rows={3} value={srvDesc} onChange={(e) => setSrvDesc(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Terms & Conditions (Optional)</label>
                    <input type="text" value={srvTerms} onChange={(e) => setSrvTerms(e.target.value)} placeholder="e.g., Spare parts quoted separately after inspection" className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowServiceForm(false)} className="px-4 py-2 text-xs text-[#667085]">Cancel</button>
                    <button type="submit" className="px-5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold">Save Service</button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {myServices.length === 0 ? (
                  <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center text-sm text-[#667085]">
                    No services published yet. Click &quot;Add Service&quot; to publish your first listing.
                  </div>
                ) : (
                  myServices.map((srv) => (
                    <div key={srv.id} className="bg-white border border-[#E6EAF0] rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="text-xs text-[#667085]">
                          {srv.categoryName} · <span className="capitalize font-semibold">{srv.status}</span>
                        </div>
                        <div className="font-display text-base font-bold text-[#132238]">{srv.title}</div>
                        <p className="text-xs text-[#667085] mt-1">{srv.description}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono-num text-sm font-bold text-[#132238] mr-2">
                          {srv.pricingModel === 'quote' ? 'Quote' : formatCurrency(srv.price, srv.currency)}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingService(srv);
                            setSrvTitle(srv.title);
                            setSrvCat(srv.categorySlug);
                            setSrvDesc(srv.description);
                            setSrvModel(srv.pricingModel);
                            setSrvPrice(String(srv.price));
                            setSrvDuration(String(srv.estimatedDurationMins || 60));
                            setSrvTerms(srv.terms || '');
                            setShowServiceForm(true);
                          }}
                          className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-medium"
                        >
                          Edit
                        </button>
                        {srv.status === 'active' ? (
                          <button
                            type="button"
                            onClick={() => void updateDoc(doc(db, 'services', srv.id), { status: 'paused', updatedAt: serverTimestamp() })}
                            title="Pause service"
                            className="p-2 rounded-lg border border-[#E6EAF0] text-[#E9A23B]"
                          >
                            <Pause className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void updateDoc(doc(db, 'services', srv.id), { status: 'active', updatedAt: serverTimestamp() })}
                            title="Activate service"
                            className="p-2 rounded-lg border border-[#E6EAF0] text-[#16A36A]"
                          >
                            <Play className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void updateDoc(doc(db, 'services', srv.id), { status: 'archived', updatedAt: serverTimestamp() })}
                          title="Archive service"
                          className="p-2 rounded-lg border border-[#E6EAF0] text-[#667085]"
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {(activeTab === 'bookings' || activeTab === 'quotes') && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">
                {activeTab === 'quotes' ? 'Quotation Requests' : 'Booking Management'}
              </h1>
              {providerBookings.filter((b) => (activeTab === 'quotes' ? b.bookingType === 'quote' : true)).length === 0 ? (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center text-sm text-[#667085]">
                  No {activeTab === 'quotes' ? 'quotation requests' : 'bookings'} yet.
                </div>
              ) : (
                <div className="space-y-4">
                  {providerBookings
                    .filter((b) => (activeTab === 'quotes' ? b.bookingType === 'quote' : true))
                    .map((b) => (
                      <div key={b.id} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div>
                            <div className="text-xs font-mono-num text-[#667085]">
                              {b.referenceCode} · {b.scheduledDate} at {b.scheduledTime}
                            </div>
                            <h2 className="font-display text-lg font-bold text-[#132238]">{b.serviceTitle}</h2>
                            <div className="text-xs text-[#667085]">
                              Customer: <span className="font-semibold text-[#182230]">{b.customerName}</span> · {b.area}, {b.city}
                              {b.exactAddress ? ` (${b.exactAddress})` : ''}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-[#0D9488]">{getBookingStatusLabel(b.status)}</div>
                            <div className="font-mono-num text-base font-bold text-[#132238]">
                              {b.price > 0 ? formatCurrency(b.price, b.currency) : 'Awaiting quote'}
                            </div>
                          </div>
                        </div>

                        <p className="text-sm text-[#667085]">{b.jobDescription}</p>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#E6EAF0]">
                          {['requested', 'awaiting_quotation'].includes(b.status) && (
                            <>
                              {b.bookingType === 'direct' && (
                                <button type="button" onClick={() => void handleUpdateBookingStatus(b, 'confirmed')} className="px-3.5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold">
                                  Accept Booking
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setQuoteBooking(b);
                                  setQuoteNotes('');
                                  setQuoteItems([{ label: b.serviceTitle, detail: 'Labor & materials', amount: b.price || 1500 }]);
                                }}
                                className="px-3.5 py-2 rounded-lg bg-[#132238] text-white text-xs font-semibold"
                              >
                                Submit Quotation
                              </button>
                              <button type="button" onClick={() => void handleUpdateBookingStatus(b, 'cancelled')} className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#DC5353]">
                                Decline
                              </button>
                            </>
                          )}
                          {b.status === 'confirmed' && (
                            <button type="button" onClick={() => void handleUpdateBookingStatus(b, 'provider_en_route')} className="px-3.5 py-2 rounded-lg bg-[#3977D5] text-white text-xs font-semibold">
                              Mark En Route
                            </button>
                          )}
                          {b.status === 'provider_en_route' && (
                            <button type="button" onClick={() => void handleUpdateBookingStatus(b, 'in_progress')} className="px-3.5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold">
                              Start Job
                            </button>
                          )}
                          {b.status === 'in_progress' && (
                            <button type="button" onClick={() => void handleUpdateBookingStatus(b, 'completed')} className="px-3.5 py-2 rounded-lg bg-[#16A36A] text-white text-xs font-semibold">
                              Mark Completed
                            </button>
                          )}
                          {b.status === 'completed' && b.paymentStatus !== 'paid_outside_platform' && (
                            <button
                              type="button"
                              onClick={() => void updateDoc(doc(db, 'bookings', b.id), { paymentStatus: 'paid_outside_platform', updatedAt: serverTimestamp() })}
                              className="px-3.5 py-2 rounded-lg border border-[#16A36A]/40 text-xs font-semibold text-[#16A36A]"
                            >
                              Confirm Outside Payment Received
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBookingId(b.id);
                              navigate('/provider/messages');
                            }}
                            className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#182230]"
                          >
                            Message Customer
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'availability' && (
            <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-5">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Availability & Schedule</h1>
              <div className="flex flex-wrap gap-6 pb-4 border-b border-[#E6EAF0]">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={availableToday} onChange={(e) => setAvailableToday(e.target.checked)} />
                  <span>Available for bookings today</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={emergencyAvailable} onChange={(e) => setEmergencyAvailable(e.target.checked)} />
                  <span>Emergency callouts</span>
                </label>
                <div className="flex items-center gap-2 text-sm">
                  <span>Max bookings/day:</span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={maxBookingsPerDay}
                    onChange={(e) => setMaxBookingsPerDay(Number(e.target.value))}
                    className="w-16 px-2 py-1 rounded-lg border border-[#E6EAF0] font-mono-num"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                  const slot = workingHours[day] || { enabled: false, open: '08:00', close: '17:00' };
                  return (
                    <div key={day} className="grid grid-cols-12 items-center gap-3 py-2 border-b border-[#E6EAF0] last:border-0 text-sm">
                      <label className="col-span-4 flex items-center gap-2 font-medium text-[#132238]">
                        <input
                          type="checkbox"
                          checked={slot.enabled}
                          onChange={(e) =>
                            setWorkingHours((prev) => ({
                              ...prev,
                              [day]: { ...slot, enabled: e.target.checked },
                            }))
                          }
                        />
                        <span>{day}</span>
                      </label>
                      <div className="col-span-4">
                        <input
                          type="time"
                          disabled={!slot.enabled}
                          value={slot.open}
                          onChange={(e) =>
                            setWorkingHours((prev) => ({
                              ...prev,
                              [day]: { ...slot, open: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6EAF0] font-mono-num text-xs disabled:opacity-40"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="time"
                          disabled={!slot.enabled}
                          value={slot.close}
                          onChange={(e) =>
                            setWorkingHours((prev) => ({
                              ...prev,
                              [day]: { ...slot, close: e.target.value },
                            }))
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6EAF0] font-mono-num text-xs disabled:opacity-40"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" onClick={() => void handleSaveAvailability()} className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold">
                Save Schedule
              </button>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Customer Messages</h1>
              {providerBookings.length === 0 ? (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center text-sm text-[#667085]">
                  Conversations appear here once customers book or request a quotation.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-4 bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0] max-h-[420px] overflow-y-auto">
                    {providerBookings.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className={`w-full text-left p-4 ${activeMessageBooking?.id === b.id ? 'bg-[#E6F6F3]' : 'hover:bg-[#F7F9FC]'}`}
                      >
                        <div className="text-xs font-mono-num text-[#667085]">{b.referenceCode}</div>
                        <div className="text-sm font-bold text-[#132238] truncate">{b.customerName}</div>
                        <div className="text-xs text-[#667085] truncate">{b.serviceTitle}</div>
                      </button>
                    ))}
                  </div>
                  <div className="md:col-span-8">
                    {activeMessageBooking && (
                      <BookingMessagesPanel booking={activeMessageBooking} viewerRole="provider" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'earnings' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Earnings & Subscription Plan</h1>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                  <div className="text-xs text-[#667085]">Completed Revenue</div>
                  <div className="font-mono-num text-2xl font-bold text-[#132238] mt-1">{formatCurrency(kpis.totalEarnings)}</div>
                </div>
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                  <div className="text-xs text-[#667085]">Pending Settlement</div>
                  <div className="font-mono-num text-2xl font-bold text-[#132238] mt-1">{formatCurrency(kpis.pendingPayments)}</div>
                </div>
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                  <div className="text-xs text-[#667085]">Platform Commission ({settings.commissionRatePercent}%)</div>
                  <div className="font-mono-num text-2xl font-bold text-[#132238] mt-1">
                    {formatCurrency((kpis.totalEarnings * (settings.commissionRatePercent || 10)) / 100)}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-[#132238]">Available Provider Plans</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(settings.subscriptionPlans || []).map((plan) => {
                    const isCurrent = (myProvider?.subscriptionTier || 'free') === plan.id;
                    return (
                      <div key={plan.id} className={`p-5 rounded-xl border ${isCurrent ? 'border-[#0D9488] bg-[#E6F6F3]/40' : 'border-[#E6EAF0]'}`}>
                        <div className="text-sm font-bold text-[#132238]">{plan.name}</div>
                        <div className="font-mono-num text-xl font-bold text-[#132238] mt-1">
                          {plan.monthlyPriceKsh === 0 ? 'Free' : `${formatCurrency(plan.monthlyPriceKsh)} / mo`}
                        </div>
                        <ul className="mt-3 space-y-1.5 text-xs text-[#667085]">
                          {plan.features.map((f) => <li key={f}>· {f}</li>)}
                        </ul>
                        <button
                          type="button"
                          disabled={isCurrent}
                          onClick={async () => {
                            await ensureProviderDocExists();
                            await updateDoc(doc(db, 'providers', uid), { subscriptionTier: plan.id, updatedAt: serverTimestamp() });
                            setStatusMsg(`Switched plan to ${plan.name}.`);
                          }}
                          className="mt-4 w-full py-2 rounded-lg border border-[#E6EAF0] bg-white text-xs font-semibold text-[#132238] disabled:opacity-50"
                        >
                          {isCurrent ? 'Current Plan' : 'Select Plan'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-5">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Customer Reviews ({myReviews.length})</h1>
              {myReviews.length === 0 ? (
                <p className="text-sm text-[#667085]">No verified customer reviews yet.</p>
              ) : (
                <div className="divide-y divide-[#E6EAF0]">
                  {myReviews.map((rev) => (
                    <div key={rev.id} className="py-4 space-y-2">
                      <div className="flex justify-between text-sm font-semibold">
                        <span>{rev.customerName} · {rev.serviceTitle}</span>
                        <span className="font-mono-num">{rev.overallRating}/5</span>
                      </div>
                      <p className="text-sm text-[#667085]">{rev.comment}</p>
                      {rev.providerResponse ? (
                        <div className="p-3 rounded-lg bg-[#F7F9FC] text-xs text-[#182230]">
                          <strong>Your Response:</strong> {rev.providerResponse}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={replyTexts[rev.id] || ''}
                            onChange={(e) => setReplyTexts((p) => ({ ...p, [rev.id]: e.target.value }))}
                            placeholder="Write a professional reply..."
                            className="flex-1 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              const txt = (replyTexts[rev.id] || '').trim();
                              if (!txt) return;
                              await updateDoc(doc(db, 'reviews', rev.id), {
                                providerResponse: txt.slice(0, 1000),
                                updatedAt: serverTimestamp(),
                              });
                              setStatusMsg('Response posted.');
                            }}
                            className="px-3 py-1.5 rounded-lg bg-[#132238] text-white text-xs font-semibold"
                          >
                            Reply
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quotation Builder Modal */}
      {quoteBooking && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/60 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitQuote} className="bg-white border border-[#E6EAF0] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-[#132238]">
                Build Quotation ({quoteBooking.referenceCode})
              </h3>
              <button
                type="button"
                disabled={aiBusy}
                onClick={async () => {
                  const res = await callAiAssist('quote_draft', quoteBooking.jobDescription, quoteBooking.serviceTitle);
                  if (res?.result) {
                    setQuoteNotes(res.result.quotationNotes || '');
                    setQuoteDuration(res.result.estimatedDuration || '2 hours');
                    if (Array.isArray(res.result.items) && res.result.items.length > 0) {
                      setQuoteItems(res.result.items.map((it: any) => ({ label: it.label, detail: it.detail, amount: 0 })));
                    }
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#0D9488]" />
                {aiBusy ? 'Structuring...' : 'AI Structure Scope'}
              </button>
            </div>
            <p className="text-xs text-[#667085] bg-[#F7F9FC] p-3 rounded-lg">{quoteBooking.jobDescription}</p>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-[#182230]">Line Items (Approve final KSh prices)</div>
              {quoteItems.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    required
                    value={item.label}
                    onChange={(e) => {
                      const next = [...quoteItems];
                      next[idx] = { ...item, label: e.target.value };
                      setQuoteItems(next);
                    }}
                    placeholder="Item description"
                    className="col-span-8 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs"
                  />
                  <input
                    type="number"
                    min={0}
                    required
                    value={item.amount}
                    onChange={(e) => {
                      const next = [...quoteItems];
                      next[idx] = { ...item, amount: Number(e.target.value) };
                      setQuoteItems(next);
                    }}
                    className="col-span-4 px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-mono-num"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => setQuoteItems((p) => [...p, { label: '', detail: '', amount: 0 }])}
                className="text-xs font-semibold text-[#0D9488]"
              >
                + Add line item
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">Estimated Duration</label>
                <input type="text" value={quoteDuration} onChange={(e) => setQuoteDuration(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">Valid Until</label>
                <input type="date" value={quoteExpiry} onChange={(e) => setQuoteExpiry(e.target.value)} className="w-full px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1">What is included / Scope Notes</label>
              <textarea rows={2} value={quoteNotes} onChange={(e) => setQuoteNotes(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-xs" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[#E6EAF0]">
              <div className="font-mono-num text-sm font-bold text-[#132238]">
                Total: {formatCurrency(quoteItems.reduce((s, i) => s + (Number(i.amount) || 0), 0))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => setQuoteBooking(null)} className="px-4 py-2 text-xs text-[#667085]">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold">Send Quotation</button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
