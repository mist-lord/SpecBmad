import { MarkdownMerger } from '@/utils/markdown-merger';

const baseMarkdown = `# Spec

## Parent
Parent intro.

### Child A
Child details.

## Sibling
Sibling section.
`;

type AstNode = {
  type: 'heading' | 'paragraph';
  depth?: number;
  children: Array<{ type: 'text'; value: string }>;
};

const toString = (node: AstNode): string =>
  node.children.map(child => child.value).join('');

const parseMarkdown = (markdown: string): { children: AstNode[] } => {
  const children: AstNode[] = [];
  const lines = markdown.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const headingMatch = /^(#{1,6})\s+(.*)$/.exec(line.trim());
    if (headingMatch) {
      children.push({
        type: 'heading',
        depth: headingMatch[1].length,
        children: [{ type: 'text', value: headingMatch[2] }],
      });
      i++;
      continue;
    }

    if (line.trim() === '') {
      i++;
      continue;
    }

    const paragraphLines: string[] = [];
    while (i < lines.length) {
      const current = lines[i];
      if (current.trim() === '') {
        i++;
        break;
      }
      if (/^(#{1,6})\s+/.test(current.trim())) break;
      paragraphLines.push(current.trim());
      i++;
    }

    children.push({
      type: 'paragraph',
      children: [{ type: 'text', value: paragraphLines.join(' ') }],
    });
  }

  return { children };
};

const stringifyMarkdown = (tree: { children: AstNode[] }): string =>
  tree.children
    .map(node => {
      if (node.type === 'heading') {
        return `${'#'.repeat(node.depth || 1)} ${toString(node)}`;
      }
      return toString(node);
    })
    .join('\n\n') + '\n';

const createProcessor = () => ({
  use() {
    return this;
  },
  parse(markdown: string) {
    return parseMarkdown(markdown);
  },
  stringify(tree: { children: AstNode[] }) {
    return stringifyMarkdown(tree);
  },
});

describe('MarkdownMerger', () => {
  beforeEach(() => {
    jest
      .spyOn(MarkdownMerger as unknown as { getTools: () => Promise<unknown> }, 'getTools')
      .mockResolvedValue({
        unified: () => createProcessor(),
        remarkParse: {},
        remarkStringify: {},
        toString,
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('addSection: appends section when parent is not provided', async () => {
    const output = await MarkdownMerger.addSection(
      baseMarkdown,
      'Tail',
      'Tail content.',
      2,
    );

    expect(output).toContain('## Tail');
    expect(output).toContain('Tail content.');
    expect(output.indexOf('## Tail')).toBeGreaterThan(output.indexOf('## Sibling'));
  });

  it('addSection: inserts under parent before next sibling heading', async () => {
    const output = await MarkdownMerger.addSection(
      baseMarkdown,
      'New Child',
      'Inserted content.',
      3,
      'Parent',
    );

    expect(output).toContain('### New Child');
    expect(output).toContain('Inserted content.');
    expect(output.indexOf('### New Child')).toBeGreaterThan(output.indexOf('## Parent'));
    expect(output.indexOf('### New Child')).toBeLessThan(output.indexOf('## Sibling'));
  });

  it('addSection: falls back to append when parent title does not exist', async () => {
    const output = await MarkdownMerger.addSection(
      baseMarkdown,
      'Fallback Child',
      'Fallback content.',
      3,
      'Missing Parent',
    );

    expect(output).toContain('### Fallback Child');
    expect(output.indexOf('### Fallback Child')).toBeGreaterThan(output.indexOf('## Sibling'));
  });

  it('updateSection: replaces existing section content until next same-level heading', async () => {
    const output = await MarkdownMerger.updateSection(
      baseMarkdown,
      'Parent',
      'Parent replaced.',
      2,
    );

    expect(output).toContain('## Parent');
    expect(output).toContain('Parent replaced.');
    expect(output).toContain('## Sibling');
    expect(output).not.toContain('### Child A');
  });

  it('updateSection: adds a new section when target heading does not exist', async () => {
    const output = await MarkdownMerger.updateSection(
      baseMarkdown,
      'Brand New',
      'Brand new content.',
      2,
    );

    expect(output).toContain('## Brand New');
    expect(output).toContain('Brand new content.');
    expect(output.indexOf('## Brand New')).toBeGreaterThan(output.indexOf('## Sibling'));
  });

  it('removeSection: removes heading and nested content', async () => {
    const output = await MarkdownMerger.removeSection(baseMarkdown, 'Parent', 2);

    expect(output).not.toContain('## Parent');
    expect(output).not.toContain('### Child A');
    expect(output).toContain('## Sibling');
  });

  it('removeSection: keeps document unchanged when heading is missing', async () => {
    const output = await MarkdownMerger.removeSection(baseMarkdown, 'Not Exists', 2);

    expect(output).toContain('## Parent');
    expect(output).toContain('### Child A');
    expect(output).toContain('## Sibling');
  });
});
