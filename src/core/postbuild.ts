import path from 'node:path';
import fse from 'fs-extra';
import glob from 'fast-glob';
import { log, parallel, sequential } from '../utils';
import { getConfig } from '../config';

/**
 * Copy required files of module in there folder
 */
export async function copyRequiredFiles() {
  const { assets, srcPath, buildPath } = getConfig();
  if (!assets || (Array.isArray(assets) && Boolean(assets.length))) {
    return;
  }

  if (!(await fse.pathExists(buildPath))) {
    log.warn(`[assets] path ${buildPath} does not exists to copy`);
    return [];
  }

  const hasCJS = await fse.pathExists(`${buildPath}/cjs`);
  const hasESM = await fse.pathExists(`${buildPath}/esm`);

  const files = await glob(assets, {
    cwd: srcPath,
    dot: true,
  });

  const task: Promise<void>[] = [];

  files.forEach(file => {
    if (hasCJS) {
      task.push(
        fse.copy(
          path.resolve(srcPath, file),
          path.resolve(`${buildPath}/cjs`, file),
        ),
      );
    }
    if (hasESM) {
      task.push(
        fse.copy(
          path.resolve(srcPath, file),
          path.resolve(`${buildPath}/esm`, file),
        ),
      );
    }
    task.push(
      fse.copy(path.resolve(srcPath, file), path.resolve(buildPath, file)),
    );
  });
  await Promise.all(task);
}

async function postbuild() {
  const { root, assets, srcPath, buildPath } = getConfig();

  /**
   * Following function help to move project files like
   * README, LICENCE into dist if exist from root
   */
  async function copyLibraryFiles() {
    await Promise.all(
      ['./README.md', './LICENSE'].map(file => {
        const sourcePath = path.resolve(root, file);
        if (fse.existsSync(sourcePath)) {
          const targetPath = path.resolve(buildPath, path.basename(file));
          fse.copyFileSync(sourcePath, targetPath);
        }
      }),
    );
  }

  /**
   * used to create tree-shakeable package.json in each module of project
   */
  async function createModulePackages() {
    const packageData = JSON.parse(
      await fse.readFile(path.resolve(root, './package.json'), 'utf8'),
    );

    const directoryPackages = glob
      .sync('*/index.{js,ts,tsx}', { cwd: srcPath })
      .map(path.dirname);

    await Promise.all(
      directoryPackages.map(async directoryPackage => {
        const packageJsonPath = path.join(
          buildPath,
          directoryPackage,
          'package.json',
        );

        const packageJson: Record<string, any> = {
          version: packageData.version,
          sideEffects: false,
          module: './index.js',
          main: path.posix.join('../cjs', directoryPackage, 'index.js'),
          types: './index.d.ts',
        };

        const [moduleEntryExists, mainEntryExists, typingsEntryExist] =
          await Promise.all([
            fse.pathExists(
              path.resolve(path.dirname(packageJsonPath), packageJson.module),
            ),
            fse.pathExists(
              path.resolve(path.dirname(packageJsonPath), packageJson.main),
            ),
            fse.pathExists(
              path.resolve(path.dirname(packageJsonPath), packageJson.types),
            ),
          ]);

        if (!moduleEntryExists) {
          delete packageJson.module;
        }
        if (!mainEntryExists) {
          delete packageJson.main;
        }
        if (!typingsEntryExist) {
          delete packageJson.types;
        }
        await fse.writeFile(
          packageJsonPath,
          JSON.stringify(packageJson, null, 2),
        );
        return packageJsonPath;
      }),
    );
  }

  /**
   * Function ensure build dir exist
   */
  async function ensureBuildDirExists() {
    if (!fse.existsSync(buildPath)) {
      fse.mkdirSync(buildPath, { recursive: true });
    }
  }

  /**
   * Copy type definition if exist in module files
   */
  async function typescriptCopy() {
    if (!(await fse.pathExists(buildPath))) {
      log.warn(`[types] path ${buildPath} does not exists`);
      return [];
    }
    const files = await glob('**/*.d.ts', { cwd: srcPath });
    await Promise.all(
      files.map(file =>
        fse.copy(path.resolve(srcPath, file), path.resolve(buildPath, file)),
      ),
    );
  }

  async function createPackageFile() {
    const {
      scripts,
      devDependencies,
      workspaces,
      publishConfig,
      ...restPackageData
    } = JSON.parse(
      fse.readFileSync(path.resolve(root, './package.json'), 'utf8'),
    );

    const newPackageData = {
      ...restPackageData,
      private: false,
      main: fse.existsSync(path.resolve(buildPath, './cjs/index.js'))
        ? './cjs/index.js'
        : './index.js',
      module: fse.existsSync(path.resolve(buildPath, './esm/index.js'))
        ? './esm/index.js'
        : './index.js',
    };

    const [moduleEntryExists, mainEntryExists] = [
      fse.pathExistsSync(path.resolve(buildPath, newPackageData.module)),
      fse.pathExistsSync(path.resolve(buildPath, newPackageData.main)),
    ];

    if (!moduleEntryExists) {
      delete newPackageData.module;
    }
    if (!mainEntryExists) {
      delete newPackageData.main;
    }

    const hasDefinitionsFile = fse.pathExistsSync(
      path.resolve(buildPath, './index.d.ts'),
    );

    if (hasDefinitionsFile) {
      newPackageData.types = './index.d.ts';
    }
    fse.writeFileSync(
      path.resolve(buildPath, './package.json'),
      JSON.stringify(newPackageData, null, 2),
      'utf8',
    );
  }

  try {
    await sequential([
      ensureBuildDirExists(),
      typescriptCopy(),
      copyRequiredFiles(),
      parallel([createModulePackages(), createPackageFile()]),
      copyLibraryFiles(),
    ]);
    log.success(`Build completed successfully\n`);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

export default postbuild;
