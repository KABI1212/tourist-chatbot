// @ts-nocheck
/**
 * TouristAI — User Dashboard & Saved Trips Controller
 * Production-ready travel-management workspace.
 */

let allTrips = [];
let allFavorites = [];
let currentTripFilter = 'all';
let currentUserProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Guard against unauthenticated access
    if (typeof Auth === 'undefined' || !Auth.isAuthenticated()) {
        const current = window.location.pathname.split('/').pop() || 'dashboard.html';
        window.location.replace(`login.html?redirect=${encodeURIComponent(current + window.location.search)}`);
        return;
    }

    // 2. Reveal Dashboard Layout
    const layout = document.getElementById('dashboardLayoutApp');
    if (layout) layout.style.display = 'grid';

    // 3. Determine initial tab from URL param (default 'overview')
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') || 'overview';
    switchDashboardView(initialTab);

    // 4. Load real data from backend
    await Promise.all([
        loadUserProfile(),
        loadUserTrips(),
        loadUserFavorites()
    ]);
});

/**
 * Switch dashboard view tabs (overview, trips, places, profile)
 */
function switchDashboardView(viewName) {
    const validTabs = ['overview', 'trips', 'places', 'profile'];
    const activeTab = validTabs.includes(viewName) ? viewName : 'overview';

    // Tab sections
    const tabSectionMap = {
        'overview': 'viewOverview',
        'trips': 'viewMyTrips',
        'places': 'viewSavedPlaces',
        'profile': 'viewProfile'
    };

    // Sidebar nav items
    const sideNavMap = {
        'overview': 'tabNavOverview',
        'trips': 'tabNavTrips',
        'places': 'tabNavPlaces',
        'profile': 'tabNavProfile'
    };

    // Mobile tabs
    const mobTabMap = {
        'overview': 'mobTabOverview',
        'trips': 'mobTabTrips',
        'places': 'mobTabPlaces',
        'profile': 'mobTabProfile'
    };

    // Hide all sections, show active
    Object.values(tabSectionMap).forEach(secId => {
        const el = document.getElementById(secId);
        if (el) el.classList.remove('active');
    });

    const activeSec = document.getElementById(tabSectionMap[activeTab]);
    if (activeSec) activeSec.classList.add('active');

    // Update sidebar menu pills
    Object.values(sideNavMap).forEach(navId => {
        const el = document.getElementById(navId);
        if (el) el.classList.remove('active');
    });

    const activeSide = document.getElementById(sideNavMap[activeTab]);
    if (activeSide) activeSide.classList.add('active');

    // Update mobile tab bar pills
    Object.values(mobTabMap).forEach(mobId => {
        const el = document.getElementById(mobId);
        if (el) el.classList.remove('active');
    });

    const activeMob = document.getElementById(mobTabMap[activeTab]);
    if (activeMob) activeMob.classList.add('active');

    // Update URL param without refreshing
    try {
        const url = new URL(window.location);
        url.searchParams.set('tab', activeTab);
        window.history.replaceState({}, '', url);
    } catch (e) {}

    // If switching to places, ensure refreshed
    if (activeTab === 'places' && allFavorites.length === 0) {
        loadUserFavorites();
    }
}

/**
 * Load authenticated user profile details from server
 */
async function loadUserProfile() {
    try {
        const profile = await Auth.fetchProfile();
        currentUserProfile = profile;
        populateProfileFields(profile);
    } catch (e) {
        console.warn('Could not load user profile:', e);
        const cached = Auth.getUser();
        if (cached) populateProfileFields(cached);
    }
}

