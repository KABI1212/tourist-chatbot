// @ts-nocheck
/**
 * TouristAI — Voice Engine (Speech-to-Text & Text-to-Speech)
 * Supports all 26 languages via Web Speech API with native speechCode mappings,
 * compatible voice detection, missing voice fallback explanation, mic animations,
 * and sentence speech keep-alive for Chromium.
 */

const Voice = {
    recognition: null,
    isRecording: false,
    currentUtterance: null,
    activePlayButton: null,
    speechHeartbeat: null,

    initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            return null;
        }

        const recog = new SpeechRecognition();
        recog.continuous = false;
        recog.interimResults = true;
        recog.maxAlternatives = 1;

        recog.onstart = () => {
            this.isRecording = true;
            this.updateMicUI(true, 'Listening… speak now');
        };

        recog.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const input = document.getElementById('chatMessageInput');
            if (input) {
                const text = finalTranscript || interimTranscript;
                input.value = text;
                input.style.height = '38px';
                input.style.height = Math.min(input.scrollHeight, 140) + 'px';
            }
        };

        recog.onerror = (event) => {
            console.warn('Speech recognition error:', event.error);
            this.isRecording = false;
            let errMsg = 'Voice recognition error';
            if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                errMsg = 'Microphone permission denied. Please allow microphone access.';
            } else if (event.error === 'no-speech') {
                errMsg = 'No speech detected. Please try again.';
            }
            this.updateMicUI(false, errMsg);
            this.showVoiceToast(errMsg, 'warning');
        };

        recog.onend = () => {
            this.isRecording = false;
            this.updateMicUI(false);
            const input = document.getElementById('chatMessageInput');
            if (input && input.value.trim()) {
                input.focus();
            }
        };

        return recog;
    },

    toggleRecognition() {
        if (this.isRecording) {
            this.stopRecognition();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            this.showVoiceToast('Speech recognition is not supported in this browser. Please try Chrome or Edge.', 'warning');
            return;
        }

        if (!this.recognition) {
            this.recognition = this.initSpeechRecognition();
        }

        if (!this.recognition) return;

        // Resolve active language speech code (checking chat preference first)
        let langCode = 'en';
        if (typeof I18n !== 'undefined') {
            const chatLang = typeof I18n.getChatLanguage === 'function' ? I18n.getChatLanguage() : I18n.getCurrentLanguage();
            if (chatLang && chatLang !== 'auto') {
                langCode = chatLang;
            } else {
                langCode = 'auto';
            }
        }

        let speechCode = 'en-US';
        let langMeta = null;
        if (langCode !== 'auto' && typeof I18n !== 'undefined') {
            langMeta = I18n.getLanguageMeta(langCode);
            if (langMeta && langMeta.speechCode) speechCode = langMeta.speechCode;
        } else {
            speechCode = navigator.language || 'en-US';
        }

        this.recognition.lang = speechCode;

        try {
            this.recognition.start();
            const langLabel = langMeta ? (langMeta.nativeName || langMeta.name) : speechCode;
            this.updateMicUI(true, `Listening in ${langLabel}… speak now`);
        } catch (err) {
            console.warn('Failed to start speech recognition:', err);
            this.stopRecognition();
        }
    },

    stopRecognition() {
        if (this.recognition && this.isRecording) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }
        this.isRecording = false;
        this.updateMicUI(false);
    },

    updateMicUI(recording, tooltipText) {
        const btn = document.getElementById('voiceMicBtn');
        if (!btn) return;

        if (recording) {
            btn.classList.add('recording');
            btn.setAttribute('title', tooltipText || 'Listening… click to cancel');
            btn.innerHTML = '<i class="fas fa-stop"></i>';
        } else {
            btn.classList.remove('recording');
            btn.setAttribute('title', tooltipText || 'Speak your question');
            btn.innerHTML = '<i class="fas fa-microphone"></i>';
        }
    },

    // Text-to-Speech (TTS)
    cleanMarkdownForSpeech(text) {
        if (!text) return '';
        return text
            .replace(/```[\s\S]*?```/g, ' ') // Code blocks
            .replace(/`([^`]+)`/g, '$1') // Inline code
            .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
            .replace(/\*([^*]+)\*/g, '$1') // Italic
            .replace(/#{1,6}\s+/g, '') // Headings
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
            .replace(/[-*•]\s+/g, '') // List bullets
            .replace(/\|[^\n]+\|/g, '') // Table rows
            .replace(/[\u{1F300}-\u{1F9FF}]/gu, '') // Emojis
            .replace(/₹/g, 'Rupees ')
            .replace(/\$/g, 'Dollars ')
            .replace(/€/g, 'Euros ')
            .replace(/\s{2,}/g, ' ')
            .trim();
    },

    toggleSpeech(btn) {
        if (!('speechSynthesis' in window)) {
            this.showVoiceToast('Text-to-speech is not supported on this browser.', 'warning');
            return;
        }

        // If currently playing on this button, stop
        if (window.speechSynthesis.speaking && this.activePlayButton === btn) {
            this.stopSpeech();
            return;
        }

        // Stop any ongoing speech first
        this.stopSpeech();

        const bubble = btn.closest('.msg-bubble');
        if (!bubble) return;

        // Extract raw assistant text ONLY from .msg-text-content (excluding cards, actions, etc.)
        const textContainer = bubble.querySelector('.msg-text-content') || bubble;
        const clone = textContainer.cloneNode(true);
        // Ensure destination cards and action buttons are removed from clone
        clone.querySelectorAll('.chat-dest-preview-card, .msg-actions-row, button').forEach(el => el.remove());
        const fullText = this.cleanMarkdownForSpeech(clone.innerText);

        if (!fullText) return;

        // Resolve language code from bubble attribute, chat setting, or content detection
        let targetLang = bubble.dataset.lang;
        if (!targetLang || targetLang === 'auto') {
            if (typeof I18n !== 'undefined' && typeof I18n.getChatLanguage === 'function') {
                const pref = I18n.getChatLanguage();
                if (pref && pref !== 'auto') targetLang = pref;
            }
        }
        if (!targetLang || targetLang === 'auto') {
            targetLang = (typeof I18n !== 'undefined') ? I18n.detectLanguage(fullText) : 'en';
        }

        const meta = (typeof I18n !== 'undefined') ? I18n.getLanguageMeta(targetLang) : null;
        const speechCode = (meta && meta.speechCode) ? meta.speechCode : 'en-US';

        // Check available SpeechSynthesis voices for compatibility
        const voices = window.speechSynthesis.getVoices();
        let matchedVoice = null;

        if (voices && voices.length > 0) {
            // 1. Exact match (e.g. ta-IN, hi-IN, fr-FR)
            matchedVoice = voices.find(v => v.lang.toLowerCase() === speechCode.toLowerCase());
            // 2. Language prefix match (e.g. ta, hi, fr)
            if (!matchedVoice) {
                const prefix = speechCode.split('-')[0].toLowerCase();
                matchedVoice = voices.find(v => v.lang.toLowerCase().startsWith(prefix));
            }
            // 3. Fallback matching for regional language names
            if (!matchedVoice && meta && meta.name) {
                const n = meta.name.toLowerCase();
                matchedVoice = voices.find(v => v.name.toLowerCase().includes(n));
            }
        }

        // Requirement 4: Handle missing voices gracefully without mispronouncing native scripts in English
        if (targetLang !== 'en' && !matchedVoice) {
            const langName = meta ? (meta.nativeName || meta.name) : targetLang.toUpperCase();
            this.showVoiceToast(`Voice for ${langName} is not installed in your browser. Text response is available.`, 'warning');
            return;
        }

        // Prepare speech utterance
        const spokenSnippet = fullText.length > 600 ? fullText.substring(0, 600) + '...' : fullText;
        const utterance = new SpeechSynthesisUtterance(spokenSnippet);

        utterance.lang = speechCode;
        if (matchedVoice) {
            utterance.voice = matchedVoice;
        }

        utterance.onstart = () => {
            this.activePlayButton = btn;
            btn.classList.add('active');
            btn.innerHTML = '<i class="fas fa-stop"></i> Stop';

            // Chromium keep-alive heartbeat to prevent 15-second cutoff
            if (this.speechHeartbeat) clearInterval(this.speechHeartbeat);
            this.speechHeartbeat = setInterval(() => {
                if (window.speechSynthesis && window.speechSynthesis.speaking) {
                    window.speechSynthesis.pause();
                    window.speechSynthesis.resume();
                } else {
                    clearInterval(this.speechHeartbeat);
                }
            }, 10000);
        };

        utterance.onend = () => {
            this.stopSpeech();
        };

        utterance.onerror = (e) => {
            console.warn('TTS error:', e);
            this.stopSpeech();
        };

        this.currentUtterance = utterance;
        window.speechSynthesis.speak(utterance);
    },

    stopSpeech() {
        if (this.speechHeartbeat) {
            clearInterval(this.speechHeartbeat);
            this.speechHeartbeat = null;
        }
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
        }
        if (this.activePlayButton) {
            this.activePlayButton.classList.remove('active');
            this.activePlayButton.innerHTML = '<i class="fas fa-volume-up"></i> Listen';
            this.activePlayButton = null;
        }
        this.currentUtterance = null;
    },

    showVoiceToast(msg, type = 'info') {
        let toast = document.getElementById('voiceStatusToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'voiceStatusToast';
            toast.className = 'voice-status-toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = `voice-status-toast show ${type}`;
        setTimeout(() => {
            toast.className = 'voice-status-toast';
        }, 3600);
    }
};

// Initialize voice voices list
if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}
