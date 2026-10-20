import { useState, useEffect } from 'react';

import { supabase } from './supabase';

import type { Session, User } from '@supabase/supabase-js';

export type UserRole = 'student' | 'teacher' | 'admin';

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
};

let globalSession: Session | null = null;

let globalUser: User | null = null;

let globalLoading = true;

let listeners: Set<() => void> = new Set();

function notify() {
  listeners.forEach((l) => l());
}

export function setAuth(session: Session | null) {
  globalSession = session;

  globalUser = session?.user ?? null;

  notify();
}

export function setAuthLoading(loading: boolean) {
  globalLoading = loading;

  notify();
}

export function useAuth(): AuthState {
  const [, forceRender] = useState(0);

  useEffect(() => {
    const listener = () => forceRender((n) => n + 1);

    listeners.add(listener);

    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    session: globalSession,
    user: globalUser,
    loading: globalLoading,
  };
}

// ============================================================
// INITIALIZE AUTH
// Restores the saved session. Wrapped so the app can never get
// stuck on a loading screen, whatever the network does.
// ============================================================

let authInitialized = false;

export async function initializeAuth() {
  if (authInitialized) return;

  authInitialized = true;

  setAuthLoading(true);

  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      setAuth(null);
    } else {
      setAuth(session);
    }
  } catch {
    // Never leave the app stuck on a loading screen.
    setAuth(null);
  } finally {
    setAuthLoading(false);
  }

  supabase.auth.onAuthStateChange((_event, newSession) => {
    setAuth(newSession);
  });
}

export type SignUpProfile = {
  full_name: string;
  role?: UserRole;
};

export async function signUp(
  email: string,
  password: string,
  profile?: SignUpProfile
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: profile?.full_name,
        role: profile?.role ?? 'student',
      },
    },
  });

  if (!error && data.session && profile) {
    // The signup trigger creates the profile row on signup.
    // Fill in the full_name chosen at registration.
    // The role is intentionally NOT written here: the database
    // always creates new accounts as students.

    try {
      await supabase
        .from('profiles')
        .update({
          full_name: profile.full_name,
        })
        .eq('id', data.session.user.id);
    } catch {
      // A failure here must not block account creation.
    }
  }

  if (!error && data.session) {
    setAuth(data.session);
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  setAuthLoading(true);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.session) {
      setAuth(data.session);
    }

    return { data, error };
  } catch (err) {
    return {
      data: { user: null, session: null },
      error: {
        message:
          err instanceof Error
            ? err.message
            : 'Could not sign in. Please try again.',
      },
    } as any;
  } finally {
    setAuthLoading(false);
  }
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ignore network errors on logout; local state is cleared regardless.
  }

  setAuth(null);

  return { error: null };
}

// ============================================================
// GET CURRENT USER ROLE
// Reads the role from the profiles table. Used by screens and
// by route guards to decide what a user may see.
// Never throws: returns null on any failure.
// ============================================================

export async function getCurrentRole(): Promise<UserRole | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return (data.role as UserRole) ?? null;
  } catch {
    return null;
  }
}
