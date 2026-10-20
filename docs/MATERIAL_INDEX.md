# Deterministic material metadata

This feature uses no AI, OCR, trained model, external service or new dependency. It preserves the source file, immutable filename/file ID, manual title/category/tags and existing access checks.

Scope of this first slice:

- Filename, extension, existing MIME type, size and recorded upload date remain searchable/displayable metadata.
- New PNG/JPEG uploads gain header-derived width, height, aspect ratio and landscape/portrait/square orientation. JPEG's bounded EXIF orientation scalar corrects rotated dimensions; GPS directories, location and camera text are not extracted.
- Whitespace-separated search words are AND conditions over existing title/tags/text and generated metadata, so `png 가로` works regardless of term order. Search normalizes Korean NFC, but does not perform semantic search or stemming. Generated dimension/orientation terms support Korean and English (`가로/landscape/horizontal`, `세로/portrait/vertical`, `정사각형/square`, `1920x1080`, `16:9`). They do not overwrite user tags.
- Existing Studio document blocks supply bounded searchable plain text beyond the short card preview. This parses content Studio already stores as text; it is not OCR or PDF/Office extraction.

Processing lifecycle: header extraction runs only in the ordinary authenticated `/api/files` POST upload transaction using bytes already received for that upload. It reads at most the PNG header or 64KiB of JPEG markers, never decompresses the image on the server, and stores small owner-scoped metadata. Managed/admin upload paths are not hooked in this slice. Unsupported/malformed formats retain their original upload and omit dimensions. Listing, importing legacy materials and restarting the app never process existing file bytes or backfill derived image metadata. Existing files continue to search by existing names/type/text without pretending they have been image-indexed.

This adds no model/runtime to the 512MiB Studio container and no server-side temporary image decoding to its 16MiB `/tmp`. All formats remain downloadable/openable through existing handlers; new dimension extraction supports PNG/JPEG only, not WebP/HEIC/GIF/PDF/video/audio/Office files.

Not implemented: people/faces, identity, animals, objects/scenes, visual semantic search, OCR, video keyframes, camera identity/settings or GPS. These must not be advertised as automatic tags. Specific-person recognition and external data transfer are outside this non-AI feature.

## Color and brightness for new browser uploads

The existing browser decoder (`createImageBitmap` and Canvas) samples new PNG/JPEG uploads only. No server decoder/dependency, external service or AI is used. Before decoding, a 64KiB header preflight limits files to 8MiB, 8 million pixels and 8192px per side. A 64×64 sample supplies up to three color buckets with at least 15% of visible alpha-weighted pixels, and alpha-weighted linear sRGB luminance: dark below 0.18, bright above 0.65, medium otherwise. Transparent pixels below 10% alpha are excluded; entirely transparent images receive no color summary. These are approximate pixel statistics, not scene/object recognition or semantic color names.

Search supports Korean/English color and brightness words, for example `빨간색 어두운`, `파랑`, `흰색 밝은`, `red dark`. Manual tags remain unchanged. Browser API absence, unsupported JPEG variants/formats, corrupt decoding and excessive bounds omit color metadata while preserving the existing upload behavior. WebP and other formats are not color-indexed in this slice. Direct API clients without this optional header retain dimension-only indexing.

The optional small enum-only upload header is untrusted descriptive metadata, not authority or evidence of image authenticity. The server validates its shape, values, byte/pixel limits and original header dimensions before storing it in the existing authenticated owner-scoped upload transaction. It grants no access and accepts no arbitrary text/location. No original image is modified. Lists, restarts and deployments never analyze or backfill existing files.
