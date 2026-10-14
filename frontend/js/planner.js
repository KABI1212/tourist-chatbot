// @ts-nocheck
/**
 * TouristAI — Itinerary Planner Controller (Screen 4 & 5)
 * Reactive Form State Management, Worldwide Autocomplete, Dynamic Trip Cost Engine & Leaflet Route Visualizer
 */

// 1. Centralized Form State Architecture
const plannerState = {
    destination: 'Ooty, Tamil Nadu',
    startDate: '',
    endDate: '',
    days: 5,
    travelers: 2,
    customTravelers: null,
    budgetTier: 'Moderate',
    customBudgetAmount: null,
    customCurrency: 'INR',
    budgetType: 'per_person', // 'per_person' or 'total'
    originCity: '',
    transitMode: 'Mixed',
    interests: ['Sightseeing', 'Adventure', 'Nature and lakes'],
    additionalNotes: '',
    currentStep: 1,
    isGenerated: false,
    isStale: false
};

let currentGeneratedItinerary = null;
let plannerMap = null;
let routeMarkers = [];

// Helper: Active Travelers Count
function getActiveTravelersCount() {
    if (plannerState.travelers === 'custom' && plannerState.customTravelers) {
        return Math.max(1, parseInt(plannerState.customTravelers) || 2);
    }
    return Math.max(1, parseInt(plannerState.travelers) || 2);
}

// Helper: Currency Symbol
function getCurrencySymbol(curr) {
    const c = (curr || plannerState.customCurrency || 'INR').toUpperCase();
    if (c === 'USD') return '$';
    if (c === 'EUR') return '€';
    if (c === 'GBP') return '£';
    if (c === 'AUD') return 'A$';
    if (c === 'CAD') return 'C$';
    if (c === 'AED') return 'AED ';
    if (c === 'SGD') return 'S$';
    return '₹';
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    initDefaultDates();
    bindFormStateListeners();
    bindAutocompleteListeners();
    parseUrlParameters();
    updateDateRangeAndDuration();
    updateCustomBudgetPreview();

    // Map resize on theme change
    window.addEventListener('themeChanged', () => {
        if (plannerMap) plannerMap.invalidateSize();
    });
});

/**
 * 2. Smart Defaults Initialization
 */
function initDefaultDates() {
    const startInput = document.getElementById('tripStartDate');
    const endInput = document.getElementById('tripEndDate');

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const startDate = new Date();
    startDate.setDate(today.getDate() + 3);
    const startDateStr = startDate.toISOString().split('T')[0];

    const endDate = new Date();
    endDate.setDate(today.getDate() + 7);
    const endDateStr = endDate.toISOString().split('T')[0];

    if (startInput) {
        startInput.min = todayStr;
        startInput.value = startDateStr;
        plannerState.startDate = startDateStr;
    }

    if (endInput) {
        endInput.min = startDateStr;
        endInput.value = endDateStr;
        plannerState.endDate = endDateStr;
    }
}

/**
 * 3. Bind Form Input Event Handlers
 */
