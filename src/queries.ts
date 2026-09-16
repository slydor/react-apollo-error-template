import { gql, type TypedDocumentNode } from "@apollo/client";
import type {
  SearchPersonQuery,
  SearchPersonQueryVariables,
} from "./types/__generated__/graphql";

export const SEARCH_PERSON: TypedDocumentNode<
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
