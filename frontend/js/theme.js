// @ts-nocheck
/**
 * TouristAI — Theme Switcher (Dark & Light)
 * Luxury Travel Editorial Styling
 */
(function() {
    const savedTheme = localStorage.getItem('touristai_theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);

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

    document.addEventListener('DOMContentLoaded', () => {
        updateIcons(savedTheme);
        const buttons = document.querySelectorAll('.theme-toggle-btn');
        buttons.forEach(btn => {
            btn.addEventListener('click', window.toggleTheme);
        });
    });
})();