function bindFormStateListeners() {
    // Destination Input
    const destInput = document.getElementById('tripDestination');
    const btnClearDest = document.getElementById('btnClearDestination');
    if (destInput) {
        destInput.addEventListener('input', () => {
            plannerState.destination = destInput.value.trim();
            if (btnClearDest) btnClearDest.style.display = destInput.value ? 'flex' : 'none';
            validateDestination();
            markParametersChanged();
        });
    }

    // Travel Dates
    const startInput = document.getElementById('tripStartDate');
    const endInput = document.getElementById('tripEndDate');

    if (startInput) {
        startInput.addEventListener('change', () => {
            plannerState.startDate = startInput.value;
            if (endInput) {
                endInput.min = startInput.value;
                if (endInput.value && endInput.value < startInput.value) {
                    endInput.value = startInput.value;
                    plannerState.endDate = startInput.value;
                }
            }
            updateDateRangeAndDuration();
            markParametersChanged();
        });
    }

    if (endInput) {
        endInput.addEventListener('change', () => {
            plannerState.endDate = endInput.value;
            updateDateRangeAndDuration();
            markParametersChanged();
        });
    }

    // Travelers Select
    const travelersSelect = document.getElementById('tripTravelers');
    const customTravelersWrapper = document.getElementById('customTravelersWrapper');
    const customTravelersInput = document.getElementById('tripCustomTravelers');

    if (travelersSelect) {
        travelersSelect.addEventListener('change', () => {
            plannerState.travelers = travelersSelect.value;
            if (travelersSelect.value === 'custom') {
                if (customTravelersWrapper) customTravelersWrapper.style.display = 'block';
                if (customTravelersInput) customTravelersInput.focus();
            } else {
                if (customTravelersWrapper) customTravelersWrapper.style.display = 'none';
            }
            updateCustomBudgetPreview();
            if (currentGeneratedItinerary) recalculateAndRenderTripCost();
            markParametersChanged();
        });
    }

    if (customTravelersInput) {
        customTravelersInput.addEventListener('input', () => {
            plannerState.customTravelers = customTravelersInput.value;
            updateCustomBudgetPreview();
            if (currentGeneratedItinerary) recalculateAndRenderTripCost();
            markParametersChanged();
        });
    }

    // Starting City Input
    const originInput = document.getElementById('tripOriginCity');
    const btnClearOrigin = document.getElementById('btnClearOrigin');
    if (originInput) {
        originInput.addEventListener('input', () => {
            plannerState.originCity = originInput.value.trim();
            if (btnClearOrigin) btnClearOrigin.style.display = originInput.value ? 'flex' : 'none';
            markParametersChanged();
        });
    }

    // Preferred Transit Mode
    const transitSelect = document.getElementById('tripTransitPref');
    if (transitSelect) {
        transitSelect.addEventListener('change', () => {
            plannerState.transitMode = transitSelect.value;
            markParametersChanged();
        });
    }

    // Budget Tier
    const budgetSelect = document.getElementById('tripBudget');
    const customBudgetSection = document.getElementById('customBudgetSection');
    const currentBudgetBadge = document.getElementById('currentBudgetBadge');

    if (budgetSelect) {
        budgetSelect.addEventListener('change', () => {
            plannerState.budgetTier = budgetSelect.value;
            if (budgetSelect.value === 'Custom') {
                if (customBudgetSection) customBudgetSection.style.display = 'block';
                if (currentBudgetBadge) currentBudgetBadge.textContent = 'Custom Exact Budget';
            } else {
                if (customBudgetSection) customBudgetSection.style.display = 'none';
                if (currentBudgetBadge) {
                    const optText = budgetSelect.options[budgetSelect.selectedIndex]?.text.split('(')[0].trim();
                    currentBudgetBadge.textContent = optText || budgetSelect.value;
                }
            }
            updateCustomBudgetPreview();
            if (currentGeneratedItinerary) recalculateAndRenderTripCost();
            markParametersChanged();
        });
    }

    // Custom Budget Inputs
    const customAmountInput = document.getElementById('tripCustomBudgetAmount');
    if (customAmountInput) {
        customAmountInput.addEventListener('input', () => {
            plannerState.customBudgetAmount = customAmountInput.value ? parseFloat(customAmountInput.value) : null;
            updateCustomBudgetPreview();
            if (currentGeneratedItinerary) recalculateAndRenderTripCost();
            markParametersChanged();
        });
    }

    const customCurrencySelect = document.getElementById('tripCustomCurrency');
    if (customCurrencySelect) {
        customCurrencySelect.addEventListener('change', () => {
            plannerState.customCurrency = customCurrencySelect.value;
            updateCustomBudgetPreview();
            if (currentGeneratedItinerary) recalculateAndRenderTripCost();
            markParametersChanged();
        });
    }

    // Additional Preferences
    const notesInput = document.getElementById('tripAdditionalNotes');
    if (notesInput) {
        notesInput.addEventListener('input', () => {
            plannerState.additionalNotes = notesInput.value.trim();
            markParametersChanged();
        });
    }
}

/**
 * 4. Destination & Starting City Autocomplete Bindings
 */
function bindAutocompleteListeners() {
    // Destination Autocomplete
    const destInput = document.getElementById('tripDestination');
    const destDropdown = document.getElementById('plannerAutocompleteDropdown');
    if (destInput && destDropdown && typeof window.setupGlobalAutocomplete === 'function') {
        window.setupGlobalAutocomplete(destInput, destDropdown, (item) => {
            const formatted = item.name + (item.country ? `, ${item.country}` : '');
            destInput.value = formatted;
            plannerState.destination = formatted;
            const btnClear = document.getElementById('btnClearDestination');
            if (btnClear) btnClear.style.display = 'flex';
            validateDestination();
            markParametersChanged();
        });
    }

    // Starting City Autocomplete
    const originInput = document.getElementById('tripOriginCity');
    const originDropdown = document.getElementById('originAutocompleteDropdown');
    if (originInput && originDropdown && typeof window.setupGlobalAutocomplete === 'function') {
        window.setupGlobalAutocomplete(originInput, originDropdown, (item) => {
            const formatted = item.name + (item.country ? `, ${item.country}` : '');
            originInput.value = formatted;
            plannerState.originCity = formatted;
            const btnClear = document.getElementById('btnClearOrigin');
            if (btnClear) btnClear.style.display = 'flex';
            markParametersChanged();
        });
    }
}

