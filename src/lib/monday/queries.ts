export const BOARD_QUERY = /* GraphQL */ `
  query GetBoard($boardId: [ID!]) {
    boards(ids: $boardId) {
      id
      name
      columns {
        id
        title
        type
      }
      items_page(limit: 500) {
        cursor
        items {
          id
          name
          url
          created_at
          updated_at
          column_values {
            id
            text
            value
          }
        }
      }
    }
  }
`;

export const NEXT_ITEMS_QUERY = /* GraphQL */ `
  query GetNextBoardItems($cursor: String!) {
    next_items_page(cursor: $cursor, limit: 500) {
      cursor
      items {
        id
        name
        url
        created_at
        updated_at
        column_values {
          id
          text
          value
        }
      }
    }
  }
`;
