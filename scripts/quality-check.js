#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 代码质量检测脚本
 * 用于检测构建产物中的冗余代码和未使用代码
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const chalk = require('chalk');

// 配置项
const config = {
  // 构建目录
  buildDir: 'dist',
  // 源代码目录
  sourceDir: 'src',
  // 体积阈值(KB)
  sizeThresholds: {
    warning: 50, // 50KB
    error: 100, // 100KB
  },
  // 微包体积阈值(KB)
  packageSizeThresholds: {
    core: 10, // 核心包最大10KB
    standard: 20, // 标准包最大20KB
    full: 30, // 完整包最大30KB
  },
  // 重复代码检测阈值
  duplicationThreshold: 5, // 5行以上的重复代码
  // 类型覆盖率阈值
  typeCoverageThreshold: 90, // 90%的类型覆盖率
  // 并行执行
  parallel: true,
};

/**
 * 递归获取所有JS文件
 * @param {string} dir 目录
 * @param {Array} fileList 文件列表
 * @param {RegExp} [pattern] 文件名匹配模式
 * @returns {Array} 文件列表
 */
function collectFiles(dir, fileList = [], pattern = /\.(js|mjs)$/) {
  if (!fs.existsSync(dir)) {
    return fileList;
  }

  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      collectFiles(filePath, fileList, pattern);
    } else if (pattern.test(file) && !file.includes('.map')) {
      fileList.push({
        path: filePath,
        size: stat.size,
        sizeKB: (stat.size / 1024).toFixed(2),
        package: getPackageFromPath(filePath),
      });
    }
  });

  return fileList;
}

/**
 * 从文件路径获取包名
 * @param {string} filePath 文件路径
 * @returns {string} 包名
 */
function getPackageFromPath(filePath) {
  // 提取包名，例如从 packages/core/dist/index.js 提取 core
  const match = filePath.match(/packages\/([^/]+)/);
  return match ? match[1] : 'unknown';
}

/**
 * 获取所有微包
 * @returns {Array<string>} 微包列表
 */
function getAllPackages() {
  const packagesDir = path.join(process.cwd(), 'packages');
  if (!fs.existsSync(packagesDir)) {
    return [];
  }

  return fs.readdirSync(packagesDir).filter(file => {
    const stat = fs.statSync(path.join(packagesDir, file));
    return stat.isDirectory();
  });
}

/**
 * 显示脚本使用方法
 */
function showUsage() {
  console.log(`
${chalk.cyan('代码质量检测工具')}

使用方法:
  node scripts/quality-check.js [options]

选项:
  --check-unused       检测未使用的代码
  --check-duplicated   检测重复代码
  --check-size         检测体积异常的文件
  --check-types        检测类型覆盖率
  --check-deps         检测包依赖关系
  --check-all          执行所有检查
  --fix                尝试自动修复问题
  --package, -p <name> 只检查指定的包
  --parallel           并行执行检查 (默认: ${config.parallel})
  --no-parallel        串行执行检查
  --help               显示帮助信息
  `);
}

/**
 * 检测构建产物中可能的未使用代码
 * 使用ts-prune检测源码中未导出的代码
 * @param {boolean} fix 是否尝试修复
 * @param {string} [packageName] 指定包名，不指定则检测所有包
 * @returns {Promise<boolean>} 检测是否通过
 */
