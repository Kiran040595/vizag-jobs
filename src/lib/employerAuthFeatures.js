/** Set VITE_REQUIRE_EMAIL_CONFIRMATION=true when Supabase "Confirm email" is enabled. */
export const REQUIRE_EMAIL_CONFIRMATION =
  import.meta.env.VITE_REQUIRE_EMAIL_CONFIRMATION === 'true';

/** Toggle employer Google OAuth in the login/register UI without removing backend flows. */
export const SHOW_EMPLOYER_GOOGLE_AUTH = false;
