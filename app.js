/* ==========================================================================
   mDash - Application Logic & State Management
   ========================================================================== */

// --- Default Configuration (Used on initial load or reset) ---
const DEFAULT_CONFIG = {
  categories: [
    {
      id: "cat-net-admin",
      name: "Network & Administration",
      icon: "fas fa-network-wired",
      items: [
        {
          id: "item-portainer",
          name: "Portainer",
          url: "https://portainer.io",
          desc: "Docker container management dashboard",
          icon: "fab fa-docker",
          color: "#2496ed"
        },
        {
          id: "item-pihole",
          name: "Pi-hole",
          url: "https://pi-hole.net",
          desc: "Network-wide ad blocker & DNS",
          icon: "fas fa-shield-halved",
          color: "#960000"
        },
        {
          id: "item-netdata",
          name: "Netdata",
          url: "https://www.netdata.cloud",
          desc: "Real-time system monitoring & health",
          icon: "fas fa-chart-line",
          color: "#03a9f4"
        },
        {
          id: "item-router",
          name: "Gateway Router",
          url: "http://192.168.1.1",
          desc: "Local network gateway portal",
          icon: "fas fa-router",
          color: "#10b981"
        }
      ]
    },
    {
      id: "cat-media",
      name: "Media & Entertainment",
      icon: "fas fa-play",
      items: [
        {
          id: "item-plex",
          name: "Plex",
          url: "https://plex.tv",
          desc: "Personal media streaming server",
          icon: "fas fa-video",
          color: "#e5a93b"
        },
        {
          id: "item-transmission",
          name: "Transmission",
          url: "https://transmissionbt.com",
          desc: "Lightweight BitTorrent client",
          icon: "fas fa-download",
          color: "#ef4444"
        },
        {
          id: "item-spotify",
          name: "Spotify",
          url: "https://spotify.com",
          desc: "Music streaming player",
          icon: "fab fa-spotify",
          color: "#1db954"
        },
        {
          id: "item-youtube",
          name: "YouTube",
          url: "https://youtube.com",
          desc: "Video sharing platform",
          icon: "fab fa-youtube",
          color: "#ff0000"
        }
      ]
    },
    {
      id: "cat-smart-home",
      name: "Smart Home & IoT",
      icon: "fas fa-house-signal",
      items: [
        {
          id: "item-hass",
          name: "Home Assistant",
          url: "https://home-assistant.io",
          desc: "Local open-source home automation",
          icon: "fas fa-home",
          color: "#41bdf5"
        },
        {
          id: "item-zigbee",
          name: "Zigbee2MQTT",
          url: "https://www.zigbee2mqtt.io",
          desc: "Zigbee to MQTT bridge interface",
          icon: "fas fa-project-diagram",
          color: "#4caf50"
        },
        {
          id: "item-tasmota",
          name: "Tasmota",
          url: "https://tasmota.github.io",
          desc: "Alternative ESP8266/ESP32 firmware portal",
          icon: "fas fa-plug",
          color: "#22c55e"
        }
      ]
    },
    {
      id: "cat-bookmarks",
      name: "Bookmarks & Productivity",
      icon: "fas fa-bookmark",
      items: [
        {
          id: "item-github",
          name: "GitHub",
          url: "https://github.com",
          desc: "Git repository host and developer tools",
          icon: "fab fa-github",
          color: "#ffffff"
        },
        {
          id: "item-gmail",
          name: "Gmail",
          url: "https://mail.google.com",
          desc: "Google email services",
          icon: "fas fa-envelope",
          color: "#ea4335"
        },
        {
          id: "item-gcal",
          name: "Google Calendar",
          url: "https://calendar.google.com",
          desc: "Personal planner and schedule coordinator",
          icon: "fas fa-calendar-days",
          color: "#4285f4"
        }
      ]
    }
  ],
  settings: {
    theme: "dark",
    bgUrl: "wallpaper.png",
    username: "kmilkos",
    searchEngine: "google",
    layout: "columns",
    catCols: "auto",
    itemCols: "auto",
    weatherEnable: true,
    weatherLocation: "",
    weatherUnit: "celsius",
    weatherLat: "",
    weatherLon: "",
    cardStyle: "default",
    accentTheme: "indigo",
    glassStyle: "balanced",
    bgTheme: "aurora",
    density: "comfortable",
    font: "outfit"
  }
};

// --- Application State ---
let state = {
  categories: [],
  settings: {},
  editMode: false
};

let serverMode = false;

let dragSrc = {
  type: null,
  categoryId: null,
  itemId: null,
  index: null
};

// --- Proxmox API State & Polling Cache ---
let proxmoxCache = {};
let proxmoxPollInterval = null;


// --- Search Engine Definitions ---
const SEARCH_ENGINES = {
  google: {
    name: "Google",
    icon: "fab fa-google",
    url: "https://www.google.com/search?q="
  },
  duckduckgo: {
    name: "DuckDuckGo",
    icon: "fas fa-search",
    url: "https://duckduckgo.com/?q="
  },
  github: {
    name: "GitHub",
    icon: "fab fa-github",
    url: "https://github.com/search?q="
  },
  wikipedia: {
    name: "Wikipedia",
    icon: "fab fa-wikipedia-w",
    url: "https://en.wikipedia.org/wiki/Special:Search?search="
  }
};

// --- Dynamic Accent Glow Helper ---
function hexToRgb(hex) {
  if (!hex) return "99, 102, 241";
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : "99, 102, 241";
}

// ==========================================================================
// Proxmox API Client & Data Cache
// ==========================================================================
async function fetchProxmoxResources(category) {
  const catId = category.id;
  if (!proxmoxCache[catId]) {
    proxmoxCache[catId] = {
      loading: true,
      error: null,
      data: null,
      lastFetched: 0,
      fetching: false
    };
  }

  // If already fetching, don't start a duplicate fetch
  if (proxmoxCache[catId].fetching) return;
  proxmoxCache[catId].fetching = true;
  proxmoxCache[catId].loading = !proxmoxCache[catId].data; // Keep showing old data if it exists, otherwise show loader
  proxmoxCache[catId].error = null;

  try {
    let response;
    if (serverMode) {
      // Fetch via Express backend proxy (bypass CORS, safe credentials)
      const token = sessionStorage.getItem("mdash_auth_token");
      const headers = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      response = await fetch(`/api/proxmox/${category.id}`, { headers });
    } else {
      // Fallback: Fetch directly from client browser (requires CORS configured on Proxmox)
      let apiUrl = category.proxmoxUrl.trim();
      if (!apiUrl) throw new Error("Proxmox API URL is empty.");

      if (!apiUrl.includes("/api2/json")) {
        apiUrl = apiUrl.replace(/\/$/, "");
        apiUrl += "/api2/json";
      }
      apiUrl = apiUrl.replace(/\/$/, "");
      
      const requestUrl = `${apiUrl}/cluster/resources?type=vm`;
      response = await fetch(requestUrl, {
        method: "GET",
        headers: {
          "Authorization": `PVEAPIToken=${category.proxmoxTokenId}=${category.proxmoxTokenSecret}`
        }
      });
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP Error ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    if (!result || !result.data) {
      throw new Error("Invalid API response format (missing data attribute).");
    }

    proxmoxCache[catId].data = result.data;
    proxmoxCache[catId].lastFetched = Date.now();
    proxmoxCache[catId].error = null;
  } catch (err) {
    console.error("Proxmox fetch error for category:", category.name, err);
    let errorMsg = err.message || "Failed to fetch from Proxmox VE API.";
    if (!serverMode && err instanceof TypeError && err.message.includes("Failed to fetch")) {
      errorMsg = "CORS Blocked or Destination Unreachable. Ensure your Proxmox server is behind a CORS-enabled proxy or this app is hosted on the same domain.";
    }
    proxmoxCache[catId].error = errorMsg;
  } finally {
    proxmoxCache[catId].fetching = false;
    proxmoxCache[catId].loading = false;
    renderDashboard();
  }
}

function startProxmoxPolling() {
  if (proxmoxPollInterval) clearInterval(proxmoxPollInterval);
  
  // Run once immediately for any proxmox categories
  state.categories.forEach(cat => {
    if (cat.type === "proxmox") {
      fetchProxmoxResources(cat);
    }
  });

  // Check every 5 seconds if a category needs to refresh
  proxmoxPollInterval = setInterval(() => {
    state.categories.forEach(cat => {
      if (cat.type === "proxmox") {
        const cache = proxmoxCache[cat.id];
        const refreshMs = (cat.proxmoxRefresh || 30) * 1000;
        const now = Date.now();
        if (!cache || (now - cache.lastFetched >= refreshMs && !cache.fetching)) {
          fetchProxmoxResources(cat);
        }
      }
    });
  }, 5000);
}
// Toast notification system
class ToastManager {
  constructor() {
    this.container = document.getElementById('toast-container');
    this.maxToasts = 3; // user preference
    this.autoDismiss = 4000; // ms
  }

  _removeToast(toast) {
    if (toast.dismissed) return;
    toast.dismissed = true;
    toast.classList.add('hide');
    const fallback = setTimeout(() => {
      toast.remove();
    }, 400);
    toast.addEventListener('animationend', () => {
      clearTimeout(fallback);
      toast.remove();
    });
  }

  show(message, type = 'info') {
    if (!this.container) return;
    // Enforce max toasts
    while (this.container.children.length >= this.maxToasts) {
      this._removeToast(this.container.firstElementChild);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.dataset.type = type;
    toast.innerHTML = `<span>${message}</span><button class="close-btn" aria-label="Close toast">&times;</button>`;
    // Close button handler
    toast.querySelector('.close-btn').addEventListener('click', () => this._removeToast(toast));
    // Pause on hover
    toast.addEventListener('mouseenter', () => {
      clearTimeout(toast.dismissTimer);
    });
    toast.addEventListener('mouseleave', () => {
      toast.dismissTimer = setTimeout(() => this._removeToast(toast), this.autoDismiss);
    });
    // Auto‑dismiss
    toast.dismissTimer = setTimeout(() => this._removeToast(toast), this.autoDismiss);
    this.container.appendChild(toast);
  }
}

// Global helper
function showToast(message, type = 'info') {
  if (!window._toastMgr) {
    window._toastMgr = new ToastManager();
  }
  window._toastMgr.show(message, type);
}

// ==========================================================================
// Initialization
// ==========================================================================
document.addEventListener("DOMContentLoaded", async () => {
  await initAppState();
  setupClock();
  setupTheme();
  initWeatherWidget();
  setupSearchEngine();
  setupDialogPolyfills();
  setupEventListeners();
  startProxmoxPolling();
  renderDashboard();
  startStatsAndStatusPolling();
  setupSidebarObserver();
});

let sidebarObserver = null;
function setupSidebarObserver() {
  const container = document.getElementById("categories-container");
  const pveSidebar = document.getElementById("proxmox-sidebar");
  
  if (!container || !pveSidebar) return;
  
  if (sidebarObserver) {
    sidebarObserver.disconnect();
  }
  
  sidebarObserver = new ResizeObserver((entries) => {
    for (let entry of entries) {
      if (window.innerWidth > 1024 && state.categories.some(c => c.type === "proxmox")) {
        const hasStandard = state.categories.some(c => c.type !== "proxmox");
        const header = document.querySelector(".dashboard-header");
        const footer = document.querySelector(".dashboard-footer");
        const headerHeight = header ? header.offsetHeight : 120;
        const footerHeight = footer ? footer.offsetHeight : 80;
        const viewportHeight = window.innerHeight - headerHeight - footerHeight - 80;
        
        if (hasStandard) {
          const containerHeight = entry.contentRect.height;
          const maxHeight = Math.min(containerHeight, viewportHeight);
          pveSidebar.style.maxHeight = `${Math.max(maxHeight, 200)}px`;
        } else {
          pveSidebar.style.maxHeight = `${Math.max(viewportHeight, 400)}px`;
        }
      } else {
        pveSidebar.style.maxHeight = "";
      }
    }
  });
  
  sidebarObserver.observe(container);
  
  // Clean up and update on window resize
  window.addEventListener("resize", () => {
    if (window.innerWidth <= 1024) {
      pveSidebar.style.maxHeight = "";
    } else if (state.categories.some(c => c.type === "proxmox")) {
      const hasStandard = state.categories.some(c => c.type !== "proxmox");
      const header = document.querySelector(".dashboard-header");
      const footer = document.querySelector(".dashboard-footer");
      const headerHeight = header ? header.offsetHeight : 120;
      const footerHeight = footer ? footer.offsetHeight : 80;
      const viewportHeight = window.innerHeight - headerHeight - footerHeight - 80;
      
      if (hasStandard) {
        const height = container.offsetHeight;
        const maxHeight = Math.min(height, viewportHeight);
        pveSidebar.style.maxHeight = `${Math.max(maxHeight, 200)}px`;
      } else {
        pveSidebar.style.maxHeight = `${Math.max(viewportHeight, 400)}px`;
      }
    }
  });
}



// Load state from local storage or set defaults
let authenticated = false;
let authEnabled = false;

function checkAdminAuth(action) {
  if (authEnabled && !authenticated) {
    const dialog = document.getElementById("login-dialog");
    const errorBox = document.getElementById("login-error-msg");
    const passInput = document.getElementById("login-password");
    if (errorBox) errorBox.style.display = "none";
    if (passInput) passInput.value = "";
    
    // Store planned action to execute post-login
    window.postLoginAction = action;
    dialog.showModal();
    return false;
  }
  
  if (typeof action === 'function') {
    action();
  }
  return true;
}

async function checkAuthStatus() {
  if (!serverMode) {
    authEnabled = false;
    authenticated = false;
    return;
  }
  try {
    const token = sessionStorage.getItem("mdash_auth_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch('/api/auth/status', { headers });
    if (response.ok) {
      const data = await response.json();
      authEnabled = data.authEnabled;
      authenticated = data.authenticated;
      
      const logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        const isProxyAuth = data.authMethod === "proxy";
        logoutBtn.style.display = (authEnabled && authenticated && !isProxyAuth) ? "inline-flex" : "none";
      }
    }
  } catch (e) {
    console.error("Error checking auth status:", e);
  }
}

// Load state from local storage or server config
async function initAppState() {
  try {
    const token = sessionStorage.getItem("mdash_auth_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const response = await fetch('/api/config', { headers });
    if (response.ok) {
      serverMode = true;
      await checkAuthStatus();
      
      let configData;
      if (authEnabled && authenticated && token) {
        // Fetch full config using token
        const fullResponse = await fetch('/api/config', {
          headers: { "Authorization": `Bearer ${token}` }
        });
        if (fullResponse.ok) {
          configData = await fullResponse.json();
        }
      }
      
      if (!configData) {
        configData = await response.json();
      }
      
      state.categories = configData.categories || [];
      state.settings = { ...DEFAULT_CONFIG.settings, ...(configData.settings || {}) };
      state.editMode = false;
      console.log("mDash loaded configuration from Express server.");
      return;
    }
  } catch (error) {
    console.warn("Express server config endpoint unavailable, falling back to localStorage:", error);
  }

  // Fallback to localStorage
  serverMode = false;
  authEnabled = false;
  authenticated = false;
  const savedState = localStorage.getItem("mdash_state");
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      state.settings = { ...DEFAULT_CONFIG.settings, ...(state.settings || {}) };
      if (!state.categories) state.categories = [ ...DEFAULT_CONFIG.categories ];
      state.editMode = false;
    } catch (e) {
      console.error("Error parsing saved state, restoring defaults", e);
      restoreDefaultsLocal();
    }
  } else {
    restoreDefaultsLocal();
  }
}

async function saveAppState() {
  if (serverMode) {
    try {
      const token = sessionStorage.getItem("mdash_auth_token");
      const headers = { 'Content-Type': 'application/json' };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(state)
      });
      if (response.ok) {
        console.log("Configuration saved to Express server.");
showToast('Configuration saved', 'success');
        return;
      }
      console.error("Failed to save configuration to Express server, status:", response.status);
showToast('Failed to save configuration', 'error');
    } catch (error) {
      console.error("Error saving configuration to Express server:", error);
    }
  }
  // Local storage fallback
  localStorage.setItem("mdash_state", JSON.stringify(state));
}

