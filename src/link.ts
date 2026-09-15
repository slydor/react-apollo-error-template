/*** LINK ***/
import { graphql, print } from "graphql";
import { ApolloLink, Observable, type FetchResult } from "@apollo/client";
import { createClient } from "graphql-ws";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { schema } from "./schema.js";
import { OperationTypeNode } from "graphql";

interface ActiveObserver {
  closed?: boolean;
  next: (value: FetchResult) => void;
  error: (err: unknown) => void;
}

function logRequest(operation: ApolloLink.Operation) {
  console.group(operation.operationType, operation.operationName, "request:");
  console.log("variables:", operation.variables);
  console.log("extensions:", operation.extensions);
  console.log("context:", operation.getContext());
  console.groupEnd();
}

function logResponse(
  operation: ApolloLink.Operation,
  initialTimestamp: number,
  result: { ok: true; result: unknown } | { ok: false; error: unknown },
) {
  console.group(operation.operationType, operation.operationName, "response:");
  console.log("variables:", operation.variables);

  if (result.ok) {
    console.log("result:", result.result);
  } else {
    console.error(result.error);
  }

  console.log("took:", Math.round(performance.now() - initialTimestamp) + "ms");
  console.groupEnd();
}

let activeObserver: ActiveObserver | null = null;

const staticDataLink = new ApolloLink((operation) => {
  return new Observable((observer) => {
    activeObserver = observer;
    const { query, operationName, variables } = operation;
    const timestamp = performance.now();

    logRequest(operation);
    const delayMs = typeof variables?.delay === "number" ? variables.delay : 300;

    setTimeout(async () => {
      try {
        let result;
        if (operationName === "SearchPerson") {
          result = {
            data: {
              searchPerson: {
                __typename: "Person",
                id: "99",
                name: variables?.name ?? null,
              },
            },
          };
        } else {
          result = await graphql({
            schema,
            source: print(query),
            variableValues: variables,
            operationName,
          });
        }

        logResponse(operation, timestamp, { ok: true, result });

        if (activeObserver && !activeObserver.closed) {
          activeObserver.next(result);
        }
      } catch (err) {
        logResponse(operation, timestamp, {
          ok: false,
          error: err,
        });
        if (activeObserver && !activeObserver.closed) {
          activeObserver.error(err);
        }
      }
    }, delayMs);
  });
});

const url = "wss://uifesi.sse.codesandbox.io/graphql";

const wsLink = new GraphQLWsLink(
  createClient({
    url,
  }),
);

// Use directional composition in order to customize the terminating link
// based on operation type: a WebSocket for subscriptions and our own
// custom ApolloLink for everything else.
// For more information, see: https://www.apollographql.com/docs/react/api/link/introduction/#directional-composition
export const link = ApolloLink.split(
  (operation) => operation.operationType === OperationTypeNode.SUBSCRIPTION,
  wsLink,
  staticDataLink,
);
