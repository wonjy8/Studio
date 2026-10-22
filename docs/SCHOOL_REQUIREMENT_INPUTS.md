# Graduation credit inputs

The requirements screen describes user-entered graduation credit targets. Earned credits come from existing completed/recognized course data; remaining credits compare the target with earned credits. No official institution thresholds are seeded, and totals alone do not certify graduation.

Major, liberal-education and general-elective add buttons open a dialog limited to that group. Standard categories supply their names without an extra name field. A custom choice reveals the required custom-name input. Unset targets remain blank/null; an explicitly stored zero or fractional legacy value is preserved. Existing custom names and category mappings remain intact. The course classification selector still includes all three groups.

The modal submits to an account-owned, revision-checked graduation-area endpoint. It edits one group/area, rejects cross-group category or area IDs, preserves unrelated records and does not expose a generic settings operation through MCP. Existing full School APIs remain available and unchanged.

Temporary-account tests cover each group, standard/custom visibility, blank/null and explicit zero, custom/legacy values, stale revisions, cross-account rejection, cancellation/edit/reload, desktop/mobile and the existing GPA/duplicate-credit calculation flow.
