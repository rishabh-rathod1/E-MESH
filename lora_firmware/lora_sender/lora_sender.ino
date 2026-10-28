/*
 * ============================================================================
 * E-MESH LoRa Bridge — Sender Node Firmware
 * ============================================================================
 * Hardware: ESP32-WROOM-32 or ESP32-C3-Mini + Semtech SX1278 (Ra-02 433 MHz)
 * 
 * Function:
 * 1. Connects as a Wi-Fi Station to the E-MESH Server hotspot ("E-MESH-SERVER").
 * 2. Periodically polls the FastAPI backend (http://192.168.137.1:8000/api/v1/mesh/lora/poll).
 * 3. Extracts:
 *    - Active Emergency SOS distress calls (from mesh field nodes / civilians).
 *    - Admin Emergency Text Broadcasts (dispatched from the Admin SOS Dashboard).
 * 4. Encodes and transmits packets over LoRa at 433.0 MHz (India ISM Band).
 * 5. Provides rich debug telemetry on Serial (115200 baud) and LED status blinks.
 * 
 * Required Arduino IDE Libraries:
 * - "LoRa" by Sandeep Mistry (v0.8.0 or later)
 * - "ArduinoJson" by Benoit Blanchon (v6 or v7)
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include <SPI.h>
#include <LoRa.h>
#include <ArduinoJson.h>

// ============================================================================
// Board Selection Configuration
// ============================================================================
#define BOARD_WROOM 1
#define BOARD_C3    2

// Set your target board here:
#define BOARD_TYPE BOARD_WROOM

#if BOARD_TYPE == BOARD_WROOM
  // ESP32-WROOM-32 Default Hardware SPI (VSPI)
  #define LORA_SCK   18
  #define LORA_MISO  19
  #define LORA_MOSI  23
  #define LORA_CS    5
  #define LORA_RST   14
  #define LORA_DIO0  2
  #define STATUS_LED 2
  #define BOARD_NAME "ESP32-WROOM-32"
#elif BOARD_TYPE == BOARD_C3
  // ESP32-C3-Mini Default Hardware SPI (FSPI)
  #define LORA_SCK   4
  #define LORA_MISO  5
  #define LORA_MOSI  6
  #define LORA_CS    7
  #define LORA_RST   3
  #define LORA_DIO0  2
  #define STATUS_LED 8
  #define BOARD_NAME "ESP32-C3-Mini"
#else
  #error "Unknown BOARD_TYPE selected!"
#endif

// ============================================================================
// Network & LoRa Radio Settings
// ============================================================================
const char* WIFI_SSID       = "E-MESH-SERVER";
const char* WIFI_PASSWORD   = "emesh2025";
const char* SERVER_IP       = "192.168.137.1";
const int   SERVER_PORT     = 8000;
const char* POLL_ENDPOINT   = "/api/v1/mesh/lora/poll";

// LoRa 433 MHz Frequency (India Amateur & License-Free Band)
const long  LORA_FREQUENCY  = 433E6;

// Timing Parameters
const unsigned long POLL_INTERVAL_MS = 1800; // Poll backend every 1.8 seconds
const unsigned long SOS_RETRANSMIT_MS = 8000; // Retransmit ongoing active SOS every 8s

// State Tracking
unsigned long lastPollTime = 0;
unsigned long lastSOSTxTime = 0;
String lastTransmittedMsgId = "";
String lastTransmittedSosId = "";
unsigned long txPacketCount = 0;

// ============================================================================
// Helper Functions
// ============================================================================
void blinkLed(int times, int msDelay) {
  for (int i = 0; i < times; i++) {
    digitalWrite(STATUS_LED, HIGH);
    delay(msDelay);
    digitalWrite(STATUS_LED, LOW);
    delay(msDelay);
  }
}

void printBanner() {
  Serial.println("\n========================================================");
  Serial.println("       E-MESH LORA BRIDGE — SENDER NODE (433 MHz)       ");
  Serial.printf ("  Board Architecture : %s\n", BOARD_NAME);
  Serial.printf ("  Target Server      : http://%s:%d%s\n", SERVER_IP, SERVER_PORT, POLL_ENDPOINT);
  Serial.printf ("  Wi-Fi Target Hotspot: %s\n", WIFI_SSID);
  Serial.printf ("  LoRa Frequency     : %.1f MHz (India ISM)\n", LORA_FREQUENCY / 1E6);
  Serial.println("========================================================\n");
}

void connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) return;

  Serial.printf("[WiFi] Connecting to hotspot '%s'...", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 25) {
    delay(500);
    Serial.print(".");
    retries++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] Connected successfully!");
    Serial.printf("[WiFi] Assigned IP : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("[WiFi] Gateway IP  : %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("[WiFi] RSSI Signal : %d dBm\n", WiFi.RSSI());
    blinkLed(2, 100);
  } else {
    Serial.println("\n[WiFi] Connection timed out. Will retry on next cycle.");
  }
}

bool initLoRa() {
  Serial.println("[LoRa] Initializing SX1278 transceiver...");
  Serial.printf("[LoRa] Pins: SCK=%d, MISO=%d, MOSI=%d, CS=%d, RST=%d, DIO0=%d\n",
                LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS, LORA_RST, LORA_DIO0);

  // Initialize Hardware SPI with designated pins
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  if (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[LoRa] ERROR: SX1278 initialization failed! Check wiring & 3.3V power.");
    return false;
  }

  // RF Configuration for Robust Disaster Telemetry
  LoRa.setTxPower(17, PA_OUTPUT_PA_BOOST_PIN); // +17 dBm Output Power
  LoRa.setSpreadingFactor(7);                  // SF7 (Fast data rate with reliable penetration)
  LoRa.setSignalBandwidth(125E3);              // 125 kHz Bandwidth
  LoRa.setCodingRate4(5);                      // 4/5 Coding Rate
  LoRa.setSyncWord(0x34);                      // Unique E-MESH Sync Word (isolate from public LoRaWAN)
  LoRa.enableCrc();                            // Hardware Cyclic Redundancy Check

  Serial.println("[LoRa] SX1278 initialized successfully on 433.0 MHz.");
  blinkLed(3, 80);
  return true;
}

void transmitLoRaPacket(const String& packetType, const String& payload) {
  Serial.println("\n--------------------------------------------------------");
  Serial.printf("[LoRa-TX #%lu] Transmitting %s Packet...\n", ++txPacketCount, packetType.c_str());
  Serial.printf("[Payload] %s\n", payload.c_str());

  digitalWrite(STATUS_LED, HIGH);
  unsigned long start = millis();

  LoRa.beginPacket();
  LoRa.print(payload);
  LoRa.endPacket();

  unsigned long duration = millis() - start;
  digitalWrite(STATUS_LED, LOW);

  Serial.printf("[LoRa-TX] Done. Bytes: %d, Air-Time: %lu ms\n", payload.length(), duration);
  Serial.println("--------------------------------------------------------");
}

// ============================================================================
// Setup & Main Loop
// ============================================================================
void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  delay(1500); // Wait for serial monitor to stabilize
  printBanner();

  // Initialize LoRa Hardware
  while (!initLoRa()) {
    Serial.println("[LoRa] Retrying in 3 seconds...");
    blinkLed(1, 1000);
    delay(2000);
  }

  // Connect to E-MESH Server Wi-Fi
  connectWiFi();
}

void loop() {
  // Ensure Wi-Fi connection
  if (WiFi.status() != WL_CONNECTED) {
    connectWiFi();
    delay(1000);
    return;
  }

  unsigned long currentMillis = millis();
  if (currentMillis - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = currentMillis;

    HTTPClient http;
    String url = String("http://") + SERVER_IP + ":" + String(SERVER_PORT) + POLL_ENDPOINT;

    http.begin(url);
    http.setTimeout(2500); // 2.5s timeout

    int httpCode = http.GET();
    if (httpCode == HTTP_CODE_OK) {
      String response = http.getString();

      #if ARDUINOJSON_VERSION_MAJOR >= 7
        JsonDocument doc;
      #else
        DynamicJsonDocument doc(2048);
      #endif

      DeserializationError error = deserializeJson(doc, response);
      if (!error) {
        bool hasSOS = doc["has_sos"] | false;
        bool hasMessage = doc["has_message"] | false;

        // --------------------------------------------------------------------
        // 1. Process Active SOS Alert
        // --------------------------------------------------------------------
        if (hasSOS) {
          JsonObject sos = doc["sos"];
          String sosId = sos["sos_id"] | "SOS-UNKNOWN";
          String nodeId = sos["node_id"] | "NODE";
          int peopleCount = sos["people_count"] | 1;
          String notes = sos["notes"] | "Emergency distress";

          bool isNewSOS = (sosId != lastTransmittedSosId);
          bool timeToRepeat = (currentMillis - lastSOSTxTime >= SOS_RETRANSMIT_MS);

          if (isNewSOS || timeToRepeat) {
            // Encode Compact LoRa Packet
            // Format: [EMESH:SOS]|ID:<id>|NODE:<node>|PPL:<count>|NOTES:<notes>
            String packet = "[EMESH:SOS]|ID:" + sosId +
                            "|NODE:" + nodeId +
                            "|PPL:" + String(peopleCount) +
                            "|NOTES:" + notes;

            transmitLoRaPacket("EMERGENCY-SOS", packet);

            lastTransmittedSosId = sosId;
            lastSOSTxTime = currentMillis;
          }
        } else {
          // If no active SOS exists, reset ID
          lastTransmittedSosId = "";
        }

        // --------------------------------------------------------------------
        // 2. Process Admin Text Broadcast Message
        // --------------------------------------------------------------------
        if (hasMessage) {
          JsonObject msg = doc["message"];
          String msgId = msg["id"] | "";
          String priority = msg["priority"] | "CRITICAL";
          String text = msg["message"] | "";

          if (msgId.length() > 0 && msgId != lastTransmittedMsgId) {
            // Encode Compact LoRa Packet
            // Format: [EMESH:MSG]|ID:<id>|PRI:<priority>|TXT:<text>
            String packet = "[EMESH:MSG]|ID:" + msgId +
                            "|PRI:" + priority +
                            "|TXT:" + text;

            // Transmit with high priority (transmit twice with 150ms gap for RF reliability)
            transmitLoRaPacket("ADMIN-BROADCAST", packet);
            delay(150);
            transmitLoRaPacket("ADMIN-BROADCAST (REPEAT)", packet);

            lastTransmittedMsgId = msgId;
          }
        }

        static unsigned long pollSuccessCount = 0;
        pollSuccessCount++;
        if (!hasSOS && !hasMessage && (pollSuccessCount % 10 == 0)) {
          Serial.printf("[HTTP] Polling OK (#%lu) - Channel idle (0 active SOS, 0 broadcast messages)\n", pollSuccessCount);
        }
      } else {
        Serial.printf("[JSON] Deserialization error: %s\n", error.c_str());
      }
    } else {
      Serial.printf("[HTTP] Poll failed, code: %d (%s)\n", httpCode, http.errorToString(httpCode).c_str());
    }

    http.end();
  }

  delay(20);
}
