// @ts-nocheck
/**
 * TouristAI — Theme Switcher (Dark & Light)
 * Integrates dynamic brand logo and favicon variants per active theme
 */
(function() {
    const savedTheme = localStorage.getItem('touristai_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

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
    updateFavicon(savedTheme);

    document.addEventListener('DOMContentLoaded', () => {
        updateIcons(savedTheme);
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', window.toggleTheme);
        });
    });
})();
