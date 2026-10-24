# NAS deployment and verification

Keep the existing Cloudflare Tunnel route to `http://studio:8080`. No router forwarding or public NAS port is required. Never paste tunnel tokens or passwords into GitHub, issues, chat, compose files, or terminal command arguments.

## One-time DSM update

1. In Container Manager, inspect cloudflared → Details → Network and note its existing **user-defined Docker network**. The Studio container must share it. If it currently uses Docker's default `bridge`, create a user-defined bridge in DSM and attach cloudflared there first; keep its existing command/token configuration private and unchanged.
2. Back up the current project configuration. Replace the Studio project compose with this repository's `compose.yaml`. Set the project environment variable `STUDIO_NETWORK` to the network name from step 1 (or replace only the network `name:` placeholder locally). Keep container name `studio`, internal port `8080`, and the route unchanged. Remove the old host port publication.
3. Build/recreate the project with the newly published image. The named volume `studio-data` is mounted at `/data`; retain it on all future updates. Do not delete volumes when recreating.
4. Provision an account. From DSM's container Terminal, launch `/bin/sh` in the **studio** container, then enter the following command. Replace `crew-admin` with your chosen non-sensitive login name. The password is read without echo, is not a command argument, and must contain 8–256 characters, including at least one uppercase English letter and one special character (whitespace does not count). This also resets an existing account and revokes sessions.

```sh
printf 'New password: '
stty -echo
IFS= read -r studio_password
stty echo
printf '\n'
printf '%s' "$studio_password" | node tools/account.js crew-admin
unset studio_password
```

A container shell runs as the same unprivileged user that owns `/data`. No password is needed in compose, and no tunnel token changes are needed.

## Acceptance checks after recreation

- Container Manager reports Studio healthy; `/health` returns `{ "ok": true }`.
- The public domain displays a login form. An unauthenticated `/api/workspace` returns 401.
- Log in, set the project title, add a Shoot, upload a fictional PDF and a fictional reference PNG. Preview/download them.
- Log out; API/file URLs must stop opening. Log back in from another browser and verify the same data.
- Restart Studio and verify the project and files remain. A second account must start empty and must not be able to open the first account's attachment URL.
- Confirm no NAS host port or router forwarding was added. If login returns an Origin error, verify APP_ORIGIN exactly matches the public HTTPS domain (no trailing slash).

## Backups and rollback

Stop Studio before taking a consistent snapshot/archive of the entire `studio-data` volume (including SQLite WAL files if present). Store backups privately on the NAS or encrypted backup storage. Test restoration to a separate volume before depending on a backup. Do not upload database/backups to this public repository.

For rollback, stop Studio, retain the data volume, and select the prior immutable image tag `ghcr.io/wonjy8/studio:<commit-sha>`. The old static prototype cannot read server data; retain the private volume for forward recovery. Account password reset uses the provisioning command above.

## Automatic updates with DSM Task Scheduler

The repository supplies `deploy/nas-auto-update.sh`. Download the reviewed script and upload it through File Station to your Studio project directory (for example `/volume2/docker/studio/nas-auto-update.sh`). This file contains source code only; no credentials are required. The script reads the existing running container's Compose labels and configuration, so it preserves the current project/network/volumes and updates only the `studio` service. It overrides a pinned image with the published `latest` image for scheduled updates. Do not delete the generated `.studio-update.override.yaml`: Compose records its path.

In DSM Control Panel → Task Scheduler, create a scheduled user-defined script:

- Name: `Studio automatic update`
- User: `root` (required to manage Docker)
- Schedule: every day, repeating every minute throughout the day
- User-defined script: `sh /volume2/docker/studio/nas-auto-update.sh`
- If the Studio project directory is different, set it explicitly: `STUDIO_PROJECT_DIR=/your/project/path sh /your/project/path/nas-auto-update.sh`

Save and run it once manually. Inspect its result. A changed image should report `Studio updated and healthy.` If the image is unchanged the task exits successfully without recreating the container. No credentials should be entered in the task or script.

The updater pulls the image before any restart, refuses an update without a writable persistent `/data` mount, serializes concurrent executions, preserves cloudflared, and checks container health. A failed image is recorded and will not be retried every minute; a newer published image can be attempted normally. If an update fails it attempts to restore the previous image and returns a failure so DSM can report it. Configure DSM's task failure notification if desired; notification setup depends on your NAS mail configuration. The rollback still requires confirmation that the restored container is healthy. It cannot reverse data migrations; future database changes must preserve backward compatibility or use a separately planned migration and backup.

A successful update briefly restarts Studio. Unsaved work may need retrying. To stop automatic deployment, disable this scheduled task. Retain the data volume and rollback image. Never schedule `docker compose down -v`, volume removal, or automatic image pruning. After an abrupt updater termination, inspect and remove the empty `.studio-update.lock` directory only after confirming no update is running.

Container publication now depends on Node tests, production image build and container health smoke checks passing, so a failed validation does not replace `latest`.


