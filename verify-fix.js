/**
 * 🔍 验证修复脚本 - 检查 main.js 中的修复是否正确应用
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 验证 main.js 修复情况...');

// 读取 main.js 文件
const mainJsPath = path.join(__dirname, 'main.js');
const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');

// 检查项目列表
const checks = [
  {
    name: '调试日志记录器导入',
    pattern: /const.*debugLogger.*require.*debug-logger/,
    description: '检查是否导入了调试日志记录器'
  },
  {
    name: 'did-finish-load 事件中的 null 检查',
    pattern: /if\s*\(\s*!mainWindow\s*\|\|\s*mainWindow\.isDestroyed\(\)\s*\)/,
    description: '检查 did-finish-load 事件中是否有 null 检查'
  },
  {
    name: 'executeJavaScript 的 try-catch 包装',
    pattern: /try\s*{[\s\S]*mainWindow\.webContents\.executeJavaScript[\s\S]*}\s*catch/,
    description: '检查 executeJavaScript 是否有 try-catch 包装'
  },
  {
    name: 'ready-to-show 事件中的 null 检查',
    pattern: /ready-to-show[\s\S]*if\s*\(\s*!mainWindow\s*\|\|\s*mainWindow\.isDestroyed\(\)\s*\)/,
    description: '检查 ready-to-show 事件中是否有 null 检查'
  },
  {
    name: 'injectCustomTitleBar 函数中的 null 检查',
    pattern: /function\s+injectCustomTitleBar[\s\S]*if\s*\(\s*!mainWindow\s*\|\|\s*mainWindow\.isDestroyed\(\)\s*\)/,
    description: '检查 injectCustomTitleBar 函数中是否有 null 检查'
  },
  {
    name: 'loadFallbackPage 函数中的 null 检查',
    pattern: /function\s+loadFallbackPage[\s\S]*if\s*\(\s*!mainWindow\s*\|\|\s*mainWindow\.isDestroyed\(\)\s*\)/,
    description: '检查 loadFallbackPage 函数中是否有 null 检查'
  },
  {
    name: '缩放函数中的增强检查',
    pattern: /function\s+zoom\w+[\s\S]*if\s*\(\s*mainWindow\s*&&\s*!mainWindow\.isDestroyed\(\)\s*\)/,
    description: '检查缩放函数中是否有增强的 null 检查'
  },
  {
    name: '调试日志记录',
    pattern: /debugLogger\.(info|warn|error|debug)/,
    description: '检查是否使用了调试日志记录'
  }
];

console.log('\n📋 执行检查项目...\n');

let passedChecks = 0;
let totalChecks = checks.length;

checks.forEach((check, index) => {
  const matches = mainJsContent.match(check.pattern);
  const passed = matches !== null;
  
  console.log(`${index + 1}. ${check.name}`);
  console.log(`   ${check.description}`);
  
  if (passed) {
    console.log(`   ✅ 通过 (找到 ${matches.length} 处匹配)`);
    passedChecks++;
  } else {
    console.log(`   ❌ 失败 (未找到匹配)`);
  }
  console.log('');
});

// 统计结果
console.log('📊 检查结果统计:');
console.log(`✅ 通过: ${passedChecks}/${totalChecks}`);
console.log(`❌ 失败: ${totalChecks - passedChecks}/${totalChecks}`);
console.log(`📈 通过率: ${Math.round((passedChecks / totalChecks) * 100)}%`);

if (passedChecks === totalChecks) {
  console.log('\n🎉 所有检查项目都通过！修复已正确应用。');
  console.log('🚀 可以安全启动应用进行测试。');
} else {
  console.log('\n⚠️ 部分检查项目未通过，可能需要进一步检查。');
}

// 检查是否存在调试日志记录器文件
const debugLoggerPath = path.join(__dirname, 'debug-logger.js');
if (fs.existsSync(debugLoggerPath)) {
  console.log('\n✅ 调试日志记录器文件存在');
} else {
  console.log('\n❌ 调试日志记录器文件不存在');
}

// 检查是否存在测试文件
const testFiles = ['test-logic.js', 'test-main-app.bat', 'verify-fix.js'];
console.log('\n📁 测试文件检查:');
testFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} 存在`);
  } else {
    console.log(`❌ ${file} 不存在`);
  }
});

console.log('\n🔍 验证完成！');
