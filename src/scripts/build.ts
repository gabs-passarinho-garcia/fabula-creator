import { mkdir } from 'node:fs/promises';
import path from 'node:path';

interface BuildTarget {
  name: string;
  target: 'bun-linux-x64' | 'bun-windows-x64';
  outfile: string;
  useBytecode: boolean;
}

const BUILD_TARGETS: BuildTarget[] = [
  {
    name: 'Linux x64',
    target: 'bun-linux-x64',
    outfile: 'dist/linux/fabula-creator',
    useBytecode: true,
  },
  {
    name: 'Windows x64',
    target: 'bun-windows-x64',
    outfile: 'dist/windows/fabula-creator.exe',
    // Cross-compiled bytecode segfaults on launch on the target OS.
    // See: https://github.com/oven-sh/bun/issues/18416
    useBytecode: false,
  },
];

/**
 * Builds a standalone executable for a single platform target.
 * @param buildTarget - Platform target and output path configuration
 */
const buildExecutable = async (buildTarget: BuildTarget): Promise<void> => {
  const outfile = path.resolve(buildTarget.outfile);
  await mkdir(path.dirname(outfile), { recursive: true });

  const result = await Bun.build({
    entrypoints: ['./index.ts'],
    compile: {
      outfile,
      target: buildTarget.target,
    },
    minify: true,
    sourcemap: 'linked',
    bytecode: buildTarget.useBytecode,
  });

  if (!result.success) {
    const details = result.logs.map((log) => log.message).join('\n');
    throw new Error(`Failed to build ${buildTarget.name} executable:\n${details}`);
  }

  console.log(`Built ${buildTarget.name}: ${outfile}`);
};

/**
 * Generates standalone executables for all configured platforms.
 */
const runBuild = async (): Promise<void> => {
  console.log('Building Fabula Ultima Character Creator executables...\n');

  await BUILD_TARGETS.reduce<Promise<void>>(
    (chain, buildTarget) => chain.then(() => buildExecutable(buildTarget)),
    Promise.resolve(),
  );

  console.log('\nAll executables built successfully.');
};

try {
  await runBuild();
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}