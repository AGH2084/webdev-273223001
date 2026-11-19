const { spawnSync } = require('node:child_process');
const result = spawnSync(process.execPath, ['--test', 'test/api.test.js', 'test/persistence.test.js'], { stdio: 'inherit' });
process.exitCode = result.status ?? 1;
