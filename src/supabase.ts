import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export let supabase: SupabaseClient | null = null;
export let setupError = '';

if (!url || !key) {
  setupError = 'Supabase URL or publishable key is missing from the GitHub Actions build.';
} else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname.endsWith('.supabase.co')) {
      throw new Error('Supabase URL must be a full https://...supabase.co address.');
    }
    if (!key.startsWith('sb_publishable_') && !key.startsWith('eyJ')) {
      throw new Error('The Supabase publishable/anon key is not in the expected format.');
    }
    supabase = createClient(url, key, {
      auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
    });
  } catch (error) {
    setupError = error instanceof Error ? error.message : 'Invalid Supabase configuration.';
    console.error('ONYX45 OS configuration:', setupError);
  }
}
export const configured = Boolean(supabase);