async function checkUnusedCode(fix = false, packageName = null) {
  console.log(chalk.cyan(`\n正在检测未使用的代码${packageName ? ` (${packageName})` : ''}...`));

  try {
    // 检查是否安装了ts-prune
    try {
      execSync('npx ts-prune --version', { stdio: 'ignore' });
    } catch (e) {
      console.log(chalk.yellow('ts-prune未安装, 正在安装...'));
      execSync('pnpm add -D ts-prune', { stdio: 'inherit' });
    }

    // 构建ts-prune命令
    let tsPruneCmd = 'npx ts-prune';
    if (packageName) {
      const packagePath = path.join('packages', packageName);
      tsPruneCmd += ` -p ${packagePath}/tsconfig.json`;
    }

    // 运行ts-prune检测未使用的导出
    const unusedExports = execSync(tsPruneCmd, { encoding: 'utf-8' });

    // 对结果进行分析
    const lines = unusedExports
      .split('\n')
      .filter(line => line.trim() && !line.includes('used in module'));

    // 按包名分组
    const unusedByPackage = {};
    lines.forEach(line => {
      const match = line.match(/packages\/([^/]+)/);
      const pkg = match ? match[1] : '其他';

      if (!unusedByPackage[pkg]) {
        unusedByPackage[pkg] = [];
      }
      unusedByPackage[pkg].push(line);
    });

    if (lines.length > 0) {
      console.log(chalk.yellow(`\n检测到${lines.length}个未使用的导出:`));

      // 按包分组显示
      Object.keys(unusedByPackage).forEach(pkg => {
        console.log(chalk.yellow(`\n${pkg}包:`));
        unusedByPackage[pkg].forEach(line => {
          console.log(chalk.gray(`  - ${line}`));
        });
      });

      if (fix) {
        console.log(chalk.yellow('\n修复建议:'));
        console.log(chalk.gray('1. 移除未使用的导出或添加 /* @internal */ 注释'));
        console.log(chalk.gray('2. 确保公共API有明确的导出和文档'));
        console.log(chalk.gray('3. 考虑将私有API移到内部模块中'));
      }
    } else {
      console.log(chalk.green('✓ 未检测到未使用的导出'));
    }

    return lines.length === 0;
  } catch (error) {
    console.error(chalk.red(`检测未使用代码时出错: ${error.message}`));
    return false;
  }
}

/**
 * 检测重复代码
 * @param {boolean} fix 是否尝试修复
 */
async function checkDuplicatedCode(fix = false) {
  console.log(chalk.cyan('\n正在检测重复代码...'));

  try {
    // 检查是否安装了jscpd
    try {
      execSync('npx jscpd --version', { stdio: 'ignore' });
    } catch (e) {
      console.log(chalk.yellow('jscpd未安装, 正在安装...'));
      execSync('npm install -D jscpd', { stdio: 'inherit' });
    }

    // 创建临时报告目录
    const reportDir = path.join(process.cwd(), 'temp-report');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    // 运行jscpd检测重复代码
    execSync(
      `npx jscpd src --output ${reportDir} --min-lines ${config.duplicationThreshold} --reporters json`,
      { encoding: 'utf-8' },
    );

    // 解析JSON报告
    const reportFile = path.join(reportDir, 'jscpd-report.json');
    if (fs.existsSync(reportFile)) {
      const report = JSON.parse(fs.readFileSync(reportFile, 'utf-8'));

      if (report.statistics.total.duplicatedLines > 0) {
        const dupPercent = (
          (report.statistics.total.duplicatedLines / report.statistics.total.lines) *
          100
        ).toFixed(2);

        console.log(chalk.yellow(`\n检测到代码重复率: ${dupPercent}%`));
        console.log(
          chalk.yellow(
            `重复行数: ${report.statistics.total.duplicatedLines} / ${report.statistics.total.lines}`,
          ),
        );
        console.log(chalk.yellow(`重复块数: ${report.statistics.total.duplicates}`));

        // 显示前10个重复代码片段
        if (report.duplicates && report.duplicates.length > 0) {
          console.log(chalk.yellow('\n重复代码片段示例:'));

          const topDuplicates = report.duplicates.slice(0, 10);
          topDuplicates.forEach((duplicate, index) => {
            console.log(chalk.gray(`\n重复片段 #${index + 1}:`));
            console.log(
              chalk.gray(
                `  - 来源文件: ${duplicate.firstFile.name}:${duplicate.firstFile.start}-${duplicate.firstFile.end}`,
              ),
            );
            console.log(
              chalk.gray(
                `  - 重复文件: ${duplicate.secondFile.name}:${duplicate.secondFile.start}-${duplicate.secondFile.end}`,
              ),
            );
            console.log(chalk.gray(`  - 重复行数: ${duplicate.lines}`));
          });
        }

        if (fix) {
          console.log(
            chalk.yellow('\n注意: 修复重复代码需要人工介入，请检查上述文件并考虑抽取共享函数。'),
          );
        }
      } else {
        console.log(chalk.green('✓ 未检测到重复代码'));
      }

      // 删除临时报告目录
      fs.rmSync(reportDir, { recursive: true, force: true });

      return report.statistics.total.duplicatedLines === 0;
    } else {
      console.log(chalk.yellow('未生成重复代码报告，可能没有检测到重复代码'));

      // 删除临时报告目录
      if (fs.existsSync(reportDir)) {
        fs.rmSync(reportDir, { recursive: true, force: true });
      }

      return true;
    }
  } catch (error) {
    console.error(chalk.red(`检测重复代码时出错: ${error.message}`));
    return false;
  }
}

