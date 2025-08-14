import chalk from 'chalk';

let waitingInt = null;

const infoStyle = chalk.rgb(101, 170, 255);

export const logStyles = {
  info: infoStyle,
  bold: infoStyle.bold,
  dim: infoStyle.dim,
  error: chalk.red,
  green: chalk.green,
  yellow: chalk.yellow,
  gold: chalk.hex('#F7D346'),
  dimGold: chalk.dim.hex('#ffdd60ff'),
  warning: chalk.hex('#FFA500'),
  test: chalk.blue.underline,
  time: chalk.dim.white,
  reddish: chalk.hex('#ff92acff'),
  greenish: chalk.hex('#B7FD9B'),
  white: chalk.hex('#C1C5CE'),
  blue: chalk.blue,
  magenta: chalk.hex('#EC98F7'),
};

export function getTimeStamp(style = logStyles.time) {
  //TODO: fallback for international localized formatting
  return style(new Date().toLocaleString());
}

export function logInfo(msg, style = logStyles.info) {
  const dtStamp = getTimeStamp();
  console.log(`\n${dtStamp} `, style(`${msg}`));
}

export function logMessage(msg, style = logStyles.info) {
  const lines = msg.split('\n');
  const indented = lines.map((line) => '    ' + line).join('\n');
  console.log(style(`\n${indented}`));
}

export function prettierLines(segments) {
  return segments
    .map(([str, styleKey]) => {
      const styleFn = logStyles[styleKey] || ((style) => style);
      return styleFn(str);
    })
    .join('');
}

export function logError(msg, style = logStyles.error) {
  console.log(style(msg));
}

export function startWaiting(style = logStyles.dim) {
  waitingInt = setInterval(() => {
    logInfo(style('⏳ Waiting for next transmission...'));
  }, 5000); //update cli every 5 seconds while waiting for a message. help user feel more comfy that something's not broken.
}

export function stopWaiting() {
  if (waitingInt) {
    clearInterval(waitingInt);
    waitingInt = null;
  }
}

export function incomingMessage(style = logStyles.greenish) {
  stopWaiting();
  logInfo(style('🤖 Incoming transmission...'));
}
