/**
 * Tourist Guide & TravelMind AI — Chatbot UI & Interaction Controller
 */

let currentChatId = null;
let isLoading = false;
let messageCounter = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication
    if (!Auth.isAuthenticated()) {
        window.location.href = 'login.html?redirect=chatbot.html';
        return;
    }

    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const charCount = document.getElementById('charCount');

    if (messageInput) {
        messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });

        messageInput.addEventListener('input', () => {
            messageInput.style.height = '48px';
            messageInput.style.height = Math.min(messageInput.scrollHeight, 160) + 'px';
            if (charCount) {
                charCount.textContent = `${messageInput.value.length} / 500`;
                charCount.classList.toggle('warn', messageInput.value.length > 450);
            }
        });
    }

    if (sendBtn) {
        sendBtn.addEventListener('click', sendMessage);
    }

    loadChatHistory();

    // Check for pending prompt from destinations page
    const pending = localStorage.getItem('pending_chat_prompt');
    if (pending) {
        localStorage.removeItem('pending_chat_prompt');
        setTimeout(() => {
            usePrompt(pending);
            sendMessage();
        }, 300);
    }
});

/**
 * Send user message to Spring Boot backend
 */
async function sendMessage() {
    if (isLoading) return;
    const input = document.getElementById('messageInput');
    const text = input ? input.value.trim() : '';
    if (!text) return;

    // Append user message bubble
    appendMessage(text, 'user');
    input.value = '';
    input.style.height = '48px';
    const charCount = document.getElementById('charCount');
    if (charCount) charCount.textContent = '0 / 500';

    isLoading = true;
    const sendBtn = document.getElementById('sendBtn');
    if (sendBtn) sendBtn.disabled = true;

    // Show thinking indicator
    const thinkingEl = showThinking('Discovering travel insights & planning route…');

    try {
        const payload = {
            message: text,
            chatId: currentChatId
        };

        const res = await Api.post('/chat', payload);
        thinkingEl.remove();

        if (res.chatId) {
            currentChatId = res.chatId;
        }

        if (res.destination) {
            // Render rich destination card
            renderDestinationCard(res.destination, res.response);
        } else if (res.trip) {
            // Render structured itinerary plan
            renderTripItinerary(res.trip, res.response);
        } else if (res.response) {
            appendMessage(formatAiText(res.response), 'bot');
        } else if (res.message) {
            appendMessage(formatAiText(res.message), 'bot');
        } else {
            appendMessage("I couldn't process that destination. Please try another place name.", 'bot');
        }

        // Refresh sidebar history list
        loadChatHistory();
    } catch (err) {
        thinkingEl.remove();
        console.error('Chat error:', err);
        appendMessage(`⚠️ Error: ${err.message || 'Unable to connect to AI server'}`, 'bot');
    } finally {
        isLoading = false;
        if (sendBtn) sendBtn.disabled = false;
        if (input) input.focus();
    }
}

/**
 * Format markdown/raw AI text with paragraphs and links
 */
function formatAiText(text) {
    if (!text) return '';
    if (typeof text !== 'string') return JSON.stringify(text);

    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>')
        .replace(/\n\n/g, '<br><br>')
        .replace(/\n/g, '<br>');

    return formatted;
}

/**
 * Append standard chat bubble
 */
function appendMessage(htmlContent, role) {
    const wrap = document.getElementById('messagesWrap');
    if (!wrap) return;

    messageCounter++;
    const row = document.createElement('div');
    row.className = `msg-row ${role}`;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (role === 'user') {
        row.innerHTML = `
            <div style="display:flex;flex-direction:column;align-items:flex-end;max-width:85%;">
                <div class="bubble user">${escapeHtml(htmlContent)}</div>
                <div class="msg-meta"><span>${timeStr}</span></div>
            </div>
            <div class="msg-avatar user-av"><i class="fas fa-user"></i></div>
        `;
    } else {
        row.innerHTML = `
            <div class="msg-avatar bot-av"><i class="fas fa-robot"></i></div>
            <div style="display:flex;flex-direction:column;max-width:85%;width:100%;">
                <div class="bubble bot" id="bubble-${messageCounter}">${htmlContent}</div>
                <div class="msg-meta">
                    <span>${timeStr}</span>
                    <button class="copy-btn" onclick="copyBubble('bubble-${messageCounter}')" title="Copy text"><i class="fas fa-copy"></i> Copy</button>
                </div>
            </div>
        `;
    }

    wrap.appendChild(row);
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
}

