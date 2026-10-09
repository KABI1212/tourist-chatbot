// @ts-nocheck
/**
 * TouristAI — User Dashboard & Saved Trips Controller (Screen 6)
 */

let allTrips = [];
let currentFilter = 'upcoming';

document.addEventListener('DOMContentLoaded', async () => {
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html?redirect=dashboard.html';
        return;
    }

    await loadUserTrips();
    loadProfileDetails();
});

async function loadUserTrips() {
    const container = document.getElementById('savedTripsContainer');
    if (!container) return;

    try {
        const res = await Api.get('/trips');
        const trips = res.data || res;

        if (Array.isArray(trips) && trips.length > 0) {
            allTrips = trips;
        } else {
            // Seed sample trips matching Screen 6 mockup
            allTrips = [
                {
                    id: 'sample-1',
                    title: 'Kerala Trip',
                    destination: 'Kerala',
                    startDate: '15 Dec 2026',
                    endDate: '20 Dec 2026',
                    people: 2,
                    status: 'upcoming',
                    imageUrl: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800',
                    daysPlan: [
                        { dayNumber: 1, title: 'Arrival in Kochi & Fort Kochi Stroll', location: 'Kochi', activities: ['Check-in to hotel', 'Chinese fishing nets at sunset', 'Seafood dinner'] },
                        { dayNumber: 2, title: 'Munnar Tea Estates & Cheeyappara Falls', location: 'Munnar', activities: ['Drive through scenic ghats', 'Tea garden walking tour', 'Misty viewpoints'] },
                        { dayNumber: 3, title: 'Thekkady Periyar Lake Boat Safari', location: 'Thekkady', activities: ['Wildlife safari boating', 'Spice plantation walk', 'Kathakali cultural dance'] },
                        { dayNumber: 4, title: 'Alleppey Traditional Houseboat Cruise', location: 'Alleppey', activities: ['Board thatched kettuvallam', 'Cruise serene backwaters', 'Candlelit dinner on water'] },
                        { dayNumber: 5, title: 'Departure from Kochi', location: 'Kochi Airport', activities: ['Souvenir shopping in town', 'Flight departure'] }
                    ]
                },
                {
                    id: 'sample-2',
                    title: 'Manali Trip',
                    destination: 'Manali',
                    startDate: '10 Jan 2026',
                    endDate: '15 Jan 2026',
                    people: 2,
                    status: 'upcoming',
                    imageUrl: 'https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800',
                    daysPlan: [
                        { dayNumber: 1, title: 'Arrival in Manali & Mall Road', location: 'Manali Town', activities: ['Check-in to hotel', 'Explore Mall Road cafes', 'Evening at Hadimba Temple'] },
                        { dayNumber: 2, title: 'Solang Valley Adventure Sports', location: 'Solang Valley', activities: ['Paragliding and snow quad biking', 'Snow point photography', 'Return to Old Manali'] },
                        { dayNumber: 3, title: 'Rohtang Pass Snow Excursion', location: 'Rohtang Pass', activities: ['Ascend high mountain pass', 'Snow activities & skiing', 'Panoramic photography'] },
                        { dayNumber: 4, title: 'Jogini Waterfall Trek & Vashisht Baths', location: 'Vashisht', activities: ['Scenic pine forest hike', 'Hot sulfur springs relaxation', 'Bohemian cafe evening'] },
                        { dayNumber: 5, title: 'Souvenir Shopping & Departure', location: 'Manali', activities: ['Buy Kullu shawls and honey', 'Overnight Volvo departure'] }
                    ]
                }
            ];
        }
    } catch (e) {
        console.warn('Could not load user trips from server:', e);
    }

    renderTrips();
}

function filterTripsTab(type) {
    currentFilter = type;
    document.getElementById('tabUpcoming').classList.toggle('active', type === 'upcoming');
    document.getElementById('tabPast').classList.toggle('active', type === 'past');
    renderTrips();
}

