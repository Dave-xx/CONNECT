# ServiceConnect Security Specification

## 1. Data Invariants
1. **No Self-Assigned Admin or Verification Badges**: A user creating `/users/{userId}` can choose `customer` or `provider` roles (never `admin` unless already an admin). A provider creating `/providers/{providerId}` cannot set `verificationStatus: 'approved'` or `identityVerified: true` / `businessVerified: true` / `credentialsVerified: true` — only an authorized administrator can approve verification.
2. **PII Isolation**: `/users/{userId}` contains email, phone, and saved addresses and is strictly readable only by `isOwner(userId)` or `isAdmin()`. Public discovery reads `/providers/{providerId}` which contains zero private email/phone/home-address PII. Sensitive verification document numbers reside in `/providers/{providerId}/private/verification` (readable only by owner and admin).
3. **Booking & Message Participant Isolation**: `/bookings/{bookingId}` and its `/messages/{messageId}` subcollection can only be read by `customerId`, `providerId`, or `isAdmin()`. Exact job addresses are only inside the booking document.
4. **Verified Review Integrity**: Reviews in `/reviews/{bookingId}` require `bookingId` to exist, belong to `request.auth.uid` as `customerId`, have `status == 'completed'`, and enforce `customerId != providerId` (blocking self-reviews and duplicate reviews).
5. **Temporal Integrity**: Server timestamps (`request.time`) are required for `createdAt` and `updatedAt` on all mutations.
6. **Terminal State Locking**: Bookings in `completed` or `cancelled` status cannot be modified by customers or providers (only admins can resolve overrides).

## 2. Adversarial "Dirty Dozen" Payloads (Must Return PERMISSION_DENIED)
1. **Admin Role Escalation**: Customer sends `POST /users/{uid}` with `{ role: "admin" }`.
2. **Self-Verification Fraud**: Provider sends `PATCH /providers/{uid}` with `{ verificationStatus: "approved", identityVerified: true }`.
3. **Cross-User PII Read**: Customer A attempts `GET /users/{customerB_uid}`.
4. **Private Verification Doc Read**: Customer A attempts `GET /providers/{providerUid}/private/verification`.
5. **Unfiltered Booking List Scraping**: User sends `LIST /bookings` without a `customerId == uid` or `providerId == uid` constraint.
6. **Ghost Field Shadow Update**: Provider sends `PATCH /services/{serviceId}` adding `{ isSponsored: true }` or `{ unknownShadowField: "x" }`.
7. **Unverified Email Spoof**: User with `email_verified: false` claiming admin email attempts `WRITE /categories/plumbing`.
8. **Booking Participant Hijack**: Unrelated user C attempts `CREATE /bookings/{id}/messages/{msgId}` on a booking between A and B.
9. **Self-Review Attack**: Provider creates `/reviews/{bookingId}` where `customerId == providerId == request.auth.uid`.
10. **Uncompleted Booking Review**: Customer creates `/reviews/{bookingId}` while booking status is `'confirmed'` instead of `'completed'`.
11. **Terminal Booking Mutation**: Customer attempts `PATCH /bookings/{id}` to change `price` after `status == 'completed'`.
12. **Resource Poisoning (Oversized ID / String)**: Attacker creates `/providers/{2000-char-id}` or injects a 50KB bio string.