/**
 * 5. Parse Query Parameters for Deep Linking
 */
function parseUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const dest = params.get('destination') || params.get('dest');
    const travelers = params.get('travelers');
    const budget = params.get('budget');
    const origin = params.get('origin');

    if (dest) {
        const destInput = document.getElementById('tripDestination');
        if (destInput) {
            destInput.value = dest;
            plannerState.destination = dest;
            const btnClear = document.getElementById('btnClearDestination');
            if (btnClear) btnClear.style.display = 'flex';
        }
    }

    if (origin) {
        const originInput = document.getElementById('tripOriginCity');
        if (originInput) {
            originInput.value = origin;
            plannerState.originCity = origin;
            const btnClear = document.getElementById('btnClearOrigin');
            if (btnClear) btnClear.style.display = 'flex';
        }
    }

    if (travelers) {
        const travelersInput = document.getElementById('tripTravelers');
        if (travelersInput) {
            travelersInput.value = travelers;
            plannerState.travelers = travelers;
        }
    }

    if (budget) {
        const budgetSel = document.getElementById('tripBudget');
        if (budgetSel) {
            if (budget.toLowerCase() === 'budget') budgetSel.value = 'Budget';
            else if (budget.toLowerCase() === 'luxury') budgetSel.value = 'Luxury';
            else if (budget.toLowerCase() === 'premium') budgetSel.value = 'Premium';
            else if (budget.toLowerCase() === 'custom') {
                budgetSel.value = 'Custom';
                const customSection = document.getElementById('customBudgetSection');
                if (customSection) customSection.style.display = 'block';
            } else {
                budgetSel.value = 'Moderate';
            }
            plannerState.budgetTier = budgetSel.value;
        }
    }
}

/**
 * 6. Dynamic Date Range & Duration Calculator
 */
function updateDateRangeAndDuration() {
    const startVal = document.getElementById('tripStartDate')?.value;
    const endVal = document.getElementById('tripEndDate')?.value;
    const badgeEl = document.getElementById('tripDurationBadge');
    const textEl = document.getElementById('durationText');
    const subTextEl = document.getElementById('dateRangeSubtitle');
    const valMsg = document.getElementById('valMsgDates');

    if (!startVal || !endVal) return;

    const start = new Date(startVal);
    const end = new Date(endVal);

    if (end < start) {
        if (valMsg) valMsg.style.display = 'flex';
        if (textEl) textEl.textContent = 'Invalid Range';
        return;
    }

    if (valMsg) valMsg.style.display = 'none';

    const diffMs = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
    const nights = Math.max(0, diffDays - 1);

    plannerState.days = diffDays;
    plannerState.startDate = startVal;
    plannerState.endDate = endVal;

    if (textEl) {
        textEl.textContent = `${diffDays} Days / ${nights} Nights`;
    }

    if (subTextEl) {
        const fmtStart = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const fmtEnd = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        subTextEl.textContent = `${fmtStart} – ${fmtEnd}`;
    }
}

/**
 * 7. Live Custom Budget Preview
 */
function updateCustomBudgetPreview() {
    const previewEl = document.getElementById('customBudgetPreview');
    if (!previewEl) return;

    const travelers = getActiveTravelersCount();
    const symbol = getCurrencySymbol(plannerState.customCurrency);
    const amount = plannerState.customBudgetAmount;

    if (!amount || amount <= 0) {
        previewEl.innerHTML = `<i class="fas fa-coins"></i> <span>Enter an amount to guide real-time itinerary allocation.</span>`;
        return;
    }

    if (plannerState.budgetType === 'per_person') {
        const total = Math.round(amount * travelers);
        previewEl.innerHTML = `<i class="fas fa-coins" style="color:var(--accent-gold);"></i> <span><strong>${symbol}${amount.toLocaleString()} / person</strong> • Total Estimated Trip Budget: <strong>${symbol}${total.toLocaleString()}</strong> for ${travelers} travelers</span>`;
    } else {
        const perPerson = Math.round(amount / travelers);
        previewEl.innerHTML = `<i class="fas fa-coins" style="color:var(--accent-gold);"></i> <span><strong>${symbol}${amount.toLocaleString()} Total Trip</strong> • Estimated <strong>${symbol}${perPerson.toLocaleString()} / person</strong> for ${travelers} travelers</span>`;
    }
}

