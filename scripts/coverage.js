const { spawnSync } = require('node:child_process');
const { readdirSync } = require('node:fs');
const tests = readdirSync('test').filter(name => name.endsWith('.test.js')).map(name => `test/${name}`);
// Preserve the template CI's existing gates even though its custom-script branch now runs this file.
for (const flags of [
  ['--test-coverage-include=src/services/**', '--test-coverage-lines=100', '--test-coverage-functions=100', '--test-coverage-branches=100'],
  ['--test-coverage-include=src/**', '--test-coverage-lines=80'],
]) {
  const result = spawnSync(process.execPath, ['--test', '--experimental-test-coverage', ...flags, ...tests], { stdio: 'inherit' });
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
