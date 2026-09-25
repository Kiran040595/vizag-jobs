const AUTH_SUCCESS_KEY = 'vizagjobs:student-auth-success';

export const markStudentAuthSuccess = ({ apply = false, type = 'sign_in' } = {}) => {
  try {
    sessionStorage.setItem(
      AUTH_SUCCESS_KEY,
      JSON.stringify({
        apply: Boolean(apply),
        type,
        at: Date.now(),
      }),
    );
  } catch {
    // Ignore storage failures.
  }
};

export const consumeStudentAuthSuccess = () => {
  try {
    const raw = sessionStorage.getItem(AUTH_SUCCESS_KEY);
    sessionStorage.removeItem(AUTH_SUCCESS_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    return {
      apply: Boolean(parsed.apply),
      type: parsed.type === 'register' ? 'register' : 'sign_in',
    };
  } catch {
    return null;
  }
};
