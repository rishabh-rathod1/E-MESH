/**
 * @file main.c
 * @brief E-MESH Firmware Entry Point.
 *
 * Orchestrates all subsystems:
 *  1. Mesh network (ESP-MESH-LITE with NAPT)
 *  2. GPS peripheral (optional, auto-detected)
 *  3. UI peripherals (LED, Buzzer, SOS button via ISR)
 *  4. Backend communications (HTTP telemetry)
 *
 * The main loop runs on app_main's default task. It periodically
 * sends heartbeat telemetry to the FastAPI backend and checks
 * for SOS button presses (via interrupt flag).
 */

#include <stdio.h>
#include <string.h>

#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_log.h"

#include "mesh_layer.h"
#include "mesh_config.h"
#include "board_config.h"
#include "peripheral_gps.h"
#include "peripheral_ui.h"
#include "comms.h"

static const char *TAG = "MAIN";

/**
 * @brief Signal successful boot: single short LED blink + buzzer beep.
 */
static void boot_signal(void)
{
    led_on();
    buzzer_beep(BUZZER_BEEP_SHORT_MS);
    vTaskDelay(pdMS_TO_TICKS(300));
    led_off();
}

/**
 * @brief Signal mesh connection established: double blink + double beep.
 */
static void mesh_connected_signal(void)
{
    for (int i = 0; i < 2; i++) {
        led_on();
        buzzer_beep(BUZZER_BEEP_SHORT_MS);
        vTaskDelay(pdMS_TO_TICKS(200));
        led_off();
        vTaskDelay(pdMS_TO_TICKS(200));
    }
}

/* ════════════════════════════════════════════════════════════════════════════
   Entry Point
   ════════════════════════════════════════════════════════════════════════════ */

void app_main(void)
{
    ESP_LOGI(TAG, "╔══════════════════════════════════════════╗");
    ESP_LOGI(TAG, "║   E-MESH Node Firmware v1.0              ║");
    ESP_LOGI(TAG, "║   Self-Healing Emergency Mesh Network    ║");
    ESP_LOGI(TAG, "╚══════════════════════════════════════════╝");

    /* ── 1. Initialize UI Peripherals ── */
    ESP_LOGI(TAG, "[1/4] Initializing UI peripherals...");
    ui_init();
    boot_signal();

    /* ── 2. Initialize GPS (optional, auto-detected) ── */
    ESP_LOGI(TAG, "[2/4] Initializing GPS...");
    gps_init();

    /* ── 3. Initialize Mesh Network ── */
    ESP_LOGI(TAG, "[3/4] Initializing mesh network...");
    if (mesh_init() != 0) {
        ESP_LOGE(TAG, "FATAL: Mesh initialization failed!");
        /* Flash LED rapidly to indicate error state */
        led_blink_start(100, 100);
        return; /* Cannot proceed without mesh */
    }

    /* ── 4. Initialize Communications ── */
    ESP_LOGI(TAG, "[4/4] Initializing communications...");
    comms_init();

    ESP_LOGI(TAG, "All subsystems initialized. Entering main loop.");
    ESP_LOGI(TAG, "  Node ID       : %s", mesh_get_node_id());
    ESP_LOGI(TAG, "  GPS Present   : %s", gps_is_present() ? "YES" : "NO (router-only mode)");
    ESP_LOGI(TAG, "  Heartbeat     : every %d seconds", HEARTBEAT_INTERVAL_SEC);

    /* ── Wait for mesh connection ── */
    ESP_LOGI(TAG, "Waiting for mesh connection...");
    bool was_connected = false;
    bool sos_active = false;

    /* ══════════════════════════════════════════════════════════════════════
       Main Loop
       ══════════════════════════════════════════════════════════════════════ */
    TickType_t last_heartbeat = 0;

    while (1) {
        TickType_t now = xTaskGetTickCount();
        bool connected = mesh_is_connected();

        /* ── Connection state change detection ── */
        if (connected && !was_connected) {
            ESP_LOGI(TAG, "✓ Mesh connected! Level=%d, Root=%s",
                     mesh_get_level(), mesh_is_root() ? "YES" : "NO");
            mesh_connected_signal();
            /* Send an immediate heartbeat on first connection */
            last_heartbeat = 0;
        } else if (!connected && was_connected) {
            ESP_LOGW(TAG, "✗ Mesh connection lost — waiting for reconnect...");
            led_blink_start(LED_BLINK_SLOW_MS, LED_BLINK_SLOW_MS);
        }
        was_connected = connected;

        /* ── SOS Button Check (interrupt-driven, just reading the flag) ── */
        if (sos_button_pressed()) {
            if (!sos_active) {
                ESP_LOGW(TAG, "🚨 SOS BUTTON PRESSED!");
                sos_active = true;
                sos_activate_alarm();

                /* Send SOS to backend (best effort) */
                if (connected) {
                    gps_data_t gps;
                    bool has_gps = gps_get_data(&gps);
                    comms_send_sos(mesh_get_node_id(), has_gps ? &gps : NULL);
                } else {
                    ESP_LOGW(TAG, "SOS pressed but no mesh connection — alarm local only");
                }
            } else {
                /* Second press deactivates the alarm */
                ESP_LOGI(TAG, "SOS alarm deactivated by button press.");
                sos_active = false;
                sos_deactivate_alarm();
            }
        }

        /* ── Periodic Heartbeat ── */
        if (connected) {
            TickType_t elapsed = now - last_heartbeat;
            if (elapsed >= pdMS_TO_TICKS(HEARTBEAT_INTERVAL_SEC * 1000) || last_heartbeat == 0) {
                gps_data_t gps;
                bool has_gps = gps_get_data(&gps);

                comms_send_heartbeat(
                    mesh_get_node_id(),
                    mesh_is_root(),
                    mesh_get_level(),
                    has_gps ? &gps : NULL
                );

                last_heartbeat = now;
            }

            /* If we were blinking due to disconnection, stop */
            if (!sos_active) {
                led_blink_stop();
            }
        }

        /* ── Yield to other tasks (50ms loop period) ── */
        vTaskDelay(pdMS_TO_TICKS(50));
    }
}
