// 服务器监控前端
// 写于2024年
// 作者：Aoao

// 一些全局变量
var ws;
let isConnected = false
const historyLen = 60;

// 从localStorage拿数据
function getStorage(key, defaultVal) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultVal;
    } catch(e) {
        console.log('storage error', e)
        return defaultVal;
    }
}

function setStorage(key, val) {
    try {
        localStorage.setItem(key, JSON.stringify(val));
    } catch(e) {
        console.error('save failed', e)
    }
}

// 主类
class Monitor {
    constructor() {
        this.ws = null
        this.reconnectInterval = 3000
        this.isConnected = false
        this.historyLength = 60
        
        // cpu历史
        this.cpuHistory = getStorage('cpuHistory', new Array(this.historyLength).fill(0))
        // 内存历史
        this.memoryHistory = getStorage('memHistory', new Array(this.historyLength).fill(0))
        
        this.loadingProgress = 0
        
        // 加载步骤
        this.steps = [
            { p: 10, text: '初始化系统...' },
            { p: 25, text: '加载配置...' },
            { p: 40, text: '连接服务器...' },
            { p: 60, text: '获取系统信息...' },
            { p: 80, text: '加载监控数据...' },
            { p: 100, text: '准备就绪!' }
        ]
        
        this.dom = {
            loadingBar: document.getElementById('loading-bar'),
            loadingStatus: document.getElementById('loading-status'),
            loadingScreen: document.getElementById('loading-screen'),
            mainContainer: document.getElementById('main-container'),
            connectionStatus: document.getElementById('connection-status'),
            statusDot: document.querySelector('.status-dot'),
            hostname: document.getElementById('hostname'),
            uptime: document.getElementById('uptime'),
            cpuPercent: document.getElementById('cpu-percent'),
            cpuCores: document.getElementById('cpu-cores'),
            cpuFreq: document.getElementById('cpu-freq'),
            cpuLoad: document.getElementById('cpu-load'),
            cpuRing: document.querySelector('.cpu-ring'),
            perCpuBars: document.getElementById('per-cpu-bars'),
            memPercent: document.getElementById('memory-percent'),
            memTotal: document.getElementById('memory-total'),
            memUsed: document.getElementById('memory-used'),
            memFree: document.getElementById('memory-free'),
            memRing: document.querySelector('.memory-ring'),
            memBarUsed: document.getElementById('memory-bar-used'),
            memBarSwap: document.getElementById('memory-bar-swap'),
            diskList: document.getElementById('disk-list'),
            netUpload: document.getElementById('net-upload'),
            netDownload: document.getElementById('net-download'),
            netTotalUpload: document.getElementById('net-total-upload'),
            netTotalDownload: document.getElementById('net-total-download'),
            netConnections: document.getElementById('net-connections'),
            cpuChart: document.getElementById('cpu-chart'),
            memChart: document.getElementById('memory-chart')
        };
        
        this.init()
    }

    init() {
        // 初始化图表
        this.initCharts();
        
        // 开始加载动画
        this.startLoading();
        
        // 连接websocket
        this.connect();
        
        // 绑定事件
        this.bindEvents();
    }

    // 加载动画
    startLoading() {
        let i = 0;
        const next = () => {
            if (i < this.steps.length) {
                const step = this.steps[i];
                this.dom.loadingBar.style.width = step.p + '%';
                this.dom.loadingStatus.textContent = step.text;
                i++;
                setTimeout(next, 300 + Math.random() * 400);
            }
        };
        next();
    }

    hideLoading() {
        this.dom.loadingBar.style.width = '100%';
        this.dom.loadingStatus.textContent = '准备就绪!';
        
        setTimeout(() => {
            this.dom.loadingScreen.classList.add('hidden');
            this.dom.mainContainer.style.visibility = 'visible';
            this.dom.mainContainer.style.opacity = '1';
        }, 500);
    }

    // ... (animate and animateNumber can be removed if we switch to CSS animations)

    // WebSocket连接
    connect() {
        const url = `ws://${window.location.host}/ws`;
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
            console.log('connected!');
            this.isConnected = true;
            this.updateStatus(true);
            this.hideLoading();
        };

