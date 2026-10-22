# Project-owned flow, Google-account-owned calendar

Only the Studio project owner may prepare and confirm creation/sharing. Site administrators and linked project readers receive no owner override. The actual Google data owner is the owner's explicitly connected account. The owner's canonical project sources use that owner's previously enabled publication engine. Current linked Studio members remain read-only through the shared-project API; this feature does not introduce member event authoring or expand their permissions. No member's personal token is borrowed.

Creation/sharing is separately user initiated. Existing Calendar connection scopes do not expand automatically. The existing callback and PKCE/session flow request `calendar.app.created` plus `calendar.acls` only after an explicit scope approval in project settings; event/list scopes remain required. Google ACL scope covers owned calendars' sharing permissions and is disclosed accurately. Studio restricts usage to the marked calendar created by this flow. No live grant, calendar, invitation, Cloud setting or credential is provisioned by code deployment.

Prepare returns an expiring, single-use server context bound to owner/session/Google generation/project membership/revision and the exact normalized name, timezone, recipients, roles and notification choice. Confirm performs changes. Only individual verified-by-user email addresses and reader/writer roles are supported; no domain, public, owner or automatic membership invitations. Sharing notifications default off and require an explicit choice.

One durable record per owner/project serializes provisioning. Creation uses a unique description marker. Only an explicit provider rejection may return to the planned state. Local live/session failures after a successful provider write remain uncertain. Unknown creation outcomes are reconciled through bounded calendar-list reads; no blind second calendar POST occurs. A missing marker remains a visible recovery block. ACL write intents persist before provider calls, including responses lost or rejected by a post-write guard. Omitted recipients are reconciled and removed before the next plan may complete. ACL successes persist individually; retries read existing exact user rules and do not resend successful invitations. Removal touches only rules recorded by this flow and refuses externally changed roles. Partial failures pause publication until the owner reviews and completes the plan. Latest-state reload is explicit and asks before discarding a draft.

Studio membership is distinct from Google ACL. Membership or connection-generation changes pause publication before provider writes and require owner review, including explicit removal of former recipients. They do not falsely claim Google access was revoked. Disconnect stops token use and publishing; it does not delete the Google calendar or its existing ACLs. The owner must review Google sharing directly if disconnected. Existing mapped event/calendar IDs and timezone semantics are preserved; selecting the new shared target does not move or delete old events.

MCP exposes neither these settings nor their OAuth/ACL operations. Existing resource registry remains typed and deny-by-default.

Official scope/method references (checked 2026-10-22):
- https://developers.google.com/workspace/calendar/api/auth
- https://developers.google.com/workspace/calendar/api/v3/reference/calendars/insert
- https://developers.google.com/workspace/calendar/api/v3/reference/acl/insert
