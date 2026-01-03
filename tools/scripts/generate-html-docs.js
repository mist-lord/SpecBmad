
const fs = require('fs');
const path = require('path');

const mdPath = path.join(__dirname, '../docs/完整工作原理图.md');
const htmlPath = path.join(__dirname, '../docs/完整工作原理图-可视化.html');

console.log('读取源文件:', mdPath);
const content = fs.readFileSync(mdPath, 'utf-8');

// 简单的 Markdown 到 HTML 转换 (仅处理 mermaid 块和基础格式)
let htmlContent = content
  // 替换 mermaid 代码块
  .replace(/```mermaid\n([\s\S]*?)```/g, '<div class="mermaid">$1</div>')
  // 简单的标题转换
  .replace(/^# (.*$)/gm, '<h1>$1</h1>')
  .replace(/^## (.*$)/gm, '<h2>$1</h2>')
  .replace(/^### (.*$)/gm, '<h3>$1</h3>')
  .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
  // 列表转换 (简单处理，不处理嵌套)
  .replace(/^\- (.*$)/gm, '<li>$1</li>')
  // 链接转换
  .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');

// 将连续的 li 包装在 ul 中
// 这是一个简单的实现，可能无法完美处理所有情况，但对于文档展示足够了
const lines = htmlContent.split('\n');
let inList = false;
let resultLines = [];

for (let line of lines) {
    if (line.includes('<li>')) {
        if (!inList) {
            resultLines.push('<ul>');
            inList = true;
        }
        resultLines.push(line);
    } else {
        if (inList) {
            resultLines.push('</ul>');
            inList = false;
        }
        // 简单的段落处理：如果行不为空且不是标签开头，且之前不是li，则作为段落
        if (line.trim() && !line.trim().startsWith('<') && !line.trim().startsWith('```')) {
            resultLines.push(`<p>${line}</p>`);
        } else {
            resultLines.push(line);
        }
    }
}
if (inList) resultLines.push('</ul>');

htmlContent = resultLines.join('\n');

const finalHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>SpecKit-BMAD 工作原理图</title>
    <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 40px; line-height: 1.6; color: #333; }
        h1, h2, h3 { color: #2c3e50; margin-top: 1.5em; border-bottom: 1px solid #eee; padding-bottom: 10px; }
        h1 { font-size: 2.5em; border-bottom: 2px solid #eee; }
        .mermaid { background: white; padding: 20px; border: 1px solid #eee; border-radius: 8px; margin: 30px 0; display: flex; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        code { background: #f8f9fa; padding: 2px 5px; border-radius: 3px; font-family: monospace; color: #e83e8c; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; border: 1px solid #e9ecef; }
        a { color: #0366d6; text-decoration: none; }
        a:hover { text-decoration: underline; }
        ul { padding-left: 20px; }
        li { margin-bottom: 5px; }
        p { margin: 1em 0; }
    </style>
</head>
<body>
    ${htmlContent}
    <script>
        mermaid.initialize({ 
            startOnLoad: true,
            theme: 'default',
            securityLevel: 'loose',
            flowchart: { useMaxWidth: false, htmlLabels: true }
        });
    </script>
</body>
</html>
`;

fs.writeFileSync(htmlPath, finalHtml);
console.log('HTML 可视化文件已生成:', htmlPath);

