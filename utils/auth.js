import axios from 'axios';
import { logInfo, logError } from './logger.js';
import { config } from './config.js';
import { prettierJson } from './formatter.js';

let accessToken = null;

export async function getAccessToken() {
  try {
    logInfo('🔍 Requesting token with: ');
    logInfo(
      prettierJson({
        authEp: config.authEp,
        client_id: config.clientId,
        client_secret: '[HIDDEN]',
        grant_type: config.grantType,
      })
    );

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
    logInfo('🔑 Got Access Token');
    return accessToken;
  } catch (error) {
    logError(
      `accessToken request failed 🚨 => ${
        error.response?.data || error.message
      }`
    );
    throw new Error();
  }
}