async function restoreDefaults() {
  state.categories = JSON.parse(JSON.stringify(DEFAULT_CONFIG.categories));
  state.settings = JSON.parse(JSON.stringify(DEFAULT_CONFIG.settings));
  state.editMode = false;
  await saveAppState();
}

function restoreDefaultsLocal() {
  state.categories = JSON.parse(JSON.stringify(DEFAULT_CONFIG.categories));
  state.settings = JSON.parse(JSON.stringify(DEFAULT_CONFIG.settings));
  state.editMode = false;
  localStorage.setItem("mdash_state", JSON.stringify(state));
}

// ==========================================================================
// Theme & Aesthetics Control
// ==========================================================================
function setupTheme() {
  const theme = state.settings.theme || "dark";
  const html = document.documentElement;
  
  if (theme === "system") {
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    html.setAttribute("data-theme", isDark ? "dark" : "light");
  } else {
    html.setAttribute("data-theme", theme);
  }

  // Set dynamic visual customization attributes
  html.setAttribute("data-accent-theme", state.settings.accentTheme || "indigo");
  html.setAttribute("data-glass-style", state.settings.glassStyle || "balanced");
  html.setAttribute("data-bg-theme", state.settings.bgTheme || "aurora");
  html.setAttribute("data-density", state.settings.density || "comfortable");
  html.setAttribute("data-font", state.settings.font || "outfit");

  // Handle custom background image
  const bgUrl = state.settings.bgUrl || "";
  if (bgUrl.trim() !== "") {
    document.body.style.backgroundImage = `url('${bgUrl}')`;
    document.body.classList.add("has-bg-image");
  } else {
    document.body.style.backgroundImage = "";
    document.body.classList.remove("has-bg-image");
  }

  // Handle card style (simple/borderless or default)
  const cardStyle = state.settings.cardStyle || "default";
  document.body.classList.toggle("card-style-simple", cardStyle === "simple");

  // Sync theme buttons in settings
  const themeBtns = document.querySelectorAll(".theme-btn");
  themeBtns.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-theme-val") === theme);
  });

  // Sync layout buttons in settings
  const layout = state.settings.layout || "columns";
  const layoutBtns = document.querySelectorAll(".layout-btn");
  layoutBtns.forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-layout-val") === layout);
  });

  // Apply layout style to the container
  const container = document.getElementById("categories-container");
  if (container) {
    container.classList.toggle("layout-cols", layout === "columns");
    
    // Set category columns CSS variable
    const catCols = state.settings.catCols || "auto";
    if (catCols === "auto") {
      container.style.removeProperty("--grid-cat-cols");
    } else {
      container.style.setProperty("--grid-cat-cols", `repeat(${catCols}, minmax(0, 1fr))`);
    }
  }
  
  const bookmarksContainer = document.getElementById("bookmarks-container");
  if (bookmarksContainer) {
    const bookmarkCols = state.settings.bookmarkCols || "auto";
    if (bookmarkCols === "auto") {
      bookmarksContainer.style.removeProperty("--bookmark-workspace-cols");
    } else {
      bookmarksContainer.style.setProperty("--bookmark-workspace-cols", `repeat(${bookmarkCols}, minmax(0, 1fr))`);
    }
  }
  
  document.getElementById("settings-bg-url").value = bgUrl;
  document.getElementById("settings-username").value = state.settings.username || "";
  
  // Sync the dropdown selects in settings
  document.getElementById("settings-cat-cols").value = state.settings.catCols || "auto";
  document.getElementById("settings-item-cols").value = state.settings.itemCols || "auto";
  document.getElementById("settings-bookmark-cols").value = state.settings.bookmarkCols || "auto";
  
  const settingsCardStyle = document.getElementById("settings-card-style");
  if (settingsCardStyle) {
    settingsCardStyle.value = cardStyle;
  }

  // Sync the new visual customization fields in settings modal
  const settingsAccentTheme = document.getElementById("settings-accent-theme");
  if (settingsAccentTheme) settingsAccentTheme.value = state.settings.accentTheme || "indigo";
  
  const settingsGlassStyle = document.getElementById("settings-glass-style");
  if (settingsGlassStyle) settingsGlassStyle.value = state.settings.glassStyle || "balanced";
  
  const settingsBgTheme = document.getElementById("settings-bg-theme");
  if (settingsBgTheme) settingsBgTheme.value = state.settings.bgTheme || "aurora";
  
  const settingsDensity = document.getElementById("settings-density");
  if (settingsDensity) settingsDensity.value = state.settings.density || "comfortable";
  
  const settingsFont = document.getElementById("settings-font");
  if (settingsFont) settingsFont.value = state.settings.font || "outfit";

  // Sync Weather settings
  const weatherEnable = state.settings.weatherEnable !== false; // true by default
  const weatherCheckbox = document.getElementById("settings-weather-enable");
  if (weatherCheckbox) {
    weatherCheckbox.checked = weatherEnable;
    const weatherFields = document.getElementById("weather-settings-fields");
    if (weatherFields) weatherFields.style.display = weatherEnable ? "flex" : "none";
  }
  const weatherLocationInput = document.getElementById("settings-weather-location");
  if (weatherLocationInput) {
    weatherLocationInput.value = state.settings.weatherLocation || "";
  }
  const weatherUnitSelect = document.getElementById("settings-weather-unit");
  if (weatherUnitSelect) {
    weatherUnitSelect.value = state.settings.weatherUnit || "celsius";
  }
  const weatherLatInput = document.getElementById("settings-weather-latitude");
  if (weatherLatInput) {
    weatherLatInput.value = state.settings.weatherLat || "";
  }
  const weatherLonInput = document.getElementById("settings-weather-longitude");
  if (weatherLonInput) {
    weatherLonInput.value = state.settings.weatherLon || "";
  }
}

