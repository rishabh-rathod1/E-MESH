/*
 * ============================================================================
 * E-MESH LoRa Bridge — Receiver Node Firmware
 * ============================================================================
 * Hardware: ESP32-C3-Mini or ESP32-WROOM-32 + Semtech SX1278 (Ra-02 433 MHz)
 * 
 * Function:
 * 1. Continuously listens for LoRa packets on 433.0 MHz (India ISM band).
 * 2. Decodes:
 *    - Emergency SOS Distress Alerts ([EMESH:SOS])
 *    - Admin Tactical Text Broadcasts ([EMESH:MSG])
 * 3. Logs complete packet metadata (RSSI, SNR, payload) to Serial (115200 baud).
 * 4. Hosts a local Wi-Fi SoftAP ("E-MESH-LORA-RX") at IP 192.168.4.1.
 * 5. Serves a sleek, modern, mobile-responsive emergency dashboard directly from
 *    ESP32 flash memory with live auto-refreshing WebSocket/Fetch telemetry.
 * 
 * Required Arduino IDE Libraries:
 * - "LoRa" by Sandeep Mistry (v0.8.0 or later)
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <SPI.h>
#include <LoRa.h>

// ============================================================================
// Board Selection Configuration
// ============================================================================
#define BOARD_WROOM 1
#define BOARD_C3    2

// Set your target board here (Receiver defaults to ESP32-C3):
#define BOARD_TYPE BOARD_C3

#if BOARD_TYPE == BOARD_C3
  // ESP32-C3-Mini Default Hardware SPI (FSPI)
  #define LORA_SCK   4
  #define LORA_MISO  5
  #define LORA_MOSI  6
  #define LORA_CS    7
  #define LORA_RST   3
  #define LORA_DIO0  2
  #define STATUS_LED 8
  #define BOARD_NAME "ESP32-C3-Mini"
#elif BOARD_TYPE == BOARD_WROOM
  // ESP32-WROOM-32 Default Hardware SPI (VSPI)
  #define LORA_SCK   18
  #define LORA_MISO  19
  #define LORA_MOSI  23
  #define LORA_CS    5
  #define LORA_RST   14
  #define LORA_DIO0  2
  #define STATUS_LED 2
  #define BOARD_NAME "ESP32-WROOM-32"
#else
  #error "Unknown BOARD_TYPE selected!"
#endif

// ============================================================================
// Network & Radio Configuration
// ============================================================================
const char* AP_SSID         = "E-MESH-LORA-RX";
const char* AP_PASSWORD     = "emesh2025"; // Min 8 chars or NULL for open AP
const long  LORA_FREQUENCY  = 433E6;      // 433 MHz (India ISM Band)

// Web Server on Port 80
WebServer server(80);

// Data Ring Buffers
struct SOSAlert {
  String id;
  String node;
  int people;
  String notes;
  int rssi;
  float snr;
  unsigned long timestamp;
};

struct BroadcastMsg {
  String id;
  String priority;
  String text;
  int rssi;
  float snr;
  unsigned long timestamp;
};

#define MAX_RECORDS 10
SOSAlert sosBuffer[MAX_RECORDS];
int sosCount = 0;

BroadcastMsg msgBuffer[MAX_RECORDS];
int msgCount = 0;

unsigned long totalPacketsRx = 0;
int lastRssi = 0;
float lastSnr = 0.0;

// ============================================================================
// HTML Dashboard Template (Stored in PROGMEM to conserve RAM)
// ============================================================================
const char INDEX_HTML[] PROGMEM = R"rawliteral(
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>E-MESH LoRa Receiver Outpost</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card-bg: #151d30;
      --card-border: #233152;
      --text: #f0f4fc;
      --muted: #8e9bb3;
      --red: #ef4444;
      --amber: #f59e0b;
      --emerald: #10b981;
      --blue: #3b82f6;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: var(--bg); color: var(--text); padding: 16px; min-height: 100vh; }
    .header { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; padding-bottom: 16px; border-bottom: 1px solid var(--card-border); margin-bottom: 20px; }
    .title-box { display: flex; align-items: center; gap: 10px; }
    .pulse-dot { width: 12px; height: 12px; border-radius: 50%; background: var(--emerald); box-shadow: 0 0 10px var(--emerald); animation: pulse 2s infinite; }
    @keyframes pulse { 0% { opacity: 0.4; } 50% { opacity: 1; } 100% { opacity: 0.4; } }
    h1 { font-size: 1.25rem; font-weight: 700; letter-spacing: -0.5px; }
    .badge { font-size: 0.75rem; padding: 3px 8px; border-radius: 4px; font-weight: 600; text-transform: uppercase; }
    .badge-red { background: rgba(239, 68, 68, 0.2); color: var(--red); border: 1px solid rgba(239, 68, 68, 0.4); }
    .badge-amber { background: rgba(245, 158, 11, 0.2); color: var(--amber); border: 1px solid rgba(245, 158, 11, 0.4); }
    .badge-blue { background: rgba(59, 130, 246, 0.2); color: var(--blue); border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-green { background: rgba(16, 185, 129, 0.2); color: var(--emerald); border: 1px solid rgba(16, 185, 129, 0.4); }
    
    .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 12px; }
    .stat-label { font-size: 0.75rem; text-transform: uppercase; color: var(--muted); font-weight: 600; margin-bottom: 4px; }
    .stat-value { font-size: 1.35rem; font-weight: 800; font-family: monospace; }
    
    .section-title { font-size: 1rem; font-weight: 700; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    .card-list { display: flex; flex-col; gap: 12px; margin-bottom: 28px; }
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 14px; position: relative; }
    .card-sos { border-left: 4px solid var(--red); }
    .card-msg { border-left: 4px solid var(--blue); }
    .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .card-meta { font-size: 0.75rem; color: var(--muted); font-family: monospace; }
    .card-body { font-size: 0.95rem; font-weight: 600; line-height: 1.4; }
    .card-footer { margin-top: 10px; font-size: 0.75rem; color: var(--muted); display: flex; gap: 12px; }
    .empty-state { text-align: center; padding: 30px; color: var(--muted); font-size: 0.85rem; background: var(--card-bg); border: 1px dashed var(--card-border); border-radius: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-box">
      <div class="pulse-dot"></div>
      <div>
        <h1>E-MESH Outpost Receiver</h1>
        <p style="font-size: 0.8rem; color: var(--muted);">SX1278 433 MHz LoRa Field Station</p>
      </div>
    </div>
    <div style="font-size: 0.8rem; font-family: monospace; color: var(--muted);" id="uptime">Uptime: 0s</div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Frequency</div>
      <div class="stat-value" style="color: var(--blue);">433.0 MHz</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Packets RX</div>
      <div class="stat-value" id="rx-count">0</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Last RSSI</div>
      <div class="stat-value" id="last-rssi">-- dBm</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Last SNR</div>
      <div class="stat-value" id="last-snr">-- dB</div>
    </div>
  </div>

  <div class="section-title">
    <span>🚨 Active SOS Distress Alerts</span>
    <span class="badge badge-red" id="sos-badge">0 Active</span>
  </div>
  <div class="card-list" id="sos-list">
    <div class="empty-state">No SOS distress packets received yet. Outpost is monitoring 433 MHz channel...</div>
  </div>

  <div class="section-title">
    <span>📢 Tactical Broadcast Messages</span>
    <span class="badge badge-blue" id="msg-badge">0 Messages</span>
  </div>
  <div class="card-list" id="msg-list">
    <div class="empty-state">No admin text broadcasts received yet.</div>
  </div>

  <script>
    async function updateData() {
      try {
        const res = await fetch('/api/data');
        if (!res.ok) return;
        const data = await res.json();

        document.getElementById('rx-count').innerText = data.rx_count;
        document.getElementById('last-rssi').innerText = data.last_rssi ? (data.last_rssi + ' dBm') : '--';
        document.getElementById('last-snr').innerText = data.last_snr ? (data.last_snr + ' dB') : '--';
        document.getElementById('uptime').innerText = 'Uptime: ' + data.uptime_sec + 's';
        
        // Render SOS
        const sosContainer = document.getElementById('sos-list');
        document.getElementById('sos-badge').innerText = data.sos.length + ' Received';
        if (data.sos.length === 0) {
          sosContainer.innerHTML = '<div class="empty-state">No SOS distress packets received yet. Outpost is monitoring 433 MHz channel...</div>';
        } else {
          sosContainer.innerHTML = data.sos.map(s => `
            <div class="card card-sos">
              <div class="card-header">
                <span class="badge badge-red">EMERGENCY SOS</span>
                <span class="card-meta">ID: ${s.id} &bull; Origin: ${s.node}</span>
              </div>
              <div class="card-body">
                <div>⚠️ <strong>${s.people} Person(s)</strong> in immediate danger</div>
                <div style="font-size: 0.85rem; color: #cbd5e1; margin-top: 4px;">&ldquo;${s.notes}&rdquo;</div>
              </div>
              <div class="card-footer">
                <span>📶 RSSI: ${s.rssi} dBm</span>
                <span>📡 SNR: ${s.snr} dB</span>
                <span>⏱️ ${Math.round((Date.now() - s.time) / 1000)}s ago</span>
              </div>
            </div>
          `).join('');
        }

        // Render Messages
        const msgContainer = document.getElementById('msg-list');
        document.getElementById('msg-badge').innerText = data.messages.length + ' Messages';
        if (data.messages.length === 0) {
          msgContainer.innerHTML = '<div class="empty-state">No admin text broadcasts received yet.</div>';
        } else {
          msgContainer.innerHTML = data.messages.map(m => {
            const badgeClass = m.priority === 'CRITICAL' ? 'badge-red' : m.priority === 'HIGH' ? 'badge-amber' : 'badge-blue';
            return `
              <div class="card card-msg">
                <div class="card-header">
                  <span class="badge ${badgeClass}">${m.priority}</span>
                  <span class="card-meta">ID: ${m.id}</span>
                </div>
                <div class="card-body">
                  ${m.text}
                </div>
                <div class="card-footer">
                  <span>📶 RSSI: ${m.rssi} dBm</span>
                  <span>📡 SNR: ${m.snr} dB</span>
                  <span>⏱️ ${Math.round((Date.now() - m.time) / 1000)}s ago</span>
                </div>
              </div>
            `;
          }).join('');
        }

      } catch (err) {
        console.warn('Polling error:', err);
      }
    }

    setInterval(updateData, 2000);
    updateData();
  </script>
</body>
</html>
)rawliteral";

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

String extractField(const String& data, const String& key) {
  int startIdx = data.indexOf(key + ":");
  if (startIdx == -1) return "";
  startIdx += key.length() + 1;
  int endIdx = data.indexOf("|", startIdx);
  if (endIdx == -1) endIdx = data.length();
  return data.substring(startIdx, endIdx);
}

void parseLoRaPacket(const String& packet, int rssi, float snr) {
  totalPacketsRx++;
  lastRssi = rssi;
  lastSnr = snr;

  Serial.println("\n========================================================");
  Serial.printf("[LoRa-RX #%lu] Packet Received (RSSI: %d dBm, SNR: %.1f dB)\n", totalPacketsRx, rssi, snr);
  Serial.printf("[RAW] %s\n", packet.c_str());

  if (packet.startsWith("[EMESH:SOS]")) {
    String id = extractField(packet, "ID");
    String node = extractField(packet, "NODE");
    int people = extractField(packet, "PPL").toInt();
    String notes = extractField(packet, "NOTES");

    if (people <= 0) people = 1;

    Serial.println(">>> 🚨 EMERGENCY SOS DISTRESS ALERT RECEIVED! <<<");
    Serial.printf("  Alert ID     : %s\n", id.c_str());
    Serial.printf("  Origin Node  : %s\n", node.c_str());
    Serial.printf("  People Count : %d\n", people);
    Serial.printf("  Distress Note: %s\n", notes.c_str());

    // Shift buffer and insert newest at index 0
    for (int i = min(sosCount, MAX_RECORDS - 1); i > 0; i--) {
      sosBuffer[i] = sosBuffer[i - 1];
    }
    sosBuffer[0] = { id, node, people, notes, rssi, snr, millis() };
    if (sosCount < MAX_RECORDS) sosCount++;

    blinkLed(4, 50); // Fast alert flash

  } else if (packet.startsWith("[EMESH:MSG]")) {
    String id = extractField(packet, "ID");
    String priority = extractField(packet, "PRI");
    String text = extractField(packet, "TXT");

    Serial.println(">>> 📢 ADMIN EMERGENCY BROADCAST RECEIVED! <<<");
    Serial.printf("  Message ID : %s\n", id.c_str());
    Serial.printf("  Priority   : %s\n", priority.c_str());
    Serial.printf("  Broadcast  : %s\n", text.c_str());

    // Check for duplicate recent message
    if (msgCount == 0 || msgBuffer[0].id != id) {
      for (int i = min(msgCount, MAX_RECORDS - 1); i > 0; i--) {
        msgBuffer[i] = msgBuffer[i - 1];
      }
      msgBuffer[0] = { id, priority, text, rssi, snr, millis() };
      if (msgCount < MAX_RECORDS) msgCount++;
    }

    blinkLed(2, 100);
  } else {
    Serial.println("[LoRa-RX] Unrecognized packet format.");
  }
  Serial.println("========================================================\n");
}

// ============================================================================
// Web Server Route Handlers
// ============================================================================
void handleRoot() {
  server.send_P(200, "text/html", INDEX_HTML);
}

void handleApiData() {
  String json = "{";
  json += "\"rx_count\":" + String(totalPacketsRx) + ",";
  json += "\"last_rssi\":" + String(lastRssi) + ",";
  json += "\"last_snr\":" + String(lastSnr, 1) + ",";
  json += "\"uptime_sec\":" + String(millis() / 1000) + ",";

  // SOS Alerts
  json += "\"sos\":[";
  for (int i = 0; i < sosCount; i++) {
    json += "{";
    json += "\"id\":\"" + sosBuffer[i].id + "\",";
    json += "\"node\":\"" + sosBuffer[i].node + "\",";
    json += "\"people\":" + String(sosBuffer[i].people) + ",";
    json += "\"notes\":\"" + sosBuffer[i].notes + "\",";
    json += "\"rssi\":" + String(sosBuffer[i].rssi) + ",";
    json += "\"snr\":" + String(sosBuffer[i].snr, 1) + ",";
    json += "\"time\":" + String(sosBuffer[i].timestamp);
    json += "}";
    if (i < sosCount - 1) json += ",";
  }
  json += "],";

  // Messages
  json += "\"messages\":[";
  for (int i = 0; i < msgCount; i++) {
    json += "{";
    json += "\"id\":\"" + msgBuffer[i].id + "\",";
    json += "\"priority\":\"" + msgBuffer[i].priority + "\",";
    json += "\"text\":\"" + msgBuffer[i].text + "\",";
    json += "\"rssi\":" + String(msgBuffer[i].rssi) + ",";
    json += "\"snr\":" + String(msgBuffer[i].snr, 1) + ",";
    json += "\"time\":" + String(msgBuffer[i].timestamp);
    json += "}";
    if (i < msgCount - 1) json += ",";
  }
  json += "]";

  json += "}";
  server.send(200, "application/json", json);
}

// ============================================================================
// Setup & Loop
// ============================================================================
void setup() {
  Serial.begin(115200);
  pinMode(STATUS_LED, OUTPUT);
  digitalWrite(STATUS_LED, LOW);

  delay(1500);

  Serial.println("\n========================================================");
  Serial.println("      E-MESH LORA BRIDGE — RECEIVER NODE (433 MHz)      ");
  Serial.printf ("  Board Architecture : %s\n", BOARD_NAME);
  Serial.printf ("  SoftAP SSID        : %s\n", AP_SSID);
  Serial.printf ("  Web Dashboard IP   : http://192.168.4.1\n");
  Serial.printf ("  LoRa Frequency     : %.1f MHz (India ISM)\n", LORA_FREQUENCY / 1E6);
  Serial.println("========================================================\n");

  // 1. Initialize LoRa
  SPI.begin(LORA_SCK, LORA_MISO, LORA_MOSI, LORA_CS);
  LoRa.setPins(LORA_CS, LORA_RST, LORA_DIO0);

  while (!LoRa.begin(LORA_FREQUENCY)) {
    Serial.println("[LoRa] ERROR: SX1278 initialization failed! Check wiring & 3.3V power.");
    blinkLed(1, 1000);
    delay(2000);
  }

  // RF Reception Settings
  LoRa.setSpreadingFactor(7);
  LoRa.setSignalBandwidth(125E3);
  LoRa.setCodingRate4(5);
  LoRa.setSyncWord(0x34); // Match Sender Sync Word
  LoRa.enableCrc();

  Serial.println("[LoRa] SX1278 listening on 433.0 MHz.");

  // 2. Start Wi-Fi SoftAP
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASSWORD);
  IPAddress apIP = WiFi.softAPIP();
  Serial.printf("[SoftAP] Outpost Wi-Fi active: %s\n", AP_SSID);
  Serial.printf("[SoftAP] Access Emergency UI at: http://%s\n", apIP.toString().c_str());

  // 3. Start Web Server
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/data", HTTP_GET, handleApiData);
  server.begin();
  Serial.println("[HTTP] Web server started on port 80.");

  blinkLed(3, 80);
}

void loop() {
  // Handle incoming HTTP client requests
  server.handleClient();

  // Check for incoming LoRa packet
  int packetSize = LoRa.parsePacket();
  if (packetSize) {
    String incoming = "";
    while (LoRa.available()) {
      incoming += (char)LoRa.read();
    }
    int rssi = LoRa.packetRssi();
    float snr = LoRa.packetSnr();

    parseLoRaPacket(incoming, rssi, snr);
  }

  delay(5);
}