## Connecting ChatGPT as a private MCP app
See [connection setup and automatic registration](MCP_CONNECTION_SETUP.md) for the normal OAuth/DCR handoff and the separate user/plugin-owner steps.
After the image update, add `https://studio.wonjongyou.com/mcp` as a custom remote app in ChatGPT's developer/app settings and select OAuth. Availability depends on the account, plan and workspace policy; this does not publish Studio to a public app directory. The person connecting signs into Studio and explicitly grants read-only or read/write access. No OpenAI API key or separate in-app AI subscription is needed. This chat cannot change the user's ChatGPT account settings on their behalf.

The existing tunnel still routes to the Studio service. If Cloudflare Access blocks back-channel requests, allow external reachability for `/mcp`, `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server`, `/oauth/register`, `/oauth/authorize`, `/oauth/token` and `/oauth/revoke` while retaining Studio's OAuth checks. Do not disable edge protection for unrelated routes. The consent/login UI and `/api/connections/*` remain cookie-authenticated. Proxy logs must not capture token bodies, Authorization headers or authorization callback query strings. Validate the actual ChatGPT redirect URI against the supported exact HTTPS hosts if connection errors occur; do not broaden it to arbitrary hosts.

Acceptance: discovery metadata responds; unauthenticated `/mcp` returns 401 with WWW-Authenticate; connecting opens Studio consent; read-only access cannot call write tools; writable access proposes and confirms a fictional change; Studio refresh shows it; Settings → external connections → disconnect immediately blocks the client. Local protocol tests do not prove a ChatGPT account has registered or exercised the deployed endpoint.

This version adds invitation capacity columns transactionally. Older images using positional invitation inserts cannot create invitations against the expanded schema; roll forward to a compatible image instead of dropping columns or deleting data. Back up the volume before upgrades as described above. OAuth tables and workspace proposals reside only in the private volume.


If app creation stops before DCR reaches Studio, an administrator can use Settings → external connections → manual OAuth setup to generate a confidential client. Keep OAuth enabled in the external app and choose direct/manual client credentials instead of DCR. Copy the ID/secret directly between those settings; do not paste them into chat or public artifacts. The default registered callbacks are `https://chatgpt.com/connector_platform_oauth_redirect` and the equivalent `chat.openai.com` URL; if the external client displays a different callback, copy that exact supported HTTPS callback into Studio before generating the client. No wildcard redirect is allowed. A mismatch is an authorization failure, not a reason to disable validation.

### MCP content contract (tool schema 4)

Existing account-owned project consent and per-proposal confirmation remain required. No OAuth scope changes are needed. `configure_shoot` uses `entityId` for the shoot and `values.memberIds` / `values.gearIds` to replace selections; removing selections also removes dependent camera/layout entries, as disclosed in proposal impact. `copy_shoot` uses `entityId` and empty values, copying configuration and unfinished copies of linked tasks. `add_task` / `update_task` support name, completed, flagged, shootId, date and time. For `add_camera`, `add_layout_object` and `move_layout`, supply command-level `shootId` to edit the shoot configuration; omission retains the legacy project layout behavior. Always read IDs first. Project description and equipment member links are exposed in the schema as supported by the handler.

Organization stock, checkout/return, account documents and scripture/QT are outside this MCP editing contract. Do not request broader consent to work around unsupported operations. After deploying, compare `/health` revision and unauthenticated MCP `tools/list` (no project data) with the expected commit and schema. Then refresh the app's tool definitions in ChatGPT settings if available and open a new conversation; reconnect OAuth only if authentication or previously granted write consent requires it. A new plugin package is not needed for server tool updates. Reading project data successfully does not prove that the client has refreshed its tool schema.

Example requests: “촬영 목록을 보여줘”, “이 촬영에 할 일 ‘배터리 충전’을 추가하도록 제안해 줘”, “이 촬영의 인원과 장비 선택 변경을 제안해 줘”, “이 촬영을 복제하도록 제안해 줘”. Review the exact impact before confirming each proposal. Declining a proposal makes no writes; leave it unapplied until its ten-minute expiry. Revision conflicts require rereading, a new proposal and renewed confirmation.

### Full content contract (tool schema 5)

See [MCP_CONTENT.md](MCP_CONTENT.md) for the current resource coverage, per-connection full-content consent, bounded reads, stable semantic tool signatures and confirmed transaction lifecycle. Schema 4 project editing remains supported. Existing project-only connections are not silently expanded. New connections disclose the complete content scope; old connections can approve their own expansion in Studio settings. Account, settings, administrator and permission actions remain excluded.

## Container lifecycle and independent tunnel checks

Studio's standalone entry handles SIGTERM/SIGINT by stopping new HTTP connections,
draining active responses and then running its existing integration/worker/SQLite
cleanup. It closes stalled connections after eight seconds. Verify any locally
customized container stop timeout before rollout; no data-volume or memory-limit
change is required by this code. A forced shutdown is reported as a failure rather
than a successful drain.

