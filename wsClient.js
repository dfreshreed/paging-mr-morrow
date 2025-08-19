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
  logStyles,
} from './utils/logger.js';

import { prettyClose } from './utils/wsCodes.js';
import { waitForDns, isTransientNetError } from './utils/net.js';

const SUB_ID_PEOPLE = '1';
const SUB_ID_DEVICES = '2';

export async function startWebSocket() {
  let ws;
  let pingInterval;
  let pongTimeout;
  let driftInterval;

  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let lastCloseHint = null;

  const setCloseHint = (hint) => {
    lastCloseHint = hint;
  };
  const DRIFT_CHECK_MS = 15000; //15 second check
  const DRIFT_THRESHOLD_MS = 22000; //22 second max threshold for sleep/clock drift

  function scheduleReconnect(minDelayMs = 0) {
    if (reconnectTimer) return;

    const wokeFromSleep = (lastCloseHint || '').includes('Sleep/clock drift');

    const base = 1000; //1 second
    const cap = 30000; // 30 second max
    const jitter = Math.floor(Math.random() * 300); // help avoid network blip collision
    const backoff = Math.min(cap, base * 2 ** reconnectAttempts) + jitter;
    const delay = Math.max(minDelayMs, wokeFromSleep ? 5000 : 0, backoff);
    reconnectAttempts += 1;

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
      const hosts = [
        new URL(config.authEp).hostname,
        new URL(config.httpEp).hostname,
        new URL(config.wsEp).hostname,
      ];
      const dnsReady = await waitForDns(hosts, {
        timeoutMs: 20000,
        intervalMs: 1000,
      });
      if (!dnsReady) {
        logError('Network is not ready - DNS failing. Backing off');
        return scheduleReconnect(5000);
      }

      let accessToken;
      try {
        accessToken = await getAccessToken();
      } catch (err) {
        if (isTransientNetError(err)) {
          logError(
            `Transient network error getting token (${err.code}). Backing off`
          );
          return scheduleReconnect(5000);
        }
        throw err;
      }

      let rooms, devices;
      try {
        rooms = await fetchRooms(accessToken);
        devices = await fetchDevices(accessToken);
      } catch (err) {
        if (isTransientNetError(err)) {
          logError(
            `Transient network error during room/device prefetch (${err.code}). Backing off.`
          );
          return scheduleReconnect(5000);
        }
        throw err;
      }

      const roomCache = rooms.reduce((map, { id, name }) => {
        map[id] = name;
        return map;
      }, {});
      const deviceCache = devices.reduce((map, { id, name, displayName }) => {
        map[id] = { name, displayName };
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
        // people
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
        // devices
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
          clearInterval(pingInterval);
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.ping();
              clearTimeout(pongTimeout);
              pongTimeout = setTimeout(() => {
                logError('Pong took too long, terminating socket');
                setCloseHint('Heartbeat watchdog: no pong within 30s');
                ws.terminate();
              }, 30000);
            }
          }, 15000);

          ws.on('pong', () => {
            clearTimeout(pongTimeout);
          });
          // drift/sleep detection
          let lastTick = Date.now();
          clearInterval(driftInterval);

          driftInterval = setInterval(() => {
            const now = Date.now();
            const gap = now - lastTick;

            if (gap > DRIFT_THRESHOLD_MS) {
              logInfo('System resumed from sleep, forcing reconnect');
              setCloseHint(
                `Sleep/clock drift detected: ${gap}ms > ${DRIFT_THRESHOLD_MS}ms`
              );
              ws.terminate();
            }
            lastTick = now;
          }, DRIFT_CHECK_MS);
        } catch (err) {
          const msg = err?.message ?? String(err);
          setCloseHint(`Unexpected error in open handler: ${msg}`);
          logError(`Unexpected error in open handler: ${msg}`, { err });
          ws.terminate();
        }
      });

      ws.on('message', (data) => {
        incomingMessage();

        let wsmsg;
        try {
          wsmsg = JSON.parse(data);
        } catch (err) {
          const msg = err?.message ?? String(err);
          logError(`Invalid JSON message: ${msg}`, { err });
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
            if (!payload || typeof payload !== 'object') {
              logError('next frame missing payload:', { wsmsg });
              return;
            }
            const { data: gqlData } = payload;
            const subContent = prettierJson(payload || {});

            switch (id) {
              case SUB_ID_DEVICES:
                const device = gqlData.deviceStream;
                const deviceId = device.id;
                const cached = deviceCache[deviceId] || {};
                const deviceName =
                  cached?.name ??
                  cached?.displayName ??
                  device.name ??
                  'Unknown Device Name';

                const deviceLabel = prettierLines([
                  ['Device Name: ', 'white'],
                  [`${deviceName}`, 'reddish'],
                ]);
                logMessage(`${deviceLabel}`, logStyles.bold);
                logMessage(`  ${subContent}`);
                break;

              case SUB_ID_PEOPLE:
                const body = gqlData.peopleCountStream;
                const json = prettierJson(body);
                const { roomId, count } = body;
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
              const code = err.extensions?.code ?? 'UNKNOWN';
              logError('GraphQL error', { code, id, err });

              if (code === 'UNAUTHENTICATED') {
                logInfo(
                  ' Token expired. Fetching a fresh one and attempting reconnect'
                );
                setCloseHint('Token expired: reconnecting with fresh token');
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
            logError('Unknown message type', {
              type: wsmsg?.type ?? 'unknown',
              wsmsg,
            });
        }
      });

      ws.on('error', (err) => {
        const msg = err?.message ?? String(err);
        logError(`❌ ERROR: ${msg}`, { err });
        setCloseHint(`WebSocket error: ${err.message}`, { err });
        ws.terminate();
      });

      ws.on('close', (code, reason) => {
        try {
          cleanup();
          logError(
            `🪓 Disconnected: ${prettyClose(code, reason, lastCloseHint)}`
          );
          lastCloseHint = null;

          // Auth issues - try reconnect/fetch fresh token
          if (code === 4401 || code === 4403) {
            logInfo('🪙 Trying to get a fresh auth token');
            return scheduleReconnect(3000);
          }

          // everything else - back off reconnect
          scheduleReconnect();
        } catch (err) {
          const msg = err?.message ?? String(err);
          logError(`Error in close handler: ${msg}`, { err });
          scheduleReconnect();
        }
      });
    } catch (err) {
      //startup failures
      const msg = err?.message ?? String(err);
      logError(`💀 Fatal WebSocket Issue: ${msg}` || { err });
      scheduleReconnect(5000);
    }
  }

  await connect();
}
