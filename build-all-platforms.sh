#!/bin/bash

# OpenClash管理器 Electron应用全平台打包脚本
# 支持Windows、macOS、Linux平台

set -e

echo "🚀 开始打包OpenClash管理器Electron应用..."

# 配置变量
APP_NAME="雷雨传媒配置管理"
APP_VERSION="1.0.0"
BUILD_DIR="dist"
PACKAGE_DIR="packages"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_step "检查构建依赖..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "NPM未安装"
        exit 1
    fi
    
    log_info "Node.js版本: $(node --version)"
    log_info "NPM版本: $(npm --version)"
}

# 安装依赖
install_dependencies() {
    log_step "安装项目依赖..."
    
    if [ ! -d "node_modules" ]; then
        log_info "安装NPM依赖..."
        npm install
    else
        log_info "依赖已存在，跳过安装"
    fi
}

# 清理构建目录
clean_build() {
    log_step "清理构建目录..."
    
    if [ -d "$BUILD_DIR" ]; then
        rm -rf "$BUILD_DIR"
        log_info "已清理 $BUILD_DIR 目录"
    fi
    
    if [ -d "$PACKAGE_DIR" ]; then
        rm -rf "$PACKAGE_DIR"
        log_info "已清理 $PACKAGE_DIR 目录"
    fi
    
    mkdir -p "$PACKAGE_DIR"
}

# 构建Windows版本
build_windows() {
    log_step "构建Windows版本..."
    
    log_info "构建Windows x64版本..."
    npm run build-win -- --x64
    
    if [ -f "$BUILD_DIR/雷雨传媒配置管理 Setup 1.0.0.exe" ]; then
        mv "$BUILD_DIR/雷雨传媒配置管理 Setup 1.0.0.exe" "$PACKAGE_DIR/LeiyuChuanmei-ConfigManager-${APP_VERSION}-win-x64-setup.exe"
        log_info "✅ Windows x64安装包构建完成"
    fi
    
    # 构建便携版
    log_info "构建Windows便携版..."
    npm run build-win -- --x64 --dir
    
    if [ -d "$BUILD_DIR/win-unpacked" ]; then
        cd "$BUILD_DIR"
        zip -r "../$PACKAGE_DIR/LeiyuChuanmei-ConfigManager-${APP_VERSION}-win-x64-portable.zip" win-unpacked/
        cd ..
        log_info "✅ Windows x64便携版构建完成"
    fi
}

# 构建macOS版本
build_macos() {
    log_step "构建macOS版本..."
    
    if [[ "$OSTYPE" == "darwin"* ]]; then
        log_info "构建macOS Intel版本..."
        npm run build-mac -- --x64
        
        log_info "构建macOS Apple Silicon版本..."
        npm run build-mac -- --arm64
        
        # 移动文件
        if [ -f "$BUILD_DIR/雷雨传媒配置管理-1.0.0.dmg" ]; then
            mv "$BUILD_DIR/雷雨传媒配置管理-1.0.0.dmg" "$PACKAGE_DIR/LeiyuChuanmei-ConfigManager-${APP_VERSION}-mac-universal.dmg"
            log_info "✅ macOS安装包构建完成"
        fi
    else
        log_warn "当前系统不是macOS，跳过macOS构建"
    fi
}

# 构建Linux版本
build_linux() {
    log_step "构建Linux版本..."
    
    log_info "构建Linux AppImage..."
    npm run build-linux -- --x64
    
    # 移动AppImage文件
    if [ -f "$BUILD_DIR/雷雨传媒配置管理-1.0.0.AppImage" ]; then
        mv "$BUILD_DIR/雷雨传媒配置管理-1.0.0.AppImage" "$PACKAGE_DIR/LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-x64.AppImage"
        chmod +x "$PACKAGE_DIR/LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-x64.AppImage"
        log_info "✅ Linux AppImage构建完成"
    fi
    
    # 移动DEB包
    if [ -f "$BUILD_DIR/雷雨传媒配置管理_1.0.0_amd64.deb" ]; then
        mv "$BUILD_DIR/雷雨传媒配置管理_1.0.0_amd64.deb" "$PACKAGE_DIR/LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-amd64.deb"
        log_info "✅ Linux DEB包构建完成"
    fi
}

# 生成校验文件
generate_checksums() {
    log_step "生成校验文件..."
    
    cd "$PACKAGE_DIR"
    
    # 生成MD5校验
    if command -v md5sum &> /dev/null; then
        md5sum * > checksums-md5.txt
        log_info "MD5校验文件已生成"
    fi
    
    # 生成SHA256校验
    if command -v sha256sum &> /dev/null; then
        sha256sum * > checksums-sha256.txt
        log_info "SHA256校验文件已生成"
    fi
    
    cd ..
}

