import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase.ts';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_PLATFORM_SETTINGS,
} from '../data/marketplaceSeed.ts';
import {
  Booking,
  DisputeCase,
  FavoriteProvider,
  NotificationItem,
  PlatformSettings,
  ProviderProfile,
  ServiceCategory,
  ServiceListing,
  VerifiedReview,
} from '../types/index.ts';
import { useAuth } from './AuthContext.tsx';
import { generateSafeId } from '../lib/utils.ts';

interface MarketplaceContextValue {
  categories: ServiceCategory[];
  providers: ProviderProfile[];
  services: ServiceListing[];
  reviews: VerifiedReview[];
  customerBookings: Booking[];
  providerBookings: Booking[];
  allBookings: Booking[];
  favorites: FavoriteProvider[];
  notifications: NotificationItem[];
  disputes: DisputeCase[];
  settings: PlatformSettings;
  loadingPublic: boolean;
  getProviderRatingStats: (providerId: string) => { avgRating: number; reviewCount: number };
  toggleFavorite: (provider: ProviderProfile) => Promise<void>;
  isFavorited: (providerId: string) => boolean;
  createNotification: (payload: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
}

const MarketplaceContext = createContext<MarketplaceContextValue | null>(null);

export function MarketplaceProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser, isAdmin } = useAuth();
  const [firestoreCategories, setFirestoreCategories] = useState<ServiceCategory[]>([]);
  const [providers, setProviders] = useState<ProviderProfile[]>([]);
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [reviews, setReviews] = useState<VerifiedReview[]>([]);
  const [customerBookings, setCustomerBookings] = useState<Booking[]>([]);
  const [providerBookings, setProviderBookings] = useState<Booking[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [favorites, setFavorites] = useState<FavoriteProvider[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [disputes, setDisputes] = useState<DisputeCase[]>([]);
  const [settings, setSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [loadingPublic, setLoadingPublic] = useState(true);

  // Public listeners
  useEffect(() => {
    const unsubCats = onSnapshot(
      query(collection(db, 'categories'), orderBy('sortOrder', 'asc')),
      (snap) => {
        setFirestoreCategories(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceCategory, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'categories')
    );

    const unsubProviders = onSnapshot(
      collection(db, 'providers'),
      (snap) => {
        setProviders(
          snap.docs.map((d) => ({ ...(d.data() as ProviderProfile), uid: d.id }))
        );
        setLoadingPublic(false);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'providers')
    );

    const unsubServices = onSnapshot(
      collection(db, 'services'),
      (snap) => {
        setServices(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ServiceListing, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'services')
    );

    const unsubReviews = onSnapshot(
      collection(db, 'reviews'),
      (snap) => {
        setReviews(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VerifiedReview, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'reviews')
    );

    const unsubSettings = onSnapshot(
      doc(db, 'platform_settings', 'default'),
      (snap) => {
        if (snap.exists()) {
          setSettings({ id: snap.id, ...(snap.data() as Omit<PlatformSettings, 'id'>) });
        }
      },
      () => {
        // Fallback to default settings config if doc not yet initialized
      }
    );

    return () => {
      unsubCats();
      unsubProviders();
      unsubServices();
      unsubReviews();
      unsubSettings();
    };
  }, []);

  // Authenticated user-scoped listeners
  useEffect(() => {
    if (!firebaseUser) {
      setCustomerBookings([]);
      setProviderBookings([]);
      setAllBookings([]);
      setFavorites([]);
      setNotifications([]);
      setDisputes([]);
      return;
    }

    const uid = firebaseUser.uid;

    const unsubCustBookings = onSnapshot(
      query(collection(db, 'bookings'), where('customerId', '==', uid)),
      (snap) => {
        setCustomerBookings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings(customer)')
    );

    const unsubProvBookings = onSnapshot(
      query(collection(db, 'bookings'), where('providerId', '==', uid)),
      (snap) => {
        setProviderBookings(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'bookings(provider)')
    );

    const unsubFavs = onSnapshot(
      query(collection(db, 'favorites'), where('customerId', '==', uid)),
      (snap) => {
        setFavorites(
          snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<FavoriteProvider, 'id'>) }))
        );
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'favorites')
    );

    const unsubNotifs = onSnapshot(
      query(collection(db, 'notifications'), where('userId', '==', uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<NotificationItem, 'id'>) }));
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setNotifications(list);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'notifications')
    );

    let unsubAllBookings: (() => void) | null = null;
    let unsubDisputes: (() => void) | null = null;

    if (isAdmin) {
      unsubAllBookings = onSnapshot(
        collection(db, 'bookings'),
        (snap) => {
          setAllBookings(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Booking, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'bookings(admin)')
      );
      unsubDisputes = onSnapshot(
        collection(db, 'disputes'),
        (snap) => {
          setDisputes(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DisputeCase, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'disputes(admin)')
      );
    } else {
      unsubDisputes = onSnapshot(
        query(collection(db, 'disputes'), where('customerId', '==', uid)),
        (snap) => {
          setDisputes(
            snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<DisputeCase, 'id'>) }))
          );
        },
        (err) => handleFirestoreError(err, OperationType.LIST, 'disputes(customer)')
      );
    }

    return () => {
      unsubCustBookings();
      unsubProvBookings();
      unsubFavs();
      unsubNotifs();
      if (unsubAllBookings) unsubAllBookings();
      if (unsubDisputes) unsubDisputes();
    };
  }, [firebaseUser, isAdmin]);

  const categories = useMemo(() => {
    if (firestoreCategories.length > 0) {
      return firestoreCategories;
    }
    return DEFAULT_CATEGORIES;
  }, [firestoreCategories]);

  const ratingStatsMap = useMemo(() => {
    const map = new Map<string, { sum: number; count: number }>();
    for (const r of reviews) {
      if (r.isHidden) continue;
      const entry = map.get(r.providerId) || { sum: 0, count: 0 };
      entry.sum += r.overallRating;
      entry.count += 1;
      map.set(r.providerId, entry);
    }
    return map;
  }, [reviews]);

  const getProviderRatingStats = (providerId: string) => {
    const entry = ratingStatsMap.get(providerId);
    if (!entry || entry.count === 0) return { avgRating: 0, reviewCount: 0 };
    return {
      avgRating: Number((entry.sum / entry.count).toFixed(1)),
      reviewCount: entry.count,
    };
  };

  const isFavorited = (providerId: string) => {
    return favorites.some((f) => f.providerId === providerId);
  };

  const toggleFavorite = async (provider: ProviderProfile) => {
    if (!firebaseUser) throw new Error('Please sign in to save professionals.');
    const favId = `${firebaseUser.uid}_${provider.uid}`;
    const existingFav = favorites.find((f) => f.providerId === provider.uid);
    try {
      if (existingFav) {
        await deleteDoc(doc(db, 'favorites', existingFav.id));
      } else {
        await setDoc(doc(db, 'favorites', favId), {
          customerId: firebaseUser.uid,
          providerId: provider.uid,
          providerName: provider.businessName || provider.displayName,
          createdAt: serverTimestamp(),
        });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `favorites/${favId}`);
    }
  };

  const createNotification = async (payload: Omit<NotificationItem, 'id' | 'createdAt' | 'isRead'>) => {
    if (!firebaseUser) return;
    const notifId = generateSafeId('notif');
    try {
      await setDoc(doc(db, 'notifications', notifId), {
        userId: payload.userId,
        title: payload.title.slice(0, 140),
        body: payload.body.slice(0, 400),
        type: payload.type,
        link: (payload.link || '/').slice(0, 200),
        isRead: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Notification dispatch skipped:', err);
    }
  };

  const markNotificationRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  return (
    <MarketplaceContext.Provider
      value={{
        categories,
        providers,
        services,
        reviews,
        customerBookings,
        providerBookings,
        allBookings,
        favorites,
        notifications,
        disputes,
        settings,
        loadingPublic,
        getProviderRatingStats,
        toggleFavorite,
        isFavorited,
        createNotification,
        markNotificationRead,
      }}
    >
      {children}
    </MarketplaceContext.Provider>
  );
}

export function useMarketplace() {
  const ctx = useContext(MarketplaceContext);
  if (!ctx) throw new Error('useMarketplace must be used inside MarketplaceProvider');
  return ctx;
}
