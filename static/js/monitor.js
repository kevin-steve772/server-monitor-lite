class Monitor {
    constructor() {
        this.historyLen = 60;
        this.cpuHistory = new Array(this.historyLen).fill(0);
        this.memHistory = new Array(this.historyLen).fill(0);
        this.diskHistory = new Array(this.historyLen).fill(0);
        this.netUpHistory = new Array(this.historyLen).fill(0);
        this.netDownHistory = new Array(this.historyLen).fill(0);
        this.latestData = {};
        this.floatWindows = {};
        this.tabNames = { cpu: 'CPU', memory: '内存', disk: '磁盘', network: '网络' };
        this.tabColors = { cpu: '#58a6ff', memory: '#f0883e', disk: '#3fb950', network: '#d2a8ff' };

        this.dom = {
            hostname: document.getElementById('hostname'),
            uptime: document.getElementById('uptime'),
            connectionStatus: document.getElementById('connection-status'),
            statusDot: document.getElementById('status-dot'),
            floatContainer: document.getElementById('float-container'),
        };
        this.init();
    }

    init() {
        const layout = this.loadLayout();
        if (layout && Object.keys(layout).length > 0) {
            this.restoreLayout(layout);
        } else {
            this.createDefaultWindows();
        }
        this.fetchAll();
        setInterval(() => this.fetchAll(), 4000);
        window.addEventListener('resize', () => this.saveLayout());
    }

    /* ---- default 2x2 grid layout ---- */
    createDefaultWindows() {
        const tabs = ['cpu', 'memory', 'disk', 'network'];
        const cols = 2;
        const gap = 6;
        const top = 4;
        const headerH = 32;
        const availW = window.innerWidth;
        const availH = window.innerHeight - headerH - top;
        const w = (availW - gap) / cols;
        const h = (availH - gap) / cols;

        tabs.forEach((tab, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = col * (w + gap);
            const y = top + row * (h + gap);
            this.createFloatWindow(tab, x, y, w, h, false);
        });
    }

    /* ---- floating window management ---- */
    createFloatWindow(tab, x, y, w, h, userAction = true) {
        if (this.floatWindows[tab]) { this.bringToFront(tab); return; }

        const el = document.createElement('div');
        el.className = 'float-window';
        el.dataset.tab = tab;
        el.style.cssText = `left:${x}px; top:${y}px; width:${w || 320}px; height:${h || 260}px; z-index:${1000 + Object.keys(this.floatWindows).length}`;

        el.innerHTML = `
            <div class="float-header">
                <span class="float-title">${this.tabNames[tab]}</span>
                <button class="float-close">×</button>
            </div>
            <div class="float-body">
                <div class="float-chart-wrap">
                    <canvas class="float-chart"></canvas>
                </div>
                <div class="float-stats" id="float-stats-${tab}"></div>
            </div>
            <div class="float-resize-handle"></div>
        `;

        this.dom.floatContainer.appendChild(el);

        const fw = {
            el,
            canvas: el.querySelector('.float-chart'),
            statsEl: el.querySelector('.float-stats'),
            tab,
        };
        this.floatWindows[tab] = fw;

        this.makeHeaderDraggable(el);
        this.makeResizable(el);
        el.querySelector('.float-close').addEventListener('click', () => this.closeFloatWindow(tab));
        el.addEventListener('mousedown', () => this.bringToFront(tab));

        if (userAction) this.saveLayout();
        this.updateFloatWindow(fw);
    }

    closeFloatWindow(tab) {
        const fw = this.floatWindows[tab];
        if (!fw) return;
        fw.el.remove();
        delete this.floatWindows[tab];
        this.saveLayout();
    }

    bringToFront(tab) {
        const fw = this.floatWindows[tab];
        if (!fw) return;
        const maxZ = Math.max(1000, ...Object.values(this.floatWindows).map(w => parseInt(w.el.style.zIndex) || 1000));
        fw.el.style.zIndex = maxZ + 1;
    }

    makeHeaderDraggable(el) {
        const header = el.querySelector('.float-header');
        let startX, startY, startL, startT;

        header.addEventListener('mousedown', e => {
            if (e.target.tagName === 'BUTTON') return;
            startX = e.clientX;
            startY = e.clientY;
            startL = parseInt(el.style.left);
            startT = parseInt(el.style.top);
            const onMove = me => {
                el.style.left = (startL + me.clientX - startX) + 'px';
                el.style.top = (startT + me.clientY - startY) + 'px';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.saveLayout();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    makeResizable(el) {
        const handle = el.querySelector('.float-resize-handle');
        let startX, startY, startW, startH;

        handle.addEventListener('mousedown', e => {
            e.stopPropagation();
            startX = e.clientX;
            startY = e.clientY;
            startW = el.offsetWidth;
            startH = el.offsetHeight;
            const onMove = me => {
                el.style.width = Math.max(240, startW + me.clientX - startX) + 'px';
                el.style.height = Math.max(180, startH + me.clientY - startY) + 'px';
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                this.saveLayout();
            };
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
    }

    /* ---- layout persistence ---- */
    saveLayout() {
        const layout = {};
        for (const tab in this.floatWindows) {
            const el = this.floatWindows[tab].el;
            layout[tab] = {
                x: parseInt(el.style.left),
                y: parseInt(el.style.top),
                w: el.offsetWidth,
                h: el.offsetHeight,
            };
        }
        try { localStorage.setItem('floatLayout', JSON.stringify(layout)); } catch {}
    }

    loadLayout() {
        try {
            const raw = localStorage.getItem('floatLayout');
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    restoreLayout(layout) {
        const headerH = 32;
        for (const tab in layout) {
            const { x, y, w, h } = layout[tab];
            this.createFloatWindow(tab, x, y, w, h, false);
        }
    }

    /* ---- data fetching ---- */
    async fetchAll() {
        try {
            const res = await fetch('/api/all');
            const data = await res.json();
            this.latestData = data;
            this.dom.connectionStatus.textContent = '已连接';
            this.dom.statusDot.className = 'status-dot connected';
            this.updateUI(data);
        } catch {
            this.dom.connectionStatus.textContent = '已断开';
            this.dom.statusDot.className = 'status-dot';
        }
    }

    updateUI(data) {
        if (data.system) this.updateSystem(data.system);
        if (data.cpu) this.updateCPU(data.cpu);
        if (data.memory) this.updateMemory(data.memory);
        if (data.disk) this.updateDisk(data.disk);
        if (data.network) this.updateNetwork(data.network);
        for (const tab in this.floatWindows) {
            this.updateFloatWindow(this.floatWindows[tab]);
        }
    }

    shiftPush(arr, val) {
        arr.shift();
        arr.push(val);
    }

    updateSystem(sys) {
        this.dom.hostname.textContent = sys.hostname;
        this.dom.uptime.textContent = this.formatUptime(sys.uptime);
    }

    updateCPU(cpu) {
        this.shiftPush(this.cpuHistory, cpu.percent);
    }

    updateMemory(mem) {
        this.shiftPush(this.memHistory, mem.percent);
    }

    updateDisk(disks) {
        const avg = disks.length ? disks.reduce((s, d) => s + d.percent, 0) / disks.length : 0;
        this.shiftPush(this.diskHistory, avg);
    }

    updateNetwork(net) {
        if (net.upload_speed !== undefined) {
            this.shiftPush(this.netUpHistory, net.upload_speed);
            this.shiftPush(this.netDownHistory, net.download_speed);
        }
    }

    /* ---- floating window content ---- */
    updateFloatWindow(fw) {
        this.drawChartOnCanvas(fw.canvas, fw.tab, this.tabColors[fw.tab]);
        this.updateFloatStats(fw);
    }

    updateFloatStats(fw) {
        const data = this.latestData;
        if (!data) return;

        let html = '';
        switch (fw.tab) {
            case 'cpu': {
                const c = data.cpu;
                if (!c) break;
                html = `
                    <div class="fs-row"><span class="fs-label">使用率</span><span class="fs-value">${c.percent.toFixed(1)}%</span></div>
                    <div class="fs-row"><span class="fs-label">核心</span><span class="fs-value">${c.count}</span></div>
                    <div class="fs-row"><span class="fs-label">频率</span><span class="fs-value">${c.freq ? c.freq.toFixed(0) + ' MHz' : '--'}</span></div>
                    <div class="fs-row"><span class="fs-label">负载</span><span class="fs-value">${c.load_avg ? c.load_avg.map(l => l.toFixed(2)).join(' / ') : '--'}</span></div>
                `;
                break;
            }
            case 'memory': {
                const m = data.memory;
                if (!m) break;
                html = `
                    <div class="fs-row"><span class="fs-label">使用率</span><span class="fs-value">${m.percent.toFixed(1)}%</span></div>
                    <div class="fs-row"><span class="fs-label">总计</span><span class="fs-value">${this.formatBytes(m.total)}</span></div>
                    <div class="fs-row"><span class="fs-label">已用</span><span class="fs-value">${this.formatBytes(m.used)}</span></div>
                    <div class="fs-row"><span class="fs-label">可用</span><span class="fs-value">${this.formatBytes(m.available)}</span></div>
                `;
                break;
            }
            case 'disk': {
                const disks = data.disk;
                if (!disks) break;
                html = disks.slice(0, 3).map(d =>
                    `<div class="fs-row" style="width:100%"><span class="fs-label">${d.device}</span><span class="fs-value">${d.percent}% (${this.formatBytes(d.used)}/${this.formatBytes(d.total)})</span></div>`
                ).join('');
                break;
            }
            case 'network': {
                const n = data.network;
                if (!n) break;
                html = `
                    <div class="fs-row"><span class="fs-label">上传</span><span class="fs-value">${n.upload_speed !== undefined ? this.formatSpeed(n.upload_speed) : '--'}</span></div>
                    <div class="fs-row"><span class="fs-label">下载</span><span class="fs-value">${n.download_speed !== undefined ? this.formatSpeed(n.download_speed) : '--'}</span></div>
                    <div class="fs-row"><span class="fs-label">总↑</span><span class="fs-value">${this.formatBytes(n.bytes_sent)}</span></div>
                    <div class="fs-row"><span class="fs-label">总↓</span><span class="fs-value">${this.formatBytes(n.bytes_recv)}</span></div>
                `;
                break;
            }
        }
        fw.statsEl.innerHTML = html;
    }

    /* ---- chart drawing ---- */
    drawChartOnCanvas(canvas, tab, color) {
        const parent = canvas.parentElement;
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        if (pw <= 0 || ph <= 0) return;

        canvas.width = pw;
        canvas.height = ph;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, pw, ph);

        let data, yMin, yMax;
        switch (tab) {
            case 'cpu': data = this.cpuHistory; yMin = 0; yMax = 100; break;
            case 'memory': data = this.memHistory; yMin = 0; yMax = 100; break;
            case 'disk': data = this.diskHistory; yMin = 0; yMax = 100; break;
            case 'network': data = this.netUpHistory; break;
        }
        if (!data || data.length < 2) return;

        if (yMin === undefined) {
            const mx = Math.max(...data, 1);
            yMin = 0; yMax = mx * 1.3;
        }

        const range = yMax - yMin || 1;
        const len = data.length;
        const xStep = pw / (len - 1);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            const y = (ph / 4) * i;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(pw, y); ctx.stroke();
        }

        ctx.beginPath(); ctx.moveTo(0, ph);
        for (let i = 0; i < len; i++) {
            ctx.lineTo(i * xStep, ph - ((data[i] - yMin) / range) * ph);
        }
        ctx.lineTo(pw, ph); ctx.closePath();
        ctx.fillStyle = color + '20';
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
            const x = i * xStep;
            const y = ph - ((data[i] - yMin) / range) * ph;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        const val = data[len - 1];
        const display = tab === 'network' ? this.formatSpeed(val) : val.toFixed(1) + '%';
        ctx.fillStyle = color;
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(display, pw - 4, 20);
    }

    /* ---- utilities ---- */
    formatSpeed(bps) {
        if (bps === 0) return '0 B/s';
        const k = 1024;
        const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
        const i = Math.floor(Math.log(bps) / Math.log(k));
        return parseFloat((bps / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    formatUptime(str) {
        return str.split('.')[0];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Monitor();
});