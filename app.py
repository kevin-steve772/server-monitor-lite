import asyncio
import json
import platform
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import psutil
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="Server Monitor", version="1.0.0")

# 启用Gzip压缩，最小压缩大小为1000字节
app.add_middleware(GZipMiddleware, minimum_size=1000)

# 挂载静态文件
app.mount("/static", StaticFiles(directory="static"), name="static")


class CPUInfo(BaseModel):
    percent: float
    count: int
    freq: Optional[float]
    per_cpu: List[float]
    load_avg: Optional[List[float]]


class MemoryInfo(BaseModel):
    total: int
    available: int
    percent: float
    used: int
    free: int
    swap_total: int
    swap_used: int
    swap_percent: float


class DiskInfo(BaseModel):
    device: str
    mountpoint: str
    total: int
    used: int
    free: int
    percent: float
    fstype: str


class NetworkInfo(BaseModel):
    bytes_sent: int
    bytes_recv: int
    packets_sent: int
    packets_recv: int
    errin: int
    errout: int
    dropin: int
    dropout: int
    connections: int


class ProcessInfo(BaseModel):
    pid: int
    name: str
    username: str
    cpu_percent: float
    memory_percent: float
    memory_mb: float
    status: str
    create_time: float


class SystemInfo(BaseModel):
    hostname: str
    platform: str
    platform_version: str
    architecture: str
    processor: str
    boot_time: float
    uptime: str


from functools import lru_cache, wraps
from datetime import timedelta

def timed_lru_cache(seconds: int, maxsize: int = 128):
    def wrapper_cache(func):
        func = lru_cache(maxsize=maxsize)(func)
        func.lifetime = timedelta(seconds=seconds)
        func.expiration = datetime.now(timezone.utc) + func.lifetime

        @wraps(func)
        def wrapped_func(*args, **kwargs):
            if datetime.now(timezone.utc) >= func.expiration:
                func.cache_clear()
                func.expiration = datetime.now(timezone.utc) + func.lifetime
            return func(*args, **kwargs)

        return wrapped_func
    return wrapper_cache

@timed_lru_cache(seconds=3600)
def get_system_info() -> SystemInfo:
    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    uptime_str = str(timedelta(seconds=uptime_seconds))
    
    return SystemInfo(
        hostname=platform.node(),
        platform=platform.system(),
        platform_version=platform.version(),
        architecture=platform.architecture()[0],
        processor=platform.processor() or "Unknown",
        boot_time=boot_time,
        uptime=uptime_str
    )


def get_cpu_info() -> CPUInfo:
    per_cpu = psutil.cpu_percent(interval=0.1, percpu=True)
    cpu_percent = sum(per_cpu) / len(per_cpu)
    cpu_count = psutil.cpu_count()
    
    freq_info = psutil.cpu_freq()
    freq = freq_info.current if freq_info else None
    
    load_avg = None
    if hasattr(psutil, 'getloadavg'):
        load_avg = list(psutil.getloadavg())
    
    return CPUInfo(
        percent=cpu_percent,
        count=cpu_count,
        freq=freq,
        per_cpu=per_cpu,
        load_avg=load_avg
    )


def get_memory_info() -> MemoryInfo:
    mem = psutil.virtual_memory()
    swap = psutil.swap_memory()
    
    return MemoryInfo(
        total=mem.total,
        available=mem.available,
        percent=mem.percent,
        used=mem.used,
        free=mem.free,
        swap_total=swap.total,
        swap_used=swap.used,
        swap_percent=swap.percent
    )


@timed_lru_cache(seconds=3600)
def get_disk_info() -> List[DiskInfo]:
    disks = []
    for partition in psutil.disk_partitions():
        try:
            usage = psutil.disk_usage(partition.mountpoint)
            disks.append(DiskInfo(
                device=partition.device,
                mountpoint=partition.mountpoint,
                total=usage.total,
                used=usage.used,
                free=usage.free,
                percent=usage.percent,
                fstype=partition.fstype
            ))
        except PermissionError:
            continue
    return disks


