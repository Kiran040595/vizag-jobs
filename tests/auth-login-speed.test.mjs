import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasStoredSupabaseSession,
  getStoredSupabaseSession,
} from '../src/lib/supabaseSessionHelper.js';

test('hasStoredSupabaseSession returns false when localStorage is empty', () => {
  global.window = {
    localStorage: {
      length: 0,
      key: () => null,
      getItem: () => null,
    },
    location: {
      hash: '',
      search: '',
    },
  };

  assert.equal(hasStoredSupabaseSession(), false);
  assert.equal(getStoredSupabaseSession(), null);
});

test('hasStoredSupabaseSession returns true when pending OAuth hash or code is present', () => {
  global.window = {
    localStorage: {
      length: 0,
      key: () => null,
      getItem: () => null,
    },
    location: {
      hash: '#access_token=test-token&refresh_token=refresh-token',
      search: '',
    },
  };

  assert.equal(hasStoredSupabaseSession(), true);

  global.window.location.hash = '';
  global.window.location.search = '?code=auth-code-123';
  assert.equal(hasStoredSupabaseSession(), true);
});

test('hasStoredSupabaseSession and getStoredSupabaseSession detect stored session in localStorage', () => {
  const mockSession = {
    access_token: 'valid-jwt',
    user: { id: 'admin-user-1', email: 'kiran@jobsinvizag.in' },
  };

  const store = {
    'sb-fbyyfyhdglcpkhxskffj-auth-token': JSON.stringify(mockSession),
  };

  global.window = {
    localStorage: {
      length: 1,
      key: (i) => (i === 0 ? 'sb-fbyyfyhdglcpkhxskffj-auth-token' : null),
      getItem: (k) => store[k] || null,
    },
    location: {
      hash: '',
      search: '',
    },
  };

  assert.equal(hasStoredSupabaseSession(), true);
  const session = getStoredSupabaseSession();
  assert.notEqual(session, null);
  assert.equal(session.user.email, 'kiran@jobsinvizag.in');
});
