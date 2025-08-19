import { logInfo, prettierLines, logError } from './logger.js';
import { config } from './config.js';
import axios from 'axios';

export async function fetchRooms(accessToken, options = {}) {
  if (!accessToken)
    throw new Error('No access token provided. Cannot fetchRoomIds');

  let allRooms = [];
  let hasNextPage = true;
  let { cursor = null, paging = 'NEXT_PAGE', limit = 15 } = options;

  try {
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

    logInfo(
      prettierLines([
        ['🌐 Batch-retrieving room IDs from Lens GQL endpoint: '],
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

      const fetchedRooms = data.edges.map((edge) => edge.node);

      allRooms.push(...fetchedRooms);

      hasNextPage = data.pageInfo.hasNextPage;
      cursor = data.pageInfo.endCursor;
      await new Promise((response) => setTimeout(response, 100));
    }
  } catch (err) {
    logError('Room query failed', err);
    throw err;
  }
  return allRooms;
}

export async function fetchDevices(accessToken, options = {}) {
  if (!accessToken)
    throw new Error('No access token provided. Cannot fetchRoomIds');

  let allDevices = [];
  let hasNextPage = true;
  let { nextToken = null, pageSize = 100 } = options;

  try {
    const query = /* GQL */ `
        query devices($params: DeviceFindArgs){
          deviceSearch(params: $params) {
            edges {
              node {
                id
                name
                displayName
              }
            }
            pageInfo {
              hasNextPage
              nextToken
              totalCount
            }
          error
          }
        }
      `;

    logInfo(
      prettierLines([
        ['🌐 Batch-retrieving device IDs from Lens GQL endpoint: '],
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
              pageSize: pageSize,
              nextToken: nextToken,
            },
          },
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const data = response.data?.data?.deviceSearch;

      if (!data) throw new Error('Unexpected GraphQL response structure');

      const fetchedDevices = data.edges.map((edge) => edge.node);

      allDevices.push(...fetchedDevices);

      hasNextPage = data.pageInfo.hasNextPage;
      nextToken = data.pageInfo.nextToken;

      await new Promise((response) => setTimeout(response, 100));
    }
  } catch (err) {
    logError('Device ID fetch failed', err);
    throw err;
  }
  return allDevices;
}
