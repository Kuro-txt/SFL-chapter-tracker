import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

let errorCount = 0;

function checkFile(filePath) {
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    try {
      new vm.SourceTextModule(code, { identifier: filePath });
    } catch (mErr) {
      console.error(`❌ SyntaxError in ${filePath}:`, mErr.message);
      errorCount++;
    }
  } catch (err) {
    console.error(`❌ Read error in ${filePath}:`, err.message);
    errorCount++;
  }
}

function scanDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDir(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      checkFile(fullPath);
    }
  }
}

scanDir('js');
scanDir('api');

if (errorCount === 0) {
  console.log('✅ ALL JS FILES PARSED CLEANLY WITH ZERO SYNTAX ERRORS!');
} else {
  console.error(`❌ Found ${errorCount} syntax error(s)!`);
  process.exit(1);
}