// Listen to system theme changes in real-time if "system" theme is active
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
  if (state.settings.theme === "system") {
    document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
  }
});

// ==========================================================================
// Weather Forecast Widget
// ==========================================================================
let weatherInterval = null;

function getWeatherDetails(code) {
  switch (code) {
    case 0:
      return { desc: "Clear Sky", icon: "fas fa-sun", anim: "weather-icon-spin" };
    case 1:
      return { desc: "Mainly Clear", icon: "fas fa-cloud-sun", anim: "weather-icon-float" };
    case 2:
      return { desc: "Partly Cloudy", icon: "fas fa-cloud-sun", anim: "weather-icon-float" };
    case 3:
      return { desc: "Overcast", icon: "fas fa-cloud", anim: "weather-icon-float" };
    case 45:
    case 48:
      return { desc: "Foggy", icon: "fas fa-smog", anim: "weather-icon-float" };
    case 51:
    case 53:
    case 55:
      return { desc: "Drizzle", icon: "fas fa-cloud-rain", anim: "weather-icon-pulse" };
    case 61:
    case 63:
    case 65:
      return { desc: "Rainy", icon: "fas fa-cloud-showers-heavy", anim: "weather-icon-pulse" };
    case 71:
    case 73:
    case 75:
      return { desc: "Snowy", icon: "fas fa-snowflake", anim: "weather-icon-float" };
    case 77:
      return { desc: "Snow Grains", icon: "fas fa-snowflake", anim: "weather-icon-float" };
    case 80:
    case 81:
    case 82:
      return { desc: "Rain Showers", icon: "fas fa-cloud-rain", anim: "weather-icon-pulse" };
    case 85:
    case 86:
      return { desc: "Snow Showers", icon: "fas fa-snowflake", anim: "weather-icon-float" };
    case 95:
      return { desc: "Thunderstorm", icon: "fas fa-cloud-bolt", anim: "weather-icon-pulse" };
    case 96:
    case 99:
      return { desc: "Thunderstorm / Hail", icon: "fas fa-cloud-bolt", anim: "weather-icon-pulse" };
    default:
      return { desc: "Unknown Weather", icon: "fas fa-cloud-sun", anim: "weather-icon-float" };
  }
}

async function initWeatherWidget() {
  const widget = document.getElementById("weather-widget");
  if (!widget) return;
  
  if (weatherInterval) {
    clearInterval(weatherInterval);
    weatherInterval = null;
  }
  
  if (state.settings.weatherEnable !== true) {
    widget.style.display = "none";
    return;
  }
  
  widget.style.display = "flex";
  
  async function updateWeather() {
    try {
      let lat = state.settings.weatherLat;
      let lon = state.settings.weatherLon;
      let locationName = state.settings.weatherLocation || "";
      
      // 1. Resolve coordinates if not provided manually
      if (!lat || !lon) {
        if (locationName) {
          // Resolve city name via Open-Meteo Geocoding
          const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(locationName)}&count=1&language=en&format=json`);
          const geoData = await geoRes.json();
          if (geoData.results && geoData.results[0]) {
            const first = geoData.results[0];
            lat = first.latitude;
            lon = first.longitude;
            locationName = first.name + (first.country ? `, ${first.country}` : "");
          } else {
            throw new Error(`Location not found: ${locationName}`);
          }
        } else {
          // IP Geolocation auto-detection
          const ipRes = await fetch("https://ipapi.co/json/");
          const ipData = await ipRes.json();
          if (ipData.latitude && ipData.longitude) {
            lat = ipData.latitude;
            lon = ipData.longitude;
            locationName = ipData.city + (ipData.country_name ? `, ${ipData.country_name}` : "");
          } else {
            // Fallback to London if geocode fails
            lat = 51.5074;
            lon = -0.1278;
            locationName = "London, UK (Fallback)";
          }
        }
      } else {
        // If lat/lon are manual, clean display location
        if (!locationName) {
          locationName = `${parseFloat(lat).toFixed(2)}, ${parseFloat(lon).toFixed(2)}`;
        }
      }
      
      // 2. Fetch current weather
      const unit = state.settings.weatherUnit === "fahrenheit" ? "fahrenheit" : "celsius";
      const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&temperature_unit=${unit}`);
      const weatherData = await weatherRes.json();
      
      if (weatherData.current_weather) {
        const curr = weatherData.current_weather;
        const details = getWeatherDetails(curr.weathercode);
        
        // Render values
        const tempSpan = document.getElementById("weather-temp");
        const descSpan = document.getElementById("weather-desc");
        const locDiv = document.getElementById("weather-location");
        const iconWrapper = document.getElementById("weather-icon-wrapper");
        
        if (tempSpan) tempSpan.textContent = `${Math.round(curr.temperature)}${unit === "fahrenheit" ? "°F" : "°C"}`;
        if (descSpan) descSpan.textContent = details.desc;
        if (locDiv) {
          locDiv.textContent = locationName;
          locDiv.title = locationName;
        }
        
        // Render icon & animation
        if (iconWrapper) {
          iconWrapper.innerHTML = `<i class="${details.icon} ${details.anim}"></i>`;
        }
      }
    } catch (err) {
      console.error("Failed to update weather widget:", err);
      const descSpan = document.getElementById("weather-desc");
      if (descSpan) descSpan.textContent = "Error";
    }
  }
  
  updateWeather();
  weatherInterval = setInterval(updateWeather, 900000); // 15 minutes
}

// ==========================================================================
// Clock & Greeting Widget
// ==========================================================================
function setupClock() {
  updateTimeAndGreeting();
  setInterval(updateTimeAndGreeting, 1000);
}

function updateTimeAndGreeting() {
  const now = new Date();
  
  // Format Time: HH:MM:SS
  const hrs = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  document.getElementById("clock-time").textContent = `${hrs}:${mins}:${secs}`;
  
  // Format Date: e.g., Friday, May 22, 2026
  const dateOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  document.getElementById("clock-date").textContent = now.toLocaleDateString('en-US', dateOptions);
  
  // Dynamic Greeting based on time
  const currentHour = now.getHours();
  let greet = "Hello";
  if (currentHour < 12) {
    greet = "Good morning";
  } else if (currentHour < 18) {
    greet = "Good afternoon";
  } else {
    greet = "Good evening";
  }
  
  const user = state.settings.username || "kmilkos";
  document.getElementById("welcome-message").textContent = `${greet}, ${user}`;
}

// ==========================================================================
// Search Engine Integration
// ==========================================================================
function setupSearchEngine() {
  const selectedEngine = state.settings.searchEngine || "google";
  const engineDef = SEARCH_ENGINES[selectedEngine] || SEARCH_ENGINES.google;
  
  // Update UI icons & selections
  document.getElementById("selected-engine-icon").className = engineDef.icon;
  
  const options = document.querySelectorAll(".engine-option");
  options.forEach(opt => {
    const isCurrent = opt.getAttribute("data-engine") === selectedEngine;
    opt.classList.toggle("active", isCurrent);
    opt.setAttribute("aria-selected", isCurrent ? "true" : "false");
  });
}

// ==========================================================================
// Dialogue / Modal Handlers (HTML Dialog with light dismiss fallbacks)
// ==========================================================================
function setupDialogPolyfills() {
  const dialogs = document.querySelectorAll("dialog");
  
  dialogs.forEach(dialog => {
    // Backdrop click fallback for browsers without native closedby="any" support
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        
        const rect = dialog.getBoundingClientRect();
        const isDialogContent = (
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width
        );
        
        if (!isDialogContent) {
          dialog.close();
        }
      });
    }
  });

  // Assign close click handlers
  document.querySelectorAll("[data-close-dialog]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const dialog = e.target.closest("dialog");
      if (dialog) dialog.close();
    });
  });
}

// ==========================================================================
// Dynamic Icon Resolver & Renderer Helpers
// ==========================================================================
const svgCache = {};

function renderSvgText(svgText, container, color) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.querySelector("svg");
  if (svg) {
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.display = "block";
    
    // Reset core fill/stroke attributes to let styles take precedence
    svg.removeAttribute("fill");
    svg.removeAttribute("stroke");
    svg.style.fill = color || "currentColor";
    svg.style.color = color || "currentColor";
    
    const elements = svg.querySelectorAll("path, circle, rect, polygon, ellipse, line, polyline");
    elements.forEach(el => {
      const fillVal = el.getAttribute("fill");
      if (fillVal !== "none") {
        el.setAttribute("fill", color || "currentColor");
      }
      const strokeVal = el.getAttribute("stroke");
      if (strokeVal && strokeVal !== "none") {
        el.setAttribute("stroke", color || "currentColor");
      }
    });
    
    container.innerHTML = "";
    container.appendChild(svg);
  } else {
    container.innerHTML = '<i class="fas fa-link"></i>';
  }
}

function loadSvgColored(url, container, color) {
  // Temporary loading spinning state
  container.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
  
  if (svgCache[url]) {
    renderSvgText(svgCache[url], container, color);
    return;
  }
  
  fetch(url)
    .then(res => {
      if (!res.ok) throw new Error();
      return res.text();
    })
    .then(text => {
      svgCache[url] = text;
      renderSvgText(text, container, color);
    })
    .catch(() => {
      container.innerHTML = '<i class="fas fa-link"></i>';
    });
}

