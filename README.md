# Server Monitor Lite / 轻量服务器监控面板

A lightweight server monitoring dashboard with minimal resource footprint. Sidebar tab layout inspired by Windows Task Manager.

轻量级服务器监控面板，资源占用低。采用 Windows 任务管理器风格的侧边栏标签布局。

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi)

## Features / 特性

- **Live Monitoring / 实时监控** - CPU, Memory, Disk, Network
- **Sidebar Tabs / 侧边栏标签** - Windows Task Manager style navigation
- **History Charts / 历史曲线** - 4-minute trend view for each metric
- **Mini Sparklines / 迷你趋势图** - Quick glance at recent changes in sidebar
- **HTTP Polling / HTTP 轮询** - Simple polling, no WebSocket overhead
- **Low Performance Impact / 低性能影响** - Minimal effects, no animations

## Quick Start / 快速开始

```bash
# Install dependencies / 安装依赖
pip install -r requirements.txt

# Run the server / 运行服务器
python app.py
```

Open your browser / 打开浏览器访问: `http://localhost:8001`

## API

| Endpoint | Description / 说明 |
|----------|-------------------|
| `GET /api/all` | All monitoring data / 所有监控数据 |
| `GET /api/cpu` | CPU info / CPU 信息 |
| `GET /api/memory` | Memory info / 内存信息 |
| `GET /api/disk` | Disk info / 磁盘信息 |
| `GET /api/network` | Network info / 网络信息 |

## Project Structure / 项目结构

```
server-monitor/
├── app.py              # Main application / 主程序
├── requirements.txt    # Dependencies / 依赖列表
├── README.md
└── static/
    ├── index.html
    ├── css/
    │   └── style.css
    └── js/
        └── monitor.js
```

## Tech Stack / 技术栈

- **Backend**: FastAPI + psutil
- **Frontend**: Native HTML/CSS/JS, Canvas 2D charts
- **No external JS/CSS libraries** / 无外部 JS/CSS 依赖

## License

MIT License
