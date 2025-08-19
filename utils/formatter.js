import { logStyles } from './logger.js';

export function prettierJson(json) {
  const jsonString = JSON.stringify(json, null, 2);
  return (
    jsonString

      //keys: "id":
      .replace(/"(\w+)":/g, (_match, key) => {
        const coloredKey = logStyles.blue(`"${key}"`);
        return `${coloredKey}:`;
      })
      //string values:"x1ed234"
      .replace(/:\s*"([^"]+)"/g, (_match, val) => {
        return `: ${logStyles.yellow(`"${val}"`)}`;
      })
      //numbers: 124532
      .replace(/: (\d+)/g, (_match, num) => {
        return `: ${logStyles.magenta(num)}`;
      })
      //bools: :true or :false
      .replace(/: (true|false)/g, (_match, bool) => {
        return `: ${logStyles.green(bool)}`;
      })
  );
}
