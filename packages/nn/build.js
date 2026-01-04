const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const commonOptions = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: ['es2022'],
};

async function build() {
  // Generate TypeScript declarations
  console.log('Generating type declarations...');
  try {
    execSync('npx tsc --emitDeclarationOnly --declaration --outDir dist', {
      cwd: __dirname,
      stdio: 'inherit',
    });
  } catch (e) {
    console.warn('Type generation had warnings');
  }

  // ESM build
  await esbuild.build({
    ...commonOptions,
    outfile: 'dist/index.mjs',
    format: 'esm',
  });

  // CJS build
  await esbuild.build({
    ...commonOptions,
    outfile: 'dist/index.js',
    format: 'cjs',
  });

  // Browser IIFE build
  await esbuild.build({
    ...commonOptions,
    outfile: 'dist/browser.js',
    format: 'iife',
    globalName: 'SimiNN',
    minify: true,
  });

  // Browser ESM build
  await esbuild.build({
    ...commonOptions,
    outfile: 'dist/browser.mjs',
    format: 'esm',
    minify: true,
  });

  console.log('Build complete!');
}

if (isWatch) {
  esbuild.context({
    ...commonOptions,
    outfile: 'dist/index.mjs',
    format: 'esm',
  }).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  build().catch(() => process.exit(1));
}
