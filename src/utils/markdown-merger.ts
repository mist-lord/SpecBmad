// import { log } from '@/utils/logger'; // Unused

export class MarkdownMerger {

  private static async getTools() {
    // 使用 Function 构造函数绕过 TS 的 CommonJS 转换，强制使用原生动态 import
    const dynamicImport = new Function('specifier', 'return import(specifier)');
    
    const { unified } = await dynamicImport('unified');
    const { default: remarkParse } = await dynamicImport('remark-parse');
    const { default: remarkStringify } = await dynamicImport('remark-stringify');
    const { visit } = await dynamicImport('unist-util-visit');
    const { toString } = await dynamicImport('mdast-util-to-string');

    return { unified, remarkParse, remarkStringify, visit, toString };
  }

  /**
   * 添加一个新章节
   */
  static async addSection(markdown: string, title: string, content: string, _level: number = 2, parentTitle?: string): Promise<string> {
    const { unified, remarkParse, remarkStringify, toString } = await this.getTools();
    const processor = unified().use(remarkParse).use(remarkStringify);
    
    const tree = processor.parse(markdown);
    const newContentTree = processor.parse(content);
    
    // 构建新的 Heading 节点
    const newHeadingNode = {
      type: 'heading',
      depth: _level,
      children: [{ type: 'text', value: title }]
    };
    
    // 新的节点序列 = [Heading, ...Content]
    const newNodes = [newHeadingNode, ...newContentTree.children];

    let inserted = false;

    if (parentTitle) {
      let parentIndex = -1;
      let parentDepth = 0;

      // 查找父标题
      const children = tree.children as any[];
      for (let i = 0; i < children.length; i++) {
        const node = children[i];
        if (node.type === 'heading') {
          const nodeTitle = toString(node);
          if (nodeTitle.trim() === parentTitle.trim()) {
            parentIndex = i;
            parentDepth = node.depth;
            break;
          }
        }
      }

      if (parentIndex !== -1) {
        // 找到插入点：父章节末尾 (下一个同级或更高级标题之前)
        let insertIndex = parentIndex + 1;
        while (insertIndex < children.length) {
          const node = children[insertIndex];
          if (node.type === 'heading' && node.depth <= parentDepth) {
            break;
          }
          insertIndex++;
        }
        
        children.splice(insertIndex, 0, ...newNodes);
        inserted = true;
      }
    }

    if (!inserted) {
      // 如果没找到父标题，或者没有指定父标题，追加到末尾
      (tree.children as any[]).push(...newNodes);
    }

    return processor.stringify(tree);
  }

  /**
   * 更新章节内容
   */
  static async updateSection(markdown: string, title: string, newContent: string, level: number = 2): Promise<string> {
    const { unified, remarkParse, remarkStringify, toString } = await this.getTools();
    const processor = unified().use(remarkParse).use(remarkStringify);
    
    const tree = processor.parse(markdown);
    const newContentTree = processor.parse(newContent);
    
    const targetHeading = {
      type: 'heading',
      depth: level,
      children: [{ type: 'text', value: title }]
    };
    
    const newNodes = [targetHeading, ...newContentTree.children];
    const children = tree.children as any[];

    let startIndex = -1;
    let currentDepth = -1;

    // 查找目标标题
    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.type === 'heading') {
        if (toString(node).trim() === title.trim()) {
          startIndex = i;
          currentDepth = node.depth;
          break;
        }
      }
    }

    if (startIndex !== -1) {
      // 确定结束索引 (下一个同级或更高级标题)
      let endIndex = startIndex + 1;
      while (endIndex < children.length) {
        const node = children[endIndex];
        if (node.type === 'heading' && node.depth <= currentDepth) {
          break;
        }
        endIndex++;
      }
      
      // 替换内容
      children.splice(startIndex, endIndex - startIndex, ...newNodes);
      return processor.stringify(tree);
    } else {
      // 不存在则添加
      return this.addSection(markdown, title, newContent, level);
    }
  }

  /**
   * 移除章节
   */
  static async removeSection(markdown: string, title: string, _level: number = 2): Promise<string> {
    const { unified, remarkParse, remarkStringify, toString } = await this.getTools();
    const processor = unified().use(remarkParse).use(remarkStringify);
    
    const tree = processor.parse(markdown);
    const children = tree.children as any[];
    
    let startIndex = -1;
    let currentDepth = -1;

    for (let i = 0; i < children.length; i++) {
      const node = children[i];
      if (node.type === 'heading') {
        if (toString(node).trim() === title.trim()) {
          startIndex = i;
          currentDepth = node.depth;
          break;
        }
      }
    }

    if (startIndex !== -1) {
      let endIndex = startIndex + 1;
      while (endIndex < children.length) {
        const node = children[endIndex];
        if (node.type === 'heading' && node.depth <= currentDepth) {
          break;
        }
        endIndex++;
      }
      
      children.splice(startIndex, endIndex - startIndex);
    }

    return processor.stringify(tree);
  }
}
