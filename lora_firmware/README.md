# E-MESH LoRa Bridge Extension (SX1278 433 MHz)

This directory contains the firmware and documentation for the isolated **E-MESH LoRa Bridge** extension. It connects the central E-MESH server/network with remote, off-grid field outposts across long distances using Semtech SX1278 (Ra-02) 433 MHz transceivers.

> [!NOTE]
> This firmware is **completely isolated** from the original `firmware/` (ESP-MESH-Lite). It does not touch or depend on the ESP-IDF/PlatformIO mesh firmware, and compiles easily via the standard **Arduino IDE**.

---

## Architecture & Data Flow

```mermaid
flowchart LR
    subgraph Central Station
        A[Admin Dashboard / SOS Queue] -->|POST /mesh/lora/broadcast| B[E-MESH Backend Server<br/>192.168.137.1:8000]
        C[Mesh Nodes / Civilians] -->|POST /mesh/sos| B
        B -->|HTTP Poll /api/v1/mesh/lora/poll| D[LoRa Sender Node<br/>ESP32-WROOM-32]
    end

    subgraph Long-Range RF Link
        D -->|LoRa 433 MHz<br/>[EMESH:SOS] & [EMESH:MSG]| E[LoRa Receiver Node<br/>ESP32-C3-Mini]
    end

    subgraph Remote Field Outpost
        E -->|Serial 115200| F[Serial Monitor / Tactical Terminal]
        E -->|SoftAP 'E-MESH-LORA-RX'<br/>192.168.4.1:80| G[Mobile / Laptop Web Dashboard]
    end
```

---

## Directory Structure

```
lora_firmware/
├── PINOUT.md                 # Complete hardware wiring diagrams & pin tables
├── README.md                 # This guide
├── lora_sender/
│   └── lora_sender.ino       # Sender sketch (ESP32-WROOM-32 -> SX1278)
└── lora_receiver/
    └── lora_receiver.ino     # Receiver sketch (SX1278 -> ESP32-C3-Mini SoftAP)
```

---

## Hardware Pinout Reference

See [PINOUT.md](file:///c:/projects/pjt1_compression_branch/E-MESH/lora_firmware/PINOUT.md) for full wiring tables and power considerations.

### Quick Pinout Summary

| Ra-02 (SX1278) Pin | ESP32-WROOM-32 (Sender) | ESP32-C3-Mini (Receiver) |
| :--- | :--- | :--- |
| **VCC** | `3V3` (**Never 5V!**) | `3V3` (**Never 5V!**) |
| **GND** | `GND` | `GND` |
| **SCK** | `GPIO 18` | `GPIO 4` |
| **MISO** | `GPIO 19` | `GPIO 5` |
| **MOSI** | `GPIO 23` | `GPIO 6` |
| **NSS / CS** | `GPIO 5` | `GPIO 7` |
| **RESET** | `GPIO 14` | `GPIO 3` |
| **DIO0** | `GPIO 2` | `GPIO 2` |
| **ANT** | 17.3 cm wire or 433MHz antenna | 17.3 cm wire or 433MHz antenna |

---

## Arduino IDE Setup

### 1. Install ESP32 Board Package
1. Open **Arduino IDE** -> **Settings / Preferences**.
2. In *Additional Boards Manager URLs*, add:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools** -> **Board** -> **Boards Manager**, search for `esp32` by Espressif Systems, and click **Install**.

### 2. Install Required Libraries
Open **Tools** -> **Manage Libraries...** and install:
1. **`LoRa` by Sandeep Mistry** (v0.8.0 or later)
2. **`ArduinoJson` by Benoit Blanchon** (v6 or v7)

---

## Flashing Instructions

### Flashing the Sender (`lora_sender.ino`)
1. Connect your **ESP32-WROOM-32** board via USB.
2. In Arduino IDE:
   - **Board**: `ESP32 Dev Module`
   - **Port**: Select the COM port corresponding to your WROOM board.
   - Verify that `#define BOARD_TYPE BOARD_WROOM` is active in `lora_sender.ino`.
3. Click **Upload**.
4. Open the **Serial Monitor** at **115200 baud**.
5. The board will connect to the Windows hotspot (`E-MESH-SERVER`), initialize the SX1278 radio at 433 MHz, and begin polling `http://192.168.137.1:8000/api/v1/mesh/lora/poll`.

### Flashing the Receiver (`lora_receiver.ino`)
1. Connect your **ESP32-C3-Mini** board via USB.
2. In Arduino IDE:
   - **Board**: `ESP32C3 Dev Module` (or `AirM2M CORE ESP32C3` / `NodeMCU-ESP-C3-12F`)
   - **USB CDC On Boot**: `Enabled`
   - **Port**: Select the COM port corresponding to your C3 board.
   - Verify that `#define BOARD_TYPE BOARD_C3` is active in `lora_receiver.ino`.
3. Click **Upload**.
4. Open the **Serial Monitor** at **115200 baud**.
5. The board will start listening on 433 MHz and launch the SoftAP hotspot `E-MESH-LORA-RX`.

---

## End-to-End Testing Workflow

### Test 1: Admin LoRa Text Broadcast
1. Start the E-MESH backend server (`python start.py` or `python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`).
2. Log into the Admin Dashboard at `http://192.168.137.1:5173` or `https://192.168.137.1:8443`.
3. Navigate to **Emergency SOS Queue**.
4. In the **Emergency LoRa Text Broadcast** panel:
   - Type a test alert: `EVACUATE TO SECTOR 4 IMMEDIATELY`.
   - Priority: `CRITICAL`.
   - Click **Transmit Broadcast**.
5. **Sender Serial**: Shows `[LoRa-TX] Transmitting ADMIN-BROADCAST Packet...`.
6. **Receiver Serial**: Shows `>>> 📢 ADMIN EMERGENCY BROADCAST RECEIVED! <<<`.
7. **Receiver Webpage**: Connect any smartphone or laptop to Wi-Fi `E-MESH-LORA-RX` (password: `emesh2025`), open `http://192.168.4.1`, and see the alert dynamically appear on the dashboard!

### Test 2: Hardware / Mesh SOS Distress
1. When any node triggers an SOS (or a civilian submits an SOS from `https://192.168.137.1:8443/client/`):
2. The SOS alert appears in `GET /api/v1/mesh/lora/poll`.
3. The sender immediately transmits `[EMESH:SOS]|ID:SOS-XXXX|NODE:...|PPL:...|NOTES:...`.
4. The receiver blinks its LED rapidly, logs full distress details to Serial, and updates the emergency card on `http://192.168.4.1`.
