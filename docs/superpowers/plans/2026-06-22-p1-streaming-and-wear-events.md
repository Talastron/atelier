# P1: Streaming Concierge + Wear-Event Occasions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stream Concierge / Manifesto / Wardrobe-Audit replies so first text appears in ~200ms instead of 3-5s of blank wait, AND capture per-wear "occasion" context (e.g. "gallery opening") so the Concierge can truthfully say "you wore this last to the X" — closing the most-quoted marketing line.

**Architecture:** Two independent task groups. TG1 adds a new `geminiTextStream` wrapper in `src/firebase.js` mirroring the existing `geminiText` shape, then rewrites three call sites to use it (Concierge, Manifesto, Wardrobe Audit). TG2 adds a parallel `wearOccasions: { dateISO → string }` map (mirroring the existing `wearNotes` pattern — no migration headache, no schema change to the `wearHistory` array), captures occasion text in the wear-log UI, and threads recent wears + occasions into the Concierge system prompt.

**Tech Stack:**
- App: React 18, Vite 6, Tailwind 4, Firebase 11 (AI Logic / Gemini 2.5 Flash), lucide-react icons
- AI: Firebase AI Logic Google AI backend — `model.generateContentStream()` returns `{ stream, response }` where `stream` is async iterable of `EnhancedGenerateContentResponse` chunks and `response` resolves to the final aggregated response (used for token counting).
- Persistence: Firestore at `/users/{uid}/items/{itemId}` already holds `wearHistory` array and `wearNotes` map; `wearOccasions` joins this trio with the same shape.
- No test framework installed in this repo. Verification is `npm run dev` + visual smoke per task (same convention as the P0 plan at `docs/superpowers/plans/2026-06-21-p0-marketing-product-alignment.md`).

**Repo:** `C:\Users\SibylleMoller-Sherwo\Documents\Digital Wardrobe`

**Branch strategy:** One feature branch per task group, off main.
- TG1: `p1/streaming-concierge`
- TG2: `p1/wear-occasions`

---

## File Structure Overview

| File | Change | Why |
|---|---|---|
| `src/firebase.js` | **modify** (~50 lines added near `geminiText`) | New `geminiTextStream(prompt, opts, feature, onChunk)` wrapper. Same checks (rate limit, per-user cap, App Check), same usage tracking, but iterates `result.stream` and fires `onChunk(chunk)` for each fragment |
| `src/App.jsx` | **modify** (3 separate call sites for TG1 + 2 for TG2) | TG1: rewrite Concierge `send()`, Manifesto `regenerateManifesto()`, and Wardrobe `analyzeWardrobeGaps()` to use the streaming wrapper. TG2: add Occasion input to the wear-log modal, persist `wearOccasions` map, include recent wears+occasions in the Concierge system prompt |

No new files. Both task groups extend existing modules.

---

## Task Group 1 — Streaming Concierge / Manifesto / Wardrobe Audit

### Task 1.1: Add `geminiTextStream` wrapper to `src/firebase.js`

**Files:**
- Modify: `src/firebase.js` (add new exported function near `geminiText` around line 460)

- [ ] **Step 1: Add the streaming wrapper**

Open `src/firebase.js`. Find the existing `geminiText` export (around line 460). Immediately AFTER it (before `geminiTextVision`), add:

```javascript
// Streaming variant of geminiText. Calls onChunk(text) as fragments arrive
// from the model. Returns the fully-accumulated text after the stream
// completes. Use this for free-form text replies (Concierge, Manifesto,
// wardrobe audit narrative) — NOT for jsonMode calls (the JSON is only
// valid when whole; partial chunks aren't parseable). Single Firebase AI
// Logic round-trip; streaming just delivers the tokens incrementally as
// the model produces them, so first text appears in ~200ms instead of the
// 3-5s blocking wait of generateContent.
//
// `onChunk` is optional — if not provided, the function still returns the
// final string but with no per-chunk callback (degrades to "I waited for
// the whole reply" behaviour, useful for callers that want to opt out of
// streaming UI without changing the call site signature).
export async function geminiTextStream(prompt, opts = {}, feature = 'unlabeled', onChunk = null) {
  checkRateLimit();      // per-browser burst limit (same as geminiText)
  checkUserDailyCap();   // per-user daily cap (same as geminiText)
  try {
    const modelName = opts.model || 'gemini-2.5-flash';
    const ai = getAiSafe();
    const model = getGenerativeModel(ai, {
      model: modelName,
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        // NOTE: jsonMode intentionally omitted — partial JSON chunks
        // aren't valid JSON. Use plain geminiText({jsonMode:true}) for
        // structured output.
      },
    });
    const result = await model.generateContentStream(prompt);
    let accumulated = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (!text) continue;
      accumulated += text;
      if (onChunk) onChunk(text);
    }
    // Stream complete. Resolve the final response for token counting.
    const finalResponse = await result.response;
    recordCall();        // record only on successful API reach (matches geminiText pattern)
    recordUserCall();

    const promptStr = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);
    const tokens = extractTokenCounts({ response: finalResponse }, promptStr.length, accumulated.length);
    logAiUsage({
      feature,
      model: modelName,
      hasVision: false,
      inputTokens: tokens.inputTokens,
      outputTokens: tokens.outputTokens,
      estimated: tokens.estimated,
    });
    return accumulated;
  } catch (err) {
    if (!isConfigError(err)) recordCall();
    throw mapGeminiError(err);
  }
}
```

