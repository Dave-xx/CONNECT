import React, { useMemo, useState } from 'react';
import { X, Calendar, MapPin, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import { useMarketplace } from '../../context/MarketplaceContext.tsx';
import { KENYA_CITIES } from '../../data/marketplaceSeed.ts';
import { Booking, PaymentMethod, ProviderProfile, ServiceListing } from '../../types/index.ts';
import {
  computeAvailableTimeSlots,
  formatCurrency,
  generateBookingReference,
  generateSafeId,
} from '../../lib/utils.ts';

interface BookingModalProps {
  provider: ProviderProfile;
  initialService?: ServiceListing | null;
  initialMode?: 'direct' | 'quote';
  onClose: () => void;
  onSuccess: (bookingRef: string) => void;
  onRequireLogin: () => void;
}

export function BookingModal({
  provider,
  initialService,
  initialMode = 'direct',
  onClose,
  onSuccess,
  onRequireLogin,
}: BookingModalProps) {
  const { firebaseUser, account } = useAuth();
  const { services, settings, createNotification } = useMarketplace();

  const providerServices = useMemo(
    () => services.filter((s) => s.providerId === provider.uid && s.status === 'active'),
    [services, provider.uid]
  );

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    initialService?.id || providerServices[0]?.id || ''
  );
  const selectedService = providerServices.find((s) => s.id === selectedServiceId);

  const [bookingType, setBookingType] = useState<'direct' | 'quote'>(
    initialService?.pricingModel === 'quote' ? 'quote' : initialMode
  );
  const [customTitle, setCustomTitle] = useState(
    initialService?.title || `${(provider.categories?.[0] || 'Service').replace(/-/g, ' ')} request`
  );
  const [jobDescription, setJobDescription] = useState('');
  const [city, setCity] = useState(account?.city || provider.city || 'Nairobi');
  const [area, setArea] = useState(account?.area || provider.serviceAreas?.[0] || 'Westlands');
  const [exactAddress, setExactAddress] = useState(account?.savedAddresses?.[0]?.streetNote || '');
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86_400_000);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash_outside_platform');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdRef, setCreatedRef] = useState<string | null>(null);

  const availableSlots = useMemo(() => {
    // Filter against provider's working hours (and any visible bookings)
    return computeAvailableTimeSlots(
      scheduledDate,
      provider.workingHours,
      [],
      selectedService?.estimatedDurationMins || 60
    );
  }, [scheduledDate, provider.workingHours, selectedService]);

  const effectiveTime = availableSlots.includes(scheduledTime)
    ? scheduledTime
    : availableSlots[0] || '';

  const cityAreas = KENYA_CITIES.find((c) => c.city === city)?.areas || ['Central'];
  const effectivePrice =
    bookingType === 'quote'
      ? 0
      : selectedService?.price ?? provider.startingPrice ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    if (!firebaseUser || !account) {
      onRequireLogin();
      return;
    }
    if (firebaseUser.uid === provider.uid) {
      setError('You cannot book your own provider profile.');
      return;
    }
    if (jobDescription.trim().length < 8) {
      setError('Please describe the job in at least 8 characters so the professional can prepare.');
      return;
    }
    if (!area.trim()) {
      setError('Please specify your neighborhood or area.');
      return;
    }
    if (!effectiveTime) {
      setError('No available time slots on the selected date. Please pick another working day.');
      return;
    }

    setSubmitting(true);
    const bookingId = generateSafeId('bkg');
    const referenceCode = generateBookingReference();
    const commissionRate = settings.commissionRatePercent ?? 10;
    const commissionAmount = Math.round((effectivePrice * commissionRate) / 100);

    const bookingDoc: Omit<Booking, 'id'> = {
      referenceCode,
      customerId: firebaseUser.uid,
      customerName: account.fullName || firebaseUser.displayName || 'Customer',
      providerId: provider.uid,
      providerName: provider.businessName || provider.displayName,
      serviceId: selectedService?.id || '',
      serviceTitle: selectedService?.title || customTitle.trim() || 'Custom Service Request',
      categorySlug: selectedService?.categorySlug || provider.categories?.[0] || 'home-repairs',
      bookingType,
      jobDescription: jobDescription.trim().slice(0, 2000),
      city,
      area: area.trim().slice(0, 100),
      exactAddress: exactAddress.trim().slice(0, 300),
      scheduledDate,
      scheduledTime: effectiveTime,
      price: effectivePrice,
      commissionAmount,
      currency: settings.defaultCurrency || 'KSh',
      paymentMethod,
      paymentStatus: 'unpaid',
      status: bookingType === 'quote' ? 'awaiting_quotation' : 'requested',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(db, 'bookings', bookingId), bookingDoc);
      await createNotification({
        userId: provider.uid,
        title: bookingType === 'quote' ? 'New quotation request' : 'New booking request',
        body: `${bookingDoc.customerName} requested ${bookingDoc.serviceTitle} in ${bookingDoc.area}, ${bookingDoc.city} (${referenceCode}).`,
        type: bookingType === 'quote' ? 'quote' : 'booking',
        link: '/provider/bookings',
      });
      setCreatedRef(referenceCode);
      onSuccess(referenceCode);
    } catch (err: any) {
      try {
        handleFirestoreError(err, OperationType.CREATE, `bookings/${bookingId}`);
      } catch (wrapped: any) {
        setError('Unable to submit booking right now. Please verify your details and try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#0D1B2A]/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-white border border-[#E6EAF0] rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#E6EAF0]">
          <div>
            <h2 id="booking-modal-title" className="font-display text-xl font-bold text-[#132238]">
              {createdRef
                ? 'Request Confirmed'
                : bookingType === 'quote'
                ? `Request Quote from ${provider.businessName || provider.displayName}`
                : `Book ${provider.businessName || provider.displayName}`}
            </h2>
            <p className="text-xs text-[#667085] mt-1">
              {provider.city} · Africa/Nairobi (EAT)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-lg text-[#667085] hover:bg-[#F7F9FC] hover:text-[#182230]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {createdRef ? (
          <div className="py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#16A36A]/10 text-[#16A36A] flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <p className="text-xs text-[#667085] uppercase tracking-wider font-semibold">
                Booking Reference
              </p>
              <p className="font-mono-num text-2xl font-bold text-[#132238] mt-1">{createdRef}</p>
            </div>
            <p className="text-sm text-[#667085] max-w-sm mx-auto leading-relaxed">
              Your {bookingType === 'quote' ? 'quotation request' : 'booking request'} has been recorded and sent to{' '}
              <span className="font-semibold text-[#182230]">{provider.businessName || provider.displayName}</span>.
              Track status updates and message them directly from your dashboard.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-5">
            {/* Booking Method Toggle */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl">
              <button
                type="button"
                onClick={() => setBookingType('direct')}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  bookingType === 'direct'
                    ? 'bg-white text-[#132238] border border-[#E6EAF0]'
                    : 'text-[#667085] hover:text-[#182230]'
                }`}
              >
                Direct Booking
              </button>
              <button
                type="button"
                onClick={() => setBookingType('quote')}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  bookingType === 'quote'
                    ? 'bg-white text-[#132238] border border-[#E6EAF0]'
                    : 'text-[#667085] hover:text-[#182230]'
                }`}
              >
                Request a Quote
              </button>
            </div>

            {providerServices.length > 0 ? (
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Select Service
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm text-[#182230] bg-white focus:outline-none focus:border-[#0D9488]"
                >
                  {providerServices.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} — {s.pricingModel === 'quote' ? 'Custom Quote' : formatCurrency(s.price)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Service Needed
                </label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="e.g., Kitchen sink pipe repair"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                Describe the Job
              </label>
              <textarea
                required
                rows={3}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Share clear details, access notes, or symptoms (e.g., kitchen trap leaking under sink, 2nd floor apartment)."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  City
                </label>
                <select
                  value={city}
                  onChange={(e) => {
                    setCity(e.target.value);
                    const nextAreas = KENYA_CITIES.find((c) => c.city === e.target.value)?.areas || [];
                    if (nextAreas.length) setArea(nextAreas[0]);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm bg-white focus:outline-none focus:border-[#0D9488]"
                >
                  {KENYA_CITIES.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Neighborhood / Area
                </label>
                <input
                  type="text"
                  list="area-suggestions"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
                />
                <datalist id="area-suggestions">
                  {cityAreas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#0D9488]" />
                Exact Street / Apartment (Private — only shared with this provider)
              </label>
              <input
                type="text"
                value={exactAddress}
                onChange={(e) => setExactAddress(e.target.value)}
                placeholder="Road name, estate, gate or apartment number"
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#0D9488]" />
                  Preferred Date
                </label>
                <input
                  type="date"
                  required
                  min={new Date().toISOString().split('T')[0]}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Available Time Slot
                </label>
                {availableSlots.length > 0 ? (
                  <select
                    value={effectiveTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm bg-white font-mono-num focus:outline-none focus:border-[#0D9488]"
                  >
                    {availableSlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot} EAT
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="px-3.5 py-2.5 rounded-lg border border-[#E9A23B]/40 bg-[#E9A23B]/10 text-xs text-[#182230]">
                    Provider is closed on this day. Select another date.
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                Preferred Payment Arrangement
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm bg-white focus:outline-none focus:border-[#0D9488]"
              >
                <option value="cash_outside_platform">Direct Cash / M-Pesa on Completion (Outside Platform)</option>
                <option value="mpesa_pending">M-Pesa Express (Daraja integration pending credentials)</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>

            <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] flex items-center justify-between text-sm">
              <div className="flex items-center gap-2 text-[#667085]">
                <Shield className="w-4 h-4 text-[#0D9488]" />
                <span>{bookingType === 'quote' ? 'Estimated Cost' : 'Service Price'}</span>
              </div>
              <span className="font-mono-num font-bold text-[#132238]">
                {bookingType === 'quote'
                  ? 'Provider will quote'
                  : effectivePrice > 0
                  ? formatCurrency(effectivePrice)
                  : 'To be confirmed'}
              </span>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#DC5353]/10 border border-[#DC5353]/30 text-xs text-[#DC5353] flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-lg border border-[#E6EAF0] text-sm font-medium text-[#667085] hover:text-[#182230]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || availableSlots.length === 0}
                className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] disabled:opacity-50 transition-colors"
              >
                {submitting
                  ? 'Submitting...'
                  : bookingType === 'quote'
                  ? 'Submit Quote Request'
                  : 'Confirm Booking Request'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
