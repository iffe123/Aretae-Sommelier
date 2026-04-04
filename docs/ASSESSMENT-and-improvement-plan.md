# Assessment and Improvement Plan for Aretae Sommelier

## Summary of Testing

A hands-on walkthrough of the current web app experience found that manual cellar workflows generally function, while key AI-assisted paths are unreliable or non-functional.

### Account management
- Sign-up requires display name, email, and password.
- Password requirements are not shown proactively, so users only learn constraints after submission.
- The password field can be marked invalid (red state) without a clear explanatory message.

### Cellar view
- New users land on an empty **My Cellar** state.
- The page presents shortcuts for scanning labels, AI sommelier, and food pairing, but those pathways are effectively blocked until at least one wine exists.
- The floating **+** action opens **Add New Wine** and manual entry is available.

### Add New Wine dialog
- Supports manual entry plus two AI-assisted methods:
  - **Label photo upload**: claims AI extraction from label images.
  - **Vivino lookup**: should return matching wines.
- Vivino searches for examples such as “Chateau Margaux 2015” and “Chateau Margaux” returned no results, indicating a likely integration issue (broken API path, credentials, or unimplemented behavior).

### AI Sommelier chat
- The chat entry point opens correctly.
- A standard question (for example, spicy Thai food pairing) returned an auth error: _“Your session expired. Please sign out and sign in again.”_
- This appeared immediately after login, suggesting token/session handling defects rather than user inactivity.

### Menus and sign-out
- Profile menu currently appears minimal (sign-out only), with limited account controls and preferences.

### Overall finding
Core AI capabilities (chat reliability, Vivino retrieval, and likely label extraction confidence) currently underperform relative to user expectations, while manual workflows are usable but need better validation UX.

---

## Comparative Research Highlights

Two market reference points show where user expectations now sit:

1. **CellarTracker (CellarChat)**
   - Emphasizes cellar-aware Q&A (what to open now, budget-aware suggestions, pairing against inventory).
   - Demonstrates practical value of retrieval-grounded responses over generic chat.
   - Recently expanded organizational features (custom lists), indicating demand for stronger collection management.

2. **Sommy.ai**
   - Focuses on conversational recommendations, menu/list scanning, and preference learning.
   - Uses progressive personalization via user history and feedback loops.
   - Explores collaborative recommendation scenarios for group dining.

### Product implication
Winning wine apps now combine:
- reliable conversational AI,
- personalized retrieval from user data,
- low-friction capture (scan/import/manual fallback), and
- organization/personalization features that improve over time.

---

## Detailed Improvement Plan

## 1) Stabilize AI and External Integrations

### 1.1 Fix session expiration in AI chat
- Audit auth lifecycle from login through AI request.
- Verify access token issuance, refresh timing, and server-side token verification.
- Add explicit telemetry around auth failures (expired token vs invalid token vs missing token).
- Add regression tests for:
  - new login + immediate chat,
  - background token refresh,
  - refresh failure fallback.

### 1.2 Add retrieval-grounded AI responses
- Store normalized wine metadata usable for retrieval (style, region, vintage window, price, inventory status).
- Build a retrieval layer that surfaces relevant bottles before LLM generation.
- Constrain prompts to retrieved context and include response rationale.

### 1.3 Repair Vivino lookup
- Validate endpoint config, credentials, and request signatures.
- Add timeout, retry, and rate-limit handling with user-visible fallbacks.
- Return ranked candidates (name, vintage, producer, image) and map selection to form fields.

### 1.4 Improve label-scanning UX and reliability
- Add processing states and confidence cues for auto-filled fields.
- Always allow user correction before save.
- Log extraction misses to improve model tuning and heuristics.

## 2) Improve Forms and Input Usability

### 2.1 Password guidance
- Show requirements inline before submit.
- Validate progressively while typing.

### 2.2 Field-level validation clarity
- Replace generic invalid states with actionable messages.
- Enforce type/range rules (numeric, vintage ranges, date ordering).

### 2.3 Optionality and progressive completion
- Keep only essential fields required for first save.
- Allow later enrichment without penalizing completion.

### 2.4 Draft and bulk data workflows
- Add draft save/restore for partial entries.
- Support CSV import/export for migration and portability.

## 3) Expand Cellar Management Value

### 3.1 Insights dashboard
- Add inventory, maturity window, and spend-by-dimension summaries.
- Surface “drink soon” and “past peak risk” signals.

### 3.2 Lists and tags
- Add user-defined lists and flexible tags for event or theme curation.

### 3.3 Notifications
- Offer opt-in reminders for drink windows and cellar milestones.

### 3.4 Wishlist and purchase planning
- Strengthen wishlist state with optional price/watch metadata.

### 3.5 Sync and resilience
- Ensure robust multi-device sync and graceful offline behavior.

## 4) Introduce Advanced AI Experiences

### 4.1 Food-pairing depth
- Expand pairing intelligence to include dish attributes and constraints.

### 4.2 Menu/shelf scanning
- Add OCR + matching pipeline to score candidate wines in context.

### 4.3 Preference modeling
- Build a user taste profile from ratings and interactions.
- Personalize ranking and explanation quality over time.

### 4.4 Collaborative recommendations
- Support multi-person preference and dish input for group outcomes.

### 4.5 Explainability
- Provide concise rationale for each recommendation to increase trust and learning.

## 5) Architecture, Security, and Compliance

### 5.1 Session and token architecture
- Use short-lived access tokens + refresh flow.
- Validate identity server-side on all AI/data operations.

### 5.2 Reliability controls
- Add API quotas, rate limiting, and graceful degradation messages.

### 5.3 Privacy and compliance
- Implement data export/deletion workflows and explicit privacy notices.
- Align with GDPR obligations for EU users.

### 5.4 Accessibility and internationalization
- Target WCAG conformance (contrast, keyboard, screen-reader semantics).
- Support locale-aware formatting, language variants, and currency display.

---

## Suggested Delivery Roadmap

### Short term (0–3 months)
- Fix auth/session reliability for AI chat.
- Restore Vivino search functionality.
- Improve validation UX and password guidance.
- Launch retrieval-grounded chat for a focused query set (pairings, drink-now).

### Medium term (3–6 months)
- Release label-scanning enhancements and robust review/edit flow.
- Add notifications, basic analytics dashboards, lists/tags, and CSV import/export.
- Begin first-generation preference profiling.

### Long term (6+ months)
- Deliver menu/shelf scanning and collaborative recommendation features.
- Expand mobile/offline capabilities.
- Explore compliant commerce or pricing partnerships where regionally permitted.

---

## Success Metrics (Recommended)

- **Reliability:** AI chat success rate, Vivino lookup success rate, average API latency.
- **UX quality:** form completion rate, validation error recovery rate, add-wine completion time.
- **Engagement:** weekly active users, bottles added per user, AI sessions per user.
- **Retention:** 30/90-day retention and repeat recommendation usage.
- **Trust:** user-rated recommendation usefulness and explanation clarity.

Tracking these metrics from the start will help prioritize backlog items based on measurable user impact.
