// @ts-nocheck
/**
 * TouristAI — Itinerary Planner Controller (Screen 4 & 5)
 * Luxury Travel Editorial Architecture & Leaflet Route Visualizer
 */

let selectedInterests = ['Sightseeing', 'Adventure', 'Nature'];
let currentGeneratedItinerary = null;
let plannerMap = null;
let routeMarkers = [];

document.addEventListener('DOMContentLoaded', () => {
    // Set default dates: 5 days starting 3 days from now
    const startInput = document.getElementById('tripStartDate');
    const endInput = document.getElementById('tripEndDate');

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() + 3);
    const endDate = new Date();
    endDate.setDate(today.getDate() + 7);

    if (startInput) startInput.value = startDate.toISOString().split('T')[0];
    if (endInput) endInput.value = endDate.toISOString().split('T')[0];

    // Check query params
    const params = new URLSearchParams(window.location.search);
    const dest = params.get('destination') || params.get('dest');
    const travelers = params.get('travelers');
    const budget = params.get('budget');

    if (dest) {
        document.getElementById('tripDestination').value = dest;
    }
    if (travelers) {
        document.getElementById('tripTravelers').value = travelers;
    }
    if (budget) {
        const budgetSel = document.getElementById('tripBudget');
        if (budget === 'budget') budgetSel.value = 'Budget';
        else if (budget === 'luxury') budgetSel.value = 'Luxury';
        else budgetSel.value = 'Moderate';
    }
});

function toggleInterest(el, interestName) {
    if (el.classList.contains('selected')) {
        el.classList.remove('selected');
        selectedInterests = selectedInterests.filter(i => i !== interestName);
    } else {
        el.classList.add('selected');
        if (!selectedInterests.includes(interestName)) {
            selectedInterests.push(interestName);
        }
    }
}

