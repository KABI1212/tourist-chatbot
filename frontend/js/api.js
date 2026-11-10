/**
 * Tourist Guide & TravelMind AI — Central API Client
 * Automatically manages JWT authorization headers and error handling.
 */
/**
 * Dynamically resolves the API base URL:
 * 1. window.APP_CONFIG.BACKEND_URL (configured in js/config.js)
 * 2. window.__API_BASE__ (dynamic injection)
 * 3. localStorage 'tourist_api_url' (quick testing in browser)
 * 4. file:// protocol -> http://localhost:8080/api (local testing)
 * 5. Default -> '/api' (works with Vercel rewrites to Render)
 */
window.getApiBase = window.getApiBase || function() {
    if (window.APP_CONFIG && window.APP_CONFIG.BACKEND_URL && window.APP_CONFIG.BACKEND_URL.trim() !== '') {
        let base = window.APP_CONFIG.BACKEND_URL.trim().replace(/\/+$/, '');
        if (!base.endsWith('/api')) base += '/api';
        return base;
    }

    if (window.__API_BASE__ && window.__API_BASE__.trim() !== '') {
        let base = window.__API_BASE__.trim().replace(/\/+$/, '');
        if (!base.endsWith('/api')) base += '/api';
        return base;
    }

    try {
        const stored = localStorage.getItem('tourist_api_url');
        if (stored && stored.trim() !== '') {
            let base = stored.trim().replace(/\/+$/, '');
            if (!base.endsWith('/api')) base += '/api';
            return base;
        }
    } catch (e) {}

    if (window.location.protocol === 'file:') {
        return 'http://localhost:8080/api';
    }

    // When running locally on a separate dev server port (e.g. localhost:3000 or 5000 via `serve` / `live-server`),
    // automatically direct API calls to the local Spring Boot backend on port 8080.
    if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') &&
        window.location.port !== '8080') {
        return 'http://localhost:8080/api';
    }

    return '/api';
};

var getApiBase = window.getApiBase;
window.API_BASE = window.API_BASE || window.getApiBase();
var API_BASE = window.API_BASE;

