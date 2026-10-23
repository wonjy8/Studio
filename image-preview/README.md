# Browser image preview module (candidate)

Original bytes are never modified. New standard file uploads keep three linked
representations: the exact input original, a <=256px-long-edge Materials thumbnail,
and a <=600px-long-edge Reference preview (<=1,000,000 bytes). Small images are not
upscaled. Derivatives are generated on the device before upload; NAS only validates
and stores them. The original and both derivatives count toward the existing
250MiB combined quota. The derivative pair commits atomically and can be retried
against its existing file ID without uploading the original again. Original-only
partial success is explicit. There is no batch transformation of existing files.
Legacy/unsupported files show an explicit original-open option rather than
fetching the original automatically. Document/School image uploads are unchanged.

Derivative eligibility (not original storage limits): PNG/JPEG only, <=8MiB encoded and <=8 million pixels / 8192px per side, <=256px
thumbnail (<=512KiB) and <=600px reference (<=1,000,000 bytes). EXIF orientation is applied. PNG alpha is preserved;
JPEG derivatives are lossy quality 78 (thumbnail) / 82 (reference). APNG, CMYK JPEG, embedded ICC profiles and non-sRGB PNG color metadata are declined to
avoid silently flattening animation or changing profile interpretation. WebP,
HEIC, RAW, SVG and video are preserved without automatic conversion. Metadata is
not copied into derivatives. The original retains its original metadata.

A single disposable module Worker runs decoding/resizing/encoding in Rust. The
queue holds at most four waiting jobs, times out after 30 seconds and supports
AbortSignal cancellation. A job copies encoded input into WASM once and encoded
output out once; full-resolution RGBA never crosses JS/WASM. WASM linear memory
has a hard 128MiB maximum; this is a bound, not a measured browser memory figure.
Unsupported/failed/aborted preview jobs preserve the original path. NAS retains
file authentication, content type/dimension/size validation, per-user quota and
current shared-read access checks. No new OAuth scope or cloud setting is used.

Build: install official Rust + wasm32-unknown-unknown, then run
`node tools/build-image-preview.mjs`. Cargo.lock pins dependencies; the generated
approximately 0.49MB WASM filename is content-hashed and uses public immutable HTTP
caching for code only. Worker code and private image responses are separate.
The CSP permits `wasm-unsafe-eval`, not JavaScript unsafe-eval; worker-src is self.
Source and dependencies are MIT/Apache/BSD/Zlib-compatible as recorded in
THIRD_PARTY_NOTICES.txt. Keep the notices alongside distributed source.

Local synthetic measurement (2048x1536 JPEG, 3,186,926 bytes): Rust thumbnail
15,778 bytes and reference 165,972 bytes; original SHA256 unchanged. Repeated
preview transfers are ~99.5%/~94.8% smaller than the original, while initial
upload adds both derivatives (~5.7%). Rust took ~223–264ms vs native browser
~57–74ms on this fixture, so Rust is NOT claimed faster. WASM committed linear
memory was 17,367,040 bytes; native codec peak and total browser RSS were not
measured. These synthetic numbers do not establish real NAS OOM causation.

The native comparison uses the same dimensions and nominal quality numbers,
but encoder quality scales, chroma sampling and resize filters are not identical.
No perceptual equivalence/PSNR or native codec peak-memory claim is made.

Built locally with rustc 1.99.1. The generated manifest records the source/lockfile/build-script hash; Node CI rejects a stale binary manifest after source changes. The original standard file/document size and format limits are unchanged.