def get_network_info() -> NetworkInfo:
    net_io = psutil.net_io_counters()
    connections = len(psutil.net_connections())
    
    return NetworkInfo(
        bytes_sent=net_io.bytes_sent,
        bytes_recv=net_io.bytes_recv,
        packets_sent=net_io.packets_sent,
        packets_recv=net_io.packets_recv,
        errin=net_io.errin,
        errout=net_io.errout,
        dropin=net_io.dropin,
        dropout=net_io.dropout,
        connections=connections
    )


def get_processes(limit: int = 10) -> List[ProcessInfo]:
    processes = []
    for proc in psutil.process_iter(['pid', 'name', 'username', 'cpu_percent', 
                                      'memory_percent', 'memory_info', 'status', 'create_time']):
        try:
            pinfo = proc.info
            # Skip processes with no name or username
            if not pinfo['name'] or not pinfo['username']:
                continue

            processes.append(ProcessInfo(
                pid=pinfo['pid'],
                name=pinfo['name'],
                username=pinfo['username'],
                cpu_percent=pinfo['cpu_percent'] or 0.0,
                memory_percent=pinfo['memory_percent'] or 0.0,
                memory_mb=(pinfo['memory_info'].rss / 1024 / 1024) if pinfo['memory_info'] else 0.0,
                status=pinfo['status'] or "Unknown",
                create_time=pinfo['create_time'] or 0.0
            ))
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            continue
    
    # 按CPU使用率排序
    processes.sort(key=lambda x: x.cpu_percent, reverse=True)
    return processes[:limit]


# 存储网络历史数据用于计算速度
_network_last = {
    'bytes_sent': 0,
    'bytes_recv': 0,
    'timestamp': time.time()
}


def get_network_speed() -> Dict:
    global _network_last
    current = psutil.net_io_counters()
    now = time.time()
    
    time_delta = now - _network_last['timestamp']
    if time_delta > 0:
        sent_speed = (current.bytes_sent - _network_last['bytes_sent']) / time_delta
        recv_speed = (current.bytes_recv - _network_last['bytes_recv']) / time_delta
    else:
        sent_speed = 0
        recv_speed = 0
    
    _network_last['bytes_sent'] = current.bytes_sent
    _network_last['bytes_recv'] = current.bytes_recv
    _network_last['timestamp'] = now
    
    return {
        'upload_speed': sent_speed,
        'download_speed': recv_speed
    }


@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("static/index.html", "r", encoding="utf-8") as f:
        return HTMLResponse(content=f.read())


@app.get("/api/system")
async def api_system():
    return get_system_info()


@app.get("/api/cpu")
async def api_cpu():
    return get_cpu_info()


@app.get("/api/memory")
async def api_memory():
    return get_memory_info()


@app.get("/api/disk")
async def api_disk():
    return get_disk_info()


@app.get("/api/network")
async def api_network():
    net_info = get_network_info()
    speed = get_network_speed()
    return {**net_info.model_dump(), **speed}


@app.get("/api/processes")
async def api_processes(limit: int = 10):
    return get_processes(limit)


async def get_all_info():
    return {
        "system": get_system_info().model_dump(),
        "cpu": get_cpu_info().model_dump(),
        "memory": get_memory_info().model_dump(),
        "disk": [d.model_dump() for d in get_disk_info()],
        "network": {**get_network_info().model_dump(), **get_network_speed()},
        "processes": [p.model_dump() for p in get_processes(10)],
        "timestamp": time.time()
    }


@app.get("/api/all")
async def api_all():
    return await get_all_info()


# WebSocket连接管理
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass


manager = ConnectionManager()


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        # 发送初始的完整数据
        initial_data = await get_all_info()
        await websocket.send_json(initial_data)

        while True:
            # 只发送实时变化的数据
            data = {
                "cpu": get_cpu_info().model_dump(),
                "memory": get_memory_info().model_dump(),
                "network": {**get_network_info().model_dump(), **get_network_speed()},
                "processes": [p.model_dump() for p in get_processes(10)],
                "timestamp": time.time()
            }
            await websocket.send_json(data)
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
