import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';

// Homelab environments commonly use self-signed certificates for Proxmox.
// Disable strict SSL verification for API calls in Node.js.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const ADMIN_PASSWORD = process.env.MDASH_PASSWORD;
const AUTH_ENABLED = !!ADMIN_PASSWORD;
const SESSION_TOKEN = AUTH_ENABLED ? crypto.randomBytes(32).toString('hex') : null;

// --- Host Resource Monitoring Setup ---
function getCpuUsage() {
  const cpus = os.cpus();
  let totalIdle = 0, totalTick = 0;
  cpus.forEach(cpu => {
    for (const type in cpu.times) {
      totalTick += cpu.times[type];
    }
    totalIdle += cpu.times.idle;
  });
  return { totalIdle, totalTick };
}

let startMeasure = getCpuUsage();
let currentCpuUsage = 0;

setInterval(() => {
  const endMeasure = getCpuUsage();
  const idleDiff = endMeasure.totalIdle - startMeasure.totalIdle;
  const totalDiff = endMeasure.totalTick - startMeasure.totalTick;
  currentCpuUsage = totalDiff > 0 ? (1 - idleDiff / totalDiff) * 100 : 0;
  startMeasure = endMeasure;
}, 2000);

// --- Active Link Ping Checks Setup ---
const linkStatusCache = {};

async function pingUrl(url) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    let response;
    try {
      response = await fetch(url, {
        method: "HEAD",
        signal: controller.signal,
        headers: { 'User-Agent': 'mDash-Ping-Bot/1.0' }
      });
      clearTimeout(timeoutId);
    } catch (headError) {
      // Fallback to GET on error or HEAD rejection
      const getController = new AbortController();
      const getTimeoutId = setTimeout(() => getController.abort(), 3000);
      response = await fetch(url, {
        method: "GET",
        signal: getController.signal,
        headers: { 'User-Agent': 'mDash-Ping-Bot/1.0' }
      });
      clearTimeout(getTimeoutId);
    }
    return response.ok;
  } catch (e) {
    return false;
  }
}

async function runLinkChecks() {
  try {
    const config = loadConfig();
    const itemsToPing = [];
    
    config.categories.forEach(cat => {
      if (cat.type !== 'proxmox' && cat.items) {
        cat.items.forEach(item => {
          if (item.url && (item.url.startsWith('http://') || item.url.startsWith('https://'))) {
            itemsToPing.push(item);
          }
        });
      }
    });

    for (const item of itemsToPing) {
      const isOnline = await pingUrl(item.url);
      linkStatusCache[item.id] = isOnline;
    }
  } catch (err) {
    console.error("Error executing background link checks:", err);
  }
}

// Check every 60 seconds
setInterval(runLinkChecks, 60000);
// Trigger initial check shortly after boot
setTimeout(runLinkChecks, 5000);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3080;
const CONFIG_FILE = path.join(__dirname, 'config.json');

app.use(express.json());

// Serve static files from 'dist' directory in production
app.use(express.static(path.join(__dirname, 'dist')));

// Default configuration template (used on first run)
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
    itemCols: "auto"
  }
};

// Reads config file or creates default
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
    return DEFAULT_CONFIG;
  }
  try {
    const rawData = fs.readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error("Error reading config.json, returning defaults:", error);
    return DEFAULT_CONFIG;
  }
}

// Authentication helper
function isRequestAuthenticated(req) {
  if (!AUTH_ENABLED) return true;
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.substring(7);
  return token === SESSION_TOKEN;
}

// GET /api/auth/status - Check if auth is enabled and status
app.get('/api/auth/status', (req, res) => {
  res.json({
    authEnabled: AUTH_ENABLED,
    authenticated: isRequestAuthenticated(req)
  });
});

// POST /api/auth/login - Validate password and generate session token
app.post('/api/auth/login', (req, res) => {
  if (!AUTH_ENABLED) {
    return res.json({ success: true, token: null });
  }
  const { password } = req.body;
  if (password === ADMIN_PASSWORD) {
    res.json({ success: true, token: SESSION_TOKEN });
  } else {
    res.status(401).json({ success: false, error: "Incorrect password." });
  }
});

