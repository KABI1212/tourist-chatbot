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
     * Common fetch wrapper
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

        const config = {
            ...options,
            headers
        };

        try {
            const response = await fetch(url, config);

            // Handle token expiration for protected endpoints only
            const protectedEndpoints = ['/trips', '/favorites', '/users', '/chat/history', '/chat/clear'];
            const isProtected = protectedEndpoints.some(p => endpoint.includes(p));

            if ((response.status === 401 || response.status === 403) && isProtected && this.getToken()) {
                console.warn(`Session expired or unauthorized on protected endpoint: ${endpoint}`);
                this.setToken(null);
                localStorage.removeItem('tourist_user');
                if (window.location.pathname.includes('dashboard.html')) {
                    window.location.href = `login.html?expired=true&redirect=dashboard.html`;
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
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
};

// Verified, Accessible Destination Images Catalog
window.DESTINATION_IMAGE_CATALOG = {
    'ooty': 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800',
    'manali': 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800',
    'kerala': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800',
    'kerala backwaters': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800',
    'goa': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800',
    'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
    'eiffel tower': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
    'taj mahal': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800',
    'agra': 'https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800',
    'colosseum': 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
    'statue of liberty': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800',
    'new york': 'https://images.unsplash.com/photo-1534430480872-3498386e7856?w=800',
    'machu picchu': 'https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=800',
    'great wall of china': 'https://images.unsplash.com/photo-1508804185872-d7badad00f7d?w=800',
    'santorini': 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800',
    'jaipur': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800',
    'ladakh': 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=800',
    'leh': 'https://images.unsplash.com/photo-1581793745862-99fde7fa73d2?w=800',
    'varanasi': 'https://images.unsplash.com/photo-1561359313-0639aad49ca6?w=800',
    'shimla': 'https://images.unsplash.com/photo-1597074866923-dc0589150358?w=800',
    'darjeeling': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800',
    'munnar': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800',
    'mysore': 'https://images.unsplash.com/photo-1590766940554-634a7ed41450?w=800',
    'pondicherry': 'https://images.unsplash.com/photo-1582510003544-4d00b7f74220?w=800',
    'rishikesh': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800',
    'hampi': 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=800',
    'coorg': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=800',
    'nainital': 'https://images.unsplash.com/photo-1597074866923-dc0589150358?w=800',
    'udaipur': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800',
    'alleppey': 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800',
    'kodaikanal': 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800',
    'jaisalmer': 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800',
    'gulmarg': 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800',
    'srinagar': 'https://images.unsplash.com/photo-1597074866923-dc0589150358?w=800',
    'amritsar': 'https://images.unsplash.com/photo-1589987607627-616cac5c2c5a?w=800',
    'khajuraho': 'https://images.unsplash.com/photo-1589308078059-be1415eab4c3?w=800',
    'shillong': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800',
    'gangtok': 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800',
    'dubai': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800',
    'london': 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800',
    'bali': 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
    'tokyo': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    'kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    'sydney': 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=800',
    'singapore': 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=800',
    'bangkok': 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=800'
};

window.getDestinationImage = function(destName) {
    if (!destName || typeof destName !== 'string') return 'assets/dash.jpg';
    const key = destName.toLowerCase().trim();
    if (window.DESTINATION_IMAGE_CATALOG[key]) {
        return window.DESTINATION_IMAGE_CATALOG[key];
    }
    for (const [k, url] of Object.entries(window.DESTINATION_IMAGE_CATALOG)) {
        if (key.includes(k) || k.includes(key)) return url;
    }
    if (key.includes('beach') || key.includes('island') || key.includes('coast')) {
        return 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800';
    }
    if (key.includes('snow') || key.includes('mountain') || key.includes('hill') || key.includes('peak')) {
        return 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800';
    }
    if (key.includes('temple') || key.includes('heritage') || key.includes('palace') || key.includes('fort')) {
        return 'https://images.unsplash.com/photo-1477587458883-47145ed94245?w=800';
    }
    if (key.includes('lake') || key.includes('waterfall') || key.includes('backwater') || key.includes('river')) {
        return 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800';
    }
    return 'assets/dash.jpg';
};

window.handleImageError = function(imgEl, destName) {
    if (!imgEl) return;
    const stage = parseInt(imgEl.dataset.fallbackStage || '0', 10);
    if (stage >= 2) {
        imgEl.onerror = null;
        imgEl.src = 'assets/dash.jpg';
        return;
    }
    if (stage === 1) {
        imgEl.dataset.fallbackStage = '2';
        imgEl.src = 'assets/dash.jpg';
        return;
    }
    imgEl.dataset.fallbackStage = '1';
    imgEl.src = window.getDestinationImage(destName);
};
