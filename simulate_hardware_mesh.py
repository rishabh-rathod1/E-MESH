"""
E-MESH Hardware Endpoint & ESP32 Mesh Network Simulator
=========================================================
A comprehensive Python simulation tool with an interactive graphical UI (Tkinter)
that accurately simulates the physical ESP32 mesh nodes communicating over the 
unauthenticated hardware API endpoints:
  - POST /api/v1/mesh/nodes   (Node Heartbeat & Telemetry Upsert)
  - POST /api/v1/mesh/links   (Peer-to-Peer RF Link Quality Reports)
  - POST /api/v1/mesh/sos     (Physical Hardware SOS Button Triggers)

Features:
  1. Configurable number of devices (2 to 25 nodes).
  2. Selectable multi-hop topologies:
     - Hierarchical Tree (ESP-MESH Balanced Multi-Layer)
     - Linear Daisy Chain (Max Hops / Line Topology)
     - Star Network (All direct to Gateway)
     - Dense Redundant Cluster (Multi-Path Mesh)
  3. Realistic channel & sensor parameter simulation:
     - Hop count / layer depth (Layer 1 Gateway, Layer 2 Relays, Layer 3 Leaves)
     - Distance-based RSSI decay and packet loss modeling
     - BMP280 environmental telemetry (temperature, barometric pressure)
     - MPU6050 3-axis IMU acceleration & gyroscope with realistic jerk
     - GPS latitude/longitude geospatial clustering with realistic drift
  4. Real-time Multi-Hop Packet Travel Simulation:
     - Visual packet pulse traveling hop-by-hop along links on an interactive canvas
     - Step-by-step route tracing with latency, link RSSI, and airtime calculations
  5. Dynamic Node Fault Injection & Self-Healing:
     - Power off / kill individual nodes to test backend topology tree healing
     - Hardware SOS emergency distress button trigger
  6. Continuous background heartbeat daemon.
  7. CLI / Headless mode (--headless).
"""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

# Networking
try:
    import requests
except ImportError:
    print("Error: 'requests' library is required. Install via: pip install requests")
    sys.exit(1)

# GUI
try:
    import tkinter as tk
    from tkinter import messagebox, ttk
    TKINTER_AVAILABLE = True
except ImportError:
    TKINTER_AVAILABLE = False


# ── Configuration Defaults ───────────────────────────────────────────────────

DEFAULT_SERVER_URL = "http://127.0.0.1:8000"
BASE_LATITUDE = 19.076090
BASE_LONGITUDE = 72.877426

# Colors for Dark Theme UI
COLOR_BG_DARK = "#111827"
COLOR_BG_CARD = "#1f2937"
COLOR_BG_ELEVATED = "#374151"
COLOR_TEXT_MAIN = "#f9fafb"
COLOR_TEXT_MUTED = "#9ca3af"
COLOR_ACCENT_EMERALD = "#10b981"
COLOR_ACCENT_BLUE = "#3b82f6"
COLOR_ACCENT_AMBER = "#f59e0b"
COLOR_ACCENT_RED = "#ef4444"
COLOR_ACCENT_PURPLE = "#8b5cf6"
COLOR_CANVAS_BG = "#0f172a"


# ── Data Models ───────────────────────────────────────────────────────────────

@dataclass
class SimulatedDevice:
    node_id: str
    display_name: str
    is_gateway: bool
    layer: int                     # Hop depth: 1 = Root Gateway, 2 = Relay, 3 = Leaf
    parent_id: Optional[str]
    battery_level: float = 100.0
    rssi_dbm: float = -45.0
    packet_loss_percent: float = 0.5
    latency_ms: float = 12.0
    is_online: bool = True
    
    # Location
    has_gps: bool = True
    gps_lat: float = BASE_LATITUDE
    gps_lon: float = BASE_LONGITUDE
    gps_alt: float = 14.5
    gps_sats: int = 8
    
    # Sensors (BMP280 & MPU6050)
    temperature_c: float = 28.5
    pressure_hpa: float = 1012.35
    accel_x: int = 0
    accel_y: int = 0
    accel_z: int = 980
    gyro_x: int = 0
    gyro_y: int = 0
    gyro_z: int = 0
    
    # Canvas coordinates (normalized 0.0 to 1.0)
    canvas_x: float = 0.5
    canvas_y: float = 0.5

    def generate_telemetry_jitter(self):
        """Simulates realistic micro-variations across environmental & IMU sensors."""
        if not self.is_online:
            return
        
        # Slight battery discharge
        self.battery_level = max(5.0, round(self.battery_level - random.uniform(0.005, 0.02), 2))
        
        # Environmental fluctuations
        self.temperature_c = round(28.0 + random.uniform(-1.5, 2.5), 2)
        self.pressure_hpa = round(1012.0 + random.uniform(-2.0, 2.0), 2)
        
        # IMU vibration
        self.accel_x = int(random.gauss(0, 25))
        self.accel_y = int(random.gauss(0, 25))
        self.accel_z = int(random.gauss(980, 30))
        self.gyro_x = int(random.gauss(0, 5))
        self.gyro_y = int(random.gauss(0, 5))
        self.gyro_z = int(random.gauss(0, 5))
        
        # Slight GPS wander (within ~5 meters)
        self.gps_lat = round(self.gps_lat + random.uniform(-0.00003, 0.00003), 6)
        self.gps_lon = round(self.gps_lon + random.uniform(-0.00003, 0.00003), 6)


@dataclass
class SimulatedLink:
    source_id: str
    target_id: str
    rssi_dbm: float
    packet_loss_percent: float
    latency_ms: float
    is_active: bool = True


# ── Mesh Topology Engine ──────────────────────────────────────────────────────