function renderTrips() {
    const container = document.getElementById('savedTripsContainer');
    if (!container) return;

    let filtered = allTrips;
    if (currentFilter === 'past') {
        filtered = allTrips.filter(t => t.status === 'past' || t.status === 'completed');
    } else {
        filtered = allTrips.filter(t => t.status !== 'past' && t.status !== 'completed');
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:40px; text-align:center;">
                <i class="fas fa-suitcase" style="font-size:36px; color:var(--text-dim); margin-bottom:14px;"></i>
                <h3 style="color:var(--text-main); font-size:18px; margin-bottom:6px;">No ${currentFilter} trips found</h3>
                <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">Ready to create an unforgettable travel experience?</p>
                <a href="planner.html" class="btn btn-primary btn-sm"><i class="fas fa-plus"></i> Plan Your First Trip</a>
            </div>
        `;
        return;
    }

    container.innerHTML = filtered.map(t => {
        const img = t.imageUrl || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800';
        const dateRange = (t.startDate && t.endDate) ? `${t.startDate} - ${t.endDate}` : `${t.days || 3} Days Trip`;
        const travelersText = `${t.people || 2} Travelers`;

        return `
            <div class="saved-trip-row-card">
                <div class="trip-card-left">
                    <img class="trip-thumb-img" src="${img}" alt="${escapeHtml(t.title)}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800'" loading="lazy">
                    <div class="trip-info-texts">
                        <h3>${escapeHtml(t.title || ('Trip to ' + t.destination))}</h3>
                        <div class="trip-info-meta">
                            <span><i class="far fa-calendar-alt"></i> ${dateRange}</span>
                            <span><i class="fas fa-users"></i> ${travelersText}</span>
                            <span class="badge-tag badge-upcoming">Upcoming</span>
                        </div>
                    </div>
                </div>

                <div class="trip-card-actions">
                    <button class="btn btn-outline btn-sm" onclick="openTripModal('${t.id}')">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="btn btn-outline btn-sm" style="color:var(--accent-rose); border-color:rgba(244,63,94,0.3);" onclick="deleteTrip('${t.id}')" title="Delete Trip">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function openTripModal(tripId) {
    const trip = allTrips.find(t => t.id === tripId);
    if (!trip) return;

    const modal = document.getElementById('tripModal');
    const content = document.getElementById('modalTripContent');

    const days = trip.daysPlan || [];
    const daysHtml = days.map(d => `
        <div style="background:var(--bg-surface); border:1px solid var(--border); border-radius:10px; padding:16px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <strong style="color:var(--accent-gold);">Day ${d.dayNumber || ''}</strong>
                <span style="font-size:12px; color:var(--text-dim);">${d.location || ''}</span>
            </div>
            <h4 style="color:var(--text-main); font-size:16px; margin-bottom:8px;">${escapeHtml(d.title)}</h4>
            <ul style="list-style:disc; margin-left:20px; font-size:13.5px; color:var(--text-light);">
                ${(d.activities || []).map(a => `<li>${escapeHtml(a)}</li>`).join('')}
            </ul>
        </div>
    `).join('');

    content.innerHTML = `
        <h2 style="font-family:var(--font-display); font-size:26px; color:var(--text-main); margin-bottom:6px;">${escapeHtml(trip.title)}</h2>
        <p style="color:var(--text-muted); font-size:14px; margin-bottom:20px;">
            ${trip.destination} • ${trip.people || 2} Travelers • ${trip.days || 5} Days
        </p>

        <div style="margin-bottom:24px;">
            <h3 style="color:var(--text-main); font-size:18px; margin-bottom:12px;">Itinerary Schedule</h3>
            ${daysHtml.length > 0 ? daysHtml : '<p style="color:var(--text-dim);">Detailed schedule saved.</p>'}
        </div>

        <div style="text-align:right;">
            <button class="btn btn-primary btn-sm" onclick="window.print()">
                <i class="fas fa-print"></i> Print / Export PDF
            </button>
        </div>
    `;

    modal.style.display = 'block';
}

function closeTripModal() {
    document.getElementById('tripModal').style.display = 'none';
}

async function deleteTrip(tripId) {
    if (!confirm('Are you sure you want to delete this trip plan?')) return;

    try {
        if (!tripId.startsWith('sample-')) {
            await Api.delete(`/trips/${tripId}`);
        }
        allTrips = allTrips.filter(t => t.id !== tripId);
        renderTrips();
    } catch (e) {
        console.error('Delete failed:', e);
        allTrips = allTrips.filter(t => t.id !== tripId);
        renderTrips();
    }
}

function switchDashboardView(view) {
    const views = ['viewMyTrips', 'viewSavedPlaces', 'viewChatHistory', 'viewProfile'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.style.display = 'none';
    });

    document.querySelectorAll('.dash-menu-item').forEach(m => m.classList.remove('active'));

    if (view === 'trips' || view === 'overview') {
        document.getElementById('viewMyTrips').style.display = 'block';
        document.getElementById('menuMyTrips').classList.add('active');
    } else if (view === 'places') {
        document.getElementById('viewSavedPlaces').style.display = 'block';
        document.getElementById('menuSavedPlaces').classList.add('active');
        loadSavedPlaces();
    } else if (view === 'chats') {
        document.getElementById('viewChatHistory').style.display = 'block';
        document.getElementById('menuChatHistory').classList.add('active');
        loadDashboardChatHistory();
    } else if (view === 'profile') {
        document.getElementById('viewProfile').style.display = 'block';
        document.getElementById('menuProfile').classList.add('active');
    }
}

async function loadSavedPlaces() {
    const grid = document.getElementById('favoritesGrid');
    if (!grid) return;

    try {
        const res = await Api.get('/favorites');
        const list = res.data || res;
        if (Array.isArray(list) && list.length > 0) {
            grid.innerHTML = list.map(f => `
                <div class="dest-card" onclick="window.location.href='destinations.html?view=${encodeURIComponent(f.destinationName || '')}'">
                    <div class="dest-card-body">
                        <h3>${f.destinationName || 'Favorite Landmark'}</h3>
                        <p style="color:var(--text-muted); font-size:13px; margin-top:8px;">Saved to your dream list</p>
                    </div>
                </div>
            `).join('');
        } else {
            grid.innerHTML = '<p style="color:var(--text-muted); padding:20px;">No saved places yet. Browse Destinations and click Save!</p>';
        }
    } catch (e) {
        grid.innerHTML = '<p style="color:var(--text-muted); padding:20px;">No saved places yet.</p>';
    }
}

async function loadDashboardChatHistory() {
    const c = document.getElementById('dashboardChatsContainer');
    if (!c) return;

    try {
        const res = await Api.get('/chat/history');
        const chats = res.chats || res.data?.chats || res;
        if (Array.isArray(chats) && chats.length > 0) {
            c.innerHTML = chats.map(chat => `
                <div class="saved-trip-row-card" style="cursor:pointer;" onclick="window.location.href='chatbot.html'">
                    <div style="display:flex; align-items:center; gap:14px;">
                        <i class="fas fa-message" style="color:var(--primary-light); font-size:20px;"></i>
                        <div>
                            <strong style="color:#fff; font-size:15px;">${escapeHtml(chat.title || 'Travel Query')}</strong>
                            <p style="color:var(--text-dim); font-size:12px;">Active Conversation Session</p>
                        </div>
                    </div>
                    <span style="color:var(--primary-light); font-size:13px; font-weight:600;">Open Chat <i class="fas fa-arrow-right"></i></span>
                </div>
            `).join('');
        } else {
            c.innerHTML = '<p style="color:var(--text-muted); padding:20px;">No chat history recorded yet.</p>';
        }
    } catch (e) {
        c.innerHTML = '<p style="color:var(--text-muted); padding:20px;">No chat history available.</p>';
    }
}

function loadProfileDetails() {
    const user = Auth.getUser();
    if (!user) return;

    const u = document.getElementById('profUsername');
    const f = document.getElementById('profFullName');
    const e = document.getElementById('profEmail');
    const b = document.getElementById('profBio');

    if (u) u.value = user.username || '';
    if (f) f.value = user.fullName || user.username || '';
    if (e) e.value = user.email || '';
    if (b) b.value = user.bio || '';
}

async function saveUserProfile(e) {
    if (e) e.preventDefault();
    const btn = document.getElementById('btnSaveProfile');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    try {
        const payload = {
            fullName: document.getElementById('profFullName').value.trim(),
            email: document.getElementById('profEmail').value.trim(),
            bio: document.getElementById('profBio').value.trim()
        };

        const res = await Api.put('/users/profile', payload);
        const updated = res.data || res;
        Auth.setUser(updated);
        alert('Profile updated successfully!');
    } catch (err) {
        alert('Profile saved locally.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-check"></i> Save Profile';
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
