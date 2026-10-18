# Canonical HTTPS entry

`index.html` loads `/src/canonical-origin.js` as its first external classic script. The script redirects only `http://studio.wonjongyou.com` on the default HTTP port to the fixed origin `https://studio.wonjongyou.com`, retaining path, query and fragment. It uses `location.replace` to avoid adding an HTTP history entry. Localhost, other hostnames, HTTPS and unusual ports retain their existing origin.

The same entry script starts `/src/app.js` only on the non-redirect branch after DOM readiness. No application/login/API code starts in the canonical HTTP document. CSS and application entry paths are absolute, so deep routes load the same assets. No inline script or CSP relaxation is needed.

This is a browser fallback, **not an HTTP301/308 response or a replacement for transport security**. The initial HTTP document and script still travel over HTTP. Configure Cloudflare **Always Use HTTPS** or an equivalent trusted edge HTTP→HTTPS redirect to enforce the redirect before delivering application content. TLS/HSTS/edge changes are outside this code change; no Cloudflare or production configuration is modified here. Fragment preservation is client-side because browsers do not send fragments to servers.

If the zone also serves other applications, prefer a host-scoped edge rule: match only scheme `http` and hostname `studio.wonjongyou.com`, redirect to the fixed origin `https://studio.wonjongyou.com` while preserving the request path and query. Do not enable an unrelated zone-wide policy without reviewing those applications. Keep the tunnel's internal `http://studio:8080` target unchanged. Verify the public HTTP URL returns a redirect before app content, then verify the HTTPS target loads without a loop; no login or account changes are needed for these checks.

Verification uses synthetic intercepted HTTP/HTTPS browser routes and localhost only. It verifies the fixed target/path/query/fragment, no HTTP app or login API execution, no extra HTTP history entry, and unchanged localhost/other-host/alternate-port behavior. No real credentials or production data are used.
