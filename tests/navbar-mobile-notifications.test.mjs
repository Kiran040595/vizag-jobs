import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const navbarSrc = readFileSync(path.join(repoRoot, 'src/components/Navbar.jsx'), 'utf8');
const bellSrc = readFileSync(path.join(repoRoot, 'src/components/QuestionNotificationBell.jsx'), 'utf8');
const studentAuthSrc = readFileSync(path.join(repoRoot, 'src/components/NavbarStudentAuth.jsx'), 'utf8');

test('Navbar.jsx includes QuestionNotificationBell in mobile top header bar', () => {
  // Must render in mobile top bar (lg:hidden)
  const mobileHeaderPattern = /<div className="ml-auto flex min-w-0 items-center gap-1\.5 lg:hidden">[\s\S]*?<QuestionNotificationBell[\s\S]*?className="shrink-0"[\s\S]*?<button[\s\S]*?aria-label=\{isOpen \? 'Close menu' : 'Open menu'\}/;
  assert.match(navbarSrc, mobileHeaderPattern, 'QuestionNotificationBell must be in mobile top header bar next to menu toggle');
});

test('Navbar.jsx removes duplicate QuestionNotificationBell from inside the mobile drawer', () => {
  // Mobile drawer section
  const drawerSection = navbarSrc.slice(navbarSrc.indexOf('id="mobile-nav-drawer"'));
  assert.ok(drawerSection.length > 0, 'mobile-nav-drawer must be present');
  assert.ok(
    !drawerSection.includes('<QuestionNotificationBell'),
    'QuestionNotificationBell must not be hidden inside the mobile drawer',
  );
});

test('Navbar.jsx closes mobile drawer when notification bell opens', () => {
  assert.match(
    navbarSrc,
    /onOpenChange=\{\(bellOpen\) => \{\s*if \(bellOpen\) setIsOpen\(false\);\s*\}\}/,
    'Bell must auto-close mobile drawer when opened',
  );
});

test('QuestionNotificationBell.jsx supports onOpenChange callback', () => {
  assert.match(bellSrc, /onOpenChange/, 'Bell must accept onOpenChange prop');
  assert.match(bellSrc, /updateIsOpen/, 'Bell must use updateIsOpen helper');
});

test('NavbarStudentAuth.jsx styles mobileHeader with responsive max width for profile pill', () => {
  assert.match(
    studentAuthSrc,
    /max-w-\[5\.5rem\][\s\S]*?xs:max-w-\[7\.5rem\][\s\S]*?sm:max-w-\[10rem\]/,
    'Mobile header profile pill must have responsive max-width to avoid header overflow',
  );
});
