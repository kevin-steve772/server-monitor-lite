# Server Monitor / 服务器监控面板

A clean and elegant server monitoring dashboard, built with pure native technologies, zero external dependencies.

一个简洁优雅的服务器监控面板，纯原生实现，无外部依赖。

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi)

## Preview / 预览

```
┌─────────────────────────────────────────────┐
│  Server Monitor          hostname   uptime  │
├──────────┬──────────┬──────────┬────────────┤
│   CPU    │  Memory  │   Disk   │  Network   │
│   45%    │   62%    │  C: 80%  │  ↑ 1MB/s   │
│  ◠◡◠◡    │  [====]  │  D: 45%  │  ↓ 5MB/s   │
└──────────┴──────────┴──────────┴────────────┘
│           CPU History / CPU 历史            │
│         ╭─╮    ╭──╮                       │
│    ╭───╯  ╰──╯    ╰──╮                    │
│ ───╯                  ╰───                │
└─────────────────────────────────────────────┘
```

## Features / 特性

- **Real-time Monitoring / 实时监控** - CPU, Memory, Disk, Network
- **History Charts / 历史图表** - 60-second data trends, persists after refresh / 60秒数据趋势，刷新不丢失
- **Pure Native / 纯原生实现** - No Chart.js, No Font Awesome, No Anime.js / 无 Chart.js、无 Font Awesome、无 Anime.js
- **Self-drawn SVG Charts / 自绘 SVG 图表** - Bezier curve smoothing algorithm / 贝塞尔曲线平滑算法
- **Loading Animation / 加载动画** - Progress bar on page entry / 进入页面时的进度条效果
- **Responsive Layout / 响应式布局** - Adapts to all screen sizes / 适配各种屏幕尺寸

## Installation / 安装

### Method 1: Clone with Git / 方法1：使用 Git 克隆

```bash
# Clone the repository / 克隆仓库
git clone https://github.com/USTCTI/server-monitor.git

# Enter directory / 进入目录
cd server-monitor
```

### Method 2: Download ZIP / 方法2：下载 ZIP

1. Click the green **"Code"** button on GitHub / 点击 GitHub 上的绿色 **"Code"** 按钮
2. Select **"Download ZIP"** / 选择 **"Download ZIP"**
3. Extract the ZIP file / 解压 ZIP 文件
4. Open the extracted folder / 打开解压后的文件夹

### Method 3: GitHub CLI / 方法3：使用 GitHub CLI

```bash
# Download with GitHub CLI / 使用 GitHub CLI 下载
gh repo clone USTCTI/server-monitor
```

## Quick Start / 快速开始

```bash
# Install dependencies / 安装依赖
pip install -r requirements.txt

# Run the server / 运行服务器
python app.py
```

Open your browser / 打开浏览器访问: `http://localhost:8000`

## System Requirements / 系统要求

- Python 3.8 or higher / Python 3.8 或更高版本
- Windows / Linux / macOS

## API

| Endpoint | Description / 说明 |
|----------|-------------------|
| `GET /api/all` | All monitoring data / 所有监控数据 |
| `WS /ws` | Real-time data stream / 实时数据流 |

## Tech Stack / 技术栈

- **Backend / 后端**: FastAPI + psutil
- **Frontend / 前端**: Native HTML/CSS/JS / 原生 HTML/CSS/JS
- **Charts / 图表**: Custom SVG with Bezier curves / 自研 SVG 贝塞尔曲线
- **Animation / 动画**: CSS3 + requestAnimationFrame

## Project Structure / 项目结构

```
server-monitor/
├── app.py              # Main application / 主程序
├── requirements.txt    # Dependencies / 依赖列表
├── README.md          # This file / 本文件
└── static/            # Static files / 静态文件
    ├── index.html     # Frontend page / 前端页面
    ├── css/
    │   └── style.css  # Styles / 样式
    └── js/
        └── monitor.js # Frontend logic / 前端逻辑
```

## Customization / 自定义

### Change Port / 修改端口

Edit `app.py` and modify the port / 编辑 `app.py` 修改端口:

```python
uvicorn.run(app, host="0.0.0.0", port=8080)  # Change 8080 to your port / 将 8080 改为你的端口
```

### Enable Auto-start / 开机自启 (Linux)

Create a systemd service / 创建 systemd 服务:

```bash
sudo nano /etc/systemd/system/server-monitor.service
```

Add the following content / 添加以下内容:

```ini
[Unit]
Description=Server Monitor
After=network.target

[Service]
Type=simple
User=yourusername
WorkingDirectory=/path/to/server-monitor
ExecStart=/usr/bin/python3 /path/to/server-monitor/app.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start / 启用并启动:

```bash
sudo systemctl enable server-monitor
sudo systemctl start server-monitor
```

## Troubleshooting / 故障排除

### Port already in use / 端口被占用

```bash
# Find process using port 8000 / 查找占用 8000 端口的进程
lsof -i :8000

# Or change port in app.py / 或在 app.py 中修改端口
```

### Permission denied / 权限不足

```bash
# Linux/macOS
chmod +x app.py
```

## Contributing / 贡献

1. Fork the repository / Fork 本仓库
2. Create your feature branch / 创建你的功能分支 (`git checkout -b feature/AmazingFeature`)
3. Commit your changes / 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch / 推送到分支 (`git push origin feature/AmazingFeature`)
5. Open a Pull Request / 打开 Pull Request

## License / 许可证

MIT License - see [LICENSE](LICENSE) file for details / 查看 [LICENSE](LICENSE) 文件了解详情

## Acknowledgments / 致谢

- [FastAPI](https://fastapi.tiangolo.com/) - High performance web framework / 高性能 Web 框架
- [psutil](https://github.com/giampaolo/psutil) - Cross-platform system monitoring / 跨平台系统监控库

---

**Enjoy monitoring your server! / 享受监控你的服务器吧！** 🚀
