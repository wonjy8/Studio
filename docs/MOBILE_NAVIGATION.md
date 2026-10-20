# Mobile workspace navigation

At 900px and below, the existing workspace rail becomes a floating bottom bar. Workspace icons/labels, role-dependent menu visibility and account-scoped order reuse the desktop DOM. Long press/Alt+arrow ordering still works; rail insertion follows its horizontal axis. At narrow widths the bar scrolls internally, never widening the page, and the active item is brought into view.

Selecting a workspace opens its existing second-level menu as a full-screen browsing list. Selecting a menu/project opens the existing URL and content. The content header's “목록” opens the list again; “돌아가기”, Escape and browser Back/Forward use history entries with the same URL for list/detail state. Direct links still open content. Opening/closing a list retains the editor DOM and unsaved values; hidden content and menu panels are inert. Feature navigation keeps the existing leave guards and permission filters. Desktop collapse/reordering remain unchanged.

The bottom bar has 12px floating gutters, the common panel/control radii and safe-area offsets. `viewport-fit=cover` enables iPhone inset handling, including landscape main content. Main content reserves bottom space so its last controls can scroll above the bar. While a software keyboard reduces the visual viewport with a text input focused, the bar is hidden and inert; hardware-keyboard focus alone does not hide it. Modal screens also hide the bar. Real iOS keyboard/safe-area behavior still requires device verification; Chromium viewport emulation is not an iPhone hardware test.

Run `npm test`, `npm run check`, and, with Playwright available outside the repository:

```
STUDIO_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/qa-mobile-navigation.mjs
STUDIO_PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node tools/qa-sidebar-navigation.mjs
```

The isolated browser checks use fictional accounts/projects and disposable storage. They cover list/detail history, direct links, retained drafts, selected menu state, 320/390/768 widths, floating gutters, 44px targets, simulated IME shrink, desktop layout and role-dependent menus. The existing sidebar QA covers drag, cancellation, persistence, native touch scrolling and desktop editor preservation. Screenshots are written only to `/tmp`, not the public repository. No production data, accounts or OAuth grants are changed.