class MeshTopologyManager:
    """Manages virtual ESP32 nodes, builds routing graphs, and simulates network physics."""

    def __init__(self, base_url: str = DEFAULT_SERVER_URL):
        self.base_url = base_url.rstrip("/")
        self.devices: Dict[str, SimulatedDevice] = {}
        self.links: List[SimulatedLink] = []
        self.gateway_id: str = "EMESH-GATEWAY"
        self.lock = threading.Lock()

    def set_base_url(self, url: str):
        self.base_url = url.rstrip("/")

    def generate_topology(
        self,
        node_count: int = 6,
        topology_type: str = "tree",
        gateway_name: str = "EMESH-GATEWAY",
        base_rssi: float = -42.0,
        decay_per_layer: float = 14.0,
    ):
        """Generates devices and RF links according to the chosen structural architecture."""
        with self.lock:
            self.devices.clear()
            self.links.clear()
            self.gateway_id = gateway_name

            node_count = max(2, min(node_count, 30))

            # 1. Create Root Gateway (Layer 1)
            gw = SimulatedDevice(
                node_id=gateway_name,
                display_name=f"{gateway_name} (Root)",
                is_gateway=True,
                layer=1,
                parent_id=None,
                battery_level=100.0,
                rssi_dbm=base_rssi,
                packet_loss_percent=0.0,
                latency_ms=2.0,
                gps_lat=BASE_LATITUDE,
                gps_lon=BASE_LONGITUDE,
                canvas_x=0.5,
                canvas_y=0.15,
            )
            self.devices[gateway_name] = gw

            other_ids = [f"EMESH-NODE-{i:02d}" for i in range(1, node_count)]

            if topology_type == "tree":
                self._build_tree_topology(other_ids, base_rssi, decay_per_layer)
            elif topology_type == "line":
                self._build_line_topology(other_ids, base_rssi, decay_per_layer)
            elif topology_type == "star":
                self._build_star_topology(other_ids, base_rssi)
            elif topology_type == "dense":
                self._build_dense_topology(other_ids, base_rssi, decay_per_layer)
            else:
                self._build_tree_topology(other_ids, base_rssi, decay_per_layer)

    def _build_tree_topology(self, other_ids: List[str], base_rssi: float, decay: float):
        """Balanced hierarchical tree: Layer 1 (Root) -> Layer 2 (Relays) -> Layer 3 (Leaves)."""
        num_others = len(other_ids)
        num_relays = max(1, min(math.ceil(num_others / 3), 4))
        relay_ids = other_ids[:num_relays]
        leaf_ids = other_ids[num_relays:]

        # Layer 2: Relays attached to Gateway
        for idx, r_id in enumerate(relay_ids):
            angle = (idx - (num_relays - 1) / 2.0) * 0.35
            cx = 0.5 + (idx - (num_relays - 1) / 2.0) * (0.6 / max(num_relays, 1))
            cx = max(0.18, min(cx, 0.82))

            dev = SimulatedDevice(
                node_id=r_id,
                display_name=f"{r_id} (Relay L2)",
                is_gateway=False,
                layer=2,
                parent_id=self.gateway_id,
                battery_level=round(random.uniform(88.0, 99.0), 1),
                rssi_dbm=round(base_rssi - decay + random.uniform(-3, 3), 1),
                packet_loss_percent=round(random.uniform(0.5, 2.0), 1),
                latency_ms=round(random.uniform(12.0, 18.0), 1),
                gps_lat=BASE_LATITUDE + math.sin(angle) * 0.0015,
                gps_lon=BASE_LONGITUDE + math.cos(angle) * 0.0018,
                canvas_x=cx,
                canvas_y=0.45,
            )
            self.devices[r_id] = dev
            self.links.append(
                SimulatedLink(
                    source_id=r_id,
                    target_id=self.gateway_id,
                    rssi_dbm=dev.rssi_dbm,
                    packet_loss_percent=dev.packet_loss_percent,
                    latency_ms=dev.latency_ms,
                )
            )

        # Layer 3+: Leaves assigned across Relays
        for idx, l_id in enumerate(leaf_ids):
            assigned_relay = relay_ids[idx % len(relay_ids)]
            relay_dev = self.devices[assigned_relay]

            # Layer can deepen if many nodes
            layer = 3 if idx < len(relay_ids) * 3 else 4
            parent_id = assigned_relay

            spread = (idx - (len(leaf_ids) - 1) / 2.0) * (0.75 / max(len(leaf_ids), 1))
            cx = max(0.1, min(0.5 + spread, 0.9))
            cy = 0.75 if layer == 3 else 0.90

            dev = SimulatedDevice(
                node_id=l_id,
                display_name=f"{l_id} (Leaf L{layer})",
                is_gateway=False,
                layer=layer,
                parent_id=parent_id,
                battery_level=round(random.uniform(75.0, 95.0), 1),
                rssi_dbm=round(relay_dev.rssi_dbm - decay + random.uniform(-4, 2), 1),
                packet_loss_percent=round(random.uniform(1.0, 4.5), 1),
                latency_ms=round(random.uniform(20.0, 32.0), 1),
                gps_lat=relay_dev.gps_lat + random.uniform(-0.0008, 0.0008),
                gps_lon=relay_dev.gps_lon + random.uniform(-0.0008, 0.0008),
                canvas_x=cx,
                canvas_y=cy,
            )
            self.devices[l_id] = dev
            self.links.append(
                SimulatedLink(
                    source_id=l_id,
                    target_id=parent_id,
                    rssi_dbm=dev.rssi_dbm,
                    packet_loss_percent=dev.packet_loss_percent,
                    latency_ms=dev.latency_ms,
                )
            )

    def _build_line_topology(self, other_ids: List[str], base_rssi: float, decay: float):
        """Linear Daisy Chain: N0 (GW) -> N1 -> N2 -> N3 -> N4..."""
        prev_id = self.gateway_id
        prev_rssi = base_rssi
        total = len(other_ids) + 1

        for idx, nid in enumerate(other_ids):
            layer = idx + 2
            rssi = round(prev_rssi - (decay * 0.7) + random.uniform(-2, 2), 1)
            cx = 0.15 + (idx + 1) * (0.7 / total)
            cy = 0.25 + (idx + 1) * (0.65 / total)

            dev = SimulatedDevice(
                node_id=nid,
                display_name=f"{nid} (Hop {layer})",
                is_gateway=False,
                layer=layer,
                parent_id=prev_id,
                battery_level=round(random.uniform(70.0, 96.0), 1),
                rssi_dbm=rssi,
                packet_loss_percent=round(random.uniform(0.8, 3.0), 1),
                latency_ms=round(10.0 + idx * 8.0, 1),
                gps_lat=BASE_LATITUDE + (idx + 1) * 0.0007,
                gps_lon=BASE_LONGITUDE + (idx + 1) * 0.0009,
                canvas_x=cx,
                canvas_y=cy,
            )
            self.devices[nid] = dev
            self.links.append(
                SimulatedLink(
                    source_id=nid,
                    target_id=prev_id,
                    rssi_dbm=rssi,
                    packet_loss_percent=dev.packet_loss_percent,
                    latency_ms=dev.latency_ms,
                )
            )
            prev_id = nid
            prev_rssi = rssi

    def _build_star_topology(self, other_ids: List[str], base_rssi: float):
        """Star Topology: Every node connected directly to the Root Gateway."""
        total = len(other_ids)
        for idx, nid in enumerate(other_ids):
            angle = (2.0 * math.pi * idx) / max(total, 1)
            dist = 0.32

            dev = SimulatedDevice(
                node_id=nid,
                display_name=f"{nid} (Star)",
                is_gateway=False,
                layer=2,
                parent_id=self.gateway_id,
                battery_level=round(random.uniform(80.0, 99.0), 1),
                rssi_dbm=round(base_rssi - 8.0 + random.uniform(-4, 4), 1),
                packet_loss_percent=round(random.uniform(0.5, 2.0), 1),
                latency_ms=round(random.uniform(8.0, 16.0), 1),
                gps_lat=BASE_LATITUDE + math.sin(angle) * 0.0015,
                gps_lon=BASE_LONGITUDE + math.cos(angle) * 0.0015,
                canvas_x=0.5 + math.cos(angle) * dist,
                canvas_y=0.5 + math.sin(angle) * dist * 0.8,
            )
            self.devices[nid] = dev
            self.links.append(
                SimulatedLink(
                    source_id=nid,
                    target_id=self.gateway_id,
                    rssi_dbm=dev.rssi_dbm,
                    packet_loss_percent=dev.packet_loss_percent,
                    latency_ms=dev.latency_ms,
                )
            )

    def _build_dense_topology(self, other_ids: List[str], base_rssi: float, decay: float):
        """Dense Multi-Path Mesh with redundant secondary links."""
        self._build_tree_topology(other_ids, base_rssi, decay)
        # Add lateral redundant peer links between relays/leaves
        non_gw = [d for d in self.devices.values() if not d.is_gateway]
        for i in range(len(non_gw) - 1):
            if random.random() > 0.5:
                src = non_gw[i]
                tgt = non_gw[i + 1]
                self.links.append(
                    SimulatedLink(
                        source_id=src.node_id,
                        target_id=tgt.node_id,
                        rssi_dbm=round(random.uniform(-75.0, -60.0), 1),
                        packet_loss_percent=round(random.uniform(1.0, 3.5), 1),
                        latency_ms=round(random.uniform(15.0, 25.0), 1),
                    )
                )

    def get_route_to_gateway(self, origin_id: str) -> List[str]:
        """Finds multi-hop path from origin node up to Root Gateway."""
        route = [origin_id]
        curr_id = origin_id
        visited = {origin_id}

        while curr_id in self.devices:
            curr_dev = self.devices[curr_id]
            if curr_dev.is_gateway or not curr_dev.parent_id:
                break
            parent = curr_dev.parent_id
            if parent in visited:
                break
            route.append(parent)
            visited.add(parent)
            curr_id = parent

        return route