function parseIconSpec(iconStr) {
  if (!iconStr) {
    return { type: "fontawesome", class: "fas fa-link" };
  }
  
  iconStr = iconStr.trim();
  
  // Absolute URLs (e.g. remote https://...) or absolute local paths
  if (iconStr.startsWith("http://") || iconStr.startsWith("https://") || iconStr.startsWith("data:") || iconStr.startsWith("/")) {
    return { type: "image", url: iconStr };
  }
  
  // Material Design Icons (mdi-XX or mdi-XX-#color)
  if (iconStr.startsWith("mdi-")) {
    const match = iconStr.match(/^mdi-([a-zA-Z0-9-]+)(?:-(#[a-fA-F0-9]{3,8}))?$/);
    if (match) {
      const name = match[1];
      const color = match[2];
      return {
        type: "svg-colored",
        url: `https://cdn.jsdelivr.net/npm/@mdi/svg@7.4.47/svg/${name}.svg`,
        color: color
      };
    }
  }
  
  // Simple Icons (si-XX or si-XX-#color)
  if (iconStr.startsWith("si-")) {
    const match = iconStr.match(/^si-([a-zA-Z0-9-]+)(?:-(#[a-fA-F0-9]{3,8}))?$/);
    if (match) {
      const name = match[1];
      const color = match[2];
      return {
        type: "svg-colored",
        url: `https://cdn.jsdelivr.net/npm/simple-icons@latest/icons/${name}.svg`,
        color: color
      };
    }
  }
  
  // selfh.st/icons (sh-XX or sh-XX.ext)
  if (iconStr.startsWith("sh-")) {
    const match = iconStr.match(/^sh-([a-zA-Z0-9-]+)(?:\.(svg|png|webp))?$/);
    if (match) {
      const name = match[1];
      const ext = match[2] || "png";
      return {
        type: "image",
        url: `https://cdn.jsdelivr.net/gh/selfhst/icons/${ext}/${name}.${ext}`
      };
    }
  }

  // homarr-labs/dashboard-icons (da-XX or da-XX.ext)
  if (iconStr.startsWith("da-")) {
    const match = iconStr.match(/^da-([a-zA-Z0-9-]+)(?:\.(svg|png|webp))?$/);
    if (match) {
      const name = match[1];
      const ext = match[2] || "png";
      return {
        type: "image",
        url: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/${ext}/${name}.${ext}`
      };
    }
  }
  
  // FontAwesome class name
  if (iconStr.includes(" ") || iconStr.startsWith("fa-")) {
    return { type: "fontawesome", class: iconStr };
  }
  
  // Default: Dashboard Icons (with or without extension)
  const dotIndex = iconStr.lastIndexOf(".");
  let name = iconStr;
  let ext = "png";
  if (dotIndex !== -1) {
    name = iconStr.substring(0, dotIndex);
    ext = iconStr.substring(dotIndex + 1);
  }
  return {
    type: "image",
    url: `https://cdn.jsdelivr.net/gh/walkxcode/dashboard-icons/${ext}/${name}.${ext}`
  };
}

function renderIconInto(iconStr, container, isSimpleMode, itemName, defaultColor) {
  const spec = parseIconSpec(iconStr);
  
  if (spec.type === "fontawesome") {
    const i = document.createElement("i");
    i.className = spec.class;
    if (isSimpleMode) {
      i.style.fontSize = "1rem";
    }
    container.appendChild(i);
  } else if (spec.type === "image") {
    const img = document.createElement("img");
    img.src = spec.url;
    img.alt = itemName;
    if (isSimpleMode) {
      img.style.width = "1.2rem";
      img.style.height = "1.2rem";
      img.style.objectFit = "contain";
    } else {
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
    }
    img.onerror = () => {
      img.style.display = "none";
      const fallback = document.createElement("i");
      fallback.className = "fas fa-link";
      container.appendChild(fallback);
    };
    container.appendChild(img);
  } else if (spec.type === "svg-colored") {
    const iconSpan = document.createElement("span");
    iconSpan.style.display = "inline-flex";
    iconSpan.style.alignItems = "center";
    iconSpan.style.justifyContent = "center";
    if (isSimpleMode) {
      iconSpan.style.width = "1.2rem";
      iconSpan.style.height = "1.2rem";
    } else {
      iconSpan.style.width = "100%";
      iconSpan.style.height = "100%";
    }
    container.appendChild(iconSpan);
    loadSvgColored(spec.url, iconSpan, spec.color || defaultColor);
  }
}

// ==========================================================================
// Uptime Formatter Helper
// ==========================================================================
function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return "stopped";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

// ==========================================================================
// IP Extractor Helper (extracts IPv4 from Proxmox tags)
// ==========================================================================
function extractIpFromResource(res) {
  if (res.tags) {
    const match = res.tags.match(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/);
    return match ? match[0] : null;
  }
  return null;
}

// ==========================================================================
// Polling for Host Stats and Link Pings
// ==========================================================================
let hostStatsInterval = null;
let linkStatusInterval = null;
let linkStatuses = {};

async function pollHostStats() {
  if (!serverMode) return;
  try {
    const token = sessionStorage.getItem("mdash_auth_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch('/api/host/stats', { headers });
    if (response.ok) {
      const data = await response.json();
      document.getElementById("host-cpu").textContent = `${data.cpu}%`;
      document.getElementById("host-ram").textContent = `${data.ram}%`;
      document.getElementById("host-uptime").textContent = formatUptime(data.uptime);
    }
  } catch (err) {
    console.error("Error polling host stats:", err);
  }
}

async function pollLinkStatuses() {
  if (!serverMode) return;
  try {
    const token = sessionStorage.getItem("mdash_auth_token");
    const headers = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    const response = await fetch('/api/status/ping', { headers });
    if (response.ok) {
      const data = await response.json();
      linkStatuses = data;
      
      // Update existing DOM status dots in real-time
      document.querySelectorAll(".status-dot").forEach(dot => {
        const itemId = dot.getAttribute("data-item-id");
        if (itemId && linkStatuses[itemId] !== undefined) {
          const isOnline = linkStatuses[itemId];
          dot.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
          
          // Toggle card dimming
          const card = dot.closest(".bookmark-card");
          if (card) {
            card.classList.toggle("is-offline", !isOnline);
          }
        }
      });
    }
  } catch (err) {
    console.error("Error polling link statuses:", err);
  }
}

function startStatsAndStatusPolling() {
  if (!serverMode) {
    const hostStatsWidget = document.querySelector(".host-stats-widget");
    if (hostStatsWidget) {
      hostStatsWidget.style.display = "none";
    }
    return;
  }
  
  // Show the stats widget
  const hostStatsWidget = document.querySelector(".host-stats-widget");
  if (hostStatsWidget) {
    hostStatsWidget.style.display = "flex";
  }

  // Poll immediately
  pollHostStats();
  pollLinkStatuses();

  // Clear existing intervals if any
  if (hostStatsInterval) clearInterval(hostStatsInterval);
  if (linkStatusInterval) clearInterval(linkStatusInterval);

  // Poll host stats every 10 seconds
  hostStatsInterval = setInterval(pollHostStats, 10000);
  
  // Poll link statuses every 30 seconds
  linkStatusInterval = setInterval(pollLinkStatuses, 30000);
}

// ==========================================================================
// Rendering Engine
// ==========================================================================
function renderDashboard() {
  const container = document.getElementById("categories-container");
  container.innerHTML = "";
  
  const pveSidebar = document.getElementById("proxmox-sidebar");
  if (pveSidebar) pveSidebar.innerHTML = "";
  
  const bookmarksContainer = document.getElementById("bookmarks-container");
  if (bookmarksContainer) bookmarksContainer.innerHTML = "";
  
  const hasProxmox = state.categories.some(c => c.type === "proxmox");
  const layoutWrapper = document.getElementById("dashboard-layout-wrapper");
  if (layoutWrapper) {
    layoutWrapper.classList.toggle("has-sidebar", hasProxmox);
  }
  
  // Apply edit mode layout modifier
  document.body.classList.toggle("edit-mode-active", state.editMode);
  
  // Toggle button text change
  const editBtnText = document.querySelector("#toggle-edit-btn .btn-text");
  if (editBtnText) {
    editBtnText.textContent = state.editMode ? "Exit Edit" : "Edit Mode";
  }

  // Iterate categories
  state.categories.forEach((category, catIndex) => {
    const section = document.createElement("section");
    section.className = "category-section";
    section.setAttribute("data-cat-id", category.id);
    
    const isDynamicDocker = category.id.startsWith('cat-docker-');

    if (state.editMode && !isDynamicDocker) {
      let sectionEnterCounter = 0;
      
      section.addEventListener("dragstart", (e) => {
        if (dragSrc.type !== "category") {
          e.preventDefault();
          return;
        }
        section.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", category.id);
      });

      section.addEventListener("dragend", () => {
        section.classList.remove("dragging");
        section.removeAttribute("draggable");
        document.querySelectorAll(".category-section").forEach(s => s.classList.remove("drag-over"));
        dragSrc = { type: null, categoryId: null, itemId: null, index: null };
      });

      section.addEventListener("dragover", (e) => {
        if (dragSrc.type === "category" || dragSrc.type === "item") {
          e.preventDefault();
        }
      });

      section.addEventListener("dragenter", (e) => {
        if (dragSrc.type === "category" && dragSrc.categoryId !== category.id) {
          sectionEnterCounter++;
          section.classList.add("drag-over");
        } else if (dragSrc.type === "item") {
          sectionEnterCounter++;
          section.classList.add("drag-over");
        }
      });

      section.addEventListener("dragleave", () => {
        if (dragSrc.type === "category" || dragSrc.type === "item") {
          sectionEnterCounter--;
          if (sectionEnterCounter <= 0) {
            sectionEnterCounter = 0;
            section.classList.remove("drag-over");
          }
        }
      });

      section.addEventListener("drop", (e) => {
        e.preventDefault();
        sectionEnterCounter = 0;
        section.classList.remove("drag-over");
        
        if (dragSrc.type === "category") {
          if (dragSrc.categoryId !== category.id) {
            moveCategoryInState(dragSrc.index, catIndex);
          }
        } else if (dragSrc.type === "item") {
          const isLastItem = category.items.length > 0 && category.items[category.items.length - 1].id === dragSrc.itemId;
          if (!isLastItem || dragSrc.categoryId !== category.id) {
            moveItemInState(dragSrc.categoryId, dragSrc.itemId, category.id, null);
          }
        }
      });
    }
    
    // Category Header
    const header = document.createElement("div");
    header.className = "category-header";

    if (state.editMode && !isDynamicDocker) {
      const dragHandle = document.createElement("div");
      dragHandle.className = "cat-drag-handle";
      dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
      dragHandle.title = "Drag to reorder category";
      
      dragHandle.addEventListener("mousedown", () => {
        section.setAttribute("draggable", "true");
        dragSrc = {
          type: "category",
          categoryId: category.id,
          index: catIndex
        };
      });
      
      dragHandle.addEventListener("mouseup", () => {
        section.removeAttribute("draggable");
      });
      
      header.appendChild(dragHandle);
    }
    
    const title = document.createElement("h2");
    title.className = "category-title";
    
    const catIcon = document.createElement("i");
    catIcon.className = category.icon || "fas fa-folder";
    title.appendChild(catIcon);
    title.appendChild(document.createTextNode(` ${category.name}`));
    
    header.appendChild(title);
    
    if (category.type === "proxmox") {
      const pveBadge = document.createElement("span");
      pveBadge.className = "proxmox-badge";
      pveBadge.style.marginLeft = "auto";
      pveBadge.style.fontSize = "0.65rem";
      pveBadge.style.verticalAlign = "middle";
      pveBadge.style.display = "inline-flex";
      pveBadge.style.alignItems = "center";
      pveBadge.style.gap = "0.25rem";
      pveBadge.style.marginRight = "0.5rem";
      pveBadge.innerHTML = '<i class="fas fa-server"></i> Proxmox VE';
      header.appendChild(pveBadge);
    }
    
    // Category Edit Actions
    const catActions = document.createElement("div");
    catActions.className = "category-actions";
    
    if (isDynamicDocker) {
      const badge = document.createElement("span");
      badge.className = "docker-category-badge";
      badge.innerHTML = '<i class="fab fa-docker"></i> Docker Managed';
      catActions.appendChild(badge);
    } else {
      // Move Up Category
      if (catIndex > 0) {
        const btnUp = document.createElement("button");
        btnUp.className = "icon-btn";
        btnUp.title = "Move Up";
        btnUp.innerHTML = '<i class="fas fa-arrow-up"></i>';
        btnUp.addEventListener("click", () => moveCategory(catIndex, -1));
        catActions.appendChild(btnUp);
      }
      
      // Move Down Category
      if (catIndex < state.categories.length - 1) {
        const btnDown = document.createElement("button");
        btnDown.className = "icon-btn";
        btnDown.title = "Move Down";
        btnDown.innerHTML = '<i class="fas fa-arrow-down"></i>';
        btnDown.addEventListener("click", () => moveCategory(catIndex, 1));
        catActions.appendChild(btnDown);
      }
      
      // Edit Category
      const btnEdit = document.createElement("button");
      btnEdit.className = "icon-btn";
      btnEdit.title = "Edit Category";
      btnEdit.innerHTML = '<i class="fas fa-pencil-alt"></i>';
      btnEdit.addEventListener("click", () => openCategoryModal(category.id));
      catActions.appendChild(btnEdit);
      
      // Delete Category
      const btnDel = document.createElement("button");
      btnDel.className = "icon-btn btn-danger-hover";
      btnDel.title = "Delete Category";
      btnDel.innerHTML = '<i class="fas fa-trash-alt"></i>';
      btnDel.addEventListener("click", () => deleteCategory(category.id));
      catActions.appendChild(btnDel);
    }
    
    header.appendChild(catActions);
    section.appendChild(header);
    
    // Links Grid
    const linksGrid = document.createElement("div");
    
    if (category.type === "bookmarks") {
      linksGrid.className = "simple-bookmark-list";
    } else {
      linksGrid.className = "links-grid";
      
      // Set custom item columns CSS variable
      const globalItemCols = state.settings.itemCols || "auto";
      const catItemCols = category.itemCols || "default";
      const finalItemCols = catItemCols === "default" ? globalItemCols : catItemCols;
      
      if (finalItemCols === "auto") {
        linksGrid.style.removeProperty("--grid-item-cols");
      } else {
        linksGrid.style.setProperty("--grid-item-cols", `repeat(${finalItemCols}, minmax(0, 1fr))`);
      }
    }
    
    if (category.type === "proxmox") {
      const cache = proxmoxCache[category.id];
      if (!cache || cache.loading) {
        const msgBox = document.createElement("div");
        msgBox.className = "proxmox-msg-box";
        msgBox.innerHTML = '<i class="fas fa-circle-notch spinner"></i><div>Loading Proxmox resources...</div>';
        linksGrid.appendChild(msgBox);
      } else if (cache.error) {
        const msgBox = document.createElement("div");
        msgBox.className = "proxmox-msg-box error";
        msgBox.innerHTML = `
          <i class="fas fa-exclamation-triangle"></i>
          <div style="margin: 0 10px; word-break: break-word;">${cache.error}</div>
          <button class="btn btn-secondary btn-sm" style="margin-top: 0.5rem; padding: 4px 10px; font-size: 0.8rem; border-radius: 4px; border: 1px solid var(--surface-border); background: var(--surface-bg-hover); color: var(--text-primary); cursor: pointer;">Retry Connection</button>
        `;
        msgBox.querySelector("button").addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          fetchProxmoxResources(category);
        });
        linksGrid.appendChild(msgBox);
      } else {
        let resources = cache.data || [];
        if (category.proxmoxFilter === "qemu") {
          resources = resources.filter(r => r.type === "qemu");
        } else if (category.proxmoxFilter === "lxc") {
          resources = resources.filter(r => r.type === "lxc");
        }
        
        resources.sort((a, b) => {
          const nameA = (a.name || "").toLowerCase();
          const nameB = (b.name || "").toLowerCase();
          if (nameA < nameB) return -1;
          if (nameA > nameB) return 1;
          return a.vmid - b.vmid;
        });

        if (resources.length === 0) {
          const msgBox = document.createElement("div");
          msgBox.className = "proxmox-msg-box";
          msgBox.innerHTML = '<i class="fas fa-info-circle"></i><div>No matching Proxmox resources found.</div>';
          linksGrid.appendChild(msgBox);
        } else {
          resources.forEach(res => {
            const card = document.createElement("a");
            const isRunning = res.status === "running";
            
            const ip = extractIpFromResource(res);
            if (isRunning && ip) {
              card.href = `http://${ip}`;
            } else {
              const baseUiUrl = category.proxmoxUrl.replace(/\/api2\/json\/?$/, "").replace(/\/$/, "");
              card.href = `${baseUiUrl}/#v1:0:sub_menu_node_${res.node}:node/${res.node}/${res.type}/${res.vmid}`;
            }
            card.target = "_blank";
            card.rel = "noopener noreferrer";
            
            const isCompact = category.proxmoxView === "compact";
            card.className = isCompact ? "bookmark-card proxmox-card compact" : "bookmark-card proxmox-card";
            const accentColor = category.color || "var(--primary-color)";
            card.style.setProperty("--card-accent", accentColor);
            card.style.setProperty("--card-accent-rgb", hexToRgb(category.color || "#6366f1"));
            
            if (isCompact) {
              // Left: Icon + VM Name + type badge
              const leftSec = document.createElement("div");
              leftSec.className = "proxmox-compact-left";
              
              const icon = document.createElement("i");
              icon.className = res.type === "qemu" ? "fas fa-server" : "fas fa-cube";
              icon.style.color = res.type === "qemu" ? "var(--primary-color)" : "#f59e0b";
              leftSec.appendChild(icon);
              
              const vmName = document.createElement("span");
              vmName.className = "proxmox-compact-name";
              vmName.textContent = res.name || `${res.type === "qemu" ? "VM" : "LXC"} ${res.vmid}`;
              leftSec.appendChild(vmName);
              
              const typeBadge = document.createElement("span");
              typeBadge.className = `proxmox-badge type-${res.type}`;
              typeBadge.textContent = res.type === "qemu" ? "VM" : "LXC";
              leftSec.appendChild(typeBadge);
              
              card.appendChild(leftSec);
              
              // Middle: IP Address
              const midSec = document.createElement("div");
              midSec.className = "proxmox-compact-middle";
              const ip = extractIpFromResource(res);
              midSec.textContent = ip || "—";
              card.appendChild(midSec);
            } else {
              // Standard View
              const cardHeader = document.createElement("div");
              cardHeader.className = "proxmox-card-header";
              
              const iconWrapper = document.createElement("div");
              iconWrapper.className = "card-icon-wrapper";
              
              const icon = document.createElement("i");
              icon.className = res.type === "qemu" ? "fas fa-server" : "fas fa-cube";
              icon.style.color = res.type === "qemu" ? "var(--primary-color)" : "#f59e0b";
              iconWrapper.appendChild(icon);
              cardHeader.appendChild(iconWrapper);
              
              const headerText = document.createElement("div");
              headerText.className = "proxmox-header-text";
              
              const vmName = document.createElement("div");
              vmName.className = "proxmox-vm-name";
              vmName.textContent = res.name || `${res.type === "qemu" ? "VM" : "LXC"} ${res.vmid}`;
              headerText.appendChild(vmName);
              
              const metaInfo = document.createElement("div");
              metaInfo.className = "proxmox-meta-info";
              
              const typeBadge = document.createElement("span");
              typeBadge.className = `proxmox-badge type-${res.type}`;
              typeBadge.textContent = res.type === "qemu" ? "VM" : "LXC";
              metaInfo.appendChild(typeBadge);
              
              const idBadge = document.createElement("span");
              idBadge.className = "proxmox-badge";
              idBadge.textContent = `${res.vmid} @ ${res.node}`;
              metaInfo.appendChild(idBadge);
              
              headerText.appendChild(metaInfo);
              cardHeader.appendChild(headerText);
              
              card.appendChild(cardHeader);
              
              const cardBody = document.createElement("div");
              cardBody.className = "proxmox-card-body";
              
              // CPU Row
              const cpuRow = document.createElement("div");
              cpuRow.className = "proxmox-metric-row";
              const cpuLabel = document.createElement("span");
              cpuLabel.className = "proxmox-metric-label";
              cpuLabel.textContent = "CPU";
              cpuRow.appendChild(cpuLabel);
              
              const cpuValue = document.createElement("span");
              cpuValue.className = "proxmox-metric-value";
              const cpuPercent = isRunning && res.cpu !== undefined ? (res.cpu * 100).toFixed(1) : "0.0";
              cpuValue.textContent = `${cpuPercent}%${res.maxcpu ? ` of ${res.maxcpu} vCPU` : ""}`;
              cpuRow.appendChild(cpuValue);
              cardBody.appendChild(cpuRow);
              
              const cpuBar = document.createElement("div");
              cpuBar.className = "proxmox-progress-bar";
              const cpuFill = document.createElement("div");
              cpuFill.className = "proxmox-progress-fill";
              cpuFill.style.width = `${Math.min(parseFloat(cpuPercent), 100)}%`;
              cpuBar.appendChild(cpuFill);
              cardBody.appendChild(cpuBar);
              
              // RAM Row
              const ramRow = document.createElement("div");
              ramRow.className = "proxmox-metric-row";
              const ramLabel = document.createElement("span");
              ramLabel.className = "proxmox-metric-label";
              ramLabel.textContent = "RAM";
              ramRow.appendChild(ramLabel);
              
              const ramValue = document.createElement("span");
              ramValue.className = "proxmox-metric-value";
              const memUsedGb = isRunning && res.mem !== undefined ? (res.mem / (1024*1024*1024)) : 0;
              const memMaxGb = res.maxmem ? (res.maxmem / (1024*1024*1024)) : 0;
              const ramPercent = memMaxGb > 0 ? ((memUsedGb / memMaxGb) * 100).toFixed(1) : "0.0";
              ramValue.textContent = isRunning ? `${ramPercent}% (${memUsedGb.toFixed(2)} GB / ${memMaxGb.toFixed(2)} GB)` : `0% (0 GB / ${memMaxGb.toFixed(2)} GB)`;
              ramRow.appendChild(ramValue);
              cardBody.appendChild(ramRow);
              
              const ramBar = document.createElement("div");
              ramBar.className = "proxmox-progress-bar";
              const ramFill = document.createElement("div");
              ramFill.className = "proxmox-progress-fill";
              ramFill.style.width = `${Math.min(parseFloat(ramPercent), 100)}%`;
              ramBar.appendChild(ramFill);
              cardBody.appendChild(ramBar);
              
              // Uptime Row
              const uptimeRow = document.createElement("div");
              uptimeRow.className = "proxmox-metric-row";
              const uptimeLabel = document.createElement("span");
              uptimeLabel.className = "proxmox-metric-label";
              uptimeLabel.textContent = "Uptime";
              uptimeRow.appendChild(uptimeLabel);
              
              const uptimeValue = document.createElement("span");
              uptimeValue.className = "proxmox-metric-value";
              uptimeValue.textContent = isRunning ? formatUptime(res.uptime) : "stopped";
              uptimeRow.appendChild(uptimeValue);
              cardBody.appendChild(uptimeRow);
              
              card.appendChild(cardBody);
            }
            
            card.appendChild(document.createTextNode("")); // Anchor wrapper safeguard
            linksGrid.appendChild(card);
          });
        }
      }
    } else {
      category.items.forEach((item, itemIndex) => {
        const card = document.createElement("a");
        card.href = item.url;
        const isSimple = category.type === "bookmarks";
        card.className = isSimple ? "simple-bookmark-item" : "bookmark-card";
        card.target = "_blank";
        card.rel = "noopener noreferrer";
        card.style.setProperty("--card-accent", item.color || "var(--primary-color)");
        card.style.setProperty("--card-accent-rgb", hexToRgb(item.color || "#6366f1"));
        
        if (state.editMode && !item.isDiscovered) {
          card.setAttribute("draggable", "true");
          let cardEnterCounter = 0;
          
          card.addEventListener("dragstart", (e) => {
            dragSrc = {
              type: "item",
              categoryId: category.id,
              itemId: item.id,
              index: itemIndex
            };
            card.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", item.id);
          });

          card.addEventListener("dragend", () => {
            card.classList.remove("dragging");
            document.querySelectorAll(".bookmark-card").forEach(c => c.classList.remove("drag-over"));
            document.querySelectorAll(".category-section").forEach(s => s.classList.remove("drag-over"));
            dragSrc = { type: null, categoryId: null, itemId: null, index: null };
          });

          card.addEventListener("dragover", (e) => {
            if (dragSrc.type === "item") {
              e.preventDefault();
            }
          });

          card.addEventListener("dragenter", (e) => {
            if (dragSrc.type === "item" && dragSrc.itemId !== item.id) {
              cardEnterCounter++;
              card.classList.add("drag-over");
            }
          });

          card.addEventListener("dragleave", () => {
            if (dragSrc.type === "item" && dragSrc.itemId !== item.id) {
              cardEnterCounter--;
              if (cardEnterCounter <= 0) {
                cardEnterCounter = 0;
                card.classList.remove("drag-over");
              }
            }
          });

          card.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            cardEnterCounter = 0;
            card.classList.remove("drag-over");
            
            if (dragSrc.type === "item") {
              if (dragSrc.itemId !== item.id) {
                moveItemInState(dragSrc.categoryId, dragSrc.itemId, category.id, item.id);
              }
            }
          });
        }
        
        if (isSimple) {
          renderIconInto(item.icon, card, true, item.name, item.color || "var(--primary-color)");
          const textNode = document.createTextNode(item.name);
          card.appendChild(textNode);
        } else {
          // Icon Box
          const iconWrapper = document.createElement("div");
          iconWrapper.className = "card-icon-wrapper";
          
          renderIconInto(item.icon, iconWrapper, false, item.name, item.color || "var(--primary-color)");
          card.appendChild(iconWrapper);
          
          // Card text
          const content = document.createElement("div");
          content.className = "card-content";
          
          const cardTitle = document.createElement("div");
          cardTitle.className = "card-title";
          cardTitle.textContent = item.name;
          content.appendChild(cardTitle);
          
          const cardDesc = document.createElement("div");
          cardDesc.className = "card-desc";
          cardDesc.textContent = item.desc || "";
          content.appendChild(cardDesc);
          
          card.appendChild(content);
        }
        
        // Status Dot (visible if in serverMode)
        if (serverMode) {
          const statusDot = document.createElement("span");
          statusDot.className = "status-dot";
          statusDot.setAttribute("data-item-id", item.id);
          if (linkStatuses[item.id] !== undefined) {
            const isOnline = linkStatuses[item.id];
            statusDot.classList.add(isOnline ? "online" : "offline");
            card.classList.toggle("is-offline", !isOnline);
          }
          card.appendChild(statusDot);
        }
        
        // Edit Overlay (visible in Edit Mode)
        if (item.isDiscovered) {
          const overlay = document.createElement("div");
          overlay.className = "card-edit-overlay docker-discovered-overlay";
          
          const dockerIcon = document.createElement("i");
          dockerIcon.className = "fab fa-docker";
          dockerIcon.style.fontSize = "1.5rem";
          dockerIcon.style.color = "#2496ed";
          
          const text = document.createElement("span");
          text.className = "docker-badge-text";
          text.textContent = "Managed by Docker";
          
          overlay.appendChild(dockerIcon);
          overlay.appendChild(text);
          card.appendChild(overlay);
        } else {
          const overlay = document.createElement("div");
          overlay.className = "card-edit-overlay";
          
          // Move Left Item
          if (itemIndex > 0) {
            const moveLeft = document.createElement("button");
            moveLeft.className = "icon-btn";
            moveLeft.title = "Move Left";
            moveLeft.innerHTML = '<i class="fas fa-arrow-left"></i>';
            moveLeft.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              moveItem(catIndex, itemIndex, -1);
            });
            overlay.appendChild(moveLeft);
          }
          
          // Edit Button
          const editBtn = document.createElement("button");
          editBtn.className = "icon-btn";
          editBtn.title = "Edit Link";
          editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
          editBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            openItemModal(category.id, item.id);
          });
          overlay.appendChild(editBtn);
          
          // Delete Button
          const delBtn = document.createElement("button");
          delBtn.className = "icon-btn btn-danger-hover";
          delBtn.title = "Delete Link";
          delBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
          delBtn.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            deleteItem(category.id, item.id);
          });
          overlay.appendChild(delBtn);
          
          // Move Right Item
          if (itemIndex < category.items.length - 1) {
            const moveRight = document.createElement("button");
            moveRight.className = "icon-btn";
            moveRight.title = "Move Right";
            moveRight.innerHTML = '<i class="fas fa-arrow-right"></i>';
            moveRight.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              moveItem(catIndex, itemIndex, 1);
            });
            overlay.appendChild(moveRight);
          }
          
          card.appendChild(overlay);
        }
        linksGrid.appendChild(card);
      });
      
      // Add Item Placeholder (Visible in Edit Mode)
      if (state.editMode && !isDynamicDocker) {
        const addPlaceholder = document.createElement("button");
        addPlaceholder.className = "add-card-placeholder";
        addPlaceholder.innerHTML = '<i class="fas fa-plus"></i> <span>Add Link</span>';
        addPlaceholder.addEventListener("click", () => openItemModal(category.id));
        linksGrid.appendChild(addPlaceholder);
      }
    }
    
    section.appendChild(linksGrid);
    
    if (category.type === "proxmox" && pveSidebar) {
      pveSidebar.appendChild(section);
    } else if (category.type === "bookmarks" && bookmarksContainer) {
      bookmarksContainer.appendChild(section);
    } else {
      container.appendChild(section);
    }
  });
  
  // Hide bookmarks container if empty and not in edit mode
  if (bookmarksContainer) {
    if (bookmarksContainer.children.length === 0 && !state.editMode) {
      bookmarksContainer.style.display = "none";
    } else {
      bookmarksContainer.style.display = "";
    }
  }
  
  // Add Category Button at the very bottom (visible in Edit Mode)
  if (state.editMode) {
    const addCatWrapper = document.createElement("div");
    addCatWrapper.className = "add-category-wrapper";
    
    const addCatBtn = document.createElement("button");
    addCatBtn.className = "btn btn-secondary btn-add-category";
    addCatBtn.innerHTML = '<i class="fas fa-folder-plus"></i> Add New Category';
    addCatBtn.addEventListener("click", () => openCategoryModal());
    addCatWrapper.appendChild(addCatBtn);
    
    container.appendChild(addCatWrapper);
  }
}

