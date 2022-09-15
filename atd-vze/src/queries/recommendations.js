import { gql } from "apollo-boost";

export const GET_RECOMMENDATIONS = gql`
  query FindRecommendations($crashId: Int) {
    recommendations(where: { crash_id: { _eq: $crashId } }) {
      id
      created_at
      text
      created_by
      crash_id
      update
      atd__coordination_partners_lkp {
        description
      }
      atd__recommendation_status_lkp {
        description
      }
    }
    atd__coordination_partners_lkp {
      id
      description
    }
    atd__recommendation_status_lkp {
      id
      description
    }
  }
`;

export const INSERT_RECOMMENDATION = gql`
  mutation InsertRecommendation(
    $text: String
    $update: String
    $crashId: Int
    $userEmail: String
    $coordination_partner_id: Int
    $recommendation_status_id: Int
  ) {
    insert_recommendations(
      objects: {
        text: $text
        update: $update
        crash_id: $crashId
        created_by: $userEmail
        coordination_partner_id: $coordination_partner_id
        recommendation_status_id: $recommendation_status_id
      }
    ) {
      returning {
        crash_id
        update
        text
        created_at
        created_by
      }
    }
  }
`;

export const UPDATE_RECOMMENDATION = gql`
  mutation UpdateRecommendations(
    $id: Int!
    $changes: recommendations_set_input
  ) {
    update_recommendations_by_pk(pk_columns: { id: $id }, _set: $changes) {
      crash_id
      text
      update
    }
  }
`;