import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || SUPABASE_SERVICE_ROLE_KEY

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'method_not_allowed' }, 405)
  }
  // Fail closed: without the service role key we cannot delete auth.users,
  // and pretending success would repeat the bug this function fixes.
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return jsonResponse({ error: 'service_unavailable' }, 503)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const jwt = authHeader.replace(/^Bearer\s+/i, '')
  if (!jwt) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // The caller can only ever delete THEIR OWN account: the target id is taken
  // from the verified JWT, never from the request body.
  const { data: userData, error: userError } = await admin.auth.getUser(jwt)
  if (userError || !userData?.user) {
    return jsonResponse({ error: 'unauthorized' }, 401)
  }
  const userId = userData.user.id

  // auth.users -> public.users is ON DELETE CASCADE (users_id_fkey), and
  // public.users cascades to memories, connections, aiya_chats, ai_analyses,
  // weekly_summaries and daily_question_answers — one delete wipes all rows.
  // (No Storage bucket exists yet; photos live client-side. If a bucket is
  // added later, remove its objects here before deleting the user.)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    console.error('[delete-account] deleteUser failed:', deleteError.message)
    return jsonResponse({ error: 'delete_failed' }, 500)
  }

  return jsonResponse({ success: true })
})
