const fs = require('fs');
const { execSync } = require('child_process');
const yml = fs.readFileSync('.github/workflows/pages.yml', 'utf8');
const tests = [...yml.matchAll(/- run: node (.*\.cjs)/g)].map(m => m[1]);
console.log('Running ' + tests.length + ' tests:');
const nodeBin = process.argv[0];
for (const t of tests) {
  process.stdout.write('  ' + t + '... ');
  try {
    execSync(`"${nodeBin}" "${t}"`, { stdio: 'pipe' });
    console.log('OK');
  } catch (err) {
    console.log('FAILED');
    console.error(err.stdout ? err.stdout.toString() : err.message);
    process.exit(1);
  }
}
console.log('ALL ' + tests.length + ' TESTS PASSED!');
