/**
 * E-Mesh Client Application Logic
 */

// ── State & Routing ──────────────────────────────────────────────────────
let currentUser = null;

const views = ['login', 'register', 'dashboard', 'sos', 'incident', 'tracking', 'community', 'profile'];

function navigate(viewId) {
  views.forEach(v => {
    const el = document.getElementById(`view-${v}`);
    if (el) {
      if (v === viewId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    }
  });

  // Call lifecycle hooks
  if (viewId === 'dashboard') loadDashboard();
  if (viewId === 'tracking') loadTracking();
  if (viewId === 'community') loadCommunity();
  if (viewId === 'profile') loadProfile();
  
  // Start or ensure global polling is running
  startGlobalPolling();

  // Scroll to top
  window.scrollTo(0, 0);
}

// ── Toast Notifications ──────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
  let icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>';
  if (type === 'error') {
    icon = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>';
  }
  
  toast.innerHTML = `${icon} <span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// ── Modals ───────────────────────────────────────────────────────────────
function showModal(title, bodyHtml) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ── Initialization & Auth ────────────────────────────────────────────────
async function init() {
  // Auth expired listener
  window.addEventListener('emesh:auth_expired', () => {
    currentUser = null;
    API.stopLocationTracking();
    showToast("Session expired, please login again", "error");
    navigate('login');
  });

  // Check auth
  if (API.token) {
    try {
      currentUser = await API.getMe();
      updateNav();
      navigate('dashboard');
      // Resume GPS tracking if already logged in
      API.startLocationTracking();
    } catch (e) {
      API.clearTokens();
      navigate('login');
    }
  } else {
    navigate('login');
  }

  // Real-time Community Chat
  window.addEventListener('emesh:community_message', (e) => {
    appendCommunityMessage(e.detail);
  });

  setupEventListeners();
}

function updateNav() {
  const authNav = document.getElementById('nav-auth');
  const userNav = document.getElementById('nav-user');
  const gpsIndicator = document.getElementById('gps-indicator');

  if (currentUser) {
    authNav.classList.add('hidden');
    userNav.classList.remove('hidden');
    document.getElementById('nav-username').textContent = currentUser.username;
    // GPS indicator is now unhidden by api.js only upon successful GPS lock
  } else {
    authNav.classList.remove('hidden');
    userNav.classList.add('hidden');
    if (gpsIndicator) gpsIndicator.classList.add('hidden');
  }
}

// ── Data Loading ─────────────────────────────────────────────────────────
async function loadDashboard() {
  const container = document.getElementById('announcements-feed');
  container.innerHTML = '<div class="text-center text-muted mt-4"><div class="spinner mx-auto"></div> Loading...</div>';
  
  try {
    const data = await API.getAnnouncements();
    if (data.data.length === 0) {
      container.innerHTML = '<div class="text-center text-muted mt-4">No active announcements</div>';
      return;
    }
    
    container.innerHTML = data.data.map(ann => `
      <div class="feed-item priority-${ann.priority.toLowerCase()}">
        <div class="feed-header">
          <span class="feed-title">${ann.title}</span>
          <span class="feed-time">${new Date(ann.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="feed-body">${ann.message}</div>
      </div>
    `).join('');
  } catch (e) {
    container.innerHTML = `<div class="text-danger text-center mt-4">Failed to load: ${e.message}</div>`;
  }
}

async function loadTracking() {
  const container = document.getElementById('tracking-feed');
  container.innerHTML = '<div class="text-center text-muted mt-4"><div class="spinner mx-auto"></div> Loading requests...</div>';
  
  try {
    const [sosData, incidentData] = await Promise.all([
      API.getMySOS(),
      API.getMyIncidents()
    ]);
    
    let html = '';
    
    if (sosData.data.length === 0 && incidentData.data.length === 0) {
      container.innerHTML = '<div class="text-center text-muted mt-4">No requests found</div>';
      return;
    }

    sosData.data.forEach(sos => {
      let badgeClass = sos.status === 'ACTIVE' ? 'badge-danger' : 
                       sos.status === 'ACKNOWLEDGED' ? 'badge-warning' : 'badge-success';
      html += `
        <div class="card mb-4">
          <div class="flex justify-between items-center mb-2">
            <h3 class="text-danger">SOS Request</h3>
            <span class="badge ${badgeClass}">${sos.status}</span>
          </div>
          <p class="text-muted text-sm mb-2">${new Date(sos.created_at).toLocaleString()}</p>
          <p>${sos.notes || 'No additional notes'}</p>
          <p class="mt-2 text-sm"><strong>People affected:</strong> ${sos.people_count}</p>
        </div>
      `;
    });

    incidentData.data.forEach(inc => {
      let badgeClass = inc.status === 'SUBMITTED' ? 'badge-info' : 
                       inc.status === 'ACKNOWLEDGED' ? 'badge-warning' : 'badge-success';
      html += `
        <div class="card mb-4">
          <div class="flex justify-between items-center mb-2">
            <h3>Incident: ${inc.category.replace('_', ' ')}</h3>
            <span class="badge ${badgeClass}">${inc.status}</span>
          </div>
          <p class="text-muted text-sm mb-2">${new Date(inc.created_at).toLocaleString()} • Priority: ${inc.priority}</p>
          <p>${inc.description}</p>
        </div>
      `;
    });
    
    container.innerHTML = html;
  } catch (e) {
    container.innerHTML = `<div class="text-danger text-center mt-4">Failed to load: ${e.message}</div>`;
  }
}

const renderedMessageIds = new Set();

async function loadCommunity() {
  const container = document.getElementById('community-feed');
  container.innerHTML = '<div class="text-center text-muted mt-4"><div class="spinner mx-auto"></div> Loading messages...</div>';
  
  try {
    renderedMessageIds.clear();
    const data = await API.getCommunityMessages();
    if (data.data.length === 0) {
      container.innerHTML = '<div class="text-center text-muted mt-4" id="community-empty">No messages yet. Start the conversation!</div>';
      return;
    }
    
    container.innerHTML = '';
    data.data.forEach(msg => appendCommunityMessage(msg, false));
    
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    container.innerHTML = `<div class="text-danger text-center mt-4">Failed to load: ${e.message}</div>`;
  }
}

// ── Global Real-time Polling (500ms) ──────────────────────────────────────
let globalPollInterval = null;

function startGlobalPolling() {
  if (globalPollInterval) clearInterval(globalPollInterval);
  globalPollInterval = setInterval(async () => {
    if (!currentUser) return;
    
    try {
      if (document.getElementById('view-dashboard')?.classList.contains('active')) {
        const data = await API.getAnnouncements();
        const container = document.getElementById('announcements-feed');
        if (data.data.length === 0) {
          const empty = '<div class="text-center text-muted mt-4">No active announcements</div>';
          if (container.innerHTML !== empty) container.innerHTML = empty;
          return;
        }
        const html = data.data.map(ann => `
          <div class="feed-item priority-${ann.priority.toLowerCase()}">
            <div class="feed-header">
              <span class="feed-title">${ann.title}</span>
              <span class="feed-time">${new Date(ann.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <div class="feed-body">${ann.message}</div>
          </div>
        `).join('');
        if (container.innerHTML !== html) container.innerHTML = html;
      } 
      else if (document.getElementById('view-tracking')?.classList.contains('active')) {
        const [sosData, incidentData] = await Promise.all([
          API.getMySOS(),
          API.getMyIncidents()
        ]);
        const container = document.getElementById('tracking-feed');
        let html = '';
        if (sosData.data.length === 0 && incidentData.data.length === 0) {
          const empty = '<div class="text-center text-muted mt-4">No requests found</div>';
          if (container.innerHTML !== empty) container.innerHTML = empty;
          return;
        }
        sosData.data.forEach(sos => {
          let badgeClass = sos.status === 'ACTIVE' ? 'badge-danger' : 
                           sos.status === 'ACKNOWLEDGED' ? 'badge-warning' : 'badge-success';
          html += `
            <div class="card mb-4">
              <div class="flex justify-between items-center mb-2">
                <h3 class="text-danger">SOS Request</h3>
                <span class="badge ${badgeClass}">${sos.status}</span>
              </div>
              <p class="text-muted text-sm mb-2">${new Date(sos.created_at).toLocaleString()}</p>
              <p>${sos.notes || 'No additional notes'}</p>
              <p class="mt-2 text-sm"><strong>People affected:</strong> ${sos.people_count}</p>
            </div>
          `;
        });
        incidentData.data.forEach(inc => {
          let badgeClass = inc.status === 'SUBMITTED' ? 'badge-info' : 
                           inc.status === 'ACKNOWLEDGED' ? 'badge-warning' : 'badge-success';
          html += `
            <div class="card mb-4">
              <div class="flex justify-between items-center mb-2">
                <h3>Incident: ${inc.category.replace('_', ' ')}</h3>
                <span class="badge ${badgeClass}">${inc.status}</span>
              </div>
              <p class="text-muted text-sm mb-2">${new Date(inc.created_at).toLocaleString()} • Priority: ${inc.priority}</p>
              <p>${inc.description}</p>
            </div>
          `;
        });
        if (container.innerHTML !== html) container.innerHTML = html;
      }
      else if (document.getElementById('view-community')?.classList.contains('active')) {
        const pollData = await API.getCommunityMessages();
        pollData.data.forEach(msg => {
          if (!renderedMessageIds.has(msg.id)) {
            appendCommunityMessage(msg, true);
          }
        });
      }
    } catch (e) {
      // silent fail on poll
    }
  }, 500);
}

function appendCommunityMessage(msg, scroll = true) {
  if (renderedMessageIds.has(msg.id)) return;
  renderedMessageIds.add(msg.id);

  const container = document.getElementById('community-feed');
  const emptyPlaceholder = document.getElementById('community-empty');
  if (emptyPlaceholder) emptyPlaceholder.remove();
  
  if (container.innerHTML.includes("Failed to load") || container.innerHTML.includes("Loading messages")) {
    container.innerHTML = '';
  }

  const isMe = currentUser && msg.sender_id === currentUser.id;
  
  const wrapper = document.createElement('div');
  wrapper.className = `chat-bubble-wrapper ${isMe ? 'me' : 'other'}`;
  
  const timeStr = new Date(msg.sent_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  const senderHtml = `<div class="chat-sender">${isMe ? 'You' : '@' + msg.sender_username}</div>`;
  
  wrapper.innerHTML = `
    ${senderHtml}
    <div class="chat-bubble">${msg.content}</div>
    <div class="chat-time">${timeStr}</div>
  `;
  
  container.appendChild(wrapper);
  
  if (scroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function loadProfile() {
  const container = document.getElementById('profile-container');
  if (!currentUser) return;
  
  container.innerHTML = `
    <div class="profile-avatar">${currentUser.full_name.charAt(0).toUpperCase()}</div>
    <div class="profile-name">${currentUser.full_name}</div>
    <div class="profile-username">@${currentUser.username}</div>
    <div class="profile-role-badge">${currentUser.role}</div>
    
    <div class="profile-stat-grid mt-2">
      <div class="profile-stat-box">
        <div class="profile-stat-label">Account Status</div>
        <div class="profile-stat-value text-success">Active on Mesh</div>
      </div>
      <div class="profile-stat-box">
        <div class="profile-stat-label">Location Services</div>
        <div class="profile-stat-value" id="profile-gps-status">
          ${API._locationWatchId ? 'Tracking Active (Every 20s)' : 'Inactive'}
        </div>
      </div>
    </div>
  `;
}


// ── Event Listeners ──────────────────────────────────────────────────────
function setupEventListeners() {
  // Navigation
  document.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      navigate(btn.getAttribute('data-nav'));
    });
  });

  document.getElementById('modal-close').addEventListener('click', closeModal);

  // Forms
  document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const user = e.target.username.value;
      const pass = e.target.password.value;
      await API.login(user, pass);
      currentUser = await API.getMe();
      updateNav();
      e.target.reset();
      showToast("Logged in successfully");
      API.startLocationTracking();
      navigate('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('form-register').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const user = e.target.username.value;
      const pass = e.target.password.value;
      const name = e.target.full_name.value;
      await API.register(user, pass, name);
      // Auto login after register
      await API.login(user, pass);
      currentUser = await API.getMe();
      updateNav();
      e.target.reset();
      showToast("Registered and logged in");
      API.startLocationTracking();
      navigate('dashboard');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('form-sos').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const people = parseInt(e.target.people_count.value) || 1;
      const notes = e.target.notes.value;
      await API.sendSOS(people, notes);
      showToast("SOS Broadcasted Successfully!");
      e.target.reset();
      navigate('tracking');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('form-community-chat').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const input = e.target.message;
    const content = input.value.trim();
    if (!content) return;
    
    btn.disabled = true;
    input.disabled = true;
    try {
      const newMsg = await API.sendCommunityMessage(content);
      appendCommunityMessage(newMsg);
      e.target.reset();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      input.disabled = false;
      input.focus();
    }
  });

  document.getElementById('form-incident').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true;
    try {
      const cat = e.target.category.value;
      const prio = e.target.priority.value;
      const desc = e.target.description.value;
      const count = parseInt(e.target.people_affected.value || "0");
      await API.reportIncident(cat, prio, desc, count);
      e.target.reset();
      showToast("Incident Reported", "success");
      navigate('tracking');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // Logout
  document.getElementById('btn-logout').addEventListener('click', async () => {
    API.stopLocationTracking();
    await API.logout();
    currentUser = null;
    updateNav();
    navigate('login');
    showToast("Logged out");
  });

  // ── Live WebSocket Event Listeners ────────────────────────────────────────
  API.connectWebSocket();

  window.addEventListener('emesh:announcement_created', (e) => {
    const ann = e.detail;
    showToast(`📢 EMERGENCY BROADCAST: ${ann.title}`, 'error');
    // If dashboard is open, reload announcements
    const dashboardEl = document.getElementById('view-dashboard');
    if (dashboardEl && dashboardEl.classList.contains('active')) {
      loadDashboard();
    }
  });

  window.addEventListener('emesh:incident_updated', (e) => {
    const inc = e.detail;
    showToast(`Status updated: ${inc.status || 'Resolved'}`, 'success');
    const trackingEl = document.getElementById('view-tracking');
    if (trackingEl && trackingEl.classList.contains('active')) {
      loadTracking();
    }
  });
}

// Bootstrap
document.addEventListener('DOMContentLoaded', init);
