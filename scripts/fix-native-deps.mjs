// Adds missing Linux native bindings after `npm ci` on a Linux build server.
//
// Why: package-lock.json was generated on Windows and npm (a long-standing npm
// bug) only recorded the Windows builds of packages that ship per-platform
// native code (rolldown, rollup, lightningcss, Tailwind oxide, ...). On Linux
// those packages then fail with "Cannot find module ...linux-x64-gnu.node".
//
// What it does: for every installed package that lists a Linux build of itself
// as an optional dependency, if that build is missing, it downloads exactly the
// version the package asks for and unpacks it where Node will look for it.
// It does nothing on Windows or macOS.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';

// NATIVE_DEPS_PREVIEW=1 lists what would be added on Linux x64, without downloading.
const preview = process.env.NATIVE_DEPS_PREVIEW === '1';
if (process.platform !== 'linux' && !preview) process.exit(0);

const arch = preview ? 'x64' : process.arch; // e.g. x64, arm64
// Debian/Ubuntu images use glibc ("gnu"); Alpine uses musl.
const libc = !preview && existsSync('/etc/alpine-release') ? 'musl' : 'gnu';
const root = process.cwd();
const tmp = join(tmpdir(), 'native-deps');
mkdirSync(tmp, { recursive: true });

const wanted = (name) => {
  if (!name.includes(`linux-${arch}`)) return false;
  if (/-(gnu|musl)(eabihf)?$/.test(name)) return name.endsWith(`-${libc}`);
  return true; // e.g. @esbuild/linux-x64 has no libc suffix
};

/** Every package.json under node_modules folders, including nested ones. */
function* packages(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.name.startsWith('@')) {
      yield* packages(full);
      continue;
    }
    if (existsSync(join(full, 'package.json'))) yield full;
    yield* packages(join(full, 'node_modules'));
  }
}

let added = 0;
for (const nm of [join(root, 'node_modules'), join(root, 'frontend', 'node_modules'), join(root, 'backend', 'node_modules')]) {
  for (const pkgDir of packages(nm)) {
    let pkg;
    try {
      pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    } catch {
      continue;
    }
    for (const [dep, range] of Object.entries(pkg.optionalDependencies ?? {})) {
      if (!wanted(dep)) continue;
      // Node resolves the binding from the node_modules folder that holds the package.
      const holder = pkgDir.slice(0, pkgDir.lastIndexOf('node_modules') + 'node_modules'.length);
      const target = join(holder, ...dep.split('/'));
      if (existsSync(join(target, 'package.json'))) continue;

      const version = String(range).replace(/^[\^~=]/, '');
      if (preview) {
        console.log(`would add ${dep}@${version} -> ${target.replace(root, '.')}`);
        added++;
        continue;
      }
      const file = execFileSync('npm', ['pack', `${dep}@${version}`, '--silent', '--pack-destination', tmp], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .pop();
      mkdirSync(target, { recursive: true });
      execFileSync('tar', ['-xzf', join(tmp, file), '-C', target, '--strip-components=1']);
      rmSync(join(tmp, file), { force: true });
      console.log(`added ${dep}@${version} -> ${target.replace(root, '.')}`);
      added++;
    }
  }
}
console.log(`native bindings: ${added} ${preview ? 'to add' : 'added'}`);
