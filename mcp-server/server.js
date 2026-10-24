const readline = require('node:readline');

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
});

input.on('line', (line) => {
  console.error(`got: ${line}`);
});
