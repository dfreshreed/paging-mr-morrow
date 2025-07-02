import { startWebSocket } from './wsClient.js';
import { logError } from './utils/logger.js';

async function main() {
  try {
    startWebSocket();
  } catch (error) {
    logError(`Fatal: ${error}`);
    process.exit(1);
  }
}

main();
