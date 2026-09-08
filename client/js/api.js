/**
 * E-Mesh Client API Wrapper
 * Handles backend communication, JWT auth, and token refresh.
 */

const currentHost = window.location.hostname || 'localhost';
const API_BASE = `http://${currentHost}:8000/api/v1`;

const API = {
  get token() {
    return localStorage.getItem('emesh_access_token');
  },
  get refreshToken() {
    return localStorage.getItem('emesh_refresh_token');
  },
  setTokens(access, refresh) {
    if (access) localStorage.setItem('emesh_access_token', access);
    if (refresh) localStorage.setItem('emesh_refresh_token', refresh);
  },
  clearTokens() {
    localStorage.removeItem('emesh_access_token');
    localStorage.removeItem('emesh_refresh_token');
  },

  async request(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      let response = await fetch(url, { ...options, headers });
      
      // Handle Token Expiry
      if (response.status === 401 && this.refreshToken && !options._isRetry) {
        const refreshed = await this.refreshTokens();
        if (refreshed) {
          headers['Authorization'] = `Bearer ${this.token}`;
          response = await fetch(url, { ...options, headers, _isRetry: true });
        } else {
          this.clearTokens();
          window.dispatchEvent(new Event('emesh:auth_expired'));
          throw new Error("Session expired");
        }
      }

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        let errorMsg = `Error: ${response.status}`;
        if (data) {
          if (typeof data.detail === 'string') {
            errorMsg = data.detail;
          } else if (Array.isArray(data.detail)) {
            errorMsg = data.detail.map(err => {
              const field = err.loc ? err.loc[err.loc.length - 1] : '';
              const cleanMsg = err.msg ? err.msg.replace(/^Value error,\s*/i, '') : 'Invalid value';
              return field ? `${field}: ${cleanMsg}` : cleanMsg;
            }).join(' | ');
          } else if (data.message) {
            errorMsg = data.message;
          }
        }
        throw new Error(errorMsg);
      }

      return data;
    } catch (error) {
      // If we failed to fetch entirely (network offline), throw specific error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error("Network offline or gateway unreachable");
      }
      throw error;
    }
  },

  async refreshTokens() {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: this.refreshToken })
      });
      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.access_token, data.refresh_token);
        return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  },

  // ── Auth Endpoints ───────────────────────────────────────────────────────
  async login(username, password) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    this.setTokens(data.access_token, data.refresh_token);
    return data;
  },

  async register(username, password, fullName) {
    // Civilian registration
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, full_name: fullName, role: 'CIVILIAN' })
    });
    return data;
  },

  async getMe() {
    return await this.request('/auth/me');
  },

  async logout() {
    try {
      await this.request('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore if it fails (already logged out or offline)
    }
    this.clearTokens();
  },

  // ── SOS Endpoints ────────────────────────────────────────────────────────
  async sendSOS(peopleCount, notes) {
    return await this.request('/sos', {
      method: 'POST',
      body: JSON.stringify({ people_count: peopleCount, notes: notes || undefined })
    });
  },

  async getMySOS() {
    return await this.request('/sos?page_size=50');
  },

  // ── Incident Endpoints ───────────────────────────────────────────────────
  async reportIncident(category, priority, description, peopleAffected) {
    return await this.request('/incidents', {
      method: 'POST',
      body: JSON.stringify({ 
        category, 
        priority, 
        description, 
        people_affected: peopleAffected || 0 
      })
    });
  },

  async getMyIncidents() {
    return await this.request('/incidents?page_size=50');
  },

  // ── Announcements ────────────────────────────────────────────────────────
  async getAnnouncements() {
    return await this.request('/announcements?active_only=true');
  },

  // ── Community Group Chat ────────────────────────────────────────────────
  async getCommunityMessages() {
    return await this.request('/community/messages');
  },

  async sendCommunityMessage(content) {
    return await this.request('/community/messages', {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  // ── Real-Time WebSocket Layer ───────────────────────────────────────────
  ws: null,
  wsReconnectTimer: null,

  connectWebSocket() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const token = this.token;
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProto}//${currentHost}:8000/api/v1/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('[E-Mesh WS] Connected to live mesh telemetry');
        window.dispatchEvent(new CustomEvent('emesh:ws_connected'));
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          console.log('[E-Mesh WS Event]', payload);

          // Dispatch event envelope
          window.dispatchEvent(new CustomEvent('emesh:ws_event', { detail: payload }));

          if (payload.event === 'announcement.created') {
            window.dispatchEvent(new CustomEvent('emesh:announcement_created', { detail: payload.data }));
          } else if (payload.event === 'incident.updated' || payload.event === 'incident.resolved') {
            window.dispatchEvent(new CustomEvent('emesh:incident_updated', { detail: payload.data }));
          } else if (payload.event === 'sos.created') {
            window.dispatchEvent(new CustomEvent('emesh:sos_created', { detail: payload.data }));
          } else if (payload.event === 'community.message_sent') {
            window.dispatchEvent(new CustomEvent('emesh:community_message', { detail: payload.data }));
          }
        } catch (err) {
          console.error('[E-Mesh WS] Error parsing frame', err);
        }
      };

      this.ws.onclose = () => {
        console.log('[E-Mesh WS] Disconnected. Reconnecting in 5s...');
        window.dispatchEvent(new CustomEvent('emesh:ws_disconnected'));
        clearTimeout(this.wsReconnectTimer);
        this.wsReconnectTimer = setTimeout(() => this.connectWebSocket(), 5000);
      };

      this.ws.onerror = (err) => {
        console.warn('[E-Mesh WS] Connection error', err);
      };
    } catch (err) {
      console.warn('[E-Mesh WS] Unable to create socket', err);
    }
  },

  // ── GPS Location Tracking ─────────────────────────────────────────────────
  _locationWatchId: null,
  _locationIntervalId: null,
  _lastPosition: null,

  async updateLocation(lat, lng, accuracy) {
    if (!this.token) return;
    try {
      await this.request('/location', {
        method: 'POST',
        body: JSON.stringify({ latitude: lat, longitude: lng, accuracy: accuracy || null })
      });
    } catch (e) {
      // Silent — location update failure should never interrupt the UX
    }
  },

  startLocationTracking() {
    if (!navigator.geolocation) {
      if (typeof showToast === 'function') {
        showToast("GPS not supported (needs HTTPS or localhost)", "error");
      }
      console.error("[E-Mesh] navigator.geolocation is undefined. You must use HTTPS or localhost.");
      return;
    }
    if (this._locationWatchId !== null) return; // already tracking

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      this._lastPosition = { latitude, longitude, accuracy };
      this.updateLocation(latitude, longitude, accuracy);
      
      // Update UI indicator if it exists
      const indicator = document.getElementById('gps-indicator');
      if (indicator) indicator.classList.remove('hidden');
    };

    const onError = (err) => {
      console.warn('[E-Mesh] GPS Error:', err.message);
      if (typeof showToast === 'function' && err.code === 1) { // 1 = PERMISSION_DENIED
        showToast("GPS Permission Denied", "error");
      }
      
      // Hide UI indicator if we can't get location
      const indicator = document.getElementById('gps-indicator');
      if (indicator && !this._lastPosition) indicator.classList.add('hidden');
    };

    // Use false for high accuracy to ensure we get a fast network/wifi lock if GPS satellite isn't available indoors
    const opts = { enableHighAccuracy: false, maximumAge: 15000, timeout: 10000 };

    // watchPosition for real-time GPS updates
    this._locationWatchId = navigator.geolocation.watchPosition(onSuccess, onError, opts);

    // 20-second interval backup (resends last known position to keep the server heartbeat alive)
    this._locationIntervalId = setInterval(() => {
      if (this._lastPosition) {
        this.updateLocation(
          this._lastPosition.latitude,
          this._lastPosition.longitude,
          this._lastPosition.accuracy
        );
      } else {
        // Try a one-shot getCurrentPosition if watchPosition hasn't fired yet
        navigator.geolocation.getCurrentPosition(onSuccess, onError, opts);
      }
    }, 20000);

    console.log('[E-Mesh] GPS location tracking started');
  },

  stopLocationTracking() {
    if (this._locationWatchId !== null) {
      navigator.geolocation.clearWatch(this._locationWatchId);
      this._locationWatchId = null;
    }
    if (this._locationIntervalId !== null) {
      clearInterval(this._locationIntervalId);
      this._locationIntervalId = null;
    }
    this._lastPosition = null;

    // Optionally clear location from server on logout
    if (this.token) {
      this.request('/location/me', { method: 'DELETE' }).catch(() => {});
    }

    console.log('[E-Mesh] GPS location tracking stopped');
  }
};
