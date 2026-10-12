package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.ChatRequest;
import com.tourist.chatbot.dto.ChatResponse;
import com.tourist.chatbot.dto.PlaceSearchResult;
import com.tourist.chatbot.model.Chat;
import com.tourist.chatbot.model.ChatMessage;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.ChatMessageRepository;
import com.tourist.chatbot.repository.ChatRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class ChatService {

    private static final Logger log = LoggerFactory.getLogger(ChatService.class);

    private final ChatRepository chatRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final GeminiService geminiService;
    private final UserService userService;
    private final DestinationMatcher destinationMatcher;
    private final PlacesProviderService placesProviderService;

    public ChatResponse processMessage(ChatRequest request, String username) {
        User user = (username != null && !username.isBlank()) ? userService.getUserByUsername(username) : null;
        String userId = user != null ? user.getId() : null;
        String message = request.getMessage().trim();

        // 1. Get or create Chat session if authenticated
        Chat chat = null;
        List<ChatMessage> conversationHistory = new ArrayList<>();
        if (userId != null) {
            if (request.getChatId() != null && !request.getChatId().trim().isEmpty()) {
                chat = chatRepository.findById(request.getChatId())
                        .filter(c -> c.getUserId().equals(userId))
                        .orElseGet(() -> createNewChat(userId, message));
            } else {
                chat = createNewChat(userId, message);
            }

            // 2. Persist User Message
            ChatMessage userMsg = ChatMessage.builder()
                    .chatId(chat.getId())
                    .userId(userId)
                    .role("user")
                    .content(message)
                    .source("user")
                    .build();
            chatMessageRepository.save(userMsg);

            // Fetch conversation history for full multi-turn context
            conversationHistory = chatMessageRepository.findByChatId(chat.getId(), Sort.by(Sort.Direction.ASC, "timestamp"));
        } else {
            // Guest mode: load conversation history from request if provided
            if (request.getHistory() != null && !request.getHistory().isEmpty()) {
                for (Map<String, String> h : request.getHistory()) {
                    String role = h.getOrDefault("role", "user");
                    String content = h.getOrDefault("content", "");
                    if (!content.isBlank()) {
                        conversationHistory.add(ChatMessage.builder()
                                .role(role)
                                .content(content)
                                .build());
                    }
                }
            }
        }

        // 3. Multilingual Language Resolution
        String effectiveLanguage = determineEffectiveLanguage(message, request.getLanguage(), conversationHistory);

        // 4. Origin & Target Destination detection with Conversation Memory
        String origin = extractOrigin(message);

        // Check target message (stripping origin phrase if needed so origin is not picked as target destination)
        String messageForDestMatching = message;
        if (origin != null) {
            messageForDestMatching = message.replaceFirst("(?i)(?U)\\b" + java.util.regex.Pattern.quote(origin) + "\\b.*?(?:la\\s+irundhu|lerundhu|lendhu|lirundhu|se|யிலிருந்து|லிருந்து|\\s+இருந்து)\\s*", " ");
        }

        Optional<Destination> matchedDest = destinationMatcher.find(messageForDestMatching);
        if (matchedDest.isEmpty() && origin != null) {
            matchedDest = destinationMatcher.find(message);
            // If it matched the origin city itself, ignore it unless no other destination is found
            if (matchedDest.isPresent() && matchedDest.get().getName().equalsIgnoreCase(origin)) {
                matchedDest = Optional.empty();
            }
        }
        if (matchedDest.isEmpty()) {
            matchedDest = detectGlobalDestination(messageForDestMatching);
        }

        // If not in current message, resolve previous destination from conversation history for follow-ups
        if (matchedDest.isEmpty() && !conversationHistory.isEmpty()) {
            matchedDest = resolvePreviousDestinationFromHistory(conversationHistory);
        }

        // 5. Intent Detection & Factual Grounding (Weather, Nearby, Transit, Budget, Itinerary)
        StringBuilder contextBuilder = new StringBuilder();

        if (matchedDest.isPresent()) {
            Destination d = matchedDest.get();
            contextBuilder.append(String.format(java.util.Locale.US,
                    "[Factual Destination Context: %s in %s (Coordinates: %.4f, %.4f). Highlights: %s. Best Time: %s]\n",
                    d.getName(),
                    d.getCountry() != null ? d.getCountry() : "Worldwide",
                    d.getLatitude() != null ? d.getLatitude() : 0.0,
                    d.getLongitude() != null ? d.getLongitude() : 0.0,
                    d.getFamousFor() != null ? d.getFamousFor() : d.getDescription(),
                    d.getBestTime() != null ? d.getBestTime() : "Year-round"
            ));

            // Intent A: Live Weather lookup
            if (message.matches("(?i).*\\b(weather|temperature|climate|rain|forecast|hot|cold|degree)\\b.*") && d.getLatitude() != null && d.getLongitude() != null) {
                try {
                    Map<String, Object> weather = placesProviderService.getLiveWeather(d.getLatitude(), d.getLongitude());
                    contextBuilder.append(String.format(java.util.Locale.US,
                            "[Real-Time Live Weather Data for %s: %s, %s, wind speed: %s. State these actual live conditions clearly.]\n",
                            d.getName(), weather.get("temperature"), weather.get("condition"), weather.get("windSpeed")
                    ));
                } catch (Exception e) {
                    log.debug("Live weather fetch skipped: {}", e.getMessage());
                }
            }

            // Intent B: Nearby Attractions lookup
            if (message.matches("(?i).*\\b(nearby|around (there|it)|places near|waterfalls near|temples near|surrounding)\\b.*") && d.getLatitude() != null && d.getLongitude() != null) {
                try {
                    List<com.tourist.chatbot.dto.NearbyPlace> nearby = placesProviderService.getNearbyAttractions(d.getLatitude(), d.getLongitude(), 10000, 5);
                    if (!nearby.isEmpty()) {
                        StringBuilder nbStr = new StringBuilder();
                        for (com.tourist.chatbot.dto.NearbyPlace np : nearby) {
                            nbStr.append(String.format(java.util.Locale.US, "%s (%.1f km away), ", np.getName(), np.getDistanceKm()));
                        }
                        contextBuilder.append(String.format("[Verified Regional Nearby Attractions: %s]\n", nbStr));
                    }
                } catch (Exception e) {
                    log.debug("Nearby places fetch skipped: {}", e.getMessage());
                }
            }
        }

        // Intent C: Transit / Route detection (multilingual: English, Tanglish, Hinglish, Tamil, Hindi)
        boolean hasTransitQuery = message.matches("(?i)(?U).*\\b(how to reach|how can i go|how do i get|train|bus|flight|route|directions|drive|transit|pogalam|poradhu|kaise jaye|kaise jaa sakte|pahunche|எப்படி போவது|வழி|செல்லலாம்|பயணம்|पहुंचें|जाएं)\\b.*")
                || origin != null;

        if (hasTransitQuery && origin != null && matchedDest.isPresent()) {
            contextBuilder.append(String.format(
                    "[Transit & Route Direction Directive: Origin is %s, Target Destination is %s. Detail actual train names/lines, state/private bus options, travel time estimates, and driving road directions.]\n",
                    origin, matchedDest.get().getName()
            ));
        }

        // Itinerary duration extraction (e.g. "3 days trip", "3 naal", "3 din")
        java.util.regex.Matcher durMatcher = java.util.regex.Pattern.compile("(?i)(?U)\\b(\\d+)\\s*(?:days?|naal|naatkal|din|jours|días|tage)\\b").matcher(message);
        if (durMatcher.find()) {
            String days = durMatcher.group(1);
            String destName = matchedDest.isPresent() ? matchedDest.get().getName() : "the destination";
            contextBuilder.append(String.format(
                    "[Trip Itinerary Directive: User requested a %s-day trip plan for %s%s. Provide a clear day-by-day travel breakdown with morning, afternoon, and evening recommendations.]\n",
                    days, destName, origin != null ? (" originating from " + origin) : ""
            ));
        }

        // Intent D: Budget Modification ("make it cheaper", "budget konjam kammi pannu", "kam karo", "सस्ता")
        if (message.matches("(?i)(?U).*\\b(cheaper|kammi|kamti|budget kammi|low budget|reduce budget|too expensive|less money|cut cost|kam karo|sasta|कम बजट|सस्ता|பட்ஜெட் கம்மி|குறைக்க|குறைவான பட்ஜெட்|செலவு குறைக்க|moins cher|más barato|günstiger)\\b.*")) {
            contextBuilder.append("[Budget Optimization Directive: The user wants to optimize the previously discussed itinerary to be more economical. Suggest budget sleeper trains/state transport buses, affordable hostels/homestays, authentic regional street food, and free sights while retaining key experiences.]\n");
        }

        // Intent E: Specific Itinerary Modification ("change day 2", "remove museums")
        if (message.matches("(?i).*\\b(change day|skip|remove|instead of|replace day|swap)\\b.*")) {
            contextBuilder.append("[Itinerary Adjustment Directive: Update the specific day or activity requested by the user, keeping the remainder of the schedule intact and coherent.]\n");
        }

        String promptWithContext = contextBuilder.length() > 0
                ? contextBuilder.toString() + "\nUser Query: " + message
                : message;

        // 6. Generate AI response from Google Gemini with full conversation context and requested effective language
        String aiResponseText = geminiService.generateResponse(conversationHistory, promptWithContext, effectiveLanguage);

        // Fallback match against AI reply if initial lookup found nothing
        if (matchedDest.isEmpty()) {
            matchedDest = destinationMatcher.find(aiResponseText);
        }

        // Metadata map with resolved language and destination
        Map<String, Object> responseMetadata = new java.util.HashMap<>();
        responseMetadata.put("language", effectiveLanguage);
        if (matchedDest.isPresent()) {
            responseMetadata.put("destinationName", matchedDest.get().getName());
        }

        // 7. Persist Assistant Message if authenticated
        if (chat != null && userId != null) {
            ChatMessage botMsg = ChatMessage.builder()
                    .chatId(chat.getId())
                    .userId(userId)
                    .role("assistant")
                    .content(aiResponseText)
                    .source(matchedDest.isPresent() ? "destination" : "gemini")
                    .metadata(responseMetadata)
                    .build();
            chatMessageRepository.save(botMsg);
        }

        return ChatResponse.builder()
                .success(true)
                .chatId(chat != null ? chat.getId() : (request.getChatId() != null ? request.getChatId() : "guest-chat"))
                .response(aiResponseText)
                .source(matchedDest.isPresent() ? "destination" : "gemini")
                .destination(matchedDest.orElse(null))
                .metadata(responseMetadata)
                .build();
    }

    public String determineEffectiveLanguage(String message, String requestedLang, List<ChatMessage> history) {
        if (message == null) message = "";

        // 1. Explicit language switch command in current message (e.g. "Reply in Tamil", "Speak in French")
        String commandLang = detectLanguageSwitchCommand(message);
        if (commandLang != null) {
            return commandLang;
        }

        // 2. Explicit requested language from client selector (if not "auto" or empty)
        if (requestedLang != null && !requestedLang.isBlank() && !"auto".equalsIgnoreCase(requestedLang) && !"all".equalsIgnoreCase(requestedLang)) {
            return requestedLang.toLowerCase().trim();
        }

        // 3. Detect by Unicode script ranges in current message
        String scriptLang = detectScriptLanguage(message);
        if (scriptLang != null) {
            return scriptLang;
        }

        // 4. Detect by colloquial / dialect keywords (Tanglish, Hinglish, French, Spanish, German)
        String dialectLang = detectDialectLanguage(message);
        if (dialectLang != null) {
            return dialectLang;
        }

        // 5. If follow-up or ambiguous query, check conversation history backwards to preserve language
        if (history != null && !history.isEmpty()) {
            for (int i = history.size() - 1; i >= 0; i--) {
                ChatMessage m = history.get(i);
                if (m == null) continue;
                if (m.getMetadata() != null && m.getMetadata().containsKey("language")) {
                    String prevLang = (String) m.getMetadata().get("language");
                    if (prevLang != null && !prevLang.isBlank() && !"auto".equalsIgnoreCase(prevLang)) {
                        return prevLang;
                    }
                }
                if ("user".equalsIgnoreCase(m.getRole()) && m.getContent() != null) {
                    String prevScript = detectScriptLanguage(m.getContent());
                    if (prevScript != null) return prevScript;
                    String prevDialect = detectDialectLanguage(m.getContent());
                    if (prevDialect != null) return prevDialect;
                }
            }
        }

        // Default to English
        return "en";
    }

    private String detectLanguageSwitchCommand(String text) {
        String lower = text.toLowerCase().trim();

        var m = java.util.regex.Pattern.compile("(?i)\\b(?:reply|answer|speak|respond|talk|write|translate|switch)\\s+(?:in|into|to)\\s+([a-zA-Z]+)\\b").matcher(lower);
        if (m.find()) {
            String target = m.group(1).trim().toLowerCase();
            String code = mapLanguageNameToCode(target);
            if (code != null) return code;
        }

        if (lower.contains("தமிழில்") || lower.contains("தமிள்") || lower.contains("tamil la") || lower.contains("tanglish")) return "ta";
        if (lower.contains("हिंदी में") || lower.contains("हिन्दी में") || lower.contains("hindi me") || lower.contains("hinglish")) return "hi";
        if (lower.contains("తెలుగులో")) return "te";
        if (lower.contains("മലയാളത്തിൽ")) return "ml";
        if (lower.contains("ಕನ್ನಡದಲ್ಲಿ")) return "kn";
        if (lower.contains("বাংলায়")) return "bn";
        if (lower.contains("en français") || lower.contains("en francais")) return "fr";
        if (lower.contains("en español") || lower.contains("en espanol")) return "es";
        if (lower.contains("auf deutsch")) return "de";

        return null;
    }

    private String mapLanguageNameToCode(String name) {
        switch (name.toLowerCase()) {
            case "tamil": return "ta";
            case "hindi": return "hi";
            case "telugu": return "te";
            case "malayalam": return "ml";
            case "kannada": return "kn";
            case "bengali": return "bn";
            case "marathi": return "mr";
            case "gujarati": return "gu";
            case "punjabi": return "pa";
            case "urdu": return "ur";
            case "odia": case "oriya": return "or";
            case "assamese": return "as";
            case "french": case "francais": return "fr";
            case "spanish": case "espanol": return "es";
            case "german": case "deutsch": return "de";
            case "italian": case "italiano": return "it";
            case "portuguese": case "portugues": return "pt";
            case "arabic": return "ar";
            case "chinese": case "mandarin": return "zh";
            case "japanese": return "ja";
            case "korean": return "ko";
            case "russian": return "ru";
            case "indonesian": case "bahasa": return "id";
            case "thai": return "th";
            case "vietnamese": return "vi";
            case "english": return "en";
            default: return null;
        }
    }

    private String detectScriptLanguage(String text) {
        if (text == null || text.isBlank()) return null;
        for (int i = 0; i < text.length(); ) {
            int cp = text.codePointAt(i);
            if (cp >= 0x0B80 && cp <= 0x0BFF) return "ta";
            if (cp >= 0x0C00 && cp <= 0x0C7F) return "te";
            if (cp >= 0x0D00 && cp <= 0x0D7F) return "ml";
            if (cp >= 0x0C80 && cp <= 0x0CFF) return "kn";
            if (cp >= 0x0980 && cp <= 0x09FF) return "bn";
            if (cp >= 0x0A80 && cp <= 0x0AFF) return "gu";
            if (cp >= 0x0A00 && cp <= 0x0A7F) return "pa";
            if (cp >= 0x0B00 && cp <= 0x0B7F) return "or";
            if (cp >= 0x0900 && cp <= 0x097F) return "hi";
            if ((cp >= 0x0600 && cp <= 0x06FF) || (cp >= 0xFB50 && cp <= 0xFDFF)) {
                if (text.matches(".*[ٹڈڑےںہ].*")) return "ur";
                return "ar";
            }
            if (cp >= 0x4E00 && cp <= 0x9FFF) return "zh";
            if ((cp >= 0x3040 && cp <= 0x309F) || (cp >= 0x30A0 && cp <= 0x30FF)) return "ja";
            if (cp >= 0xAC00 && cp <= 0xD7AF) return "ko";
            if (cp >= 0x0400 && cp <= 0x04FF) return "ru";
            if (cp >= 0x0E00 && cp <= 0x0E7F) return "th";
            i += Character.charCount(cp);
        }
        return null;
    }

    private String detectDialectLanguage(String text) {
        String lower = text.toLowerCase();

        // Tanglish heuristics
        if (lower.matches("(?i).*\\b(pathi|sollu|sollunga|irundhu|lerundhu|lendhu|lirundhu|pannu|pannunga|theriyuma|vanakkam|konjam|kammi|kamti|nalla|polaam|polam|enna|eppadi|epdi|inga|enga|romba|machan|bro|thambi|kooda|paakalaam|iruku|irukku|edhuvum|venum|poga|neram|kudunga|thanga|vaanga|ooru)\\b.*")) {
            return "ta";
        }

        // Hinglish heuristics
        if (lower.matches("(?i).*\\b(kaise|batao|bataiye|jaa sakte|ja sakte|kya|hai|hain|karo|karna|kahan|kitna|kitne|chahiye|chalna|jaana|bhi|aur|accha|achha|ghumne|jagah|raasta|paas|dikhaye|chalo|bhai|mujhe|humko)\\b.*")) {
            return "hi";
        }

        // French
        if (lower.matches("(?i).*\\b(bonjour|merci|comment aller|voyage|visiter|je veux|quel est|s'il vous plaît|pourquoi)\\b.*")) {
            return "fr";
        }

        // Spanish
        if (lower.matches("(?i).*\\b(hola|gracias|cómo llegar|como llegar|viaje|visitar|quiero|cuál es|por favor|dónde está)\\b.*")) {
            return "es";
        }

        // German
        if (lower.matches("(?i).*\\b(hallo|danke|wie komme|reise|besuchen|ich möchte|wo ist|bitte)\\b.*")) {
            return "de";
        }

        return null;
    }

    private String extractOrigin(String message) {
        if (message == null || message.isBlank()) return null;

        // Tanglish: "Chennai la irundhu", "Chennai lerundhu", "Chennai lendhu"
        var mTanglish = java.util.regex.Pattern.compile("(?i)(?U)\\b([\\p{L}]+)\\s*(?:la\\s+irundhu|lerundhu|lendhu|lirundhu)\\b").matcher(message);
        if (mTanglish.find()) return mTanglish.group(1).trim();

        // Hinglish/Hindi: "Chennai se", "Delhi se"
        var mHinglish = java.util.regex.Pattern.compile("(?i)(?U)\\b([\\p{L}]+)\\s+se\\b").matcher(message);
        if (mHinglish.find()) {
            String word = mHinglish.group(1).trim();
            if (!word.matches("(?i)^(kaise|dhyan|jaldi|aaram|mujh|aap)$")) {
                return word;
            }
        }

        // English: "from Chennai", "departing from Bangalore"
        var mEn = java.util.regex.Pattern.compile("(?i)(?U)\\b(?:from|departing from|leaving from)\\s+([\\p{L}]+(?:\\s+[\\p{L}]+)?)\\b").matcher(message);
        if (mEn.find()) return mEn.group(1).trim();

        // Tamil script: "சென்னையிலிருந்து"
        var mTa = java.util.regex.Pattern.compile("(?U)\\b([\\p{L}]+)(?:யிலிருந்து|லிருந்து|\\s+இருந்து)\\b").matcher(message);
        if (mTa.find()) return mTa.group(1).trim();

        return null;
    }

    private Optional<Destination> resolvePreviousDestinationFromHistory(List<ChatMessage> history) {
        if (history == null || history.isEmpty()) return Optional.empty();

        // Scan backwards from newest to oldest
        for (int i = history.size() - 1; i >= 0; i--) {
            ChatMessage msg = history.get(i);
            if (msg == null) continue;

            if (msg.getMetadata() != null && msg.getMetadata().containsKey("destinationName")) {
                String name = (String) msg.getMetadata().get("destinationName");
                if (name != null && !name.isBlank()) {
                    Optional<Destination> d = destinationMatcher.find(name);
                    if (d.isPresent()) return d;
                    Destination globalD = placesProviderService.getGlobalPlaceDetails(name, null, null);
                    if (globalD != null) return Optional.of(globalD);
                }
            }

            // Check message content
            if (msg.getContent() != null && !msg.getContent().isBlank()) {
                Optional<Destination> d = destinationMatcher.find(msg.getContent());
                if (d.isPresent()) return d;
                Optional<Destination> global = detectGlobalDestination(msg.getContent());
                if (global.isPresent()) return global;
            }
        }
        return Optional.empty();
    }

    private Optional<Destination> detectGlobalDestination(String message) {
        if (message == null || message.isBlank() || placesProviderService == null) {
            return Optional.empty();
        }

        // Strip common conversational queries in English, Tamil, Hindi, Tanglish, etc. to isolate place name
        String cleaned = message.replaceAll("(?i)(?U)\\b(" +
                "tell me (everything )?about|how to reach|what can i do in|places (to visit )?in|trip to|guide for|plan a trip to|visiting|waterfalls near|temples near|best places in|hotels in|food in|" +
                "பற்றி சொல்லு|பத்தி சொல்லு|பற்றி சொல்|பற்றி கூறு|பற்றி|பத்தி|எப்படி போவது|சுற்றுலா|இடங்கள்|பயணம்|போகலாம்|போவது எப்படி|" +
                "के बारे में बताओ|के बारे में बताइए|के बारे में|कैसे जाएं|कैसे जा सकते हैं|घूमने की जगह|यात्रा|टूर|" +
                "pathi sollunga|pathi sollu|ku eppadi pogalam|ku epdi poradhu|trip plan pannu|plan pannu|bro|thambi|" +
                "ke baare me batao|kaise jaye|kaise jaa sakte hain|ghumne ki jagah|ka plan batao|" +
                "parle-moi de|comment aller à|cuéntame sobre|cómo llegar a|erzähl mir von|wie komme ich nach" +
                ")\\b", "").trim();
        cleaned = cleaned.replaceAll("[?!.,\"'’]", "").trim();

        // Skip non-destination conversational, planning, budget, or linguistic commands
        if (cleaned.matches("(?i)^(hi|hello|hey|namaste|vanakkam|thanks|thank you|ok|okay|yes|no|" +
                "plan(\\s+for)?.*|make it .*|cheaper|kammi.*|low budget.*|change.*|remove.*|swap.*|" +
                "increase.*|decrease.*|tamil.*|english.*|tanglish.*|how are you|what can you do|" +
                "what if .*|suggest another.*|another option.*|answer in .*|budget .*).*")
                || cleaned.matches("(?i).*(?:\\d+\\s*(?:days?|naal|din)|\\bunder\\s*\\d+|\\b\\d+k\\b|\\bbudget\\b).*")) {
            return Optional.empty();
        }

        if (cleaned.length() >= 3 && cleaned.length() <= 60) {
            try {
                List<PlaceSearchResult> results = placesProviderService.autocomplete(cleaned, 1);
                if (!results.isEmpty()) {
                    PlaceSearchResult top = results.get(0);
                    if (cleaned.toLowerCase().contains(top.getName().toLowerCase()) || top.getName().toLowerCase().contains(cleaned.toLowerCase())) {
                        Destination dest = placesProviderService.getGlobalPlaceDetails(top.getName(), top.getLatitude(), top.getLongitude());
                        return Optional.ofNullable(dest);
                    }
                }
            } catch (Exception e) {
                log.debug("Global destination detection skipped for '{}': {}", cleaned, e.getMessage());
            }
        }
        return Optional.empty();
    }

    private Chat createNewChat(String userId, String firstMessage) {
        String title = firstMessage.length() > 30 ? firstMessage.substring(0, 30) + "..." : firstMessage;
        Chat chat = Chat.builder()
                .userId(userId)
                .title(title)
                .build();
        return chatRepository.save(chat);
    }

    public List<Chat> getUserChatHistory(String username) {
        User user = userService.getUserByUsername(username);
        return chatRepository.findByUserId(user.getId(), Sort.by(Sort.Direction.DESC, "updatedAt"));
    }

    public Map<String, Object> getChatDetails(String chatId, String username) {
        User user = userService.getUserByUsername(username);
        Chat chat = chatRepository.findById(chatId)
                .filter(c -> c.getUserId().equals(user.getId()))
                .orElseThrow(() -> new com.tourist.chatbot.exception.ResourceNotFoundException("Conversation not found"));

        List<ChatMessage> messages = chatMessageRepository.findByChatId(chat.getId(), Sort.by(Sort.Direction.ASC, "timestamp"));
        Map<String, Object> response = new java.util.HashMap<>();
        response.put("chat", chat);
        response.put("messages", messages);
        return response;
    }

    public void deleteChat(String chatId, String username) {
        User user = userService.getUserByUsername(username);
        Chat chat = chatRepository.findById(chatId)
                .filter(c -> c.getUserId().equals(user.getId()))
                .orElseThrow(() -> new com.tourist.chatbot.exception.ResourceNotFoundException("Conversation not found"));

        chatMessageRepository.deleteByChatId(chat.getId());
        chatRepository.delete(chat);
    }

    public void clearAllChats(String username) {
        User user = userService.getUserByUsername(username);
        List<Chat> chats = chatRepository.findByUserId(user.getId(), Sort.by(Sort.Direction.DESC, "updatedAt"));
        for (Chat c : chats) {
            chatMessageRepository.deleteByChatId(c.getId());
            chatRepository.deleteById(c.getId());
        }
    }

    public void clearUserChatHistory(String username) {
        clearAllChats(username);
    }

    public Chat renameChat(String chatId, String newTitle, String username) {
        User user = userService.getUserByUsername(username);
        Chat chat = chatRepository.findById(chatId)
                .filter(c -> c.getUserId().equals(user.getId()))
                .orElseThrow(() -> new com.tourist.chatbot.exception.ResourceNotFoundException("Conversation not found"));

        if (newTitle != null && !newTitle.isBlank()) {
            chat.setTitle(newTitle.trim());
            return chatRepository.save(chat);
        }
        return chat;
    }
}