async function generateItinerary(e) {
    if (e && e.preventDefault) e.preventDefault();

    const destination = document.getElementById('tripDestination').value.trim();
    const startDate = document.getElementById('tripStartDate').value;
    const endDate = document.getElementById('tripEndDate').value;
    const travelers = parseInt(document.getElementById('tripTravelers').value) || 2;
    const budgetTier = document.getElementById('tripBudget').value || 'Moderate';
    const originCity = document.getElementById('tripOriginCity') ? document.getElementById('tripOriginCity').value.trim() : '';

    if (!destination) {
        alert('Please enter a destination.');
        return;
    }

    const btn = document.getElementById('btnGenerateTrip');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Synthesizing Itinerary with Gemini…';

    // Update stepper: Step 3 active
    setStepActive(3);

    const payload = {
        destination,
        startDate,
        endDate,
        travelers,
        budgetTier,
        currency: 'INR',
        interests: selectedInterests.length > 0 ? selectedInterests : ['Sightseeing', 'Nature']
    };

    try {
        const res = await Api.post('/trips/generate', payload);
        const data = res.data || res;

        currentGeneratedItinerary = data;
        renderItineraryOutput(data);
        setStepActive(4);

        // Scroll down to results
        const outSection = document.getElementById('itineraryOutputSection');
        outSection.style.display = 'block';
        outSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        // Initialize or update Leaflet route map
        setTimeout(() => {
            initPlannerRouteMap(data);
        }, 150);
    } catch (err) {
        console.error('Failed to generate itinerary:', err);
        alert('Could not connect to AI trip planner. Please check your network or try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

function renderItineraryOutput(itinerary) {
    document.getElementById('outItineraryTitle').textContent = itinerary.title || `Your Trip to ${itinerary.destination}`;
    document.getElementById('outItinerarySubtitle').textContent = 
        `Customised for ${itinerary.travelers || 2} travelers • ${itinerary.budgetTier || 'Moderate'} Budget (${itinerary.estimatedBudget || 'Estimated'})`;

    const timeline = document.getElementById('timelineContainer');
    timeline.innerHTML = '';

    const days = itinerary.daysPlan || [];
    days.forEach((day, idx) => {
        const node = document.createElement('div');
        node.className = 'timeline-day-node';

        const dayImg = day.imageUrl || itinerary.imageUrl || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800';
        const activitiesHtml = (day.activities || []).map(act => `<li>${escapeHtml(act)}</li>`).join('');

        node.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="day-card">
                <img class="day-thumbnail" src="${dayImg}" alt="${escapeHtml(day.title)}" loading="lazy">
                <div class="day-content">
                    <div class="day-header">
                        <span class="day-badge">Day ${day.dayNumber || (idx + 1)} • ${escapeHtml(day.date || ('Day ' + (idx + 1)))}</span>
                        <span style="font-size:12.5px; color:var(--text-dim);"><i class="fas fa-location-pin"></i> ${escapeHtml(day.location || itinerary.destination)}</span>
                    </div>
                    <h3>${escapeHtml(day.title)}</h3>
                    <ul class="day-activities-list">
                        ${activitiesHtml}
                    </ul>
                </div>
            </div>
        `;
        timeline.appendChild(node);
    });

    // Budget Grid
    const budgetGrid = document.getElementById('outBudgetGrid');
    if (itinerary.budgetBreakdown) {
        const b = itinerary.budgetBreakdown;
        budgetGrid.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-hotel" style="color:var(--accent-gold);"></i> Lodging &amp; Stays</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${b.lodging || '₹10,500'}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-train" style="color:var(--accent-cyan);"></i> Transit &amp; Cabs</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${b.transit || '₹6,000'}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-utensils" style="color:#F59E0B;"></i> Food &amp; Dining</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${b.food || '₹7,500'}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-ticket-alt" style="color:var(--accent-emerald);"></i> Sightseeing &amp; Entry</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${b.activities || '₹4,000'}</h4>
            </div>
        `;
    }

    // Travel Tips
    const tipsList = document.getElementById('outTipsList');
    if (itinerary.travelTips && tipsList) {
        tipsList.innerHTML = itinerary.travelTips.map(t => `
            <li><i class="fas fa-check-circle" style="color:var(--accent-emerald);"></i> ${escapeHtml(t)}</li>
        `).join('');
    }
}

function initPlannerRouteMap(itinerary) {
    const mapEl = document.getElementById('itineraryRouteMap');
    if (!mapEl) return;

    // Approximate Coordinates table for popular destinations
    const coordsMap = {
        'ooty': [11.4102, 76.6950],
        'manali': [32.2432, 77.1892],
        'goa': [15.2993, 74.1240],
        'kerala': [9.9312, 76.2673],
        'paris': [48.8566, 2.3522],
        'tokyo': [35.6762, 139.6503],
        'jaipur': [26.9124, 75.7873],
        'shimla': [31.1048, 77.1734]
    };

    const destKey = (itinerary.destination || '').toLowerCase().split(',')[0].trim();
    const center = coordsMap[destKey] || [11.4102, 76.6950];

    if (!plannerMap) {
        plannerMap = L.map('itineraryRouteMap').setView(center, 12);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(plannerMap);
    } else {
        plannerMap.invalidateSize();
        plannerMap.setView(center, 12);
    }

    // Clear old markers
    routeMarkers.forEach(m => plannerMap.removeLayer(m));
    routeMarkers = [];

    const latlngs = [];
    const days = itinerary.daysPlan || [];

    days.forEach((day, idx) => {
        const offsetLat = center[0] + (Math.sin(idx * 1.5) * 0.02);
        const offsetLng = center[1] + (Math.cos(idx * 1.5) * 0.02);
        latlngs.push([offsetLat, offsetLng]);

        const marker = L.marker([offsetLat, offsetLng])
            .addTo(plannerMap)
            .bindPopup(`<strong>Day ${idx + 1}: ${escapeHtml(day.title)}</strong><br>${escapeHtml(day.location || itinerary.destination)}`);
        routeMarkers.push(marker);
    });

    if (latlngs.length > 1) {
        const polyline = L.polyline(latlngs, { color: '#C5A46D', weight: 4, dashArray: '6, 8' }).addTo(plannerMap);
        routeMarkers.push(polyline);
        plannerMap.fitBounds(polyline.getBounds(), { padding: [30, 30] });
    }
}

async function saveTripToProfile() {
    if (!Auth.isAuthenticated()) {
        alert('Please login to save this trip to your account!');
        window.location.href = 'login.html?redirect=planner.html';
        return;
    }

    if (!currentGeneratedItinerary) return;

    const btn = document.getElementById('btnSaveTrip');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';

    try {
        const payload = {
            title: currentGeneratedItinerary.title,
            destination: currentGeneratedItinerary.destination,
            days: currentGeneratedItinerary.days || 3,
            people: currentGeneratedItinerary.travelers || 2,
            hotelTier: currentGeneratedItinerary.budgetTier || 'Moderate',
            currency: currentGeneratedItinerary.currency || 'INR',
            startDate: document.getElementById('tripStartDate').value,
            endDate: document.getElementById('tripEndDate').value,
            interests: selectedInterests,
            status: 'upcoming',
            imageUrl: currentGeneratedItinerary.imageUrl,
            daysPlan: currentGeneratedItinerary.daysPlan,
            budgetBreakdown: currentGeneratedItinerary.budgetBreakdown,
            travelTips: currentGeneratedItinerary.travelTips
        };

        await Api.post('/trips', payload);
        btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
        btn.style.background = 'var(--accent-emerald)';

        setTimeout(() => {
            if (confirm('Trip saved successfully! Would you like to view your Saved Trips in the Dashboard?')) {
                window.location.href = 'dashboard.html';
            }
        }, 300);
    } catch (e) {
        console.error('Save trip failed:', e);
        alert('Could not save trip. Please try again.');
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-bookmark"></i> Save Trip';
    }
}

function copyItineraryText() {
    if (!currentGeneratedItinerary) return;
    let text = `${currentGeneratedItinerary.title}\n`;
    text += `Destination: ${currentGeneratedItinerary.destination}\n`;
    text += `Duration: ${currentGeneratedItinerary.days} Days • Travelers: ${currentGeneratedItinerary.travelers}\n`;
    text += `Estimated Budget: ${currentGeneratedItinerary.estimatedBudget}\n\n`;

    (currentGeneratedItinerary.daysPlan || []).forEach(day => {
        text += `Day ${day.dayNumber}: ${day.title}\n`;
        (day.activities || []).forEach(act => {
            text += `  • ${act}\n`;
        });
        text += '\n';
    });

    navigator.clipboard.writeText(text).then(() => {
        alert('Itinerary copied to clipboard!');
    }).catch(() => {
        alert('Could not copy automatically. You can export as PDF or save to profile.');
    });
}

function exportItineraryPdf() {
    window.print();
}

function setStepActive(stepNum) {
    for (let i = 1; i <= 4; i++) {
        const item = document.getElementById('stepIndicator' + i);
        if (!item) continue;
        if (i < stepNum) {
            item.className = 'stepper-item completed';
        } else if (i === stepNum) {
            item.className = 'stepper-item active';
        } else {
            item.className = 'stepper-item';
        }
    }
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