/**
 * 检测体积异常的文件
 * @param {boolean} fix 是否尝试修复
 * @param {string} [packageName] 指定包名，不指定则检测所有包
 * @returns {Promise<boolean>} 检测是否通过
 */
async function checkFileSizes(fix = false, packageName = null) {
  console.log(chalk.cyan(`\n正在检测构建产物体积${packageName ? ` (${packageName})` : ''}...`));

  try {
    // 检查构建目录
    const packagesDir = path.join(process.cwd(), 'packages');
    if (!fs.existsSync(packagesDir)) {
      console.log(chalk.yellow('packages目录不存在，请确保在正确的项目根目录下运行'));
      return false;
    }

    // 获取要检查的包列表
    const packages = packageName ? [packageName] : getAllPackages();

    // 收集所有JS文件
    let allFiles = [];
    for (const pkg of packages) {
      const buildDir = path.join(packagesDir, pkg, config.buildDir);
      if (fs.existsSync(buildDir)) {
        const files = collectFiles(buildDir);
        allFiles = allFiles.concat(files);
      } else {
        console.log(chalk.yellow(`${pkg}包的构建目录 ${buildDir} 不存在，跳过检查`));
      }
    }

    // 按包名分组
    const filesByPackage = {};
    allFiles.forEach(file => {
      const pkg = file.package;
      if (!filesByPackage[pkg]) {
        filesByPackage[pkg] = [];
      }
      filesByPackage[pkg].push(file);
    });

    // 检查每个包的体积
    let hasErrors = false;

    // 检查各个包的入口文件体积
    Object.keys(filesByPackage).forEach(pkg => {
      const files = filesByPackage[pkg];

      // 按体积排序
      files.sort((a, b) => b.size - a.size);

      // 查找入口文件
      const entryFiles = files.filter(
        file =>
          file.path.includes('/index.js') ||
          file.path.includes('/index.mjs') ||
          file.path.endsWith(`/${pkg}.js`) ||
          file.path.endsWith(`/${pkg}.mjs`),
      );

      if (entryFiles.length > 0) {
        const entryFile = entryFiles[0];
        const sizeKB = parseFloat(entryFile.sizeKB);
        const sizeThreshold = config.packageSizeThresholds[pkg] || config.sizeThresholds.warning;

        if (sizeKB > sizeThreshold) {
          console.log(chalk.yellow(`\n${pkg}包入口文件体积超出阈值:`));
          console.log(
            chalk.yellow(`  - ${entryFile.path}: ${sizeKB} KB (阈值: ${sizeThreshold} KB)`),
          );
          hasErrors = true;
        }
      }

      // 检测超出阈值的文件
      const errorFiles = files.filter(file => file.size > config.sizeThresholds.error * 1024);
      const warningFiles = files.filter(
        file =>
          file.size > config.sizeThresholds.warning * 1024 &&
          file.size <= config.sizeThresholds.error * 1024,
      );

      if (errorFiles.length > 0 || warningFiles.length > 0) {
        console.log(chalk.yellow(`\n${pkg}包中检测到体积异常的文件:`));

        if (errorFiles.length > 0) {
          console.log(
            chalk.red(`\n错误: 以下文件超出体积错误阈值 (${config.sizeThresholds.error}KB):`),
          );
          errorFiles.forEach(file => {
            console.log(chalk.red(`  - ${file.path}: ${file.sizeKB} KB`));
          });
          hasErrors = true;
        }

        if (warningFiles.length > 0) {
          console.log(
            chalk.yellow(`\n警告: 以下文件超出体积警告阈值 (${config.sizeThresholds.warning}KB):`),
          );
          warningFiles.forEach(file => {
            console.log(chalk.yellow(`  - ${file.path}: ${file.sizeKB} KB`));
          });
        }
      }
    });

    if (hasErrors) {
      if (fix) {
        console.log(chalk.yellow('\n优化建议:'));
        console.log(chalk.gray('1. 检查是否包含未使用的依赖'));
        console.log(chalk.gray('2. 考虑拆分大文件为多个小模块'));
        console.log(chalk.gray('3. 确保启用了代码压缩和tree-shaking'));
        console.log(chalk.gray('4. 使用动态导入拆分代码'));
        console.log(chalk.gray('5. 检查是否有重复的依赖或可共享的代码'));
        console.log(chalk.gray('6. 考虑使用外部依赖而非打包进来'));
      }
    } else {
      console.log(chalk.green('✓ 所有文件体积在合理范围内'));
    }

    return !hasErrors;
  } catch (error) {
    console.error(chalk.red(`检测文件体积时出错: ${error.message}`));
    return false;
  }
}

