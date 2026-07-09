#!/usr/bin/env node
/** @deprecated Use: AUTO_FETCH_CHANNEL=naukri node scripts/auto-external-pipeline.mjs */
process.env.AUTO_FETCH_CHANNEL = 'naukri';
await import('./auto-external-pipeline.mjs');