/**
 * 8. Clear Single Field Utility
 */
function clearField(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;

    input.value = '';
    if (fieldId === 'tripDestination') {
        plannerState.destination = '';
        const btn = document.getElementById('btnClearDestination');
        if (btn) btn.style.display = 'none';
        validateDestination();
    } else if (fieldId === 'tripOriginCity') {
        plannerState.originCity = '';
        const btn = document.getElementById('btnClearOrigin');
        if (btn) btn.style.display = 'none';
    }

    input.focus();
    markParametersChanged();
}

/**
 * 9. Set Budget Type (Per Person vs Total)
 */
function setBudgetType(type) {
    plannerState.budgetType = type;
    const btnPerPerson = document.getElementById('btnBudgetPerPerson');
    const btnTotal = document.getElementById('btnBudgetTotal');

    if (btnPerPerson && btnTotal) {
        btnPerPerson.classList.toggle('active', type === 'per_person');
        btnTotal.classList.toggle('active', type === 'total');
    }

    updateCustomBudgetPreview();
    if (currentGeneratedItinerary) recalculateAndRenderTripCost();
    markParametersChanged();
}

/**
 * 10. Travel Interest Cards Toggle
 */
function toggleInterest(el, interestName) {
    const isSelected = el.classList.contains('selected');

    if (isSelected) {
        // Prevent deselecting everything to maintain at least 1 interest
        if (plannerState.interests.length <= 1) {
            alert('Please keep at least one interest selected for tailored travel recommendations.');
            return;
        }
        el.classList.remove('selected');
        el.setAttribute('aria-checked', 'false');
        plannerState.interests = plannerState.interests.filter(i => i.toLowerCase() !== interestName.toLowerCase());
    } else {
        el.classList.add('selected');
        el.setAttribute('aria-checked', 'true');
        if (!plannerState.interests.some(i => i.toLowerCase() === interestName.toLowerCase())) {
            plannerState.interests.push(interestName);
        }
    }

    const badge = document.getElementById('interestsCountBadge');
    if (badge) {
        badge.textContent = `${plannerState.interests.length} selected`;
    }

    markParametersChanged();
}

/**
 * 11. Validation Utilities
 */
function validateDestination() {
    const dest = (document.getElementById('tripDestination')?.value || '').trim();
    const valMsg = document.getElementById('valMsgDestination');
    const input = document.getElementById('tripDestination');

    if (!dest) {
        if (valMsg) valMsg.style.display = 'flex';
        if (input) input.classList.add('is-invalid');
        return false;
    }

    if (valMsg) valMsg.style.display = 'none';
    if (input) input.classList.remove('is-invalid');
    return true;
}

function validateDates() {
    const startVal = document.getElementById('tripStartDate')?.value;
    const endVal = document.getElementById('tripEndDate')?.value;
    const valMsg = document.getElementById('valMsgDates');

    if (!startVal || !endVal) return false;

    const start = new Date(startVal);
    const end = new Date(endVal);

    if (end < start) {
        if (valMsg) valMsg.style.display = 'flex';
        return false;
    }

    if (valMsg) valMsg.style.display = 'none';
    return true;
}

/**
 * 12. Stepper Navigation Controller
 */