/**
 * 检测TypeScript类型覆盖率
 * @param {boolean} fix 是否尝试修复
 * @param {string} [packageName] 指定包名，不指定则检测所有包
 * @returns {Promise<boolean>} 检测是否通过
 */
async function checkTypeCoverage(fix = false, packageName = null) {
  console.log(chalk.cyan(`\n正在检测类型覆盖率${packageName ? ` (${packageName})` : ''}...`));

  try {
    // 检查是否安装了type-coverage
    try {
      execSync('npx type-coverage --version', { stdio: 'ignore' });
    } catch (e) {
      console.log(chalk.yellow('type-coverage未安装, 正在安装...'));
      execSync('pnpm add -D type-coverage', { stdio: 'inherit' });
    }

    // 获取要检查的包列表
    const packages = packageName ? [packageName] : getAllPackages();
    const coverageResults = {};
    let allPassed = true;

    // 检查每个包的类型覆盖率
    for (const pkg of packages) {
      const packagePath = path.join('packages', pkg);
      if (!fs.existsSync(packagePath)) {
        console.log(chalk.yellow(`${pkg}包不存在，跳过检查`));
        continue;
      }

      try {
        // 运行type-coverage检测类型覆盖率
        const result = execSync(`npx type-coverage --detail --p ${packagePath}/tsconfig.json`, {
          encoding: 'utf-8',
        });

        // 解析结果
        const match = result.match(/(\d+\.\d+)%/);
        if (match) {
          const coverage = parseFloat(match[1]);
          coverageResults[pkg] = coverage;

          if (coverage < config.typeCoverageThreshold) {
            console.log(
              chalk.yellow(
                `\n${pkg}包类型覆盖率不足: ${coverage}% (阈值: ${config.typeCoverageThreshold}%)`,
              ),
            );
            allPassed = false;

            // 提取未覆盖的类型
            const detailMatch = result.match(/\n(.*?)\n/g);
            if (detailMatch && detailMatch.length > 0) {
              console.log(chalk.yellow('\n未覆盖的类型示例:'));
              const examples = detailMatch.slice(1, 6); // 最多显示5个示例
              examples.forEach(line => {
                console.log(chalk.gray(`  - ${line.trim()}`));
              });
            }

            if (fix) {
              console.log(chalk.yellow('\n修复建议:'));
              console.log(chalk.gray('1. 为变量和函数参数添加明确的类型注解'));
              console.log(chalk.gray('2. 避免使用any类型，使用更具体的类型'));
              console.log(chalk.gray('3. 使用泛型提高类型安全性'));
              console.log(chalk.gray('4. 为第三方库添加类型定义文件'));
            }
          } else {
            console.log(
              chalk.green(
                `✓ ${pkg}包类型覆盖率: ${coverage}% (阈值: ${config.typeCoverageThreshold}%)`,
              ),
            );
          }
        }
      } catch (error) {
        console.log(chalk.yellow(`检测${pkg}包类型覆盖率时出错: ${error.message}`));
        allPassed = false;
      }
    }

    // 显示总结
    if (Object.keys(coverageResults).length > 0) {
      const avgCoverage =
        Object.values(coverageResults).reduce((sum, val) => sum + val, 0) /
        Object.keys(coverageResults).length;

      console.log(chalk.cyan(`\n平均类型覆盖率: ${avgCoverage.toFixed(2)}%`));
    }

    return allPassed;
  } catch (error) {
    console.error(chalk.red(`检测类型覆盖率时出错: ${error.message}`));
    return false;
  }
}

/**
 * 检测包依赖关系
 * @param {boolean} fix 是否尝试修复
 * @returns {Promise<boolean>} 检测是否通过
 */
