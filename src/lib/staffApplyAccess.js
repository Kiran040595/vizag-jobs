/**
 * Admin and employer accounts share the same Supabase session as students but are
 * not student profiles. They should not see the guest "Sign in / Register"
 * modal when applying from a job page.
 */
export const isStaffApplicantSession = ({ session, isStudent, isAdmin, isEmployer }) =>
  Boolean(session && !isStudent && (isAdmin || isEmployer));