        this.ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            // Batch DOM updates
            requestAnimationFrame(() => {
                this.updateUI(data);
            });
        };

        this.ws.onclose = () => {
            console.log('disconnected');
            this.isConnected = false;
            this.updateStatus(false);
            setTimeout(() => this.connect(), this.reconnectInterval);
        };

        this.ws.onerror = (err) => {
            console.error('ws error:', err);
            this.isConnected = false;
            this.updateStatus(false);
        };
    }

    updateStatus(connected) {
        if (connected) {
            this.dom.connectionStatus.textContent = '已连接';
            this.dom.statusDot.classList.add('connected');
        } else {
            this.dom.connectionStatus.textContent = '已断开';
            this.dom.statusDot.classList.remove('connected');
        }
    }

    // 更新UI
    updateUI(data) {
        if (data.system) this.updateSystem(data.system);
        if (data.cpu) this.updateCPU(data.cpu);
        if (data.memory) this.updateMemory(data.memory);
        if (data.disk) this.updateDisk(data.disk);
        if (data.network) this.updateNetwork(data.network);
        if (data.cpu && data.memory) this.updateCharts(data.cpu.percent, data.memory.percent);
    }

    updateSystem(sys) {
        this.dom.hostname.textContent = sys.hostname;
        this.dom.uptime.textContent = this.formatUptime(sys.uptime);
    }

    updateCPU(cpu) {
        this.dom.cpuPercent.textContent = cpu.percent.toFixed(1);
        this.dom.cpuCores.textContent = cpu.count + ' 核心';
        this.dom.cpuFreq.textContent = cpu.freq ? cpu.freq.toFixed(0) + ' MHz' : '-- MHz';
        this.dom.cpuLoad.textContent = cpu.load_avg ? cpu.load_avg.map(l => l.toFixed(2)).join(' / ') : '--';

        const c = 339.292;
        const offset = c - (cpu.percent / 100) * c;
        this.dom.cpuRing.style.strokeDashoffset = offset;

        this.updateCPUBars(cpu.per_cpu);
    }

    updateCPUBars(perCpu) {
        const container = this.dom.perCpuBars;
        if (container.children.length !== perCpu.length) {
            container.innerHTML = '';
            perCpu.forEach(() => {
                const bar = document.createElement('div');
                bar.className = 'cpu-bar';
                bar.innerHTML = '<div class="cpu-bar-fill"></div>';
                container.appendChild(bar);
            });
        }

        perCpu.forEach((usage, i) => {
            const fill = container.children[i].querySelector('.cpu-bar-fill');
            fill.style.height = usage + '%';
            
            fill.classList.toggle('high', usage > 80);
            fill.classList.toggle('medium', usage > 50 && usage <= 80);
        });
    }

    updateMemory(mem) {
        this.dom.memPercent.textContent = mem.percent.toFixed(1);
        this.dom.memTotal.textContent = this.formatBytes(mem.total);
        this.dom.memUsed.textContent = this.formatBytes(mem.used);
        this.dom.memFree.textContent = this.formatBytes(mem.available);

        const c = 339.292;
        this.dom.memRing.style.strokeDashoffset = c - (mem.percent / 100) * c;

        const usedPercent = (mem.used / mem.total) * 100;
        const swapPercent = mem.swap_total > 0 ? (mem.swap_used / mem.swap_total) * 100 : 0;
        
        this.dom.memBarUsed.style.width = usedPercent + '%';
        this.dom.memBarSwap.style.width = swapPercent + '%';
    }

    updateDisk(disks) {
        const container = this.dom.diskList;
        // Use a document fragment to reduce reflows
        const fragment = document.createDocumentFragment();

        disks.forEach((disk) => {
            const item = document.createElement('div');
            item.className = 'disk-item';
            item.innerHTML = `
                <div class="disk-info">
                    <span class="disk-device">${disk.device}</span>
                    <span class="disk-size">${this.formatBytes(disk.used)} / ${this.formatBytes(disk.total)}</span>
                </div>
                <div class="disk-progress">
                    <div class="disk-progress-fill" style="width: ${disk.percent}%"></div>
                </div>
            `;
            fragment.appendChild(item);
        });

        container.innerHTML = '';
        container.appendChild(fragment);
    }

    updateNetwork(net) {
        this.dom.netUpload.textContent = this.formatSpeed(net.upload_speed);
        this.dom.netDownload.textContent = this.formatSpeed(net.download_speed);
        this.dom.netTotalUpload.textContent = this.formatBytes(net.bytes_sent);
        this.dom.netTotalDownload.textContent = this.formatBytes(net.bytes_recv);
        this.dom.netConnections.textContent = net.connections + ' 连接';
    }

    updateCharts(cpuPercent, memPercent) {
        this.cpuHistory.shift();
        this.cpuHistory.push(cpuPercent);
        this.memoryHistory.shift();
        this.memoryHistory.push(memPercent);

        setStorage('cpuHistory', this.cpuHistory);
        setStorage('memHistory', this.memoryHistory);

        this.drawChart(this.dom.cpuChart, this.cpuHistory, '#00d4ff');
        this.drawChart(this.dom.memChart, this.memoryHistory, '#ff6b6b');
    }

    initCharts() {
        this.resizeCanvas(this.dom.cpuChart);
        this.resizeCanvas(this.dom.memChart);
        
        window.addEventListener('resize', () => {
            this.resizeCanvas(this.dom.cpuChart);
            this.resizeCanvas(this.dom.memChart);
            this.drawChart(this.dom.cpuChart, this.cpuHistory, '#00d4ff');
            this.drawChart(this.dom.memChart, this.memoryHistory, '#ff6b6b');
        });

        this.drawChart(this.dom.cpuChart, this.cpuHistory, '#00d4ff');
        this.drawChart(this.dom.memChart, this.memoryHistory, '#ff6b6b');
    }

    resizeCanvas(canvas) {
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        
        canvas.style.width = `${rect.width}px`;
        canvas.style.height = `${rect.height}px`;
    }

    drawChart(canvas, data, color) {
        const ctx = canvas.getContext('2d');
        const width = canvas.width / (window.devicePixelRatio || 1);
        const height = canvas.height / (window.devicePixelRatio || 1);
        
        ctx.clearRect(0, 0, width, height);
        
        // 绘制网格
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;
        
        // 垂直网格线
        const xStep = width / (data.length - 1);
        for(let i = 0; i < data.length; i += 10) {
            const x = i * xStep;
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        
        // 水平网格线
        for(let i = 0; i <= 4; i++) {
            const y = (height / 4) * i;
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        ctx.stroke();

        if (data.length < 2) return;

        // 创建渐变
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        
        let startColor, endColor;
        
        if (color.startsWith('#')) {
            startColor = this.hexToRgba(color, 0.3);
            endColor = this.hexToRgba(color, 0);
        } else {
            // 假设是 rgb/rgba，简单的字符串替换尝试
            // 但为了安全，我们这里只处理十六进制，因为我们只用了十六进制
            startColor = color; 
            endColor = color;
        }

        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);

        // 绘制区域
        ctx.beginPath();
        ctx.moveTo(0, height);
        
        let i = 0;
        // 移动到第一个点
        let x = 0;
        let y = height - (data[0] / 100) * height;
        ctx.lineTo(x, y);

        for (i = 1; i < data.length; i++) {
            x = i * xStep;
            y = height - (data[i] / 100) * height;
            
            // 简单的贝塞尔曲线平滑
            const prevX = (i - 1) * xStep;
            const prevY = height - (data[i - 1] / 100) * height;
            const cpX = (prevX + x) / 2;
            
            ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
        
        ctx.lineTo(width, height);
        ctx.closePath();
        
        ctx.fillStyle = gradient;
        // 如果是十六进制颜色，我们需要手动处理渐变色，这里简化处理，直接用固定透明度
        if (color.startsWith('#')) {
             const g = ctx.createLinearGradient(0, 0, 0, height);
             g.addColorStop(0, this.hexToRgba(color, 0.3));
             g.addColorStop(1, this.hexToRgba(color, 0));
             ctx.fillStyle = g;
        }
        ctx.fill();

        // 绘制线条
        ctx.beginPath();
        x = 0;
        y = height - (data[0] / 100) * height;
        ctx.moveTo(x, y);

        for (i = 1; i < data.length; i++) {
            x = i * xStep;
            y = height - (data[i] / 100) * height;
            const prevX = (i - 1) * xStep;
            const prevY = height - (data[i - 1] / 100) * height;
            const cpX = (prevX + x) / 2;
            ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
        }
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }


    // 工具函数
    formatBytes(bytes) {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    formatSpeed(bps) {
        if (bps === 0) return '0 B/s'
        const k = 1024
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s']
        const i = Math.floor(Math.log(bps) / Math.log(k))
        return parseFloat((bps / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
    }

    formatUptime(str) {
        return str.split('.')[0]
    }

    // 事件绑定
    bindEvents() {
        // 卡片悬停效果
        document.querySelectorAll('.monitor-card').forEach(card => {
            card.addEventListener('mouseenter', () => {
                card.style.transform = 'translateY(-5px) scale(1.02)'
            })

            card.addEventListener('mouseleave', () => {
                card.style.transform = 'translateY(0) scale(1)'
            })
        })
    }
}

// 启动
document.addEventListener('DOMContentLoaded', () => {
    new Monitor()
})
