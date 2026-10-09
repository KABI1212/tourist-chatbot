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
const getApiBase = () => {
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

    return '/api';
};

const API_BASE = getApiBase();

const Api = {
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
