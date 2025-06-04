// import dotenv from 'dotenv';
import { fetchRoomIds } from './utils.js';
import { startWebSocket } from './peopleCountStream.js';
import chalk from 'chalk';

// dotenv.config();

async function main() {
  try {
    const roomIds = await fetchRoomIds();
    console.log(
      chalk.rgb(84, 158, 247)('Total rooms fetched:', roomIds.length)
    );
    startWebSocket(roomIds);
  } catch (error) {
    console.error(chalk.red('Fatal:', error));
    process.exit(1);
  }
}

main();