/**
 * Render Rich Destination Card
 */
function renderDestinationCard(dest, aiText) {
    const wrap = document.getElementById('messagesWrap');
    if (!wrap) return;

    messageCounter++;
    const row = document.createElement('div');
    row.className = 'msg-row bot';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let imagesHtml = '';
    if (dest.images && dest.images.length > 0) {
        imagesHtml = `
            <div class="image-gallery">
                ${dest.images.map(img => `<img src="${img}" alt="${dest.name}" onclick="window.open(this.src,'_blank')">`).join('')}
            </div>
        `;
    }

    let mapHtml = '';
    if (dest.latitude && dest.longitude) {
        mapHtml = `
            <div class="map-box">
                <iframe src="https://maps.google.com/maps?q=${dest.latitude},${dest.longitude}&z=12&output=embed" loading="lazy"></iframe>
            </div>
            <p style="margin-top:8px;font-size:12px;color:var(--slate);">
                <i class="fas fa-map-pin"></i> ${dest.latitude}, ${dest.longitude} &nbsp;|&nbsp; 
                <a href="https://www.google.com/maps/search/?api=1&query=${dest.latitude},${dest.longitude}" target="_blank" style="color:var(--gold);">Open in Google Maps</a>
            </p>
        `;
    }

    row.innerHTML = `
        <div class="msg-avatar bot-av"><i class="fas fa-compass"></i></div>
        <div style="display:flex;flex-direction:column;max-width:85%;width:100%;">
            <div class="bubble bot" id="bubble-${messageCounter}">
                <div class="dest-card">
                    <div class="dest-card-header">
                        <div class="dest-card-title">
                            <i class="fas fa-map-marker-alt"></i>
                            <h3>📍 ${dest.name}${dest.country ? ', ' + dest.country : ''}</h3>
                        </div>
                        <button class="btn btn-outline btn-sm" onclick="toggleBookmark('${dest.name}', '${dest.country || ''}')">
                            <i class="far fa-bookmark"></i> Save
                        </button>
                    </div>

                    ${dest.description ? `<p style="margin-bottom:14px;color:var(--cream-muted);">${dest.description}</p>` : ''}

                    <div class="dest-section">
                        <div class="dest-section-header" onclick="toggleSection(this)">
                            <h4><i class="fas fa-info-circle"></i> Quick Essentials</h4>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="dest-section-body">
                            <div class="info-grid">
                                ${dest.famousFor ? `<div class="info-item"><i class="fas fa-star"></i><div><div class="label">Famous For</div><div class="value">${dest.famousFor}</div></div></div>` : ''}
                                ${dest.bestTime ? `<div class="info-item"><i class="fas fa-calendar-alt"></i><div><div class="label">Best Time</div><div class="value">${dest.bestTime}</div></div></div>` : ''}
                                ${dest.unescoStatus ? `<div class="info-item"><i class="fas fa-award"></i><div><div class="label">UNESCO Status</div><div class="value">${dest.unescoStatus}</div></div></div>` : ''}
                                ${dest.entryFee ? `<div class="info-item"><i class="fas fa-ticket-alt"></i><div><div class="label">Entry Fee</div><div class="value">${dest.entryFee}</div></div></div>` : ''}
                                ${dest.openingTime ? `<div class="info-item"><i class="fas fa-clock"></i><div><div class="label">Timings</div><div class="value">${dest.openingTime} - ${dest.closingTime || ''}</div></div></div>` : ''}
                            </div>
                        </div>
                    </div>

                    ${imagesHtml ? `
                    <div class="dest-section">
                        <div class="dest-section-header" onclick="toggleSection(this)">
                            <h4><i class="fas fa-images"></i> Photo Gallery</h4>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="dest-section-body">${imagesHtml}</div>
                    </div>` : ''}

                    ${mapHtml ? `
                    <div class="dest-section">
                        <div class="dest-section-header" onclick="toggleSection(this)">
                            <h4><i class="fas fa-map"></i> Location & Map</h4>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="dest-section-body">${mapHtml}</div>
                    </div>` : ''}

                    ${aiText ? `
                    <div class="dest-section">
                        <div class="dest-section-header" onclick="toggleSection(this)">
                            <h4><i class="fas fa-robot"></i> Complete Travel Guide & Tips</h4>
                            <i class="fas fa-chevron-down"></i>
                        </div>
                        <div class="dest-section-body">
                            ${formatAiText(aiText)}
                        </div>
                    </div>` : ''}
                </div>
            </div>
            <div class="msg-meta">
                <span>${timeStr}</span>
                <button class="copy-btn" onclick="copyBubble('bubble-${messageCounter}')"><i class="fas fa-copy"></i> Copy</button>
            </div>
        </div>
    `;

    wrap.appendChild(row);
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
}

