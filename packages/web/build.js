const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');

async function build() {
  // Bundle web app
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/simi-web.js',
    bundle: true,
    format: 'iife',
    globalName: 'SimiWeb',
    minify: !isWatch,
    sourcemap: true,
    target: ['es2022'],
  });

  // Also create ESM version
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/index.mjs',
    bundle: true,
    format: 'esm',
    minify: !isWatch,
    sourcemap: true,
    target: ['es2022'],
  });

  console.log('Build complete!');
}

if (isWatch) {
  esbuild.context({
    entryPoints: ['src/index.ts'],
    outfile: 'dist/simi-web.js',
    bundle: true,
    format: 'iife',
    globalName: 'SimiWeb',
    sourcemap: true,
    target: ['es2022'],
  }).then(ctx => {
    ctx.watch();
    console.log('Watching for changes...');
  });
} else {
  build().catch(() => process.exit(1));
}
