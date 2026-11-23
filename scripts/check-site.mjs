import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';

const siteRoot = resolve('web');
const entryFile = resolve(siteRoot, 'index.html');
const errors = [];

function report(message) {
  errors.push(message);
}

function checkFile(file, label) {
  if (!existsSync(file) || !statSync(file).isFile()) {
    report(`${label} is missing: ${file}`);
  }
}

checkFile(entryFile, 'Site entry point');
checkFile(resolve(siteRoot, 'app.js'), 'Application script');
checkFile(resolve(siteRoot, 'style.css'), 'Stylesheet');

function checkReference(rawReference, sourceFile) {
  const reference = rawReference.trim();
  if (
    !reference ||
    reference.startsWith('#') ||
    /^(?:[a-z]+:|\/\/)/i.test(reference)
  ) {
    return;
  }

  if (reference.startsWith('/')) {
    report(
      `${sourceFile} uses the root-relative path "${reference}"; ` +
        'use a relative path so project Pages sites work under /repository-name/.'
    );
    return;
  }

  const pathOnly = reference.split(/[?#]/, 1)[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathOnly);
  } catch {
    report(`${sourceFile} contains an invalid URL: ${reference}`);
    return;
  }
  if (decodedPath.startsWith('#')) return;

  const target = resolve(dirname(resolve(siteRoot, sourceFile)), decodedPath);
  if (target !== siteRoot && !target.startsWith(`${siteRoot}${sep}`)) {
    report(`${sourceFile} references a file outside web/: ${reference}`);
    return;
  }
  if (!existsSync(target)) {
    report(`${sourceFile} reference is missing: ${target}`);
  }
}

if (existsSync(entryFile)) {
  const html = readFileSync(entryFile, 'utf8');
  if (!/<meta\s+charset=["']?utf-8["']?/i.test(html)) {
    report('index.html must declare UTF-8 so its punctuation renders correctly.');
  }
  if (/<base\s+[^>]*href=["']\//i.test(html)) {
    report('index.html has a root-relative <base>; this breaks project Pages sites.');
  }

  for (const match of html.matchAll(/\b(?:src|href)=["']([^"']+)["']/gi)) {
    checkReference(match[1], 'index.html');
  }
}

for (const cssFile of ['style.css']) {
  const absoluteCssFile = resolve(siteRoot, cssFile);
  if (!existsSync(absoluteCssFile)) continue;
  const css = readFileSync(absoluteCssFile, 'utf8');
  for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
    checkReference(match[1], cssFile);
  }
}

if (errors.length) {
  console.error(`Static site validation failed with ${errors.length} error(s):`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

const checkedExtensions = ['.css', '.html', '.js', '.otf', '.svg'];
console.log(
  `Static site validation passed (${checkedExtensions.join(', ')} assets are Pages-safe).`
);
