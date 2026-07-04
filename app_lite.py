import asyncio
import json
import platform
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

import psutil
from fastapi import FastAPI
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

app = FastAPI(title="Server Monitor Lite", version="1.0.0")

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.mount("/static", StaticFiles(directory="static_lite"), name="static")


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


class SystemInfo(BaseModel):
    hostname: str
    platform: str
    platform_version: str
    architecture: str
    processor: str
    boot_time: float
    uptime: str


def get_system_info() -> SystemInfo:
    boot_time = psutil.boot_time()
    uptime_seconds = time.time() - boot_time
    uptime_str = str(timedelta(seconds=int(uptime_seconds)))

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


_net_last = {
    'bytes_sent': 0,
    'bytes_recv': 0,
    'timestamp': time.time()
}


def get_network_speed() -> Dict:
    global _net_last
    current = psutil.net_io_counters()
    now = time.time()
    td = now - _net_last['timestamp']
    if td > 0:
        up = (current.bytes_sent - _net_last['bytes_sent']) / td
        down = (current.bytes_recv - _net_last['bytes_recv']) / td
    else:
        up = down = 0
    _net_last['bytes_sent'] = current.bytes_sent
    _net_last['bytes_recv'] = current.bytes_recv
    _net_last['timestamp'] = now
    return {'upload_speed': up, 'download_speed': down}


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


@app.get("/", response_class=HTMLResponse)
async def read_root():
    with open("static_lite/index.html", "r", encoding="utf-8") as f:
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
    return get_network_info()


@app.get("/api/all")
async def api_all():
    return {
        "system": get_system_info().model_dump(),
        "cpu": get_cpu_info().model_dump(),
        "memory": get_memory_info().model_dump(),
        "disk": [d.model_dump() for d in get_disk_info()],
        "network": {**get_network_info().model_dump(), **get_network_speed()},
        "timestamp": time.time()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)