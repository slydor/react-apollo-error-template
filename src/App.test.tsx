import { expect, test } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { ApolloClient, InMemoryCache, gql, type TypedDocumentNode } from "@apollo/client";
import { ApolloProvider, useLazyQuery } from "@apollo/client/react";
import { useState, useEffect } from "react";
import { link } from "./link";
import { App } from "./App";
import type {
  SearchPersonQuery,
  SearchPersonQueryVariables,
} from "./types/__generated__/graphql";

const SEARCH_PERSON: TypedDocumentNode<
  SearchPersonQuery,
  SearchPersonQueryVariables
> = gql`
  query SearchPerson($name: String!, $delay: Int) {
    searchPerson(name: $name, delay: $delay) {
      id
      name
    }
  }
`;

test("1. Component syncing useLazyQuery data to local state via useEffect", async () => {
  function UseEffectSyncComponent() {
    const [executeSearch, { data }] = useLazyQuery(SEARCH_PERSON, {
      fetchPolicy: "cache-and-network",
    });
    const [localValue, setLocalValue] = useState("initial");

    useEffect(() => {
      if (data?.searchPerson?.name) {
        setLocalValue(data.searchPerson.name);
      }
    }, [data]);

    const trigger = async () => {
      executeSearch({ variables: { name: "Query 1 (Slow)", delay: 1000 } });
      await new Promise((r) => setTimeout(r, 50));
      executeSearch({ variables: { name: "Query 2 (Fast)", delay: 100 } });
    };

    return (
      <div>
        <button onClick={trigger}>Trigger Out of Order</button>
        <div data-testid="local-state">{localValue}</div>
      </div>
    );
  }

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });

  render(
    <ApolloProvider client={client}>
      <UseEffectSyncComponent />
    </ApolloProvider>
  );

  const button = screen.getByRole("button", { name: /Trigger Out of Order/i });
  await act(async () => {
    button.click();
  });

  // Wait for Query 2 (Fast, 100ms) to resolve
  await waitFor(() => {
    expect(screen.getByTestId("local-state")).toHaveTextContent("Query 2 (Fast)");
  });

  // Wait for Query 1 (Slow, 1000ms) timer to pass
  await new Promise((r) => setTimeout(r, 1100));

  // Assert that local state strictly remains locked on Query 2 (Fast)
  expect(screen.getByTestId("local-state")).toHaveTextContent("Query 2 (Fast)");
});

test("2. Rapid consecutive execution loop with varying network delays", async () => {
  function RapidLoopComponent() {
    const [executeSearch, { data, variables }] = useLazyQuery(SEARCH_PERSON, {
      fetchPolicy: "network-only",
    });

    const trigger = async () => {
      // Trigger 3 queries with decreasing delays:
      // Query 1: 1000ms delay
      // Query 2: 500ms delay
      // Query 3: 100ms delay
      executeSearch({ variables: { name: "Query 1 (Slow)", delay: 1000 } });
      await new Promise((r) => setTimeout(r, 20));
      executeSearch({ variables: { name: "Query 2 (Medium)", delay: 500 } });
      await new Promise((r) => setTimeout(r, 20));
      executeSearch({ variables: { name: "Query 3 (Fast)", delay: 100 } });
    };

    return (
      <div>
        <button onClick={trigger}>Trigger Rapid Loop</button>
        <div data-testid="rapid-vars">{variables?.name ?? "none"}</div>
        <div data-testid="rapid-data">{data?.searchPerson?.name ?? "none"}</div>
      </div>
    );
  }

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });

  render(
    <ApolloProvider client={client}>
      <RapidLoopComponent />
    </ApolloProvider>
  );

  const button = screen.getByRole("button", { name: /Trigger Rapid Loop/i });
  await act(async () => {
    button.click();
  });

  // Wait for Query 3 (Fast, 100ms) to complete
  await waitFor(() => {
    expect(screen.getByTestId("rapid-data")).toHaveTextContent("Query 3 (Fast)");
  });

  // Wait for all in-flight timers (up to 1200ms) to complete
  await new Promise((r) => setTimeout(r, 1200));

  // Assert that data and variables remain Query 3 (Fast)
  expect(screen.getByTestId("rapid-vars")).toHaveTextContent("Query 3 (Fast)");
  expect(screen.getByTestId("rapid-data")).toHaveTextContent("Query 3 (Fast)");
});

test("3. App component test", async () => {
  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link,
  });

  render(
    <ApolloProvider client={client}>
      <App />
    </ApolloProvider>
  );

  const button = screen.getByRole("button", {
    name: /Trigger Out-of-Order Queries/i,
  });

  await act(async () => {
    button.click();
  });

  // Wait for Second Call (delay 100ms) to resolve and render
  await waitFor(
    () => {
      expect(screen.getByText(/Query 2 \(Fast\)/)).toBeInTheDocument();
    },
    { timeout: 1000 }
  );

  // Wait for 1100ms total to pass (First Call's original timer)
  await new Promise((resolve) => setTimeout(resolve, 1100));

  // Verify hook state in UI remains Query 2 (Fast)
  const variablesText = screen.getByText(/variables:/).parentElement?.textContent;
  const dataText = screen.getByText(/data:/).parentElement?.textContent;

  expect(variablesText).toContain("Query 2 (Fast)");
  expect(dataText).toContain("Query 2 (Fast)");
});