// ==========================================================================
// CRUD and Reordering Actions
// ==========================================================================

// --- Reordering ---
function moveCategory(index, direction) {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= state.categories.length) return;
  
  const temp = state.categories[index];
  state.categories[index] = state.categories[targetIndex];
  state.categories[targetIndex] = temp;
  
  saveAppState();
  renderDashboard();
}

function moveCategoryInState(srcIndex, destIndex) {
  if (srcIndex < 0 || srcIndex >= state.categories.length || destIndex < 0 || destIndex >= state.categories.length) return;
  const [movedCat] = state.categories.splice(srcIndex, 1);
  state.categories.splice(destIndex, 0, movedCat);
  saveAppState();
  renderDashboard();
}

function moveItem(catIndex, itemIndex, direction) {
  const targetIndex = itemIndex + direction;
  const items = state.categories[catIndex].items;
  if (targetIndex < 0 || targetIndex >= items.length) return;
  
  const temp = items[itemIndex];
  items[itemIndex] = items[targetIndex];
  items[targetIndex] = temp;
  
  saveAppState();
  renderDashboard();
}

function moveItemInState(srcCatId, srcItemId, destCatId, destItemId = null) {
  const srcCat = state.categories.find(c => c.id === srcCatId);
  const destCat = state.categories.find(c => c.id === destCatId);
  if (!srcCat || !destCat) return;

  const srcIndex = srcCat.items.findIndex(i => i.id === srcItemId);
  if (srcIndex === -1) return;

  let destIndex = destItemId ? destCat.items.findIndex(i => i.id === destItemId) : -1;

  // Remove from source
  const [item] = srcCat.items.splice(srcIndex, 1);

  // Insert into destination
  if (destIndex !== -1) {
    destCat.items.splice(destIndex, 0, item);
  } else {
    destCat.items.push(item);
  }

  saveAppState();
  renderDashboard();
}

