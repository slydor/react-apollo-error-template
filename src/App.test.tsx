import { expect, test, afterEach } from "vitest";
import { render, cleanup, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { useLazyQuery } from "@apollo/client/react";
import { MockedProvider } from "@apollo/client/testing/react";
import { useMemo } from "react";
import { App } from "./App";
import { SEARCH_PERSON } from "./queries";

afterEach(() => {
  cleanup();
});

const mocks = [
  {
    request: {
      query: SEARCH_PERSON,
      variables: { name: "Alice", delay: 100 },
    },
    result: {
      data: { searchPerson: { id: "1", name: "Alice" } },
    },
    delay: 100,
  },
  {
    request: {
      query: SEARCH_PERSON,
      variables: { name: "Bob", delay: 100 },
    },
    result: {
      data: { searchPerson: { id: "2", name: "Bob" } },
    },
    delay: 100,
  },
];

test("1. Demonstrates synchronous variables update vs asynchronous data resolution in useLazyQuery", async () => {
  function TestComponent() {
    const [execute, { data, variables, loading }] = useLazyQuery(SEARCH_PERSON);
    return (
      <div>
        <button onClick={() => execute({ variables: { name: "Alice", delay: 100 } })}>
          Search Alice
        </button>
        <button onClick={() => execute({ variables: { name: "Bob", delay: 100 } })}>
          Search Bob
        </button>
        <div data-testid="variables">{variables?.name ?? "none"}</div>
        <div data-testid="data">{data?.searchPerson?.name ?? "none"}</div>
        <div data-testid="loading">{loading ? "true" : "false"}</div>
      </div>
    );
  }

  const { getByRole, getByTestId } = render(
    <MockedProvider mocks={mocks}>
      <TestComponent />
    </MockedProvider>
  );

  // Trigger search for Alice
  act(() => {
    getByRole("button", { name: "Search Alice" }).click();
  });

  // IMMEDIATELY after calling execute(), variables becomes 'Alice' synchronously, but data is 'none'
  expect(getByTestId("variables")).toHaveTextContent("Alice");
  expect(getByTestId("data")).toHaveTextContent("none");
  expect(getByTestId("loading")).toHaveTextContent("true");

  // Wait for Alice query to resolve
  await waitFor(() => {
    expect(getByTestId("data")).toHaveTextContent("Alice");
  });
  expect(getByTestId("variables")).toHaveTextContent("Alice");
  expect(getByTestId("loading")).toHaveTextContent("false");

  // Trigger search for Bob while Alice data is rendered
  act(() => {
    getByRole("button", { name: "Search Bob" }).click();
  });

  // IMMEDIATELY after calling execute(), variables updates to 'Bob', but data is still 'none' (or previous data)
  // This demonstrates the timing gap: variables reflects the future request, data reflects past response
  expect(getByTestId("variables")).toHaveTextContent("Bob");
  expect(getByTestId("data")).toHaveTextContent("none");
  expect(getByTestId("loading")).toHaveTextContent("true");

  // Wait for Bob query to resolve
  await waitFor(() => {
    expect(getByTestId("data")).toHaveTextContent("Bob");
  });
  expect(getByTestId("variables")).toHaveTextContent("Bob");
});

test("2. Demonstrates derived state / useMemo computing over mismatched (variables, data) pair", async () => {
  function AutocompleteSimulator({ currentInput }: { currentInput: string }) {
    const [execute, { data, variables }] = useLazyQuery(SEARCH_PERSON);

    // Simulated autocomplete options derived from checking if variables matches current input
    const options = useMemo(() => {
      // Guard attempting to verify if the query matches the current user input:
      if (variables?.name !== currentInput) {
        return [];
      }
      // If guard passes, map over data:
      return data?.searchPerson ? [data.searchPerson.name] : [];
    }, [data, variables, currentInput]);

    return (
      <div>
        <button onClick={() => execute({ variables: { name: currentInput, delay: 100 } })}>
          Execute Query
        </button>
        <div data-testid="options">{options.join(", ")}</div>
        <div data-testid="vars">{variables?.name ?? "none"}</div>
        <div data-testid="data">{data?.searchPerson?.name ?? "none"}</div>
      </div>
    );
  }

  const { getByRole, getByTestId, rerender } = render(
    <MockedProvider mocks={mocks}>
      <AutocompleteSimulator currentInput="Alice" />
    </MockedProvider>
  );

  // User types "Alice" and executes query
  act(() => {
    getByRole("button", { name: "Execute Query" }).click();
  });

  // Wait for Alice data to arrive
  await waitFor(() => {
    expect(getByTestId("data")).toHaveTextContent("Alice");
  });
  expect(getByTestId("options")).toHaveTextContent("Alice");

  // Now user types "Bob"
  rerender(
    <MockedProvider mocks={mocks}>
      <AutocompleteSimulator currentInput="Bob" />
    </MockedProvider>
  );

  // Executing search for "Bob"
  act(() => {
    getByRole("button", { name: "Execute Query" }).click();
  });

  // Notice: variables.name === currentInput ('Bob' === 'Bob') is TRUE synchronously!
  // BUT data is still 'none' (or stale).
  // The guard `variables?.name !== currentInput` passes, but data is NOT yet Bob's data!
  expect(getByTestId("vars")).toHaveTextContent("Bob");

  await waitFor(() => {
    expect(getByTestId("data")).toHaveTextContent("Bob");
  });
  expect(getByTestId("options")).toHaveTextContent("Bob");
});

test("3. Renders App component and verifies in-flight state desynchronization", async () => {
  const { getByRole, getByTestId, getByText } = render(
    <MockedProvider mocks={mocks}>
      <App />
    </MockedProvider>
  );

  // Click Search Alice
  act(() => {
    getByRole("button", { name: 'Search "Alice"' }).click();
  });

  // Check immediately that state is DESYNCHRONIZED during in-flight request
  expect(getByTestId("variables")).toHaveTextContent("Alice");
  expect(getByTestId("data")).toHaveTextContent("none");
  expect(getByText(/DESYNCHRONIZED/)).toBeInTheDocument();

  // Wait for Alice query to resolve
  await waitFor(() => {
    expect(getByTestId("data")).toHaveTextContent("Alice");
  });
  expect(getByText(/Synchronized/)).toBeInTheDocument();
});
