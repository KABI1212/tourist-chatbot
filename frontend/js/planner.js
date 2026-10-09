// @ts-nocheck
/**
 * TouristAI — Itinerary Planner Controller (Screen 4 & 5)
 * Luxury Travel Editorial Architecture, Dynamic Trip Cost Engine & Leaflet Satellite Route Visualizer
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

    // Dynamic cost update on parameter changes
    const travelersInput = document.getElementById('tripTravelers');
    if (travelersInput) {
        travelersInput.addEventListener('change', () => {
            if (currentGeneratedItinerary) {
                currentGeneratedItinerary.travelers = parseInt(travelersInput.value) || 2;
                recalculateAndRenderTripCost();
            }
        });
    }

    const budgetInput = document.getElementById('tripBudget');
    if (budgetInput) {
        budgetInput.addEventListener('change', () => {
            if (currentGeneratedItinerary) {
                currentGeneratedItinerary.budgetTier = budgetInput.value || 'Moderate';
                recalculateAndRenderTripCost();
            }
        });
    }

    // Invalidate map size on theme switch
    window.addEventListener('themeChanged', () => {
        if (plannerMap) plannerMap.invalidateSize();
    });
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
        recalculateAndRenderTripCost();
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
        `Customised for ${itinerary.travelers || 2} travelers • ${itinerary.budgetTier || 'Moderate'} Budget • Real-time Cost Estimation`;

    renderTimelineNodesOnly();

    // Travel Tips
    const tipsList = document.getElementById('outTipsList');
    if (itinerary.travelTips && tipsList) {
        tipsList.innerHTML = itinerary.travelTips.map(t => `
            <li><i class="fas fa-check-circle" style="color:var(--accent-emerald);"></i> ${escapeHtml(t)}</li>
        `).join('');
    }
}

function renderTimelineNodesOnly() {
    if (!currentGeneratedItinerary) return;
    const timeline = document.getElementById('timelineContainer');
    if (!timeline) return;

    timeline.innerHTML = '';
    const days = currentGeneratedItinerary.daysPlan || [];

    days.forEach((day, idx) => {
        const node = document.createElement('div');
        node.className = 'timeline-day-node';

        const dayImg = day.imageUrl || currentGeneratedItinerary.imageUrl || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800';
        const activitiesHtml = (day.activities || []).map(act => `<li>${escapeHtml(act)}</li>`).join('');

        node.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="day-card">
                <img class="day-thumbnail" src="${dayImg}" alt="${escapeHtml(day.title)}" onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800'" loading="lazy">
                <div class="day-content">
                    <div class="day-header">
                        <span class="day-badge">Day ${day.dayNumber || (idx + 1)} • ${escapeHtml(day.date || ('Day ' + (idx + 1)))}</span>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span style="font-size:12.5px; color:var(--text-dim);"><i class="fas fa-location-pin"></i> ${escapeHtml(day.location || currentGeneratedItinerary.destination)}</span>
                            <button type="button" class="btn-remove-day" onclick="removeItineraryDay(${idx})" title="Remove this day stop">
                                <i class="fas fa-trash-can"></i> Remove Stop
                            </button>
                        </div>
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
}

// Requirement 6: Dynamic Trip Cost Engine with 10% Emergency Contingency
function recalculateAndRenderTripCost() {
    if (!currentGeneratedItinerary) return;

    const daysCount = (currentGeneratedItinerary.daysPlan && currentGeneratedItinerary.daysPlan.length) || parseInt(currentGeneratedItinerary.days) || 3;
    const travelersCount = parseInt(document.getElementById('tripTravelers')?.value) || parseInt(currentGeneratedItinerary.travelers) || 2;
    const budgetTier = document.getElementById('tripBudget')?.value || currentGeneratedItinerary.budgetTier || 'Moderate';
    const isInternational = (currentGeneratedItinerary.destination || '').toLowerCase().includes('paris') || (currentGeneratedItinerary.destination || '').toLowerCase().includes('international');

    let baseDailyStay = 2200;
    let baseDailyFood = 800;
    let baseTransit = 1800;
    let baseActivities = 400;
    let baseDailyLocalTransit = 400;

    if (budgetTier === 'Budget') {
        baseDailyStay = 1200;
        baseDailyFood = 500;
        baseTransit = 900;
        baseActivities = 250;
        baseDailyLocalTransit = 250;
    } else if (budgetTier === 'Luxury') {
        baseDailyStay = 6500;
        baseDailyFood = 2200;
        baseTransit = 5000;
        baseActivities = 1000;
        baseDailyLocalTransit = 1200;
    }

    if (isInternational) {
        baseDailyStay *= 3.5;
        baseDailyFood *= 3.5;
        baseTransit = 28000;
    }

    const roomsNeeded = Math.ceil(travelersCount / 2);
    const lodgingTotal = Math.round(baseDailyStay * Math.max(1, daysCount - 1) * roomsNeeded);
    const transitTotal = Math.round(baseTransit * travelersCount);
    const localTransitTotal = Math.round(baseDailyLocalTransit * daysCount * Math.ceil(travelersCount / 3));
    const foodTotal = Math.round(baseDailyFood * daysCount * travelersCount);
    const activitiesTotal = Math.round(baseActivities * daysCount * travelersCount);

    const subTotal = lodgingTotal + transitTotal + localTransitTotal + foodTotal + activitiesTotal;
    const contingency = Math.round(subTotal * 0.10);
    const grandTotal = subTotal + contingency;
    const perPerson = Math.round(grandTotal / travelersCount);

    // Update banner summary elements
    const totalEl = document.getElementById('costHeroTotal');
    if (totalEl) totalEl.textContent = '₹' + grandTotal.toLocaleString('en-IN');
    const perPersonEl = document.getElementById('costPerPerson');
    if (perPersonEl) perPersonEl.textContent = '₹' + perPerson.toLocaleString('en-IN');
    const travelersEl = document.getElementById('costTravelersCount');
    if (travelersEl) travelersEl.textContent = travelersCount;
    const daysEl = document.getElementById('costDaysCount');
    if (daysEl) daysEl.textContent = daysCount;

    // Update pill values
    const setPill = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '₹' + val.toLocaleString('en-IN');
    };
    setPill('pillTransit', transitTotal);
    setPill('pillLocalTransit', localTransitTotal);
    setPill('pillLodging', lodgingTotal);
    setPill('pillFood', foodTotal);
    setPill('pillActivities', activitiesTotal);
    setPill('pillContingency', contingency);

    // Update bottom budget breakdown cards
    const budgetGrid = document.getElementById('outBudgetGrid');
    if (budgetGrid) {
        budgetGrid.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-hotel" style="color:var(--accent-gold);"></i> Lodging &amp; Stays</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">₹${lodgingTotal.toLocaleString('en-IN')}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-plane-departure" style="color:var(--accent-cyan);"></i> Intercity Transit</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">₹${transitTotal.toLocaleString('en-IN')}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-taxi" style="color:var(--accent-gold);"></i> Local Transit</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">₹${localTransitTotal.toLocaleString('en-IN')}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-utensils" style="color:#F59E0B;"></i> Food &amp; Dining</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">₹${foodTotal.toLocaleString('en-IN')}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-ticket-alt" style="color:var(--accent-emerald);"></i> Sightseeing &amp; Activities</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">₹${activitiesTotal.toLocaleString('en-IN')}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-shield-halved" style="color:var(--accent-rose);"></i> Emergency Contingency (10%)</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">₹${contingency.toLocaleString('en-IN')}</h4>
            </div>
        `;
    }

    currentGeneratedItinerary.estimatedBudget = '₹' + grandTotal.toLocaleString('en-IN');
}

// Requirement 8: Interactive Map & Itinerary Synchronization
function removeItineraryDay(dayIdx) {
    if (!currentGeneratedItinerary || !currentGeneratedItinerary.daysPlan) return;
    if (currentGeneratedItinerary.daysPlan.length <= 1) {
        alert('Your itinerary must contain at least 1 day stop.');
        return;
    }

    // Remove day
    currentGeneratedItinerary.daysPlan.splice(dayIdx, 1);

    // Renumber remaining days
    currentGeneratedItinerary.daysPlan.forEach((d, i) => {
        d.dayNumber = i + 1;
    });
    currentGeneratedItinerary.days = currentGeneratedItinerary.daysPlan.length;

    // Smoothly re-render timeline nodes without full page reload
    renderTimelineNodesOnly();

    // Recalculate trip cost dynamically
    recalculateAndRenderTripCost();

    // Redraw map route markers and polyline
    updatePlannerRouteMap(currentGeneratedItinerary);
}

// Requirement 7: Leaflet Standard Map & Satellite View Layer Switcher
function initPlannerRouteMap(itinerary) {
    const mapEl = document.getElementById('itineraryRouteMap');
    if (!mapEl) return;

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
        // Standard OSM Layer
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        });

        // Esri Satellite Imagery Layer (Free, no API key required)
        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        });

        plannerMap = L.map('itineraryRouteMap', {
            center: center,
            zoom: 12,
            layers: [osmLayer]
        });

        const baseLayers = {
            "Standard Map": osmLayer,
            "Satellite View": satelliteLayer
        };

        L.control.layers(baseLayers, null, { position: 'topright' }).addTo(plannerMap);
    } else {
        plannerMap.invalidateSize();
        plannerMap.setView(center, 12);
    }

    updatePlannerRouteMap(itinerary);
}

function updatePlannerRouteMap(itinerary) {
    if (!plannerMap) return;

    // Clear old markers and polylines
    routeMarkers.forEach(m => plannerMap.removeLayer(m));
    routeMarkers = [];

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
    } else if (latlngs.length === 1) {
        plannerMap.setView(latlngs[0], 13);
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

// Global exposure
window.removeItineraryDay = removeItineraryDay;
window.toggleInterest = toggleInterest;
window.generateItinerary = generateItinerary;
window.copyItineraryText = copyItineraryText;
window.exportItineraryPdf = exportItineraryPdf;
window.saveTripToProfile = saveTripToProfile;
