# Materials selection and removal

Selections belong to one visible collection/filter. Search, category/date/type/sort changes clear the gallery selection; refresh prunes removed IDs. Each collection displays a selected count, “현재 목록 전체 선택” and “선택 해제”. Native checkboxes have separate touch targets from opening/editing controls. Cancellation performs no deletion. There is no background or automatic delete retry.

| Surface | Selection action | Existing persistence/limits |
| --- | --- | --- |
| 모든 자료: uploaded files and links, every type tab/filter | Permanently delete selected records | Existing per-item materials DELETE; file-in-reference/script guards remain. Referenced link deletion is blocked because the existing importer would otherwise recreate it. Optional If-Match uses the item's updatedAt; changed records stay intact. |
| 모든 자료: owned account documents | Permanently delete selected owning documents | Existing document-library full-value PUT with fresh selected-document comparison and revision CAS; unrelated documents are preserved. |
| 모든 자료: owned project documents | Permanently delete selected owning documents | Existing queued workspace save/CAS; compare the selected document to current state within the mutation queue. Concurrent changes require refresh/reselection. |
| Reference library | Permanently delete selected references | Existing revision-bearing DELETE; project-linked references cannot be deleted until unlinked. Attachment files remain. |
| Project 연결 자료 | Unlink selected library-backed references; remove project-local reference entries | Existing per-reference unlink removes project/camera links, preserves library originals and files, and uses workspace revision serialization. Project-local entries reuse the existing queued workspace CAS with stable-ID/snapshot checks and camera-reference cleanup; files remain. Conflicts stop subsequent link attempts. |
| Reference editor attachments | Exclude selected photos/files from that reference | Existing reference form save; original files remain. Closing without saving can discard the draft. |
| Reference board | Exclude selected board items | Text changes follow existing board autosave. Attachment/link exclusion updates the reference draft and requires form save; original files/sites remain. |

Deletion is per item, not an atomic bulk transaction. The UI reports successes and retained/failed items separately. A failed/stale selection is not automatically retried. Where no recovery endpoint exists, the confirmation says the deletion is permanent; reference attachment exclusions retain their existing draft recovery.

Read-only/shared projections are not given new destruction rights. Legacy project-local references without a library link use the owning workspace removal path, never the library unlink endpoint. Import/reference pickers retain their existing selection-for-import behavior; they do not delete source records. Document editor menus, unrelated equipment, accounts, calendars and Google integration data are outside this feature. Only owning authenticated routes are called; no new arbitrary destruction API or permission expansion is introduced.

Verification uses temporary fictional data. `tools/qa-material-selection.mjs` covers normal open behavior, multiple selection/select-all/clear/filter scope, cancelled and partially blocked deletion, stale metadata, owning document CAS, draft recovery, board exclusion, project unlink and narrow/mobile/desktop layouts. Existing empty-reference and shared-control metrics browser QA remain applicable.
