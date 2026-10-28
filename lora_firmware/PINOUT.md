# E-MESH LoRa Bridge (SX1278 433 MHz) Hardware Pinout & Wiring Guide

This document provides the complete hardware wiring specifications, pinout tables, power supply requirements, and antenna specifications for connecting **Semtech SX1278 (Ai-Thinker Ra-02 433 MHz)** modules to both the **ESP32-WROOM-32 (38-Pin DevKitC)** and **ESP32-C3-Mini (DevKitM-1)** microcontrollers.

---

## 1. SX1278 (Ra-02) Pin Overview

The Ai-Thinker Ra-02 module breaks out the Semtech SX1278 transceiver:

| Ra-02 Pin | Name | Description | Connection Mandatory? |
| :--- | :--- | :--- | :--- |
| **GND** | Ground | Common system ground | **Yes** |
| **3.3V / VCC** | Power | **3.3V DC ONLY** (Max 3.7V, typical 3.3V) | **Yes (Never 5V!)** |
| **RESET** | RST | Active LOW hardware reset | **Yes** |
| **DIO0** | IRQ | Digital I/O 0 (Interrupt for RxDone / TxDone) | **Yes** |
| **NSS / CS** | Chip Select | SPI Slave Select (Active LOW) | **Yes** |
| **MOSI** | SPI MOSI | Master Out Slave In | **Yes** |
| **MISO** | SPI MISO | Master In Slave Out | **Yes** |
| **SCK** | SPI Clock | Serial Clock | **Yes** |
| **DIO1 - DIO5** | Extra IRQs | Frequency hopping / CAD / preamble interrupts | *Not needed for basic LoRa* |
| **ANT** | RF Antenna | 433 MHz RF pin / IPEX connector | **Yes (Never transmit without antenna!)** |

> [!CAUTION]
> **CRITICAL POWER WARNING**: The SX1278 is strictly a **3.3V logic and supply device**. Connecting `VCC` to the ESP32's `5V` / `VIN` pin will permanently damage the transceiver chip. Always connect `VCC` to the `3V3` pin.
>
> **ANTENNA WARNING**: Never transmit over LoRa without an antenna securely connected. Transmitting with an open RF port can reflect power back into the power amplifier (PA) and permanently burn the SX1278 output stage.

---

## 2. ESP32-WROOM-32 (Default Hardware SPI - VSPI)

Standard 38-Pin DevKitC pinout using ESP32's default hardware VSPI peripheral:

| SX1278 (Ra-02) Pin | ESP32-WROOM-32 Pin | Function / Hardware Description |
| :--- | :--- | :--- |
| **VCC** | `3V3` | 3.3V Regulated Power Rail |
| **GND** | `GND` | Common Ground |
| **SCK** | `GPIO 18` | Hardware VSPI Clock (`VSPI_CLK`) |
| **MISO** | `GPIO 19` | Hardware VSPI Data In (`VSPI_MISO`) |
| **MOSI** | `GPIO 23` | Hardware VSPI Data Out (`VSPI_MOSI`) |
| **NSS / CS** | `GPIO 5` | Hardware VSPI Slave Select (`VSPI_CS`) |
| **RESET** | `GPIO 14` | Module Reset pin (Software Controlled) |
| **DIO0** | `GPIO 2` (or `GPIO 26`) | Packet Rx/Tx Finished Interrupt |

### Code Configuration Macro:
```cpp
#define BOARD_TYPE BOARD_WROOM

// Under BOARD_WROOM:
#define LORA_SCK   18
#define LORA_MISO  19
#define LORA_MOSI  23
#define LORA_CS    5
#define LORA_RST   14
#define LORA_DIO0  2
```

---

## 3. ESP32-C3-Mini (Default Hardware SPI - FSPI)

Standard DevKitM-1 pinout using ESP32-C3's default hardware FSPI peripheral:

| SX1278 (Ra-02) Pin | ESP32-C3-Mini Pin | Function / Hardware Description |
| :--- | :--- | :--- |
| **VCC** | `3V3` | 3.3V Regulated Power Rail |
| **GND** | `GND` | Common Ground |
| **SCK** | `GPIO 4` | Hardware FSPI Clock (`FSPI_SCK`) |
| **MISO** | `GPIO 5` | Hardware FSPI Data In (`FSPI_MISO`) |
| **MOSI** | `GPIO 6` | Hardware FSPI Data Out (`FSPI_MOSI`) |
| **NSS / CS** | `GPIO 7` | Hardware FSPI Slave Select (`FSPI_CS`) |
| **RESET** | `GPIO 3` | Module Reset pin (Software Controlled) |
| **DIO0** | `GPIO 2` (or `GPIO 10`) | Packet Rx/Tx Finished Interrupt |

### Code Configuration Macro:
```cpp
#define BOARD_TYPE BOARD_C3

// Under BOARD_C3:
#define LORA_SCK   4
#define LORA_MISO  5
#define LORA_MOSI  6
#define LORA_CS    7
#define LORA_RST   3
#define LORA_DIO0  2
```

---

## 4. Alternative / Shared Pinout Reference

If your ESP32 board already has other sensors wired (e.g. BMP280, MPU6050, or GPS), the SPI and control pins can be remapped to any available digital GPIO:

### Alternative ESP32-WROOM-32 Mapping
| SX1278 Pin | Primary GPIO | Alternative GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **NSS / CS** | `GPIO 5` | `GPIO 15` | Any free output pin |
| **RESET** | `GPIO 14` | `GPIO 4` | Any free output pin |
| **DIO0** | `GPIO 2` | `GPIO 26` | Interrupt-capable GPIO |

### Alternative ESP32-C3-Mini Mapping
| SX1278 Pin | Primary GPIO | Alternative GPIO | Notes |
| :--- | :--- | :--- | :--- |
| **RESET** | `GPIO 3` | `GPIO 1` | Any free GPIO |
| **DIO0** | `GPIO 2` | `GPIO 10` | Any free input/interrupt pin |

---

## 5. RF Antenna Specifications (433 MHz ISM Band)

The frequency selected for the project is **433.0 MHz** (standard India amateur & license-exempt ISM sub-band).

### Monopole Whip Antenna (1/4 Wavelength)
If using a simple copper/insulated wire soldered to the `ANT` pad on the Ra-02 module:

$$\lambda = \frac{c}{f} = \frac{3 \times 10^8 \text{ m/s}}{433 \times 10^6 \text{ Hz}} \approx 0.6928 \text{ meters}$$

$$\text{Quarter-Wave Length} = \frac{\lambda}{4} = \frac{69.28 \text{ cm}}{4} \approx 17.32 \text{ cm}$$

- **Recommended Length**: Cut a single solid-core or stranded wire to exactly **17.3 cm** (6.8 inches).
- Solder directly to the `ANT` through-hole / pad.
- If using an external SMA whip antenna, ensure it is tuned for **433 MHz** (do not use 2.4 GHz Wi-Fi or 868/915 MHz antennas).

---

## 6. Power Decoupling & Stability Tips

1. **Current Spikes**: SX1278 transmits at up to +20 dBm (100 mW), drawing peak currents of ~120 mA during transmission. If powered from a breadboard with long jumper wires, voltage dips can cause the ESP32 to brown out.
2. **Decoupling Capacitor**: Solder a **100 µF electrolytic capacitor** and a **0.1 µF ceramic capacitor** across the `VCC` and `GND` pins close to the Ra-02 module to ensure rock-solid RF power delivery.
