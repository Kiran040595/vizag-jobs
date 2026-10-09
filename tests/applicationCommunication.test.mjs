import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_INSTAGRAM_CHANNEL_URL, getApplicationCommunication, normalizeCommunicationLink } from '../src/lib/applicationCommunication.js';
test('missing group uses the existing Instagram channel', () => {
  for (const job of [{}, {group_link:null}, {group_link:'  '}]) {
    assert.equal(getApplicationCommunication(job).url, DEFAULT_INSTAGRAM_CHANNEL_URL);
    assert.equal(getApplicationCommunication(job).button, 'Join Instagram channel');
  }
});
test('custom WhatsApp and Instagram groups take priority over the default', () => {
  assert.equal(getApplicationCommunication({group_link:'https://chat.whatsapp.com/invite'}).button,'Join WhatsApp group');
  assert.equal(getApplicationCommunication({groupLink:'https://www.instagram.com/channel/example/'}).url,'https://www.instagram.com/channel/example/');
  assert.equal(getApplicationCommunication({group_link:'https://ig.me/j/example'}).button,'Join Instagram group / channel');
});
test('normalizes links and rejects unsafe or malformed links', () => {
  assert.equal(normalizeCommunicationLink(' chat.whatsapp.com/invite '),'https://chat.whatsapp.com/invite');
  for (const link of ['javascript:alert(1)', 'http://example.com/group', 'https://', 'https://user:pass@example.com/group','https://example.com/with spaces']) assert.throws(()=>normalizeCommunicationLink(link));
  assert.equal(getApplicationCommunication({group_link:'javascript:alert(1)'}).url,DEFAULT_INSTAGRAM_CHANNEL_URL);
});
