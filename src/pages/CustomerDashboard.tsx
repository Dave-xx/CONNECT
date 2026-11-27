import React, { useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Compass,
  CalendarCheck,
  Heart,
  MessageSquare,
  Star,
  User,
  Bell,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Trash2,
} from 'lucide-react';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import { Booking, ProviderProfile } from '../types/index.ts';
import { formatCurrency, generateSafeId, getBookingStatusLabel } from '../lib/utils.ts';
import { BookingMessagesPanel } from '../components/messaging/BookingMessagesPanel.tsx';
import { ServicesDiscoveryPage } from './ServicesDiscoveryPage.tsx';
import { ProviderCard } from '../components/marketplace/ProviderCard.tsx';
import { KENYA_CITIES } from '../data/marketplaceSeed.ts';

interface CustomerDashboardProps {
  subPath: string;
  navigate: (to: string) => void;
  onBookProvider: (provider: ProviderProfile) => void;
}

export function CustomerDashboard({ subPath, navigate, onBookProvider }: CustomerDashboardProps) {
  const { firebaseUser, account, signOut, updateAccountProfile } = useAuth();
  const {
    customerBookings,
    favorites,
    providers,
    reviews,
    notifications,
    markNotificationRead,
    createNotification,
    getProviderRatingStats,
    toggleFavorite,
    isFavorited,
  } = useMarketplace();

  const activeTab = subPath.replace('/app/', '').split('/')[0] || 'dashboard';

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Booking | null>(null);
  const [disputeTarget, setDisputeTarget] = useState<Booking | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Booking | null>(null);

  // Review form state
  const [revOverall, setRevOverall] = useState(5);
  const [revProf, setRevProf] = useState(5);
  const [revQuality, setRevQuality] = useState(5);
  const [revPunctual, setRevPunctual] = useState(5);
  const [revComm, setRevComm] = useState(5);
  const [revComment, setRevComment] = useState('');

  // Dispute & Cancel state
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeDesc, setDisputeDesc] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Profile / Settings state
  const [editName, setEditName] = useState(account?.fullName || '');
  const [editPhone, setEditPhone] = useState(account?.phone || '');
  const [editCity, setEditCity] = useState(account?.city || 'Nairobi');
  const [editArea, setEditArea] = useState(account?.area || '');
  const [addrLabel, setAddrLabel] = useState('Home');
  const [addrStreet, setAddrStreet] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const myReviews = useMemo(
    () => reviews.filter((r) => r.customerId === firebaseUser?.uid),
    [reviews, firebaseUser]
  );

  const completedAwaitingReview = useMemo(
    () =>
      customerBookings.filter(
        (b) => b.status === 'completed' && !myReviews.some((r) => r.bookingId === b.id)
      ),
    [customerBookings, myReviews]
  );

  const unreadNotifs = notifications.filter((n) => !n.isRead);

  const upcomingCount = customerBookings.filter((b) =>
    ['requested', 'confirmed', 'provider_en_route'].includes(b.status)
  ).length;
  const activeCount = customerBookings.filter((b) => b.status === 'in_progress').length;
  const completedCount = customerBookings.filter((b) => b.status === 'completed').length;
  const quoteCount = customerBookings.filter((b) =>
    ['awaiting_quotation', 'quotation_sent', 'awaiting_customer_approval'].includes(b.status)
  ).length;

  const handleAcceptQuote = async (b: Booking) => {
    try {
      await updateDoc(doc(db, 'bookings', b.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        userId: b.providerId,
        title: `Quotation accepted (${b.referenceCode})`,
        body: `${b.customerName} accepted your quotation of ${formatCurrency(b.price, b.currency)}.`,
        type: 'booking',
        link: '/provider/bookings',
      });
      setActionMessage(`Quotation accepted for ${b.referenceCode}. Booking is now confirmed.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${b.id}`);
    }
  };

  const handleConfirmCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTarget) return;
    try {
      await updateDoc(doc(db, 'bookings', cancelTarget.id), {
        status: 'cancelled',
        cancellationReason: cancelReason.trim().slice(0, 500) || 'Cancelled by customer',
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        userId: cancelTarget.providerId,
        title: `Booking cancelled (${cancelTarget.referenceCode})`,
        body: `${cancelTarget.customerName} cancelled the booking.`,
        type: 'booking',
        link: '/provider/bookings',
      });
      setCancelTarget(null);
      setCancelReason('');
      setActionMessage(`Booking ${cancelTarget.referenceCode} cancelled.`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `bookings/${cancelTarget.id}`);
    }
  };

  const handleOpenDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disputeTarget || !firebaseUser) return;
    const disputeId = generateSafeId('dsp');
    try {
      await setDoc(doc(db, 'disputes', disputeId), {
        bookingId: disputeTarget.id,
        bookingReference: disputeTarget.referenceCode,
        customerId: firebaseUser.uid,
        providerId: disputeTarget.providerId,
        openedBy: firebaseUser.uid,
        reason: disputeReason.trim().slice(0, 200),
        description: disputeDesc.trim().slice(0, 2000),
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'bookings', disputeTarget.id), {
        status: 'disputed',
        updatedAt: serverTimestamp(),
      });
      setDisputeTarget(null);
      setDisputeReason('');
      setDisputeDesc('');
      setActionMessage('Dispute submitted for administrator review.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `disputes/${disputeId}`);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget || !firebaseUser || !account) return;
    try {
      await setDoc(doc(db, 'reviews', reviewTarget.id), {
        bookingId: reviewTarget.id,
        customerId: firebaseUser.uid,
        customerName: account.fullName,
        providerId: reviewTarget.providerId,
        serviceTitle: reviewTarget.serviceTitle,
        overallRating: revOverall,
        professionalism: revProf,
        quality: revQuality,
        punctuality: revPunctual,
        communication: revComm,
        comment: revComment.trim().slice(0, 1500),
        isReported: false,
        isHidden: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      await createNotification({
        userId: reviewTarget.providerId,
        title: 'New verified review received',
        body: `${account.fullName} rated ${reviewTarget.serviceTitle} ${revOverall}/5.`,
        type: 'review',
        link: '/provider/reviews',
      });
      setReviewTarget(null);
      setRevComment('');
      setActionMessage('Thank you! Your verified booking review is live.');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `reviews/${reviewTarget.id}`);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim()) return;
    const next = [
      ...(account?.savedAddresses || []),
      {
        id: generateSafeId('addr'),
        label: addrLabel,
        city: editCity,
        area: editArea || 'Central',
        streetNote: addrStreet.trim(),
      },
    ].slice(0, 10);
    await updateAccountProfile({ savedAddresses: next });
    setAddrStreet('');
    setActionMessage('Address saved.');
  };

  const handleDeleteAccount = async () => {
    if (!firebaseUser) return;
    try {
      await deleteDoc(doc(db, 'users', firebaseUser.uid));
      await signOut();
      navigate('/');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${firebaseUser.uid}`);
    }
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, path: '/app/dashboard' },
    { id: 'discover', label: 'Discover', icon: Compass, path: '/app/discover' },
    { id: 'bookings', label: 'My Bookings', icon: CalendarCheck, path: '/app/bookings' },
    { id: 'favorites', label: 'Saved', icon: Heart, path: '/app/favorites' },
    { id: 'messages', label: 'Messages', icon: MessageSquare, path: '/app/messages' },
    { id: 'reviews', label: 'Reviews', icon: Star, path: '/app/reviews' },
    { id: 'profile', label: 'Profile & Settings', icon: User, path: '/app/profile' },
  ];

  const activeMessageBooking =
    customerBookings.find((b) => b.id === selectedBookingId) || customerBookings[0] || null;

  return (
    <div className="min-h-[82vh] bg-[#F7F9FC] pb-20 lg:pb-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block lg:col-span-3 space-y-4">
          <div className="bg-white border border-[#E6EAF0] rounded-2xl p-4 space-y-1">
            <div className="px-3 py-2 mb-2 border-b border-[#E6EAF0]">
              <div className="text-xs text-[#667085]">Customer Workspace</div>
              <div className="font-display text-sm font-bold text-[#132238] truncate">
                {account?.fullName}
              </div>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id || (item.id === 'profile' && activeTab === 'settings');
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? 'bg-[#E6F6F3] text-[#0D9488]'
                      : 'text-[#667085] hover:bg-[#F7F9FC] hover:text-[#132238]'
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

        {/* Main Content */}
        <div className="lg:col-span-9 space-y-6">
          {actionMessage && (
            <div className="p-3.5 rounded-xl bg-[#16A36A]/10 border border-[#16A36A]/30 text-xs font-medium text-[#16A36A] flex items-center justify-between">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {actionMessage}
              </span>
              <button type="button" onClick={() => setActionMessage(null)} className="underline">
                Dismiss
              </button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-[#132238]">
                    Hello, {account?.fullName?.split(' ')[0] || 'there'}
                  </h1>
                  <p className="text-sm text-[#667085]">
                    Track bookings, compare quotations, and manage your saved professionals.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/services')}
                  className="px-4 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] self-start"
                >
                  Find a Professional
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Upcoming Bookings', value: upcomingCount },
                  { label: 'Active Jobs', value: activeCount },
                  { label: 'Pending Quotations', value: quoteCount },
                  { label: 'Completed Jobs', value: completedCount },
                ].map((kpi) => (
                  <div key={kpi.label} className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                    <div className="text-xs text-[#667085]">{kpi.label}</div>
                    <div className="font-mono-num text-2xl font-bold text-[#132238] mt-1">
                      {kpi.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Recent Notifications */}
              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-base font-bold text-[#132238] flex items-center gap-2">
                    <Bell className="w-4 h-4 text-[#0D9488]" />
                    Notifications ({unreadNotifs.length} unread)
                  </h2>
                </div>
                {notifications.length === 0 ? (
                  <p className="text-sm text-[#667085]">No notifications yet.</p>
                ) : (
                  <div className="divide-y divide-[#E6EAF0]">
                    {notifications.slice(0, 5).map((n) => (
                      <div key={n.id} className="py-3 flex items-start justify-between gap-4">
                        <div>
                          <div className={`text-sm ${n.isRead ? 'text-[#667085]' : 'font-semibold text-[#132238]'}`}>
                            {n.title}
                          </div>
                          <div className="text-xs text-[#667085] mt-0.5">{n.body}</div>
                        </div>
                        {!n.isRead && (
                          <button
                            type="button"
                            onClick={() => void markNotificationRead(n.id)}
                            className="text-xs text-[#0D9488] hover:underline shrink-0"
                          >
                            Mark read
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'discover' && (
            <ServicesDiscoveryPage
              searchParams={new URLSearchParams()}
              navigate={navigate}
              onBookProvider={onBookProvider}
            />
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">My Bookings & Quotes</h1>
              {customerBookings.length === 0 ? (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center space-y-3">
                  <p className="text-sm text-[#667085]">You haven&apos;t requested any bookings yet.</p>
                  <button
                    type="button"
                    onClick={() => navigate('/services')}
                    className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold"
                  >
                    Browse Professionals
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {customerBookings.map((b) => (
                    <div key={b.id} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-xs text-[#667085] font-mono-num">
                            {b.referenceCode} · {b.bookingType === 'quote' ? 'Quotation Request' : 'Direct Booking'}
                          </div>
                          <h2 className="font-display text-lg font-bold text-[#132238] mt-0.5">
                            {b.serviceTitle}
                          </h2>
                          <div className="text-xs text-[#667085] mt-1">
                            Provider: <span className="font-medium text-[#182230]">{b.providerName}</span> · {b.area}, {b.city} · {b.scheduledDate} at {b.scheduledTime}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs font-semibold text-[#0D9488]">
                            {getBookingStatusLabel(b.status)}
                          </div>
                          <div className="font-mono-num text-base font-bold text-[#132238] mt-0.5">
                            {b.price > 0 ? formatCurrency(b.price, b.currency) : 'Quote pending'}
                          </div>
                        </div>
                      </div>

                      <p className="text-sm text-[#667085] leading-relaxed">{b.jobDescription}</p>

                      {b.status === 'quotation_sent' && (
                        <div className="p-4 rounded-xl bg-[#EFF5FF] border border-[#3977D5]/30 space-y-3">
                          <div className="text-sm font-bold text-[#132238]">
                            Quotation Received: {formatCurrency(b.price, b.currency)}
                          </div>
                          {b.quotationNotes && (
                            <p className="text-xs text-[#182230]">{b.quotationNotes}</p>
                          )}
                          {b.quotationItems && b.quotationItems.length > 0 && (
                            <ul className="space-y-1 text-xs text-[#182230]">
                              {b.quotationItems.map((it, idx) => (
                                <li key={idx} className="flex justify-between">
                                  <span>{it.label}</span>
                                  <span className="font-mono-num">{formatCurrency(it.amount, b.currency)}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex flex-wrap gap-2.5 pt-1">
                            <button
                              type="button"
                              onClick={() => void handleAcceptQuote(b)}
                              className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold hover:bg-[#0F766E]"
                            >
                              Accept Quotation & Confirm
                            </button>
                            <button
                              type="button"
                              onClick={() => setCancelTarget(b)}
                              className="px-4 py-2 rounded-lg border border-[#E6EAF0] bg-white text-xs font-semibold text-[#DC5353]"
                            >
                              Decline Quote
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-[#E6EAF0]">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingId(b.id);
                            navigate('/app/messages');
                          }}
                          className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#182230] hover:bg-[#F7F9FC]"
                        >
                          Message Provider
                        </button>
                        {['requested', 'awaiting_quotation', 'confirmed'].includes(b.status) && (
                          <button
                            type="button"
                            onClick={() => setCancelTarget(b)}
                            className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#DC5353] hover:bg-[#DC5353]/5"
                          >
                            Cancel Booking
                          </button>
                        )}
                        {['confirmed', 'in_progress'].includes(b.status) && (
                          <button
                            type="button"
                            onClick={() => setDisputeTarget(b)}
                            className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#E9A23B]"
                          >
                            Report Issue
                          </button>
                        )}
                        {b.status === 'completed' && !myReviews.some((r) => r.bookingId === b.id) && (
                          <button
                            type="button"
                            onClick={() => setReviewTarget(b)}
                            className="px-4 py-2 rounded-lg bg-[#132238] text-white text-xs font-semibold"
                          >
                            Write Verified Review
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Saved Professionals</h1>
              {favorites.length === 0 ? (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center text-sm text-[#667085]">
                  No saved professionals yet. Heart any provider profile to save them here.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {favorites.map((fav) => {
                    const prov = providers.find((p) => p.uid === fav.providerId);
                    if (!prov) return null;
                    const stats = getProviderRatingStats(prov.uid);
                    return (
                      <ProviderCard
                        key={fav.id}
                        provider={prov}
                        avgRating={stats.avgRating}
                        reviewCount={stats.reviewCount}
                        isFavorited={isFavorited(prov.uid)}
                        onViewProfile={() => navigate(`/providers/${prov.slug}`)}
                        onBook={() => onBookProvider(prov)}
                        onToggleFavorite={() => void toggleFavorite(prov)}
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Messages</h1>
              {customerBookings.length === 0 ? (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center text-sm text-[#667085]">
                  Start a booking or quotation request to message a service provider.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                  <div className="md:col-span-4 bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0] max-h-[420px] overflow-y-auto">
                    {customerBookings.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => setSelectedBookingId(b.id)}
                        className={`w-full text-left p-4 transition-colors ${
                          activeMessageBooking?.id === b.id ? 'bg-[#E6F6F3]' : 'hover:bg-[#F7F9FC]'
                        }`}
                      >
                        <div className="text-xs font-mono-num text-[#667085]">{b.referenceCode}</div>
                        <div className="text-sm font-bold text-[#132238] truncate">{b.providerName}</div>
                        <div className="text-xs text-[#667085] truncate">{b.serviceTitle}</div>
                      </button>
                    ))}
                  </div>
                  <div className="md:col-span-8">
                    {activeMessageBooking && (
                      <BookingMessagesPanel booking={activeMessageBooking} viewerRole="customer" />
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Reviews</h1>
              {completedAwaitingReview.length > 0 && (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3">
                  <h2 className="font-display text-base font-bold text-[#132238]">
                    Completed Bookings Awaiting Review
                  </h2>
                  {completedAwaitingReview.map((b) => (
                    <div key={b.id} className="flex items-center justify-between py-2 border-t border-[#E6EAF0] first:border-0">
                      <div>
                        <div className="text-sm font-semibold text-[#132238]">{b.serviceTitle}</div>
                        <div className="text-xs text-[#667085]">{b.providerName} · {b.referenceCode}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewTarget(b)}
                        className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold"
                      >
                        Leave Review
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-[#132238]">
                  Submitted Reviews ({myReviews.length})
                </h2>
                {myReviews.length === 0 ? (
                  <p className="text-sm text-[#667085]">You haven&apos;t submitted any reviews yet.</p>
                ) : (
                  <div className="divide-y divide-[#E6EAF0]">
                    {myReviews.map((r) => (
                      <div key={r.id} className="py-3 space-y-1">
                        <div className="flex justify-between text-sm font-semibold text-[#132238]">
                          <span>{r.serviceTitle || 'Verified Service'}</span>
                          <span className="font-mono-num">{r.overallRating}/5</span>
                        </div>
                        <p className="text-sm text-[#667085]">{r.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {(activeTab === 'profile' || activeTab === 'settings') && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Profile & Settings</h1>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-[#132238]">Personal Details</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Full Name</label>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Phone</label>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Default City</label>
                    <select
                      value={editCity}
                      onChange={(e) => setEditCity(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm bg-white"
                    >
                      {KENYA_CITIES.map((c) => (
                        <option key={c.city} value={c.city}>{c.city}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1">Neighborhood</label>
                    <input
                      type="text"
                      value={editArea}
                      onChange={(e) => setEditArea(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void updateAccountProfile({
                      fullName: editName,
                      phone: editPhone,
                      city: editCity,
                      area: editArea,
                    }).then(() => setActionMessage('Profile updated.'))
                  }
                  className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E]"
                >
                  Save Profile
                </button>
              </div>

              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
                <h2 className="font-display text-base font-bold text-[#132238]">Saved Addresses</h2>
                {(account?.savedAddresses || []).length > 0 && (
                  <div className="space-y-2">
                    {account?.savedAddresses?.map((a) => (
                      <div key={a.id} className="p-3 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] text-xs flex justify-between">
                        <div>
                          <span className="font-bold text-[#132238]">{a.label}: </span>
                          <span className="text-[#667085]">{a.streetNote}, {a.area}, {a.city}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleAddAddress} className="flex flex-col sm:flex-row gap-2.5">
                  <input
                    type="text"
                    value={addrLabel}
                    onChange={(e) => setAddrLabel(e.target.value)}
                    placeholder="Label (Home, Office)"
                    className="sm:w-36 px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm"
                  />
                  <input
                    type="text"
                    value={addrStreet}
                    onChange={(e) => setAddrStreet(e.target.value)}
                    placeholder="Street, apartment, or gate instructions"
                    className="flex-1 px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#132238] text-white text-xs font-semibold"
                  >
                    Add Address
                  </button>
                </form>
              </div>

              {/* Privacy & Account Deletion */}
              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3">
                <h2 className="font-display text-base font-bold text-[#DC5353]">Account & Data Deletion</h2>
                <p className="text-xs text-[#667085]">
                  Under the Kenya Data Protection Act, you may permanently delete your ServiceConnect customer profile data.
                </p>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DC5353]/40 text-xs font-semibold text-[#DC5353]"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Request Account Deletion
                  </button>
                ) : (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => void handleDeleteAccount()}
                      className="px-4 py-2 rounded-lg bg-[#DC5353] text-white text-xs font-semibold"
                    >
                      Confirm Permanent Deletion
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="text-xs text-[#667085]"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Customer mobile navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-[#E6EAF0] grid grid-cols-5 h-14"
      >
        {[
          { id: 'dashboard', label: 'Home', icon: LayoutDashboard, path: '/app/dashboard' },
          { id: 'discover', label: 'Search', icon: Compass, path: '/app/discover' },
          { id: 'bookings', label: 'Bookings', icon: CalendarCheck, path: '/app/bookings' },
          { id: 'messages', label: 'Chat', icon: MessageSquare, path: '/app/messages' },
          { id: 'profile', label: 'Profile', icon: User, path: '/app/profile' },
        ].map((m) => {
          const Icon = m.icon;
          const active = activeTab === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => navigate(m.path)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${
                active ? 'text-[#0D9488]' : 'text-[#667085]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{m.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Verified Review Modal */}
      {reviewTarget && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/60 flex items-center justify-center p-4">
          <form onSubmit={handleSubmitReview} className="bg-white border border-[#E6EAF0] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#132238]">
              Review {reviewTarget.providerName}
            </h3>
            <p className="text-xs text-[#667085]">Verified booking: {reviewTarget.referenceCode}</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              {[
                { label: 'Overall', val: revOverall, set: setRevOverall },
                { label: 'Professionalism', val: revProf, set: setRevProf },
                { label: 'Quality', val: revQuality, set: setRevQuality },
                { label: 'Punctuality', val: revPunctual, set: setRevPunctual },
                { label: 'Communication', val: revComm, set: setRevComm },
              ].map((f) => (
                <div key={f.label}>
                  <label className="block font-semibold text-[#182230] mb-1">{f.label} (1–5)</label>
                  <select
                    value={f.val}
                    onChange={(e) => f.set(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 rounded-lg border border-[#E6EAF0] bg-white"
                  >
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1">Written Feedback</label>
              <textarea
                required
                minLength={5}
                rows={3}
                value={revComment}
                onChange={(e) => setRevComment(e.target.value)}
                placeholder="Describe the quality of work and punctuality..."
                className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReviewTarget(null)} className="px-4 py-2 text-xs text-[#667085]">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold">
                Submit Review
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cancel Modal */}
      {cancelTarget && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/60 flex items-center justify-center p-4">
          <form onSubmit={handleConfirmCancel} className="bg-white border border-[#E6EAF0] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#132238]">
              Cancel Booking {cancelTarget.referenceCode}
            </h3>
            <textarea
              required
              rows={3}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation..."
              className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelTarget(null)} className="px-4 py-2 text-xs text-[#667085]">
                Keep Booking
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#DC5353] text-white text-xs font-semibold">
                Confirm Cancellation
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Dispute Modal */}
      {disputeTarget && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/60 flex items-center justify-center p-4">
          <form onSubmit={handleOpenDispute} className="bg-white border border-[#E6EAF0] rounded-2xl max-w-md w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#132238] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#E9A23B]" />
              Report Issue ({disputeTarget.referenceCode})
            </h3>
            <input
              type="text"
              required
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Short reason (e.g., Incomplete work, pricing mismatch)"
              className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm"
            />
            <textarea
              required
              minLength={10}
              rows={3}
              value={disputeDesc}
              onChange={(e) => setDisputeDesc(e.target.value)}
              placeholder="Describe the issue clearly for ServiceConnect administrators..."
              className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDisputeTarget(null)} className="px-4 py-2 text-xs text-[#667085]">
                Cancel
              </button>
              <button type="submit" className="px-5 py-2 rounded-lg bg-[#132238] text-white text-xs font-semibold">
                Submit Dispute
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
