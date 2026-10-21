"""
Research & Performance Evaluation Router for E-MESH
Enables live experimentation, benchmarking, and real-time toggling of the ADEC-Mesh
lossless compression pipeline, evaluating BER, Packet Drop Rate (PDR), Latency, and Goodput.
"""
from __future__ import annotations

import time
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field

from app.core.compression import ADECMeshCompressor, CompressionSuite

router = APIRouter(prefix="/research", tags=["Research & Benchmarking"])

# In-memory research state tracker
class ResearchState:
    active_method: str = "adec"
    compression_enabled: bool = True
    total_packets: int = 0
    total_raw_bytes: int = 0
    total_compressed_bytes: int = 0
    recent_transmissions: List[Dict[str, Any]] = []

    @classmethod
    def record_transmission(
        cls,
        raw_size: int,
        comp_size: int,
        method: str = "adec",
        enc_time_ms: float = 0.1,
        dec_time_ms: float = 0.1,
    ):
        cls.total_packets += 1
        cls.total_raw_bytes += raw_size
        cls.total_compressed_bytes += comp_size

        entry = {
            "timestamp": time.time(),
            "method": method,
            "raw_size": raw_size,
            "comp_size": comp_size,
            "savings_pct": round((1.0 - (comp_size / max(raw_size, 1))) * 100.0, 2),
            "ratio": round(raw_size / max(comp_size, 1), 2),
            "enc_time_ms": enc_time_ms,
            "dec_time_ms": dec_time_ms,
        }
        cls.recent_transmissions.append(entry)
        if len(cls.recent_transmissions) > 50:
            cls.recent_transmissions.pop(0)


# ── Schemas ───────────────────────────────────────────────────────────────────

class ToggleCompressionRequest(BaseModel):
    enabled: bool = Field(..., description="Enable or disable ADEC-Mesh compression")


class SelectMethodRequest(BaseModel):
    method: str = Field(..., description="Compression algorithm: adec | gzip | sprintz | chimp | none")


class BenchmarkRequest(BaseModel):
    payload_type: Optional[str] = Field("sensor_telemetry", description="Preset name: sos_distress | sensor_telemetry | gps_beacon | incident_report | community_chat | custom")
    custom_payload: Optional[Dict[str, Any]] = Field(None, description="Custom JSON payload to evaluate")
    method: Optional[str] = Field(None, description="Evaluate specific method or all methods")
    rssi_dbm: float = Field(-78.0, ge=-110.0, le=-30.0, description="Simulated channel RSSI in dBm")
    data_rate_kbps: float = Field(250.0, ge=50.0, le=54000.0, description="Mesh radio bit rate in kbps (e.g. 250 kbps for multi-hop)")


# ── Standard Evaluation Samples ───────────────────────────────────────────────

RESEARCH_SAMPLES = {
    "sos_distress": {
        "people_count": 3,
        "notes": "Trapped on 2nd floor, stairwell collapsed, smoke entering room, urgent medical aid needed",
        "latitude": 19.076090,
        "longitude": 72.877426,
        "accuracy": 8.5
    },
    "sensor_telemetry": {
        "node_id": "EMESH-307D14",
        "status": "ONLINE",
        "temperature_c": 29.4,
        "pressure_hpa": 1012.35,
        "accel_x": 18,
        "accel_y": -12,
        "accel_z": 984,
        "gyro_x": 2,
        "gyro_y": -1,
        "gyro_z": 0,
        "battery_percent": 88.0,
        "rssi_dbm": -68.0,
        "hop_count": 2,
        "is_gateway": False,
        "has_gps": True,
        "gps_lat": 19.076120,
        "gps_lon": 72.877390,
        "uptime_seconds": 1420
    },
    "gps_beacon": {
        "node_id": "EMESH-309C20",
        "has_gps": True,
        "gps_lat": 19.075980,
        "gps_lon": 72.877510,
        "gps_alt_m": 42.5,
        "gps_sats": 9,
        "status": "ONLINE",
        "battery_percent": 94.0
    },
    "incident_report": {
        "category": "STRUCTURAL",
        "priority": "CRITICAL",
        "title": "Severe concrete facade collapse blocking emergency access route",
        "description": "Debris completely obstructing North Boulevard. Gas leak odor detected near building 4B.",
        "people_affected": 12,
        "latitude": 19.076410,
        "longitude": 72.877150
    },
    "community_chat": {
        "sender_username": "sarah_k",
        "content": "Water distribution truck arriving at community shelter zone 2 in 15 minutes. Bring clean containers."
    }
}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/status", summary="Get compression status and aggregate performance metrics")
async def get_research_status():
    """Returns the current compression state, active method, cumulative statistics, and algorithm specifications."""
    raw_total = max(ResearchState.total_raw_bytes, 1)
    comp_total = max(ResearchState.total_compressed_bytes, 1)
    savings_pct = round((1.0 - (comp_total / raw_total)) * 100.0, 2) if ResearchState.total_packets > 0 else 0.0
    cr = round(raw_total / comp_total, 2) if ResearchState.total_packets > 0 else 1.0

    return {
        "compression_enabled": ResearchState.compression_enabled,
        "active_method": ResearchState.active_method,
        "available_methods": CompressionSuite.METHODS,
        "algorithm": {
            "name": CompressionSuite.METHODS.get(ResearchState.active_method, {}).get("name", "ADEC-Mesh"),
            "full_name": CompressionSuite.METHODS.get(ResearchState.active_method, {}).get("full_name", ""),
            "version": "1.0",
            "foundation": CompressionSuite.METHODS.get(ResearchState.active_method, {}).get("citation", ""),
            "type": CompressionSuite.METHODS.get(ResearchState.active_method, {}).get("type", ""),
            "theoretical_guarantee": CompressionSuite.METHODS.get(ResearchState.active_method, {}).get("guarantee", ""),
        },
        "aggregate_metrics": {
            "total_packets_processed": ResearchState.total_packets,
            "total_raw_bytes": ResearchState.total_raw_bytes,
            "total_compressed_bytes": ResearchState.total_compressed_bytes,
            "total_bytes_saved": ResearchState.total_raw_bytes - ResearchState.total_compressed_bytes,
            "average_compression_ratio": cr,
            "average_space_savings_percent": savings_pct,
        },
        "recent_transmissions": ResearchState.recent_transmissions[-15:],
    }


