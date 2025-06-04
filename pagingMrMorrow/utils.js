import dotenv from 'dotenv';
import axios from 'axios';
import chalk from 'chalk';

dotenv.config();

export const config = {
  httpEp: process.env.HTTP_URL,
  wsEp: process.env.WS_URL,
  authEp: process.env.AUTH_URL,
  tenantId: process.env.TENANT_ID,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  grantType: 'client_credentials',
};

let accessToken = null;

export async function getAccessToken() {
  try {
    console.log('🔍 Requesting token with:', {
      authEp: config.authEp,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: config.grantType,
    });

    const response = await axios.post(
      config.authEp,
      {
        client_id: config.clientId,
        client_secret: config.clientSecret,
        grant_type: config.grantType,
      },
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
    // console.log('🔁 Token endpoint response:', response.data);

    accessToken = response.data.access_token;
    console.log(chalk.rgb(84, 158, 247)('Got Access Token 🔑'));
    console.log('---------');
    return accessToken;
  } catch (error) {
    console.error(
      chalk.red('accessToken request failed 🚨 => '),
      error.response?.data || error.message
    );
    throw new Error();
  }
}

export async function fetchRoomIds({
  cursor = 'endCursor',
  paging = 'NEXT_PAGE',
  limit = 15,
} = {}) {
  await getAccessToken();

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

  while (hasNextPage) {
    console.log('▶️ HTTP endpoint is:', config.httpEp);
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
    console.log(response.data);
    const data = response.data?.data?.tenants?.[0]?.roomData;
    if (!data) throw new Error('Unexpected GraphQL response structure');

    const roomIds = data.edges.map((edge) => edge.node.id);
    console.log(roomIds);
    allRoomIds.push(...roomIds);

    hasNextPage = data.pageInfo.hasNextPage;
    cursor = data.pageInfo.endCursor;

    console.log(
      chalk.rgb(
        84,
        158,
        247
      )(
        `🎾 Fetched ${roomIds.length} IDs (cursor=${cursor}), hasNextPage=${hasNextPage}`
      )
    );
    await new Promise((response) => setTimeout(response, 100));
  }
  return allRoomIds;
}
