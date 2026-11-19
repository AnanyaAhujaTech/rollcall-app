'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut,
  UserCredential,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase/client';
import { UserProfile } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  signUpWithEmail: (email: string, pass: string) => Promise<UserCredential>;
  signInWithGoogle: () => Promise<UserCredential>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<UserProfile | null>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async (uid: string): Promise<UserProfile | null> => {
    try {
      const userDocRef = doc(db, 'users', uid);
      const snapshot = await getDoc(userDocRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        const userProfile: UserProfile = {
          uid: data.uid || uid,
          email: data.email || '',
          displayName: data.displayName || 'User',
          role: data.role,
          rollNumber: data.rollNumber,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
        };
        setProfile(userProfile);
        return userProfile;
      }
      setProfile(null);
      return null;
    } catch (err: any) {
      console.error('Error fetching user profile from Firestore:', err);
      return null;
    }
  };

  useEffect(() => {
    let unsubscribeFirestore: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        // Subscribe to real-time changes to the user's profile document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        unsubscribeFirestore = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const data = docSnap.data();
              const userProfile: UserProfile = {
                uid: data.uid || firebaseUser.uid,
                email: data.email || firebaseUser.email || '',
                displayName: data.displayName || firebaseUser.displayName || 'User',
                role: data.role,
                rollNumber: data.rollNumber,
                createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || '',
                updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || '',
              };
              setProfile(userProfile);
            } else {
              setProfile(null);
            }
            setLoading(false);
          },
          (err) => {
            console.error('Firestore snapshot listener error:', err);
            // Fallback manual read
            fetchProfile(firebaseUser.uid).finally(() => setLoading(false));
          }
        );
      } else {
        if (unsubscribeFirestore) {
          unsubscribeFirestore();
          unsubscribeFirestore = null;
        }
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, []);

  const signInWithEmail = async (email: string, pass: string): Promise<UserCredential> => {
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      await fetchProfile(cred.user.uid);
      return cred;
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in');
      throw err;
    }
  };

  const signUpWithEmail = async (email: string, pass: string): Promise<UserCredential> => {
    setError(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      return cred;
    } catch (err: any) {
      setError(err?.message || 'Failed to sign up');
      throw err;
    }
  };

  const signInWithGoogle = async (): Promise<UserCredential> => {
    setError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await fetchProfile(cred.user.uid);
      return cred;
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in with Google');
      throw err;
    }
  };

  const signOutUser = async (): Promise<void> => {
    setError(null);
    try {
      await signOut(auth);
      setProfile(null);
      setUser(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to sign out');
      throw err;
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    if (!user) return null;
    return await fetchProfile(user.uid);
  };

  const clearError = () => setError(null);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        error,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        signOutUser,
        refreshProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
