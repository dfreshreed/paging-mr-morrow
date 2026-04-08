import { startWebSocket } from './wsClient.js';
import { logError } from './utils/logger.js';

const args = process.argv.slice(2);
const peopleFlag = args.includes('--people');
const devicesFlag = args.includes('--devices');

const streams = {
  people: peopleFlag || (!peopleFlag && !devicesFlag),
  devices: devicesFlag || (!peopleFlag && !devicesFlag),
};

async function main() {
  try {
    startWebSocket(streams);
  } catch (error) {
    logError(`Fatal: ${error}`);
    process.exit(1);
  }
}

main();
