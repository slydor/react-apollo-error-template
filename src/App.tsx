import { useLazyQuery } from "@apollo/client/react";
import { SEARCH_PERSON } from "./queries";

export function App() {
  const [executeSearch, { loading, data, variables }] = useLazyQuery(
    SEARCH_PERSON,
    { fetchPolicy: "network-only" }
  );

  const activeQueryName = variables?.name ?? "none";
  const resultPersonName = data?.searchPerson?.name ?? "none";
  const isStateSynchronized =
    activeQueryName === resultPersonName ||
    (activeQueryName === "none" && resultPersonName === "none");

  return (
    <main style={{ padding: "2rem", fontFamily: "sans-serif", maxWidth: "800px" }}>
      <h2>Apollo Client useLazyQuery: Variables vs. Data State Desynchronization</h2>
      <p>
        Demonstrating the timing gap where calling <code>executeSearch&#40;&#123; variables &#125;&#41;</code>{" "}
        synchronously updates <code>variables</code> in the hook result, while <code>data</code> updates
        asynchronously when the network query resolves.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        <button
          onClick={() => executeSearch({ variables: { name: "Alice", delay: 100 } })}
          style={{ padding: "0.5rem 1rem", fontSize: "1rem", cursor: "pointer" }}
        >
          Search "Alice"
        </button>
        <button
          onClick={() => executeSearch({ variables: { name: "Bob", delay: 100 } })}
          style={{ padding: "0.5rem 1rem", fontSize: "1rem", cursor: "pointer" }}
        >
          Search "Bob"
        </button>
      </div>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: "8px",
          padding: "1rem",
          backgroundColor: "#f9f9f9",
        }}
      >
        <h3>Current Hook State:</h3>
        <p>
          <strong>variables.name:</strong> <code data-testid="variables">{activeQueryName}</code>
        </p>
        <p>
          <strong>data.searchPerson.name:</strong> <code data-testid="data">{resultPersonName}</code>
        </p>
        <p>
          <strong>loading:</strong> <code data-testid="loading">{loading ? "true" : "false"}</code>
        </p>
        <p
          style={{
            fontWeight: "bold",
            color: isStateSynchronized ? "green" : "red",
          }}
        >
          State Status: {isStateSynchronized ? "Synchronized" : "DESYNCHRONIZED (In-Flight Mismatch)"}
        </p>
      </div>

      <div style={{ marginTop: "1.5rem" }}>
        <h4>Why this is an issue for UI components (e.g. Autocomplete / Search):</h4>
        <ul>
          <li>
            When <code>executeSearch</code> is called with new variables, <code>variables</code> updates{" "}
            <strong>synchronously</strong> on the next React render cycle.
          </li>
          <li>
            <code>data</code> updates <strong>asynchronously</strong> when the response arrives.
          </li>
          <li>
            During the in-flight window, components that read <code>variables</code> and <code>data</code>{" "}
            together receive <code>variables</code> representing the <em>future request</em> alongside{" "}
            <code>data</code> representing the <em>past result</em>.
          </li>
        </ul>
      </div>
    </main>
  );
}