- [ ] **Step 2: Verify it builds**

Run from the repo root:
```bash
npm run build
```
Expected: builds clean. If "isConfigError is not defined" appears, the function exists already (defined for non-streaming geminiText) — confirm it's in scope.

- [ ] **Step 3: Commit**

```bash
git checkout -b p1/streaming-concierge
git add src/firebase.js
git commit -m "$(cat <<'EOF'
feat(ai): geminiTextStream wrapper for incremental responses

Same checks (rate limit, per-user cap, App Check), same usage
tracking, same error mapping as geminiText. Difference: iterates
result.stream and fires onChunk(text) for each fragment.

For free-form text only (no jsonMode — partial chunks aren't
parseable). Single Firebase AI Logic round-trip; tokens arrive
incrementally instead of in one block at the end. First chunk
typically lands in ~200ms vs 3-5s blocking wait.

onChunk is optional; without it the function still returns the
final accumulated string, just no per-chunk callback. Lets callers
opt into streaming UI progressively.

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 1.1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.2: Stream Concierge replies

**Files:**
- Modify: `src/App.jsx` — `generateConciergeReply` function (around line 1348) + the Concierge component's `send` function (around line 12625 — but search-confirm the line number first; this file is 16k+ lines and refactors shift positions)

The plan: keep `generateConciergeReply` for its prompt-building logic, but add a streaming variant that calls `geminiTextStream`. Then rewrite the Concierge `send` function to use it and update the message state on each chunk.

- [ ] **Step 1: Find the existing Concierge functions**

```bash
grep -n "function generateConciergeReply\|const send = async\|setMessages.*role: 'assistant'" src/App.jsx | head -20
```

Note the line numbers for:
- `generateConciergeReply` function (returns a string today; uses `geminiText`)
- The `send` async function inside `AtelierConcierge` (around line 12620)
- The assistant-message setMessages call after the AI reply

- [ ] **Step 2: Add `import { geminiTextStream }` to App.jsx**

Find the existing import line near the top of `src/App.jsx`:
```javascript
import { auth, db, onAuthStateChanged, signInWithGoogle, sendMagicLink, signOutUser, geminiText, geminiTextVision, isAIEnabled } from './firebase.js';
```

Add `geminiTextStream` to the destructured list:
```javascript
import { auth, db, onAuthStateChanged, signInWithGoogle, sendMagicLink, signOutUser, geminiText, geminiTextVision, geminiTextStream, isAIEnabled } from './firebase.js';
```

- [ ] **Step 3: Convert `generateConciergeReply` to support streaming**

Find the function (around line 1348). It currently ends with `await geminiText(prompt, {...}, 'concierge')`. Replace that ONE line so the function takes an optional `onChunk` callback and uses the streaming wrapper:

Before:
```javascript
async function generateConciergeReply({ messages, items = [], outfits = [], styleProfile = '', ownerFirstName = '' }) {
  // ... (existing prompt-building code) ...
  return await geminiText(prompt, { temperature: 0.75 }, 'concierge');
}
```

After:
```javascript
async function generateConciergeReply({ messages, items = [], outfits = [], styleProfile = '', ownerFirstName = '', onChunk = null }) {
  // ... (existing prompt-building code unchanged) ...
  return await geminiTextStream(prompt, { temperature: 0.75 }, 'concierge', onChunk);
}
```

Two changes: add `onChunk = null` to the destructured params, swap `geminiText(...)` → `geminiTextStream(..., onChunk)`.

If `onChunk` is null, behaviour is identical to before (no streaming UI, just the final string). Existing call sites that don't pass `onChunk` keep working unchanged.

- [ ] **Step 4: Rewrite the Concierge `send` function to use streaming**

In `AtelierConcierge` (around line 12625), find the `send` function. It looks roughly like:

```javascript
const send = async (textOverride) => {
  const text = (textOverride ?? input).trim();
  if (!text || busy) return;
  const next = [...messages, { role: 'user', text, ts: new Date().toISOString() }];
  setMessages(next);
  await saveCurrentThread(next);
  setInput('');
  setBusy(true);
  setError(null);
  try {
    const reply = await generateConciergeReply({
      messages: next,
      items,
      outfits,
      styleProfile,
      ownerFirstName,
    });
    const withReply = [...next, { role: 'assistant', text: reply || '(no reply)', ts: new Date().toISOString() }];
    setMessages(withReply);
    await saveCurrentThread(withReply);
  } catch (err) {
    setError(err?.message || 'Something interrupted us. Try again?');
  } finally {
    setBusy(false);
  }
};
```

Replace the whole `try` block with the streaming version:

```javascript
const send = async (textOverride) => {
  const text = (textOverride ?? input).trim();
  if (!text || busy) return;
  const userMsg = { role: 'user', text, ts: new Date().toISOString() };
  const afterUser = [...messages, userMsg];
  setMessages(afterUser);
  await saveCurrentThread(afterUser);
  setInput('');
  setBusy(true);
  setError(null);

  // Insert an empty placeholder assistant message that will fill in as
  // chunks arrive. The streaming=true flag lets the bubble render a
  // pulsing caret-style indicator while text is mid-stream.
  const placeholder = { role: 'assistant', text: '', ts: new Date().toISOString(), streaming: true };
  setMessages([...afterUser, placeholder]);

  let accumulated = '';
  try {
    await generateConciergeReply({
      messages: afterUser,
      items,
      outfits,
      styleProfile,
      ownerFirstName,
      onChunk: (chunk) => {
        accumulated += chunk;
        // Update the last (placeholder) message's text in place. React
        // re-renders the bubble; user sees text grow smoothly.
        setMessages((prev) => {
          const next = [...prev];
          const last = next[next.length - 1];
          if (last && last.streaming) {
            next[next.length - 1] = { ...last, text: accumulated };
          }
          return next;
        });
      },
    });

    // Stream done. Finalize the placeholder (strip streaming flag) and
    // persist to Firestore. Use a fresh build of the final message so the
    // saved thread matches what the user sees.
    const finalMsg = { role: 'assistant', text: accumulated || '(no reply)', ts: new Date().toISOString() };
    setMessages((prev) => {
      const next = [...prev];
      next[next.length - 1] = finalMsg;
      return next;
    });
    await saveCurrentThread([...afterUser, finalMsg]);
  } catch (err) {
    // Strip the placeholder so the user doesn't see an empty bubble alongside the error
    setMessages((prev) => prev.filter((m) => !m.streaming));
    setError(err?.message || 'Something interrupted us. Try again?');
  } finally {
    setBusy(false);
  }
};
```

- [ ] **Step 5: Add a streaming indicator to the ConciergeMessage bubble**

Find `ConciergeMessage` component (around line 12907 — search `function ConciergeMessage`). The assistant bubble currently renders text inside a `<p>`. While streaming, append a pulsing caret so the user sees "more text coming". The pulsing caret is a single span the JSX adds AT THE END of the streaming text.

Find:
```javascript
function ConciergeMessage({ role, text }) {
  if (role === 'assistant') {
    return (
      <div className="flex flex-col items-start max-w-[90%]">
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
          <span className="text-[9px] tracking-[0.28em] uppercase text-stone-500">Stylist</span>
        </div>
        <div className="bg-white rounded-2xl rounded-tl-md ring-1 ring-stone-200/70 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_4px_12px_-6px_rgba(28,25,23,0.12)] px-5 py-4">
          <p className="font-display text-stone-900 leading-relaxed text-[15px] sm:text-base whitespace-pre-line">{text}</p>
        </div>
      </div>
    );
  }
  // ... (user bubble unchanged)
}
```

Change the signature to accept `streaming`, and append the caret when streaming + show a typing-pulse if there's no text yet:

```javascript
function ConciergeMessage({ role, text, streaming = false }) {
  if (role === 'assistant') {
    return (
      <div className="flex flex-col items-start max-w-[90%]">
        <div className="flex items-center gap-2 mb-1.5 px-1">
          <span className="inline-block w-3 h-px bg-brass-400" aria-hidden="true" />
          <span className="text-[9px] tracking-[0.28em] uppercase text-stone-500">Stylist</span>
        </div>
        <div className="bg-white rounded-2xl rounded-tl-md ring-1 ring-stone-200/70 shadow-[0_1px_2px_rgba(28,25,23,0.04),0_4px_12px_-6px_rgba(28,25,23,0.12)] px-5 py-4">
          {streaming && !text ? (
            // No text yet — show three pulsing dots (matches existing
            // "Thinking…" pattern that fires while busy)
            <span className="inline-flex gap-1 items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-pulse" style={{ animationDelay: '300ms' }} />
            </span>
          ) : (
            <p className="font-display text-stone-900 leading-relaxed text-[15px] sm:text-base whitespace-pre-line">
              {text}
              {streaming && <span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" aria-hidden="true" />}
            </p>
          )}
        </div>
      </div>
    );
  }
  // ... (user bubble unchanged)
}
```

- [ ] **Step 6: Pass `streaming` through the messages.map**

Find the messages-rendering loop in `AtelierConcierge` (search `messages.map((m, i)`). It currently looks like:
```javascript
{messages.map((m, i) => (
  <ConciergeMessage key={i} role={m.role} text={m.text} />
))}
```

Change to:
```javascript
{messages.map((m, i) => (
  <ConciergeMessage key={i} role={m.role} text={m.text} streaming={!!m.streaming} />
))}
```

- [ ] **Step 7: Hide the redundant "Thinking…" pulse when streaming is active**

There's an existing busy-state indicator (the pulsing dots block) that shows separately when `busy` is true. With streaming, the dots already render INSIDE the streaming placeholder bubble — having both is noisy.

Find the existing busy block (search for `{busy && (` near the messages render — around line 12880):

```javascript
{busy && (
  <div className="flex items-center gap-2 text-stone-400 text-sm">
    <span className="inline-flex gap-1">...</span>
    <span className="font-display italic text-stone-400">Thinking…</span>
  </div>
)}
```

Change the guard so it only renders when there's no streaming placeholder yet (race: streaming flag is set inside the setMessages call which is async — busy fires first):

```javascript
{busy && !messages.some((m) => m.streaming) && (
  <div className="flex items-center gap-2 text-stone-400 text-sm">
    <span className="inline-flex gap-1">...</span>
    <span className="font-display italic text-stone-400">Thinking…</span>
  </div>
)}
```

- [ ] **Step 8: Build smoke**

```bash
npm run build
```
Expected: builds clean. If there's a hoisting issue (`isConfigError` etc.), confirm the new code is in `firebase.js`, not stranded in `App.jsx`.

- [ ] **Step 9: Manual verify in dev**

```bash
npm run dev
```

Open localhost, sign in, open Concierge. Send "What should I wear today?". You should see:
- Three pulsing dots within ~200ms (the empty-placeholder state)
- Text begins to appear within ~500ms — words filling in left-to-right
- A blinking caret follows the last character while streaming
- Caret disappears when stream completes
- Send another message → conversation continues, history is preserved
- Reload the page → both messages persisted (Firestore save still happens on stream-complete)

- [ ] **Step 10: Commit**

```bash
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat(concierge): stream replies via geminiTextStream

Concierge replies now stream incrementally. First text appears in
~200-500ms instead of the previous 3-5s blocking wait — same model,
same cost, dramatically better UX.

Wiring:
- generateConciergeReply gains an optional onChunk callback; if
  provided, calls geminiTextStream and forwards chunks. If null,
  returns the accumulated string at the end (callers that don't
  opt in to streaming UI keep working unchanged).
- AtelierConcierge.send inserts an empty assistant placeholder with
  streaming:true, then appends to its text on each chunk via
  setMessages updater. On completion, strips the streaming flag and
  persists to Firestore (one write at end, not per-chunk).
- ConciergeMessage renders three pulsing dots when streaming with
  no text yet, then text + pulsing caret as chunks arrive. Strips
  the caret on stream complete.
- Pre-existing "Thinking…" sibling indicator is gated off when a
  streaming placeholder exists, to avoid showing two indicators.

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 1.2)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.3: Stream Style Manifesto generation

**Files:**
- Modify: `src/App.jsx` — `generateStyleManifestoWithGemini` (around line 1415) + the `StyleManifestoCard.run` function (search for `regenerateManifesto` or the manifesto card render around line 14600+)

- [ ] **Step 1: Convert `generateStyleManifestoWithGemini` to support streaming**

Find the function (around line 1415). Same shape as Task 1.2 — add `onChunk = null` to the args and swap the geminiText call:

Before:
```javascript
async function generateStyleManifestoWithGemini({ items, outfits, inspirations = [] }) {
  // ... (prompt-building)
  const text = await geminiText(prompt, { temperature: 0.7 }, 'manifesto');
  if (!text) throw new Error('The Concierge did not respond');
  return text;
}
```

After:
```javascript
async function generateStyleManifestoWithGemini({ items, outfits, inspirations = [], onChunk = null }) {
  // ... (prompt-building UNCHANGED)
  const text = await geminiTextStream(prompt, { temperature: 0.7 }, 'manifesto', onChunk);
  if (!text) throw new Error('The Concierge did not respond');
  return text;
}
```

- [ ] **Step 2: Find the StyleManifestoCard `run` function**

```bash
grep -n "generateStyleManifestoWithGemini\|StyleManifestoCard\|styleManifestoAt" src/App.jsx | head -10
```

Locate the component that calls `generateStyleManifestoWithGemini` — usually called `StyleManifestoCard` and has a local `run` async function. Find the line that does:
```javascript
const text = await generateStyleManifestoWithGemini({ items, outfits, inspirations });
```

- [ ] **Step 3: Add `streamingText` state and wire `onChunk`**

Inside `StyleManifestoCard`, near the existing useState calls, add:
```javascript
const [streamingText, setStreamingText] = useState('');
const [isStreaming, setIsStreaming] = useState(false);
```

In the `run` function, before the await, set up the streaming UI:
```javascript
const run = async () => {
  setBusy(true);
  setError(null);
  setStreamingText('');
  setIsStreaming(true);
  try {
    let accumulated = '';
    const text = await generateStyleManifestoWithGemini({
      items,
      outfits,
      inspirations,
      onChunk: (chunk) => {
        accumulated += chunk;
        setStreamingText(accumulated);
      },
    });
    // Persist the final manifesto to Firestore (existing logic unchanged)
    await onSaveManifesto?.(text); // <- replace with whatever the existing call is
    setIsStreaming(false);
  } catch (err) {
    setError(err?.message || 'Could not compose your manifesto.');
    setIsStreaming(false);
  } finally {
    setBusy(false);
  }
};
```

- [ ] **Step 4: Render the streaming text**

Find the JSX that renders the manifesto body. It probably looks like:
```jsx
<p className="text-stone-700 leading-relaxed whitespace-pre-line">{manifesto}</p>
```

Change to render the streaming text in place of the manifesto while streaming, with a pulsing caret:
```jsx
<p className="text-stone-700 leading-relaxed whitespace-pre-line">
  {isStreaming ? streamingText : manifesto}
  {isStreaming && <span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" aria-hidden="true" />}
</p>
```

If the manifesto-card has a separate empty/loading state ("Compose your first manifesto"), make sure isStreaming overrides it so the user sees the text growing, not the empty state.

- [ ] **Step 5: Build + manual verify**

```bash
npm run build
npm run dev
```

In the running app: Profile → Style Manifesto → Refresh (or Generate). Should see text appear word-by-word, with a pulsing caret following. Total time should feel faster than before even though the underlying call takes the same wall-clock duration.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat(manifesto): stream the 3-paragraph brief via geminiTextStream

Manifesto generation (~3-5s for the full 3-paragraph piece) now
streams. User sees the first paragraph appearing while the second
is still being composed by the model. Same content, same cost,
much shorter perceived wait.

Wiring mirrors Task 1.2: generateStyleManifestoWithGemini gains an
optional onChunk; StyleManifestoCard tracks streamingText state +
isStreaming flag; renders the live accumulated text with a pulsing
caret while streaming, swaps to the final stored manifesto when done.

Firestore write happens once at stream-complete (not per chunk).

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 1.3)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 1.4: Stream Wardrobe Gap Audit

**Files:**
- Modify: `src/App.jsx` — `analyzeWardrobeGapsWithGemini` (around line 663) is a JSON-mode call so it CANNOT be streamed as-is (partial JSON isn't valid). The fix: split into two phases — a narrative summary that streams, then the structured strengths/gaps/recommendations that's JSON.

Honest scope-check before starting: if you decide this is too much complexity for too little benefit, SKIP this task and stop TG1 at Task 1.3. The Concierge and Manifesto streaming are the headline wins; the wardrobe audit is an occasional power-user feature. Decide based on time available.

If proceeding:

- [ ] **Step 1: Decide on the split**

Current shape: `analyzeWardrobeGapsWithGemini` returns `{ strengths, gaps, recommendations }` as parsed JSON. 

Recommended split:
- Phase 1: stream a narrative INTRO paragraph (free-form text, 2-3 sentences)
- Phase 2: AFTER phase 1 completes, call the existing JSON function for the structured output

This gives the user immediate visual feedback (the narrative streams in) while the slower structured analysis runs second.

- [ ] **Step 2: Add a separate narrative-streaming function**

Above `analyzeWardrobeGapsWithGemini` (around line 663), add a new function:

```javascript
// Quick narrative intro that streams while the slower structured audit
// (analyzeWardrobeGapsWithGemini below) runs. Two-call pattern lets the
// user see "Reading your closet…" prose immediately, with the formal
// strengths/gaps/recommendations arriving after as a structured block.
async function streamWardrobeAuditIntroWithGemini({ items, inspirations = [], onChunk = null }) {
  if (!isAIEnabled()) throw new Error('Concierge is not yet set up.');
  const counts = {
    total: items.length,
    owned: items.filter((i) => i.status === 'owned' && !i.deletedAt).length,
    wishlist: items.filter((i) => i.status === 'wishlist').length,
    byCategory: {},
  };
  for (const i of items) {
    if (i.status !== 'owned' || i.deletedAt) continue;
    counts.byCategory[i.category || 'Other'] = (counts.byCategory[i.category || 'Other'] || 0) + 1;
  }
  const catLines = Object.entries(counts.byCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, n]) => `${cat}: ${n}`)
    .join(', ');

  const prompt = `You are an editorial stylist about to deliver a private wardrobe audit.

The user has ${counts.owned} owned pieces (${catLines}), ${counts.wishlist} on wishlist, ${inspirations.length} saved inspirations.

Write a SHORT opening (2-3 sentences max, ~50 words) that:
- Acknowledges the shape of the wardrobe in one observation
- Sets up the formal strengths/gaps/recommendations that will follow
- Voice: warm, considered, like a couturier preparing notes for a client
- No bullet points, no headings, no JSON. Just prose.

Begin directly — no "Here is" or "Let me" preamble.`;

  return await geminiTextStream(prompt, { temperature: 0.7 }, 'wardrobe-gap-intro', onChunk);
}
```

- [ ] **Step 3: Wire the intro stream into the Wardrobe Audit UI**

Find the component that triggers the audit (`grep -n "analyzeWardrobeGapsWithGemini" src/App.jsx`). It's `analyzeWardrobeGaps` or similar inside the Insights tab.

Add `streamingIntro` state alongside the existing audit state. Run the intro stream first, then call the structured audit:

```javascript
const [streamingIntro, setStreamingIntro] = useState('');
const [phase, setPhase] = useState('idle'); // idle | intro | structured | done | error

const run = async () => {
  setError(null);
  setStreamingIntro('');
  setPhase('intro');
  try {
    // Phase 1: stream the narrative intro
    let intro = '';
    await streamWardrobeAuditIntroWithGemini({
      items,
      inspirations,
      onChunk: (chunk) => {
        intro += chunk;
        setStreamingIntro(intro);
      },
    });
    // Phase 2: structured audit (JSON-mode, can't stream)
    setPhase('structured');
    const data = await analyzeWardrobeGapsWithGemini({ items, inspirations });
    setAuditData(data);
    setPhase('done');
  } catch (err) {
    setError(err?.message || 'Audit failed.');
    setPhase('error');
  }
};
```

- [ ] **Step 4: Render both phases**

```jsx
{phase === 'intro' && (
  <p className="text-stone-700 italic leading-relaxed">
    {streamingIntro}
    <span className="inline-block w-0.5 h-4 align-middle ml-0.5 bg-stone-700 animate-pulse" aria-hidden="true" />
  </p>
)}
{phase === 'structured' && (
  <>
    <p className="text-stone-700 italic leading-relaxed">{streamingIntro}</p>
    <div className="mt-3 flex items-center gap-2 text-stone-500 text-sm">
      <span className="inline-block h-4 w-4 rounded-full border-2 border-stone-300 border-t-stone-700 animate-spin" />
      <span>Composing the formal audit…</span>
    </div>
  </>
)}
{phase === 'done' && auditData && (
  <>
    <p className="text-stone-700 italic leading-relaxed mb-4">{streamingIntro}</p>
    {/* existing strengths/gaps/recommendations rendering — unchanged */}
  </>
)}
```

- [ ] **Step 5: Build + verify**

```bash
npm run build
npm run dev
```

In the running app: Insights tab → "Analyse my wardrobe". Should see narrative paragraph streaming in within ~1s, followed by a spinner + "Composing the formal audit…" message while the structured part runs, then the full strengths/gaps/recommendations panel renders.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat(wardrobe-audit): stream narrative intro before structured audit

The wardrobe gap audit JSON call is fundamentally not streamable
(partial JSON isn't valid). Two-phase approach instead:
- Phase 1: streamWardrobeAuditIntroWithGemini sends a small free-text
  prompt asking for a 50-word narrative opening. Streams via the new
  geminiTextStream wrapper. User sees prose appearing within ~1s.
- Phase 2: AFTER intro completes, the existing analyzeWardrobeGaps-
  WithGemini runs (JSON-mode, ~3s) for the structured strengths /
  gaps / recommendations. Spinner + 'Composing the formal audit…'
  message bridges the gap.

Two Gemini calls vs one — extra ~£0.0008 per audit. Trade is real but
worth the perceived latency win: total wall-clock about the same, but
the first second now shows real content instead of a blank spinner.

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 1.4)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task Group 2 — Per-Wear Occasion Capture

### Task 2.1: Add `itemWearOccasions` accessor + back-compat read

**Files:**
- Modify: `src/App.jsx` (add one helper function near `itemWearNotes` around line 1963)

- [ ] **Step 1: Add the accessor**

Open `src/App.jsx`, find `itemWearNotes` (around line 1963). Immediately AFTER it, add:

```javascript
// Per-wear occasion text (e.g. "gallery opening", "client lunch", "Sunday").
// Sparse map keyed by ISO date, mirrors the wearNotes shape so existing
// wearHistory arrays stay simple and need no migration. Read sites that
// want the occasion for a specific wear look it up by date:
//   itemWearOccasions(item)['2026-06-14']  →  'gallery opening' or undefined
// The Concierge prompt walks the most recent 5 wears and includes whichever
// occasions are present.
function itemWearOccasions(item) {
  return (item && typeof item.wearOccasions === 'object' && item.wearOccasions !== null) ? item.wearOccasions : {};
}
```

- [ ] **Step 2: Build to confirm**

```bash
npm run build
```

Expected: builds clean. (No existing reader expects this function yet — pure addition.)

- [ ] **Step 3: Commit**

```bash
git checkout -b p1/wear-occasions
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat(wear-log): itemWearOccasions accessor (parallel to wearNotes)

Sparse map keyed by ISO date, mirrors the wearNotes pattern. Lets us
attach an "occasion" string to a specific wear (e.g. '2026-06-14' →
'gallery opening') without altering the wearHistory array shape —
existing items stay readable, no migration needed.

Capture UI + Concierge consumption land in subsequent tasks.

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 2.1)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.2: Capture occasion in the wear-log UI + persist to Firestore

**Files:**
- Modify: `src/App.jsx` — wear-log handler functions + the wear-log modal/form

- [ ] **Step 1: Locate the wear-log handler**

```bash
grep -n "handleLogOutfitWear\|wearHistory.*sort\|wearNotes:" src/App.jsx | head -10
```

There are likely 2-3 wear-log handlers:
- `handleLogWear` for individual items (around line 3314)
- `handleLogOutfitWear` for outfits (around line 3337)
- Possibly a `handleLogWearWithPhoto` for the diary-photo flow

Each accepts a date + maybe a note. We need to extend them to accept an `occasion` string and write `wearOccasions[date] = occasion`.

- [ ] **Step 2: Extend `handleLogWear` to capture occasion**

Find the existing function (around line 3314). Looks roughly:
```javascript
const handleLogWear = async (item, dateISO, note = '') => {
  const history = [...itemWearHistory(item)];
  const notes = { ...itemWearNotes(item) };
  if (note) notes[dateISO] = note;
  await handleAddItem({ ...item, wearHistory: history, wearNotes: notes });
};
```

Add an `occasion` parameter that also writes to a `wearOccasions` map:

```javascript
const handleLogWear = async (item, dateISO, note = '', occasion = '') => {
  const history = [...itemWearHistory(item), dateISO].sort();
  const notes = { ...itemWearNotes(item) };
  const occasions = { ...itemWearOccasions(item) };
  if (note) notes[dateISO] = note;
  if (occasion) occasions[dateISO] = occasion.trim();
  await handleAddItem({ ...item, wearHistory: history, wearNotes: notes, wearOccasions: occasions });
};
```

Confirm the exact existing body by reading the function first — match its structure precisely. The two new lines are `const occasions = ...` and `if (occasion) occasions[dateISO] = ...` plus appending `wearOccasions: occasions` to the saved object.

- [ ] **Step 3: Extend `handleLogOutfitWear` similarly**

```javascript
const handleLogOutfitWear = async (outfit, dateISO, note = '', occasion = '') => {
  // existing body: iterate outfit.itemIds, call handleLogWear for each
  // Pass `occasion` through so every piece in the outfit gets it.
  for (const id of outfit.itemIds || []) {
    const item = items.find((i) => i.id === id);
    if (!item) continue;
    await handleLogWear(item, dateISO, note, occasion);
  }
  // ... (rest of existing function — outfit-level wear count etc.)
};
```

- [ ] **Step 4: Add an optional Occasion input to the wear-log modal**

Find the wear-log modal/sheet. Search:
```bash
grep -n "Log wear\|log this wear\|How did it feel" src/App.jsx | head -5
```

There's a modal where the user picks a date and optionally types a note. Add a new optional text input between the date picker and the existing note field:

```jsx
<div className="space-y-1.5">
  <label className="block text-[10px] tracking-widest uppercase text-stone-500 font-medium">
    Occasion <span className="text-stone-400 normal-case tracking-normal">(optional — what was the day?)</span>
  </label>
  <input
    value={occasion}
    onChange={(e) => setOccasion(e.target.value)}
    placeholder="e.g. gallery opening, client lunch, Sunday at home…"
    className="w-full px-4 py-2.5 bg-white border border-stone-200 rounded-xl text-sm focus:border-stone-900 outline-none"
    style={{ fontSize: '16px' /* avoid iOS auto-zoom */ }}
    maxLength={60}
  />
</div>
```

Above the JSX, add the state:
```javascript
const [occasion, setOccasion] = useState('');
```

In the submit handler that calls `handleLogWear` or `handleLogOutfitWear`, pass the occasion:
```javascript
await onLogWear(item, dateISO, note, occasion);
```

(Adjust the name to match whatever the existing handler is called in scope — `onLogWear` vs `onLogOutfitWear` vs a prop.)

- [ ] **Step 5: Build + verify**

```bash
npm run build
npm run dev
```

In the running app: open an item → log a wear → enter "gallery opening" in the new Occasion field → save. In Firestore console, navigate to `/users/<uid>/items/<itemId>` → confirm a new `wearOccasions` map field with `{ '2026-06-22': 'gallery opening' }`.

Optional cross-check: open the same item again, log a SECOND wear with no occasion. The existing occasions map should be preserved; only the new dateISO has no entry. Existing wear-log entries (just date strings in `wearHistory`) continue working.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat(wear-log): capture optional 'occasion' per wear

New optional text input in the wear-log flow ("Occasion — what was
the day?"). Persists to /users/{uid}/items/{itemId}.wearOccasions
as a sparse {date: string} map mirroring wearNotes.

handleLogWear + handleLogOutfitWear extended with a fourth optional
'occasion' arg. If the field is empty, no map entry is written and
the existing wearHistory + wearNotes behaviour is unchanged.

Existing wear entries (just date strings in wearHistory) continue to
work — readers fall through to {} when wearOccasions is absent.

The Concierge prompt will consume this in the next task to unlock
"you wore this last to the gallery opening" specificity.

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 2.2)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2.3: Include recent occasions in the Concierge prompt

**Files:**
- Modify: `src/App.jsx` — `generateConciergeReply` around line 1348

- [ ] **Step 1: Build a "recent wear contexts" string**

Find `generateConciergeReply`. The function takes `items` as input. Build a recent-wears-with-occasions summary that goes into the prompt. Just BEFORE the prompt is constructed, add:

```javascript
// Recent wears with occasions — empowers the stylist to say "you wore
// this last to the gallery opening" rather than vague references.
// Walks every item, picks the most recent 5 wears across the wardrobe
// that have an occasion noted, formats them for the prompt.
const recentWearsWithOccasions = (() => {
  const entries = [];
  for (const item of items) {
    const hist = itemWearHistory(item);
    const occasions = itemWearOccasions(item);
    for (const dateISO of hist) {
      const occasion = occasions[dateISO];
      if (occasion) {
        entries.push({ dateISO, occasion, itemName: item.name || item.category, itemId: item.id });
      }
    }
  }
  // Sort by date desc, take top 5
  entries.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  return entries.slice(0, 5);
})();
```

- [ ] **Step 2: Inject into the system prompt**

Find the existing prompt string (template literal). Locate the "stylist persona" block (often starts with "You are a personal stylist..."). Just after the wardrobe summary but before the user-message-history block, splice in the wear contexts:

```javascript
const wearContextsBlock = recentWearsWithOccasions.length > 0
  ? `\nRecent specific wears (use these to make replies concrete — say "you wore this last to the X" when relevant; do NOT invent occasions for items not listed here):
${recentWearsWithOccasions.map((w) => `  - ${w.dateISO}: ${w.itemName} → ${w.occasion}`).join('\n')}\n`
  : '';

// ... existing prompt build ...

const prompt = `You are a personal stylist...

[existing wardrobe summary]
${wearContextsBlock}
[existing message history]
...`;
```

Confirm exact insertion point by reading the function — the existing prompt has clear logical sections; the new block belongs between the wardrobe inventory section and the chat history section.

- [ ] **Step 3: Build + manual verify**

```bash
npm run build
npm run dev
```

Pre-flight: log at least one wear with an occasion (Task 2.2 should already have done this in your test). Then in the app:
1. Open Concierge
2. Ask: "What should I wear today, something I haven't worn recently?"
3. The reply should reference the recent occasion(s) — e.g. "the white silk vest you wore last to the gallery opening on the 14th". If it doesn't reference them naturally, ask: "When did I last wear my [item name]?" — the stylist should reply with the occasion you logged.

If you don't see occasion references at all, console-log the prompt to confirm the wear contexts block is being included. The Concierge might also need a re-emphasised system instruction — add to the existing rules in the prompt: "When the user asks about a specific past wear, use the 'Recent specific wears' list above. Cite the exact date and occasion if available."

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "$(cat <<'EOF'
feat(concierge): use recent wear occasions for "you wore this last to X"

generateConciergeReply now walks every item's wearHistory + wear-
Occasions maps, collects the 5 most recent wears that have an
occasion noted, and injects them into the system prompt with an
explicit instruction:

"Recent specific wears (use these to make replies concrete — say
'you wore this last to the X' when relevant; do NOT invent occasions
for items not listed here)"

The "do NOT invent" guardrail is important — without it, the model
will happily make up occasions, which is the failure mode the marketing
site's sample brief warned against. We pass only logged-occasion wears
and tell it to stay within them.

Unlocks the most-quoted line from the /about page sample brief:
"The ivory silk blouse, charcoal wool trouser, and black canvas
wedges you wore last to the gallery opening."

Plan: docs/superpowers/plans/2026-06-22-p1-streaming-and-wear-events.md
(Task 2.3)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Final Verification & Sign-off

- [ ] **Smoke check both branches**

Switch between branches and verify each works in isolation:
```bash
git checkout p1/streaming-concierge
npm run dev
# Test Concierge + Manifesto + Wardrobe Audit streaming. Reload page; sign-in flow works.
git checkout p1/wear-occasions
npm run dev
# Test occasion capture + Concierge using occasions.
```

- [ ] **Final deploy + verify in prod**

When both branches are individually verified and you're ready to ship:

```bash
git checkout main
git merge p1/streaming-concierge --no-edit
git merge p1/wear-occasions --no-edit
firebase deploy --only hosting
```

Wait ~30s. Hard-refresh `edit.myatelier.style` (or use incognito). Test the same scenarios in prod.

### Out of scope for this plan (P2 candidates)

- Streaming the Identify-with-Concierge / Receipt-import vision calls — these are short calls that already feel fast; not worth the JSON-mode complication.
- Streaming the outfit composer (Daily Brief / Studio / Travel capsule) — all return structured itemId arrays; need a different UX shape (placeholder slots that fill in one at a time) which is a substantial design pass on its own.
- A separate Photo-per-wear field — present in the diary flow but not yet a first-class field on the wear log. Would mirror the occasion pattern (sparse map). Defer until users actually start using occasions, then we know what shape the rich wear-log should take.
- Quarterly Cloud Function for auto-refreshing manifestos — listed as P1.5 / P2 in the original gap analysis; needs its own plan (Cloud Function infra, schedule, backfill).
- 30-wear gating for first Manifesto + progress meter — small UX work; can ship as a one-off after this plan completes.
- Annual Report artefact — substantial design pass; deserves its own plan after we see how wearOccasions data accumulates.

---

## Self-Review Notes

Coverage check:
- **TG1.1**: `geminiTextStream` wrapper — ✓ Task 1.1 covers signature, body, all checks, all logging.
- **TG1.2**: Concierge streaming — ✓ Task 1.2 covers function signature, send rewrite, message rendering, indicator gating.
- **TG1.3**: Manifesto streaming — ✓ Task 1.3 covers function signature, run rewrite, render with caret.
- **TG1.4**: Wardrobe audit — ✓ Task 1.4 covers the JSON-split approach with the new intro function. Explicitly notes the alternative of skipping.
- **TG2.1**: `itemWearOccasions` accessor — ✓ Task 2.1.
- **TG2.2**: Occasion capture UI + persistence — ✓ Task 2.2 covers handlers, modal input, manual verification path.
- **TG2.3**: Concierge consumes occasions — ✓ Task 2.3 covers prompt injection and the "do NOT invent" guardrail.

Type / name consistency:
- `geminiTextStream(prompt, opts, feature, onChunk)` — used consistently across Tasks 1.2/1.3/1.4.
- `itemWearOccasions(item)` — defined in Task 2.1, consumed in 2.3.
- `wearOccasions` (Firestore field name) — consistent in 2.1 / 2.2 / 2.3.
- `onChunk` parameter — same name in `generateConciergeReply`, `generateStyleManifestoWithGemini`, `streamWardrobeAuditIntroWithGemini`.

Placeholder scan:
- No "TBD" / "TODO" / "implement later" — every step has either complete code or a precise procedural instruction.
- Vague phrases like "Find the existing modal" are grounded by an exact grep command in the same task — the engineer doesn't have to guess where things live.
- Each commit step has the full commit message ready to paste.

Acceptance gates:
- Build smoke (`npm run build`) at end of every task — fast fail.
- Manual UI verification at the end of each user-facing task (1.2, 1.3, 1.4, 2.2, 2.3).
- Firestore inspection step in Task 2.2 for verifying persistence.
