import WebSocket from 'ws';
import { getAccessToken } from './utils/auth.js';
import { fetchRooms, fetchDevices } from './utils/api.js';
import { config } from './utils/config.js';
import { prettierJson } from './utils/formatter.js';
import {
  logInfo,
  logError,
  prettierLines,
  startWaiting,
  incomingMessage,
  logMessage,
  getTimeStamp,
  logStyles,
} from './utils/logger.js';

const SUB_ID_PEOPLE = '1';
const SUB_ID_DEVICES = '2';

export async function startWebSocket() {
  let ws;
  let pingInterval;
  let pongTimeout;
  let driftInterval;

  let reconnectTimer = null;
  let reconnectAttempts = 0;

  function scheduleReconnect(immediate = false) {
    if (reconnectTimer) return;

    const base = 1000; //1 second
    const cap = 30000; // 30 second max
    const jitter = Math.floor(Math.random() * 300);
    const delay = immediate
      ? 0
      : Math.min(cap, base * 2 ** reconnectAttempts) + jitter;

    if (!immediate) reconnectAttempts += 1;

    logInfo(`Reconnecting in ${Math.round(delay / 1000)}s...`);

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, delay);
  }

  function cleanup() {
    clearInterval(pingInterval);
    clearTimeout(pongTimeout);
    clearInterval(driftInterval);
    if (!ws) return;
    ws.removeAllListeners();
  }

  async function connect() {
    try {
      const accessToken = await getAccessToken();
      const rooms = await fetchRooms(accessToken);
      const devices = await fetchDevices(accessToken);
      const roomCache = rooms.reduce((map, { id, name }) => {
        map[id] = name;
        return map;
      }, {});
      const roomIds = rooms.map(({ id }) => id);
      const tenantId = config.tenantId;
      const deviceIds = devices.map(({ id }) => id);

      logInfo(
        prettierLines([
          ['Total roomIds Fetched: ', 'info'],
          [rooms.length.toString(), 'greenish'],
        ])
      );

      logInfo(
        prettierLines([
          ['Total deviceIds Fetched: ', 'info'],
          [devices.length.toString(), 'greenish'],
        ])
      );

      logInfo(
        prettierLines([
          ['🌐 Connecting to Lens WebSocket Endpoint: ', 'info'],
          [config.wsEp.toString(), 'yellow'],
        ])
      );

      ws = new WebSocket(config.wsEp, 'graphql-transport-ws');

      function sendSubscriptions() {
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
      }

      ws.on('open', () => {
        try {
          logInfo('⛓️ Connected to WebSocket');
          startWaiting();
          reconnectAttempts = 0; // on healthy connect reset backoff
          ws.send(
            JSON.stringify({
              type: 'connection_init',
              payload: {
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                },
              },
            })
          );

          //heartbeat check
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.ping();
              clearTimeout(pongTimeout);
              pongTimeout = setTimeout(() => {
                logError('Pong took too long, terminating socket');
                ws.terminate();
              }, 30000);
            }
          }, 15000);

          ws.on('pong', () => {
            clearTimeout(pongTimeout);
          });

          let last = Date.now();
          driftInterval = setInterval(() => {
            const now = Date.now();

            if (now - last > 62000) {
              logInfo('System resumed from sleep, forcing reconnect');
              ws.terminate();
            }
            last = now;
          }, 60000);
        } catch (err) {
          logError(' Unexpected error in open handler:', err);
          ws.terminate();
        }
      });

      ws.on('message', (data) => {
        incomingMessage();

        let wsmsg;
        try {
          wsmsg = JSON.parse(data);
        } catch (err) {
          logError('Invalid JSON message', err);
          return startWaiting();
        }

        const { type, id, payload } = wsmsg;

        switch (type) {
          case 'connection_ack':
            logInfo(
              prettierLines([
                [`{ ${type} }: `, 'info'],
                ['Server acknowledged connection', 'yellow'],
              ])
            );
            sendSubscriptions();
            return startWaiting();

          case 'next':
            const { data } = payload;
            const subContent = prettierJson(payload);

            switch (id) {
              case SUB_ID_DEVICES:
                getTimeStamp();
                logMessage(`  ${subContent}`);
                break;

              case SUB_ID_PEOPLE:
                const body = data.peopleCountStream;
                const json = prettierJson(body);
                const { roomId, count } = data.peopleCountStream;
                const roomName = roomCache[roomId] || roomId;

                const roomLabel = prettierLines([
                  [` [${roomName}] People Count: `, 'white'],
                  [count.toString(), 'reddish'],
                ]);
                logInfo(`${roomLabel}`, logStyles.bold);
                logMessage(`${json}`);
                break;

              default:
                logError(`Unknown subscription id: ${id}`);
            }
            return startWaiting();

          case 'error':
            const { errors } = payload;
            for (const err of errors) {
              const code = err.extensions?.code || 'UNKNOWN';
              logError(` GraphQL error [${code}] on ${id}: ${err.message}`);

              if (code === 'UNAUTHENTICATED') {
                logInfo(
                  ' Token expired. Fetching a fresh one and attempting reconnect'
                );
                return ws.terminate();
              }
            }
            return startWaiting();

          case 'complete':
            logInfo(` Subscription ${id} complete`);
            return startWaiting();

          case 'ping':
            ws.send(JSON.stringify({ type: 'pong' }));
            return;

          case 'pong':
            clearTimeout(pongTimeout);
            return;

          default:
            logError(` Unknown message type: ${wsmsg.type || 'unknown'}`);
        }
      });

      ws.on('error', (err) => {
        logError(`❌ ERRRRROR: ${err.message || err}`);
        ws.terminate();
      });

      ws.on('close', (code, reason) => {
        try {
          cleanup();

          const reasonText = Buffer.isBuffer(reason)
            ? reason.toString()
            : reason || 'no reason';

          logError(`🪓 Disconnected code: ${code}, reason: ${reasonText}`);

          // Auth issues - try reconnect/fetch fresh token
          if (code === 4401 || code === 4403) {
            logInfo('🪙 Trying to get a fresh auth token');
            return scheduleReconnect(true);
          }

          // everything else - back off reconnect
          scheduleReconnect(false);
        } catch (err) {
          logError(' Error in close handler:', err);
          scheduleReconnect(false);
        }
      });
    } catch (error) {
      //startup failures
      logError(`💀 Fatal WebSocket Issue: ${error.message || error}`);
      scheduleReconnect(false);
    }
  }

  await connect();
}
