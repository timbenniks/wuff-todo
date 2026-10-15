# Existing-account list sharing

Implemented October 15, 2026.

Open an owned list and choose **Share**. Enter the other person’s existing Wuff account email and choose **Invite**. They see **You’re invited** on their lists page and accept or decline there. No email is sent and public signup remains closed.

Accepted editors can add, edit, complete, reopen, delete, and reorder tasks. The owner alone renames/deletes the list, invites people, cancels pending invitations, and removes members. Editors can open **People** and leave. Invitations expire after seven days; inviting again creates a new invitation after the previous one is closed or expired. Private lists stay private.

Invitations show only the list title and owner before acceptance. Membership is authoritative for every web/API/MCP operation. Removing access blocks subsequent server reads and writes even when the former editor retains a valid session or MCP connection. The active web app checks changes on focus and every ten seconds, so a previously rendered screen may remain visible until its next refresh.

## MCP tools

- `get_list_sharing`: owner/editor identities and list version; pending invitations only for the owner.
- `list_invitations`: pending invitations addressed to the connected user.
- `invite_to_list`: owner invites an admitted account by email.
- `respond_to_invitation`: recipient accepts or declines.
- `cancel_invitation`: owner cancels a pending invitation.
- `remove_list_member`: owner revokes an editor’s access.
- `leave_list`: editor leaves.

Tools work without an embedded UI. The existing MCP App continues to browse accepted lists and manage tasks. Sharing settings and the invitation inbox have website controls; sharing tools return structured results to AI clients. Refresh the client’s tool catalog to discover the seven new tools (18 tools total).

Owner changes and leaving require the current list version. Each mutation takes an operation ID UUID: reuse it with exactly the same payload when retrying an uncertain response. Concurrent changes may return a conflict; read fresh state before a new operation. Old acceptance receipts never restore revoked membership.

## Verification

Synthetic Alex and Sam accounts on the isolated development branch exercised invitations, acceptance, shared editing, owner-only actions, and revocation through the browser, website API, and authenticated MCP transport. Domain tests additionally cover wrong recipients, unadmitted accounts, expiry, decline, cancellation, duplicate invitation requests, identical concurrent acceptance, leaving, scope limits, and task-write/revocation races.

Desktop and 390px browser checks covered owner sharing, recipient acceptance, editor task creation, membership removal, phone overflow, and Escape/focus restoration. These are browser viewport checks, not native iPhone/Android tests. No real user list was shared or changed for testing, and Joreel’s independent account/connection remains a user check.

![Owner sharing controls](screenshots/sharing-desktop.jpg)

![Editor controls at phone width](screenshots/sharing-mobile.jpg)
