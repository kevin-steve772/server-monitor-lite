class Monitor {
    constructor() {
        this.currentTab = 'cpu';
        this.historyLen = 60;
        this.cpuHistory = new Array(this.historyLen).fill(0);
        this.memHistory = new Array(this.historyLen).fill(0);
        this.diskHistory = new Array(this.historyLen).fill(0);
        this.netUpHistory = new Array(this.historyLen).fill(0);
        this.netDownHistory = new Array(this.historyLen).fill(0);
        this.latestData = {};
        this.floatWindows = {};

        this.dom = {
            hostname: document.getElementById('hostname'),
            uptime: document.getElementById('uptime'),
            connectionStatus: document.getElementById('connection-status'),
            statusDot: document.getElementById('status-dot'),
            sideCpu: document.getElementById('side-cpu'),
            sideMem: document.getElementById('side-mem'),
            sideDisk: document.getElementById('side-disk'),
            sideNet: document.getElementById('side-net'),
            sparkCpu: document.getElementById('spark-cpu'),
            sparkMem: document.getElementById('spark-mem'),
            sparkDisk: document.getElementById('spark-disk'),
            sparkNet: document.getElementById('spark-net'),
            detailChart: document.getElementById('detail-chart'),
            cpuPercent: document.getElementById('cpu-percent'),
            cpuCores: document.getElementById('cpu-cores'),
            cpuFreq: document.getElementById('cpu-freq'),
            cpuLoad: document.getElementById('cpu-load'),
            memPercent: document.getElementById('mem-percent'),
            memTotal: document.getElementById('mem-total'),
            memUsed: document.getElementById('mem-used'),
            memFree: document.getElementById('mem-free'),
            memSwap: document.getElementById('mem-swap'),
            diskCount: document.getElementById('disk-count'),
            diskDetailList: document.getElementById('disk-detail-list'),
            netUp: document.getElementById('net-up'),
            netDown: document.getElementById('net-down'),
            netTotalUp: document.getElementById('net-total-up'),
            netTotalDown: document.getElementById('net-total-down'),
            netConns: document.getElementById('net-conns'),
            floatContainer: document.getElementById('float-container'),
        };
        this.tabNames = { cpu: 'CPU', memory: '内存', disk: '磁盘', network: '网络' };
        this.tabColors = { cpu: '#58a6ff', memory: '#f0883e', disk: '#3fb950', network: '#d2a8ff' };
        this.init();
    }

    init() {
        document.querySelectorAll('.sidebar-item').forEach(el => {
            this.addDragTear(el);
        });
        this.loadLayout();
        this.fetchAll();
        setInterval(() => this.fetchAll(), 4000);
    }

    /* ---- drag-to-tear from sidebar ---- */
    addDragTear(el) {
        let startX = null, startY = null, moved = false;
        const tab = el.dataset.tab;

        const onDown = e => {
            startX = e.clientX;
            startY = e.clientY;
            moved = false;
        };

        const onMove = e => {
            if (startX == null) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
                if (!moved) {
                    moved = true;
                    this.createFloatWindow(tab, e.clientX - 160, e.clientY - 20);
                }
            }
        };

        const onUp = () => {
            if (!moved && startX != null) {
                this.switchTab(tab);
            }
            startX = null;
            startY = null;
            moved = false;
        };

        el.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    /* ---- floating window management ---- */
    createFloatWindow(tab, x, y) {
        if (this.floatWindows[tab]) { this.bringToFront(tab); return; }

        const saved = this.loadWindowLayout(tab);
        const W = saved.w || 320;
        const H = saved.h || 260;
        const px = x != null ? x : (saved.x || 100 + Object.keys(this.floatWindows).length * 30);
        const py = y != null ? y : (saved.y || 60 + Object.keys(this.floatWindows).length * 30);

        const el = document.createElement('div');
        el.className = 'float-window';
        el.dataset.tab = tab;
        el.style.cssText = `left:${px}px; top:${py}px; width:${W}px; height:${H}px; z-index:${1000 + Object.keys(this.floatWindows).length}`;

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

        this.saveLayout();
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
            if (!raw) return;
            const layout = JSON.parse(raw);
            for (const tab in layout) {
                this.createFloatWindow(tab, layout[tab].x, layout[tab].y);
                const el = this.floatWindows[tab].el;
                el.style.width = layout[tab].w + 'px';
                el.style.height = layout[tab].h + 'px';
            }
        } catch {}
    }

    loadWindowLayout(tab) {
        try {
            const raw = localStorage.getItem('floatLayout');
            if (!raw) return {};
            const layout = JSON.parse(raw);
            return layout[tab] || {};
        } catch { return {}; }
    }

    /* ---- tab switching ---- */
    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });
        document.querySelectorAll('.stats-panel').forEach(el => el.classList.add('hidden'));
        const panel = document.getElementById('stats-' + tab);
        if (panel) panel.classList.remove('hidden');
        this.drawDetail();
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
        this.updateSidebar();
        this.drawDetail();
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
        this.dom.cpuPercent.textContent = cpu.percent.toFixed(1) + '%';
        this.dom.cpuCores.textContent = cpu.count + ' 核心';
        this.dom.cpuFreq.textContent = cpu.freq ? cpu.freq.toFixed(0) + ' MHz' : '-- MHz';
        this.dom.cpuLoad.textContent = cpu.load_avg ? cpu.load_avg.map(l => l.toFixed(2)).join(' / ') : '--';
        this.shiftPush(this.cpuHistory, cpu.percent);
    }

    updateMemory(mem) {
        this.dom.memPercent.textContent = mem.percent.toFixed(1) + '%';
        this.dom.memTotal.textContent = this.formatBytes(mem.total);
        this.dom.memUsed.textContent = this.formatBytes(mem.used);
        this.dom.memFree.textContent = this.formatBytes(mem.available);
        this.dom.memSwap.textContent = mem.swap_total > 0
            ? this.formatBytes(mem.swap_used) + ' / ' + this.formatBytes(mem.swap_total)
            : '--';
        this.shiftPush(this.memHistory, mem.percent);
    }

    updateDisk(disks) {
        this.dom.diskCount.textContent = disks.length + ' 个磁盘';
        this.dom.diskDetailList.innerHTML = disks.map(d => `
            <div class="disk-detail-item">
                <div class="disk-info">
                    <span class="disk-device">${d.device}</span>
                    <span class="disk-size">${this.formatBytes(d.used)} / ${this.formatBytes(d.total)} (${d.percent}%)</span>
                </div>
                <div class="progress-bar"><div class="progress-bar-fill" style="width:${d.percent}%"></div></div>
            </div>
        `).join('');
        const avg = disks.length ? disks.reduce((s, d) => s + d.percent, 0) / disks.length : 0;
        this.shiftPush(this.diskHistory, avg);
    }

    updateNetwork(net) {
        this.dom.netConns.textContent = net.connections + ' 连接';
        this.dom.netTotalUp.textContent = this.formatBytes(net.bytes_sent);
        this.dom.netTotalDown.textContent = this.formatBytes(net.bytes_recv);
        if (net.upload_speed !== undefined) {
            this.dom.netUp.textContent = this.formatSpeed(net.upload_speed);
            this.dom.netDown.textContent = this.formatSpeed(net.download_speed);
            this.shiftPush(this.netUpHistory, net.upload_speed);
            this.shiftPush(this.netDownHistory, net.download_speed);
        }
    }

    /* ---- sidebar ---- */
    updateSidebar() {
        this.dom.sideCpu.textContent = this.cpuHistory[this.historyLen - 1].toFixed(1) + '%';
        this.dom.sideMem.textContent = this.memHistory[this.historyLen - 1].toFixed(1) + '%';
        this.dom.sideDisk.textContent = this.diskHistory[this.historyLen - 1].toFixed(1) + '%';
        this.dom.sideNet.textContent = this.formatSpeed(this.netUpHistory[this.historyLen - 1]);
        this.drawSparkline(this.dom.sparkCpu, this.cpuHistory, '#58a6ff', 0, 100);
        this.drawSparkline(this.dom.sparkMem, this.memHistory, '#f0883e', 0, 100);
        this.drawSparkline(this.dom.sparkDisk, this.diskHistory, '#3fb950', 0, 100);
        this.drawSparkline(this.dom.sparkNet, this.netUpHistory, '#d2a8ff');
    }

    drawSparkline(canvas, data, color, yMin, yMax) {
        if (!canvas) return;
        const w = canvas.width;
        const h = canvas.height;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        const len = data.length;
        if (len < 2) return;
        if (yMin === undefined) {
            const mx = Math.max(...data, 1);
            yMin = 0; yMax = mx * 1.3;
        }
        const range = yMax - yMin || 1;
        const xStep = w / (len - 1);
        ctx.beginPath();
        for (let i = 0; i < len; i++) {
            const x = i * xStep;
            const y = h - ((data[i] - yMin) / range) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    /* ---- detail chart ---- */
    drawDetail() {
        const canvas = this.dom.detailChart;
        if (!canvas) return;
        this.drawChartOnCanvas(canvas, this.currentTab, this.tabColors[this.currentTab]);
    }

    drawChartOnCanvas(canvas, tab, color) {
        const parent = canvas.parentElement;
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        const pad = tab === 'network' ? 0 : 16;
        const w = pw - pad;
        const h = ph - pad;
        if (w <= 0 || h <= 0) return;

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

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
        const xStep = w / (len - 1);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            const y = (h / 4) * i;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        ctx.beginPath(); ctx.moveTo(0, h);
        for (let i = 0; i < len; i++) {
            ctx.lineTo(i * xStep, h - ((data[i] - yMin) / range) * h);
        }
        ctx.lineTo(w, h); ctx.closePath();
        ctx.fillStyle = color + '20';
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
            const x = i * xStep;
            const y = h - ((data[i] - yMin) / range) * h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        const val = data[len - 1];
        const display = tab === 'network' ? this.formatSpeed(val) : val.toFixed(1) + '%';
        ctx.fillStyle = color;
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(display, w - 4, 22);
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