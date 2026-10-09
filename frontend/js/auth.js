/**
 * Tourist Guide & TravelMind AI — Authentication Service
 */

const Auth = {
    getUser() {
        try {
            const data = localStorage.getItem('tourist_user');
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    setUser(user) {
        if (user) {
            localStorage.setItem('tourist_user', JSON.stringify(user));
        } else {
            localStorage.removeItem('tourist_user');
        }
    },

    isAuthenticated() {
        return !!Api.getToken();
    },

    async login(username, password) {
        const response = await Api.post('/auth/login', { username, password });
        const token = response?.token || response?.data?.token;
        const user = response?.user || response?.data?.user || (response?.username ? response : { username });
        if (token) {
            Api.setToken(token);
            this.setUser(user);
            return response;
        }
        throw new Error((response && response.message) || 'Login failed: Token not received');
    },

    async register(userData) {
        const response = await Api.post('/auth/register', userData);
        const token = response?.token || response?.data?.token;
        const user = response?.user || response?.data?.user || (response?.username ? response : { username: userData.username });
        if (token) {
            Api.setToken(token);
            this.setUser(user);
            return response;
        }
        return response;
    },

    async logout() {
        try {
            if (this.isAuthenticated()) {
                await Api.post('/auth/logout', {});
            }
        } catch (e) {
            console.warn('Logout notification failed:', e);
        } finally {
            Api.setToken(null);
            this.setUser(null);
            window.location.href = 'index.html';
        }
    },

    async fetchProfile() {
        try {
            const data = await Api.get('/auth/me');
            const user = data?.user || data?.data || (data?.username ? data : null);
            if (user) {
                this.setUser(user);
                return user;
            }
        } catch (e) {
            console.warn('Could not fetch user profile:', e);
        }
        return this.getUser();
    },

    /**
     * Updates navbar links dynamically based on login state
     */
    updateNavbar() {
        const authContainer = document.getElementById('navAuthLinks');
        if (!authContainer) return;

        const currentPath = window.location.pathname;
        const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === '';
        const isDest = currentPath.endsWith('destinations.html');
        const isPlanner = currentPath.endsWith('planner.html');
        const isChat = currentPath.endsWith('chatbot.html');
        const isDash = currentPath.endsWith('dashboard.html');

        let html = `
            <a href="index.html" class="nav-link ${isHome ? 'active' : ''}">Home</a>
            <a href="destinations.html" class="nav-link ${isDest ? 'active' : ''}">Destinations</a>
            <a href="planner.html" class="nav-link ${isPlanner ? 'active' : ''}">Plan Trip</a>
            <a href="chatbot.html" class="nav-link ${isChat ? 'active' : ''}"><i class="fas fa-sparkles" style="color:var(--accent-cyan);"></i> AI Chat</a>
        `;

        if (this.isAuthenticated()) {
            const user = this.getUser();
            const displayName = user ? (user.fullName || user.username) : 'Traveller';
            html += `
                <a href="dashboard.html" class="user-profile-menu ${isDash ? 'active' : ''}" title="View Saved Trips & Profile">
                    <div class="user-avatar-pill">${displayName.charAt(0).toUpperCase()}</div>
                    <span>${displayName}</span>
                </a>
                <a href="javascript:void(0)" onclick="Auth.logout()" class="nav-link" title="Sign Out"><i class="fas fa-sign-out-alt"></i></a>
            `;
        } else {
            html += `
                <a href="login.html" class="nav-btn-login">Login</a>
            `;
        }

        authContainer.innerHTML = html;
    },

    requireAuth() {
        if (!this.isAuthenticated()) {
            window.location.href = `login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
        }
    }
};

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', () => {
    Auth.updateNavbar();
});