The Docker healthcheck uses Node's HTTP client against fixed loopback
`127.0.0.1:8080/health`. It requires a bounded successful JSON health response and
never follows a redirect. Its existing 30-second interval and three-second Docker
limit remain unchanged. It checks Studio/SQLite availability, **not** the tunnel,
public DNS, outbound internet or the external domain.

The repository manages only the `studio` Compose service. Keep the independently
managed `studio-cloudflared` configuration private. Before changing that container,
review its actual image version, restart count/policy, stop timeout, network membership,
log driver/rotation and effective memory usage/limit using sanitized fields. Do not
paste its environment, full command, tunnel token or credential file. No cloudflared
binary, DNS pin, host-network mode, firewall rule or guessed memory cap is supplied
by this patch.

The updater remains serialized and uses `up -d --no-deps studio`, preserving the
cloudflared service. A failed registry pull exits before image tagging/recreation.
Its documented every-minute schedule does not itself imply every-minute restarts:
an unchanged image does not recreate Studio. Actual scheduler times and OOM events
must be compared on the NAS; application health cannot establish working tunnel
egress. Repeated DNS and direct outbound connection timeouts require host/network
investigation separately from this application patch.

Logging limits are not overridden without checking the existing driver and retention
policy. Large logs consume storage and may contribute reclaimable filesystem cache;
they are not alone evidence of a JavaScript memory leak. Preserve failure-time logs
and process/container mapping before proposing operational changes.

Background integration timers contain their own rejected promises, including failures
in the initial database enumeration before a per-account sync starts. An unexpected
cycle failure emits a static, rate-limited warning and retries on the existing next
interval; it no longer becomes an unhandled rejection that exits Node. Provider and
HTTP request failures still surface through their existing error paths. This is not
a global uncaught-exception suppression or proof of the cause of any NAS restart.
Shutdown also avoids writing integration error/diagnostic records after the DB closes.

A local-only container regression is available as `node tools/qa-nas-container.mjs`
after building a `studio-nas-candidate:<tag>` image and selecting it through
`STUDIO_LOCAL_TEST_IMAGE`. It refuses a nonlocal Docker endpoint, creates its own
synthetic data volume/bridge and loopback port, verifies health and origin access,
signals SIGTERM during an upload, restarts with the same volume and verifies stored
bytes/SQLite integrity. It removes only its own fixture resources. It never launches
a real Cloudflare Tunnel or mounts an existing Studio data volume.

### Private file and document revalidation

File and personal document GETs use session-bound opaque ETags and `private,
no-cache, must-revalidate` with `Vary: Cookie`. Every reuse contacts Studio to
check the current session and resource access; an unchanged file returns 304
without selecting its BLOB. The browser manages its own bounded HTTP cache;
Studio does not put private responses in a public service worker cache or enable
offline access. Logout, another session, deleted files and revoked project access
cannot validate the previous response. Existing downloaded local copies remain
outside Studio's control.

Opening a personal document from its list revalidates the library before mounting
the editor. A failed check leaves the list open and allows an explicit retry;
there is no background replacement of an active editor or unsaved draft. Project
and School editor refresh paths are unchanged in this first unit.

### Browser image derivatives

New standard file uploads preserve exact original bytes and send a small
thumbnail plus a <=600px-long-edge Reference preview generated in a bounded
Rust/WASM module Worker. The paired derivatives commit in one SQLite transaction;
a failed pair leaves the original intact and may be retried by its file ID.
Materials shows thumbnails and References uses medium previews; neither silently
fetches an original when a derivative is missing. Old files are not converted in
bulk. All three stored representations count against the existing owner quota.

No Rust runtime is needed on NAS: a content-hashed WASM code asset is checked in,
with source, Cargo.lock, build script and dependency notices. Only this public
code asset has immutable caching. Private image variants retain live authorization
and session-bound ETag revalidation. Existing NAS network, restart and updater
settings are unchanged. The synthetic comparison and supported-image limitations
are recorded in image-preview/README.md; the Rust path is not claimed faster than
native browser codecs or proven to fix the NAS OOM incident.

### Google read traffic

Calendar list requests that are simultaneously in flight for the same Studio
user, Google subject and connection generation share one provider request chain.
There is no completed metadata cache: the next read still checks Google for
permission changes, failures are not retained, and connection/account guards run
before and after waiting. Each caller gets its own result object. At most 64
pending read keys are retained; this is a memory bound, not a new user quota.
Existing per-calendar/date-range browser event caches and mutation invalidation
remain unchanged.

Browser-direct Calendar REST/CORS is supported by Google's GIS token model:
https://developers.google.com/identity/oauth2/web/guides/use-token-model . Studio's
current web-server OAuth flow retains refresh tokens and client credentials on
the server. This change does not expose any access/refresh token to the browser,
add a token relay, request new scopes or alter the OAuth client. Adopting GIS
would require a separately reviewed browser consent/expiry UX; unattended token
refresh is not promised. Server mediation therefore remains for this unit.
