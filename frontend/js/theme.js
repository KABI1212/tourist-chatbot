// @ts-nocheck
/**
 * TouristAI — Theme Switcher (Dark & Light)
 * Integrates dynamic brand logo and favicon variants per active theme
 */
(function() {
    function getInitialTheme() {
        const saved = localStorage.getItem('touristai_theme');
        if (saved === 'light' || saved === 'dark') return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light';
        }
        return 'dark';
    }

    const currentTheme = getInitialTheme();
    document.documentElement.setAttribute('data-theme', currentTheme);

    function updateFavicon(theme) {
        let favLink = document.querySelector("link[rel='icon']");
        if (!favLink) {
            favLink = document.createElement('link');
            favLink.rel = 'icon';
            document.head.appendChild(favLink);
        }
        favLink.type = 'image/png';
        if (theme === 'light') {
            favLink.href = 'assets/brand/favicon-light-32x32.png';
        } else {
            favLink.href = 'assets/brand/favicon-dark-16x16.png';
        }

        let themeColorMeta = document.querySelector("meta[name='theme-color']");
        if (!themeColorMeta) {
            themeColorMeta = document.createElement('meta');
            themeColorMeta.name = 'theme-color';
            document.head.appendChild(themeColorMeta);
        }
        themeColorMeta.content = (theme === 'light') ? '#F7F4ED' : '#11110F';
    }

    function updateIcons(theme) {
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(btn => {
            if (theme === 'dark') {
                btn.innerHTML = '<i class="fas fa-sun"></i>';
                btn.setAttribute('title', 'Switch to Warm Ivory Light Mode');
                btn.setAttribute('aria-label', 'Switch to Warm Ivory Light Mode');
            } else {
                btn.innerHTML = '<i class="fas fa-moon"></i>';
                btn.setAttribute('title', 'Switch to Charcoal Dark Mode');
                btn.setAttribute('aria-label', 'Switch to Charcoal Dark Mode');
            }
        });
        updateFavicon(theme);
    }

    window.toggleTheme = function() {
        const current = document.documentElement.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('touristai_theme', next);
        updateIcons(next);
        
        // Dispatch event for components that need to redraw (like Leaflet maps)
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));
    };

    // Initialize early for favicon
    updateFavicon(currentTheme);

    // Listen to system theme preference changes if user hasn't explicitly set one
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', e => {
            if (!localStorage.getItem('touristai_theme')) {
                const next = e.matches ? 'light' : 'dark';
                document.documentElement.setAttribute('data-theme', next);
                updateIcons(next);
                window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme: next } }));
            }
        });
    }

    document.addEventListener('DOMContentLoaded', () => {
        const activeTheme = document.documentElement.getAttribute('data-theme') || currentTheme;
        updateIcons(activeTheme);
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', window.toggleTheme);
        });
    });
})();