// --- Category Add / Edit / Delete ---
function openCategoryModal(catId = null) {
  const dialog = document.getElementById("category-dialog");
  const form = document.getElementById("category-form");
  const title = document.getElementById("category-dialog-title");
  const typeSelect = document.getElementById("category-type");
  const proxmoxFields = document.getElementById("category-proxmox-fields");
  
  form.reset();

  const toggleProxmoxRequired = (isProxmox) => {
    document.getElementById("category-proxmox-url").required = isProxmox;
    document.getElementById("category-proxmox-token-id").required = isProxmox;
    document.getElementById("category-proxmox-token-secret").required = isProxmox;
  };
  
  if (catId) {
    title.textContent = "Edit Category";
    const category = state.categories.find(c => c.id === catId);
    if (category) {
      document.getElementById("category-id").value = category.id;
      document.getElementById("category-name").value = category.name;
      document.getElementById("category-icon").value = category.icon || "";
      document.getElementById("category-item-cols").value = category.itemCols || "default";
      
      const type = category.type || "standard";
      typeSelect.value = type;
      document.getElementById("category-proxmox-url").value = category.proxmoxUrl || "";
      document.getElementById("category-proxmox-token-id").value = category.proxmoxTokenId || "";
      document.getElementById("category-proxmox-token-secret").value = category.proxmoxTokenSecret || "";
      document.getElementById("category-proxmox-filter").value = category.proxmoxFilter || "all";
      document.getElementById("category-proxmox-refresh").value = category.proxmoxRefresh || 30;
      document.getElementById("category-proxmox-view").value = category.proxmoxView || "standard";
      
      proxmoxFields.style.display = type === "proxmox" ? "block" : "none";
      toggleProxmoxRequired(type === "proxmox");
      updateIconPreview("category-icon", "category-icon-preview", "fas fa-folder");
    }
  } else {
    title.textContent = "Add New Category";
    document.getElementById("category-id").value = "";
    document.getElementById("category-icon").value = "fas fa-folder";
    document.getElementById("category-item-cols").value = "default";
    
    typeSelect.value = "standard";
    document.getElementById("category-proxmox-url").value = "";
    document.getElementById("category-proxmox-token-id").value = "";
    document.getElementById("category-proxmox-token-secret").value = "";
    document.getElementById("category-proxmox-filter").value = "all";
    document.getElementById("category-proxmox-refresh").value = 30;
    document.getElementById("category-proxmox-view").value = "standard";
    
    proxmoxFields.style.display = "none";
    toggleProxmoxRequired(false);
    updateIconPreview("category-icon", "category-icon-preview", "fas fa-folder");
  }
  
  dialog.showModal();
}


