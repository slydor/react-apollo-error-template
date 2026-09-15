import { gql, type TypedDocumentNode } from "@apollo/client";
import { useLazyQuery } from "@apollo/client/react";
import { useState } from "react";
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

export function App() {
  const [executeSearch, { called, loading, data, variables }] = useLazyQuery(
    SEARCH_PERSON,
    { fetchPolicy: "network-only" }
  );
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const runRepro = async () => {
    setLogs([]);
    addLog("1. Triggering First Call (name: 'Query 1 (Slow)', delay: 1000ms)");

    // Call 1
    const p1 = executeSearch({
      variables: { name: "Query 1 (Slow)", delay: 1000 },
    }).catch((err: unknown) => {
      const isAbort = err instanceof Error && err.name === "AbortError";
      return { aborted: true, isAbort, error: err };
    });

    // Wait 50ms then Call 2
    await new Promise((r) => setTimeout(r, 50));
    addLog("2. Triggering Second Call (name: 'Query 2 (Fast)', delay: 100ms)");
    const p2 = executeSearch({
      variables: { name: "Query 2 (Fast)", delay: 100 },
    });

    const res2 = await p2;
    addLog(`Second Call returned: ${JSON.stringify(res2.data)}`);

    const res1 = await p1;
    if ("aborted" in res1) {
      addLog(`First Call promise was aborted as expected: ${res1.error}`);
    } else {
      addLog(`First Call returned: ${JSON.stringify(res1.data)}`);
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h2>Apollo Client useLazyQuery Out-of-Order Execution Test</h2>
      <p>
        Testing <code>useLazyQuery</code> when called twice in succession where the
        first query is slower than the second query.
      </p>

      <button
        onClick={runRepro}
        style={{ padding: "0.5rem 1rem", fontSize: "1rem" }}
      >
        Trigger Out-of-Order Queries
      </button>

      <div style={{ marginTop: "1rem" }}>
        <h3>Current useLazyQuery Hook State:</h3>
        <p>
          <strong>called:</strong> {String(called)}
        </p>
        <p>
          <strong>loading:</strong> {String(loading)}
        </p>
        <p>
          <strong>variables:</strong> {JSON.stringify(variables)}
        </p>
        <p>
          <strong>data:</strong> {JSON.stringify(data)}
        </p>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <h3>Log / Timeline:</h3>
        <ul>
          {logs.map((log, index) => (
            <li key={index}>{log}</li>
          ))}
        </ul>
      </div>
    </main>
  );
}
