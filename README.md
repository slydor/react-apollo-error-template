# Apollo Client `useLazyQuery`: `variables` & `data` State Desynchronization

## Overview & Technical Explanation

This reproduction demonstrates a React hook state desynchronization issue in Apollo Client's `useLazyQuery` when executing queries on demand.

### The Problem
When invoking the imperative trigger function `executeSearch({ variables })`:
1. **`variables` updates SYNCHRONOUSLY:** As soon as `executeSearch({ variables: { name: 'Bob' } })` is called, Apollo Client updates its returned `variables` object **immediately** on the next React render cycle.
2. **`data` updates ASYNCHRONOUSLY:** `data` updates **asynchronously** only when the GraphQL network response resolves or is emitted from cache.
3. **The In-Flight State Mismatch:** During the window between request trigger and response resolution, the hook result contains:
   - `variables`: `{ name: 'Bob' }` (the *future request intent*)
   - `data`: `undefined` or `{ name: 'Alice' }` (the *past completed result*)
   - `loading`: `true`

### Why This Causes Bugs in UI Components
In components like search inputs or autocompletes, developers often write guards comparing `variables` against current input state:

```tsx
const options = useMemo(() => {
  // Developer guard attempting to verify if the query matches current component input:
  if (variables?.name !== currentInput) {
    return []; // Don't show options if query doesn't match input
  }
  
  // Bug! During in-flight request:
  // variables.name === currentInput ('Bob' === 'Bob') is TRUE,
  // but `data` is still the result for 'Alice' (or undefined)!
  return data?.searchPerson ? [data.searchPerson.name] : [];
}, [data, variables, currentInput]);
```

Because `variables` updates synchronously, the guard `variables?.name !== currentInput` evaluates to `false` (i.e. *"they match"*), causing `useMemo` to evaluate against the **old/stale `data`**.

---

### Questions for Apollo Maintainers
1. Is `variables` returned by `useLazyQuery` intended to represent the arguments of the **most recent call to `execute()`**, or the variables that produced the **currently rendered `data`**?
2. If `variables` represents future call intent while `data` represents past response state, what is the recommended way for React components to know which `variables` produced the current `data`?

---

## Reproduction Tests & Setup

This reproduction uses standard Apollo Client testing infrastructure (`MockedProvider` from `@apollo/client/testing/react`).

### Running the Tests
```bash
npm test
```

### Test Suite (`src/App.test.tsx`)
1. **Test 1 (`Synchronous variables vs asynchronous data`):** Verifies that calling `executeSearch({ variables })` synchronously changes `variables` in hook state while `data` remains `undefined` or holds previous data during the in-flight period.
2. **Test 2 (`Derived state / useMemo computation`):** Demonstrates how checking `variables?.name === currentInput` passes synchronously while `data` is still pending/stale.
3. **Test 3 (`App Component Integration`):** Renders `<App />` with `MockedProvider` to demonstrate in-flight state desynchronization in a React component.

### Building & Verification
```bash
npm run lint
npm run build
npm test
```
