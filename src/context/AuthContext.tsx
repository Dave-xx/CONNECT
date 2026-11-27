import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import {
  auth,
  db,
  googleAuthProvider,
  handleFirestoreError,
  OperationType,
} from '../lib/firebase.ts';
import { ADMIN_EMAIL } from '../data/marketplaceSeed.ts';
import { UserAccount, UserRole } from '../types/index.ts';

interface AuthContextValue {
  firebaseUser: User | null;
  account: UserAccount | null;
  isAdmin: boolean;
  loading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  signInWithGoogle: (preferredRole?: UserRole) => Promise<UserAccount | null>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, fullName: string, role: 'customer' | 'provider') => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: () => Promise<string | null>;
  updateAccountProfile: (updates: Partial<UserAccount>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [adminDocExists, setAdminDocExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const ensureUserDocument = useCallback(async (user: User, preferredRole: UserRole = 'customer'): Promise<UserAccount> => {
    const userRef = doc(db, 'users', user.uid);
    let snap;
    try {
      snap = await getDoc(userRef);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
    }

    if (snap && snap.exists()) {
      return snap.data() as UserAccount;
    }

    const isRootAdmin = user.email === ADMIN_EMAIL && user.emailVerified;
    const assignedRole: UserRole = isRootAdmin ? 'admin' : preferredRole === 'provider' ? 'provider' : 'customer';

    const newAccount: UserAccount = {
      uid: user.uid,
      email: user.email || '',
      fullName: user.displayName || user.email?.split('@')[0] || 'ServiceConnect User',
      phone: user.phoneNumber || '',
      photoUrl: user.photoURL || '',
      role: assignedRole,
      city: 'Nairobi',
      area: '',
      country: 'Kenya',
      preferredCurrency: 'KSh',
      savedAddresses: [],
      servicePreferences: [],
      notificationPrefs: {
        inApp: true,
        email: true,
        sms: false,
        whatsapp: false,
      },
      onboardingCompleted: isRootAdmin,
      isSuspended: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, newAccount);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
    }
    return newAccount;
  }, []);

  useEffect(() => {
    let unsubAccount: (() => void) | null = null;
    let unsubAdmin: (() => void) | null = null;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubAccount) {
        unsubAccount();
        unsubAccount = null;
      }
      if (unsubAdmin) {
        unsubAdmin();
        unsubAdmin = null;
      }

      setFirebaseUser(user);
      if (!user) {
        setAccount(null);
        setAdminDocExists(false);
        setLoading(false);
        return;
      }

      try {
        await ensureUserDocument(user, 'customer');

        unsubAccount = onSnapshot(
          doc(db, 'users', user.uid),
          (snapshot) => {
            if (snapshot.exists()) {
              setAccount(snapshot.data() as UserAccount);
            }
            setLoading(false);
          },
          (err) => {
            handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
          }
        );

        unsubAdmin = onSnapshot(
          doc(db, 'admins', user.uid),
          (snapshot) => {
            setAdminDocExists(snapshot.exists());
          },
          () => {
            setAdminDocExists(false);
          }
        );
      } catch (err) {
        console.error('Failed to load user session:', err);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubAccount) unsubAccount();
      if (unsubAdmin) unsubAdmin();
    };
  }, [ensureUserDocument]);

  const signInWithGoogle = async (preferredRole: UserRole = 'customer'): Promise<UserAccount | null> => {
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const userAccount = await ensureUserDocument(cred.user, preferredRole);
      if (
        preferredRole === 'provider' &&
        userAccount.role === 'customer' &&
        cred.user.email !== ADMIN_EMAIL
      ) {
        await updateDoc(doc(db, 'users', cred.user.uid), {
          role: 'provider',
          updatedAt: serverTimestamp(),
        });
        return { ...userAccount, role: 'provider' };
      }
      return userAccount;
    } catch (err: any) {
      const msg = err?.message || 'Unable to sign in with Google.';
      setAuthError(msg);
      return null;
    }
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password sign-in is not enabled in Firebase Console yet. Please sign in with Google above.');
      } else {
        setAuthError(err?.message || 'Invalid email or password.');
      }
      throw err;
    }
  };

  const registerWithEmail = async (
    email: string,
    password: string,
    fullName: string,
    role: 'customer' | 'provider'
  ) => {
    setAuthError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });
      await sendEmailVerification(cred.user);
      await ensureUserDocument(cred.user, role);
    } catch (err: any) {
      if (err?.code === 'auth/operation-not-allowed') {
        setAuthError('Email/Password registration is not enabled in Firebase Console yet. Please use Google Sign-In for instant verified access.');
      } else {
        setAuthError(err?.message || 'Unable to register account.');
      }
      throw err;
    }
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to send password reset email.');
      throw err;
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
    setAccount(null);
    setAdminDocExists(false);
  };

  const getIdToken = async (): Promise<string | null> => {
    if (!auth.currentUser) return null;
    return auth.currentUser.getIdToken();
  };

  const updateAccountProfile = async (updates: Partial<UserAccount>) => {
    if (!firebaseUser) throw new Error('Must be signed in.');
    const userRef = doc(db, 'users', firebaseUser.uid);
    const allowed: Record<string, unknown> = { updatedAt: serverTimestamp() };
    const safeKeys: Array<keyof UserAccount> = [
      'fullName',
      'phone',
      'photoUrl',
      'role',
      'city',
      'area',
      'country',
      'preferredCurrency',
      'savedAddresses',
      'servicePreferences',
      'notificationPrefs',
      'onboardingCompleted',
    ];
    for (const k of safeKeys) {
      if (updates[k] !== undefined) {
        allowed[k] = updates[k];
      }
    }
    try {
      await updateDoc(userRef, allowed);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${firebaseUser.uid}`);
    }
  };

  const isAdmin = Boolean(
    firebaseUser &&
      firebaseUser.emailVerified &&
      (firebaseUser.email === ADMIN_EMAIL || adminDocExists || account?.role === 'admin')
  );

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        account,
        isAdmin,
        loading,
        authError,
        clearAuthError: () => setAuthError(null),
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        signOut,
        getIdToken,
        updateAccountProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
