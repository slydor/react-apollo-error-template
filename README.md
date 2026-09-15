# Apollo Client `useLazyQuery` Out-of-Order Execution Reproduction

## Overview & Explanation of the Issue

### What is the Apollo Client `useLazyQuery` Issue?
In **Apollo Client v4 / v3**, `useLazyQuery` provides an imperative execution function (e.g., `executeSearch({ variables: ... })`) to run queries on demand and exposes state variables such as `loading`, `data`, and `variables` via its React hook result object.

When `useLazyQuery` is triggered rapidly in succession—such as during input typing or autocomplete—multiple network requests can be in flight simultaneously. If an **earlier (slow)** request completes after a **later (fast)** request has already resolved and updated the UI, a race condition occurs.

### Why does this happen?
1. **Network Race Condition / Out-of-Order Responses:** Network latency varies. Request 1 (triggered first) takes 1000ms while Request 2 (triggered 50ms later) takes 100ms.
2. **Hook State Mismatch:** When Request 2 completes first at $t \approx 150\text{ms}$, `useLazyQuery` updates its return values (`variables` and `data`) to reflect Request 2. However, when Request 1 finally resolves at $t \approx 1000\text{ms}$, if Apollo Client does not properly abort or ignore the stale in-flight observable for Request 1, the hook receives Request 1's result. This causes the UI state (`data` / `variables`) to revert back to the old, stale query result.

### Ideal Expected Behavior
When `useLazyQuery` is called with a new set of variables:
- Any active, in-flight request triggered by a previous call to that same `useLazyQuery` hook instance should be aborted/cancelled.
- The hook's `variables` and `data` properties must remain locked to the **latest execution call**, ignoring responses from superseded requests.

---

## User Guide for the Repro Unit Test and App Demo

### 1. Interactive Web Application Demo (`src/App.tsx`)

#### How to Start the App
Navigate to the template directory and launch the Vite dev server:
```bash
npm start
```
Open your browser at `http://localhost:3000`.

#### What the App Demo Does
- The app renders a test dashboard featuring a **"Trigger Out-of-Order Queries"** button.
- Clicking the button executes two consecutive `SearchPerson` queries using `useLazyQuery`:
  1. **Query 1 (Slow):** Variables `{ name: 'Query 1 (Slow)', delay: 1000 }` (simulating network latency of 1000ms).
  2. **Query 2 (Fast):** Triggered 50ms later with `{ name: 'Query 2 (Fast)', delay: 100 }` (network latency of 100ms).
- Below the button, the page displays:
  - **Current `useLazyQuery` Hook State:** Shows real-time values for `called`, `loading`, `variables`, and `data`.
  - **Log / Timeline:** Displays event timestamps, showing when each request started, when promises resolved, and whether the first request promise was aborted.

#### Expected Outcome in the Demo
1. At $t \approx 150\text{ms}$, **Query 2 (Fast)** finishes. The hook state updates to show `Query 2 (Fast)` in both `variables` and `data`.
2. At $t \approx 1100\text{ms}$, **Query 1 (Slow)**'s delay expires.
3. **Correct Behavior:** The hook state remains locked on `Query 2 (Fast)`. The log shows that the first call promise rejected with an `AbortError`.

---

### 2. Programmatic Unit Tests (`src/App.test.tsx`)

#### How to Run the Unit Tests
Run the Vitest suite in the repository:
```bash
npm test
```

#### How the Reproduction Unit Tests Work
The test suite in `src/App.test.tsx` contains 3 deterministic tests asserting **expected behavior** (expecting the latest triggered execution result to be preserved):

1. **Test 1 (`useEffect` sync):** Component syncs `useLazyQuery`'s `data` into local React state. Triggers Query 1 (Slow, 1000ms) then Query 2 (Fast, 100ms). Asserting that local state strictly remains locked on `"Query 2 (Fast)"`.
2. **Test 2 (Rapid execution loop):** Triggers 3 consecutive queries in rapid succession with decreasing network delays (1000ms, 500ms, 100ms). Asserting that final `variables` and `data` remain `"Query 3 (Fast)"`.
3. **Test 3 (Original App component):** Renders `<App />`, triggers out-of-order queries, waits for Query 2 to arrive, then waits past Query 1's delay (1100ms) and asserts that the DOM still displays `"Query 2 (Fast)"`.

#### Expected Unit Test Results (Bug Reproduction)
Because Apollo Client delivers out-of-order responses landing late, **all 3 unit tests currently fail deterministically**, asserting `Query 2 (Fast)` / `Query 3 (Fast)` but receiving `Query 1 (Slow)`. This provides programmatic proof of the bug.

---

## Available Scripts

```bash
# Generate GraphQL Types
npm run codegen

# Run Vitest test suite
npm test

# Run ESLint check
npm run lint

# Build production bundle
npm run build
```
