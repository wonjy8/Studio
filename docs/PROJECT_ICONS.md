# Project icon catalog

## Rationale and flow

Project identity must be recognizable across the sidebar and settings without adding visual noise. The project form keeps the six original identities and adds a searchable, categorized catalog of **1,900** choices. Search supports English icon names/tags, category names, and Korean aliases for common production and social icons. Korean aliases are not full translations of the upstream catalog.

Choose a category or search, browse 48 results at a time, then select an icon. The selected identity remains in a separate form field while searching or paging; filtering cannot accidentally replace it. Native radio controls provide keyboard selection; search, category and paging controls have labels. Creation and project settings reuse the same form and binder.

Only the icon id is stored in the project. The domain allowlist uses the same catalog as the picker, so UI, server workspace validation and external command validation agree. Unknown ids remain rejected. The original `production`, `play`, `book`, `camera`, `folder`, and `sparkle` ids remain unchanged.

## Sources and licenses

- Tabler Icons **3.34.1**, https://github.com/tabler/tabler-icons and npm `@tabler/icons@3.34.1`: 1,893 outline SVG bodies, names, categories and search tags. MIT license retained in `src/design-system/icons/TABLER-LICENSE.txt`.
- Simple Icons **15.19.0**, https://github.com/simple-icons/simple-icons and npm `simple-icons@15.19.0`: KakaoTalk SVG. CC0 license retained in `src/design-system/icons/SIMPLE-ICONS-LICENSE.txt`.
- Six preexisting Studio originals retain their original rendering.

Tabler selection includes brand icons and a balanced round-robin selection across upstream categories, preferring non-numbered, non-`off` variants, plus common production primitives. YouTube, Instagram and Facebook come from Tabler; KakaoTalk comes from Simple Icons. Brand marks remain the property of their respective owners; inclusion does not imply affiliation.

Metadata is checked into `catalog.js`; SVG bodies are checked into `paths.js`. The app does not contact an icon CDN, load user-supplied markup, or send searches outside the browser. SVG input came from the pinned packages; only their shape bodies are retained, with no executable markup or external references. This adds approximately 790 KB uncompressed to initial JS source; the picker creates at most 48 choices at once rather than 1,900. A future bundler can split the path payload if initial transfer becomes a measured problem.

## Updating

Review the upstream licenses, keep stable saved ids, and add rather than silently replacing identities. Retain the same metadata fields (`id`, `name`, `category`, `keywords`) and pure SVG shape bodies. Update the allowlist and renderer together through the shared catalog. Run the project icon and workspace/command tests plus the full suite. Confirm search, empty results, next/previous, keyboard selection and selection preservation in the browser.
