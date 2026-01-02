const esbuild = require('esbuild');
const { execSync } = require('child_process');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const commonConfig = {
  entryPoints: ['src/index.ts'],
  bundle: true,
  sourcemap: true,
  target: 'es2022',
  platform: 'neutral',
};

async function build() {
  // Generate TypeScript declarations
  console.log('Generating type declarations...');
  try {
    execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' });
  } catch (e) {
    console.warn('Type generation warning (continuing...)');
  }

  // ESM build
  await esbuild.build({
    ...commonConfig,
    format: 'esm',
    outfile: 'dist/index.mjs',
  });

  // CJS build
  await esbuild.build({
    ...commonConfig,
    format: 'cjs',
    outfile: 'dist/index.js',
  });

  // Browser IIFE build
  await esbuild.build({
    ...commonConfig,
    format: 'iife',
    globalName: 'SimiCore',
    platform: 'browser',
    outfile: 'dist/browser.js',
    minify: true,
  });

  console.log('Build complete!');
}

if (isWatch) {
  const ctx = esbuild.context({
    ...commonConfig,
    format: 'esm',
    outfile: 'dist/index.mjs',
  });
  ctx.then(c => c.watch());
  console.log('Watching for changes...');
} else {
  build().catch(() => process.exit(1));
}
