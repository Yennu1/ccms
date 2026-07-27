import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing authorization header')

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user: caller }, error: callerErr } = await supabaseClient.auth.getUser()
    if (callerErr || !caller) throw new Error('Not authenticated')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: callerRole } = await supabaseAdmin
      .from('user_roles')
      .select('role, org_id')
      .eq('user_id', caller.id)
      .eq('is_active', true)
      .single()

    if (!callerRole || callerRole.role !== 'super_admin') {
      return new Response(JSON.stringify({ error: 'Only Super Admins can invite users.' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { email, fullName, role, branchId } = await req.json()
    if (!email || !role) throw new Error('Missing email or role')
    if (role !== 'super_admin' && !branchId) throw new Error('Branch is required for this role')

    const normalizedEmail = String(email).trim().toLowerCase()

    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('org_id', callerRole.org_id)
      .maybeSingle()

    let userId: string

    if (existingProfile) {
      userId = existingProfile.id
    } else {
      const { data: inviteData, error: inviteErr } = await supabaseAdmin.auth.admin.inviteUserByEmail(
        normalizedEmail,
        { redirectTo: 'https://ccms-inky.vercel.app/accept-invite' }
      )
      if (inviteErr) throw inviteErr
      userId = inviteData.user.id

      // password_set: false is also the column default, but set it explicitly:
      // invited users have not chosen a password yet, so the app must route them
      // through /accept-invite until they do (see profiles.password_set gate).
      const { error: profileErr } = await supabaseAdmin.from('profiles').insert({
        id: userId,
        org_id: callerRole.org_id,
        full_name: fullName || normalizedEmail.split('@')[0],
        email: normalizedEmail,
        is_active: true,
        password_set: false,
      })
      if (profileErr) throw profileErr
    }

    const { data: existingRole } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('org_id', callerRole.org_id)
      .maybeSingle()

    if (existingRole) {
      return new Response(JSON.stringify({ error: 'This user already has a role in your organisation.' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { error: roleErr } = await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      org_id: callerRole.org_id,
      role,
      branch_id: role === 'super_admin' ? null : branchId,
      is_active: true,
    })
    if (roleErr) throw roleErr

    return new Response(JSON.stringify({ success: true, userId, wasExisting: !!existingProfile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
