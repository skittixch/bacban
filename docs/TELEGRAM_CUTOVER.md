# Telegram Cutover

This note tracks the move from WhatsApp-based private status replies to Telegram-based private status replies for BacBan/OpenCLAW work.

## Goal

Keep the quick private owner status flow, but move the destination channel from WhatsApp to Telegram so Eric does not need to message himself.

## Current State

- Live, verified phone-origin intake still uses the dedicated WhatsApp OpenCLAW agent `bacban-whatsapp-intake`.
- Private owner status is the part being cut over to Telegram.
- WhatsApp remains the fallback until Telegram send/receive is proven end to end.

## Verification Needed Before Cutover

1. A working Telegram bot or bridge exists in the local OpenClaw/BacBan environment.
2. A private Telegram target for Eric is configured locally.
3. A test status message can be sent and received on Telegram.
4. The reply loop still works for completion/blocked status updates.
5. Documentation and runbooks point to Telegram as the target channel, with WhatsApp clearly labeled as fallback only.

## Rollout Rule

Do not mark the cutover complete until the Telegram proof exists and the fallback posture is documented everywhere the private status channel is described.