// GET /api/config - Returns JSON configuration (sanitized if not authenticated)
app.get('/api/config', (req, res) => {
  const config = loadConfig();
  if (AUTH_ENABLED && !isRequestAuthenticated(req)) {
    // Return sanitized configuration masking Proxmox tokens
    const sanitizedConfig = JSON.parse(JSON.stringify(config));
    sanitizedConfig.categories = sanitizedConfig.categories.map(cat => {
      if (cat.type === 'proxmox') {
        return {
          ...cat,
          proxmoxTokenId: cat.proxmoxTokenId ? '********' : '',
          proxmoxTokenSecret: cat.proxmoxTokenSecret ? '********' : ''
        };
      }
      return cat;
    });
    return res.json(sanitizedConfig);
  }
  res.json(config);
});

// POST /api/config - Saves updated layout config
app.post('/api/config', (req, res) => {
  if (AUTH_ENABLED && !isRequestAuthenticated(req)) {
    return res.status(401).json({ error: "Unauthorized. Password protection is enabled." });
  }
  try {
    const configData = req.body;
    if (!configData || !configData.categories || !configData.settings) {
      return res.status(400).json({ error: "Invalid configuration format." });
    }
    
    // Safely restore masked credentials if the save request was made with fallback placeholders
    const finalConfig = JSON.parse(JSON.stringify(configData));
    const originalConfig = loadConfig();
    finalConfig.categories = finalConfig.categories.map(cat => {
      if (cat.type === 'proxmox') {
        const originalCat = originalConfig.categories.find(o => o.id === cat.id);
        if (originalCat) {
          if (cat.proxmoxTokenId === '********') {
            cat.proxmoxTokenId = originalCat.proxmoxTokenId;
          }
          if (cat.proxmoxTokenSecret === '********') {
            cat.proxmoxTokenSecret = originalCat.proxmoxTokenSecret;
          }
        }
      }
      return cat;
    });

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(finalConfig, null, 2), 'utf-8');
    res.json({ success: true, message: "Configuration saved successfully." });
  } catch (error) {
    console.error("Error saving config:", error);
    res.status(500).json({ error: "Failed to write configuration file." });
  }
});

// GET /api/proxmox/:categoryId - Proxies requests for a given Proxmox category
app.get('/api/proxmox/:categoryId', async (req, res) => {
  try {
    const config = loadConfig();
    const category = config.categories.find(cat => cat.id === req.params.categoryId);
    
    if (!category) {
      return res.status(404).json({ error: "Category not found." });
    }
    if (category.type !== "proxmox") {
      return res.status(400).json({ error: "Requested category is not a Proxmox type." });
    }

    let apiUrl = (category.proxmoxUrl || "").trim();
    if (!apiUrl) {
      return res.status(400).json({ error: "Proxmox API URL is empty." });
    }

    // Standardize URL to end with /api2/json
    if (!apiUrl.includes("/api2/json")) {
      apiUrl = apiUrl.replace(/\/$/, "");
      apiUrl += "/api2/json";
    }
    apiUrl = apiUrl.replace(/\/$/, "");
    
    const requestUrl = `${apiUrl}/cluster/resources?type=vm`;
    const tokenId = category.proxmoxTokenId;
    const tokenSecret = category.proxmoxTokenSecret;

    const response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        "Authorization": `PVEAPIToken=${tokenId}=${tokenSecret}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxmox proxy error:", error);
    let errorMsg = error.message || "Failed to fetch from Proxmox VE API.";
    if (error.cause && error.cause.code === 'ECONNREFUSED') {
      errorMsg = "Destination Unreachable (Connection Refused). Ensure the Proxmox server is online and the URL is correct.";
    }
    res.status(500).json({ error: errorMsg });
  }
});

// GET /api/host/stats - Returns CPU, RAM, and uptime metrics of the server host
app.get('/api/host/stats', (req, res) => {
  try {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const ramPct = (usedMem / totalMem) * 100;
    
    res.json({
      cpu: currentCpuUsage.toFixed(1),
      ram: ramPct.toFixed(1),
      uptime: os.uptime()
    });
  } catch (e) {
    console.error("Error fetching host stats:", e);
    res.status(500).json({ error: "Failed to read host stats." });
  }
});

// GET /api/status/ping - Returns active ping cache for all links
app.get('/api/status/ping', (req, res) => {
  res.json(linkStatusCache);
});

// Wildcard path to serve index.html in production
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`mDash server running on port ${PORT}`);
});
