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
      atd__recommendation_status_lkp {
        description
      }
      recommendations_partners {
        atd__coordination_partners_lkp {
          id
          description
        }
      }
    }
    atd__coordination_partners_lkp(order_by: { description: asc }) {
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
    $recommendation_status_id: Int
    $partner_id: Int
  ) {
    insert_recommendations(
      objects: {
        text: $text
        update: $update
        crash_id: $crashId
        created_by: $userEmail
        recommendation_status_id: $recommendation_status_id
        recommendations_partners: { data: { partner_id: $partner_id } }
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
