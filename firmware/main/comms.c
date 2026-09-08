/**
 * @file comms.c
 * @brief Backend HTTP communication implementation.
 *
 * Uses esp_http_client to send JSON payloads to the FastAPI backend.
 * All requests are fire-and-forget with basic retry logic.
 *
 * IMPORTANT: The FastAPI backend handles all user-facing authentication
 * (JWT, RBAC). The ESP32 nodes do NOT authenticate themselves.
 * Traffic originates from inside the private Radxa hotspot network,
 * so the server trusts it implicitly.
 */

#include "comms.h"
#include "mesh_config.h"

#include <string.h>
#include <stdio.h>

#include "esp_http_client.h"
#include "esp_log.h"

static const char *TAG = "COMMS";

/* Maximum JSON payload size */
#define JSON_BUF_SIZE   512

/* Maximum retries for a failed HTTP request */
#define MAX_RETRIES     2

/* ── Internal Helpers ───────────────────────────────────────────────────── */

/**
 * @brief Build a URL for a given API path.
 * @param path  API path (e.g., "/api/v1/nodes")
 * @param buf   Output buffer.
 * @param len   Buffer size.
 */
static void build_url(const char *path, char *buf, size_t len)
{
    snprintf(buf, len, "http://%s:%d%s", SERVER_IP, SERVER_PORT, path);
}

/**
 * @brief Send an HTTP POST request with a JSON body.
 * @param url   Full URL string.
 * @param json  JSON payload string.
 * @return HTTP status code, or -1 on failure.
 */
static int http_post_json(const char *url, const char *json)
{
    esp_http_client_config_t config = {
        .url = url,
        .method = HTTP_METHOD_POST,
        .timeout_ms = 5000,
    };

    esp_http_client_handle_t client = esp_http_client_init(&config);
    if (!client) {
        ESP_LOGE(TAG, "Failed to init HTTP client");
        return -1;
    }

    esp_http_client_set_header(client, "Content-Type", "application/json");
    esp_http_client_set_post_field(client, json, strlen(json));

    int status_code = -1;
    for (int attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        esp_err_t err = esp_http_client_perform(client);
        if (err == ESP_OK) {
            status_code = esp_http_client_get_status_code(client);
            ESP_LOGD(TAG, "POST %s → %d", url, status_code);
            break;
        } else {
            ESP_LOGW(TAG, "POST %s failed (attempt %d/%d): %s",
                     url, attempt + 1, MAX_RETRIES + 1, esp_err_to_name(err));
        }
    }

    esp_http_client_cleanup(client);
    return status_code;
}

/* ── Public API ─────────────────────────────────────────────────────────── */

void comms_init(void)
{
    ESP_LOGI(TAG, "Communications module initialized.");
    ESP_LOGI(TAG, "  Server: http://%s:%d", SERVER_IP, SERVER_PORT);
}

bool comms_send_heartbeat(const char *node_id, bool is_root,
                          int level, const gps_data_t *gps)
{
    char url[128];
    char json[JSON_BUF_SIZE];

    /* Build the heartbeat JSON payload */
    int written;
    if (gps && gps->valid) {
        written = snprintf(json, sizeof(json),
            "{"
            "\"node_id\":\"%s\","
            "\"is_gateway\":%s,"
            "\"display_name\":\"%s\","
            "\"battery_level\":100.0,"
            "\"signal_quality\":-55.0,"
            "\"hop_count\":%d,"
            "\"position_x\":%.6f,"
            "\"position_y\":%.6f"
            "}",
            node_id,
            is_root ? "true" : "false",
            node_id,
            level,
            gps->longitude,  /* position_x = longitude */
            gps->latitude    /* position_y = latitude  */
        );
    } else {
        written = snprintf(json, sizeof(json),
            "{"
            "\"node_id\":\"%s\","
            "\"is_gateway\":%s,"
            "\"display_name\":\"%s\","
            "\"battery_level\":100.0,"
            "\"signal_quality\":-55.0,"
            "\"hop_count\":%d"
            "}",
            node_id,
            is_root ? "true" : "false",
            node_id,
            level
        );
    }

    if (written >= (int)sizeof(json)) {
        ESP_LOGW(TAG, "Heartbeat JSON truncated!");
    }

    /* POST to /api/v1/mesh/nodes (create/update) */
    build_url("/api/v1/mesh/nodes", url, sizeof(url));
    int status = http_post_json(url, json);

    /* 201 = created, 200 = updated, 409 = already exists (OK) */
    if (status == 201 || status == 200 || status == 409) {
        ESP_LOGI(TAG, "Heartbeat sent: %s (level=%d, root=%s)",
                 node_id, level, is_root ? "yes" : "no");
        return true;
    }

    ESP_LOGW(TAG, "Heartbeat failed: HTTP %d", status);
    return false;
}

bool comms_send_sos(const char *node_id, const gps_data_t *gps)
{
    char url[128];
    char json[JSON_BUF_SIZE];

    /* Build the SOS JSON payload.
     * The SOS endpoint expects: people_count, notes, origin_node_id */
    snprintf(json, sizeof(json),
        "{"
        "\"people_count\":1,"
        "\"notes\":\"Hardware SOS button pressed on node %s\","
        "\"origin_node_id\":\"%s\""
        "}",
        node_id, node_id
    );

    build_url("/api/v1/mesh/sos", url, sizeof(url));
    int status = http_post_json(url, json);

    if (status == 201 || status == 200) {
        ESP_LOGW(TAG, "🚨 SOS alert sent from node %s", node_id);
        return true;
    }

    ESP_LOGE(TAG, "SOS send failed: HTTP %d", status);
    return false;
}
