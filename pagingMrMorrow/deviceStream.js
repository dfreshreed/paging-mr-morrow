import dotenv from 'dotenv';
import WebSocket from 'ws';
import axios from 'axios';
import chalk from 'chalk';
import ora from 'ora';
dotenv.config();

const config = {
  lensEp: process.env.LENS_EP,
  authEp: process.env.AUTH_URL,
  clientId: process.env.CLIENT_ID,
  clientSecret: process.env.CLIENT_SECRET,
  grantType: 'client_credentials',
};

let accessToken = null;

function prettierJson(json) {
  const jsonString = JSON.stringify(json, null, 2);
  return jsonString
    .replace(
      /"(\w+)":/g,
      (match, p1) => `${chalk.rgb(255, 209, 24)(`"${p1}"`)}:`
    )
    .replace(/:\s?"([^"]+)"/g, (match, p1) => `: ${chalk.green(`"${p1}"`)}`)
    .replace(/: (\d+)/g, (match, p1) => `: ${chalk.yellow(p1)}`)
    .replace(/: (true|false)/g, (match, p1) => `: ${chalk.magenta(p1)}`);
}

async function getAccessToken() {
  try {
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

    accessToken = response.data.access_token;
    spinner.info = chalk.rgb(84, 158, 247)('Got Access Token 🔑');
    console.log('---------');
    return accessToken;
  } catch (error) {
    console.error(
      chalk.red(
        'accessToken request failed 🚨 => ',
        error.response?.data || error.message
      )
    );
    throw new Error();
  }
}

async function startWebSocket() {
  if (!accessToken) {
    console.log(
      chalk.rgb(84, 158, 247)('No accessToken - Fetching New One 🎾')
    );
    getAccessToken()
      .then(startWebSocket)
      .catch(() => process.exit(1));
    return;
  }

  console.log(chalk.rgb(84, 158, 247)('Connecting to WebSocket 🛰'));
  const spinner = ora('Waiting for transmission 🤖 \n ').start();
  const ws = new WebSocket(config.lensEp, 'graphql-transport-ws');

  ws.on('open', async () => {
    console.log(chalk.rgb(84, 158, 247)('Connected to WebSocket ⛓️'));

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
        deviceIds: ['00e0db93723a', '00e0db775ba0', '00e0db671a50'],
      };
      const subscription = {
        id: '1',
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
          variables: variables,
        },
      };

      ws.send(JSON.stringify(subscription));
    }, 1000);
  });

  ws.on('message', (data) => {
    spinner.text = chalk.rgb(
      255,
      209,
      24
    )('Receiving Transmission...Beep Boop 💬');

    const timeStamp = chalk.grey(`[${new Date().toLocaleTimeString()}]`);
    const parsed = JSON.parse(data);
    console.log(timeStamp, prettierJson(parsed));
  });

  ws.on('error', (err) => {
    spinner.info = chalk.red('❌ ERRRRROR:', err.message);
  });

  ws.on('close', async (code, reason) => {
    spinner.info = chalk.red(
      `🪓 Disconnected (code: ${code}, reason: ${reason || 'no reason'})`
    );
    if (code === 4401 || code === 4403) {
      console.log(
        chalk.rgb(84, 158, 247)('Trying to get a fresh new token 🪙')
      );
      try {
        await getAccessToken();
        startWebSocket();
      } catch {
        console.error(chalk.red('Failed to refresh accessToken. Exiting ❌'));
        process.exit(1);
      }
    } else {
      console.log(chalk.rgb(84, 158, 247)('♻️ Reconnecting in 5, 4, 3, 2, 1'));
      setTimeout(startWebSocket, 5000);
    }
  });
}

startWebSocket();