/**
 * Render Itinerary Plan
 */
function renderTripItinerary(trip, aiText) {
    const wrap = document.getElementById('messagesWrap');
    if (!wrap) return;

    messageCounter++;
    const row = document.createElement('div');
    row.className = 'msg-row bot';
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    row.innerHTML = `
        <div class="msg-avatar bot-av"><i class="fas fa-route"></i></div>
        <div style="display:flex;flex-direction:column;max-width:85%;width:100%;">
            <div class="bubble bot" id="bubble-${messageCounter}">
                <div class="dest-card">
                    <div class="dest-card-header">
                        <div class="dest-card-title">
                            <i class="fas fa-suitcase-rolling"></i>
                            <h3>🗺 ${trip.title || 'Customized Itinerary'}</h3>
                        </div>
                    </div>
                    <div style="padding:10px 0;">
                        ${formatAiText(aiText || trip.itinerary)}
                    </div>
                </div>
            </div>
            <div class="msg-meta">
                <span>${timeStr}</span>
                <button class="copy-btn" onclick="copyBubble('bubble-${messageCounter}')"><i class="fas fa-copy"></i> Copy</button>
            </div>
        </div>
    `;

    wrap.appendChild(row);
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
}

/**
 * Bookmark / Favorite helper
 */
async function toggleBookmark(name, country) {
    try {
        await Api.post('/favorites', { destinationName: name, country });
        App.toast(`Saved "${name}" to your favorites!`, 'success');
    } catch (err) {
        App.toast(err.message || 'Could not save destination', 'error');
    }
}

/**
 * Collapsible section toggle
 */
function toggleSection(headerEl) {
    const body = headerEl.nextElementSibling;
    const icon = headerEl.querySelector('.fa-chevron-down, .fa-chevron-up');
    if (body.style.display === 'none') {
        body.style.display = 'block';
        if (icon) {
            icon.classList.remove('fa-chevron-down');
            icon.classList.add('fa-chevron-up');
        }
    } else {
        body.style.display = 'none';
        if (icon) {
            icon.classList.remove('fa-chevron-up');
            icon.classList.add('fa-chevron-down');
        }
    }
}

/**
 * Show Thinking animation
 */
function showThinking(text) {
    const wrap = document.getElementById('messagesWrap');
    const thinking = document.createElement('div');
    thinking.className = 'thinking';
    thinking.innerHTML = `
        <div class="msg-avatar bot-av" style="width:34px;height:34px;font-size:13px;"><i class="fas fa-robot"></i></div>
        <div class="dots"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>
        <span>${text || 'Thinking…'}</span>
    `;
    wrap.appendChild(thinking);
    wrap.scrollTo({ top: wrap.scrollHeight, behavior: 'smooth' });
    return thinking;
}

/**
 * Load chat history in sidebar
 */
async function loadChatHistory() {
    const listEl = document.getElementById('chatHistoryList');
    if (!listEl) return;

    try {
        const data = await Api.get('/chat/history');
        const chats = data.history || data.chats || [];
        if (!chats.length) {
            listEl.innerHTML = `<p style="padding:12px;font-size:12px;color:var(--slate);font-style:italic;">No previous chats found.</p>`;
            return;
        }

        listEl.innerHTML = chats.map(c => `
            <div class="history-item ${c.id === currentChatId ? 'active' : ''}" onclick="openChat('${c.id}')">
                <i class="fas fa-comment-dots" style="font-size:12px;color:var(--terracotta);"></i>
                <span class="history-title">${escapeHtml(c.title || c.userMessage || 'Travel Inquiry')}</span>
                <button class="history-delete-btn" onclick="event.stopPropagation(); deleteChat('${c.id}')" title="Delete chat">
                    <i class="fas fa-trash-alt"></i>
                </button>
            </div>
        `).join('');
    } catch (err) {
        console.warn('Failed to load chat history:', err);
    }
}

