/** Google sign-in on employer login/register. Set VITE_ENABLE_GOOGLE_EMPLOYER_AUTH=false to hide. */
export const ENABLE_GOOGLE_EMPLOYER_AUTH =
  import.meta.env.VITE_ENABLE_GOOGLE_EMPLOYER_AUTH !== 'false';

/** Set VITE_REQUIRE_EMAIL_CONFIRMATION=true when Supabase "Confirm email" is enabled. */
export const REQUIRE_EMAIL_CONFIRMATION =
  import.meta.env.VITE_REQUIRE_EMAIL_CONFIRMATION === 'true';
