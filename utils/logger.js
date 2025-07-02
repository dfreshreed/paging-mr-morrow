import chalk from 'chalk';

let waitingInt = null;

export function logInfo(msg) {
  console.log(chalk.rgb(84, 158, 247)('\n' + msg));
}

export function prettierLines(segments) {
  return segments.map(([str, color]) => chalk[color](str)).join('');
}

export function logError(msg) {
  console.log(chalk.red(msg));
}

export function startWaiting() {
  waitingInt = setInterval(() => {
    logInfo(
      new Date().toLocaleTimeString() + ' ⏳ Waiting for next transmission...'
    );
  }, 5000); //update cli every 5 seconds while waiting for a message. help user feel more comfy that something's not broken.
}

export function stopWaiting() {
  if (waitingInt) {
    clearInterval(waitingInt);
    waitingInt = null;
  }
}

export function incomingMessage() {
  stopWaiting();
  logInfo(new Date().toLocaleTimeString() + ' 🤖 Incoming transmission...');
}
