import React, { useEffect, useState } from 'react';
import { ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useMarketplace } from '../context/MarketplaceContext.tsx';
import { DEFAULT_WORKING_HOURS, KENYA_CITIES } from '../data/marketplaceSeed.ts';
import { slugify } from '../lib/utils.ts';

interface AuthPagesProps {
  mode: 'login' | 'register';
  searchParams: URLSearchParams;
  navigate: (to: string) => void;
}

export function AuthPages({ mode, searchParams, navigate }: AuthPagesProps) {
  const {
    firebaseUser,
    account,
    isAdmin,
    authError,
    clearAuthError,
    signInWithGoogle,
    signInWithEmail,
    registerWithEmail,
    resetPassword,
    updateAccountProfile,
  } = useAuth();
  const { categories } = useMarketplace();

  const initialRole = searchParams.get('role') === 'provider' ? 'provider' : 'customer';
  const [selectedRole, setSelectedRole] = useState<'customer' | 'provider'>(initialRole);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);

  // Onboarding state once authenticated
  const [onboardName, setOnboardName] = useState('');
  const [onboardPhone, setOnboardPhone] = useState('');
  const [onboardCity, setOnboardCity] = useState('Nairobi');
  const [onboardArea, setOnboardArea] = useState('Westlands');
  const [onboardPrefs, setOnboardPrefs] = useState<string[]>([]);

  // Provider onboarding fields
  const [businessName, setBusinessName] = useState('');
  const [providerType, setProviderType] = useState<'individual' | 'business'>('individual');
  const [bio, setBio] = useState('');
  const [yearsExp, setYearsExp] = useState('2');
  const [startingPrice, setStartingPrice] = useState('1500');
  const [languages, setLanguages] = useState('English, Swahili');
  const [selectedCats, setSelectedCats] = useState<string[]>(['plumbing']);
  const [onboardError, setOnboardError] = useState<string | null>(null);
  const [savingOnboard, setSavingOnboard] = useState(false);

  useEffect(() => {
    if (account) {
      setOnboardName(account.fullName || '');
      setOnboardPhone(account.phone || '');
      setOnboardCity(account.city || 'Nairobi');
      setOnboardArea(account.area || 'Westlands');
      setOnboardPrefs(account.servicePreferences || []);
    }
  }, [account]);

  useEffect(() => {
    if (firebaseUser && account) {
      if (isAdmin) {
        navigate('/admin/dashboard');
      } else if (account.onboardingCompleted) {
        navigate(account.role === 'provider' ? '/provider/dashboard' : '/app/dashboard');
      }
    }
  }, [firebaseUser, account, isAdmin, navigate]);

  const handleGoogleAuth = async () => {
    setBusy(true);
    clearAuthError();
    const res = await signInWithGoogle(selectedRole);
    setBusy(false);
    if (res && res.onboardingCompleted) {
      navigate(res.role === 'provider' ? '/provider/dashboard' : '/app/dashboard');
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    clearAuthError();
    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
      } else {
        await registerWithEmail(email, password, fullName || 'ServiceConnect User', selectedRole);
      }
    } catch {
      // authError set in context
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async () => {
    if (!email.trim()) return;
    setBusy(true);
    try {
      await resetPassword(email);
      setResetSent(true);
    } catch {
      // handled in context
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent, saveAsDraft = false) => {
    e.preventDefault();
    if (!firebaseUser || !account) return;
    setOnboardError(null);
    if (!onboardName.trim()) {
      setOnboardError('Please provide your full name.');
      return;
    }

    setSavingOnboard(true);
    const targetRole = account.role === 'admin' ? 'admin' : selectedRole;

    try {
      await updateAccountProfile({
        fullName: onboardName.trim().slice(0, 120),
        phone: onboardPhone.trim().slice(0, 32),
        city: onboardCity,
        area: onboardArea.trim().slice(0, 100),
        role: targetRole,
        servicePreferences: onboardPrefs,
        onboardingCompleted: !saveAsDraft,
      });

      if (targetRole === 'provider') {
        const provRef = doc(db, 'providers', firebaseUser.uid);
        const existingSnap = await getDoc(provRef);
        const baseName = businessName.trim() || onboardName.trim();
        if (!existingSnap.exists()) {
          await setDoc(provRef, {
            uid: firebaseUser.uid,
            slug: `${slugify(baseName)}-${firebaseUser.uid.slice(0, 5)}`,
            displayName: onboardName.trim().slice(0, 120),
            businessName: businessName.trim().slice(0, 140),
            providerType,
            bio: bio.trim().slice(0, 1500),
            city: onboardCity,
            serviceAreas: [onboardArea.trim() || 'Central'].filter(Boolean),
            categories: selectedCats.length ? selectedCats : ['home-repairs'],
            languages: languages.split(',').map((l) => l.trim()).filter(Boolean).slice(0, 8),
            yearsExperience: Number(yearsExp) || 1,
            startingPrice: Number(startingPrice) || 0,
            photoUrl: firebaseUser.photoURL || '',
            portfolioUrls: [],
            workingHours: DEFAULT_WORKING_HOURS,
            emergencyAvailable: false,
            availableToday: true,
            verificationStatus: 'not_submitted',
            identityVerified: false,
            phoneVerified: Boolean(onboardPhone.trim()),
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
        }
      }

      if (!saveAsDraft) {
        navigate(targetRole === 'provider' ? '/provider/dashboard' : '/app/dashboard');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${firebaseUser.uid}`);
    } finally {
      setSavingOnboard(false);
    }
  };

  // Guided Onboarding View when authenticated and onboarding not yet completed
  if (firebaseUser && account && !account.onboardingCompleted && !isAdmin) {
    const cityAreas = KENYA_CITIES.find((c) => c.city === onboardCity)?.areas || ['Central'];
    const isProv = selectedRole === 'provider' || account.role === 'provider';

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#0D9488]">
              Account Setup
            </p>
            <h1 className="font-display text-2xl font-bold text-[#132238] mt-1">
              Complete your ServiceConnect profile
            </h1>
            <p className="text-sm text-[#667085] mt-1">
              You can save your progress anytime or skip directly to explore the marketplace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl">
            <button
              type="button"
              onClick={() => setSelectedRole('customer')}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                !isProv ? 'bg-white text-[#132238] border border-[#E6EAF0]' : 'text-[#667085]'
              }`}
            >
              I need services (Customer)
            </button>
            <button
              type="button"
              onClick={() => setSelectedRole('provider')}
              className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                isProv ? 'bg-white text-[#132238] border border-[#E6EAF0]' : 'text-[#667085]'
              }`}
            >
              I offer services (Provider)
            </button>
          </div>

          <form onSubmit={(e) => void handleCompleteOnboarding(e, false)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">Full Name</label>
                <input
                  type="text"
                  required
                  value={onboardName}
                  onChange={(e) => setOnboardName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">Phone Number</label>
                <input
                  type="tel"
                  value={onboardPhone}
                  onChange={(e) => setOnboardPhone(e.target.value)}
                  placeholder="+254 712 345 678"
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm focus:outline-none focus:border-[#0D9488]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">City</label>
                <select
                  value={onboardCity}
                  onChange={(e) => {
                    setOnboardCity(e.target.value);
                    const first = KENYA_CITIES.find((c) => c.city === e.target.value)?.areas[0];
                    if (first) setOnboardArea(first);
                  }}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm bg-white"
                >
                  {KENYA_CITIES.map((c) => (
                    <option key={c.city} value={c.city}>
                      {c.city}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">Area / Estate</label>
                <input
                  type="text"
                  list="onboard-areas"
                  value={onboardArea}
                  onChange={(e) => setOnboardArea(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                />
                <datalist id="onboard-areas">
                  {cityAreas.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </div>
            </div>

            {isProv ? (
              <div className="pt-3 border-t border-[#E6EAF0] space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                      Business Name (optional for individuals)
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="e.g., Wanjiku Plumbing & Solar"
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1.5">Account Type</label>
                    <select
                      value={providerType}
                      onChange={(e) => setProviderType(e.target.value as 'individual' | 'business')}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm bg-white"
                    >
                      <option value="individual">Individual Professional</option>
                      <option value="business">Registered Business</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1.5">Years Experience</label>
                    <input
                      type="number"
                      min={0}
                      max={60}
                      value={yearsExp}
                      onChange={(e) => setYearsExp(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1.5">Starting Rate (KSh)</label>
                    <input
                      type="number"
                      min={0}
                      value={startingPrice}
                      onChange={(e) => setStartingPrice(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#182230] mb-1.5">Languages</label>
                    <input
                      type="text"
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                    Primary Service Categories (pick up to 4)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-3 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC]">
                    {categories.filter((c) => c.isActive).map((c) => {
                      const checked = selectedCats.includes(c.slug);
                      return (
                        <label key={c.slug} className="flex items-center gap-2 text-xs text-[#182230] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedCats((prev) =>
                                checked
                                  ? prev.filter((x) => x !== c.slug)
                                  : prev.length < 4
                                  ? [...prev, c.slug]
                                  : prev
                              );
                            }}
                          />
                          <span className="truncate">{c.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                    Professional Biography
                  </label>
                  <textarea
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Summarize your craft, tools, and areas covered..."
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1.5">
                  Services you are most interested in (optional)
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 rounded-xl border border-[#E6EAF0] bg-[#F7F9FC]">
                  {categories.slice(0, 8).map((c) => {
                    const checked = onboardPrefs.includes(c.slug);
                    return (
                      <label key={c.slug} className="flex items-center gap-2 text-xs text-[#182230] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setOnboardPrefs((prev) =>
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
            )}

            {onboardError && (
              <p className="text-xs text-[#DC5353] flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> {onboardError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => navigate('/services')}
                className="text-xs font-medium text-[#667085] hover:text-[#132238]"
              >
                Explore marketplace first
              </button>
              <div className="flex items-center gap-3">
                {isProv && (
                  <button
                    type="button"
                    disabled={savingOnboard}
                    onClick={(e) => void handleCompleteOnboarding(e, true)}
                    className="px-4 py-2.5 rounded-lg border border-[#E6EAF0] text-xs font-semibold text-[#182230] hover:bg-[#F7F9FC]"
                  >
                    Save Draft
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingOnboard}
                  className="px-6 py-2.5 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] inline-flex items-center gap-2"
                >
                  {savingOnboard ? 'Saving...' : 'Continue to Dashboard'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto px-4 py-14">
      <div className="bg-white border border-[#E6EAF0] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-11 h-11 rounded-xl bg-[#132238] text-white flex items-center justify-center font-bold text-base mx-auto">
            SC
          </div>
          <h1 className="font-display text-2xl font-bold text-[#132238]">
            {mode === 'register' ? 'Create your ServiceConnect account' : 'Welcome back'}
          </h1>
          <p className="text-sm text-[#667085]">
            {mode === 'register'
              ? 'Choose how you want to use ServiceConnect.'
              : 'Sign in to manage bookings, messages, and profiles.'}
          </p>
        </div>

        {/* Role Selector */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#F7F9FC] border border-[#E6EAF0] rounded-xl">
          <button
            type="button"
            onClick={() => setSelectedRole('customer')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
              selectedRole === 'customer'
                ? 'bg-white text-[#132238] border border-[#E6EAF0]'
                : 'text-[#667085]'
            }`}
          >
            Customer
          </button>
          <button
            type="button"
            onClick={() => setSelectedRole('provider')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
              selectedRole === 'provider'
                ? 'bg-white text-[#132238] border border-[#E6EAF0]'
                : 'text-[#667085]'
            }`}
          >
            Service Provider
          </button>
        </div>

        {/* Verified Google Sign-In */}
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleGoogleAuth()}
          className="w-full py-3 px-4 rounded-xl bg-[#132238] text-white text-sm font-semibold hover:bg-[#0D1B2A] transition-colors flex items-center justify-center gap-2.5 disabled:opacity-50"
        >
          <ShieldCheck className="w-4 h-4 text-[#E6F6F3]" />
          {busy ? 'Signing in...' : 'Continue with Google'}
        </button>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-[#E6EAF0] w-full" />
          <button
            type="button"
            onClick={() => setShowEmailForm((v) => !v)}
            className="bg-white px-3 text-xs text-[#667085] hover:text-[#132238] whitespace-nowrap"
          >
            {showEmailForm ? 'Hide email form' : 'Or use email & password'}
          </button>
          <div className="border-t border-[#E6EAF0] w-full" />
        </div>

        {showEmailForm && (
          <form onSubmit={handleEmailSubmit} className="space-y-3.5">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#182230] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#182230] mb-1">Password</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#E6EAF0] text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-lg bg-[#0D9488] text-white text-sm font-semibold hover:bg-[#0F766E] disabled:opacity-50"
            >
              {mode === 'register' ? 'Register with Email' : 'Sign In with Email'}
            </button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => void handleResetPassword()}
                className="w-full text-center text-xs text-[#667085] hover:text-[#0D9488]"
              >
                Forgot password? Send reset link
              </button>
            )}
            {resetSent && (
              <p className="text-xs text-[#16A36A] flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Password reset email sent if account exists.
              </p>
            )}
          </form>
        )}

        {authError && (
          <div className="p-3 rounded-lg bg-[#DC5353]/10 border border-[#DC5353]/30 text-xs text-[#DC5353] flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{authError}</span>
          </div>
        )}

        <div className="text-center text-xs text-[#667085] pt-2 border-t border-[#E6EAF0]">
          {mode === 'login' ? (
            <>
              New to ServiceConnect?{' '}
              <button
                type="button"
                onClick={() => navigate('/register')}
                className="font-semibold text-[#0D9488] hover:underline"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="font-semibold text-[#0D9488] hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
