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
        
        this.init()
    }

    init() {
        // 初始化图表
        this.initCharts()
        
        // 开始加载动画
        this.startLoading()
        
        // 连接websocket
        this.connect()
        
        // 绑定事件
        this.bindEvents()
    }

    // 加载动画
    startLoading() {
        const bar = document.getElementById('loading-bar')
        const status = document.getElementById('loading-status')
        
        let i = 0
        const next = () => {
            if (i < this.steps.length) {
                const step = this.steps[i]
                bar.style.width = step.p + '%'
                status.textContent = step.text
                i++
                
                // 随机延迟
                setTimeout(next, 300 + Math.random() * 400)
            }
        }
        
        next()
    }

    hideLoading() {
        const screen = document.getElementById('loading-screen')
        const container = document.getElementById('main-container')
        
        document.getElementById('loading-bar').style.width = '100%'
        document.getElementById('loading-status').textContent = '准备就绪!'
        
        setTimeout(() => {
            screen.classList.add('hidden')
            container.style.visibility = 'visible'
            container.style.opacity = '1'
            container.style.transition = 'opacity 0.8s ease'
        }, 500)
    }

    // 自定义动画
    animate(element, props, duration = 500, easing = 'easeOut') {
        const start = performance.now()
        const startVals = {}
        
        for (const prop in props) {
            const computed = window.getComputedStyle(element)
            startVals[prop] = parseFloat(computed[prop]) || 0
        }
        
        const frame = (now) => {
            const elapsed = now - start
            const progress = Math.min(elapsed / duration, 1)
            
            let eased
            if (easing === 'easeOut') {
                eased = 1 - Math.pow(1 - progress, 3)
            } else if (easing === 'easeInOut') {
                eased = progress < 0.5 
                    ? 4 * progress * progress * progress 
                    : 1 - Math.pow(-2 * progress + 2, 3) / 2
            } else {
                eased = progress
            }
            
            for (const prop in props) {
                const target = props[prop]
                const current = startVals[prop] + (target - startVals[prop]) * eased
                
                if (prop === 'opacity') {
                    element.style.opacity = current
                } else {
                    element.style[prop] = current + 'px'
                }
            }
            
            if (progress < 1) {
                requestAnimationFrame(frame)
            }
        }
        
        requestAnimationFrame(frame)
    }

    // 数字动画
    animateNumber(el, target, duration = 500) {
        const start = parseFloat(el.textContent) || 0
        const startTime = performance.now()
        
        const update = (now) => {
            const elapsed = now - startTime
            const progress = Math.min(elapsed / duration, 1)
            const easeOut = 1 - Math.pow(1 - progress, 4)
            const current = start + (target - start) * easeOut
            
            el.textContent = current.toFixed(1)
            
            if (progress < 1) {
                requestAnimationFrame(update)
            }
        }
        
        requestAnimationFrame(update)
    }

    // 初始化图表
    initCharts() {
        this.drawGrid('cpu-grid')
        this.drawGrid('mem-grid')
    }

    drawGrid(id) {
        const grid = document.getElementById(id)
        if (!grid) return
        
        for (let i = 0; i <= 5; i++) {
            const y = (i / 5) * 200
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line')
            line.setAttribute('x1', '0')
            line.setAttribute('y1', y.toString())
            line.setAttribute('x2', '400')
            line.setAttribute('y2', y.toString())
            grid.appendChild(line)
        }
    }

    // 更新图表
    updateChart(history, lineId, areaId) {
        const line = document.getElementById(lineId)
        const area = document.getElementById(areaId)
        if (!line || !area) return
        
        const width = 400
        const height = 200
        
        // 生成平滑曲线
        const path = this.smoothPath(history, width, height)
        
        line.setAttribute('d', path.line)
        area.setAttribute('d', path.area)
    }

    smoothPath(data, width, height) {
        if (data.length < 2) return { line: '', area: '' }
        
        const stepX = width / (data.length - 1)
        
        const points = data.map((val, i) => ({
            x: i * stepX,
            y: height - (val / 100) * height
        }))
        
        let linePath = `M ${points[0].x},${points[0].y}`
        
        for (let i = 0; i < points.length - 1; i++) {
            const curr = points[i]
            const next = points[i + 1]
            const cp1x = curr.x + (next.x - curr.x) * 0.3
            const cp1y = curr.y
            const cp2x = next.x - (next.x - curr.x) * 0.3
            const cp2y = next.y
            
            linePath += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${next.x},${next.y}`
        }
        
        const areaPath = linePath + ` L ${width},${height} L 0,${height} Z`
        
        return { line: linePath, area: areaPath }
    }

    // WebSocket连接
    connect() {
        const url = `ws://${window.location.host}/ws`
        this.ws = new WebSocket(url)

        this.ws.onopen = () => {
            console.log('connected!')
            this.isConnected = true
            this.updateStatus(true)
            this.hideLoading()
        }

        this.ws.onmessage = (e) => {
            const data = JSON.parse(e.data)
            this.updateUI(data)
        }

        this.ws.onclose = () => {
            console.log('disconnected')
            this.isConnected = false
            this.updateStatus(false)
            setTimeout(() => this.connect(), this.reconnectInterval)
        }

        this.ws.onerror = (err) => {
            console.error('ws error:', err)
            this.isConnected = false
            this.updateStatus(false)
        }
    }

    updateStatus(connected) {
        const status = document.getElementById('connection-status')
        const dot = document.querySelector('.status-dot')
        
        if (connected) {
            status.textContent = '已连接'
            dot.classList.add('connected')
        } else {
            status.textContent = '已断开'
            dot.classList.remove('connected')
        }
    }

    // 更新UI
    updateUI(data) {
        this.updateSystem(data.system)
        this.updateCPU(data.cpu)
        this.updateMemory(data.memory)
        this.updateDisk(data.disk)
        this.updateNetwork(data.network)
        this.updateCharts(data.cpu.percent, data.memory.percent)
    }

    updateSystem(sys) {
        document.getElementById('hostname').textContent = sys.hostname
        document.getElementById('uptime').textContent = this.formatUptime(sys.uptime)
    }

    updateCPU(cpu) {
        const percentEl = document.getElementById('cpu-percent')
        const coresEl = document.getElementById('cpu-cores')
        const freqEl = document.getElementById('cpu-freq')
        const loadEl = document.getElementById('cpu-load')
        const ring = document.querySelector('.cpu-ring')

        this.animateNumber(percentEl, cpu.percent)
        
        coresEl.textContent = cpu.count + ' 核心'
        freqEl.textContent = cpu.freq ? cpu.freq.toFixed(0) + ' MHz' : '-- MHz'
        loadEl.textContent = cpu.load_avg ? cpu.load_avg.map(l => l.toFixed(2)).join(' / ') : '--'

        // 进度环
        const c = 339.292
        const offset = c - (cpu.percent / 100) * c
        ring.style.strokeDashoffset = offset

        this.updateCPUBars(cpu.per_cpu)
    }

    updateCPUBars(perCpu) {
        const container = document.getElementById('per-cpu-bars')
        
        if (container.children.length !== perCpu.length) {
            container.innerHTML = ''
            perCpu.forEach((_, i) => {
                const bar = document.createElement('div')
                bar.className = 'cpu-bar'
                bar.innerHTML = '<div class="cpu-bar-fill"></div>'
                container.appendChild(bar)
                
                bar.style.transform = 'scaleY(0)'
                bar.style.transformOrigin = 'bottom'
                setTimeout(() => {
                    bar.style.transition = 'transform 0.5s ease'
                    bar.style.transform = 'scaleY(1)'
                }, i * 50)
            })
        }

        perCpu.forEach((usage, i) => {
            const fill = container.children[i].querySelector('.cpu-bar-fill')
            fill.style.height = usage + '%'
            
            fill.classList.remove('high', 'medium')
            if (usage > 80) fill.classList.add('high')
            else if (usage > 50) fill.classList.add('medium')
        })
    }

    updateMemory(mem) {
        const percentEl = document.getElementById('memory-percent')
        const totalEl = document.getElementById('memory-total')
        const usedEl = document.getElementById('memory-used')
        const freeEl = document.getElementById('memory-free')
        const ring = document.querySelector('.memory-ring')
        const barUsed = document.getElementById('memory-bar-used')
        const barSwap = document.getElementById('memory-bar-swap')

        this.animateNumber(percentEl, mem.percent)

        totalEl.textContent = this.formatBytes(mem.total)
        usedEl.textContent = this.formatBytes(mem.used)
        freeEl.textContent = this.formatBytes(mem.available)

        const c = 339.292
        ring.style.strokeDashoffset = c - (mem.percent / 100) * c

        const usedPercent = (mem.used / mem.total) * 100
        const swapPercent = mem.swap_total > 0 ? (mem.swap_used / mem.swap_total) * 100 : 0
        
        barUsed.style.width = usedPercent + '%'
        barSwap.style.width = swapPercent + '%'
    }

    updateDisk(disks) {
        const container = document.getElementById('disk-list')
        container.innerHTML = ''

        disks.forEach((disk, i) => {
            const item = document.createElement('div')
            item.className = 'disk-item'
            item.style.animationDelay = (i * 0.1) + 's'
            item.innerHTML = `
                <div class="disk-info">
                    <span class="disk-device">${disk.device}</span>
                    <span class="disk-size">${this.formatBytes(disk.used)} / ${this.formatBytes(disk.total)}</span>
                </div>
                <div class="disk-progress">
                    <div class="disk-progress-fill" style="width: 0%"></div>
                </div>
            `
            container.appendChild(item)

            setTimeout(() => {
                item.querySelector('.disk-progress-fill').style.width = disk.percent + '%'
            }, 100 + i * 100)
        })
    }

    updateNetwork(net) {
        document.getElementById('net-upload').textContent = this.formatSpeed(net.upload_speed)
        document.getElementById('net-download').textContent = this.formatSpeed(net.download_speed)
        document.getElementById('net-total-upload').textContent = this.formatBytes(net.bytes_sent)
        document.getElementById('net-total-download').textContent = this.formatBytes(net.bytes_recv)
        document.getElementById('net-connections').textContent = net.connections + ' 连接'
    }

    updateCharts(cpuPercent, memPercent) {
        this.cpuHistory.shift()
        this.cpuHistory.push(cpuPercent)
        this.memoryHistory.shift()
        this.memoryHistory.push(memPercent)

        // 保存到localStorage
        setStorage('cpuHistory', this.cpuHistory)
        setStorage('memHistory', this.memoryHistory)

        this.updateChart(this.cpuHistory, 'cpu-line', 'cpu-area')
        this.updateChart(this.memoryHistory, 'mem-line', 'mem-area')
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
