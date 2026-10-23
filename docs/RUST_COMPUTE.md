# Rust compute boundaries

This candidate is stacked on `a306ea5e5b208f5aafe8fe096e8aeb9f37eb09ec`.
It includes that candidate's NAS media/cache/document work; it is not a patch
against a main branch that already contains those changes. Review and merge the
combined candidate once, or first land its base and recheck the remaining diff.
Cloudflare/Drive migration remains excluded.

Normal paths now use the same Rust/WASM core for:

* NAS ZIP decompression and CSV parsing, inside one disposable Node Worker.
  Both manual Notion imports and the existing Bible repository import use it.
  Existing JS keeps note/Bible domain mapping and transaction validation. Input
  ownership transfers to the Worker without an extra full buffer copy when the
  buffer is wholly owned. Preview returns only a summary; decoded snapshots are
  not retained between requests. Commit rechecks the session before DB writes.
* Browser Materials text matching over UTF-16 code units. Existing NFC/lowercase
  preparation preserves query semantics, including lone surrogates. Retained
  index input is capped at 8MiB; overflow chunks of about 2MiB are searched and
  released individually by Rust. Each mounted authorized snapshot owns its index;
  refresh/mutation rebuilds it, and unmount zeroes/releases its WASM inputs.
  At most 60 cards render per page, with explicit previous/next navigation.
* Browser overlap lane sorting/heap assignment. Stable ties, the existing minimum
  30-minute collision duration and per-overlap-group columns remain unchanged.
  The bounded geometry cache contains numbers, never IDs, names or event objects.

UI, authentication, OAuth, authorization, DB persistence and ordinary network I/O
remain JS/Node. Existing source files and upload originals are not converted.
The image Rust/WASM module remains separate and unchanged.

## Limits, cancellation and fallback

The core has no WASM imports and a 256MiB maximum linear-memory limit. That is
not a measured RSS guarantee. ZIP keeps the existing 25MiB input, 5,000 entries,
16MiB per extracted file and 32MiB combined extracted limits, unsafe path and
encryption rejection, duplicate-name checks and bounded DEFLATE output. CSV
keeps the existing quote, whitespace, header-order and column-count semantics.
A 30-second worker timeout and request cancellation terminate processing. Only
one parser reserves a slot before reading its body; concurrent imports receive
429 rather than queueing whole archives in RAM. Parser errors/crashes release the
slot. Preview is read-only; committed writes retain existing atomic transactions.
A canceled client cannot undo a transaction already committed; the UI tells users
to inspect the list if they canceled after requesting storage.

If a browser cannot load WebAssembly, it visibly announces JS compatibility mode
for search/lanes. The old heap/query implementations remain only as that fallback
and benchmark references. NAS imports fail clearly if the Rust worker cannot
start; they never report an empty successful import. Unavailable processing does
not modify originals or bypass authorization.

## Measurement

`tools/bench-compute-efficiency.mjs` uses fictional data and separate processes
for ZIP cases. It reports cold Worker startup, result transfer and process maxRSS,
not just a parser microbenchmark. Search and lane figures are warmed medians;
search includes index result copying, with build/copy/memory costs separately
reported. These are local development observations, not NAS/mobile predictions.
The final measured values accompany the candidate report. In particular the
Rust search remains slower than the optimized JS index; the user's explicit
all-Rust instruction is a technology choice, not evidence of a speedup over that
alternative. It is faster than the old per-search normalization path in the
synthetic sample. No OOM cause or production reliability outcome is established.

Rebuild with `CARGO=/path/to/cargo node tools/build-compute.mjs`. Rust dependencies
are locked; notices are in `src/media/compute-licenses.txt`. The hashed WASM code
asset is public immutable content. Personal responses are not public-cached.
Node tests reject stale source/artifact hashes and run parity/security fixtures
against the actual shipped binary. Native Rust tests are included in CI.
