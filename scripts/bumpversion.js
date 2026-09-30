import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const target = process.argv[2];

if (!target) {
  console.error('Error: Missing version argument.');
  console.error('Usage: npm run bump-version <major|minor|patch|vX.Y.Z>');
  process.exit(1);
}

const semverPattern = /^v\d+\.\d+\.\d+$/;
const keywordPattern = /^(major|minor|patch)$/;

if (!semverPattern.test(target) && !keywordPattern.test(target)) {
  console.error(`Error: Invalid argument "${target}".`);
  console.error('Allowed arguments: "major", "minor", "patch", or explicit "vX.Y.Z" (e.g. v1.2.3)');
  process.exit(1);
}

function run(command) {
  console.log(`> ${command}`);
  execSync(command, { stdio: 'inherit' });
}

const pkgPath = path.join(__dirname, '..', 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const currentVersion = pkg.version;

let newVersion;

if (keywordPattern.test(target)) {
  const parts = currentVersion.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    console.error(`Error: Current package.json version "${currentVersion}" is not a valid X.Y.Z semver.`);
    process.exit(1);
  }

  let [major, minor, patch] = parts;
  if (target === 'major') {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (target === 'minor') {
    minor += 1;
    patch = 0;
  } else if (target === 'patch') {
    patch += 1;
  }
  newVersion = `${major}.${minor}.${patch}`;
} else {
  // strip leading 'v' for package.json
  newVersion = target.slice(1);
}

const tag = `v${newVersion}`;

pkg.version = newVersion;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Updated package.json: ${currentVersion} -> ${newVersion}`);

try {
  run(`git add package.json`);
  run(`git commit -m "chore: bump version to ${tag}"`);
  run(`git tag -a ${tag} -m "Release ${tag}"`);
  run(`git push origin HEAD`);
  run(`git push origin ${tag}`);
  console.log(`\nSuccessfully bumped to ${tag} and pushed tag to origin!`);
} catch (error) {
  console.error('\nGit operation failed:', error.message);
  process.exit(1);
}
