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

        // 3. Destination detection with Conversation Memory
        // Check current message first
        Optional<Destination> matchedDest = destinationMatcher.find(message);
        if (matchedDest.isEmpty()) {
            matchedDest = detectGlobalDestination(message);
        }

        // If not in current message, resolve previous destination from conversation history for follow-ups
        if (matchedDest.isEmpty() && !conversationHistory.isEmpty()) {
            matchedDest = resolvePreviousDestinationFromHistory(conversationHistory);
        }

        // 4. Intent Detection & Factual Grounding (Weather, Nearby, Transit, Budget, Itinerary)
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

        // Intent C: Transit / Route detection (even across cities)
        if (message.matches("(?i).*\\b(how to reach|how can i go|how do i get|train|bus|flight|route|directions|drive)\\b.*")) {
            java.util.regex.Matcher m = java.util.regex.Pattern.compile("(?i)\\bfrom\\s+([A-Za-z]+(?:\\s+[A-Za-z]+)?)\\b").matcher(message);
            String origin = m.find() ? m.group(1).trim() : null;
            if (origin != null && matchedDest.isPresent()) {
                contextBuilder.append(String.format("[Transit Direction Directive: Origin is %s, Destination is %s. Detail actual train names/lines, bus options, and road driving route.]\n", origin, matchedDest.get().getName()));
            }
        }

        // Intent D: Budget Modification ("make it cheaper", "budget kammi pannu")
        if (message.matches("(?i).*\\b(cheaper|kammi|budget kammi|low budget|reduce budget|too expensive|less money|cut cost)\\b.*")) {
            contextBuilder.append("[Budget Optimization Directive: The user wants to optimize the previously discussed itinerary to be more economical. Suggest budget sleeper trains/state transport buses, affordable hostels/homestays, authentic regional street food, and free sights while retaining key experiences.]\n");
        }

        // Intent E: Specific Itinerary Modification ("change day 2", "remove museums")
        if (message.matches("(?i).*\\b(change day|skip|remove|instead of|replace day|swap)\\b.*")) {
            contextBuilder.append("[Itinerary Adjustment Directive: Update the specific day or activity requested by the user, keeping the remainder of the schedule intact and coherent.]\n");
        }

        String promptWithContext = contextBuilder.length() > 0
                ? contextBuilder.toString() + "\nUser Query: " + message
                : message;

        // 5. Generate AI response from Google Gemini with full conversation context and requested language
        String aiResponseText = (request.getLanguage() != null && !request.getLanguage().isBlank())
                ? geminiService.generateResponse(conversationHistory, promptWithContext, request.getLanguage())
                : geminiService.generateResponse(conversationHistory, promptWithContext);

        // Fallback match against AI reply if initial lookup found nothing
        if (matchedDest.isEmpty()) {
            matchedDest = destinationMatcher.find(aiResponseText);
        }

        // 6. Persist Assistant Message if authenticated
        if (chat != null && userId != null) {
            ChatMessage botMsg = ChatMessage.builder()
                    .chatId(chat.getId())
                    .userId(userId)
                    .role("assistant")
                    .content(aiResponseText)
                    .source(matchedDest.isPresent() ? "destination" : "gemini")
                    .metadata(matchedDest.isPresent() ? Map.of("destinationName", matchedDest.get().getName()) : null)
                    .build();
            chatMessageRepository.save(botMsg);
        }

        return ChatResponse.builder()
                .success(true)
                .chatId(chat != null ? chat.getId() : (request.getChatId() != null ? request.getChatId() : "guest-chat"))
                .response(aiResponseText)
                .source(matchedDest.isPresent() ? "destination" : "gemini")
                .destination(matchedDest.orElse(null))
                .build();
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

        // Strip common conversational queries to isolate place name
        String cleaned = message.replaceAll("(?i)\\b(tell me (everything )?about|how to reach|what can i do in|places (to visit )?in|trip to|guide for|plan a trip to|visiting|waterfalls near|temples near|best places in|hotels in|food in)\\b", "").trim();
        cleaned = cleaned.replaceAll("[?!.,\"]", "").trim();

        // Skip non-destination conversational, planning, budget, or linguistic commands
        if (cleaned.matches("(?i)^(hi|hello|hey|namaste|vanakkam|thanks|thank you|ok|okay|yes|no|" +
                "plan(\\s+for)?.*|make it .*|cheaper|kammi.*|low budget.*|change.*|remove.*|swap.*|" +
                "increase.*|decrease.*|tamil.*|english.*|tanglish.*|how are you|what can you do|" +
                "what if .*|suggest another.*|another option.*|answer in .*|budget .*).*")) {
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
