/**
 * Tourist Guide & TravelMind AI — Core UI App Logic
 */

const App = {
    toast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type] || 'fa-bell'}"></i>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(40px)';
            toast.style.transition = 'all 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    },

    toggleMobileMenu() {
        const nav = document.getElementById('navLinks');
        if (nav) {
            nav.classList.toggle('open');
        }
    },

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        if (sidebar) {
            sidebar.classList.toggle('open');
        }
    },

    initPWA() {
        if ('serviceWorker' in navigator && window.location.protocol.startsWith('http')) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                    .then((reg) => {
                        console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);
                    })
                    .catch((err) => {
                        console.warn('[PWA] Service Worker registration failed:', err);
                    });
            });
        }

        window.addEventListener('online', () => {
            this.toast('You are back online. Synchronizing latest travel updates…', 'success');
        });

        window.addEventListener('offline', () => {
            this.toast('You are currently offline. Accessing cached travel plans.', 'info');
        });
    }
};

window.App = App;
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        App.initPWA();
    });
}
