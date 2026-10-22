# Independent School credit goals and category choices

Graduation settings optionally contain `groupRequiredCredits.major` and `.liberal`. Each is a nullable, user-entered credit target, independent of the overall graduation target and of detailed requirement amounts. Existing records omit these keys and remain unset. The summary compares these targets with the existing deduplicated earned-credit composition; S/P earned-credit treatment and GPA exclusion remain unchanged. MCP overview proposals merge partial group targets without clearing the omitted sibling, and retain existing consent, revision and ownership checks.

New selectable categories include major elective required/general and liberal academic world/foundation. Existing major required/core, general liberal education, writing, foreign language and general elective remain. The former unsplit major elective and seven retired liberal categories retain their IDs, names, mappings and aggregate treatment; they appear when editing a course currently carrying that value and in relevant existing mappings, but are not offered as new choices. No legacy course is inferred to belong to a replacement category.

Matching requirement name/category labels no longer repeat. Constant calculation prose is removed from the dashboard; unset/unallocated states and actual ambiguous-credit/GPA selection warnings remain. Group names gain narrow red/green/brown markers with transparent backgrounds using existing group colors.

Validation includes legacy preservation, new/retired options, independent target changes, duplicate credits, S/P and invalid values, MCP partial updates, full test suite and isolated Chromium 1440/390/320 input/cancel/reload/layout screenshots. No institutional requirements or real course data are seeded.
