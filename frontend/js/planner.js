/**
 * TouristAI — Itinerary Planner Controller (Screen 4 & 5)
 */

let selectedInterests = ['Sightseeing', 'Adventure', 'Nature'];
let currentGeneratedItinerary = null;

document.addEventListener('DOMContentLoaded', () => {
    // Set default dates: 10 Dec to 15 Dec or 3 days from now
    const startInput = document.getElementById('tripStartDate');
    const endInput = document.getElementById('tripEndDate');

    const today = new Date();
    const startDate = new Date();
    startDate.setDate(today.getDate() + 5);
    const endDate = new Date();
    endDate.setDate(today.getDate() + 10);

    if (startInput) startInput.value = startDate.toISOString().split('T')[0];
    if (endInput) endInput.value = endDate.toISOString().split('T')[0];

    // Check query params
    const params = new URLSearchParams(window.location.search);
    const dest = params.get('destination') || params.get('dest');
    const days = params.get('days');
    const travelers = params.get('travelers');

    if (dest) {
        document.getElementById('tripDestination').value = dest;
    }
    if (travelers) {
        document.getElementById('tripTravelers').value = travelers;
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

    if (!destination) {
        alert('Please enter a destination.');
        return;
    }

    const btn = document.getElementById('btnGenerateTrip');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating Itinerary…';

    // Update stepper: Step 2 & 3 active
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

        // Scroll down to results
        const outSection = document.getElementById('itineraryOutputSection');
        outSection.style.display = 'block';
        outSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
        `Customised for ${itinerary.travelers || 2} people • ${itinerary.budgetTier || 'Moderate'} Budget (${itinerary.estimatedBudget || 'Estimated'})`;

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
                        <span class="day-badge">Day ${day.dayNumber || (idx + 1)} • ${day.date || ('Day ' + (idx + 1))}</span>
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
            <div style="background:rgba(255,255,255,0.04); padding:16px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim);">Lodging &amp; Stay</span>
                <h4 style="font-size:18px; color:#fff; margin-top:4px;">${b.lodging || '₹10,500'}</h4>
            </div>
            <div style="background:rgba(255,255,255,0.04); padding:16px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim);">Transit &amp; Cabs</span>
                <h4 style="font-size:18px; color:#fff; margin-top:4px;">${b.transit || '₹6,000'}</h4>
            </div>
            <div style="background:rgba(255,255,255,0.04); padding:16px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim);">Food &amp; Dining</span>
                <h4 style="font-size:18px; color:#fff; margin-top:4px;">${b.food || '₹7,500'}</h4>
            </div>
            <div style="background:rgba(255,255,255,0.04); padding:16px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim);">Activities &amp; Sightseeing</span>
                <h4 style="font-size:18px; color:#fff; margin-top:4px;">${b.activities || '₹4,000'}</h4>
            </div>
        `;
    }

    // Travel Tips
    const tipsList = document.getElementById('outTipsList');
    if (itinerary.travelTips) {
        tipsList.innerHTML = itinerary.travelTips.map(t => `
            <li><i class="fas fa-check-circle" style="color:var(--accent-emerald);"></i> ${escapeHtml(t)}</li>
        `).join('');
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
            days: currentGeneratedItinerary.days || 5,
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
