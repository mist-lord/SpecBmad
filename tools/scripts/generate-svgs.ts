import fs from 'fs';
import path from 'path';
import https from 'https';

const SOURCE_FILE = path.join(process.cwd(), 'docs', '完整工作原理图.md');
const OUTPUT_DIR = path.join(process.cwd(), 'docs', 'charts');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function extractMermaidCharts(content: string): { name: string; code: string }[] {
  const regex = /```mermaid\n([\s\S]*?)```/g;
  const charts: { name: string; code: string }[] = [];
  let match;
  let index = 1;

  // 简单的名称映射，基于出现的顺序（也可以尝试从上文标题提取，但这比较复杂）
  const names = [
    '系统整体架构',
    '命令执行流程',
    'go命令流程',
    'quick命令流程',
    'workflow命令流程',
    'Orchestrator工作流程',
    '依赖解析算法',
    '状态持久化',
    'Agent层次结构',
    'Agent执行流程',
    'Agent注册机制',
    'LLM客户端层次',
    'LLM管理器初始化',
    'LLM调用流程',
    '完整数据流',
    '上下文数据流',
    '文件生成流程',
    '完整交互序列图',
    '自动初始化流程',
    '配置检测逻辑',
    '代码生成器工作流程',
    '模板应用流程'
  ];

  while ((match = regex.exec(content)) !== null) {
    const code = match[1].trim();
    const name = names[index - 1] || `chart-${index}`;
    charts.push({ name, code });
    index++;
  }

  return charts;
}

async function downloadSvg(code: string, filename: string) {
  const encoded = Buffer.from(code).toString('base64');
  const url = `https://mermaid.ink/svg/${encoded}`;
  const dest = path.join(OUTPUT_DIR, `${filename}.svg`);

  return new Promise<void>((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download ${filename}: Status ${res.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      res.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✅ Generated: ${filename}.svg`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('🔍 读取文档...');
  const content = fs.readFileSync(SOURCE_FILE, 'utf-8');
  
  console.log('📊 提取 Mermaid 图表...');
  const charts = extractMermaidCharts(content);
  console.log(`找到 ${charts.length} 个图表`);

  console.log('⬇️  开始生成 SVG...');
  
  for (const chart of charts) {
    try {
      // 处理文件名中的特殊字符
      const safeName = chart.name.replace(/[\/\s]/g, '-').toLowerCase();
      await downloadSvg(chart.code, safeName);
    } catch (error) {
      console.error(`❌ Error generating ${chart.name}:`, error);
    }
  }

  console.log(`\n🎉 完成! SVG 文件已保存至: ${OUTPUT_DIR}`);
}

main().catch(console.error);

