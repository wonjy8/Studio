# NAS media and document reads

This feature branch preserves uploaded originals byte for byte. New supported
JPEG/PNG uploads receive a 256px thumbnail and an aspect-preserving preview with
long edge at most 600px, without upscaling. Preview generation runs in one bounded
browser Worker using Rust/WASM. It is not a server migration.

Standard, School and document attachments use separate owner-linked derivative
tables. Both derivatives commit atomically; retry replaces the same pair rather
than uploading another original. Document writes additionally require the current
session's document edit context. Reads authorize the original before checking an
ETag. Deleting an original cascades to its derivatives. All derivatives count
toward the existing combined storage quota. Existing files are not rewritten.

Lists use thumbnails; references, document image blocks and School image modules
use the medium preview. Explicit original links keep full-resolution access.
Missing/unsupported previews show a placeholder instead of silently downloading
the original. WebP, animated or profile-sensitive images and inputs beyond the
bounded decoder contract retain their original under existing upload policy.
The input file on the user's device is never modified. Unsupported formats are
not claimed to be optimized. Initial transfer can increase because originals
and derivatives are both uploaded. Synthetic measurements showed Rust slower
than browser codecs; mobile peak RSS and perceptual quality are not established.

Private responses use session-bound ETags and current authorization before 304;
no private responses are added to a public Service Worker cache. School document
navigation already fetches School state before mounting the editor. Project
document entry refreshes the entire workspace and revision together, before
mounting, and preserves active drafts. Concurrent remote edits produce the
existing 409 rather than replacing local input. Failed entry refresh offers a
retry without opening stale editable content. This is not offline edit sync.

## Google boundary

Current Calendar scopes are `calendar.events` and
`calendar.calendarlist.readonly`; optional shared-calendar scopes and unified
Tasks/Sheets grants may also be present. Client secrets and refresh credentials
are server-encrypted. No endpoint exposes bearer tokens to browsers.

Google's browser token model supports direct Calendar REST/CORS requests, but
requires a browser token lifecycle and approved JavaScript origin configuration.
A server token handoff would expose existing write-capable (potentially unified)
bearer credentials to browser code. It is not a read-only capability and cannot
be silently treated as equivalent to today's protected proxy. No new scopes,
OAuth grants, credentials, origin registrations or token exposure were applied.

This branch retains the server proxy and coalesces concurrent Calendar-list
reads for the same Studio account, Google subject and generation. It does not
make Calendar traffic browser-direct. Existing bounded event snapshots and
identity purge/fencing continue to apply. A subsequent read still revalidates
permissions; completed or failed provider responses are not retained by the
coalescer.

A direct-browser follow-up requires an explicit choice of browser GIS vs a
session-protected token handoff, review of the broader bearer exposure, CSP/XSS
and revocation behavior, and confirmation of any required authorized JavaScript
origin in the Google client. No actual account/security setting changes are
part of this candidate. See Google's official token-model guide:
https://developers.google.com/identity/oauth2/web/guides/use-token-model