var Api = window.Api || {
    /**
     * Get stored JWT token
     */
    getToken() {
        const token = localStorage.getItem('tourist_jwt_token');
        if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
            return null;
        }
        return token;
    },

    /**
     * Set stored JWT token
     */
    setToken(token) {
        if (token && token !== 'null' && token !== 'undefined') {
            localStorage.setItem('tourist_jwt_token', token);
        } else {
            localStorage.removeItem('tourist_jwt_token');
        }
    },

    /**
     * Get stored refresh token
     */
    getRefreshToken() {
        const token = localStorage.getItem('tourist_refresh_token');
        if (!token || token === 'null' || token === 'undefined' || token.trim() === '') {
            return null;
        }
        return token;
    },

    /**
     * Set stored refresh token
     */
    setRefreshToken(token) {
        if (token && token !== 'null' && token !== 'undefined') {
            localStorage.setItem('tourist_refresh_token', token);
        } else {
            localStorage.removeItem('tourist_refresh_token');
        }
    },

    /**
     * Attempts silent token rotation via /auth/refresh with single-in-flight mutex promise
     */
    tryRefreshToken() {
        if (window._touristRefreshTokenPromise) {
            return window._touristRefreshTokenPromise;
        }
        window._touristRefreshTokenPromise = (async () => {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) return false;
            try {
                const res = await fetch(`${API_BASE}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    credentials: 'include',
                    body: JSON.stringify({ refreshToken: refreshToken || '' })
                });
                if (res.ok) {
                    const data = await res.json();
                    const newToken = data?.data?.token || data?.token;
                    const newRefresh = data?.data?.refreshToken || data?.refreshToken;
                    if (newToken) {
                        this.setToken(newToken);
                        if (newRefresh) this.setRefreshToken(newRefresh);
                        return true;
                    }
                }
            } catch (e) {
                console.warn('Silent token refresh failed:', e);
            } finally {
                window._touristRefreshTokenPromise = null;
            }
            return false;
        })();
        return window._touristRefreshTokenPromise;
    },

    /**
     * Common fetch wrapper with automatic timeout and refresh-token rotation
     */
    async request(endpoint, options = {}) {
        const url = `${API_BASE}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        const token = this.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // Configure AbortController timeout (30 seconds default)
        const timeoutMs = options.timeoutMs || 30000;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const config = {
            credentials: 'include',
            ...options,
            headers,
            signal: options.signal || controller.signal
        };

        try {
            const response = await fetch(url, config);
            clearTimeout(timeoutId);

            // Handle token expiration for protected endpoints with automatic refresh rotation
            const protectedEndpoints = ['/trips', '/favorites', '/users', '/chat/history', '/chat/clear', '/auth/me', '/auth/sessions'];
            const isProtected = protectedEndpoints.some(p => endpoint.includes(p));

            if ((response.status === 401 || response.status === 403) && isProtected && !options._isRetry) {
                const refreshed = await this.tryRefreshToken();
                if (refreshed) {
                    return this.request(endpoint, { ...options, _isRetry: true });
                }

                console.warn(`Session expired or unauthorized on protected endpoint: ${endpoint}`);
                this.setToken(null);
                this.setRefreshToken(null);
                localStorage.removeItem('tourist_user');
                if (typeof window.Auth !== 'undefined' && window.Auth.updateNavbar) {
                    window.Auth.updateNavbar();
                }
                if (window.location.pathname.includes('dashboard.html')) {
                    window.location.replace('login.html?expired=true&redirect=dashboard.html');
                }
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errorMsg = data.message || data.error || `HTTP error ${response.status}`;
                throw new Error(errorMsg);
            }

            // Normalize ApiResponse envelope if present so all caller patterns work seamlessly
            if (data && typeof data === 'object' && 'success' in data && 'data' in data) {
                if (data.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
                    return Object.assign({}, data, data.data);
                }
                if (Array.isArray(data.data)) {
                    const arr = data.data;
                    arr.success = data.success;
                    arr.message = data.message;
                    arr.data = data.data;
                    return arr;
                }
                return data.data !== undefined ? data.data : data;
            }

            return data;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error('Connection timed out (30s). The server may be waking up from standby. Please retry.');
            }
            console.error(`API Error on [${options.method || 'GET'}] ${endpoint}:`, error);
            if (error instanceof TypeError && error.message.toLowerCase().includes('fetch')) {
                console.warn(
                    `[Tourist API Notice] Could not connect to backend at "${url}".\n` +
                    `• Render Free Tier services spin down when idle; waking up takes ~30-50s.\n` +
                    `• If deploying on Vercel, verify your Render backend URL in frontend/js/config.js or vercel.json rewrites.\n` +
                    `• You can test or change the API URL anytime via: Api.setBaseUrl('https://your-service.onrender.com/api')`
                );
            }
            throw error;
        }
    },

    getBaseUrl() {
        return API_BASE;
    },

    setBaseUrl(url) {
        if (url && url.trim()) {
            let clean = url.trim().replace(/\/+$/, '');
            if (!clean.endsWith('/api')) clean += '/api';
            localStorage.setItem('tourist_api_url', clean);
        } else {
            localStorage.removeItem('tourist_api_url');
        }
        window.location.reload();
    },

    get(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'GET' });
    },

    post(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            body: JSON.stringify(body)
        });
    },

    put(endpoint, body, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(body)
        });
    },

    delete(endpoint, options = {}) {
        return this.request(endpoint, { ...options, method: 'DELETE' });
    },

    async getCurrencyRates(base = 'USD') {
        try {
            return await this.get(`/currency/rates?base=${encodeURIComponent(base)}`);
        } catch (e) {
            console.warn('Currency rates fetch error:', e);
            return { base, rates: { USD: 1.0, INR: 83.5, EUR: 0.92, GBP: 0.79 } };
        }
    },

    async convertCurrency(from, to, amount) {
        try {
            return await this.get(`/currency/convert?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&amount=${encodeURIComponent(amount)}`);
        } catch (e) {
            console.warn('Currency conversion error:', e);
            return { from, to, amount, convertedAmount: amount, rate: 1.0 };
        }
    }
};

window.Api = Api;