# 创建发布说明
create_release_notes() {
    log_step "创建发布说明..."
    
    cat > "$PACKAGE_DIR/RELEASE_NOTES.md" << EOF
# 雷雨传媒配置管理 v${APP_VERSION}

## 📦 发布包

### Windows
- **LeiyuChuanmei-ConfigManager-${APP_VERSION}-win-x64-setup.exe**: Windows安装包
- **LeiyuChuanmei-ConfigManager-${APP_VERSION}-win-x64-portable.zip**: Windows便携版

### macOS
- **LeiyuChuanmei-ConfigManager-${APP_VERSION}-mac-universal.dmg**: macOS安装包 (支持Intel和Apple Silicon)

### Linux
- **LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-x64.AppImage**: Linux AppImage (通用)
- **LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-amd64.deb**: Debian/Ubuntu安装包

## ✨ 功能特性

- 🔐 **分级卡密权限系统**: 基础版、专业版、企业版三级权限
- 🎫 **卡密生成管理**: 批量生成和管理授权卡密
- 📊 **统计分析工具**: 卡密使用情况统计和分析
- 🔄 **在线验证系统**: 联网验证卡密有效性
- 🎨 **现代化界面**: 响应式设计，支持深色模式
- 🚀 **高性能**: 基于Electron框架，跨平台兼容

## 🔧 系统要求

### 最低配置
- **操作系统**: Windows 10+ / macOS 10.14+ / Ubuntu 18.04+
- **内存**: 4GB RAM
- **存储**: 200MB可用空间
- **网络**: 需要联网进行卡密验证

### 推荐配置
- **内存**: 8GB RAM
- **存储**: 1GB可用空间
- **显示器**: 1920x1080分辨率

## 📋 安装说明

### Windows
1. 下载 \`LeiyuChuanmei-ConfigManager-${APP_VERSION}-win-x64-setup.exe\`
2. 右键选择"以管理员身份运行"
3. 按照安装向导完成安装

### macOS
1. 下载 \`LeiyuChuanmei-ConfigManager-${APP_VERSION}-mac-universal.dmg\`
2. 双击打开DMG文件
3. 将应用拖拽到Applications文件夹

### Linux
#### AppImage (推荐)
1. 下载 \`LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-x64.AppImage\`
2. 添加执行权限: \`chmod +x LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-x64.AppImage\`
3. 双击运行

#### DEB包 (Debian/Ubuntu)
1. 下载 \`LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-amd64.deb\`
2. 安装: \`sudo dpkg -i LeiyuChuanmei-ConfigManager-${APP_VERSION}-linux-amd64.deb\`

## 🔒 安全说明

- 应用需要联网验证卡密有效性
- 所有数据本地存储，不会上传到服务器
- 建议在安全的网络环境中使用

## 📞 技术支持

如遇到问题，请联系技术支持团队。

---
构建时间: ${TIMESTAMP}
构建版本: ${APP_VERSION}
EOF

    log_info "发布说明已创建"
}

# 显示构建结果
show_results() {
    log_step "构建结果汇总"
    
    echo ""
    echo "📦 构建完成的安装包:"
    echo "================================"
    
    if [ -d "$PACKAGE_DIR" ]; then
        cd "$PACKAGE_DIR"
        for file in *; do
            if [ -f "$file" ] && [[ ! "$file" == *.txt ]] && [[ ! "$file" == *.md ]]; then
                size=$(du -h "$file" | cut -f1)
                echo "  📁 $file ($size)"
            fi
        done
        cd ..
        
        echo ""
        echo "📋 总计文件数: $(ls -1 "$PACKAGE_DIR" | wc -l)"
        echo "💾 总计大小: $(du -sh "$PACKAGE_DIR" | cut -f1)"
        echo "📂 输出目录: $PACKAGE_DIR/"
    fi
    
    echo ""
    echo "✅ 所有平台构建完成！"
}

# 主函数
main() {
    log_info "开始构建OpenClash管理器Electron应用"
    echo "应用名称: $APP_NAME"
    echo "应用版本: $APP_VERSION"
    echo "构建时间: $TIMESTAMP"
    echo ""
    
    check_dependencies
    install_dependencies
    clean_build
    
    # 根据参数选择构建平台
    if [ "$1" = "windows" ] || [ "$1" = "win" ]; then
        build_windows
    elif [ "$1" = "macos" ] || [ "$1" = "mac" ]; then
        build_macos
    elif [ "$1" = "linux" ]; then
        build_linux
    else
        # 构建所有平台
        build_windows
        build_macos
        build_linux
    fi
    
    generate_checksums
    create_release_notes
    show_results
}

# 运行主函数
main "$@"
