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
