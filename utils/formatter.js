import chalk from 'chalk';

export function prettierJson(json) {
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