# ── HTTP Hardware API Client ──────────────────────────────────────────────────

class HardwareApiClient:
    """Dispatches raw HTTP payloads to the FastAPI /api/v1/mesh endpoints."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def send_node_heartbeat(self, dev: SimulatedDevice) -> Tuple[int, Dict[str, Any]]:
        """POST /api/v1/mesh/nodes"""
        url = f"{self.base_url}/api/v1/mesh/nodes"
        payload = {
            "node_id": dev.node_id,
            "display_name": dev.display_name,
            "name": dev.display_name,
            "is_gateway": dev.is_gateway,
            "battery_level": dev.battery_level,
            "signal_quality": dev.rssi_dbm,
            "hop_count": dev.layer,  # Used by backend for tree depth calculation
            "has_gps": dev.has_gps,
            "gps_lat": dev.gps_lat,
            "gps_lon": dev.gps_lon,
            "gps_alt_m": dev.gps_alt,
            "gps_sats": dev.gps_sats,
            "temperature_c": dev.temperature_c,
            "pressure_hpa": dev.pressure_hpa,
            "accel_x": dev.accel_x,
            "accel_y": dev.accel_y,
            "accel_z": dev.accel_z,
            "gyro_x": dev.gyro_x,
            "gyro_y": dev.gyro_y,
            "gyro_z": dev.gyro_z,
        }
        try:
            resp = self.session.post(url, json=payload, timeout=4.0)
            return resp.status_code, resp.json() if resp.status_code in (200, 201) else {"error": resp.text}
        except Exception as e:
            return 0, {"error": str(e)}

    def send_link_report(self, link: SimulatedLink) -> Tuple[int, Dict[str, Any]]:
        """POST /api/v1/mesh/links"""
        url = f"{self.base_url}/api/v1/mesh/links"
        payload = {
            "source_node_id": link.source_id,
            "target_node_id": link.target_id,
            "rssi_dbm": link.rssi_dbm,
            "packet_loss_percent": link.packet_loss_percent,
            "latency_ms": link.latency_ms,
        }
        try:
            resp = self.session.post(url, json=payload, timeout=4.0)
            return resp.status_code, resp.json() if resp.status_code in (200, 201) else {"error": resp.text}
        except Exception as e:
            return 0, {"error": str(e)}

    def send_hardware_sos(self, origin_id: str, lat: float, lon: float, notes: str = "Hardware Emergency") -> Tuple[int, Dict[str, Any]]:
        """POST /api/v1/mesh/sos"""
        url = f"{self.base_url}/api/v1/mesh/sos"
        payload = {
            "origin_node_id": origin_id,
            "people_count": random.randint(1, 4),
            "notes": f"{notes} (Simulated ESP32 Button on {origin_id})",
            "latitude": lat,
            "longitude": lon,
        }
        try:
            resp = self.session.post(url, json=payload, timeout=4.0)
            return resp.status_code, resp.json() if resp.status_code in (200, 201) else {"error": resp.text}
        except Exception as e:
            return 0, {"error": str(e)}

    def ping_backend(self) -> Tuple[bool, str]:
        """GET /api/v1/health"""
        url = f"{self.base_url}/api/v1/health"
        try:
            resp = self.session.get(url, timeout=3.0)
            if resp.status_code == 200:
                return True, f"Online ({resp.status_code} OK)"
            return False, f"HTTP {resp.status_code}"
        except Exception as e:
            return False, str(e)


# ── Interactive Tkinter UI Simulator ──────────────────────────────────────────

class HardwareMeshSimulatorUI:
    """Tkinter Graphical User Interface for real-time mesh simulation and packet travel."""

    def __init__(self, root: tk.Tk, server_url: str = DEFAULT_SERVER_URL):
        self.root = root
        self.root.title("E-MESH | Hardware ESP32 Mesh & Packet Travel Simulator")
        self.root.geometry("1240x820")
        self.root.minsize(1050, 700)
        self.root.configure(bg=COLOR_BG_DARK)

        # State
        self.topology = MeshTopologyManager(server_url)
        self.api = HardwareApiClient(server_url)
        self.is_heartbeat_running = False
        self.heartbeat_thread: Optional[threading.Thread] = None
        self.heartbeat_interval_sec = 3.0
        self.selected_node_id: Optional[str] = None
        self.animating_packet = False

        # Initialize standard 6-node tree
        self.topology.generate_topology(node_count=6, topology_type="tree")

        self._configure_styles()
        self._build_layout()
        self._draw_topology_map()

        # Check backend connection on boot
        self.root.after(400, self._check_backend_status)

    def _configure_styles(self):
        style = ttk.Style()
        style.theme_use("clam")

        style.configure(".", background=COLOR_BG_CARD, foreground=COLOR_TEXT_MAIN, font=("Segoe UI", 9))
        style.configure("TFrame", background=COLOR_BG_DARK)
        style.configure("Card.TFrame", background=COLOR_BG_CARD, relief="flat")
        style.configure("TLabel", background=COLOR_BG_CARD, foreground=COLOR_TEXT_MAIN)
        style.configure("Header.TLabel", font=("Segoe UI", 11, "bold"), foreground=COLOR_TEXT_MAIN)
        style.configure("Muted.TLabel", font=("Segoe UI", 8), foreground=COLOR_TEXT_MUTED)
        style.configure("Badge.TLabel", font=("Consolas", 8, "bold"), foreground=COLOR_ACCENT_EMERALD)

        style.configure(
            "Primary.TButton",
            font=("Segoe UI", 9, "bold"),
            background=COLOR_ACCENT_BLUE,
            foreground="#ffffff",
            borderwidth=0,
            padding=6,
        )
        style.map("Primary.TButton", background=[("active", "#2563eb"), ("disabled", "#4b5563")])

        style.configure(
            "Success.TButton",
            font=("Segoe UI", 9, "bold"),
            background=COLOR_ACCENT_EMERALD,
            foreground="#ffffff",
            borderwidth=0,
            padding=6,
        )
        style.map("Success.TButton", background=[("active", "#059669")])

        style.configure(
            "Danger.TButton",
            font=("Segoe UI", 9, "bold"),
            background=COLOR_ACCENT_RED,
            foreground="#ffffff",
            borderwidth=0,
            padding=6,
        )
        style.map("Danger.TButton", background=[("active", "#dc2626")])

    def _build_layout(self):
        # ── Top Bar ───────────────────────────────────────────────────────────
        top_bar = tk.Frame(self.root, bg=COLOR_BG_CARD, height=52)
        top_bar.pack(fill=tk.X, side=tk.TOP, padx=10, pady=(10, 5))

        tk.Label(
            top_bar,
            text="📡 ESP32 HARDWARE MESH SIMULATOR",
            font=("Segoe UI", 12, "bold"),
            bg=COLOR_BG_CARD,
            fg=COLOR_TEXT_MAIN,
        ).pack(side=tk.LEFT, padx=15, pady=10)

        # Server URL Entry
        tk.Label(top_bar, text="Backend API:", bg=COLOR_BG_CARD, fg=COLOR_TEXT_MUTED).pack(side=tk.LEFT, padx=(20, 5))
        self.entry_url = tk.Entry(top_bar, width=24, font=("Consolas", 9), bg=COLOR_BG_ELEVATED, fg=COLOR_TEXT_MAIN, insertbackground="#fff", bd=1)
        self.entry_url.insert(0, self.topology.base_url)
        self.entry_url.pack(side=tk.LEFT, padx=5)

        self.btn_ping = ttk.Button(top_bar, text="Ping Connection", command=self._check_backend_status)
        self.btn_ping.pack(side=tk.LEFT, padx=6)

        self.lbl_server_status = tk.Label(top_bar, text="Checking...", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_ACCENT_AMBER)
        self.lbl_server_status.pack(side=tk.LEFT, padx=10)

        # Active Node Count Indicator
        self.lbl_node_count_badge = tk.Label(
            top_bar,
            text="NODES: 6 ONLINE",
            font=("Consolas", 9, "bold"),
            bg="#064e3b",
            fg=COLOR_ACCENT_EMERALD,
            padx=10,
            pady=4,
        )
        self.lbl_node_count_badge.pack(side=tk.RIGHT, padx=15)

        # ── Main Content Split (Left Controls, Right Visualizer & Console) ───
        content = tk.Frame(self.root, bg=COLOR_BG_DARK)
        content.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # ── Left Column: Controls (Width 360px) ──────────────────────────────
        left_col = tk.Frame(content, bg=COLOR_BG_CARD, width=370)
        left_col.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 6), pady=0)
        left_col.pack_propagate(False)

        # Notebook for Control Tabs
        nb = ttk.Notebook(left_col)
        nb.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        tab_topology = ttk.Frame(nb)
        tab_packet = ttk.Frame(nb)
        tab_faults = ttk.Frame(nb)

        nb.add(tab_topology, text="1. Topology Setup")
        nb.add(tab_packet, text="2. Packet Travel")
        nb.add(tab_faults, text="3. Fault & SOS")

        self._build_tab_topology(tab_topology)
        self._build_tab_packet(tab_packet)
        self._build_tab_faults(tab_faults)

        # ── Right Column: Canvas Map (Top) & Live Logs (Bottom) ──────────────
        right_col = tk.Frame(content, bg=COLOR_BG_DARK)
        right_col.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Top: Canvas Network Map
        map_header = tk.Frame(right_col, bg=COLOR_BG_CARD)
        map_header.pack(fill=tk.X, pady=(0, 2))
        tk.Label(
            map_header,
            text="ESP-WIFI-MESH TOPOLOGY MAP (Real Hardware Endpoint Emulation)",
            font=("Segoe UI", 9, "bold"),
            bg=COLOR_BG_CARD,
            fg=COLOR_TEXT_MAIN,
        ).pack(side=tk.LEFT, padx=10, pady=6)
        tk.Label(
            map_header,
            text="🟢 Gateway (L1)   🔵 Relays (L2)   🟣 Leaves (L3+)   Lines = RF Links",
            font=("Segoe UI", 8),
            bg=COLOR_BG_CARD,
            fg=COLOR_TEXT_MUTED,
        ).pack(side=tk.RIGHT, padx=10)

        self.canvas = tk.Canvas(right_col, bg=COLOR_CANVAS_BG, highlightthickness=1, highlightbackground=COLOR_BG_ELEVATED)
        self.canvas.pack(fill=tk.BOTH, expand=True, pady=(0, 6))
        self.canvas.bind("<Configure>", lambda e: self._draw_topology_map())
        self.canvas.bind("<Button-1>", self._on_canvas_click)

        # Bottom: Console Output Log
        log_frame = tk.Frame(right_col, bg=COLOR_BG_CARD, height=210)
        log_frame.pack(fill=tk.X)
        log_frame.pack_propagate(False)

        log_top = tk.Frame(log_frame, bg=COLOR_BG_CARD)
        log_top.pack(fill=tk.X, padx=8, pady=(4, 2))
        tk.Label(log_top, text="LIVE HTTP COMMUNICATOR CONSOLE", font=("Segoe UI", 8, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MUTED).pack(side=tk.LEFT)

        btn_clear = tk.Button(
            log_top,
            text="Clear Log",
            font=("Segoe UI", 7),
            bg=COLOR_BG_ELEVATED,
            fg=COLOR_TEXT_MAIN,
            bd=0,
            padx=6,
            command=self._clear_logs,
        )
        btn_clear.pack(side=tk.RIGHT)

        self.log_text = tk.Text(
            log_frame,
            bg="#090d16",
            fg="#e2e8f0",
            font=("Consolas", 8),
            bd=0,
            padx=8,
            pady=4,
            wrap=tk.WORD,
        )
        self.log_text.pack(fill=tk.BOTH, expand=True)

        # Color tags for log text
        self.log_text.tag_config("SUCCESS", foreground=COLOR_ACCENT_EMERALD)
        self.log_text.tag_config("INFO", foreground=COLOR_ACCENT_BLUE)
        self.log_text.tag_config("WARN", foreground=COLOR_ACCENT_AMBER)
        self.log_text.tag_config("ERROR", foreground=COLOR_ACCENT_RED)
        self.log_text.tag_config("ROUTE", foreground=COLOR_ACCENT_PURPLE)

    # ── TAB 1: Topology Setup ─────────────────────────────────────────────────

    def _build_tab_topology(self, parent: ttk.Frame):
        p = tk.Frame(parent, bg=COLOR_BG_CARD)
        p.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        # Node count spinbox
        tk.Label(p, text="Number of Mesh Nodes:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        f_count = tk.Frame(p, bg=COLOR_BG_CARD)
        f_count.pack(fill=tk.X, pady=(0, 8))

        self.spin_node_count = tk.Spinbox(f_count, from_=2, to=25, width=6, font=("Consolas", 10), bg=COLOR_BG_ELEVATED, fg=COLOR_TEXT_MAIN)
        self.spin_node_count.delete(0, tk.END)
        self.spin_node_count.insert(0, "6")
        self.spin_node_count.pack(side=tk.LEFT)

        tk.Label(f_count, text="(Includes 1 Root Gateway)", font=("Segoe UI", 8), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MUTED).pack(side=tk.LEFT, padx=8)

        # Topology layout pattern
        tk.Label(p, text="Mesh Topology Architecture:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        self.combo_topo = ttk.Combobox(
            p,
            values=[
                "Hierarchical Tree (Balanced Multi-Hop)",
                "Linear Daisy Chain (Line Topology)",
                "Star Network (Direct to Gateway)",
                "Dense Redundant Cluster (Multi-Path)",
            ],
            state="readonly",
        )
        self.combo_topo.current(0)
        self.combo_topo.pack(fill=tk.X, pady=(0, 8))

        # Radio channel controls
        tk.Label(p, text="Root Signal RSSI (dBm):", bg=COLOR_BG_CARD, fg=COLOR_TEXT_MUTED).pack(anchor=tk.W)
        self.scale_rssi = tk.Scale(p, from_=-30, to=-90, orient=tk.HORIZONTAL, bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN, highlightthickness=0)
        self.scale_rssi.set(-42)
        self.scale_rssi.pack(fill=tk.X, pady=(0, 6))

        tk.Label(p, text="Heartbeat Interval (Seconds):", bg=COLOR_BG_CARD, fg=COLOR_TEXT_MUTED).pack(anchor=tk.W)
        self.spin_interval = tk.Spinbox(p, from_=1.0, to=15.0, increment=0.5, width=6, font=("Consolas", 10), bg=COLOR_BG_ELEVATED, fg=COLOR_TEXT_MAIN)
        self.spin_interval.delete(0, tk.END)
        self.spin_interval.insert(0, "3.0")
        self.spin_interval.pack(anchor=tk.W, pady=(0, 10))

        # Action Buttons
        btn_generate = ttk.Button(p, text="1. ⚙️ Generate Virtual Mesh", style="Primary.TButton", command=self._action_generate_mesh)
        btn_generate.pack(fill=tk.X, pady=4)

        btn_deploy = ttk.Button(p, text="2. 📡 Deploy Mesh to Backend API", style="Primary.TButton", command=self._action_deploy_mesh)
        btn_deploy.pack(fill=tk.X, pady=4)

        self.btn_daemon = ttk.Button(p, text="3. ▶ Start Continuous Heartbeats", style="Success.TButton", command=self._action_toggle_daemon)
        self.btn_daemon.pack(fill=tk.X, pady=(10, 4))

        # Instructions Callout
        lbl_info = tk.Label(
            p,
            text="• Sends real heartbeats to POST /api/v1/mesh/nodes\n• Reports RF links to POST /api/v1/mesh/links\n• Appears in NOC Topology as REAL hardware!",
            font=("Segoe UI", 8),
            bg=COLOR_BG_ELEVATED,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT,
            padx=8,
            pady=6,
        )
        lbl_info.pack(fill=tk.X, pady=(12, 0))

    # ── TAB 2: Packet Travel ──────────────────────────────────────────────────

    def _build_tab_packet(self, parent: ttk.Frame):
        p = tk.Frame(parent, bg=COLOR_BG_CARD)
        p.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        tk.Label(p, text="Source Origin Node:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        self.combo_src_node = ttk.Combobox(p, state="readonly")
        self.combo_src_node.pack(fill=tk.X, pady=(0, 8))

        tk.Label(p, text="Destination:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        self.lbl_dest_display = tk.Label(p, text="EMESH-GATEWAY (Root Node -> Backend Server)", font=("Consolas", 8, "bold"), bg=COLOR_BG_ELEVATED, fg=COLOR_ACCENT_EMERALD, pady=6)
        self.lbl_dest_display.pack(fill=tk.X, pady=(0, 8))

        tk.Label(p, text="Packet Data Type:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        self.combo_packet_type = ttk.Combobox(
            p,
            values=[
                "Sensor Telemetry (BMP280 Temp/Pressure + IMU)",
                "Physical SOS Emergency Beacon",
                "Periodic Mesh Status Ping",
            ],
            state="readonly",
        )
        self.combo_packet_type.current(0)
        self.combo_packet_type.pack(fill=tk.X, pady=(0, 10))

        # Route Preview Box
        tk.Label(p, text="Computed Multi-Hop Path:", font=("Segoe UI", 8, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MUTED).pack(anchor=tk.W)
        self.lbl_route_preview = tk.Label(
            p,
            text="(Select a node to inspect route)",
            font=("Consolas", 8),
            bg=COLOR_BG_ELEVATED,
            fg=COLOR_ACCENT_BLUE,
            justify=tk.LEFT,
            wraplength=320,
            pady=8,
        )
        self.lbl_route_preview.pack(fill=tk.X, pady=(0, 12))

        # Launch Button
        self.btn_send_packet = ttk.Button(
            p,
            text="🚀 Transmit Packet & Trace Hops",
            style="Primary.TButton",
            command=self._action_simulate_packet_travel,
        )
        self.btn_send_packet.pack(fill=tk.X, pady=6)

        # Update comboboxes
        self._refresh_node_combos()
        self.combo_src_node.bind("<<ComboboxSelected>>", self._on_src_node_selected)

    # ── TAB 3: Fault Injection & SOS ──────────────────────────────────────────

    def _build_tab_faults(self, parent: ttk.Frame):
        p = tk.Frame(parent, bg=COLOR_BG_CARD)
        p.pack(fill=tk.BOTH, expand=True, padx=8, pady=8)

        tk.Label(p, text="Target Node for Fault Simulation:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        self.combo_target_node = ttk.Combobox(p, state="readonly")
        self.combo_target_node.pack(fill=tk.X, pady=(0, 10))

        # Actions
        btn_power_off = ttk.Button(p, text="💥 Power Off / Disconnect Node", style="Danger.TButton", command=self._action_power_off_node)
        btn_power_off.pack(fill=tk.X, pady=4)

        btn_power_on = ttk.Button(p, text="⚡ Reconnect / Power On Node", style="Success.TButton", command=self._action_power_on_node)
        btn_power_on.pack(fill=tk.X, pady=4)

        tk.Frame(p, height=1, bg=COLOR_BG_ELEVATED).pack(fill=tk.X, pady=12)

        tk.Label(p, text="Hardware Physical Button Event:", font=("Segoe UI", 9, "bold"), bg=COLOR_BG_CARD, fg=COLOR_TEXT_MAIN).pack(anchor=tk.W, pady=(4, 2))
        btn_sos = ttk.Button(
            p,
            text="🚨 Trigger Hardware SOS Button",
            style="Danger.TButton",
            command=self._action_trigger_hardware_sos,
        )
        btn_sos.pack(fill=tk.X, pady=4)

        lbl_sos_desc = tk.Label(
            p,
            text="Simulates physical pushbutton interrupt on the selected node. Fires POST /api/v1/mesh/sos and creates an instant critical Incident on the Admin UI.",
            font=("Segoe UI", 8),
            bg=COLOR_BG_CARD,
            fg=COLOR_TEXT_MUTED,
            justify=tk.LEFT,
            wraplength=320,
        )
        lbl_sos_desc.pack(fill=tk.X, pady=(6, 0))

        self._refresh_node_combos()

    # ── Canvas Drawing ────────────────────────────────────────────────────────

    def _draw_topology_map(self, active_hop: Optional[Tuple[str, str]] = None):
        """Draws nodes and link lines onto the Tkinter canvas."""
        self.canvas.delete("all")
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()

        if w < 50 or h < 50:
            return

        # 1. Draw Links
        for link in self.topology.links:
            src = self.topology.devices.get(link.source_id)
            tgt = self.topology.devices.get(link.target_id)
            if not src or not tgt:
                continue

            sx, sy = src.canvas_x * w, src.canvas_y * h
            tx, ty = tgt.canvas_x * w, tgt.canvas_y * h

            # Check if this link is currently transmitting
            is_active_link = (
                active_hop is not None
                and ((active_hop[0] == src.node_id and active_hop[1] == tgt.node_id)
                     or (active_hop[1] == src.node_id and active_hop[0] == tgt.node_id))
            )

            if is_active_link:
                line_color = COLOR_ACCENT_PURPLE
                line_width = 4
            elif not src.is_online or not tgt.is_online:
                line_color = "#334155"
                line_width = 1
            elif link.rssi_dbm > -60:
                line_color = "#047857"  # Strong emerald
                line_width = 2
            elif link.rssi_dbm > -75:
                line_color = "#1d4ed8"  # Medium blue
                line_width = 2
            else:
                line_color = "#b45309"  # Weak amber
                line_width = 1

            self.canvas.create_line(sx, sy, tx, ty, fill=line_color, width=line_width, dash=(3, 2) if is_active_link else ())

            # Draw RSSI label on link midpoint
            if src.is_online and tgt.is_online:
                mx, my = (sx + tx) / 2.0, (sy + ty) / 2.0
                self.canvas.create_text(mx, my, text=f"{link.rssi_dbm:.0f}dBm", fill=COLOR_TEXT_MUTED, font=("Consolas", 7))

        # 2. Draw Nodes
        node_radius = 24
        for dev in self.topology.devices.values():
            x = dev.canvas_x * w
            y = dev.canvas_y * h

            is_selected = (self.selected_node_id == dev.node_id)

            # Outer ring if selected
            if is_selected:
                self.canvas.create_oval(
                    x - node_radius - 4, y - node_radius - 4,
                    x + node_radius + 4, y + node_radius + 4,
                    outline="#ffffff", width=2
                )

            # Node body color
            if not dev.is_online:
                fill_color = "#374151"
                outline_color = COLOR_ACCENT_RED
            elif dev.is_gateway:
                fill_color = "#065f46"
                outline_color = COLOR_ACCENT_EMERALD
            elif dev.layer == 2:
                fill_color = "#1e40af"
                outline_color = COLOR_ACCENT_BLUE
            else:
                fill_color = "#5b21b6"
                outline_color = COLOR_ACCENT_PURPLE

            self.canvas.create_oval(
                x - node_radius, y - node_radius,
                x + node_radius, y + node_radius,
                fill=fill_color, outline=outline_color, width=2,
                tags=("node", dev.node_id)
            )

            # Center text (Node short name)
            short_name = "GW" if dev.is_gateway else f"N{dev.node_id.split('-')[-1]}"
            self.canvas.create_text(
                x, y - 4,
                text=short_name,
                fill="#ffffff",
                font=("Segoe UI", 9, "bold"),
                tags=("node", dev.node_id)
            )

            # Layer / Hop tag
            self.canvas.create_text(
                x, y + 8,
                text=f"L{dev.layer}",
                fill=COLOR_TEXT_MUTED,
                font=("Consolas", 7),
                tags=("node", dev.node_id)
            )

            # Bottom label (Node ID & Battery)
            status_text = "OFFLINE" if not dev.is_online else f"{dev.battery_level:.0f}%"
            self.canvas.create_text(
                x, y + node_radius + 10,
                text=f"{dev.node_id}\n{status_text}",
                fill="#cbd5e1" if dev.is_online else COLOR_ACCENT_RED,
                font=("Segoe UI", 7),
                justify=tk.CENTER
            )

    def _on_canvas_click(self, event):
        """Clicking on a canvas node selects it for packet travel and fault injection."""
        w = self.canvas.winfo_width()
        h = self.canvas.winfo_height()

        for dev in self.topology.devices.values():
            x = dev.canvas_x * w
            y = dev.canvas_y * h
            if (event.x - x) ** 2 + (event.y - y) ** 2 <= 26 ** 2:
                self.selected_node_id = dev.node_id
                self.combo_src_node.set(dev.node_id)
                self.combo_target_node.set(dev.node_id)
                self._update_route_preview(dev.node_id)
                self._draw_topology_map()
                self._log(f"Selected node: {dev.node_id} (Layer {dev.layer}, RSSI: {dev.rssi_dbm} dBm)", "INFO")
                break

    # ── Actions & Handlers ────────────────────────────────────────────────────

    def _action_generate_mesh(self):
        try:
            count = int(self.spin_node_count.get())
        except ValueError:
            count = 6

        topo_raw = self.combo_topo.get().lower()
        if "chain" in topo_raw or "line" in topo_raw:
            mode = "line"
        elif "star" in topo_raw:
            mode = "star"
        elif "dense" in topo_raw:
            mode = "dense"
        else:
            mode = "tree"

        rssi = float(self.scale_rssi.get())
        self.topology.generate_topology(node_count=count, topology_type=mode, base_rssi=rssi)
        self._refresh_node_combos()
        self._draw_topology_map()

        online_count = sum(1 for d in self.topology.devices.values() if d.is_online)
        self.lbl_node_count_badge.config(text=f"NODES: {online_count} ONLINE")
        self._log(f"Generated {count}-device virtual mesh (Architecture: {mode.upper()}).", "INFO")

    def _action_deploy_mesh(self):
        """Pushes all devices and links to the backend via background thread."""
        self._update_api_client_url()

        def worker():
            self._log(f"--- Deploying Mesh to {self.api.base_url} ---", "INFO")
            success_nodes = 0
            # 1. Register Nodes
            for dev in self.topology.devices.values():
                code, resp = self.api.send_node_heartbeat(dev)
                if code in (200, 201):
                    success_nodes += 1
                else:
                    self._log(f"Failed to register node {dev.node_id}: {resp}", "ERROR")

            self._log(f"Registered {success_nodes}/{len(self.topology.devices)} nodes on hardware endpoint.", "SUCCESS")

            # 2. Register RF Links
            success_links = 0
            for link in self.topology.links:
                code, resp = self.api.send_link_report(link)
                if code in (200, 201):
                    success_links += 1
                else:
                    self._log(f"Failed to register link {link.source_id}->{link.target_id}: {resp}", "WARN")

            self._log(f"Registered {success_links}/{len(self.topology.links)} RF links on hardware endpoint.", "SUCCESS")
            self._log("Mesh deployment completed! Check the Admin NOC Topology map.", "SUCCESS")

        threading.Thread(target=worker, daemon=True).start()

    def _action_toggle_daemon(self):
        if self.is_heartbeat_running:
            self.is_heartbeat_running = False
            self.btn_daemon.config(text="3. ▶ Start Continuous Heartbeats", style="Success.TButton")
            self._log("Heartbeat daemon STOPPED.", "WARN")
        else:
            try:
                self.heartbeat_interval_sec = max(1.0, float(self.spin_interval.get()))
            except ValueError:
                self.heartbeat_interval_sec = 3.0

            self.is_heartbeat_running = True
            self.btn_daemon.config(text="3. ⏹ Stop Heartbeats", style="Danger.TButton")
            self._log(f"Heartbeat daemon STARTED (Interval: {self.heartbeat_interval_sec}s).", "SUCCESS")

            self.heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
            self.heartbeat_thread.start()

    def _heartbeat_loop(self):
        """Background thread sending continuous heartbeats to keep nodes alive in NOC."""
        while self.is_heartbeat_running:
            self._update_api_client_url()
            online_nodes = [d for d in self.topology.devices.values() if d.is_online]

            for dev in online_nodes:
                if not self.is_heartbeat_running:
                    break
                dev.generate_telemetry_jitter()
                self.api.send_node_heartbeat(dev)

            # Re-send active links
            for link in self.topology.links:
                if not self.is_heartbeat_running:
                    break
                self.api.send_link_report(link)

            time.sleep(self.heartbeat_interval_sec)

    def _action_simulate_packet_travel(self):
        """Simulates hop-by-hop packet transmission with visual canvas animation."""
        if self.animating_packet:
            return

        src_id = self.combo_src_node.get()
        if not src_id or src_id not in self.topology.devices:
            messagebox.showwarning("Select Node", "Please select a valid origin node.")
            return

        src_dev = self.topology.devices[src_id]
        if not src_dev.is_online:
            messagebox.showerror("Node Offline", f"Node {src_id} is currently POWERED OFF.")
            return

        route = self.topology.get_route_to_gateway(src_id)
        if len(route) < 1:
            self._log(f"No route found from {src_id} to gateway.", "ERROR")
            return

        self.animating_packet = True
        self.btn_send_packet.config(state=tk.DISABLED)

        packet_type = self.combo_packet_type.get()

        def worker():
            self._log(f"\n=======================================================", "ROUTE")
            self._log(f"🚀 PACKET TRAVEL INITIATED: {src_id} -> {self.topology.gateway_id}", "ROUTE")
            self._log(f"Payload Type: {packet_type}", "ROUTE")
            self._log(f"Route Path: {' -> '.join(route)} ({len(route)-1} Hops)", "ROUTE")
            self._log(f"=======================================================", "ROUTE")

            total_latency = 0.0

            for hop_idx in range(len(route) - 1):
                curr = route[hop_idx]
                nxt = route[hop_idx + 1]

                # Find link stats
                link = next((l for l in self.topology.links if (l.source_id == curr and l.target_id == nxt) or (l.source_id == nxt and l.target_id == curr)), None)
                hop_rssi = link.rssi_dbm if link else -65.0
                hop_latency = link.latency_ms if link else 15.0
                total_latency += hop_latency

                # Animate on canvas (purple line)
                self.root.after(0, lambda c=curr, n=nxt: self._draw_topology_map(active_hop=(c, n)))

                self._log(f"  [HOP {hop_idx+1}] {curr} -> {nxt} | RSSI: {hop_rssi:.1f} dBm, Delay: {hop_latency:.1f} ms", "INFO")
                time.sleep(0.45)

            # Packet reaches gateway! Dispatch to actual backend endpoint
            self.root.after(0, lambda: self._draw_topology_map(active_hop=None))

            if "SOS" in packet_type:
                code, resp = self.api.send_hardware_sos(src_id, src_dev.gps_lat, src_dev.gps_lon, notes="Multi-hop SOS Packet")
                endpoint_msg = f"POST /mesh/sos -> {code} Created"
            else:
                code, resp = self.api.send_node_heartbeat(src_dev)
                endpoint_msg = f"POST /mesh/nodes -> {code} Ingested"

            self._log(f"✓ PACKET ARRIVED AT ROOT GATEWAY & INGESTED BY BACKEND!", "SUCCESS")
            self._log(f"  Cumulative Multi-Hop Latency: {total_latency:.1f} ms | {endpoint_msg}", "SUCCESS")
            self._log(f"=======================================================\n", "ROUTE")

            self.animating_packet = False
            self.root.after(0, lambda: self.btn_send_packet.config(state=tk.NORMAL))

        threading.Thread(target=worker, daemon=True).start()

    def _action_power_off_node(self):
        target = self.combo_target_node.get()
        if not target or target not in self.topology.devices:
            return
        dev = self.topology.devices[target]
        dev.is_online = False
        self._draw_topology_map()
        self._log(f"⚡ [FAULT INJECTION] Power turned OFF on {target}. Node dropped offline.", "WARN")

        # Update badge
        online_count = sum(1 for d in self.topology.devices.values() if d.is_online)
        self.lbl_node_count_badge.config(text=f"NODES: {online_count} ONLINE")

    def _action_power_on_node(self):
        target = self.combo_target_node.get()
        if not target or target not in self.topology.devices:
            return
        dev = self.topology.devices[target]
        dev.is_online = True
        self.api.send_node_heartbeat(dev)
        self._draw_topology_map()
        self._log(f"⚡ [SELF-HEALING] Power RESTORED on {target}. Reconnected to mesh.", "SUCCESS")

        online_count = sum(1 for d in self.topology.devices.values() if d.is_online)
        self.lbl_node_count_badge.config(text=f"NODES: {online_count} ONLINE")

    def _action_trigger_hardware_sos(self):
        target = self.combo_target_node.get()
        if not target or target not in self.topology.devices:
            target = list(self.topology.devices.keys())[0]

        dev = self.topology.devices[target]
        self._update_api_client_url()

        def worker():
            self._log(f"🚨 [PHYSICAL SOS] Pushbutton pressed on node {target}!", "ERROR")
            code, resp = self.api.send_hardware_sos(target, dev.gps_lat, dev.gps_lon, notes="Emergency SOS Pushbutton Event")
            if code in (200, 201):
                self._log(f"🚨 SOS Created on Backend! Status: {code} OK (SOS ID: {resp.get('id', 'N/A')})", "SUCCESS")
                self._log(f"   Incident has been broadcast via WebSockets to all connected NOC admins.", "SUCCESS")
            else:
                self._log(f"Failed to trigger SOS: {resp}", "ERROR")

        threading.Thread(target=worker, daemon=True).start()

    def _check_backend_status(self):
        self._update_api_client_url()
        is_ok, msg = self.api.ping_backend()
        if is_ok:
            self.lbl_server_status.config(text="● ONLINE", fg=COLOR_ACCENT_EMERALD)
            self._log(f"Connected to Backend at {self.api.base_url} ({msg})", "SUCCESS")
        else:
            self.lbl_server_status.config(text="● OFFLINE", fg=COLOR_ACCENT_RED)
            self._log(f"Cannot reach Backend at {self.api.base_url}: {msg}", "WARN")

    def _update_api_client_url(self):
        url = self.entry_url.get().strip()
        if url:
            self.topology.set_base_url(url)
            self.api.base_url = url.rstrip("/")

    def _refresh_node_combos(self):
        nodes = list(self.topology.devices.keys())
        non_gw = [nid for nid in nodes if nid != self.topology.gateway_id]
        if hasattr(self, "combo_src_node"):
            self.combo_src_node["values"] = non_gw if non_gw else nodes
            if non_gw:
                self.combo_src_node.current(0)
                self._update_route_preview(non_gw[0])
        if hasattr(self, "combo_target_node"):
            self.combo_target_node["values"] = nodes
            if nodes:
                self.combo_target_node.current(0)

    def _on_src_node_selected(self, event):
        nid = self.combo_src_node.get()
        self.selected_node_id = nid
        self._update_route_preview(nid)
        self._draw_topology_map()

    def _update_route_preview(self, node_id: str):
        route = self.topology.get_route_to_gateway(node_id)
        if len(route) <= 1:
            self.lbl_route_preview.config(text=f"{node_id} (Root Gateway Direct)")
        else:
            self.lbl_route_preview.config(text=f"Hop Chain ({len(route)-1} hops):\n" + " ➔ ".join(route))

    def _log(self, text: str, tag: str = "INFO"):
        timestamp = time.strftime("%H:%M:%S")
        line = f"[{timestamp}] {text}\n"

        def append():
            self.log_text.insert(tk.END, line, tag)
            self.log_text.see(tk.END)

        self.root.after(0, append)

    def _clear_logs(self):
        self.log_text.delete("1.0", tk.END)


# ── CLI / Headless Runner ─────────────────────────────────────────────────────

def run_headless(base_url: str, node_count: int, topology_type: str, interval: float):
    print("=" * 70, flush=True)
    print("E-MESH ESP32 HARDWARE MESH SIMULATOR (CLI HEADLESS MODE)", flush=True)
    print(f"Target Backend: {base_url}", flush=True)
    print(f"Nodes: {node_count} | Topology: {topology_type} | Interval: {interval}s", flush=True)
    print("=" * 70, flush=True)

    mgr = MeshTopologyManager(base_url)
    api = HardwareApiClient(base_url)

    is_ok, msg = api.ping_backend()
    if not is_ok:
        print(f"[ERROR] Cannot connect to {base_url}: {msg}", flush=True)
        return

    mgr.generate_topology(node_count=node_count, topology_type=topology_type)

    print("\n1. Registering nodes with backend...", flush=True)
    for dev in mgr.devices.values():
        code, resp = api.send_node_heartbeat(dev)
        print(f"  Node {dev.node_id} (L{dev.layer}) -> HTTP {code}", flush=True)

    print("\n2. Registering RF links with backend...", flush=True)
    for link in mgr.links:
        code, resp = api.send_link_report(link)
        print(f"  Link {link.source_id} -> {link.target_id} ({link.rssi_dbm} dBm) -> HTTP {code}", flush=True)

    print(f"\n3. Starting continuous heartbeat loop (Ctrl+C to stop)...", flush=True)
    try:
        while True:
            for dev in mgr.devices.values():
                dev.generate_telemetry_jitter()
                api.send_node_heartbeat(dev)
            for link in mgr.links:
                api.send_link_report(link)
            print(f"[{time.strftime('%H:%M:%S')}] Heartbeats transmitted for {len(mgr.devices)} nodes.", flush=True)
            time.sleep(interval)
    except KeyboardInterrupt:
        print("\nSimulator stopped by user.", flush=True)


# ── Entry Point ───────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="E-MESH ESP32 Hardware Mesh Simulator")
    parser.add_argument("--url", default=DEFAULT_SERVER_URL, help="FastAPI backend URL (default: http://127.0.0.1:8000)")
    parser.add_argument("--nodes", type=int, default=6, help="Number of nodes to simulate (default: 6)")
    parser.add_argument("--topology", choices=["tree", "line", "star", "dense"], default="tree", help="Topology architecture")
    parser.add_argument("--interval", type=float, default=3.0, help="Heartbeat interval in seconds (default: 3.0)")
    parser.add_argument("--headless", action="store_true", help="Run without graphical UI in CLI mode")

    args = parser.parse_args()

    if args.headless or not TKINTER_AVAILABLE:
        if not TKINTER_AVAILABLE:
            print("[INFO] Tkinter not available in this environment. Falling back to CLI mode.")
        run_headless(args.url, args.nodes, args.topology, args.interval)
    else:
        root = tk.Tk()
        app = HardwareMeshSimulatorUI(root, server_url=args.url)
        root.mainloop()


if __name__ == "__main__":
    main()
