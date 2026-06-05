const fs = require('fs');
const path = require('path');

// 无关目录
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  '.vscode',
  '.idea',
  'dist',
  'build',
  '__pycache__',
]);

const ROOT = __dirname;

/**
 * 递归收集项目根目录下所有文件路径
 * @param {string} dir 当前目录
 * @param {string[]} result 结果数组
 */
function collectFiles(dir, result) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      collectFiles(path.join(dir, entry.name), result);
    } else {
      const absPath = path.join(dir, entry.name);
      const relPath = path.relative(ROOT, absPath);
      result.push(relPath);
    }
  }
}

const files = [];
collectFiles(ROOT, files);

// 自然排序
files.sort((a, b) => a.localeCompare(b));

console.log(`Project files (${files.length} total):\n`);
for (const f of files) {
  console.log(`  ${f}`);
}
