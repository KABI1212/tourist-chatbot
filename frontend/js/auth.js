/**
 * Tourist Guide & TravelMind AI — Authentication Service
 * Enterprise-grade session management, route protection, and navigation sync.
 */

var Auth = window.Auth || {
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
        window.dispatchEvent(new CustomEvent('auth:change', { detail: { user } }));
    },

    getToken() {
        if (typeof Api !== 'undefined' && Api.getToken) {
            return Api.getToken();
        }
        return localStorage.getItem('tourist_jwt_token');
    },

    isAuthenticated() {
        const token = this.getToken();
        return !!(token && token !== 'null' && token !== 'undefined' && token.trim() !== '');
    },

    async login(username, password) {
        if (!username || !password) {
            throw new Error('Please enter both username and password.');
        }

        const response = await Api.post('/auth/login', { username: username.trim(), password });
        const token = response?.token || response?.data?.token;
        const user = response?.user || response?.data?.user || (response?.username ? response : { username: username.trim() });

        if (token) {
            Api.setToken(token);
            this.setUser(user);
            this.updateNavbar();
            return response;
        }
        throw new Error((response && response.message) || 'Login failed: Token not received from server');
    },

    async register(userData) {
        const response = await Api.post('/auth/register', userData);
        const token = response?.token || response?.data?.token;
        const user = response?.user || response?.data?.user || (response?.username ? response : { username: userData.username });

        if (token) {
            Api.setToken(token);
            this.setUser(user);
            this.updateNavbar();
            return response;
        }
        return response;
    },

    async logout() {
        try {
            if (this.isAuthenticated()) {
                await Api.post('/auth/logout', {}).catch(() => {});
            }
        } catch (e) {
            console.warn('Logout notification error:', e);
        } finally {
            // Invalidate client tokens and user session data safely
            Api.setToken(null);
            this.setUser(null);
            try {
                sessionStorage.clear();
                localStorage.removeItem('tourist_active_chat_id');
            } catch (e) {}

            // Update UI navigation state immediately
            this.updateNavbar();

            // Redirect user directly to the Login Page using replace to prevent back navigation
            window.location.replace('login.html?logout=true');
        }
    },

    async fetchProfile() {
        if (!this.isAuthenticated()) return null;
        try {
            const data = await Api.get('/auth/me');
            const user = data?.user || data?.data || (data?.username ? data : null);
            if (user) {
                this.setUser(user);
                this.updateNavbar();
                return user;
            }
        } catch (e) {
            console.warn('Could not refresh user profile from server:', e);
            if (e && (e.message?.includes('401') || e.message?.includes('UNAUTHORIZED') || e.message?.includes('token'))) {
                Api.setToken(null);
                this.setUser(null);
                this.updateNavbar();
                if (window.location.pathname.includes('dashboard.html')) {
                    window.location.replace('login.html?expired=true&redirect=dashboard.html');
                }
            }
        }
        return this.getUser();
    },

    /**
     * Route protection guard for authenticated pages
     */
    requireAuth() {
        if (!this.isAuthenticated()) {
            const current = window.location.pathname.split('/').pop() || 'index.html';
            const redirectTarget = current + window.location.search;
            window.location.replace(`login.html?redirect=${encodeURIComponent(redirectTarget)}`);
            return false;
        }
        return true;
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

        const currentLangMeta = (typeof I18n !== 'undefined') ? I18n.getLanguageMeta(I18n.getCurrentLanguage()) : { code: 'auto', nativeName: 'Language', flag: '🌐' };
        const langLabel = currentLangMeta.code === 'auto' ? 'Auto Detect' : currentLangMeta.nativeName;
        const langFlag = currentLangMeta.flag || '🌐';

        let html = `
            <a href="index.html" class="nav-link ${isHome ? 'active' : ''}" data-i18n="nav_home">Home</a>
            <a href="destinations.html" class="nav-link ${isDest ? 'active' : ''}" data-i18n="nav_destinations">Destinations</a>
            <a href="planner.html" class="nav-link ${isPlanner ? 'active' : ''}" data-i18n="nav_planner">Plan Trip</a>
            <a href="chatbot.html" class="nav-link ${isChat ? 'active' : ''}"><i class="fas fa-sparkles" style="color:var(--accent-gold);"></i> <span data-i18n="nav_chatbot">AI Chat</span></a>
        `;

        if (this.isAuthenticated()) {
            html += `
                <a href="dashboard.html" class="nav-link ${isDash ? 'active' : ''}"><i class="fas fa-compass" style="color:var(--accent-gold);"></i> <span>Dashboard</span></a>
            `;
        }

        html += `
            <button type="button" class="lang-selector-trigger" id="langSelectorBtn" onclick="typeof I18n !== 'undefined' && I18n.openModal()" title="Change Language">
                <span class="lang-selector-flag" id="currentLangFlag">${langFlag}</span>
                <span id="currentLangLabel">${langLabel}</span>
                <i class="fas fa-chevron-down" style="font-size:10px; opacity:0.7;"></i>
            </button>
        `;

        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const themeIcon = currentTheme === 'dark' ? 'fa-sun' : 'fa-moon';

        html += `
            <button type="button" class="theme-toggle-btn" onclick="window.toggleTheme && window.toggleTheme()" title="Toggle Theme" aria-label="Toggle Theme">
                <i class="fas ${themeIcon}"></i>
            </button>
        `;

        if (this.isAuthenticated()) {
            const user = this.getUser();
            const displayName = user ? (user.fullName || user.username) : 'Traveler';
            const initial = displayName.charAt(0).toUpperCase();

            html += `
                <div class="nav-user-dropdown-wrap" id="navUserDropdownWrap">
                    <button type="button" class="user-profile-menu ${isDash ? 'active' : ''}" id="userProfileBtn" onclick="Auth.toggleUserDropdown(event)" title="Account Menu">
                        <div class="user-avatar-pill">${initial}</div>
                        <span>${displayName}</span>
                        <i class="fas fa-chevron-down" style="font-size:10px; opacity:0.7; margin-left:4px;"></i>
                    </button>
                    <div class="nav-user-dropdown" id="navUserDropdown">
                        <div class="dropdown-user-header">
                            <div class="dropdown-user-name">${displayName}</div>
                            <div class="dropdown-user-handle">@${(user && user.username) || 'traveler'}</div>
                        </div>
                        <a href="dashboard.html?tab=overview" class="dropdown-item">
                            <i class="fas fa-chart-pie"></i> <span>Dashboard Overview</span>
                        </a>
                        <a href="dashboard.html?tab=trips" class="dropdown-item">
                            <i class="fas fa-suitcase-rolling"></i> <span>My Saved Trips</span>
                        </a>
                        <a href="dashboard.html?tab=places" class="dropdown-item">
                            <i class="fas fa-heart"></i> <span>Saved Places</span>
                        </a>
                        <a href="dashboard.html?tab=profile" class="dropdown-item">
                            <i class="fas fa-user-gear"></i> <span>Profile &amp; Settings</span>
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="javascript:void(0)" onclick="Auth.logout()" class="dropdown-item text-danger">
                            <i class="fas fa-sign-out-alt"></i> <span>Sign Out</span>
                        </a>
                    </div>
                </div>
            `;
        } else {
            html += `
                <a href="login.html" class="nav-btn-login" data-i18n="nav_login">Login</a>
                <a href="register.html" class="nav-link" style="font-weight:600; color:var(--accent-gold);">Sign Up</a>
            `;
        }

        authContainer.innerHTML = html;

        // Ensure mobile hamburger toggle button exists in navbar
        this.ensureMobileNavToggle();

        if (typeof I18n !== 'undefined' && I18n.applyTranslations) {
            I18n.applyTranslations();
        }
    },

    toggleUserDropdown(event) {
        if (event) event.stopPropagation();
        const dropdown = document.getElementById('navUserDropdown');
        const trigger = document.getElementById('userProfileBtn');
        if (dropdown) {
            const isOpen = dropdown.classList.contains('show');
            dropdown.classList.toggle('show', !isOpen);
            if (trigger) trigger.classList.toggle('open', !isOpen);
        }
    },

    closeUserDropdown() {
        const dropdown = document.getElementById('navUserDropdown');
        const trigger = document.getElementById('userProfileBtn');
        if (dropdown) dropdown.classList.remove('show');
        if (trigger) trigger.classList.remove('open');
    },

    ensureMobileNavToggle() {
        const navInner = document.querySelector('.navbar .nav-inner');
        if (!navInner || document.getElementById('navMobileToggle')) return;

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'nav-mobile-toggle';
        toggleBtn.id = 'navMobileToggle';
        toggleBtn.setAttribute('aria-label', 'Toggle Navigation Menu');
        toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
        toggleBtn.onclick = () => {
            const links = document.getElementById('navAuthLinks');
            if (links) {
                links.classList.toggle('mobile-open');
                toggleBtn.innerHTML = links.classList.contains('mobile-open')
                    ? '<i class="fas fa-times"></i>'
                    : '<i class="fas fa-bars"></i>';
            }
        };

        navInner.appendChild(toggleBtn);
    },

    init() {
        this.updateNavbar();

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const wrap = document.getElementById('navUserDropdownWrap');
            if (wrap && !wrap.contains(e.target)) {
                this.closeUserDropdown();
            }
        });

        // Close mobile nav on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeUserDropdown();
                const links = document.getElementById('navAuthLinks');
                if (links) links.classList.remove('mobile-open');
            }
        });

        // Synchronize and verify authentication in background
        if (this.isAuthenticated()) {
            this.fetchProfile();
        }

        // Handle browser Back / bfcache to prevent exposing authenticated pages after logout
        window.addEventListener('pageshow', (event) => {
            if (event.persisted) {
                this.updateNavbar();
                if (window.location.pathname.includes('dashboard.html') && !this.isAuthenticated()) {
                    window.location.replace('login.html');
                }
            }
        });
    }
};

window.Auth = Auth;

document.addEventListener('DOMContentLoaded', () => {
    Auth.init();
});
