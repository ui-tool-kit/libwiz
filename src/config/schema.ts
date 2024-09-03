import { z } from 'zod';
import pc from 'picocolors';
import { log } from '../utils';
import { TransformOptions } from '@babel/core';

export type Bundles = 'modern' | 'common';

export interface ModuleConfig {
  output?: {
    comments?: boolean;
    sourceMap?: boolean;
    path?: string;
  };
}

export interface LibConfig {
  esm?: ModuleConfig;
  cjs?: ModuleConfig;
}

export type Config = Partial<{
  debug: boolean;
  root: string;
  workspace: string;
  tsConfig: string;
  extensions: string[];
  ignore: string[];
  lib: LibConfig;
  /**
   * validBundles: valid bundles eg: 'modern', 'common'
   */
  validBundles: Bundles[];
  target: Bundles | Bundles[];
  babel: {
    runtime: boolean;
    presets: TransformOptions['presets'];
    plugins: TransformOptions['plugins'];
    browsers: string | string[];
  };
  assets: string | string[] | null;
}>;

const VALID_BUNDLE_ENUM = z.enum(['modern', 'common']);

export const ModuleConfigSchema = z
  .object({
    output: z
      .object({
        comments: z.boolean().optional(),
        sourceMap: z.boolean().optional(),
        path: z.string().optional(),
      })
      .optional(),
  })
  .strict()
  .optional();

export const LibConfigSchema = z
  .object({
    esm: ModuleConfigSchema,
    cjs: ModuleConfigSchema,
  })
  .strict()
  .optional();

const BabelOverrideSchema = z
  .object({
    exclude: z.instanceof(RegExp),
    plugins: z.array(z.string()),
  })
  .strict();

const PluginAndPresetSchema = z.union([
  z.string(),
  z.tuple([z.string(), z.record(z.any())]),
]);

const BabelConfigSchema = z
  .object({
    runtime: z.boolean().optional(),
    presets: z.array(PluginAndPresetSchema).optional(),
    plugins: z.array(PluginAndPresetSchema).optional(),
    browsers: z.union([z.string(), z.array(z.string())]).optional(),
    overrides: z.array(BabelOverrideSchema).optional(),
  })
  .strict();

export const ConfigSchema = z
  .object({
    debug: z.boolean().optional(),
    root: z.string().optional(),
    workspace: z.string().optional(),
    tsConfig: z.string().optional(),
    extensions: z.array(z.string()).optional(),
    ignore: z.array(z.string()).optional(),
    lib: LibConfigSchema,
    validBundles: z.array(VALID_BUNDLE_ENUM).optional(),
    target: z.union([VALID_BUNDLE_ENUM, z.array(VALID_BUNDLE_ENUM)]).optional(),
    babel: BabelConfigSchema.optional(),
    assets: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
  })
  .strict();

function formatZodErrors(errors: any[]) {
  const error = errors[0];
  const { path, message } = error;
  const pathString = `${pc.yellow(path.length ? path.join(' -> ') : 'root')}`;
  const stackTrace = new Error().stack;
  const filteredStackTrace = stackTrace
    .split('\n')
    .filter(line => line.includes('/'))
    .join('\n');
  return `Error in config ${pathString} : ${message} \n${filteredStackTrace}`;
}

export function validateConfigSchema(config: Config) {
  const configResult = ConfigSchema.safeParse(config);
  if (!configResult.success) {
    log.error(formatZodErrors(configResult.error.errors));
    process.exit(1);
  }
  return configResult.data as Config;
}
