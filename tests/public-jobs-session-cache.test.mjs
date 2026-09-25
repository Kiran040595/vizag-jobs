import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  JOB_LIST_SESSION_CACHE_TTL_MS,
  PUBLIC_JOBS_CACHE_KEY,
  INSTAGRAM_JOBS_CACHE_KEY,
  readCachedPublicJobs,
  writeCachedPublicJobs,
  readCachedInstagramJobs,
  writeCachedInstagramJobs,
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

  it('hydrates Instagram jobs from dedicated cache', () => {
    installSessionStorage();
    const jobs = [
      {
        id: 'ig-1',
        title: 'Insta role',
        company: 'Acme',
        isInstagram: true,
        postedAt: new Date().toISOString(),
      },
    ];

    writeCachedInstagramJobs(jobs);
    const cached = readCachedInstagramJobs();

    assert.ok(cached);
    assert.equal(cached.jobs.length, 1);
    assert.equal(cached.jobs[0].id, 'ig-1');
  });

  it('falls back to Instagram-flagged rows from the public list cache', () => {
    installSessionStorage();
    writeCachedPublicJobs([
      {
        id: 'a',
        title: 'Normal',
        company: 'Acme',
        isInstagram: false,
        postedAt: new Date().toISOString(),
      },
      {
        id: 'b',
        title: 'Bio link',
        company: 'Acme',
        isInstagram: true,
        postedAt: new Date().toISOString(),
      },
    ]);

    const cached = readCachedInstagramJobs();
    assert.ok(cached);
    assert.equal(cached.jobs.length, 1);
    assert.equal(cached.jobs[0].id, 'b');
    assert.equal(sessionStorage.getItem(INSTAGRAM_JOBS_CACHE_KEY), null);
  });
});