// Global Worldwide Destination Autocomplete Controller
window.setupGlobalAutocomplete = function(inputEl, dropdownEl, onSelect) {
    if (!inputEl || !dropdownEl) return;
    let debounceTimer = null;
    let activeIndex = -1;
    let currentItems = [];

    const closeDropdown = () => {
        dropdownEl.classList.remove('active');
        dropdownEl.innerHTML = '';
        activeIndex = -1;
        currentItems = [];
    };

    const renderItems = (items) => {
        currentItems = items || [];
        activeIndex = -1;
        if (!items || items.length === 0) {
            dropdownEl.innerHTML = '<div class="autocomplete-empty"><i class="fas fa-location-crosshairs"></i> No matching destinations found. Press Enter to search globally.</div>';
            dropdownEl.classList.add('active');
            return;
        }

        dropdownEl.innerHTML = items.map((it, idx) => {
            const cat = (it.category || '').toLowerCase();
            const icon = cat.includes('beach') ? 'fa-umbrella-beach'
                : cat.includes('mountain') ? 'fa-mountain'
                : cat.includes('waterfall') ? 'fa-water'
                : cat.includes('temple') ? 'fa-place-of-worship'
                : cat.includes('nature') || cat.includes('wildlife') ? 'fa-tree'
                : 'fa-location-dot';

            const sub = it.state ? `${it.state}, ${it.country || ''}` : (it.country || 'Worldwide');
            const catBadge = it.category ? `<span class="autocomplete-item-badge">${window.escapeHtml(it.category)}</span>` : '';

            return `
                <div class="autocomplete-item" data-index="${idx}">
                    <div class="autocomplete-item-icon"><i class="fas ${icon}"></i></div>
                    <div class="autocomplete-item-info">
                        <div class="autocomplete-item-title">${window.escapeHtml(it.name)}</div>
                        <div class="autocomplete-item-sub">${window.escapeHtml(sub)}</div>
                    </div>
                    ${catBadge}
                </div>
            `;
        }).join('');

        dropdownEl.querySelectorAll('.autocomplete-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.index, 10);
                if (currentItems[idx]) {
                    closeDropdown();
                    if (typeof onSelect === 'function') onSelect(currentItems[idx]);
                }
            });
        });

        dropdownEl.classList.add('active');
    };

    inputEl.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const query = inputEl.value.trim();
        if (query.length < 2) {
            closeDropdown();
            return;
        }

        dropdownEl.innerHTML = '<div class="autocomplete-loading"><i class="fas fa-spinner fa-spin"></i> Searching worldwide destinations…</div>';
        dropdownEl.classList.add('active');

        debounceTimer = setTimeout(async () => {
            try {
                const res = await window.Api.get(`/destinations/autocomplete?q=${encodeURIComponent(query)}&limit=8`);
                const items = Array.isArray(res) ? res : (res.data || []);
                renderItems(items);
            } catch (e) {
                console.warn('Autocomplete lookup error:', e);
                closeDropdown();
            }
        }, 220);
    });

    inputEl.addEventListener('keydown', (e) => {
        const itemEls = dropdownEl.querySelectorAll('.autocomplete-item');
        if (!dropdownEl.classList.contains('active') || itemEls.length === 0) {
            if (e.key === 'Enter') {
                closeDropdown();
            }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            activeIndex = (activeIndex + 1) % itemEls.length;
            itemEls.forEach((el, i) => el.classList.toggle('selected', i === activeIndex));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            activeIndex = (activeIndex - 1 + itemEls.length) % itemEls.length;
            itemEls.forEach((el, i) => el.classList.toggle('selected', i === activeIndex));
        } else if (e.key === 'Enter') {
            if (activeIndex >= 0 && currentItems[activeIndex]) {
                e.preventDefault();
                const selected = currentItems[activeIndex];
                closeDropdown();
                if (typeof onSelect === 'function') onSelect(selected);
            }
        } else if (e.key === 'Escape') {
            closeDropdown();
        }
    });

    document.addEventListener('click', (e) => {
        if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            closeDropdown();
        }
    });
};

