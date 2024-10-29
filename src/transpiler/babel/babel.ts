import useBabelConfig from './useBabelConfig';
import { magicImport } from '../../utils';
import type { TranspileOptions, TranspileOutput } from '../../types';

const babel = magicImport<typeof import('@babel/core')>('@babel/core');

export function transformFile(
  sourceFile: string,
  options: TranspileOptions,
): TranspileOutput {
  const babelConfig = useBabelConfig({ env: options.env });
  const transformedCode = babel.transformFileSync(sourceFile, {
    ...babelConfig,
    sourceMaps: Boolean(options.sourceMaps),
    comments: Boolean(options.comments),
    configFile: false,
  });
  const output: TranspileOutput = { code: transformedCode.code };
  if (transformedCode.map) {
    output.map = JSON.stringify(transformedCode.map);
  }
  return output;
}

export default transformFile;
