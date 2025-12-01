import { GeneratorOptions } from '@/generator';

export interface StackPlugin {
  /**
   * 插件名称，例如 'typescript', 'python', 'cpp'
   */
  name: string;

  /**
   * 插件别名/变体，例如 ['ts', 'js'], ['py'], ['c++']
   */
  aliases?: string[];

  /**
   * 检测当前目录是否属于该技术栈
   * @param cwd 当前工作目录
   */
  detect(cwd: string): boolean;

  /**
   * 生成项目骨架
   * @param options 生成选项
   */
  generateSkeleton(options: GeneratorOptions): Promise<void>;

  /**
   * 获取运行命令
   * @param cwd 项目目录
   * @param script 脚本名称或路径
   */
  getRunCommand(cwd: string, script?: string): string;

  /**
   * 获取测试命令
   * @param cwd 项目目录
   */
  getTestCommand?(cwd: string): string;

  /**
   * 获取构建命令
   * @param cwd 项目目录
   */
  getBuildCommand?(cwd: string): string;
}