@router.post("/select-method", summary="Select active compression method")
async def select_compression_method(body: SelectMethodRequest):
    """Switch active compression method among adec, gzip, sprintz, chimp, or none."""
    method = body.method.lower()
    if method not in CompressionSuite.METHODS:
        return {
            "status": "error",
            "message": f"Unsupported compression method: {method}. Allowed: {list(CompressionSuite.METHODS.keys())}",
            "active_method": ResearchState.active_method,
            "compression_enabled": ResearchState.compression_enabled,
        }

    ResearchState.active_method = method
    ResearchState.compression_enabled = (method != "none")
    return {
        "status": "success",
        "active_method": ResearchState.active_method,
        "compression_enabled": ResearchState.compression_enabled,
        "method_details": CompressionSuite.METHODS.get(method),
        "message": f"Active compression method switched to {CompressionSuite.METHODS[method]['name']}."
    }


@router.post("/toggle", summary="Toggle compression pipeline on/off")
async def toggle_compression(body: ToggleCompressionRequest):
    """Enable or disable compression across the system."""
    ResearchState.compression_enabled = body.enabled
    if not body.enabled:
        ResearchState.active_method = "none"
    elif ResearchState.active_method == "none":
        ResearchState.active_method = "adec"

    return {
        "status": "success",
        "compression_enabled": ResearchState.compression_enabled,
        "active_method": ResearchState.active_method,
        "message": f"Compression pipeline has been {'ENABLED (' + ResearchState.active_method.upper() + ')' if body.enabled else 'DISABLED'}."
    }


@router.get("/samples", summary="Get research test samples")
async def get_research_samples():
    """Returns realistic emergency payload presets for comparative benchmarking."""
    return RESEARCH_SAMPLES


@router.post("/benchmark", summary="Execute comparative benchmark across all candidate algorithms")
async def run_benchmark(body: BenchmarkRequest):
    """
    Executes a comprehensive, multi-algorithm comparative study evaluating:
    1. ADEC-Mesh (Our Proposed Method)
    2. Gzip / DEFLATE (Standard Industry Baseline)
    3. Sprintz-Delta (IEEE TMC 2024 Reference)
    4. Chimp-XOR (VLDB / IEEE TKDE Sensor Float Reference)
    5. Raw Passthrough

    Computes:
    - Bit Error Rate (BER) over AWGN/Rayleigh channel
    - Packet Drop Rate (PDR)
    - Latency (Compute + RF Airtime)
    - Effective Channel Goodput
    - Heinzelman Radio Energy Reduction
    """
    if body.custom_payload:
        target_payload = body.custom_payload
    elif body.payload_type in RESEARCH_SAMPLES:
        target_payload = RESEARCH_SAMPLES[body.payload_type]
    else:
        target_payload = RESEARCH_SAMPLES["sensor_telemetry"]

    # 1. Multi-Algorithm Comparative Benchmark
    comparative = CompressionSuite.compute_comparative_benchmark(
        raw_payload=target_payload,
        rssi_dbm=body.rssi_dbm,
        data_rate_kbps=body.data_rate_kbps,
    )

    # 2. Backward-compatible individual metric structure for ADEC-Mesh
    metrics = ADECMeshCompressor.compute_channel_metrics(
        raw_payload=target_payload,
        rssi_dbm=body.rssi_dbm,
        data_rate_kbps=body.data_rate_kbps,
    )

    # Record in history
    ResearchState.record_transmission(
        raw_size=metrics["raw_size_bytes"],
        comp_size=metrics["compressed_size_bytes"],
        method=ResearchState.active_method,
        enc_time_ms=metrics["timings"]["encoding_time_ms"],
        dec_time_ms=metrics["timings"]["decoding_time_ms"],
    )

    return {
        "payload_type": body.payload_type,
        "metrics": metrics,
        "comparative_study": comparative,
        "active_method": ResearchState.active_method,
        "evaluated_payload": target_payload,
    }