// Global Escape HTML Helper
window.escapeHtml = window.escapeHtml || function(str) {
    if (!str) return '';
    if (typeof document !== 'undefined') {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
};

// Verified, Distinct, High-Resolution Destination Photography Catalog (Zero duplicates)
window.DESTINATION_IMAGE_CATALOG = {
    'ooty': 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=1200&q=80',
    'kodaikanal': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&q=80',
    'munnar': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=1200&q=80',
    'alleppey': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80',
    'kerala': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=1200&q=80',
    'kerala backwaters': 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=1200&q=80',
    'goa': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&q=80',
    'manali': 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=1200&q=80',
    'shimla': 'https://images.unsplash.com/photo-1597074866923-dc0589150358?w=1200&q=80',
    'coorg': 'https://images.unsplash.com/photo-1600298882283-40b4dca8b211?w=1200&q=80',
    'mysore': 'https://images.unsplash.com/photo-1590766940554-634a7ed41450?w=1200&q=80',
    'hampi': 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=1200&q=80',
    'rishikesh': 'https://images.unsplash.com/photo-1544717302-de2939b7ef71?w=1200&q=80',
    'varanasi': 'https://images.unsplash.com/photo-1561359313-0639aad49ca6?w=1200&q=80',
    'jaipur': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=1200&q=80',
    'udaipur': 'https://images.unsplash.com/photo-1595846519845-68e298c2edd8?w=1200&q=80',
    'jaisalmer': 'https://images.unsplash.com/photo-1572978013897-b952f4cbfb49?w=1200&q=80',
    'ladakh': 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=1200&q=80',
    'leh': 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=1200&q=80',
    'srinagar': 'https://images.unsplash.com/photo-1566837945700-30057527ade0?w=1200&q=80',
    'gulmarg': 'https://images.unsplash.com/photo-1548013146-72479768bada?w=1200&q=80',
    'darjeeling': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=1200&q=80',
    'gangtok': 'https://images.unsplash.com/photo-1617854818583-09e7f077a156?w=1200&q=80',
    'shillong': 'https://images.unsplash.com/photo-1589802829985-817e51171b92?w=1200&q=80',
    'pondicherry': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=1200&q=80',
    'amritsar': 'https://images.unsplash.com/photo-1589987607627-616cac5c2c5a?w=1200&q=80',
    'nainital': 'https://images.unsplash.com/photo-1580974852861-c381510bc98a?w=1200&q=80',
    'khajuraho': 'https://images.unsplash.com/photo-1600100397608-f010f443b2f8?w=1200&q=80',
    'agra': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80',
    'taj mahal': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=1200&q=80',
    'paris': 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=1200&q=80',
    'eiffel tower': 'https://images.unsplash.com/photo-1511739001486-6bfe10ce785f?w=1200&q=80',
    'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=1200&q=80',
    'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80',
    'tokyo': 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200&q=80',
    'kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
    'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80',
    'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=1200&q=80',
    'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=1200&q=80',
    'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=1200&q=80',
    'colosseum': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&q=80',
    'rome': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200&q=80',
    'statue of liberty': 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=1200&q=80',
    'new york': 'https://images.unsplash.com/photo-1506146332389-18140dc7b2fb?w=1200&q=80',
    'santorini': 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200&q=80',
    'machu picchu': 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1200&q=80',
    'great wall of china': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=1200&q=80'
};

// Neutral Luxury Destination Monogram Generator (Never displays an unrelated photo or mountain road)
window.generateDestinationPlaceholder = function(destName) {
    const raw = (destName || 'Destination').trim();
    const displayName = raw.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    const words = displayName.split(/\s+/);
    const initials = words.length > 1
        ? (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
        : displayName.slice(0, 2).toUpperCase();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 500" width="800" height="500">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#0B132B" />
          <stop offset="50%" stop-color="#1C2541" />
          <stop offset="100%" stop-color="#0B132B" />
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stop-color="#C5A880" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#C5A880" stop-opacity="0" />
        </radialGradient>
      </defs>
      <rect width="800" height="500" fill="url(#bg)"/>
      <rect width="800" height="500" fill="url(#glow)"/>
      <rect x="24" y="24" width="752" height="452" rx="14" fill="none" stroke="#C5A880" stroke-opacity="0.3" stroke-width="1.5" stroke-dasharray="6 6"/>
      <circle cx="400" cy="180" r="56" fill="#1C2541" stroke="#C5A880" stroke-width="2"/>
      <text x="400" y="196" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="38" font-weight="700" fill="#E6C79C" letter-spacing="2">${initials}</text>
      <text x="400" y="290" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-size="32" font-weight="600" fill="#FFFFFF" letter-spacing="1">${window.escapeHtml(displayName)}</text>
      <rect x="310" y="320" width="180" height="26" rx="13" fill="#C5A880" fill-opacity="0.15" stroke="#C5A880" stroke-opacity="0.4" stroke-width="1"/>
      <text x="400" y="337" text-anchor="middle" font-family="'DM Sans', -apple-system, sans-serif" font-size="11" font-weight="600" fill="#E6C79C" letter-spacing="2">VERIFIED DESTINATION</text>
    </svg>`;

    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
};

window.getDestinationImage = function(destName) {
    if (!destName || typeof destName !== 'string') return window.generateDestinationPlaceholder('Destination');
    const key = destName.toLowerCase().trim();

    // 1. Direct exact catalog match
    if (window.DESTINATION_IMAGE_CATALOG[key]) {
        return window.DESTINATION_IMAGE_CATALOG[key];
    }

    // 2. Exact word boundary match
    for (const [k, url] of Object.entries(window.DESTINATION_IMAGE_CATALOG)) {
        if (key === k || key.startsWith(k + ' ') || key.endsWith(' ' + k) || key.includes(' ' + k + ' ')) {
            return url;
        }
    }

    // 3. Fall back to destination-specific neutral SVG placeholder (never display an unrelated photo)
    return window.generateDestinationPlaceholder(destName);
};

window.handleImageError = function(imgEl, destName) {
    if (!imgEl || imgEl.dataset.fallbackApplied === 'true') return;
    imgEl.dataset.fallbackApplied = 'true';
    imgEl.onerror = null;
    const name = destName || imgEl.getAttribute('data-dest-name') || imgEl.alt || 'Destination';
    imgEl.src = window.generateDestinationPlaceholder(name);
};