async function checkDependencies(fix = false) {
  console.log(chalk.cyan('\n正在检测包依赖关系...'));

  try {
    // 获取所有包
    const packages = getAllPackages();
    const packageInfos = {};
    let hasErrors = false;

    // 收集每个包的依赖信息
    for (const pkg of packages) {
      const packageJsonPath = path.join('packages', pkg, 'package.json');
      if (!fs.existsSync(packageJsonPath)) {
        console.log(chalk.yellow(`${pkg}包的package.json不存在，跳过检查`));
        continue;
      }

      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
      packageInfos[pkg] = {
        dependencies: packageJson.dependencies || {},
        peerDependencies: packageJson.peerDependencies || {},
        devDependencies: packageJson.devDependencies || {},
      };
    }

    // 检查依赖关系
    const issues = [];

    // 1. 检查包之间的依赖关系
    for (const pkg of packages) {
      if (!packageInfos[pkg]) continue;

      const deps = packageInfos[pkg].dependencies;
      for (const dep in deps) {
        // 检查内部包依赖
        if (dep.startsWith('@file-chunk-uploader/')) {
          const depPkg = dep.replace('@file-chunk-uploader/', '');

          // 检查依赖的包是否存在
          if (!packages.includes(depPkg)) {
            issues.push({
              type: 'missing',
              pkg,
              dep,
              message: `${pkg}包依赖了不存在的包: ${dep}`,
            });
          }

          // 检查是否有循环依赖
          if (
            packageInfos[depPkg] &&
            packageInfos[depPkg].dependencies[`@file-chunk-uploader/${pkg}`]
          ) {
            issues.push({
              type: 'circular',
              pkg,
              dep,
              message: `检测到循环依赖: ${pkg} <-> ${depPkg}`,
            });
          }
        }
      }
    }

    // 2. 检查核心包依赖
    if (packageInfos.core) {
      const coreDeps = Object.keys(packageInfos.core.dependencies || {});
      // core包不应该依赖其他内部包
      const internalDeps = coreDeps.filter(dep => dep.startsWith('@file-chunk-uploader/'));
      if (internalDeps.length > 0) {
        issues.push({
          type: 'core',
          pkg: 'core',
          deps: internalDeps,
          message: `core包不应该依赖其他内部包: ${internalDeps.join(', ')}`,
        });
      }
    }

    // 3. 检查标准包依赖
    if (packageInfos.standard) {
      // 标准包应该依赖核心功能包
      const standardDeps = Object.keys(packageInfos.standard.dependencies || {});
      const missingCoreDeps = ['core', 'chunk', 'resume', 'network', 'errors'].filter(
        pkg => !standardDeps.includes(`@file-chunk-uploader/${pkg}`),
      );

      if (missingCoreDeps.length > 0) {
        issues.push({
          type: 'standard',
          pkg: 'standard',
          deps: missingCoreDeps,
          message: `standard包缺少核心功能包依赖: ${missingCoreDeps
            .map(d => `@file-chunk-uploader/${d}`)
            .join(', ')}`,
        });
      }
    }

    // 显示检查结果
    if (issues.length > 0) {
      console.log(chalk.yellow(`\n检测到${issues.length}个依赖关系问题:`));

      // 按类型分组显示
      const issuesByType = {};
      issues.forEach(issue => {
        if (!issuesByType[issue.type]) {
          issuesByType[issue.type] = [];
        }
        issuesByType[issue.type].push(issue);
      });

      if (issuesByType.missing) {
        console.log(chalk.red('\n缺失依赖:'));
        issuesByType.missing.forEach(issue => {
          console.log(chalk.gray(`  - ${issue.message}`));
        });
      }

      if (issuesByType.circular) {
        console.log(chalk.red('\n循环依赖:'));
        issuesByType.circular.forEach(issue => {
          console.log(chalk.gray(`  - ${issue.message}`));
        });
      }

      if (issuesByType.core) {
        console.log(chalk.red('\ncore包依赖问题:'));
        issuesByType.core.forEach(issue => {
          console.log(chalk.gray(`  - ${issue.message}`));
        });
      }

      if (issuesByType.standard) {
        console.log(chalk.red('\nstandard包依赖问题:'));
        issuesByType.standard.forEach(issue => {
          console.log(chalk.gray(`  - ${issue.message}`));
        });
      }

      if (fix) {
        console.log(chalk.yellow('\n修复建议:'));
        console.log(chalk.gray('1. 确保core包不依赖其他内部包'));
        console.log(chalk.gray('2. 解决循环依赖，考虑使用接口或事件解耦'));
        console.log(chalk.gray('3. 确保standard包包含所有核心功能包的依赖'));
        console.log(chalk.gray('4. 移除对不存在包的依赖'));
      }

      hasErrors = true;
    } else {
      console.log(chalk.green('✓ 未检测到依赖关系问题'));
    }

    return !hasErrors;
  } catch (error) {
    console.error(chalk.red(`检测依赖关系时出错: ${error.message}`));
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2);

  // 显示帮助
  if (args.includes('--help')) {
    showUsage();
    process.exit(0);
  }

  // 是否尝试修复
  const shouldFix = args.includes('--fix');

  // 是否并行执行
  const parallelExecution = args.includes('--no-parallel') ? false : config.parallel;

  // 执行哪些检查
  const shouldCheckAll = args.includes('--check-all');
  const shouldCheckUnused = shouldCheckAll || args.includes('--check-unused');
  const shouldCheckDuplicated = shouldCheckAll || args.includes('--check-duplicated');
  const shouldCheckSize = shouldCheckAll || args.includes('--check-size');
  const shouldCheckTypes = shouldCheckAll || args.includes('--check-types');
  const shouldCheckDeps = shouldCheckAll || args.includes('--check-deps');

  // 如果没有指定任何检查，显示帮助
  if (
    !shouldCheckUnused &&
    !shouldCheckDuplicated &&
    !shouldCheckSize &&
    !shouldCheckTypes &&
    !shouldCheckDeps
  ) {
    showUsage();
    process.exit(1);
  }

  // 获取指定的包名
  let packageName = null;
  const packageIndex = args.findIndex(arg => arg === '--package' || arg === '-p');
  if (packageIndex !== -1 && args.length > packageIndex + 1) {
    packageName = args[packageIndex + 1];
  }

  console.log(chalk.bold.cyan('🔍 开始代码质量检查'));
  if (packageName) {
    console.log(chalk.cyan(`📦 仅检查包: ${packageName}`));
  }

  let allPassed = true;

  // 创建检查任务列表
  const tasks = [];

  if (shouldCheckUnused) {
    tasks.push({
      name: '未使用代码',
      run: () => checkUnusedCode(shouldFix, packageName),
    });
  }

  if (shouldCheckDuplicated) {
    tasks.push({
      name: '重复代码',
      run: () => checkDuplicatedCode(shouldFix),
    });
  }

  if (shouldCheckSize) {
    tasks.push({
      name: '文件体积',
      run: () => checkFileSizes(shouldFix, packageName),
    });
  }

  if (shouldCheckTypes) {
    tasks.push({
      name: '类型覆盖率',
      run: () => checkTypeCoverage(shouldFix, packageName),
    });
  }

  if (shouldCheckDeps) {
    tasks.push({
      name: '依赖关系',
      run: () => checkDependencies(shouldFix),
    });
  }

  // 执行检查任务
  if (parallelExecution && tasks.length > 1) {
    console.log(chalk.cyan(`\n并行执行${tasks.length}项检查...`));

    // 并行执行所有任务
    const results = await Promise.all(
      tasks.map(async task => {
        try {
          return await task.run();
        } catch (error) {
          console.error(chalk.red(`执行${task.name}检查时出错: ${error.message}`));
          return false;
        }
      }),
    );

    // 检查结果
    allPassed = results.every(result => result === true);
  } else {
    // 串行执行任务
    for (const task of tasks) {
      try {
        console.log(chalk.cyan(`\n执行${task.name}检查...`));
        const passed = await task.run();
        allPassed = allPassed && passed;
      } catch (error) {
        console.error(chalk.red(`执行${task.name}检查时出错: ${error.message}`));
        allPassed = false;
      }
    }
  }

  // 总结
  console.log('\n' + '-'.repeat(50));
  if (allPassed) {
    console.log(chalk.green.bold('✅ 所有检查通过!'));
  } else {
    console.log(chalk.yellow.bold('⚠️ 检查发现一些问题，请查看上面的报告。'));
    console.log(chalk.gray('提示: 使用 --fix 参数可获取修复建议'));
  }

  process.exit(allPassed ? 0 : 1);
}

main().catch(error => {
  console.error(chalk.red(`执行过程中出错: ${error.message}`));
  process.exit(1);
});
