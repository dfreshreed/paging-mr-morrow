import WebSocket from 'ws';
import { getAccessToken } from './utils/auth.js';
import { fetchRoomIds } from './utils/api.js';
import { config } from './utils/config.js';
import { prettierJson } from './utils/formatter.js';
import {
  logInfo,
  logError,
  prettierLines,
  startWaiting,
  incomingMessage,
} from './utils/logger.js';

const SUB_ID_PEOPLE = '1';
const SUB_ID_DEVICES = '2';

export async function startWebSocket() {
  try {
    const accessToken = await getAccessToken();
    const roomIds = await fetchRoomIds(accessToken);
    const tenantId = config.tenantId;
    const deviceIds = ['00e0db93723a', '00e0db775ba0', '00e0db671a50'];

    logInfo(
      prettierLines([
        ['Got ', 'white'],
        [roomIds.length.toString(), 'yellow'],
        [' roomIds', 'cyan'],
      ])
    );

    logInfo(
      prettierLines([
        ['🛰 Connecting to WebSocket: ', 'white'],
        [config.wsEp.toString(), 'yellow'],
      ])
    );

    const ws = new WebSocket(config.wsEp, 'graphql-transport-ws');

    ws.on('open', async () => {
      logInfo('⛓️ Connected to WebSocket \n');
      startWaiting();

      const initMessage = {
        type: 'connection_init',
        payload: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      };
      ws.send(JSON.stringify(initMessage));

      setTimeout(() => {
        ws.send(
          JSON.stringify({
            id: SUB_ID_PEOPLE,
            type: 'subscribe',
            payload: {
              query: `subscription PeopleCountStream($tenantId: ID!, $roomIds: [ID!]!) {
              peopleCountStream(tenantId: $tenantId, roomIds: $roomIds) {
                count
                roomId
                tenantId
                updatedAt
              }
            }
          `,
              variables: {
                tenantId: tenantId,
                roomIds: roomIds,
              },
            },
          })
        );

        ws.send(
          JSON.stringify({
            id: SUB_ID_DEVICES,
            type: 'subscribe',
            payload: {
              query: `subscription DeviceStream($deviceIds: [String!]!) {
              deviceStream(deviceIds: $deviceIds) {
                connected
                externalIp
                hardwareRevision
                id
                macAddress
                modelId
                name
                productId
                roomId
                siteId
                softwareBuild
                softwareVersion
                tenantId
              }
            }
          `,
              variables: { deviceIds },
            },
          })
        );
      }, 1000);
    });

    ws.on('message', (data) => {
      incomingMessage();
      const timeStamp = new Date().toLocaleTimeString();
      const parsed = JSON.parse(data);

      if (!parsed.payload) {
        logInfo(
          `${timeStamp} ⚠️ Skipping non-payload message: ${
            parsed.type || 'unknown'
          }`
        );
        startWaiting();
        return;
      }

      const subContent = prettierJson(parsed.payload);

      switch (parsed.id) {
        case SUB_ID_DEVICES:
          logInfo(
            prettierLines([
              [timeStamp.toString(), 'white'],
              [' Device Stream Data:', 'cyan'],
            ])
          ),
            logInfo(`${subContent}`);
          break;
        case SUB_ID_PEOPLE:
          logInfo(
            prettierLines([
              [timeStamp.toString(), 'white'],
              [' People Count Data:', 'cyan'],
            ])
          ),
            logInfo(`${subContent}`);
          break;
        default:
          logError(`Unknown message id: ${parsed}`);
      }
      startWaiting();
    });

    ws.on('error', (err) => {
      logError(`❌ ERRRRROR: ${err.message}`);
    });

    ws.on('close', async (code, reason) => {
      logError(
        `🪓 Disconnected code: ${code}, reason: ${reason} || 'no reason'`
      );
      if ((code === 4401) | (code === 4403)) {
        logInfo('🪙 Trying to get a fresh new token');
        try {
          await startWebSocket();
        } catch {
          logError('❌ Failed to refresh accessToken. Exiting');
          process.exit(1);
        }
      } else {
        logInfo('♻️ Reconnecting in 5, 4, 3, 2, 1');
        setTimeout(startWebSocket, 5000);
      }
    });
  } catch (error) {
    logError(`💀 Fatal WebSocket Issue: ${error}`);
  }
}
