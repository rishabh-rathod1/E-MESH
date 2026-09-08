/**
 * @file comms.h
 * @brief Backend communication interface (HTTP telemetry).
 *
 * Provides functions to send node heartbeat, GPS coordinates,
 * and SOS alerts to the FastAPI backend running on the Radxa SBC.
 */

#pragma once

#include "peripheral_gps.h"
#include <stdbool.h>

/**
 * @brief Initialize the communications module.
 *
 * Sets up the HTTP client configuration and starts the
 * heartbeat/telemetry task.
 */
void comms_init(void);

/**
 * @brief Send a heartbeat/telemetry update to the backend.
 *
 * Sends the node's identity, mesh level, connectivity status,
 * and optionally GPS data to the server.
 *
 * @param node_id   Unique node identifier.
 * @param is_root   Whether this node is currently the root.
 * @param level     Current mesh tree level.
 * @param gps       Pointer to GPS data (NULL if GPS not available).
 * @return true if the server acknowledged the request.
 */
bool comms_send_heartbeat(const char *node_id, bool is_root,
                          int level, const gps_data_t *gps);

/**
 * @brief Send an SOS alert to the backend.
 *
 * Fires an HTTP POST to the SOS endpoint with the node's location
 * and identity.
 *
 * @param node_id  Originating node ID.
 * @param gps      Pointer to GPS data (NULL if unavailable).
 * @return true if the server acknowledged the SOS.
 */
bool comms_send_sos(const char *node_id, const gps_data_t *gps);
