import useBabelConfig from './useBabelConfig';
import getConfig from '../../config';
import { magicImport } from '../../utils';
import type { TranspileOptions, TranspileOutput } from '../../types';

export async function transformFileAsync(
  sourceFile: string,
  options: TranspileOptions,
): Promise<TranspileOutput> {
  const { root, workspace } = getConfig();
  const babel = magicImport<typeof import('@babel/core')>('@babel/core', {
    root,
    workspace,
  });

  const babelConfig = useBabelConfig();
  const transformedCode = await babel.transformFileAsync(sourceFile, {
    ...babelConfig,
    envName: options.env,
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

export default transformFileAsync;