function deleteCategory(catId) {
  const category = state.categories.find(c => c.id === catId);
  if (!category) return;
  
  const confirmMsg = `Are you sure you want to delete the category "${category.name}" and all of its ${category.items.length} links?`;
  if (confirm(confirmMsg)) {
    state.categories = state.categories.filter(c => c.id !== catId);
    saveAppState();
    renderDashboard();
  }
}

// --- Item Add / Edit / Delete ---
function openItemModal(catId, itemId = null) {
  const dialog = document.getElementById("item-dialog");
  const form = document.getElementById("item-form");
  const title = document.getElementById("item-dialog-title");
  
  form.reset();
  document.getElementById("item-category-id").value = catId;
  
  if (itemId) {
    title.textContent = "Edit Link";
    const category = state.categories.find(c => c.id === catId);
    const item = category ? category.items.find(i => i.id === itemId) : null;
    if (item) {
      document.getElementById("item-id").value = item.id;
      document.getElementById("item-name").value = item.name;
      document.getElementById("item-url").value = item.url;
      document.getElementById("item-desc").value = item.desc || "";
      document.getElementById("item-icon").value = item.icon || "";
      document.getElementById("item-color").value = item.color || "#6366f1";
      document.getElementById("color-hex-text").textContent = item.color || "#6366f1";
      updateIconPreview("item-icon", "item-icon-preview", "fas fa-link");
    }
  } else {
    title.textContent = "Add New Link";
    document.getElementById("item-id").value = "";
    document.getElementById("item-icon").value = "fas fa-link";
    document.getElementById("item-color").value = "#6366f1";
    document.getElementById("color-hex-text").textContent = "#6366f1";
    updateIconPreview("item-icon", "item-icon-preview", "fas fa-link");
  }
  
  dialog.showModal();
}

function deleteItem(catId, itemId) {
  const category = state.categories.find(c => c.id === catId);
  if (!category) return;
  const item = category.items.find(i => i.id === itemId);
  if (!item) return;
  
  if (confirm(`Are you sure you want to delete the link "${item.name}"?`)) {
    category.items = category.items.filter(i => i.id !== itemId);
    saveAppState();
    renderDashboard();
  }
}

// Icon preview helper
function updateIconPreview(inputId, previewId, defaultIcon) {
  const val = document.getElementById(inputId).value.trim();
  const preview = document.getElementById(previewId);
  preview.innerHTML = "";
  
  if (!val) {
    const i = document.createElement("i");
    i.className = defaultIcon;
    preview.appendChild(i);
    return;
  }
  
  if (val.startsWith("http://") || val.startsWith("https://") || val.startsWith("data:") || val.startsWith("/")) {
    const img = document.createElement("img");
    img.src = val;
    img.onerror = () => { preview.innerHTML = `<i class="${defaultIcon}"></i>`; };
    preview.appendChild(img);
  } else {
    const i = document.createElement("i");
    i.className = val;
    preview.appendChild(i);
  }
}

