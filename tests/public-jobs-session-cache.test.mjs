import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  JOB_LIST_SESSION_CACHE_TTL_MS,
  PUBLIC_JOBS_CACHE_KEY,
  readCachedPublicJobs,
  writeCachedPublicJobs,
} from '../src/lib/publicJobsSessionCache.js';

const memoryStore = new Map();

const installSessionStorage = () => {
  globalThis.sessionStorage = {
    getItem: (key) => (memoryStore.has(key) ? memoryStore.get(key) : null),
    setItem: (key, value) => {
      memoryStore.set(key, String(value));
    },
    removeItem: (key) => {
      memoryStore.delete(key);
    },
  };
};

afterEach(() => {
  memoryStore.clear();
});

describe('public jobs session cache', () => {
  it('hydrates valid cached jobs synchronously', () => {
    installSessionStorage();
    const jobs = [
      {
        id: '1',
        title: 'Engineer',
        company: 'Acme',
        postedAt: new Date().toISOString(),
      },
    ];

    writeCachedPublicJobs(jobs);
    const cached = readCachedPublicJobs();

    assert.ok(cached);
    assert.equal(cached.jobs.length, 1);
    assert.equal(cached.jobs[0].title, 'Engineer');
    assert.ok(cached.age < 1000);
  });

  it('ignores expired cache entries', () => {
    installSessionStorage();
    sessionStorage.setItem(
      PUBLIC_JOBS_CACHE_KEY,
      JSON.stringify({
        jobs: [
          {
            id: '1',
            title: 'Old',
            company: 'Acme',
            postedAt: new Date().toISOString(),
          },
        ],
        timestamp: Date.now() - JOB_LIST_SESSION_CACHE_TTL_MS - 1,
      }),
    );

    assert.equal(readCachedPublicJobs(), null);
  });

  it('ignores cache entries outside the public display window', () => {
    installSessionStorage();
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    sessionStorage.setItem(
      PUBLIC_JOBS_CACHE_KEY,
      JSON.stringify({
        jobs: [{ id: '1', title: 'Stale', company: 'Acme', postedAt: fortyDaysAgo }],
        timestamp: Date.now(),
      }),
    );

    assert.equal(readCachedPublicJobs(), null);
  });
});
