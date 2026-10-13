# Project delivery workflow

- Maintain `docs/SCREEN_FUNCTIONALITY_TEST_TRACKER.md` as the screen and functionality inventory. Add new routes, screens, dialogs and features in the same change that introduces them.
- Prioritize mobile-friendly UI. Work through the queue in small batches of at most two screens per working day unless the user requests a different scope.
- Track functional E2E and mobile UI results separately. Mark `Tested` only after the full applicable journey passes with recorded evidence. Source inspection, unit tests and builds are not E2E evidence.
- Reopen affected verification statuses when behavior or layout changes. Record failures, blockers, fixes and retests honestly.
- After each completed feature or screen, run relevant verification, update the tracker, commit the scoped changes and push to `origin/develop`, as authorized by the user. Preserve unrelated local changes and never include secrets or test-user personal data.
- The daily queue is a planning document; it does not imply a configured automation.
