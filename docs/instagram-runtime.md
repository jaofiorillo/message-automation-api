# Instagram runtime: research and decisions

Runs the automations built by `/flows` against a real Instagram professional
account, the way ManyChat's Instagram automations do: a DM keyword or a comment
on a post/reel starts a flow, buttons continue it.

The ManyChat side comes from two captures (`docs/manychat-automation-capture.md`:
the 2026-10-16 creation lifecycle and the 2026-10-20 comment-trigger capture
with real values). The Meta side comes from Meta's documentation, read on
2026-10-20.

## Meta platform (from the docs)

Instagram API with Instagram Login, host `graph.instagram.com`, examples on
`v26.0`, `Authorization: Bearer <Instagram user token>`.

| Topic | Contract |
|---|---|
| Webhook handshake | `GET` with `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`; reply with the challenge |
| Webhook signature | `X-Hub-Signature-256: sha256=<HMAC-SHA256(app secret, payload)>` |
| Webhook delivery | `{object: "instagram", entry[{id, time, messaging[] \| changes[]}]}`; up to 1000 updates per batch; retried for up to 36 h, so deduplicate; reply 200 promptly |
| DM / postback | `messaging[].message{mid, text, is_echo?, quick_reply?{payload}}`, `messaging[].postback{mid, title, payload}` |
| Comment | `changes[{field: "comments", value{id, text, from{id, username}, media{id, media_product_type}}}]` |
| Send | `POST /<IG_ID>/messages {recipient{id}, message}`; text ≤ 1000 UTF-8 bytes; 24 h window |
| Button template | `message.attachment{type: template, payload{template_type: button, text ≤ 640 chars, buttons[1..3] web_url \| postback}}` |
| Private reply | `recipient{comment_id}`; one message per comment, within 7 days; more only after the person answers |
| Public reply | `POST /<comment_id>/replies {message}` |
| Permissions | `instagram_business_basic`, `instagram_business_manage_messages`, `instagram_business_manage_comments` |

Sources:
[Send messages](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api),
[Webhooks setup](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup),
[Webhook examples](https://developers.facebook.com/documentation/instagram-platform/webhooks/examples),
[Private replies](https://developers.facebook.com/docs/instagram-platform/private-replies),
[Button template](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/button-template),
[Quick replies](https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api/quick-replies).

Unconfirmed in the docs, handled defensively:

- The comment id field: the examples page shows `comment_id`, the long-standing
  payload uses `id`. Both are accepted.
- Whether a private reply may carry a button template. The docs only show
  text; ManyChat's "comment → DM with a button" suggests it works. We send the
  same message shape as a normal DM.
- Which exact bytes are signed. We sign-check the raw request body.

## ManyChat behaviour reproduced

- **DM keyword** (`triggers.keywords`, already captured): a DM matching a rule
  starts the flow at its root content.
- **Comment to DM** (captured `feed_comment_trigger` widget): a comment on a
  chosen post/reel or any post, containing one of the include keywords (or any
  comment) and none of the exclude keywords, optionally only top-level
  comments, gets a private reply with the flow and optionally one random
  public reply under the comment.
- **Buttons**: a content button leads to another content; url buttons open a
  page.
- ManyChat marks the first content of a comment flow with
  `private_reply: "private_reply"` when the trigger is added.

## Decisions

- One account per deployment, configured by environment (`INSTAGRAM_*`). No
  account table or OAuth flow, because the API has no auth yet and storing
  tokens through a public route would be unsafe.
- Messages with buttons → button template; without → text. Publish now
  rejects messages over the Instagram limits (640 chars with buttons, 1000
  bytes without), so a live flow is always sendable.
- Postback payload `content:<contentId>`, the published content id (stable
  across republishes). A payload for a deleted content or a flow that is not
  live is ignored.
- After the messages of a content, its `targetOid` chain is followed, at most
  10 contents per run.
- Comment trigger fields map to the widget: `mediaIds` (empty = `all_posts`),
  `includeKeywords` / `excludeKeywords` (contains, case-insensitive, stored
  lowercased; exclude wins), `rootCommentsOnly` (`track_root_comment_only`,
  uses the webhook's `parent_id`), `publicReplies`. ManyChat's "next post"
  option is not built (needs media webhooks).
- Comment runs send only the first message of the root content (Meta's
  one-message private reply). The rest of the flow continues when the person
  taps a button. ManyChat lets a content opt out of private reply ("inside the
  messaging window"); here a comment-started run always uses it.
- First match wins, by `(sort, id)`, for both keyword rules and comment
  triggers. Only flows with `status: live` run; drafts never do.
- Echoes, messages from the account itself and its own comments are dropped,
  so public replies do not trigger the account again.
- Each event key (`instagram:message:<mid>`, `instagram:comment:<id>`) is
  stored in `InboundEvent` before handling, so Meta's retries are no-ops. A
  failed send is logged and not retried.
- Every sender is upserted into `Contact` with `lastInteractionAt`
  (and the username, from comments).

## Not built

Story replies and mentions, welcome message, default reply, conversation
starters (ice breakers), quick replies in the editor, live comments, the 24 h
window check before sending, and a queue between the webhook and the sends.
