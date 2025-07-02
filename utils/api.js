import { logInfo, prettierLines } from './logger.js';
import { config } from './config.js';
import axios from 'axios';

export async function fetchRoomIds(accessToken, options = {}) {
  if (!accessToken)
    throw new Error('No access token provided. Cannot fetchRoomIds');

  let { cursor = 'endCursor', paging = 'NEXT_PAGE', limit = 15 } = options;
  const query = /* GQL */ `
      query getRoomData($params: RoomConnectionParams) {
        tenants {
          roomData(params: $params) {
            total
            pageInfo {
              hasNextPage
              endCursor
            }
            edges {
              node {
                name
                id
                site {
                  name
                  id
                }
              }
            }
          }
        }
      }
    `;

  let allRoomIds = [];
  let hasNextPage = true;
  logInfo(
    prettierLines([
      ['▶️ HTTP endpoint is: ', 'white'],
      [config.httpEp.toString(), 'yellow'],
    ])
  );

  while (hasNextPage) {
    const response = await axios.post(
      config.httpEp,
      {
        query,
        variables: {
          params: {
            limit: limit,
            cursor: cursor,
            paging: paging,
          },
        },
      },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const data = response.data?.data?.tenants?.[0]?.roomData;

    if (!data) throw new Error('Unexpected GraphQL response structure');

    const roomIds = data.edges.map((edge) => edge.node.id);
    logInfo(
      prettierLines([
        ['RoomIds: ', 'white'],
        [roomIds.toString(), 'yellow'],
      ])
    );
    allRoomIds.push(...roomIds);

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;

    logInfo(
      prettierLines([
        ['🎾 Fetched ', 'white'],
        [roomIds.length.toString(), 'yellow'],
        [' room IDs | ', 'white'],
        ['cursor →  ', 'white'],
        [cursor.toString(), 'yellow'],
        [' | hasNextPage →  ', 'white'],
        [hasNextPage.toString(), 'yellow'],
      ])
    );

    await new Promise((response) => setTimeout(response, 100));
  }
  return allRoomIds;
}
