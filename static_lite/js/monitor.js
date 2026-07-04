class Monitor {
    constructor() {
        this.currentTab = 'cpu';
        this.historyLen = 60;
        this.cpuHistory = new Array(this.historyLen).fill(0);
        this.memHistory = new Array(this.historyLen).fill(0);
        this.diskHistory = new Array(this.historyLen).fill(0);
        this.netUpHistory = new Array(this.historyLen).fill(0);
        this.netDownHistory = new Array(this.historyLen).fill(0);

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
        };
        this.init();
    }

    init() {
        document.querySelectorAll('.sidebar-item').forEach(el => {
            el.addEventListener('click', () => this.switchTab(el.dataset.tab));
        });
        this.fetchAll();
        setInterval(() => this.fetchAll(), 4000);
    }

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

    async fetchAll() {
        try {
            const res = await fetch('/api/all');
            const data = await res.json();
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
            yMin = 0;
            yMax = mx * 1.3;
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

    drawDetail() {
        const canvas = this.dom.detailChart;
        if (!canvas) return;
        const parent = canvas.parentElement;
        const pw = parent.clientWidth;
        const ph = parent.clientHeight;
        const w = pw - 16;
        const h = ph - 16;
        if (w <= 0 || h <= 0) return;

        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);

        let data, color, yMin, yMax;
        switch (this.currentTab) {
            case 'cpu':
                data = this.cpuHistory; color = '#58a6ff'; yMin = 0; yMax = 100;
                break;
            case 'memory':
                data = this.memHistory; color = '#f0883e'; yMin = 0; yMax = 100;
                break;
            case 'disk':
                data = this.diskHistory; color = '#3fb950'; yMin = 0; yMax = 100;
                break;
            case 'network':
                data = this.netUpHistory; color = '#d2a8ff';
                break;
        }
        if (!data || data.length < 2) return;

        if (yMin === undefined) {
            const mx = Math.max(...data, 1);
            yMin = 0;
            yMax = mx * 1.3;
        }

        const range = yMax - yMin || 1;
        const len = data.length;
        const xStep = w / (len - 1);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 4; i++) {
            const y = (h / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i < len; i++) {
            const x = i * xStep;
            const y = h - ((data[i] - yMin) / range) * h;
            ctx.lineTo(x, y);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = color + '20';
        ctx.fill();

        ctx.beginPath();
        for (let i = 0; i < len; i++) {
            const x = i * xStep;
            const y = h - ((data[i] - yMin) / range) * h;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        const val = data[len - 1];
        const display = this.currentTab === 'network'
            ? this.formatSpeed(val)
            : val.toFixed(1) + '%';
        ctx.fillStyle = color;
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(display, w - 4, 22);
    }

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