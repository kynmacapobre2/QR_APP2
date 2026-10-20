import { supabase } from './supabase';

import type { UserRole } from './auth';

export type Role = UserRole;

export type Profile = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: Role;
};

// ============================================================
// GET PROFILE
// ============================================================

export async function getProfile(
  userId: string
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

// ============================================================
// UPDATE PROFILE
// Only the full name is user-editable.
// Role changes are handled separately and must be
// authorized by an administrator.
// ============================================================

export async function updateProfile(
  userId: string,
  updates: { full_name?: string }
): Promise<{ error: string | null }> {
  const cleanName = updates.full_name?.trim();

  const { error } = await supabase
    .from('profiles')
    .update({ full_name: cleanName })
    .eq('id', userId);

  return { error: error?.message ?? null };
}

// ============================================================
// GET ALL PROFILES
// Administrator use only. Row Level Security must restrict
// this query to admin accounts.
// ============================================================

export async function getAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .order('full_name', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as Profile[];
}

// ============================================================
// UPDATE USER ROLE
// Administrator use only. Rejects unsupported role values
// before the request is sent.
// ============================================================

const VALID_ROLES: Role[] = ['student', 'teacher', 'admin'];

export async function updateUserRole(
  userId: string,
  role: Role
): Promise<{ error: string | null }> {
  if (!VALID_ROLES.includes(role)) {
    return { error: 'Invalid role.' };
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);

  return { error: error?.message ?? null };
}
