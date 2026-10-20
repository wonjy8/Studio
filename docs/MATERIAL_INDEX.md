# Deterministic material metadata

This feature uses no AI, OCR, trained model, external service or new dependency. It preserves the source file, immutable filename/file ID, manual title/category/tags and existing access checks.

Scope of this first slice:

- Filename, extension, existing MIME type, size and recorded upload date remain searchable/displayable metadata.
- New PNG/JPEG uploads gain header-derived width, height, aspect ratio and landscape/portrait/square orientation. JPEG's bounded EXIF orientation scalar corrects rotated dimensions; GPS directories, location and camera text are not extracted.
- Whitespace-separated search words are AND conditions over existing title/tags/text and generated metadata, so `png 가로` works regardless of term order. Search normalizes Korean NFC, but does not perform semantic search or stemming. Generated dimension/orientation terms support Korean and English (`가로/landscape/horizontal`, `세로/portrait/vertical`, `정사각형/square`, `1920x1080`). They do not overwrite user tags.
- Existing Studio document blocks supply bounded searchable plain text beyond the short card preview. This parses content Studio already stores as text; it is not OCR or PDF/Office extraction.

Processing lifecycle: header extraction runs only in the ordinary authenticated `/api/files` POST upload transaction using bytes already received for that upload. It reads at most the PNG header or 64KiB of JPEG markers, never decompresses the image, and stores small owner-scoped metadata. Managed/admin upload paths are not hooked in this slice. Unsupported/malformed formats retain their original upload and omit dimensions. Listing, importing legacy materials and restarting the app never process existing file bytes or backfill derived image metadata. Existing files continue to search by existing names/type/text without pretending they have been image-indexed.

This adds no model/runtime to the 512MiB Studio container and no temporary image decoding to its 16MiB `/tmp`. All formats remain downloadable/openable through existing handlers; new dimension extraction supports PNG/JPEG only, not WebP/HEIC/GIF/PDF/video/audio/Office files.

Not implemented: people/faces, identity, animals, objects/scenes, visual semantic search, OCR, video keyframes, dominant colors/brightness, camera identity/settings or GPS. These must not be advertised as automatic tags. Specific-person recognition and external data transfer are outside this non-AI feature.

A future deterministic color option can sample **new raster uploads only** with browser `createImageBitmap` and a small Canvas, quantize pixel colors and calculate luminance. That needs explicit file/pixel bounds, mobile memory checks, owner-validated metadata and clear unsupported-format behavior before implementation. No decoder/model has been installed or original asset analyzed for it. Backfill of existing assets is a separate future action, not a deployment side effect.
