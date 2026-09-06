import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    'Supabase credentials missing. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment variables.'
  );
}

// Custom in-process lock to prevent Web Lock conflicts in iframes and multi-tab sync issues
const lockTails = new Map<string, Promise<unknown>>();

/**
 * Serialises callers sharing a lock name.
 *
 * The tail is registered synchronously, before any await. An earlier version
 * read the current lock, awaited it, and only then stored its own promise --
 * so two callers arriving in the same tick both saw the same predecessor and
 * both ran, which is precisely what the lock exists to prevent. For the token
 * refresh this meant two concurrent refreshes racing over a rotating refresh
 * token: one wins, the other is left holding a token the server has already
 * retired, and the session dies.
 */
const inProcessLock = async <R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const previous = lockTails.get(name) ?? Promise.resolve();

  // Run once the predecessor settles, whether it resolved or rejected.
  const result = previous.then(fn, fn);
  const tail = result.then(
    () => undefined,
    () => undefined
  );
  lockTails.set(name, tail);

  try {
    return await result;
  } finally {
    // Only the current tail may clear the entry, or a queued caller would be
    // dropped and the map would stop serialising.
    if (lockTails.get(name) === tail) lockTails.delete(name);
  }
};

/**
 * fetch with a retry for transient network failures.
 *
 * A blocked or dropped request surfaces as `TypeError: Failed to fetch`, a
 * message that says nothing about what to do. Extensions (ad-blockers, screen
 * recorders, privacy tools), VPNs, captive portals and TLS-inspecting antivirus
 * all produce it, as does a momentary loss of connectivity.
 *
 * Retries are limited to idempotent methods. POST is excluded because a request
 * that failed at the network layer may still have reached the server, and
 * replaying an insert would duplicate the row.
 */
const IDEMPOTENT = new Set(['GET', 'HEAD', 'OPTIONS', 'PUT', 'PATCH', 'DELETE']);

const NETWORK_HELP =
  'Cannot reach the server. Check your internet connection, and if you use a ' +
  'VPN, proxy, ad-blocker or other browser extension, disable it for this site and retry.';

/**
 * Works out *why* a request could not be sent, so the message names the cause.
 *
 * "Failed to fetch" covers being offline, a blocked origin, and a proxy or
 * extension that filters by HTTP method -- three problems with three different
 * fixes. Reaching the same host with GET and POST distinguishes them: if those
 * get through and PATCH does not, something is filtering methods, and no amount
 * of retrying will help.
 *
 * Uses the built-in fetch directly so a probe can never re-enter the wrapper.
 */
async function diagnoseBlock(url: string, headers: HeadersInit | undefined, method: string): Promise<string> {
  const origin = (() => { try { return new URL(url).origin; } catch { return null; } })();
  if (!origin) return '';

  const probe = async (m: string) => {
    try {
      await fetch(`${origin}/rest/v1/`, {
        method: m,
        headers,
        body: m === 'POST' ? '{}' : undefined,
      });
      return true;                     // any HTTP status means it got through
    } catch {
      return false;
    }
  };

  const [getOk, postOk] = await Promise.all([probe('GET'), probe('POST')]);

  if (!getOk && !postOk) {
    return 'Cannot reach the server at all — you appear to be offline, or this whole domain '
      + 'is being blocked. Check your internet connection and any VPN or firewall.';
  }
  return `Cannot reach the server: this browser can load data but its ${method} requests are `
    + `being blocked, so something is filtering by HTTP method — usually a browser extension, `
    + `a VPN/proxy, or antivirus web protection. Try an Incognito window (extensions are off `
    + `there); if it works, disable your extensions for this site.`;
}

/**
 * Re-sends a blocked UPDATE/DELETE as a POST to the rest_write() function.
 *
 * When a network filters out PATCH and DELETE, the request never reaches the
 * server and there is nothing to fix server-side. POST does get through, so
 * the same write is expressed as an RPC. rest_write is SECURITY INVOKER, so
 * row level security applies exactly as it would to the PATCH -- this changes
 * the transport, never the caller's authority.
 *
 * Only plain `column=eq.value` filters are translated. Anything else returns
 * null and the original network error stands, rather than guessing at a
 * different set of rows than the caller asked for.
 */
async function writeViaRpc(url: string, init: RequestInit | undefined, method: string): Promise<Response | null> {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return null; }

  const m = parsed.pathname.match(/\/rest\/v1\/([A-Za-z0-9_]+)$/);
  if (!m) return null;
  const table = m[1];
  if (table === 'rpc') return null;

  const match: Record<string, string> = {};
  let wantsRepresentation = false;
  for (const [key, value] of parsed.searchParams.entries()) {
    if (key === 'select') { wantsRepresentation = true; continue; }
    if (key === 'order' || key === 'limit' || key === 'offset') continue;
    if (!value.startsWith('eq.')) return null;      // unsupported operator
    match[key] = value.slice(3);
  }
  if (Object.keys(match).length === 0) return null;  // never rewrite an unfiltered write

  const headers = new Headers(init?.headers as HeadersInit);
  if ((headers.get('Prefer') || '').includes('return=representation')) wantsRepresentation = true;
  const wantsSingle = (headers.get('Accept') || '').includes('vnd.pgrst.object+json');

  let patch: unknown = {};
  if (method === 'PATCH') {
    try { patch = JSON.parse(String(init?.body ?? '{}')); } catch { return null; }
  }

  headers.set('Content-Type', 'application/json');
  headers.set('Accept', 'application/json');
  headers.delete('Prefer');

  const res = await fetch(`${parsed.origin}/rest/v1/rpc/rest_write`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      _table: table,
      _op: method === 'DELETE' ? 'delete' : 'update',
      _match: match,
      _patch: patch,
    }),
  });

  if (!res.ok) return res;                           // let the caller surface the real error

  const rows = await res.json().catch(() => []);
  const list = Array.isArray(rows) ? rows : [];

  const reply = (body: string | null, status: number) =>
    new Response(body, {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  if (wantsSingle) {
    if (list.length !== 1) {
      // Same shape PostgREST uses when .single() does not match exactly one row.
      return reply(JSON.stringify({
        code: 'PGRST116',
        message: `JSON object requested, multiple (or no) rows returned`,
        details: `Results contain ${list.length} rows`,
        hint: null,
      }), 406);
    }
    return reply(JSON.stringify(list[0]), 200);
  }
  if (wantsRepresentation) return reply(JSON.stringify(list), 200);
  return reply(null, 204);
}

const resilientFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? 'GET').toUpperCase();
  const attempts = IDEMPOTENT.has(method) ? 3 : 1;

  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      // Only network-layer failures throw here; HTTP errors resolve normally.
      lastError = err;
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      if (attempt < attempts) {
        await new Promise(resolve => setTimeout(resolve, 300 * attempt));
      }
    }
  }

  const url = typeof input === 'string' ? input
    : input instanceof URL ? input.href
    : (input as Request).url;

  // PATCH/DELETE filtered out by the network: send the same write over POST.
  if (method === 'PATCH' || method === 'DELETE') {
    try {
      const viaRpc = await writeViaRpc(url, init, method);
      if (viaRpc) return viaRpc;
    } catch { /* fall through to the diagnosed error below */ }
  }

  let verdict = '';
  try {
    verdict = await diagnoseBlock(url, init?.headers, method);
  } catch { /* diagnosis is best effort; never mask the original failure */ }

  // Keep the TypeError type: supabase-js treats it as a retryable auth
  // fetch error, and changing it would change that handling.
  throw new TypeError(verdict || NETWORK_HELP);
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
    },
    global: {
      fetch: resilientFetch,
    },
  }
);
