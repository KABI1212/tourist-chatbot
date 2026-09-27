package com.tourist.chatbot.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GeminiService {

    private static final Logger log = LoggerFactory.getLogger(GeminiService.class);
    private static final String GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent?key=%s";

    @Value("${gemini.api.key:}")
    private String apiKey;

    @Value("${gemini.model.name:gemini-2.5-flash-lite}")
    private String modelName;

    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public GeminiService() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .build();
        this.objectMapper = new ObjectMapper();
    }

    private static final String SYSTEM_INSTRUCTION = """
            You are a Global AI Travel Planner & Tourist Assistant capable of planning trips to ANY valid location worldwide.
            Your purpose is to help users discover destinations, plan entire trips, estimate budgets, find hidden gems, explore local culture, food, stays, and generate complete itineraries.

            CORE EXPERTISE TO COVER WHEN APPLICABLE:
            1. 📍 DESTINATION OVERVIEW: Name, Country, Continent, Best Time to Visit, Ideal Duration, Language, Currency.
            2. ⭐ TOP ATTRACTIONS & HIDDEN GEMS: Must-visit landmarks and lesser-known local spots.
            3. 🍛 FOOD & DINING: Famous dishes, local food streets, vegetarian & non-vegetarian recommendations, average food cost.
            4. 🚆 TRANSPORTATION: Flights, trains, buses, local cabs, rental bikes/cars, travel times, and cost estimates.
            5. 🏨 ACCOMMODATION: Budget stays, mid-range hotels, luxury resorts, price ranges.
            6. 💰 ESTIMATED BUDGET: Itemized breakdown (Travel, Stay, Food, Activities, Contingency) with Total Estimated Cost.
            7. 📅 MULTI-DAY ITINERARY: Day 1, Day 2, Day 3... with morning, afternoon, evening activities, meals, and transport.
            8. ⚠ TRAVEL & SAFETY TIPS: Local customs, safety precautions, emergency contacts, best seasons to visit.

            RULES:
            - Provide structured, practical travel advice with markdown formatting.
            - Never invent fake booking prices; state reasonable approximate ranges.
            - If asking to plan a trip (e.g. 'Plan a 3-day trip to Ooty'), provide a comprehensive day-by-day plan.
            """;

    /**
     * Generate content from Google Gemini API
     */
    public String generateResponse(String userPrompt) {
        if (apiKey == null || apiKey.trim().isEmpty()) {
            log.warn("Gemini API key is not configured.");
            return generateLocalFallback(userPrompt);
        }

        try {
            String primaryModel = (modelName != null && !modelName.isEmpty()) ? modelName : "gemini-2.5-flash-lite";
            return callGeminiApi(primaryModel, userPrompt);
        } catch (Exception e) {
            log.warn("Gemini API failed with model {}, trying fallback to gemini-1.5-flash: {}", modelName, e.getMessage());
            try {
                return callGeminiApi("gemini-1.5-flash", userPrompt);
            } catch (Exception fallbackEx) {
                log.error("All Gemini API calls failed: {}", fallbackEx.getMessage());
                return generateLocalFallback(userPrompt);
            }
        }
    }

    private String callGeminiApi(String model, String userPrompt) throws Exception {
        String endpoint = String.format(GEMINI_API_URL, model, apiKey.trim());

        Map<String, Object> requestBody = new HashMap<>();

        // System instruction
        Map<String, Object> systemPart = Map.of("text", SYSTEM_INSTRUCTION);
        requestBody.put("system_instruction", Map.of("parts", List.of(systemPart)));

        // User content
        Map<String, Object> userPart = Map.of("text", userPrompt);
        Map<String, Object> contentObj = Map.of("role", "user", "parts", List.of(userPart));
        requestBody.put("contents", List.of(contentObj));

        // Generation config
        requestBody.put("generationConfig", Map.of(
                "temperature", 0.4,
                "topP", 0.95,
                "maxOutputTokens", 8192
        ));

        String jsonPayload = objectMapper.writeValueAsString(requestBody);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(endpoint))
                .header("Content-Type", "application/json")
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API returned status " + response.statusCode() + ": " + response.body());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode parts = candidates.get(0).path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                return parts.get(0).path("text").asText();
            }
        }

        throw new RuntimeException("No content returned in Gemini candidates response.");
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