function populateProfileFields(user) {
    if (!user) return;
    const displayName = user.fullName || user.username || 'Traveler';
    const email = user.email || `${user.username}@touristguide.com`;
    const initial = displayName.charAt(0).toUpperCase();

    // Top greeting
    const greetEl = document.getElementById('dashGreetingName');
    if (greetEl) greetEl.textContent = displayName;

    // Sidebar widget
    const nameEl = document.getElementById('dashUserName');
    if (nameEl) nameEl.textContent = displayName;

    const emailEl = document.getElementById('dashUserEmail');
    if (emailEl) emailEl.textContent = email;

    const avatarEl = document.getElementById('dashUserAvatar');
    if (avatarEl) avatarEl.textContent = initial;

    // Profile form fields
    const fUsername = document.getElementById('profUsername');
    if (fUsername) fUsername.value = user.username || '';

    const fFullName = document.getElementById('profFullName');
    if (fFullName) fFullName.value = user.fullName || '';

    const fEmail = document.getElementById('profEmail');
    if (fEmail) fEmail.value = user.email || '';

    const fPhone = document.getElementById('profPhone');
    if (fPhone) fPhone.value = user.phone || '';

    const fAddress = document.getElementById('profAddress');
    if (fAddress) fAddress.value = user.address || '';

    const fBio = document.getElementById('profBio');
    if (fBio) fBio.value = user.bio || '';

    // Account metadata
    const createdEl = document.getElementById('accountCreatedDate');
    if (createdEl && user.createdAt) {
        try {
            const d = new Date(user.createdAt);
            createdEl.textContent = d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (e) {
            createdEl.textContent = 'Active Member';
        }
    }
}

/**
 * Load user's saved trips from server
 */
async function loadUserTrips() {
    try {
        const res = await Api.get('/trips');
        const trips = Array.isArray(res) ? res : (res?.data || []);
        allTrips = Array.isArray(trips) ? trips : [];
    } catch (e) {
        console.warn('Could not load user trips from server:', e);
        allTrips = [];
    }

    updateDashboardMetrics();
    renderTripsList();
    renderOverviewRecentTrips();
}

/**
 * Load user's saved favorite destinations from server
 */
async function loadUserFavorites() {
    try {
        const res = await Api.get('/favorites');
        const favs = Array.isArray(res) ? res : (res?.data || []);
        allFavorites = Array.isArray(favs) ? favs : [];
    } catch (e) {
        console.warn('Could not load user favorites from server:', e);
        allFavorites = [];
    }

    updateDashboardMetrics();
    renderFavoritesList();
}

/**
 * Update stats and counters using actual data
 */
function updateDashboardMetrics() {
    const totalTrips = allTrips.length;
    const upcomingTrips = allTrips.filter(t => (t.status || 'upcoming').toLowerCase() !== 'past' && (t.status || '').toLowerCase() !== 'completed').length;
    const savedPlaces = allFavorites.length;

    // Calculate total days planned
    const totalDays = allTrips.reduce((acc, t) => acc + (parseInt(t.days, 10) || 3), 0);

    // Update Overview Stat Cards
    const statTotalTripsEl = document.getElementById('statTotalTrips');
    if (statTotalTripsEl) statTotalTripsEl.textContent = totalTrips;

    const statUpcomingTripsEl = document.getElementById('statUpcomingTrips');
    if (statUpcomingTripsEl) statUpcomingTripsEl.textContent = upcomingTrips;

    const statSavedPlacesEl = document.getElementById('statSavedPlaces');
    if (statSavedPlacesEl) statSavedPlacesEl.textContent = savedPlaces;

    const statTotalDaysEl = document.getElementById('statTotalDays');
    if (statTotalDaysEl) statTotalDaysEl.textContent = totalDays;

    // Sidebar & Mobile Badges
    const badgeTrips = document.getElementById('badgeTripsCount');
    if (badgeTrips) badgeTrips.textContent = totalTrips;

    const mobBadgeTrips = document.getElementById('mobBadgeTrips');
    if (mobBadgeTrips) mobBadgeTrips.textContent = totalTrips;

    const badgePlaces = document.getElementById('badgePlacesCount');
    if (badgePlaces) badgePlaces.textContent = savedPlaces;

    const mobBadgePlaces = document.getElementById('mobBadgePlaces');
    if (mobBadgePlaces) mobBadgePlaces.textContent = savedPlaces;

    // Filter tab counts
    const countAll = document.getElementById('countFilterAll');
    if (countAll) countAll.textContent = totalTrips;

    const countUpcoming = document.getElementById('countFilterUpcoming');
    if (countUpcoming) countUpcoming.textContent = upcomingTrips;

    const countPast = document.getElementById('countFilterPast');
    if (countPast) countPast.textContent = totalTrips - upcomingTrips;
}

/**
 * Filter trips by status (all, upcoming, past)
 */
function filterTripsByStatus(status, btnElement) {
    currentTripFilter = status || 'all';

    document.querySelectorAll('.trip-tab-pill').forEach(b => b.classList.remove('active'));
    if (btnElement) {
        btnElement.classList.add('active');
    } else {
        const idMap = { all: 'filterBtnAll', upcoming: 'filterBtnUpcoming', past: 'filterBtnPast' };
        const el = document.getElementById(idMap[currentTripFilter]);
        if (el) el.classList.add('active');
    }

    renderTripsList();
}

/**
 * Render trips list based on active filter
 */
function renderTripsList() {
    const container = document.getElementById('tripsCardsList');
    const emptyState = document.getElementById('tripsEmptyState');
    if (!container || !emptyState) return;

    let filtered = allTrips;
    if (currentTripFilter === 'upcoming') {
        filtered = allTrips.filter(t => (t.status || 'upcoming').toLowerCase() !== 'past' && (t.status || '').toLowerCase() !== 'completed');
    } else if (currentTripFilter === 'past') {
        filtered = allTrips.filter(t => (t.status || '').toLowerCase() === 'past' || (t.status || '').toLowerCase() === 'completed');
    }

    if (filtered.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        emptyState.style.display = 'block';

        const titleEl = document.getElementById('tripsEmptyTitle');
        const textEl = document.getElementById('tripsEmptyText');
        if (currentTripFilter === 'past') {
            if (titleEl) titleEl.textContent = 'No Past Trips Yet';
            if (textEl) textEl.textContent = 'Trips you complete will appear here for you to look back on your adventures.';
        } else if (currentTripFilter === 'upcoming') {
            if (titleEl) titleEl.textContent = 'No Upcoming Trips Planned';
            if (textEl) textEl.textContent = 'Ready to embark on a new journey? Use our AI Planner to generate and customize your day-by-day plan.';
        } else {
            if (titleEl) titleEl.textContent = 'No Saved Trips Yet';
            if (textEl) textEl.textContent = 'Generate custom day-wise itineraries with transportation, hotels, and activities, and bookmark them here.';
        }
        return;
    }

    emptyState.style.display = 'none';
    container.style.display = 'flex';
    container.innerHTML = filtered.map(t => renderTripRowHtml(t)).join('');
}

/**
 * Render recent trips in the Overview tab
 */
function renderOverviewRecentTrips() {
    const container = document.getElementById('overviewRecentTripsContainer');
    const emptyState = document.getElementById('overviewNoTripsState');
    if (!container || !emptyState) return;

    if (allTrips.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    container.style.display = 'flex';

    // Show up to 2 most recent trips
    const recent = allTrips.slice(0, 2);
    container.innerHTML = recent.map(t => renderTripRowHtml(t)).join('');
}

/**
 * Generate HTML string for a single trip card
 */
function renderTripRowHtml(t) {
    const destName = t.destination || t.title || 'Worldwide Destination';
    const img = t.imageUrl || (typeof window.getDestinationImage === 'function' ? window.getDestinationImage(destName) : 'assets/dash.jpg');
    const isPast = (t.status || '').toLowerCase() === 'past' || (t.status || '').toLowerCase() === 'completed';
    const badgeClass = isPast ? 'badge-past' : 'badge-upcoming';
    const badgeText = isPast ? 'Past Trip' : 'Upcoming';

    const dateRange = (t.startDate && t.endDate)
        ? `${t.startDate} - ${t.endDate}`
        : `${t.days || 3} Days Trip`;

    const travelersText = `${t.people || 2} Traveler${(t.people || 2) > 1 ? 's' : ''}`;
    const budgetText = t.estimatedBudget ? `• Est. ₹${Number(t.estimatedBudget).toLocaleString('en-IN')}` : '';

    return `
        <div class="saved-trip-row-card" id="tripRow-${escapeAttr(t.id)}">
            <div class="trip-card-left">
                <img class="trip-thumb-img" src="${img}" alt="${escapeAttr(t.title || destName)}" onerror="window.handleImageError(this, '${escapeAttr(destName)}');" loading="lazy">
                <div class="trip-info-texts">
                    <h3>${escapeHtml(t.title || ('Trip to ' + destName))}</h3>
                    <div class="trip-info-meta">
                        <span><i class="far fa-calendar-alt" style="color:var(--accent-gold);"></i> ${escapeHtml(dateRange)}</span>
                        <span><i class="fas fa-users" style="color:var(--accent-cyan);"></i> ${escapeHtml(travelersText)}</span>
                        ${budgetText ? `<span style="color:var(--accent-emerald); font-weight:600;">${escapeHtml(budgetText)}</span>` : ''}
                        <span class="badge-tag ${badgeClass}">${badgeText}</span>
                    </div>
                </div>
            </div>

            <div class="trip-card-actions">
                <button type="button" class="btn btn-outline btn-sm" onclick="openTripModal('${escapeAttr(t.id)}')">
                    <i class="fas fa-eye"></i> View Itinerary
                </button>
                <button type="button" class="btn btn-outline btn-sm" style="color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" onclick="deleteTrip('${escapeAttr(t.id)}')" title="Delete Trip Plan">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `;
}

/**
 * Render saved places / favorites grid
 */
function renderFavoritesList() {
    const grid = document.getElementById('favoritesCardsGrid');
    const emptyState = document.getElementById('favoritesEmptyState');
    if (!grid || !emptyState) return;

    if (allFavorites.length === 0) {
        grid.style.display = 'none';
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';
    grid.style.display = 'grid';

    grid.innerHTML = allFavorites.map(f => {
        const destName = f.destinationName || 'Landmark';
        const img = typeof window.getDestinationImage === 'function' ? window.getDestinationImage(destName) : 'assets/dash.jpg';
        const country = f.country || 'Worldwide';
        const notes = f.notes || 'Saved to your personal travel wishlist.';

        return `
            <div class="favorite-card" id="favoriteCard-${escapeAttr(f.id)}">
                <div class="favorite-card-img-wrap">
                    <img class="favorite-card-img" src="${img}" alt="${escapeAttr(destName)}" onerror="window.handleImageError(this, '${escapeAttr(destName)}');" loading="lazy">
                </div>
                <div class="favorite-card-body">
                    <h4 class="favorite-card-title">${escapeHtml(destName)}</h4>
                    <div class="favorite-card-sub"><i class="fas fa-location-dot" style="color:var(--accent-gold);"></i> ${escapeHtml(country)}</div>
                    <p style="font-size:13px; color:var(--text-muted); margin-bottom:16px; line-height:1.5;">${escapeHtml(notes)}</p>
                    <div class="favorite-card-actions">
                        <a href="destinations.html?view=${encodeURIComponent(destName)}" class="btn btn-outline btn-sm" style="flex:1; justify-content:center;">
                            <i class="fas fa-compass"></i> Explore
                        </a>
                        <button type="button" class="btn btn-outline btn-sm" style="color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" onclick="removeFavorite('${escapeAttr(f.id)}')" title="Remove from Wishlist">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Open Trip Detail Modal
 */
function openTripModal(tripId) {
    const trip = allTrips.find(t => String(t.id) === String(tripId));
    if (!trip) return;

    const modal = document.getElementById('tripDetailModal');
    const content = document.getElementById('modalTripContent');
    if (!modal || !content) return;

    const days = trip.daysPlan || [];
    const destName = trip.destination || trip.title || 'Travel Journey';
    const dateRange = (trip.startDate && trip.endDate) ? `${trip.startDate} to ${trip.endDate}` : `${trip.days || 3} Days Trip`;

    let daysHtml = '';
    if (Array.isArray(days) && days.length > 0) {
        daysHtml = days.map(d => {
            const activities = Array.isArray(d.activities) ? d.activities : [];
            return `
                <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; padding:18px 20px; margin-bottom:14px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                        <strong style="color:var(--accent-gold); font-size:14px;">Day ${d.dayNumber || ''}</strong>
                        <span style="font-size:12.5px; color:var(--text-dim);"><i class="fas fa-location-dot"></i> ${escapeHtml(d.location || destName)}</span>
                    </div>
                    <h4 style="color:var(--text-main); font-size:16px; font-weight:700; margin-bottom:8px;">${escapeHtml(d.title || ('Day ' + d.dayNumber + ' Schedule'))}</h4>
                    <ul style="list-style:disc; margin-left:20px; font-size:13.5px; color:var(--text-muted); line-height:1.7;">
                        ${activities.map(a => `<li>${escapeHtml(a)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }).join('');
    } else if (trip.itinerary) {
        daysHtml = `
            <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:12px; padding:20px; font-size:14px; color:var(--text-main); line-height:1.7; white-space:pre-wrap;">
                ${escapeHtml(trip.itinerary)}
            </div>
        `;
    } else {
        daysHtml = `<p style="color:var(--text-muted); font-size:14px;">Day-by-day activities saved with this itinerary.</p>`;
    }

    let budgetBreakdownHtml = '';
    if (trip.budgetBreakdown && typeof trip.budgetBreakdown === 'object') {
        const items = Object.entries(trip.budgetBreakdown).map(([k, v]) => `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:8px; padding:10px 14px;">
                <span style="font-size:11px; text-transform:uppercase; color:var(--text-dim);">${escapeHtml(k)}</span>
                <div style="font-size:16px; font-weight:700; color:var(--text-main); margin-top:2px;">₹${Number(v).toLocaleString('en-IN')}</div>
            </div>
        `).join('');

        budgetBreakdownHtml = `
            <div style="margin-top:22px;">
                <h4 style="font-size:15px; font-weight:700; color:var(--text-main); margin-bottom:10px;"><i class="fas fa-coins" style="color:var(--accent-gold);"></i> Estimated Budget Breakdown</h4>
                <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(130px, 1fr)); gap:10px;">
                    ${items}
                </div>
            </div>
        `;
    }

    let tipsHtml = '';
    if (trip.travelTips && Array.isArray(trip.travelTips) && trip.travelTips.length > 0) {
        tipsHtml = `
            <div style="margin-top:22px;">
                <h4 style="font-size:15px; font-weight:700; color:var(--text-main); margin-bottom:8px;"><i class="fas fa-lightbulb" style="color:var(--accent-gold);"></i> Recommended Travel Tips</h4>
                <ul style="list-style:disc; margin-left:20px; font-size:13.5px; color:var(--text-muted); line-height:1.6;">
                    ${trip.travelTips.map(tip => `<li>${escapeHtml(tip)}</li>`).join('')}
                </ul>
            </div>
        `;
    }

    content.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:16px; padding-right:30px;">
            <div>
                <span class="badge-tag badge-upcoming" style="margin-bottom:8px;">${escapeHtml(trip.status || 'Upcoming')}</span>
                <h2 style="font-family:var(--font-display); font-size:28px; color:var(--text-main); font-weight:700;">${escapeHtml(trip.title || ('Trip to ' + destName))}</h2>
                <p style="color:var(--text-muted); font-size:14px; margin-top:4px;">
                    <i class="fas fa-map-pin" style="color:var(--accent-gold);"></i> ${escapeHtml(destName)} • 
                    <i class="far fa-calendar-alt"></i> ${escapeHtml(dateRange)} • 
                    <i class="fas fa-users"></i> ${trip.people || 2} Travelers
                </p>
            </div>
        </div>

        <div style="margin-top:24px;">
            <h3 style="font-size:17px; font-weight:700; color:var(--text-main); margin-bottom:14px;"><i class="fas fa-timeline" style="color:var(--accent-gold);"></i> Itinerary Timeline</h3>
            ${daysHtml}
        </div>

        ${budgetBreakdownHtml}
        ${tipsHtml}

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:28px; padding-top:20px; border-top:1px solid var(--border);">
            <button type="button" class="btn btn-outline btn-sm" onclick="closeTripModal()">
                Close
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.print()">
                <i class="fas fa-print"></i> Print / Export PDF
            </button>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeTripModal() {
    const modal = document.getElementById('tripDetailModal');
    if (modal) modal.style.display = 'none';
}

/**
 * Delete a trip from server and update state
 */
async function deleteTrip(tripId) {
    if (!confirm('Are you sure you want to delete this trip itinerary? This action cannot be undone.')) {
        return;
    }

    try {
        await Api.delete(`/trips/${tripId}`);
        allTrips = allTrips.filter(t => String(t.id) !== String(tripId));
        updateDashboardMetrics();
        renderTripsList();
        renderOverviewRecentTrips();
    } catch (e) {
        console.error('Delete trip error:', e);
        alert('Failed to delete trip. Please try again.');
    }
}

/**
 * Remove favorite from server and update state
 */
async function removeFavorite(favId) {
    if (!confirm('Remove this place from your saved wishlist?')) {
        return;
    }

    try {
        await Api.delete(`/favorites/${favId}`);
        allFavorites = allFavorites.filter(f => String(f.id) !== String(favId));
        updateDashboardMetrics();
        renderFavoritesList();
    } catch (e) {
        console.error('Remove favorite error:', e);
        alert('Failed to remove favorite. Please try again.');
    }
}

/**
 * Save user profile updates to server
 */
async function saveUserProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    const alertBox = document.getElementById('profileAlert');
    if (alertBox) alertBox.style.display = 'none';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    }

    try {
        const payload = {
            fullName: document.getElementById('profFullName')?.value.trim() || '',
            phone: document.getElementById('profPhone')?.value.trim() || '',
            address: document.getElementById('profAddress')?.value.trim() || '',
            bio: document.getElementById('profBio')?.value.trim() || ''
        };

        const res = await Api.put('/users/profile', payload);
        const updated = res.data || res;
        Auth.setUser(updated);
        Auth.updateNavbar();
        populateProfileFields(updated);

        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16,185,129,0.15)';
            alertBox.style.color = '#34D399';
            alertBox.innerHTML = '<i class="fas fa-check-circle"></i> Profile updated successfully!';
            setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
        }
    } catch (err) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(244,63,94,0.15)';
            alertBox.style.color = '#F43F5E';
            alertBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> Failed to update profile: ' + (err.message || 'Server error');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-check"></i> Save Profile Changes';
        }
    }
}

/**
 * Change password
 */
async function changeUserPassword(e) {
    if (e && e.preventDefault) e.preventDefault();
    const btn = document.getElementById('btnChangePassword');
    const alertBox = document.getElementById('passwordAlert');
    if (alertBox) alertBox.style.display = 'none';

    const curr = document.getElementById('currPassword').value;
    const next = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmNewPassword').value;

    if (next !== confirm) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(244,63,94,0.15)';
            alertBox.style.color = '#F43F5E';
            alertBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> New passwords do not match.';
        }
        return;
    }

    if (next.length < 6) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(244,63,94,0.15)';
            alertBox.style.color = '#F43F5E';
            alertBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> Password must be at least 6 characters.';
        }
        return;
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Updating…';
    }

    try {
        await Api.post('/users/change-password', {
            currentPassword: curr,
            newPassword: next
        });

        document.getElementById('passwordForm').reset();

        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(16,185,129,0.15)';
            alertBox.style.color = '#34D399';
            alertBox.innerHTML = '<i class="fas fa-check-circle"></i> Password changed successfully!';
            setTimeout(() => { alertBox.style.display = 'none'; }, 4000);
        }
    } catch (err) {
        if (alertBox) {
            alertBox.style.display = 'block';
            alertBox.style.background = 'rgba(244,63,94,0.15)';
            alertBox.style.color = '#F43F5E';
            alertBox.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + (err.message || 'Incorrect current password.');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-key"></i> Update Password';
        }
    }
}

// Helpers
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