// ==========================================================================
// Event Listeners Configuration
// ==========================================================================
function setupEventListeners() {
  // --- Admin Authentication Listeners ---
  const loginForm = document.getElementById("login-form");
  const loginDialog = document.getElementById("login-dialog");
  const loginErrorMsg = document.getElementById("login-error-msg");
  const loginErrorText = document.getElementById("login-error-text");
  
  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("login-password").value;
      
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        });
        
        if (response.ok) {
          const data = await response.json();
          sessionStorage.setItem("mdash_auth_token", data.token);
          authenticated = true;
          loginDialog.close();
          showToast('Login successful', 'success');
          
          // Re-fetch config to get unmasked Proxmox credentials
          const token = sessionStorage.getItem("mdash_auth_token");
          const configResponse = await fetch("/api/config", {
            headers: { "Authorization": `Bearer ${token}` }
          });
          if (configResponse.ok) {
            const configData = await configResponse.json();
            state.categories = configData.categories || [];
            state.settings = { ...DEFAULT_CONFIG.settings, ...(configData.settings || {}) };
          }
          
          const logoutBtn = document.getElementById("logout-btn");
          if (logoutBtn) logoutBtn.style.display = "inline-flex";
          
          if (window.postLoginAction) {
            window.postLoginAction();
            window.postLoginAction = null;
          } else {
            renderDashboard();
          }
          startStatsAndStatusPolling();
        } else {
          const errData = await response.json().catch(() => ({ error: "Incorrect password." }));
          loginErrorMsg.style.display = "flex";
          loginErrorText.textContent = errData.error || "Incorrect password.";
          showToast('Incorrect password', 'error');
        }
      } catch (error) {
        console.error("Login request error:", error);
        loginErrorMsg.style.display = "flex";
        loginErrorText.textContent = "Server communication failure.";
        showToast('Login request failed', 'error');
      }
    });
  }

  const toggleLoginPassBtn = document.getElementById("toggle-login-password-btn");
  if (toggleLoginPassBtn) {
    toggleLoginPassBtn.addEventListener("click", () => {
      const passField = document.getElementById("login-password");
      const isPass = passField.type === "password";
      passField.type = isPass ? "text" : "password";
      toggleLoginPassBtn.innerHTML = isPass ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
  }

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem("mdash_auth_token");
      authenticated = false;
      const settingsDialog = document.getElementById("settings-dialog");
      if (settingsDialog) settingsDialog.close();
      window.location.reload();
    });
  }

  // 1. Search engine dropdown toggle
  const searchEngineBtn = document.getElementById("search-engine-btn");
  const engineDropdown = document.getElementById("engine-dropdown");
  
  searchEngineBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = engineDropdown.classList.contains("open");
    engineDropdown.classList.toggle("open", !isOpen);
    searchEngineBtn.setAttribute("aria-expanded", !isOpen ? "true" : "false");
  });
  
  document.addEventListener("click", () => {
    engineDropdown.classList.remove("open");
    searchEngineBtn.setAttribute("aria-expanded", "false");
  });
  
  // Search Engine select
  const options = document.querySelectorAll(".engine-option");
  options.forEach(opt => {
    opt.addEventListener("click", (e) => {
      e.stopPropagation();
      const selected = opt.getAttribute("data-engine");
      state.settings.searchEngine = selected;
      saveAppState();
      setupSearchEngine();
      engineDropdown.classList.remove("open");
      searchEngineBtn.setAttribute("aria-expanded", "false");
    });
  });
  
  // 2. Search input filtering & submission
  const searchInput = document.getElementById("search-input");
  const clearBtn = document.getElementById("search-clear-btn");
  
  searchInput.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    clearBtn.style.display = query.length > 0 ? "flex" : "none";
    
    // Live filter categories & items
    const sections = document.querySelectorAll(".category-section");
    sections.forEach(sec => {
      const cards = sec.querySelectorAll(".bookmark-card");
      let visibleCards = 0;
      
      cards.forEach(card => {
        const titleEl = card.querySelector(".card-title") || card.querySelector(".proxmox-vm-name") || card.querySelector(".proxmox-compact-name");
        const title = titleEl ? titleEl.textContent.toLowerCase() : "";
        const descEl = card.querySelector(".card-desc") || card.querySelector(".proxmox-meta-info") || card.querySelector(".proxmox-compact-middle");
        const desc = descEl ? descEl.textContent.toLowerCase() : "";
        const matches = title.includes(query) || desc.includes(query);
        
        card.style.display = matches ? "flex" : "none";
        if (matches) visibleCards++;
      });
      
      // Hide category block if no links match
      sec.style.display = (visibleCards > 0 || query === "" || state.editMode) ? "flex" : "none";
    });
  });
  
  // Clear search input
  clearBtn.addEventListener("click", () => {
    searchInput.value = "";
    clearBtn.style.display = "none";
    searchInput.dispatchEvent(new Event("input"));
    searchInput.focus();
  });
  
  // Web search query trigger
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const query = searchInput.value.trim();
      if (!query) return;
      
      // Check if there is an exact matching card, if so open it
      let exactMatch = null;
      state.categories.forEach(cat => {
        cat.items.forEach(item => {
          if (item.name.toLowerCase() === query.toLowerCase()) {
            exactMatch = item.url;
          }
        });
      });
      
      if (exactMatch) {
        window.open(exactMatch, "_blank");
      } else {
        // Fallback to web search
        const selected = state.settings.searchEngine || "google";
        const engineDef = SEARCH_ENGINES[selected] || SEARCH_ENGINES.google;
        window.open(engineDef.url + encodeURIComponent(query), "_blank");
      }
    }
  });

  // 3. Edit Mode Toggle with proper auth handling
  document.getElementById("toggle-edit-btn").addEventListener("click", () => {
    checkAdminAuth(() => {
      state.editMode = !state.editMode;
      // Clear search filter when toggling edit mode to reveal all links
      searchInput.value = "";
      clearBtn.style.display = "none";
      renderDashboard();
    });
  });
  
  // 4. Settings Panel Dialog Trigger with proper auth handling
  document.getElementById("settings-btn").addEventListener("click", () => {
    checkAdminAuth(() => {
      const dialog = document.getElementById("settings-dialog");
      dialog.showModal();
    });
  });

  // Theme Toggle Button (Header)
  const themeToggleBtn = document.getElementById("theme-toggle-btn");
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      const currentTheme = state.settings.theme || "dark";
      state.settings.theme = currentTheme === "dark" ? "light" : "dark";
      saveAppState();
      setupTheme();
    });
  }
  
  // Theme Toggle buttons in settings panel
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-theme-val");
      state.settings.theme = val;
      saveAppState();
      setupTheme();
    });
  });
  
  // Layout Toggle buttons in settings panel
  document.querySelectorAll(".layout-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const val = btn.getAttribute("data-layout-val");
      state.settings.layout = val;
      saveAppState();
      setupTheme();
      renderDashboard();
    });
  });
  
  // Category Columns dropdown change listener
  document.getElementById("settings-cat-cols").addEventListener("change", (e) => {
    state.settings.catCols = e.target.value;
    saveAppState();
    setupTheme();
    renderDashboard();
  });

  // Default Item Columns dropdown change listener
  document.getElementById("settings-item-cols").addEventListener("change", (e) => {
    state.settings.itemCols = e.target.value;
    saveAppState();
    setupTheme();
    renderDashboard();
  });

  // Bookmark Workspace Columns dropdown change listener
  document.getElementById("settings-bookmark-cols").addEventListener("change", (e) => {
    state.settings.bookmarkCols = e.target.value;
    saveAppState();
    setupTheme();
    renderDashboard();
  });

  // Service Card Style dropdown change listener
  const settingsCardStyle = document.getElementById("settings-card-style");
  if (settingsCardStyle) {
    settingsCardStyle.addEventListener("change", (e) => {
      state.settings.cardStyle = e.target.value;
      saveAppState();
      setupTheme();
      renderDashboard();
    });
  }

  // Accent Theme dropdown change listener
  const settingsAccentTheme = document.getElementById("settings-accent-theme");
  if (settingsAccentTheme) {
    settingsAccentTheme.addEventListener("change", (e) => {
      state.settings.accentTheme = e.target.value;
      saveAppState();
      setupTheme();
      renderDashboard();
    });
  }

  // Glassmorphism Style dropdown change listener
  const settingsGlassStyle = document.getElementById("settings-glass-style");
  if (settingsGlassStyle) {
    settingsGlassStyle.addEventListener("change", (e) => {
      state.settings.glassStyle = e.target.value;
      saveAppState();
      setupTheme();
      renderDashboard();
    });
  }

  // Ambient Background Theme dropdown change listener
  const settingsBgTheme = document.getElementById("settings-bg-theme");
  if (settingsBgTheme) {
    settingsBgTheme.addEventListener("change", (e) => {
      state.settings.bgTheme = e.target.value;
      saveAppState();
      setupTheme();
    });
  }

  // Layout Density dropdown change listener
  const settingsDensity = document.getElementById("settings-density");
  if (settingsDensity) {
    settingsDensity.addEventListener("change", (e) => {
      state.settings.density = e.target.value;
      saveAppState();
      setupTheme();
      renderDashboard();
    });
  }

  // Typography Font dropdown change listener
  const settingsFont = document.getElementById("settings-font");
  if (settingsFont) {
    settingsFont.addEventListener("change", (e) => {
      state.settings.font = e.target.value;
      saveAppState();
      setupTheme();
    });
  }
  
  // Custom Background input blur/change
  document.getElementById("settings-bg-url").addEventListener("change", (e) => {
    state.settings.bgUrl = e.target.value.trim();
    saveAppState();
    setupTheme();
  });
  
  // Username changed
  document.getElementById("settings-username").addEventListener("change", (e) => {
    state.settings.username = e.target.value.trim() || "kmilkos";
    saveAppState();
    updateTimeAndGreeting();
  });

  // Weather Enable changed
  document.getElementById("settings-weather-enable").addEventListener("change", (e) => {
    state.settings.weatherEnable = e.target.checked;
    const weatherFields = document.getElementById("weather-settings-fields");
    if (weatherFields) weatherFields.style.display = e.target.checked ? "flex" : "none";
    saveAppState();
    initWeatherWidget();
  });
  
  // Weather Location changed
  document.getElementById("settings-weather-location").addEventListener("change", (e) => {
    state.settings.weatherLocation = e.target.value.trim();
    saveAppState();
    initWeatherWidget();
  });

  // Weather Unit changed
  document.getElementById("settings-weather-unit").addEventListener("change", (e) => {
    state.settings.weatherUnit = e.target.value;
    saveAppState();
    initWeatherWidget();
  });

  // Weather Latitude changed
  document.getElementById("settings-weather-latitude").addEventListener("change", (e) => {
    state.settings.weatherLat = e.target.value.trim();
    saveAppState();
    initWeatherWidget();
  });

  // Weather Longitude changed
  document.getElementById("settings-weather-longitude").addEventListener("change", (e) => {
    state.settings.weatherLon = e.target.value.trim();
    saveAppState();
    initWeatherWidget();
  });
  
  // Settings Export
  document.getElementById("export-btn").addEventListener("click", () => {
    const configData = {
      categories: state.categories,
      settings: state.settings
    };
    
    const blob = new Blob([JSON.stringify(configData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement("a");
    a.href = url;
    a.download = `mdash_config_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  
  // Settings Import
  const fileInput = document.getElementById("import-file-input");
  document.getElementById("import-trigger-btn").addEventListener("click", () => {
    fileInput.click();
  });
  
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const imported = JSON.parse(evt.target.result);
        if (imported.categories && Array.isArray(imported.categories)) {
          state.categories = imported.categories;
          if (imported.settings) state.settings = imported.settings;
          saveAppState();
          setupTheme();
          setupSearchEngine();
          startProxmoxPolling();
          renderDashboard();
          alert("Configuration imported successfully!");
          document.getElementById("settings-dialog").close();
        } else {
          alert("Invalid configuration format. Make sure 'categories' array is present.");
        }
      } catch (err) {
        alert("Failed to parse JSON configuration file.");
        console.error(err);
      }
    };
    reader.readAsText(file);
    fileInput.value = ""; // Reset input
  });
  
  // Reset Dashboard
  document.getElementById("reset-btn").addEventListener("click", () => {
    if (confirm("WARNING: Are you sure you want to reset the dashboard to defaults? This will erase all categories and bookmarks.")) {
      restoreDefaults();
      setupTheme();
      setupSearchEngine();
      startProxmoxPolling();
      renderDashboard();
      showToast('Dashboard reset to defaults', 'info');
      document.getElementById("settings-dialog").close();
    }
  });

  
  // Proxmox Token Secret Toggle Button
  const toggleSecretBtn = document.getElementById("toggle-token-secret-btn");
  if (toggleSecretBtn) {
    toggleSecretBtn.addEventListener("click", () => {
      const secretInput = document.getElementById("category-proxmox-token-secret");
      const isPassword = secretInput.type === "password";
      secretInput.type = isPassword ? "text" : "password";
      toggleSecretBtn.innerHTML = isPassword ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>';
    });
  }

  // Category Type Change Listener
  const typeSelect = document.getElementById("category-type");
  if (typeSelect) {
    typeSelect.addEventListener("change", (e) => {
      const isProxmox = e.target.value === "proxmox";
      document.getElementById("category-proxmox-fields").style.display = isProxmox ? "block" : "none";
      document.getElementById("category-proxmox-url").required = isProxmox;
      document.getElementById("category-proxmox-token-id").required = isProxmox;
      document.getElementById("category-proxmox-token-secret").required = isProxmox;
    });
  }

  // 5. Category Form Submission Handler
  document.getElementById("category-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const catIdInput = document.getElementById("category-id").value;
    const name = document.getElementById("category-name").value.trim();
    const icon = document.getElementById("category-icon").value.trim() || "fas fa-folder";
    const itemCols = document.getElementById("category-item-cols").value;
    const type = document.getElementById("category-type").value;
    const proxmoxUrl = document.getElementById("category-proxmox-url").value.trim();
    const proxmoxTokenId = document.getElementById("category-proxmox-token-id").value.trim();
    const proxmoxTokenSecret = document.getElementById("category-proxmox-token-secret").value.trim();
    const proxmoxFilter = document.getElementById("category-proxmox-filter").value;
    const proxmoxRefresh = parseInt(document.getElementById("category-proxmox-refresh").value, 10) || 30;
    const proxmoxView = document.getElementById("category-proxmox-view").value;
    
    if (catIdInput) {
      // Edit
      const category = state.categories.find(c => c.id === catIdInput);
      if (category) {
        category.name = name;
        category.icon = icon;
        category.itemCols = itemCols;
        category.type = type;
        category.proxmoxUrl = proxmoxUrl;
        category.proxmoxTokenId = proxmoxTokenId;
        category.proxmoxTokenSecret = proxmoxTokenSecret;
        category.proxmoxFilter = proxmoxFilter;
        category.proxmoxRefresh = proxmoxRefresh;
        category.proxmoxView = proxmoxView;
        
        // Clear cached data if API url or details change so it triggers refresh
        if (proxmoxCache[category.id]) {
          delete proxmoxCache[category.id];
        }
      }
    } else {
      // Create new
      const newCat = {
        id: "cat-" + Date.now(),
        name: name,
        icon: icon,
        itemCols: itemCols,
        type: type,
        proxmoxUrl: proxmoxUrl,
        proxmoxTokenId: proxmoxTokenId,
        proxmoxTokenSecret: proxmoxTokenSecret,
        proxmoxFilter: proxmoxFilter,
        proxmoxRefresh: proxmoxRefresh,
        proxmoxView: proxmoxView,
        items: []
      };
      state.categories.push(newCat);
    }
    
    saveAppState();
    
    // Trigger immediate fetch if it's a Proxmox category
    const activeCatId = catIdInput || state.categories[state.categories.length - 1].id;
    const activeCat = state.categories.find(c => c.id === activeCatId);
    if (activeCat && activeCat.type === "proxmox") {
      fetchProxmoxResources(activeCat);
    }
    
    document.getElementById("category-dialog").close();
    renderDashboard();
  });

  
  // Live previews for forms icons
  document.getElementById("category-icon").addEventListener("input", () => {
    updateIconPreview("category-icon", "category-icon-preview", "fas fa-folder");
  });
  document.getElementById("item-icon").addEventListener("input", () => {
    updateIconPreview("item-icon", "item-icon-preview", "fas fa-link");
  });
  
  // Accent color hex updates
  const itemColor = document.getElementById("item-color");
  const hexText = document.getElementById("color-hex-text");
  itemColor.addEventListener("input", (e) => {
    hexText.textContent = e.target.value;
  });
  
  // 6. Item Form Submission Handler
  document.getElementById("item-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const itemIdInput = document.getElementById("item-id").value;
    const catId = document.getElementById("item-category-id").value;
    const name = document.getElementById("item-name").value.trim();
    const url = document.getElementById("item-url").value.trim();
    const desc = document.getElementById("item-desc").value.trim();
    const icon = document.getElementById("item-icon").value.trim() || "fas fa-link";
    const color = document.getElementById("item-color").value;
    
    const category = state.categories.find(c => c.id === catId);
    if (!category) return;
    
    if (itemIdInput) {
      // Edit
      const item = category.items.find(i => i.id === itemIdInput);
      if (item) {
        item.name = name;
        item.url = url;
        item.desc = desc;
        item.icon = icon;
        item.color = color;
      }
    } else {
      // Create
      const newItem = {
        id: "item-" + Date.now(),
        name,
        url,
        desc,
        icon,
        color
      };
      category.items.push(newItem);
    }
    
    saveAppState();
    renderDashboard();
    document.getElementById("item-dialog").close();
  });
}
