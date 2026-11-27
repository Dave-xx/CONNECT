import React, { useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FolderKanban,
  CalendarCheck,
  CreditCard,
  MessageSquareWarning,
  Flag,
  Settings,
  LogOut,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import { DEFAULT_CATEGORIES } from '../data/marketplaceSeed.ts';
import {
  DisputeStatus,
  ProviderProfile,
  ProviderVerificationPrivate,
  UserAccount,
} from '../types/index.ts';
import { formatCurrency, generateSafeId, getBookingStatusLabel, getVerificationStatusLabel, slugify } from '../lib/utils.ts';

interface AdminDashboardProps {
  subPath: string;
  navigate: (to: string) => void;
}

export function AdminDashboard({ subPath, navigate }: AdminDashboardProps) {
  const { firebaseUser, signOut } = useAuth();
  const {
    providers,
    categories,
    allBookings,
    reviews,
    disputes,
    settings,
    createNotification,
  } = useMarketplace();

  const activeTab = subPath.replace('/admin/', '').split('/')[0] || 'dashboard';

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [bookingSearch, setBookingSearch] = useState('');
  const [selectedProv, setSelectedProv] = useState<ProviderProfile | null>(null);
  const [selectedProvPrivate, setSelectedProvPrivate] = useState<ProviderVerificationPrivate | null>(null);

  // Verification decision form
  const [badgeIdentity, setBadgeIdentity] = useState(true);
  const [badgeBusiness, setBadgeBusiness] = useState(false);
  const [badgeCreds, setBadgeCreds] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

  // Category creation
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Settings form
  const [commissionPct, setCommissionPct] = useState(String(settings.commissionRatePercent));
  const [citiesText, setCitiesText] = useState(settings.supportedCities.join(', '));
  const [countriesText, setCountriesText] = useState((settings.supportedCountries || []).join(', '));
  const [mpesaStatus, setMpesaStatus] = useState(settings.mpesaStatus);
  const [serverHealth, setServerHealth] = useState<{ geminiConfigured?: boolean; mpesaConfigured?: boolean } | null>(null);
  const [adminMsg, setAdminMsg] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'users'),
      (snap) => {
        setUsers(snap.docs.map((d) => d.data() as UserAccount));
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'users(admin)')
    );
    fetch('/api/health')
      .then((r) => r.json())
      .then(setServerHealth)
      .catch(() => {});
    return () => unsub();
  }, []);

  const writeAuditLog = async (action: string, targetType: string, targetId: string, details: string) => {
    if (!firebaseUser) return;
    const logId = generateSafeId('audit');
    await setDoc(doc(db, 'audit_logs', logId), {
      actorUid: firebaseUser.uid,
      actorEmail: firebaseUser.email || '',
      action,
      targetType,
      targetId,
      details: details.slice(0, 1000),
      createdAt: serverTimestamp(),
    });
  };

  const metrics = useMemo(() => {
    const customers = users.filter((u) => u.role === 'customer').length;
    const totalProviders = providers.length;
    const verifiedProviders = providers.filter((p) => p.verificationStatus === 'approved').length;
    const pendingVerif = providers.filter((p) => p.verificationStatus === 'pending_review').length;
    const completed = allBookings.filter((b) => b.status === 'completed');
    const cancelled = allBookings.filter((b) => b.status === 'cancelled').length;
    const grossVolume = completed.reduce((s, b) => s + (b.price || 0), 0);
    const estCommission = Math.round((grossVolume * (settings.commissionRatePercent || 10)) / 100);
    const openDisputes = disputes.filter((d) => ['open', 'under_investigation', 'awaiting_response'].includes(d.status)).length;
    return {
      customers,
      totalProviders,
      verifiedProviders,
      pendingVerif,
      totalBookings: allBookings.length,
      completedCount: completed.length,
      cancelled,
      grossVolume,
      estCommission,
      openDisputes,
    };
  }, [users, providers, allBookings, disputes, settings]);

  const bookingChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const b of allBookings) {
      const label = getBookingStatusLabel(b.status);
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, count]) => ({ name, count }));
  }, [allBookings]);

  const cityChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of providers) {
      counts.set(p.city, (counts.get(p.city) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([city, providersCount]) => ({ city, providersCount }));
  }, [providers]);

  const openVerificationReview = async (prov: ProviderProfile) => {
    setSelectedProv(prov);
    setBadgeIdentity(true);
    setBadgeBusiness(prov.providerType === 'business');
    setBadgeCreds(false);
    setReviewNotes('');
    try {
      const snap = await getDoc(doc(db, 'providers', prov.uid, 'private', 'verification'));
      setSelectedProvPrivate(snap.exists() ? (snap.data() as ProviderVerificationPrivate) : null);
    } catch {
      setSelectedProvPrivate(null);
    }
  };

  const applyVerificationDecision = async (decision: 'approved' | 'rejected' | 'additional_info_required' | 'suspended') => {
    if (!selectedProv || !firebaseUser) return;
    await updateDoc(doc(db, 'providers', selectedProv.uid), {
      verificationStatus: decision,
      identityVerified: decision === 'approved' ? badgeIdentity : false,
      businessVerified: decision === 'approved' ? badgeBusiness : false,
      credentialsVerified: decision === 'approved' ? badgeCreds : false,
      isSuspended: decision === 'suspended',
      updatedAt: serverTimestamp(),
    });

    if (selectedProvPrivate) {
      await updateDoc(doc(db, 'providers', selectedProv.uid, 'private', 'verification'), {
        adminReviewNotes: reviewNotes.trim().slice(0, 1000),
        reviewedBy: firebaseUser.uid,
        updatedAt: serverTimestamp(),
      });
    }

    await writeAuditLog(`verification_${decision}`, 'provider', selectedProv.uid, reviewNotes || `Status updated to ${decision}`);
    await createNotification({
      userId: selectedProv.uid,
      title: `Verification status: ${getVerificationStatusLabel(decision)}`,
      body: reviewNotes || `Your provider verification application is now ${getVerificationStatusLabel(decision)}.`,
      type: 'verification',
      link: '/provider/profile',
    });
    setSelectedProv(null);
    setAdminMsg(`Provider verification updated to ${getVerificationStatusLabel(decision)}.`);
  };

  const handleSeedDefaultCategories = async () => {
    for (const cat of DEFAULT_CATEGORIES) {
      await setDoc(doc(db, 'categories', cat.slug), {
        slug: cat.slug,
        name: cat.name,
        description: cat.description,
        iconName: cat.iconName,
        ...(cat.imageUrl ? { imageUrl: cat.imageUrl } : {}),
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
        subcategories: cat.subcategories || [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    await writeAuditLog('seed_categories', 'category', 'all', 'Initialized 16 Kenyan marketplace categories');
    setAdminMsg('16 default service categories saved to Firestore.');
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const slug = slugify(newCatName);
    if (!slug || newCatDesc.trim().length < 4) return;
    await setDoc(doc(db, 'categories', slug), {
      slug,
      name: newCatName.trim(),
      description: newCatDesc.trim(),
      iconName: 'Briefcase',
      sortOrder: categories.length + 1,
      isActive: true,
      subcategories: [],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    setNewCatName('');
    setNewCatDesc('');
    setAdminMsg(`Category "${newCatName.trim()}" created.`);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await setDoc(doc(db, 'platform_settings', 'default'), {
      commissionRatePercent: Math.max(0, Math.min(50, Number(commissionPct) || 10)),
      defaultCurrency: 'KSh',
      defaultTimezone: 'Africa/Nairobi',
      supportedCities: citiesText.split(',').map((s) => s.trim()).filter(Boolean),
      supportedCountries: countriesText.split(',').map((s) => s.trim()).filter(Boolean),
      mpesaStatus,
      subscriptionPlans: settings.subscriptionPlans || [],
      updatedAt: serverTimestamp(),
    });
    await writeAuditLog('update_platform_settings', 'platform_settings', 'default', `Commission ${commissionPct}%`);
    setAdminMsg('Platform settings saved.');
  };

  const navItems = [
    { id: 'dashboard', label: 'Overview', icon: LayoutDashboard, path: '/admin/dashboard' },
    { id: 'verifications', label: `Verifications (${metrics.pendingVerif})`, icon: ShieldCheck, path: '/admin/verifications' },
    { id: 'users', label: 'Users', icon: Users, path: '/admin/users' },
    { id: 'providers', label: 'Providers', icon: ShieldCheck, path: '/admin/providers' },
    { id: 'categories', label: 'Categories', icon: FolderKanban, path: '/admin/categories' },
    { id: 'bookings', label: 'Bookings', icon: CalendarCheck, path: '/admin/bookings' },
    { id: 'payments', label: 'Payments & M-Pesa', icon: CreditCard, path: '/admin/payments' },
    { id: 'reviews', label: 'Review Moderation', icon: Flag, path: '/admin/reviews' },
    { id: 'disputes', label: `Disputes (${metrics.openDisputes})`, icon: MessageSquareWarning, path: '/admin/disputes' },
    { id: 'settings', label: 'Platform Settings', icon: Settings, path: '/admin/settings' },
  ];

  return (
    <div className="min-h-[82vh] bg-[#F7F9FC] pb-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <aside className="lg:col-span-3">
          <div className="bg-[#132238] text-white rounded-2xl p-4 space-y-1 sticky top-20">
            <div className="px-3 py-2 mb-2 border-b border-white/10">
              <div className="text-[11px] uppercase tracking-wider text-[#E6F6F3]">Administration</div>
              <div className="font-display text-sm font-bold truncate">{firebaseUser?.email}</div>
            </div>
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.path)}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    active ? 'bg-[#0D9488] text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
            <div className="pt-2 border-t border-white/10 mt-2">
              <button
                type="button"
                onClick={() => void signOut().then(() => navigate('/'))}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-[#F28B72] hover:bg-white/10"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </aside>

        <div className="lg:col-span-9 space-y-6">
          {adminMsg && (
            <div className="p-3.5 rounded-xl bg-[#16A36A]/10 border border-[#16A36A]/30 text-xs font-medium text-[#16A36A] flex justify-between">
              <span>{adminMsg}</span>
              <button type="button" onClick={() => setAdminMsg(null)} className="underline">Dismiss</button>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Marketplace Operations Overview</h1>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Registered Users', value: users.length },
                  { label: 'Verified Providers', value: `${metrics.verifiedProviders} / ${metrics.totalProviders}` },
                  { label: 'Total Bookings', value: metrics.totalBookings },
                  { label: 'Est. Commission', value: formatCurrency(metrics.estCommission) },
                ].map((k) => (
                  <div key={k.label} className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                    <div className="text-xs text-[#667085]">{k.label}</div>
                    <div className="font-mono-num text-xl font-bold text-[#132238] mt-1">{k.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                  <h2 className="font-display text-sm font-bold text-[#132238] mb-4">Bookings by Status</h2>
                  <div className="h-56">
                    {bookingChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-[#667085]">No booking records yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={bookingChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="#0D9488" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-5">
                  <h2 className="font-display text-sm font-bold text-[#132238] mb-4">Providers by City</h2>
                  <div className="h-56">
                    {cityChartData.length === 0 ? (
                      <div className="h-full flex items-center justify-center text-xs text-[#667085]">No providers registered yet.</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={cityChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#E6EAF0" />
                          <XAxis dataKey="city" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="providersCount" fill="#132238" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'verifications' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Provider Verification Queue</h1>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0]">
                {providers.length === 0 ? (
                  <p className="p-6 text-sm text-[#667085]">No provider profiles registered yet.</p>
                ) : (
                  providers.map((p) => (
                    <div key={p.uid} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <div className="font-display text-base font-bold text-[#132238]">
                          {p.businessName || p.displayName}
                        </div>
                        <div className="text-xs text-[#667085]">
                          {p.city} · {p.providerType} · Status:{' '}
                          <span className="font-semibold text-[#0D9488]">
                            {getVerificationStatusLabel(p.verificationStatus)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void openVerificationReview(p)}
                        className="px-4 py-2 rounded-lg bg-[#132238] text-white text-xs font-semibold self-start sm:self-auto"
                      >
                        Review Application
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-[#132238]">User Management</h1>
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search name or email..."
                  className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] bg-white text-sm"
                />
              </div>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-[#E6EAF0] text-[#667085] bg-[#F7F9FC]">
                    <tr>
                      <th className="p-3.5">User</th>
                      <th className="p-3.5">Role</th>
                      <th className="p-3.5">City</th>
                      <th className="p-3.5">Status</th>
                      <th className="p-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6EAF0]">
                    {users
                      .filter((u) => !userSearch || `${u.fullName} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase()))
                      .map((u) => (
                        <tr key={u.uid}>
                          <td className="p-3.5">
                            <div className="font-semibold text-[#132238]">{u.fullName}</div>
                            <div className="text-[#667085]">{u.email}</div>
                          </td>
                          <td className="p-3.5 capitalize">{u.role}</td>
                          <td className="p-3.5">{u.city || '—'}</td>
                          <td className="p-3.5">{u.isSuspended ? 'Suspended' : 'Active'}</td>
                          <td className="p-3.5 text-right space-x-2">
                            <button
                              type="button"
                              onClick={async () => {
                                await updateDoc(doc(db, 'users', u.uid), { isSuspended: !u.isSuspended, updatedAt: serverTimestamp() });
                                await writeAuditLog(u.isSuspended ? 'restore_user' : 'suspend_user', 'user', u.uid, u.email);
                                setAdminMsg(`Updated ${u.email}.`);
                              }}
                              className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] font-semibold"
                            >
                              {u.isSuspended ? 'Restore' : 'Suspend'}
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'providers' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Providers & Sponsored Placements</h1>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0]">
                {providers.map((p) => (
                  <div key={p.uid} className="p-5 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <div className="font-bold text-sm text-[#132238]">{p.businessName || p.displayName}</div>
                      <div className="text-xs text-[#667085]">
                        {p.city} · {getVerificationStatusLabel(p.verificationStatus)} · Plan: {p.subscriptionTier.toUpperCase()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={async () => {
                          await updateDoc(doc(db, 'providers', p.uid), { isSponsored: !p.isSponsored, updatedAt: serverTimestamp() });
                          setAdminMsg(`Sponsored placement ${!p.isSponsored ? 'enabled' : 'disabled'} for ${p.displayName}.`);
                        }}
                        className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold"
                      >
                        {p.isSponsored ? 'Remove Sponsored' : 'Mark Sponsored'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-[#132238]">Category Management</h1>
                <button
                  type="button"
                  onClick={() => void handleSeedDefaultCategories()}
                  className="px-4 py-2 rounded-lg bg-[#132238] text-white text-xs font-semibold"
                >
                  Sync 16 Default Kenyan Categories
                </button>
              </div>

              <form onSubmit={handleAddCategory} className="bg-white border border-[#E6EAF0] rounded-2xl p-5 flex flex-col sm:flex-row gap-3">
                <input type="text" required value={newCatName} onChange={(e) => setNewCatName(e.target.value)} placeholder="New category name" className="px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                <input type="text" required value={newCatDesc} onChange={(e) => setNewCatDesc(e.target.value)} placeholder="Short description" className="flex-1 px-3 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
                <button type="submit" className="px-4 py-2 rounded-lg bg-[#0D9488] text-white text-xs font-semibold">Add Category</button>
              </form>

              <div className="bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0]">
                {categories.map((c) => (
                  <div key={c.slug} className="p-4 flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-bold text-[#132238]">{c.name}</div>
                      <div className="text-xs text-[#667085]">{c.description}</div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await setDoc(doc(db, 'categories', c.slug), {
                          ...c,
                          isActive: !c.isActive,
                          createdAt: c.createdAt || serverTimestamp(),
                          updatedAt: serverTimestamp(),
                        });
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold"
                    >
                      {c.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h1 className="font-display text-2xl font-bold text-[#132238]">All Bookings</h1>
                <input
                  type="text"
                  value={bookingSearch}
                  onChange={(e) => setBookingSearch(e.target.value)}
                  placeholder="Search ref (SC-...) or service..."
                  className="px-3.5 py-2 rounded-lg border border-[#E6EAF0] bg-white text-sm"
                />
              </div>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0]">
                {allBookings
                  .filter((b) => !bookingSearch || `${b.referenceCode} ${b.serviceTitle} ${b.customerName}`.toLowerCase().includes(bookingSearch.toLowerCase()))
                  .map((b) => (
                    <div key={b.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div>
                        <span className="font-mono-num font-bold text-[#132238]">{b.referenceCode}</span> · {b.serviceTitle}
                        <div className="text-[#667085] mt-0.5">{b.customerName} → {b.providerName} · {b.city}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-[#0D9488]">{getBookingStatusLabel(b.status)}</div>
                        <div className="font-mono-num font-bold text-[#132238]">{formatCurrency(b.price, b.currency)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <div className="space-y-5">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Payments & M-Pesa Readiness</h1>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#132238]">M-Pesa Daraja API Credentials</span>
                  <span className="font-mono-num text-xs font-semibold text-[#E9A23B]">
                    {serverHealth?.mpesaConfigured ? 'Configured on Server' : 'Not Configured (Outside-Platform Settlement Active)'}
                  </span>
                </div>
                <p className="text-xs text-[#667085] leading-relaxed">
                  To activate automated M-Pesa STK Push, configure MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, MPESA_PASSKEY, and MPESA_CALLBACK_URL in server environment secrets.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Review Moderation</h1>
              <div className="bg-white border border-[#E6EAF0] rounded-2xl divide-y divide-[#E6EAF0]">
                {reviews.map((r) => (
                  <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-bold text-[#132238]">
                        {r.customerName} ({r.overallRating}/5) {r.isReported ? '· Flagged' : ''}
                      </div>
                      <p className="text-xs text-[#667085] mt-0.5">{r.comment}</p>
                      {r.reportReason && <p className="text-xs text-[#DC5353] mt-1">Report: {r.reportReason}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateDoc(doc(db, 'reviews', r.id), { isHidden: !r.isHidden, updatedAt: serverTimestamp() });
                        await writeAuditLog(r.isHidden ? 'restore_review' : 'hide_review', 'review', r.id, r.comment.slice(0, 120));
                      }}
                      className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold shrink-0"
                    >
                      {r.isHidden ? 'Unhide Review' : 'Hide Review'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'disputes' && (
            <div className="space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Dispute Resolution</h1>
              {disputes.length === 0 ? (
                <div className="bg-white border border-[#E6EAF0] rounded-2xl p-8 text-center text-sm text-[#667085]">
                  No disputes open.
                </div>
              ) : (
                <div className="space-y-3">
                  {disputes.map((d) => (
                    <div key={d.id} className="bg-white border border-[#E6EAF0] rounded-2xl p-5 space-y-3">
                      <div className="flex justify-between text-sm font-bold text-[#132238]">
                        <span>{d.bookingReference || d.bookingId} · {d.reason}</span>
                        <span className="capitalize text-xs text-[#0D9488]">{d.status.replace(/_/g, ' ')}</span>
                      </div>
                      <p className="text-xs text-[#667085]">{d.description}</p>
                      <div className="flex flex-wrap gap-2">
                        {(['under_investigation', 'resolved', 'closed'] as DisputeStatus[]).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={async () => {
                              await updateDoc(doc(db, 'disputes', d.id), { status: st, updatedAt: serverTimestamp() });
                              await writeAuditLog('update_dispute', 'dispute', d.id, `Status set to ${st}`);
                              setAdminMsg(`Dispute marked ${st}.`);
                            }}
                            className="px-3 py-1.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold capitalize"
                          >
                            Mark {st.replace(/_/g, ' ')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'settings' && (
            <form onSubmit={handleSaveSettings} className="bg-white border border-[#E6EAF0] rounded-2xl p-6 space-y-4">
              <h1 className="font-display text-2xl font-bold text-[#132238]">Platform Configuration</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">Commission Rate (%)</label>
                  <input type="number" min={0} max={50} value={commissionPct} onChange={(e) => setCommissionPct(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm font-mono-num" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1">M-Pesa Integration State</label>
                  <select value={mpesaStatus} onChange={(e) => setMpesaStatus(e.target.value as any)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm bg-white">
                    <option value="not_configured">Not Configured</option>
                    <option value="sandbox_ready">Sandbox Ready</option>
                    <option value="live">Live</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">Supported Cities (comma-separated)</label>
                <input type="text" value={citiesText} onChange={(e) => setCitiesText(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">Supported Countries (expansion roadmap)</label>
                <input type="text" value={countriesText} onChange={(e) => setCountriesText(e.target.value)} className="w-full px-3.5 py-2 rounded-lg border border-[#E6EAF0] text-sm" />
              </div>
              <button type="submit" className="px-5 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold">
                Save Configuration
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Verification Review Modal */}
      {selectedProv && (
        <div className="fixed inset-0 z-50 bg-[#0D1B2A]/60 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E6EAF0] rounded-2xl max-w-lg w-full p-6 space-y-4">
            <h3 className="font-display text-lg font-bold text-[#132238]">
              Verify {selectedProv.businessName || selectedProv.displayName}
            </h3>
            {selectedProvPrivate ? (
              <div className="p-4 rounded-xl bg-[#F7F9FC] border border-[#E6EAF0] text-xs space-y-1.5">
                <div><strong>Document:</strong> {selectedProvPrivate.idDocumentLabel} (Last 4: {selectedProvPrivate.nationalIdLast4 || 'N/A'})</div>
                <div><strong>Business Reg:</strong> {selectedProvPrivate.businessRegNumber || 'None provided'}</div>
                <div><strong>Qualifications:</strong> {selectedProvPrivate.qualificationsSummary || 'None provided'}</div>
              </div>
            ) : (
              <p className="text-xs text-[#667085]">Provider has not submitted private verification documents yet.</p>
            )}

            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2"><input type="checkbox" checked={badgeIdentity} onChange={(e) => setBadgeIdentity(e.target.checked)} /> Identity Verified</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={badgeBusiness} onChange={(e) => setBadgeBusiness(e.target.checked)} /> Business Registration Verified</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={badgeCreds} onChange={(e) => setBadgeCreds(e.target.checked)} /> Trade Credentials Checked</label>
            </div>

            <textarea
              rows={2}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Review notes or rejection reason..."
              className="w-full px-3 py-2 rounded-lg border border-[#E6EAF0] text-xs"
            />

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <button type="button" onClick={() => setSelectedProv(null)} className="px-3 py-2 text-xs text-[#667085]">Close</button>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void applyVerificationDecision('additional_info_required')} className="px-3 py-2 rounded-lg border border-[#E6EAF0] text-xs font-semibold">
                  Request Info
                </button>
                <button type="button" onClick={() => void applyVerificationDecision('rejected')} className="inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-[#DC5353] text-white text-xs font-semibold">
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
                <button type="button" onClick={() => void applyVerificationDecision('approved')} className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-[#16A36A] text-white text-xs font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
