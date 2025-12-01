import { stackManager } from './manager';
import { TypeScriptStackPlugin } from '@/plugins/stack-typescript';
import { PythonStackPlugin } from '@/plugins/stack-python';
import { CppStackPlugin } from '@/plugins/stack-cpp';
import { log } from '@/utils/logger';

export function registerBuiltInStacks() {
  stackManager.register(new TypeScriptStackPlugin());
  stackManager.register(new PythonStackPlugin());
  stackManager.register(new CppStackPlugin());
  log.debug('已注册内置技术栈插件: TypeScript, Python, C++');
}

export { stackManager };
export * from './interface';
export * from './manager';

