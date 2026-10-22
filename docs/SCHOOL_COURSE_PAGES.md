# Course pages

Course content opens a landing page with semester/category/credits/professor chips, syllabus, tasks and one mixed ordered region of lecture-note and media entries. Course metadata is optional; no academic category is inferred. The existing schedule and task views remain available.

First initialization atomically saves a versioned page and sixteen week entries. Document bodies are created on first save, allowing existing documents to remain intact. Initialization is idempotent and revision conflicts reload the stored page rather than duplicating entries. Archived entries remain in the page with a restore control; their documents are preserved. Existing documents appear in a separate legacy list. The existing per-course document limit is100 and is enforced when saving a new document.

Notes and link/photo/video-file/file-link modules share drag order, accessible up/down controls and saved25/33/50/100 percent width. Mobile stacks entries and preserves image/video aspect ratio. Modules accept user-entered authorized URLs; no external data or school records are imported. Back navigation flushes document saves first, and note IDs use existing account-namespaced route parameters.

Document modification timestamps are server-assigned only when a persisted body/title changes. Legacy documents without a known timestamp display that absence; opening or migration does not fabricate a modification time. Note detail chips format known timestamps in the viewer's local timezone. The shared document editor's optional metadata hook is unused outside course pages.

School records remain in the account-owned revision-checked school store. Browser/API tests cover initialization races, revisions, timestamps, migration, archive/restore, mixed reorder/width, dirty navigation, reload/history, mobile and account isolation using synthetic fixtures.
