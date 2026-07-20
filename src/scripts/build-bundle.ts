import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT_DIR = path.resolve('dist/bundle');

/**
 * Builds an inspectable JS bundle without compiling to a standalone executable.
 * @param pretty - When true, skips minification for easier reading
 */
const buildBundle = async (pretty: boolean): Promise<void> => {
  await mkdir(OUT_DIR, { recursive: true });

  const basename = pretty ? 'index.pretty.js' : 'index.js';
  const outfile = path.join(OUT_DIR, basename);

  const result = await Bun.build({
    entrypoints: ['./index.ts'],
    target: 'bun',
    minify: !pretty,
    sourcemap: 'linked',
  });

  if (!result.success) {
    const details = result.logs.map((log) => log.message).join('\n');
    throw new Error(`Failed to build bundle:\n${details}`);
  }

  const [output] = result.outputs;
  if (!output) {
    throw new Error('Bundle build produced no output.');
  }

  await Bun.write(outfile, output);
  const mapOutput = result.outputs.find((entry) => entry.path.endsWith('.map'));
  if (mapOutput) {
    await Bun.write(`${outfile}.map`, mapOutput);
  }

  const sizeKb = (output.size / 1024).toFixed(1);
  console.log(`Built ${basename} (${sizeKb} KB): ${outfile}`);
};

const pretty = process.argv.includes('--pretty');

try {
  await buildBundle(pretty);
} catch (error) {
  console.error('Bundle build failed:', error);
  process.exit(1);
}
