package com.tourist.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourist.chatbot.model.ChatMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${gemini.model.name:gemini-2.5-flash}")
    private String modelName;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public GeminiService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(25))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    private static final String SYSTEM_INSTRUCTION = """
            You are an elite Global AI Travel Planner & Tourist Guide capable of providing immediate, highly practical, and comprehensive travel plans for ANY destination worldwide.

            CRITICAL DIRECTIVES:
            1. NEVER RESPOND WITH A QUESTIONNAIRE OR INTERROGATE THE USER!
               - DO NOT say "To help you I need more information: 1. When? 2. What budget? 3. How many days?".
               - ALWAYS provide a concrete, comprehensive, and helpful answer RIGHT AWAY.
               - If details like specific budget or duration are not mentioned, assume the most common, popular defaults (e.g. 2-3 days, popular train/bus transit, moderate budget) and present the complete plan immediately.
            2. FULL CONVERSATION MEMORY:
               - You MUST maintain context from all prior messages in the conversation.
               - If the user previously mentioned a destination (e.g. "Palani Murugan temple"), starting city ("Kochi"), or duration ("3 days"), synthesize all pieces seamlessly into the answer.
               - Never ask the user to repeat information they already gave in earlier messages.
            3. EXACT TRANSIT ROUTES, PROCESS & STEPS:
               - Specify exact travel modes: Trains (train names, classes like Sleeper vs 3AC/Chair Car), State & private buses (KSRTC, SETC, private Volvo), flights, and highway driving routes.
               - Detail the step-by-step process: Where to board, major junction changes, how to reach the final landmark from the railway station or bus stand (e.g. metro lines, autos, temple winch/ropeway, walking routes).
            4. DETAILED ESTIMATED BUDGET & COSTS:
               - Always provide a realistic, itemized budget in the local currency (₹ INR for Indian destinations, $ for USA, € for Europe, etc.):
                 * Travel & Transit (Round-trip options)
                 * Accommodation (Budget vs Mid-range per night)
                 * Food & Dining (Daily allowance & regional signature foods)
                 * Entry tickets, special darshan, activities
                 * Total Estimated Cost Summary table.
            5. STRUCTURED, READABLE FORMAT:
               - Organize with clear Markdown headers (##, ###), bold highlights, bullet points, and tables.
            """;

    /**
     * Generate content with conversation history
     */
    public String generateResponse(List<ChatMessage> history, String userPrompt) {
        String activeKey = resolveApiKey();
        if (activeKey == null || activeKey.trim().isEmpty()) {
            log.warn("Gemini API key is not configured.");
            return generateLocalFallback(userPrompt);
        }

        List<Map<String, Object>> contents = buildContentsList(history, userPrompt);
        String primaryModel = (modelName != null && !modelName.isEmpty()) ? modelName : "gemini-2.5-flash";

        try {
            return callGeminiApiWithContents(primaryModel, contents, activeKey);
        } catch (Exception e) {
            log.warn("Gemini API failed with model {}, trying fallback to gemini-2.5-flash-lite: {}", primaryModel, e.getMessage());
            try {
                return callGeminiApiWithContents("gemini-2.5-flash-lite", contents, activeKey);
            } catch (Exception fallbackEx) {
                log.warn("Fallback to gemini-2.5-flash-lite failed, trying gemini-flash-latest: {}", fallbackEx.getMessage());
                try {
                    return callGeminiApiWithContents("gemini-flash-latest", contents, activeKey);
                } catch (Exception finalEx) {
                    log.error("All Gemini API calls failed: {}", finalEx.getMessage());
                    return generateLocalFallback(userPrompt);
                }
            }
        }
    }

    private String resolveApiKey() {
        if (apiKey != null && !apiKey.trim().isEmpty()) {
            return apiKey.trim();
        }
        String sysProp = System.getProperty("GEMINI_API_KEY");
        if (sysProp != null && !sysProp.trim().isEmpty()) return sysProp.trim();

        String envVar = System.getenv("GEMINI_API_KEY");
        if (envVar != null && !envVar.trim().isEmpty()) return envVar.trim();

        String googleKey = System.getProperty("GOOGLE_API_KEY");
        if (googleKey != null && !googleKey.trim().isEmpty()) return googleKey.trim();

        googleKey = System.getenv("GOOGLE_API_KEY");
        if (googleKey != null && !googleKey.trim().isEmpty()) return googleKey.trim();

        for (String path : List.of(".env", "../.env", "../../.env", "backend/.env")) {
            java.io.File f = new java.io.File(path);
            if (f.exists() && f.isFile()) {
                try (java.io.BufferedReader r = new java.io.BufferedReader(new java.io.FileReader(f))) {
                    String line;
                    while ((line = r.readLine()) != null) {
                        line = line.trim();
                        if (line.startsWith("GEMINI_API_KEY=") || line.startsWith("GOOGLE_API_KEY=")) {
                            String k = line.split("=", 2)[1].trim().replace("\"", "").replace("'", "");
                            if (!k.isEmpty()) return k;
                        }
                    }
                } catch (Exception ignored) {}
            }
        }
        return null;
    }

    public String generateResponse(String userPrompt) {
        return generateResponse(Collections.emptyList(), userPrompt);
    }

    private List<Map<String, Object>> buildContentsList(List<ChatMessage> history, String userPrompt) {
        List<Map<String, Object>> contents = new ArrayList<>();

        if (history != null && !history.isEmpty()) {
            // Keep up to last 12 messages for rich multi-turn context
            int startIdx = Math.max(0, history.size() - 12);
            String lastRole = null;

            for (int i = startIdx; i < history.size(); i++) {
                ChatMessage msg = history.get(i);
                if (msg == null || msg.getContent() == null || msg.getContent().isBlank()) continue;

                // Avoid duplicating the user prompt if it was already saved as the last history item
                if (i == history.size() - 1 && "user".equalsIgnoreCase(msg.getRole()) && msg.getContent().trim().equals(userPrompt.trim())) {
                    continue;
                }

                String geminiRole = "user".equalsIgnoreCase(msg.getRole()) ? "user" : "model";

                if (geminiRole.equals(lastRole)) {
                    // Merge same consecutive roles to satisfy Gemini API alternating turns requirement
                    Map<String, Object> prev = contents.get(contents.size() - 1);
                    @SuppressWarnings("unchecked")
                    List<Map<String, Object>> parts = (List<Map<String, Object>>) prev.get("parts");
                    String prevText = (String) parts.get(0).get("text");
                    parts.set(0, Map.of("text", prevText + "\n" + msg.getContent()));
                } else {
                    contents.add(new HashMap<>(Map.of(
                            "role", geminiRole,
                            "parts", new ArrayList<>(List.of(Map.of("text", msg.getContent())))
                    )));
                    lastRole = geminiRole;
                }
            }
        }

        // Add the current user prompt as the final user turn
        if (contents.isEmpty() || !"user".equals(contents.get(contents.size() - 1).get("role"))) {
            contents.add(Map.of(
                    "role", "user",
                    "parts", List.of(Map.of("text", userPrompt))
            ));
        } else {
            Map<String, Object> prev = contents.get(contents.size() - 1);
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> parts = (List<Map<String, Object>>) prev.get("parts");
            String prevText = (String) parts.get(0).get("text");
            if (!prevText.trim().equals(userPrompt.trim())) {
                parts.set(0, Map.of("text", prevText + "\n" + userPrompt));
            }
        }

        return contents;
    }

    private String callGeminiApiWithContents(String model, List<Map<String, Object>> contents, String activeKey) throws Exception {
        String endpoint = String.format(GEMINI_API_URL, model, activeKey.trim());

        Map<String, Object> requestBody = new HashMap<>();

        // System instruction
        Map<String, Object> systemPart = Map.of("text", SYSTEM_INSTRUCTION);
        requestBody.put("system_instruction", Map.of("parts", List.of(systemPart)));

        // Multi-turn contents
        requestBody.put("contents", contents);

        // Generation config
        requestBody.put("generationConfig", Map.of(
                "temperature", 0.35,
                "topP", 0.95,
                "maxOutputTokens", 3500
        ));

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(60))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API (" + model + ") returned status " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                return parts.get(0).path("text").asText();
            }
        }

        throw new RuntimeException("No text candidate returned by Gemini API (" + model + ").");
    }

    /**
     * Fallback travel guide when AI service is unavailable or rate-limited
     */
    private String generateLocalFallback(String query) {
        return """
                ### 🌍 Global Travel Assistant Recommendation
                I noticed you're exploring **""" + query + """
                **!

                Here are general travel planning essentials:
                * **Best Time to Visit:** Check seasonal weather patterns and local festival dates before booking.
                * **Transportation:** Compare direct express trains, flights, or intercity state buses for the most cost-effective transit.
                * **Accommodation:** Choose central locations near transit hubs for convenience, or nature resorts on outskirts for quiet stays.
                * **Budgeting Tip:** Allocate roughly 35% for stay, 25% for transit, 25% for dining & activities, and 15% for miscellaneous expenses.

                *(Note: For live real-time AI itineraries, ensure GEMINI_API_KEY is configured in your backend environment).*
                """;
    }
}
