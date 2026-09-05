import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'
  );
}

// Custom in-process lock to prevent Web Lock conflicts in iframes and multi-tab sync issues
const activeLocks = new Map<string, Promise<any>>();

const inProcessLock = async <R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const existingPromise = activeLocks.get(name);
  if (existingPromise) {
    try {
      await existingPromise;
    } catch {
      // Ignore previous lock failure, run the next task
    }
  }

  const promise = fn();
  activeLocks.set(name, promise);

  try {
    return await promise;
  } finally {
    if (activeLocks.get(name) === promise) {
      activeLocks.delete(name);
    }
  }
};

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      lock: inProcessLock,
    }
  }
);
