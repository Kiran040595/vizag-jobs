#!/usr/bin/env node
/** Audit the live admin-approved company career targets without changing data. */
import { applyLocalEnv, pipelineConfig } from './lib/pipeline-env.mjs';

applyLocalEnv();

const apiKey = pipelineConfig.supabaseServiceRoleKey || pipelineConfig.supabaseAnonKey;
if (!pipelineConfig.supabaseUrl || !apiKey) throw new Error('SUPABASE_URL and a Supabase key are required.');

const response = await fetch(
  `${pipelineConfig.supabaseUrl}/rest/v1/companies?select=name,careers_url&is_directory_approved=eq.true&is_active_for_scrape=eq.true&careers_url=not.is.null&limit=1000`,
  { headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` } },
);
if (!response.ok) throw new Error(`Could not load companies (${response.status}).`);

const companies = await response.json();
const vizagTerms = ['visakhapatnam', 'vizag', 'rushikonda', 'gajuwaka', 'parawada', 'duvvada', 'anakapalle'];
const concurrency = 12;

async function audit(company) {
  try {
    const page = await fetch(company.careers_url, {
      redirect: 'follow',
      headers: { 'User-Agent': 'VizagJobs-career-portal-audit/1.0', Accept: 'text/html,*/*' },
      signal: AbortSignal.timeout(8000),
    });
    const text = (await page.text()).toLowerCase();
    return {
      ...company,
      status: page.ok ? (vizagTerms.some((term) => text.includes(term)) ? 'vizag_evidence' : 'reachable_no_vizag') : 'http_error',
      http_status: page.status,
      final_url: page.url,
    };
  } catch (error) {
    return { ...company, status: 'fetch_error', error: error instanceof Error ? error.message : String(error) };
  }
}

const results = [];
for (let index = 0; index < companies.length; index += concurrency) {
  results.push(...await Promise.all(companies.slice(index, index + concurrency).map(audit)));
}

const counts = Object.groupBy(results, (item) => item.status);
console.log(JSON.stringify({
  audited_at: new Date().toISOString(),
  total: results.length,
  counts: Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, value.length])),
  results,
}, null, 2));
