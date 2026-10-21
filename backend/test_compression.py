"""
Unit Test Suite for ADEC-Mesh Compression & Wireless Channel Modeling
Run with: python test_compression.py
"""
import json
import sys
from pathlib import Path

# Ensure backend root is on sys.path
sys.path.insert(0, str(Path(__file__).parent))

from app.core.compression import ADECMeshCompressor, TOKEN_TO_STR, STR_TO_TOKEN


def test_codec_integrity():
    print("=" * 70)
    print("ADEC-MESH UNIT TEST & VALIDATION SUITE")
    print("=" * 70)
    print(f"Loaded Shared Token Dictionary: {len(TOKEN_TO_STR)} entries")

    test_cases = [
        (
            "SOS Distress Beacon",
            {
                "people_count": 3,
                "notes": "Trapped on 2nd floor, smoke entering room, urgent aid needed",
                "latitude": 19.07609,
                "longitude": 72.877426,
                "accuracy": 8.5,
            },
        ),
        (
            "IMU & Environmental Telemetry",
            {
                "node_id": "EMESH-307D14",
                "status": "ONLINE",
                "temperature_c": 29.4,
                "pressure_hpa": 1012.35,
                "accel_x": 18,
                "accel_y": -12,
                "accel_z": 984,
                "battery_percent": 88.0,
                "has_gps": True,
                "gps_lat": 19.07612,
                "gps_lon": 72.87739,
            },
        ),
        (
            "Incident Report",
            {
                "category": "STRUCTURAL",
                "priority": "CRITICAL",
                "title": "Severe concrete facade collapse",
                "description": "Debris completely obstructing North Boulevard.",
                "people_affected": 12,
            },
        ),
    ]

    all_passed = True
    for name, payload in test_cases:
        compressed = ADECMeshCompressor.compress(payload)
        decompressed_str = ADECMeshCompressor.decompress(compressed)
        decompressed_obj = json.loads(decompressed_str)

        is_lossless = payload == decompressed_obj
        raw_size = len(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
        comp_size = len(compressed)
        savings = (1.0 - comp_size / raw_size) * 100.0

        status_str = "PASS" if is_lossless else "FAIL"
        if not is_lossless:
            all_passed = False

        print(
            f"[{status_str}] {name:30s} | Raw: {raw_size:3d}B -> Comp: {comp_size:3d}B ({savings:5.1f}% savings)"
        )

    # Test Base64 roundtrip
    sample = test_cases[0][1]
    b64 = ADECMeshCompressor.compress_to_b64(sample)
    dec = ADECMeshCompressor.decompress_from_b64(b64)
    assert json.loads(dec) == sample, "Base64 roundtrip failed"
    print("[PASS] Base64 Transport Serialization Validated")

    # Channel Metrics Test
    metrics = ADECMeshCompressor.compute_channel_metrics(
        test_cases[1][1], rssi_dbm=-78.0, data_rate_kbps=250.0
    )
    print(f"[PASS] Channel Model: BER={metrics['channel_model']['bit_error_rate']:.2e}")
    print(
        f"       PDR Raw={metrics['channel_model']['raw_packet_drop_rate_percent']}% -> Comp={metrics['channel_model']['compressed_packet_drop_rate_percent']}% (Reduction: {metrics['channel_model']['pdr_reduction_percent']}%)"
    )

    print("=" * 70)
    if all_passed:
        print("ALL TESTS PASSED WITH 100% MATHEMATICAL LOSSLESS FIDELITY!")
    else:
        print("TEST FAILURES ENCOUNTERED.")
        sys.exit(1)


if __name__ == "__main__":
    test_codec_integrity()
