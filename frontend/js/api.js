/**
 * Tourist Guide & TravelMind AI — Central API Client
 * Automatically manages JWT authorization headers and error handling.
 */

const API_BASE = window.location.protocol === 'file:' ? 'http://localhost:8080/api' : '/api';

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

            // Handle token expiration or unauthenticated / forbidden access
            if ((response.status === 401 || response.status === 403) && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
                console.warn(`Session expired or unauthorized (status ${response.status}). Clearing token.`);
                this.setToken(null);
                localStorage.removeItem('tourist_user');
                if (!window.location.pathname.includes('login.html')) {
                    const currentPage = window.location.pathname.split('/').pop() || 'chatbot.html';
                    window.location.href = `login.html?expired=true&redirect=${encodeURIComponent(currentPage)}`;
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
            throw error;
        }
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
