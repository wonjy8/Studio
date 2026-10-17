# Layout QA improvements

Purpose: plan people and furniture directly on the existing project canvas without duplicating members or inventory.

Flow: choose a visible kind icon, optionally link a member/inventory item, name it, then place it. Tables offer rectangle/circle selection and eight edge/corner resize handles. Numeric controls remain available for keyboard users. Circle resizing preserves a circle, since ellipse behavior has not been decided. Rectangles resize independently. Sizes are canvas CSS pixels (48–360), while placement coordinates retain percentage precision. Position forms show whole numbers but retain the original precise value when unchanged.

Reuse: existing button, field and modal primitives, domain operations and workspace validation. People use a person silhouette with their name beneath; no repeated generic person caption. Legacy tables without dimensions keep a compatible default. Removing a placement keeps linked members and inventory. No production access or migration is needed.

Security: server-side workspace validation bounds dimensions and allowed shapes, including inactive projects. No account or inventory ownership changes occur. Pointer cancellation restores position and dimensions; save follows existing revision checks.

Validation: `node --test tests/layout.test.js` passes 5 tests (legacy preservation, linked record preservation/project switching, invalid references, geometry bounds/circle policy, rendered controls and precision). `npm test` passed all 27 tests at the first combined snapshot; teammates may add further tests. `node --check src/app.js` passed. Real browser pointer/keyboard/cancel testing remains for the combined UI QA round; unit/render assertions do not establish browser interaction coverage.
