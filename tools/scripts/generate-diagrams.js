
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SOURCE_FILE = path.join(__dirname, '../docs/完整工作原理图.md');
const OUTPUT_DIR = path.join(__dirname, '../docs/images/diagrams');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 读取源文件
const content = fs.readFileSync(SOURCE_FILE, 'utf-8');

// 正则表达式匹配 mermaid 代码块
// 匹配格式: ```mermaid ... ```
const mermaidRegex = /```mermaid\n([\s\S]*?)```/g;

let match;
let index = 1;
const diagrams = [];

// 提取所有图表
while ((match = mermaidRegex.exec(content)) !== null) {
  const code = match[1];
  
  // 尝试从前文中找到标题作为文件名
  const beforeText = content.substring(0, match.index);
  const lines = beforeText.trim().split('\n');
  let title = `diagram-${index}`;
  
  // 查找最近的标题 (### 或 ####)
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.startsWith('### ') || line.startsWith('#### ')) {
      // 提取标题文本，移除 Markdown 标记和非法文件名字符
      title = line.replace(/^#+\s+/, '')
                 .replace(/[^\w\u4e00-\u9fa5\-_]/g, '-') // 保留中文、字母、数字、下划线
                 .replace(/-+/g, '-')
                 .replace(/^-|-$/g, '');
      break;
    }
  }
  
  // 避免重名
  if (diagrams.some(d => d.name === title)) {
    title = `${title}-${index}`;
  }
  
  diagrams.push({
    name: title,
    code: code,
    index: index
  });
  index++;
}

console.log(`找到 ${diagrams.length} 个图表，开始生成 SVG...`);

// 临时文件目录
const tempDir = path.join(__dirname, '../temp_diagrams');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

// 批量处理
for (const diag of diagrams) {
  const mmdFile = path.join(tempDir, `${diag.name}.mmd`);
  const svgFile = path.join(OUTPUT_DIR, `${diag.name}.svg`);
  
  fs.writeFileSync(mmdFile, diag.code);
  
  try {
    console.log(`正在生成: ${diag.name}.svg ...`);
    // 使用 npx 调用 mmdc，指定背景透明 (-b transparent)
    execSync(`npx -y @mermaid-js/mermaid-cli -i "${mmdFile}" -o "${svgFile}" -b transparent`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`生成失败: ${diag.name}`, error.message);
  }
}

// 清理临时文件
fs.rmSync(tempDir, { recursive: true, force: true });

console.log(`\n✅ 图表生成完成！文件保存在: ${OUTPUT_DIR}`);

