/**
 * Client Supabase « public » (clé anon/publishable).
 * Utilisable côté navigateur (back-office /admin : Auth + lecture des leads via RLS).
 * Ne contient JAMAIS de secret.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anon) {
  // Avertit au build/dev si la config publique manque.
  console.warn('[soloris] PUBLIC_SUPABASE_URL ou PUBLIC_SUPABASE_ANON_KEY manquant.');
}

export const supabase = createClient(url ?? '', anon ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
