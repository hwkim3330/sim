const esbuild = require('esbuild');
const { execSync } = require('child_process');

const isWatch = process.argv.includes('--watch');

async function build() {
  console.log('Building @simi/cli...');

  // Generate TypeScript declarations
  try {
    execSync('npx tsc --emitDeclarationOnly', { stdio: 'inherit' });
  } catch (e) {
    console.warn('Type generation warning (continuing...)');
  }

  // Build main entry
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/index.js',
    sourcemap: true,
    external: ['@simi/*', 'chalk', 'commander', 'inquirer', 'ora', 'express'],
  });

  // Build ESM version
  await esbuild.build({
    entryPoints: ['src/index.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/index.mjs',
    sourcemap: true,
    external: ['@simi/*', 'chalk', 'commander', 'inquirer', 'ora', 'express'],
  });

  console.log('Build complete!');
}

build().catch(() => process.exit(1));
