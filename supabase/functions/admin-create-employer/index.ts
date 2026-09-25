import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;

type RequestBody = {
  companyName?: string;
  email?: string;
  password?: string;
  phone?: string;
  contactName?: string;
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function getAuthedUser(
  req: Request,
  supabaseAdmin: ReturnType<typeof createClient>,
) {
  const authHeader = req.headers.get('Authorization') ?? '';
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  const bearer = match?.[1]?.trim() ?? '';
  if (!bearer) {
    return { ok: false as const, status: 401, message: 'Missing Authorization bearer token.' };
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(bearer);
  if (userError || !userData?.user?.id) {
    return { ok: false as const, status: 401, message: 'Invalid or expired session.' };
  }

  return { ok: true as const, userId: userData.user.id };
}

async function isAdminUser(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
) {
  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Could not verify admin access.');
  return Boolean(data?.user_id);
}

function mapEmployerProfile(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    userId: row.user_id,
    companyName: row.company_name || '',
    contactName: row.contact_name || '',
    contactEmail: row.contact_email || '',
    phone: row.phone || '',
    website: row.website || '',
    companyLogoUrl: row.company_logo_url || '',
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRole) {
    return jsonResponse({ ok: false, error: 'Server is not configured.' }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const auth = await getAuthedUser(req, supabaseAdmin);
    if (!auth.ok) {
      return jsonResponse({ ok: false, error: auth.message }, auth.status);
    }

    const admin = await isAdminUser(supabaseAdmin, auth.userId);
    if (!admin) {
      return jsonResponse({ ok: false, error: 'Admin access required.' }, 403);
    }

    const body = (await req.json().catch(() => ({}))) as RequestBody;
    const companyName = String(body.companyName || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const phone = String(body.phone || '').trim();
    const contactName = String(body.contactName || '').trim();

    if (!companyName) {
      return jsonResponse({ ok: false, error: 'Company name is required.' }, 400);
    }
    if (!EMAIL_RE.test(email)) {
      return jsonResponse({ ok: false, error: 'Enter a valid email address.' }, 400);
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return jsonResponse(
        { ok: false, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        400,
      );
    }
    if (!phone) {
      return jsonResponse({ ok: false, error: 'Phone number is required.' }, 400);
    }

    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        user_type: 'employer',
        company_name: companyName,
      },
    });

    if (createError || !created?.user?.id) {
      const message = createError?.message || 'Could not create employer account.';
      const alreadyExists = /already|registered|exists/i.test(message);
      return jsonResponse(
        {
          ok: false,
          error: alreadyExists
            ? 'An account with this email already exists.'
            : message,
        },
        alreadyExists ? 409 : 400,
      );
    }

    const userId = created.user.id;
    const profilePayload = {
      user_id: userId,
      company_name: companyName,
      contact_email: email,
      phone,
      contact_name: contactName || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('employer_profiles')
      .upsert(profilePayload, { onConflict: 'user_id' })
      .select('*')
      .single();

    if (profileError) {
      console.error('admin-create-employer profile upsert failed:', profileError.message);
      return jsonResponse(
        {
          ok: false,
          error:
            'Employer auth user was created but the company profile could not be saved. Check employer_profiles.',
          userId,
        },
        500,
      );
    }

    return jsonResponse({
      ok: true,
      employer: mapEmployerProfile(profile),
      email,
      message: 'Employer account created. Share the email and password with the company.',
    });
  } catch (error) {
    console.error('admin-create-employer failed:', error);
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unexpected server error.',
      },
      500,
    );
  }
});