/**
 * Open selected chat
 */
async function openChat(chatId) {
    try {
        currentChatId = chatId;
        const res = await Api.get(`/chat/${chatId}`);
        const wrap = document.getElementById('messagesWrap');
        if (!wrap) return;

        wrap.innerHTML = '';
        const messages = res.messages || [];
        messages.forEach(m => {
            appendMessage(formatAiText(m.content || m.aiReply), m.role === 'user' ? 'user' : 'bot');
        });

        loadChatHistory();
    } catch (err) {
        App.toast('Could not load chat', 'error');
    }
}

/**
 * Delete single chat
 */
async function deleteChat(chatId) {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    try {
        await Api.delete(`/chat/${chatId}`);
        if (currentChatId === chatId) {
            startNewChat();
        }
        loadChatHistory();
        App.toast('Chat deleted', 'info');
    } catch (err) {
        App.toast('Failed to delete chat', 'error');
    }
}

/**
 * Start New Chat
 */
function startNewChat() {
    currentChatId = null;
    const wrap = document.getElementById('messagesWrap');
    if (wrap) {
        wrap.innerHTML = `
            <div class="welcome-card">
                <h2>Hello, <em>Traveller!</em> 👋</h2>
                <p>I'm your AI Travel Guide powered by Google Gemini. Ask me about <strong>any destination</strong> in the world — cities, temples, beaches, monuments, hill stations, food, transportation, and custom multi-day trip itineraries!</p>
                <div class="welcome-suggestions">
                    <span class="suggestion-chip" onclick="usePrompt('Plan a 3-day trip to Ooty')">🌄 3-day trip to Ooty</span>
                    <span class="suggestion-chip" onclick="usePrompt('Suggest best places to visit in Paris')">🗼 Paris Travel Guide</span>
                    <span class="suggestion-chip" onclick="usePrompt('Budget trip to Goa with food and hotels')">🏖 Goa on a Budget</span>
                    <span class="suggestion-chip" onclick="usePrompt('Tell me about Taj Mahal timings and entry fee')">🕌 Taj Mahal</span>
                </div>
            </div>
        `;
    }
    loadChatHistory();
}

/**
 * Clear all user chats
 */
async function clearAllChats() {
    if (!confirm('Clear all your chat history?')) return;
    try {
        await Api.post('/chat/clear', {});
        startNewChat();
        App.toast('All chat history cleared', 'info');
    } catch (err) {
        App.toast('Failed to clear chats', 'error');
    }
}

/**
 * Quick prompt filler
 */
function usePrompt(text) {
    const input = document.getElementById('messageInput');
    if (input) {
        input.value = text;
        input.focus();
        input.dispatchEvent(new Event('input'));
    }
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.remove('open');
}

/**
 * Copy message bubble text
 */
function copyBubble(id) {
    const bubble = document.getElementById(id);
    if (!bubble) return;
    navigator.clipboard.writeText(bubble.innerText);
    App.toast('Copied to clipboard!', 'success');
}

/**
 * Export chat transcript
 */
function exportChat() {
    const wrap = document.getElementById('messagesWrap');
    if (!wrap) return;

    let transcript = `Tourist Guide AI — Travel Chat Export\nGenerated: ${new Date().toLocaleString()}\n=====================================\n\n`;
    const rows = wrap.querySelectorAll('.msg-row');
    if (!rows.length) {
        App.toast('No conversation to export', 'info');
        return;
    }

    rows.forEach(r => {
        const isUser = r.classList.contains('user');
        const bubble = r.querySelector('.bubble');
        if (bubble) {
            transcript += `[${isUser ? 'You' : 'Tourist AI'}]\n${bubble.innerText}\n\n-------------------------------------\n\n`;
        }
    });

    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tourist-guide-chat-${Date.now()}.txt`;
    link.click();
    App.toast('Chat exported successfully!', 'success');
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
