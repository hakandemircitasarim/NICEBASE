import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

const MISSING_CONFIG_MESSAGE =
  '[NICEBASE] Supabase configuration missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env, then rebuild.'

type StubError = { message: string }
type StubResult<T> = { data: T; error: StubError }

class QueryStub implements PromiseLike<StubResult<null>> {
  private readonly message: string
  constructor(message: string) {
    this.message = message
  }

  // Postgrest builder-like chain (no-ops)
  select() { return this }
  insert() { return this }
  update() { return this }
  upsert() { return this }
  delete() { return this }
  eq() { return this }
  neq() { return this }
  in() { return this }
  contains() { return this }
  maybeSingle() { return this }
  single() { return this }
  order() { return this }
  limit() { return this }

  then<TResult1 = StubResult<null>, TResult2 = never>(
    onfulfilled?: ((value: StubResult<null>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve({ data: null, error: { message: this.message } }).then(
      onfulfilled as any,
      onrejected as any
    )
  }
}

function createSupabaseStub(message: string): SupabaseClient {
  const err = { message }
  const query = () => new QueryStub(message) as any

  const stub: any = {
    __isSupabaseStub: true,
    from: () => query(),
    auth: {
      async getSession(): Promise<StubResult<{ session: null }>> {
        return { data: { session: null }, error: err }
      },
      onAuthStateChange() {
        return {
          data: {
            subscription: { unsubscribe() { /* noop */ } },
          },
        }
      },
      async signUp(): Promise<StubResult<{ user: null; session: null }>> {
        return { data: { user: null, session: null }, error: err }
      },
      async signInWithPassword(): Promise<StubResult<{ user: null; session: null }>> {
        return { data: { user: null, session: null }, error: err }
      },
      async signInWithOAuth(): Promise<StubResult<null>> {
        return { data: null, error: err }
      },
      async signOut(): Promise<StubResult<null>> {
        return { data: null, error: err }
      },
      async updateUser(): Promise<StubResult<null>> {
        return { data: null, error: err }
      },
      async resetPasswordForEmail(): Promise<StubResult<null>> {
        return { data: null, error: err }
      },
      async resend(): Promise<StubResult<null>> {
        return { data: null, error: err }
      },
    },
    storage: {
      from() {
        return {
          async upload(): Promise<StubResult<null>> {
            return { data: null, error: err }
          },
          getPublicUrl() {
            return { data: { publicUrl: '' }, error: err }
          },
        }
      },
    },
  }

  return stub as SupabaseClient
}

function createSupabaseClient(): SupabaseClient {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      storageKey: 'supabase.auth.token',
    },
    global: {
      // Use native fetch to ensure it works
      fetch: typeof window !== 'undefined' ? window.fetch.bind(window) : fetch,
      headers: {
        'x-client-info': 'nicebase@1.0.0',
      },
    },
  })
}

/**
 * Export a client that NEVER throws at module import time.
 * - If env vars are present: real Supabase client.
 * - If missing: stub client that returns `{ error: { message } }` so the app can still run offline.
 */
export const supabase: SupabaseClient = isSupabaseConfigured()
  ? createSupabaseClient()
  : createSupabaseStub(MISSING_CONFIG_MESSAGE)

