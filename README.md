# Server Monitor Lite / 轻量服务器监控面板

A lightweight server monitoring dashboard. Default floating-window layout, draggable and resizable — arrange your workspace freely.

轻量级服务器监控面板。默认浮动窗口布局，可拖拽、可调整大小，自由排列工作区。

![Python](https://img.shields.io/badge/Python-3.8+-3776AB?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-0.109+-009688?logo=fastapi)

## Features / 特性

- **Floating Windows / 浮动窗口** — 每个指标独立窗口，可拖拽移动、任意调整大小
- **4-Min History Charts / 4分钟趋势曲线** — CPU、内存、磁盘、网络分别展示
- **Menu Bar / 顶部菜单栏** — 窗口关闭后随时重新打开
- **Layout Persistence / 布局记忆** — 窗口位置大小自动保存，刷新后恢复
- **HTTP Polling / HTTP 轮询** — 简单轮询，无 WebSocket 开销
- **Low Performance Impact / 低性能影响** — 无外部依赖，无冗余特效

## Quick Start / 快速开始

```bash
pip install -r requirements.txt
python app.py
```

Open browser / 打开浏览器: `http://localhost:8001`

## API

| Endpoint | Description |
|----------|-------------|
| `GET /api/all` | All monitoring data |

## Project Structure / 项目结构

```
server-monitor/
├── app.py
├── requirements.txt
├── README.md
└── static/
    ├── index.html
    ├── css/style.css
    └── js/monitor.js
```

## Tech Stack / 技术栈

- **Backend**: FastAPI + psutil
- **Frontend**: Native HTML/CSS/JS, Canvas 2D
- **No external JS/CSS libraries**

## License

MIT License
