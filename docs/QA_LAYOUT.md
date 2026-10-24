# Layout QA improvements

Purpose: plan people and furniture directly on the existing project canvas without duplicating members or inventory.

Flow: choose a visible kind icon, optionally link a member/inventory item, name it, then place it. Tables offer rectangle/circle selection and eight edge/corner resize handles. Numeric controls remain available for keyboard users. Circle resizing preserves a circle, since ellipse behavior has not been decided. Rectangles resize independently. Sizes are canvas CSS pixels (48–360), while placement coordinates retain percentage precision. Position forms show whole numbers but retain the original precise value when unchanged.

Reuse: existing button, field and modal primitives, domain operations and workspace validation. People use a person silhouette with their name beneath; no repeated generic person caption. Legacy tables without dimensions keep a compatible default. Removing a placement keeps linked members and inventory. No production access or migration is needed.

Security: server-side workspace validation bounds dimensions and allowed shapes, including inactive projects. No account or inventory ownership changes occur. Pointer cancellation restores position and dimensions; save follows existing revision checks.

Validation: `node --test tests/layout.test.js` passes 5 tests (legacy preservation, linked record preservation/project switching, invalid references, geometry bounds/circle policy, rendered controls and precision). `npm test` passed all 27 tests at the first combined snapshot; teammates may add further tests. `node --check src/app.js` passed. Real browser pointer/keyboard/cancel testing remains for the combined UI QA round; unit/render assertions do not establish browser interaction coverage.

Follow-up geometry QA: large tables now reserve a 10px canvas gutter on all sides for resize handles. Actual table dimensions determine movement travel and edge placement. A table larger than the available canvas is uniformly reduced for display; stored sizes and precise percentage positions are unchanged. A resize observer reapplies this geometry on viewport changes. Zero-travel axes retain their stored coordinate during dragging. Geometry tests cover desktop/mobile, all edge positions, fractional positions, circles and rectangles, including resizing at an edge. `node --test tests/layout.test.js`: 6/6 passing. Browser confirmation is delegated to the combined QA round.

## Pointer resize correction

Operational QA found that the original centered delta-times-two resize changed size twice as fast as the pointer and recomputing percentage-based centers moved opposite boundaries. Resizing now starts from visible canvas bounds, moves the dragged boundary once, and converts the resulting anchored center back to percentage coordinates. Rectangles preserve opposite boundaries; circles preserve the opposite edge/corner and the perpendicular center for cardinal handles. Corner circle deltas project onto the equal-axis diagonal. Screen pointer deltas are converted to canvas CSS pixels before both move and resize.

Growth is capped by the anchored available canvas space and48–360 limits. An oversized shape fitted on a narrow viewport retains original stored size until an intentional resize; that resize adopts the visible fitted dimensions, then applies the pointer delta. Cancel restores original stored dimensions and coordinates. Unit tests cover all handles/limits/precision; tools/qa-resize-browser.mjs tests32 real Chromium handle/shape/screen-scale combinations, the measured west-edge shrink, circle centers, cancellation, reload and mobile fit. Existing unchanged position-save precision remains covered.

Repeated keyboard movement also exposed focus loss during save re-render. Direction-key saves now restore the same placement focus after the latest save finishes; the browser regression checks two successive moves, exact+2% source movement and unchanged dimensions.

## Thin-table mobile fit

Uniform fit previously reduced a valid360×48 table to240×32 in a260px canvas, conflicting with the48px domain/CSS minimum and causing drift on the next resize. Fitted rectangle axes now each retain at least48px (360×48 →240×48;48×360 →48×240 in a260px square canvas). Circle axes remain equal. This display-only adjustment retains stored dimensions until an intentional resize. Canvases below68px on either axis cannot contain the48px minimum plus handle gutters; pointer resize conservatively returns original stored geometry there. Tests exercise every handle, minimum axes, unaffected/opposite anchors and immutable source snapshots.

## Selected square handles and people

The canvas uses transient single selection: clicking/tapping or focusing an item exposes only its eight square handles. Blank/outside activation, Escape, navigation and reload clear selection. Enter, double-click and the existing position-edit list open numeric controls. Selection is never stored in project data.

People now store a square placement size with a safe80px default and48–240px limits; the silhouette retains its aspect and name typography stays readable. Tables retain existing48–360px and rectangle/circle policies. Legacy people without dimensions remain valid without a migration. Resizing/removing placements never changes linked member records. Pointer cancellation restores original exact dimensions/coordinates, including absent legacy fields; unchanged numeric saves preserve dimension and coordinate decimals.

## Compact phone outer gutters
`tools/qa-mobile-gutters.mjs` compares the CSS from main `c0a5ff90b3b8719b310a9091412dbe6389d98b9b` with the current layout using fictional data. Phone content/header/tabs have one 16px outer inset; cards/panels, document editor handles and bounded table/canvas scrolling retain internal spacing. Test widths: 320/360/390/430/600 and unchanged tablet/desktop 601/768/900/901/1440. Chromium `Emulation.setSafeAreaInsetsOverride` uses left24/right20/bottom34 to verify actual env() values apply once. Browser navigation, icon-picker keyboard focus and independent dialog sizing are checked.

Without safe-area side insets, the common usable content width changes 264→288 at320, 296→328 at360, 326→358 at390 and366→398 at430. Font metrics and touch controls are unchanged.

Release/cache inspection is read-only: the production Dockerfile runs the Node server; its default responses use `Cache-Control: no-store` (immutable WASM is separate). `/health` exposes `STUDIO_REVISION`, `/api/session` reports appVersion and Settings → Data shows its revision. There is no registered service worker in the repository. The standalone nginx config contains a one-hour static cache but this alone does not prove the user's NAS uses nginx. Published GHCR SHA/digest confirms image publication only, not NAS uptake or an already-open browser's loaded assets.