function goToStep(stepNum) {
    if (stepNum === 2) {
        // Validate Step 1 before advancing
        const destValid = validateDestination();
        const datesValid = validateDates();
        if (!destValid || !datesValid) {
            const firstInvalid = !destValid ? document.getElementById('tripDestination') : document.getElementById('tripStartDate');
            if (firstInvalid) firstInvalid.focus();
            return;
        }
    }

    if (stepNum >= 3) {
        if (!plannerState.isGenerated) {
            // If user hasn't generated yet, focus on step 2 with generate button
            goToStep(2);
            const genBtn = document.getElementById('btnGenerateTrip');
            if (genBtn) genBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            return;
        }

        // Scroll down to itinerary view
        const outSection = document.getElementById('itineraryOutputSection');
        if (outSection && outSection.style.display !== 'none') {
            outSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    plannerState.currentStep = stepNum;

    // Show appropriate step panel
    const panel1 = document.getElementById('stepPanel1');
    const panel2 = document.getElementById('stepPanel2');
    const stepBadge = document.getElementById('plannerStepBadge');

    if (stepNum === 1) {
        if (panel1) panel1.classList.add('active');
        if (panel2) panel2.classList.remove('active');
        if (stepBadge) stepBadge.textContent = 'Step 1 of 2: Trip Details';
        document.getElementById('plannerFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (stepNum === 2) {
        if (panel1) panel1.classList.remove('active');
        if (panel2) panel2.classList.add('active');
        if (stepBadge) stepBadge.textContent = 'Step 2 of 2: Travel Style & Budget';
        document.getElementById('plannerFormCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update Stepper Indicator Circles
    updateStepperIndicators(stepNum);
}

function updateStepperIndicators(stepNum) {
    for (let i = 1; i <= 4; i++) {
        const indicator = document.getElementById('stepIndicator' + i);
        if (!indicator) continue;

        if (i < stepNum) {
            indicator.className = 'stepper-item completed';
        } else if (i === stepNum) {
            indicator.className = 'stepper-item active';
        } else {
            indicator.className = 'stepper-item';
        }
    }
}

/**
 * 13. Mark Parameters Changed (Stale Detection)
 */
function markParametersChanged() {
    if (plannerState.isGenerated) {
        plannerState.isStale = true;
        const staleAlert = document.getElementById('staleParamAlert');
        if (staleAlert) staleAlert.style.display = 'flex';
    }
}

/**
 * 14. Generate Itinerary (Real Backend Submission)
 */
async function generateItinerary(e) {
    if (e && e.preventDefault) e.preventDefault();

    if (!validateDestination() || !validateDates()) {
        goToStep(1);
        return;
    }

    const destination = (document.getElementById('tripDestination')?.value || plannerState.destination).trim();
    const startDate = document.getElementById('tripStartDate')?.value || plannerState.startDate;
    const endDate = document.getElementById('tripEndDate')?.value || plannerState.endDate;
    const travelers = getActiveTravelersCount();
    const budgetTier = document.getElementById('tripBudget')?.value || plannerState.budgetTier;
    const originCity = (document.getElementById('tripOriginCity')?.value || plannerState.originCity).trim();
    const transitMode = document.getElementById('tripTransitPref')?.value || plannerState.transitMode;
    const additionalPrefs = (document.getElementById('tripAdditionalNotes')?.value || plannerState.additionalNotes).trim();

    const isCustomBudget = budgetTier === 'Custom';
    const customBudgetAmount = isCustomBudget ? plannerState.customBudgetAmount : null;
    const customCurrency = isCustomBudget ? (document.getElementById('tripCustomCurrency')?.value || 'INR') : 'INR';

    const btn = document.getElementById('btnGenerateTrip');
    const regenBtn = document.getElementById('btnRegenerateAction');
    const originalText = btn ? btn.innerHTML : 'Generate Itinerary ✨';

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Synthesizing Itinerary…';
    }
    if (regenBtn) {
        regenBtn.disabled = true;
        regenBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Regenerating…';
    }

    updateStepperIndicators(3);

    const activeLang = (typeof I18n !== 'undefined') ? I18n.getCurrentLanguage() : 'en';
    const payload = {
        destination,
        originCity,
        transitMode,
        startDate,
        endDate,
        days: plannerState.days,
        travelers,
        budgetTier: isCustomBudget ? 'Custom' : budgetTier,
        customBudget: customBudgetAmount,
        budgetType: plannerState.budgetType,
        currency: customCurrency,
        interests: plannerState.interests.length > 0 ? plannerState.interests : ['Sightseeing', 'Nature and lakes'],
        additionalPreferences: additionalPrefs,
        language: activeLang
    };

    try {
        const res = await Api.post('/trips/generate', payload);
        const data = res.data || res;

        currentGeneratedItinerary = data;
        plannerState.isGenerated = true;
        plannerState.isStale = false;

        // Hide stale alert
        const staleAlert = document.getElementById('staleParamAlert');
        if (staleAlert) staleAlert.style.display = 'none';

        // Render UI sections
        renderItineraryOutput(data);
        renderItineraryParametersBar(payload);
        recalculateAndRenderTripCost();
        updateStepperIndicators(4);

        // Display results section smoothly
        const outSection = document.getElementById('itineraryOutputSection');
        if (outSection) {
            outSection.style.display = 'block';
            outSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }

        // Initialize or refresh Leaflet map
        setTimeout(() => {
            initPlannerRouteMap(data);
        }, 180);

    } catch (err) {
        console.error('Failed to generate itinerary:', err);
        alert('Could not connect to AI trip planner. Please check your network connection and try again.');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
        if (regenBtn) {
            regenBtn.disabled = false;
            regenBtn.innerHTML = '<i class="fas fa-rotate"></i> Regenerate';
        }
    }
}

/**
 * 15. Render Summary Parameters Bar in Itinerary View
 */
function renderItineraryParametersBar(params) {
    const bar = document.getElementById('itineraryParamsBar');
    if (!bar) return;

    const symbol = getCurrencySymbol(params.currency);
    let budgetDisplay = `${params.budgetTier || 'Moderate'} Budget`;
    if (params.budgetTier === 'Custom' && params.customBudget) {
        budgetDisplay = `Custom ${symbol}${params.customBudget.toLocaleString()} (${params.budgetType === 'total' ? 'Total' : 'Per person'})`;
    }

    const transitDisplay = (params.transitMode && params.transitMode !== 'No preference')
        ? (params.originCity ? `From ${params.originCity} via ${params.transitMode}` : `Via ${params.transitMode}`)
        : (params.originCity ? `From ${params.originCity}` : null);

    const interestsList = (params.interests || []).slice(0, 4);

    bar.innerHTML = `
        <span class="param-pill"><i class="fas fa-location-dot"></i> ${escapeHtml(params.destination)}</span>
        <span class="param-pill"><i class="fas fa-calendar"></i> ${params.days} Days (${params.startDate} to ${params.endDate})</span>
        <span class="param-pill"><i class="fas fa-user-group"></i> ${params.travelers} ${params.travelers === 1 ? 'Traveler' : 'Travelers'}</span>
        <span class="param-pill"><i class="fas fa-wallet"></i> ${escapeHtml(budgetDisplay)}</span>
        ${transitDisplay ? `<span class="param-pill"><i class="fas fa-route"></i> ${escapeHtml(transitDisplay)}</span>` : ''}
        ${interestsList.map(int => `<span class="param-pill"><i class="fas fa-tag"></i> ${escapeHtml(int)}</span>`).join('')}
    `;
}

/**
 * 16. Render Itinerary Details & Day-by-Day Timeline
 */
function renderItineraryOutput(itinerary) {
    const titleEl = document.getElementById('outItineraryTitle');
    const subtitleEl = document.getElementById('outItinerarySubtitle');

    if (titleEl) {
        titleEl.textContent = itinerary.title || `Your Trip to ${itinerary.destination}`;
    }

    if (subtitleEl) {
        const travelers = itinerary.travelers || getActiveTravelersCount();
        const days = itinerary.days || plannerState.days;
        subtitleEl.textContent = `Customised for ${travelers} travelers • ${days} Days Journey • Dynamic Cost Estimation`;
    }

    renderTimelineNodesOnly();

    // Practical Travel Guidance List
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

        const locationName = day.location || currentGeneratedItinerary.destination || 'Scenic Destination';
        const dayImg = day.imageUrl || currentGeneratedItinerary.imageUrl || (typeof window.getDestinationImage === 'function' ? window.getDestinationImage(locationName) : 'assets/dash.jpg');
        const activitiesHtml = (day.activities || []).map(act => `<li>${escapeHtml(act)}</li>`).join('');

        node.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="day-card">
                <img class="day-thumbnail" src="${dayImg}" alt="${escapeHtml(day.title)}" onerror="window.handleImageError(this, '${escapeHtml(locationName)}');" loading="lazy">
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

/**
 * 17. Dynamic Trip Cost Engine with 10% Emergency Contingency
 */
function recalculateAndRenderTripCost() {
    if (!currentGeneratedItinerary) return;

    const daysCount = (currentGeneratedItinerary.daysPlan && currentGeneratedItinerary.daysPlan.length) || parseInt(currentGeneratedItinerary.days) || plannerState.days || 3;
    const travelersCount = getActiveTravelersCount();
    const budgetTier = plannerState.budgetTier || 'Moderate';
    const currency = plannerState.budgetTier === 'Custom' ? plannerState.customCurrency : 'INR';
    const symbol = getCurrencySymbol(currency);
    const destName = (currentGeneratedItinerary.destination || plannerState.destination || '').toLowerCase();
    const isInternational = destName.includes('paris') || destName.includes('tokyo') || destName.includes('london') || destName.includes('new york') || destName.includes('international') || destName.includes('dubai');

    let lodgingTotal, transitTotal, localTransitTotal, foodTotal, activitiesTotal;

    if (budgetTier === 'Custom' && plannerState.customBudgetAmount && plannerState.customBudgetAmount > 0) {
        let totalAllocated = plannerState.customBudgetAmount;
        if (plannerState.budgetType === 'per_person') {
            totalAllocated = totalAllocated * travelersCount;
        }

        lodgingTotal = Math.round(totalAllocated * 0.38);
        transitTotal = Math.round(totalAllocated * 0.22);
        foodTotal = Math.round(totalAllocated * 0.25);
        activitiesTotal = Math.round(totalAllocated * 0.15);
        localTransitTotal = Math.round(totalAllocated * 0.08);
    } else {
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
        } else if (budgetTier === 'Premium') {
            baseDailyStay = 4200;
            baseDailyFood = 1400;
            baseTransit = 3200;
            baseActivities = 700;
            baseDailyLocalTransit = 750;
        } else if (budgetTier === 'Luxury') {
            baseDailyStay = 7500;
            baseDailyFood = 2500;
            baseTransit = 5500;
            baseActivities = 1200;
            baseDailyLocalTransit = 1400;
        }

        if (isInternational) {
            baseDailyStay *= 3.5;
            baseDailyFood *= 3.5;
            baseTransit = 28000;
        }

        const roomsNeeded = Math.ceil(travelersCount / 2);
        lodgingTotal = Math.round(baseDailyStay * Math.max(1, daysCount - 1) * roomsNeeded);
        transitTotal = Math.round(baseTransit * travelersCount);
        localTransitTotal = Math.round(baseDailyLocalTransit * daysCount * Math.ceil(travelersCount / 3));
        foodTotal = Math.round(baseDailyFood * daysCount * travelersCount);
        activitiesTotal = Math.round(baseActivities * daysCount * travelersCount);
    }

    const subTotal = lodgingTotal + transitTotal + localTransitTotal + foodTotal + activitiesTotal;
    const contingency = Math.round(subTotal * 0.10);
    const grandTotal = subTotal + contingency;
    const perPerson = Math.round(grandTotal / travelersCount);

    // Update banner summary elements
    const totalEl = document.getElementById('costHeroTotal');
    if (totalEl) totalEl.textContent = `${symbol}${grandTotal.toLocaleString()}`;

    const perPersonEl = document.getElementById('costPerPerson');
    if (perPersonEl) perPersonEl.textContent = `${symbol}${perPerson.toLocaleString()}`;

    const travelersEl = document.getElementById('costTravelersCount');
    if (travelersEl) travelersEl.textContent = travelersCount;

    const daysEl = document.getElementById('costDaysCount');
    if (daysEl) daysEl.textContent = daysCount;

    // Update Pill Breakdown
    const setPill = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${symbol}${val.toLocaleString()}`;
    };
    setPill('pillTransit', transitTotal);
    setPill('pillLocalTransit', localTransitTotal);
    setPill('pillLodging', lodgingTotal);
    setPill('pillFood', foodTotal);
    setPill('pillActivities', activitiesTotal);
    setPill('pillContingency', contingency);

    // Update Bottom Budget Grid
    const budgetGrid = document.getElementById('outBudgetGrid');
    if (budgetGrid) {
        budgetGrid.innerHTML = `
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-hotel" style="color:var(--accent-gold);"></i> Lodging &amp; Stays</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${symbol}${lodgingTotal.toLocaleString()}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-plane-departure" style="color:var(--accent-cyan);"></i> Intercity Transit</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${symbol}${transitTotal.toLocaleString()}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-taxi" style="color:var(--accent-gold);"></i> Local Transit</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${symbol}${localTransitTotal.toLocaleString()}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-utensils" style="color:#F59E0B;"></i> Food &amp; Dining</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${symbol}${foodTotal.toLocaleString()}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-ticket-alt" style="color:var(--accent-emerald);"></i> Sightseeing &amp; Activities</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${symbol}${activitiesTotal.toLocaleString()}</h4>
            </div>
            <div style="background:var(--bg-surface); border:1px solid var(--border); padding:18px; border-radius:10px;">
                <span style="font-size:12px; color:var(--text-dim); text-transform:uppercase; font-weight:700;"><i class="fas fa-shield-halved" style="color:var(--accent-rose);"></i> Contingency Reserve (10%)</span>
                <h4 style="font-size:20px; color:var(--text-main); margin-top:6px; font-family:var(--font-display);">${symbol}${contingency.toLocaleString()}</h4>
            </div>
        `;
    }

    currentGeneratedItinerary.estimatedBudget = `${symbol}${grandTotal.toLocaleString()}`;
}

/**
 * 18. Remove Stop Day from Timeline
 */
function removeItineraryDay(dayIdx) {
    if (!currentGeneratedItinerary || !currentGeneratedItinerary.daysPlan) return;
    if (currentGeneratedItinerary.daysPlan.length <= 1) {
        alert('Your itinerary must contain at least 1 day stop.');
        return;
    }

    currentGeneratedItinerary.daysPlan.splice(dayIdx, 1);
    currentGeneratedItinerary.daysPlan.forEach((d, i) => {
        d.dayNumber = i + 1;
    });
    currentGeneratedItinerary.days = currentGeneratedItinerary.daysPlan.length;

    renderTimelineNodesOnly();
    recalculateAndRenderTripCost();
    updatePlannerRouteMap(currentGeneratedItinerary);
}

/**
 * 19. Leaflet OpenStreetMap & Esri Satellite Layer Switcher
 */
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
        'shimla': [31.1048, 77.1734],
        'kodaikanal': [10.2381, 77.4892],
        'london': [51.5074, -0.1278],
        'dubai': [25.2048, 55.2708]
    };

    const destKey = (itinerary.destination || '').toLowerCase().split(',')[0].trim();
    const center = coordsMap[destKey] || [11.4102, 76.6950];

    if (!plannerMap) {
        const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        });

        const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            maxZoom: 19,
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS'
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
        'shimla': [31.1048, 77.1734],
        'kodaikanal': [10.2381, 77.4892],
        'london': [51.5074, -0.1278],
        'dubai': [25.2048, 55.2708]
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

/**
 * 20. Save Trip Plan to User Profile
 */
async function saveTripToProfile() {
    if (!Auth.isAuthenticated()) {
        alert('Please login to bookmark and save this trip to your account.');
        window.location.href = 'login.html?redirect=planner.html';
        return;
    }

    if (!currentGeneratedItinerary) return;

    const btn = document.getElementById('btnSaveTrip');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving…';
    }

    try {
        const payload = {
            title: currentGeneratedItinerary.title,
            origin: plannerState.originCity,
            destination: currentGeneratedItinerary.destination,
            days: currentGeneratedItinerary.days || plannerState.days,
            people: getActiveTravelersCount(),
            hotelTier: plannerState.budgetTier || 'Moderate',
            currency: plannerState.customCurrency || 'INR',
            startDate: plannerState.startDate,
            endDate: plannerState.endDate,
            interests: plannerState.interests,
            status: 'upcoming',
            imageUrl: currentGeneratedItinerary.imageUrl,
            daysPlan: currentGeneratedItinerary.daysPlan,
            budgetBreakdown: currentGeneratedItinerary.budgetBreakdown,
            travelTips: currentGeneratedItinerary.travelTips
        };

        await Api.post('/trips', payload);

        if (btn) {
            btn.innerHTML = '<i class="fas fa-check"></i> Saved!';
            btn.style.background = 'var(--accent-emerald)';
        }

        setTimeout(() => {
            if (confirm('Trip saved successfully! Would you like to view your Saved Trips in the Dashboard?')) {
                window.location.href = 'dashboard.html?tab=trips';
            }
        }, 300);
    } catch (e) {
        console.error('Save trip failed:', e);
        alert('Could not save trip. Please try again.');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-bookmark"></i> Save Trip';
        }
    }
}

/**
 * 21. Export & Clipboard Actions
 */
function copyItineraryText() {
    if (!currentGeneratedItinerary) return;

    let text = `${currentGeneratedItinerary.title}\n`;
    text += `Destination: ${currentGeneratedItinerary.destination}\n`;
    if (plannerState.originCity) text += `Starting From: ${plannerState.originCity} (Transit: ${plannerState.transitMode})\n`;
    text += `Duration: ${currentGeneratedItinerary.days} Days • Travelers: ${getActiveTravelersCount()}\n`;
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

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Global Window Bindings
window.goToStep = goToStep;
window.clearField = clearField;
window.setBudgetType = setBudgetType;
window.toggleInterest = toggleInterest;
window.generateItinerary = generateItinerary;
window.removeItineraryDay = removeItineraryDay;
window.copyItineraryText = copyItineraryText;
window.exportItineraryPdf = exportItineraryPdf;
window.saveTripToProfile = saveTripToProfile;
window.plannerState = plannerState;
