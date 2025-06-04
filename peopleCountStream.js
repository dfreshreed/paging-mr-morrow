import dotenv from 'dotenv';
import WebSocket from 'ws';
import chalk from 'chalk';
import ora from 'ora';
import { getAccessToken, fetchRoomIds, config } from './utils.js';

// dotenv.config();

function prettierJson(json) {
  const jsonString = JSON.stringify(json, null, 2);
  return (
    jsonString

      //keys: "id":
      .replace(/"(\w+)":/g, (_match, key) => {
        const coloredKey = chalk.rgb(255, 209, 24)(`"${key}"`);
        return `${coloredKey}:`;
      })
      //string vals: : "x1ed234"
      .replace(/:\s*"([^"]+)"/g, (_match, val) => {
        return `: ${chalk.green(`"${val}"`)}`;
      })
      //numbers: : 124532
      .replace(/: (\d+)/g, (_match, num) => {
        return `: ${chalk.yellow(num)}`;
      })
      //bools: :true or :false
      .replace(/: (true|false)/g, (_match, bool) => {
        return `: ${chalk.magenta(bool)}`;
      })
  );
}

export async function startWebSocket() {
  let accessToken = null;
  try {
    accessToken = await getAccessToken();

    const roomIds = await fetchRoomIds();
    console.log(
      chalk.rgb(84, 158, 247)('Got token & got ${roomIds.length} roomIds')
    );
    console.log(chalk.rgb(84, 158, 247)('🛰 Connecting to WebSocket'));
    console.log(config.wsEp);
    const ws = new WebSocket(config.wsEp, 'graphql-transport-ws');

    ws.on('open', async () => {
      console.log(chalk.rgb(84, 158, 247)('⛓️ Connected to WebSocket '));
      // setTimeout(() => (spinner.text = '🤖 Waiting for Transmission'), 2000);

      const message = {
        type: 'connection_init',
        payload: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      };
      ws.send(JSON.stringify(message));

      setTimeout(() => {
        const variables = {
          tenantId: config.tenantId,
          roomIds: roomIds,
        };
        const subscription = {
          id: `1`,
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
            variables: variables,
          },
        };
        ws.send(JSON.stringify(subscription));
      }, 1000);
    });

    ws.on('message', (data) => {
      console.log(
        chalk.rgb(255, 209, 24)('Receiving Transmission...Beep Boop 💬')
      );

      const timeStamp = chalk.grey(`[${new Date().toLocaleTimeString()}]`);
      const parsed = JSON.parse(data);
      console.log(timeStamp, prettierJson(parsed));
      const spinner = ora('Waiting for transmission 🤖 \n ').start();
      spinner;
    });

    ws.on('error', (err) => {
      console.error(chalk.red('❌ ERRRRROR:', err.message));
    });

    ws.on('close', async (code, reason) => {
      console.log(
        chalk.red(
          `🪓 Disconnected (code: ${code}, reason: ${reason} || 'no reason')`
        )
      );
      if ((code === 4401) | (code === 4403)) {
        console.log(
          chalk.rgb(84, 158, 247)('Trying to get a fresh new token 🪙')
        );
        try {
          await startWebSocket();
        } catch {
          console.error(chalk.red('Failed to refresh accessToken. Exiting ❌'));
          process.exit(1);
        }
      } else {
        console.log(
          chalk.rgb(84, 158, 247)('♻️ Reconnecting in 5, 4, 3, 2, 1')
        );
        setTimeout(startWebSocket, 5000);
      }
    });
  } catch (error) {
    console.error(chalk.red('Fatal Issue in startWebSocket:'), error);
  }
}
