import assert from 'node:assert/strict';
import {
  employerSearchBlob,
  formatEmployerRegisteredAt,
  mapEmployerProfileRow,
} from '../src/lib/adminEmployerProfile.js';

const row = {
  user_id: '11111111-1111-1111-1111-111111111111',
  company_name: 'Acme Shipyard Pvt Ltd',
  contact_name: 'Ravi Kumar',
  contact_email: 'hr@acme.example',
  phone: '+91 98765 43210',
  website: 'https://acme.example',
  company_logo_url: '',
  is_active: true,
  created_at: '2026-07-01T10:00:00.000Z',
  updated_at: '2026-07-02T10:00:00.000Z',
};

const mapped = mapEmployerProfileRow(row, { total: 3, pending: 1, published: 2 });
assert.equal(mapped.companyName, 'Acme Shipyard Pvt Ltd');
assert.equal(mapped.contactName, 'Ravi Kumar');
assert.equal(mapped.profileComplete, true);
assert.equal(mapped.jobStats.pending, 1);

const incomplete = mapEmployerProfileRow({ ...row, company_name: 'Your company' });
assert.equal(incomplete.profileComplete, false);

assert.ok(employerSearchBlob(mapped).includes('acme shipyard'));
assert.ok(employerSearchBlob(mapped).includes('ravi kumar'));

console.log('admin-employers.test.mjs: OK');
