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
     * Generate structured day-by-day itinerary JSON
     */
    public com.tourist.chatbot.dto.ItineraryResponse generateStructuredItinerary(com.tourist.chatbot.dto.ItineraryGenerateRequest request) {
        String dest = (request.getDestination() != null && !request.getDestination().isBlank()) ? request.getDestination().trim() : "Kerala";
        int days = request.getDays();
        if (days <= 0 && request.getStartDate() != null && request.getEndDate() != null) {
            try {
                java.time.LocalDate start = java.time.LocalDate.parse(request.getStartDate());
                java.time.LocalDate end = java.time.LocalDate.parse(request.getEndDate());
                long diff = java.time.temporal.ChronoUnit.DAYS.between(start, end);
                days = (int) Math.max(1, diff + 1);
            } catch (Exception ignored) {
                days = 5;
            }
        }
        if (days <= 0) days = 5;
        days = Math.min(days, 14); // sensible upper limit

        int travelers = request.getTravelers() > 0 ? request.getTravelers() : 2;
        String budgetTier = (request.getBudgetTier() != null && !request.getBudgetTier().isBlank()) ? request.getBudgetTier() : "Moderate";
        String currency = (request.getCurrency() != null && !request.getCurrency().isBlank()) ? request.getCurrency() : "INR";
        List<String> interests = (request.getInterests() != null && !request.getInterests().isEmpty()) ? request.getInterests() : List.of("Sightseeing", "Nature", "Food");

        String activeKey = resolveApiKey();
        if (activeKey != null && !activeKey.trim().isEmpty()) {
            String prompt = String.format("""
                    Generate a detailed, realistic travel itinerary for %s for %d days.
                    Details:
                    - Travelers: %d
                    - Budget Tier: %s (Currency: %s)
                    - Interests: %s
                    - Start Date: %s

                    Respond with ONLY a valid raw JSON object (no markdown code blocks, no ```json, just raw JSON) matching this structure:
                    {
                      "title": "Your %d Days %s Itinerary",
                      "destination": "%s",
                      "days": %d,
                      "travelers": %d,
                      "budgetTier": "%s",
                      "estimatedBudget": "₹20,000 - ₹30,000 for 2 people",
                      "currency": "%s",
                      "summary": "Brief 2-sentence summary of the journey",
                      "daysPlan": [
                        {
                          "dayNumber": 1,
                          "date": "Day 1",
                          "title": "Day title e.g. Arrival & Local Exploration",
                          "location": "Specific place name",
                          "activities": [
                            "Activity 1",
                            "Activity 2",
                            "Activity 3"
                          ],
                          "description": "Short overview of the day"
                        }
                      ],
                      "budgetBreakdown": {
                        "lodging": "Estimated accommodation cost",
                        "transit": "Estimated local travel & transit",
                        "food": "Estimated food & dining cost",
                        "activities": "Sightseeing & entry fees"
                      },
                      "travelTips": [
                        "Tip 1",
                        "Tip 2",
                        "Tip 3"
                      ]
                    }
                    """,
                    dest, days, travelers, budgetTier, currency, String.join(", ", interests),
                    request.getStartDate() != null ? request.getStartDate() : "Upcoming",
                    days, dest, dest, days, travelers, budgetTier, currency
            );

            try {
                String rawResponse = generateResponse(prompt);
                String cleanJson = rawResponse.trim();
                if (cleanJson.startsWith("```json")) {
                    cleanJson = cleanJson.substring(7);
                } else if (cleanJson.startsWith("```")) {
                    cleanJson = cleanJson.substring(3);
                }
                if (cleanJson.endsWith("```")) {
                    cleanJson = cleanJson.substring(0, cleanJson.length() - 3);
                }
                cleanJson = cleanJson.trim();

                JsonNode root = objectMapper.readTree(cleanJson);
                if (root.has("daysPlan") && root.get("daysPlan").isArray()) {
                    com.tourist.chatbot.dto.ItineraryResponse response = objectMapper.treeToValue(root, com.tourist.chatbot.dto.ItineraryResponse.class);
                    response.setSuccess(true);
                    response.setImageUrl(getDestinationImage(dest));
                    return response;
                }
            } catch (Exception e) {
                log.warn("Gemini JSON itinerary generation failed, switching to local structured generator: {}", e.getMessage());
            }
        }

        return generateFallbackItinerary(dest, days, travelers, budgetTier, currency, interests, request.getStartDate());
    }

    private com.tourist.chatbot.dto.ItineraryResponse generateFallbackItinerary(
            String destination, int days, int travelers, String budgetTier, String currency, List<String> interests, String startDate
    ) {
        String cleanDest = capitalize(destination);
        int baseCostPerPersonPerDay = budgetTier.equalsIgnoreCase("Luxury") ? 6000 : (budgetTier.equalsIgnoreCase("Budget") ? 1800 : 3500);
        int totalEstimate = baseCostPerPersonPerDay * travelers * days;
        String currencySymbol = currency.equalsIgnoreCase("USD") ? "$" : (currency.equalsIgnoreCase("EUR") ? "€" : "₹");
        String estimatedBudgetStr = String.format("%s%,d - %s%,d for %d %s",
                currencySymbol, (int)(totalEstimate * 0.9), currencySymbol, (int)(totalEstimate * 1.15),
                travelers, travelers == 1 ? "traveler" : "travelers");

        List<Map<String, Object>> daysPlan = new ArrayList<>();
        java.time.LocalDate baseDate = null;
        if (startDate != null && !startDate.isBlank()) {
            try { baseDate = java.time.LocalDate.parse(startDate); } catch (Exception ignored) {}
        }

        // Generate day-by-day plan tailored to destination & interests
        for (int i = 1; i <= days; i++) {
            String dateLabel = (baseDate != null)
                    ? baseDate.plusDays(i - 1).format(java.time.format.DateTimeFormatter.ofPattern("d MMM"))
                    : "Day " + i;

            String dayTitle;
            String location;
            List<String> activities = new ArrayList<>();
            String dayImg = getDestinationImage(cleanDest);

            if (i == 1) {
                dayTitle = "Arrival & Settling in " + cleanDest;
                location = cleanDest + " Town Center";
                activities.add("Check-in to accommodation and refresh");
                activities.add("Stroll around the central promenade & local markets");
                activities.add("Enjoy an authentic welcome dinner featuring regional cuisine");
            } else if (i == days) {
                dayTitle = "Souvenir Shopping & Departure";
                location = cleanDest + " Transit Hub";
                activities.add("Morning stroll and photography of scenic viewpoints");
                activities.add("Pick up local handicrafts, spices, and specialty souvenirs");
                activities.add("Check out and departure back home");
            } else {
                if (interests.contains("Adventure")) {
                    dayTitle = "Outdoor Adventures & Scenic Escapes";
                    location = cleanDest + " Valley & Trails";
                    activities.add("Morning nature hike or adventure activities (trekking/zipline/sports)");
                    activities.add("Scenic picnic lunch overlooking panoramic viewpoints");
                    activities.add("Evening relaxation and campfire or cafe hopping");
                } else if (interests.contains("Spiritual") || interests.contains("Culture")) {
                    dayTitle = "Heritage, Temples & Cultural Treasures";
                    location = cleanDest + " Historic Quarter";
                    activities.add("Visit iconic ancient temples and historic architectural landmarks");
                    activities.add("Guided cultural tour and traditional crafts exhibition");
                    activities.add("Sunset evening prayer ceremony or cultural performance");
                } else {
                    dayTitle = "Signature Highlights & Natural Wonders";
                    location = cleanDest + " Top Attractions";
                    activities.add("Explore premier botanical parks, serene lakes, or viewpoints");
                    activities.add("Taste famous regional lunch specialties at recommended diners");
                    activities.add("Sunset viewpoints and leisure evening walks");
                }
            }

            daysPlan.add(Map.of(
                    "dayNumber", i,
                    "date", dateLabel,
                    "title", dayTitle,
                    "location", location,
                    "imageUrl", dayImg,
                    "activities", activities,
                    "description", "Curated full-day experience covering signature landmarks and relaxing transit."
            ));
        }

        Map<String, Object> budgetBreakdown = Map.of(
                "lodging", String.format("%s%,d", currencySymbol, (int)(totalEstimate * 0.38)),
                "transit", String.format("%s%,d", currencySymbol, (int)(totalEstimate * 0.22)),
                "food", String.format("%s%,d", currencySymbol, (int)(totalEstimate * 0.25)),
                "activities", String.format("%s%,d", currencySymbol, (int)(totalEstimate * 0.15))
        );

        List<String> travelTips = List.of(
                "Book popular attractions and transit passes in advance during peak season.",
                "Pack weather-appropriate clothing: comfortable walking shoes and light jackets for evenings.",
                "Keep cash handy for local street markets and auto-rickshaws / taxis.",
                "Respect local customs and check photography permissions at sacred sites."
        );

        return com.tourist.chatbot.dto.ItineraryResponse.builder()
                .success(true)
                .title(String.format("Your %d Days %s Itinerary", days, cleanDest))
                .destination(cleanDest)
                .days(days)
                .travelers(travelers)
                .budgetTier(budgetTier)
                .estimatedBudget(estimatedBudgetStr)
                .currency(currency)
                .imageUrl(getDestinationImage(cleanDest))
                .daysPlan(daysPlan)
                .budgetBreakdown(budgetBreakdown)
                .travelTips(travelTips)
                .summary(String.format("Handcrafted %d-day getaway in %s tailored for %d %s with a %s budget and focus on %s.",
                        days, cleanDest, travelers, travelers == 1 ? "traveler" : "travelers", budgetTier, String.join(", ", interests)))
                .build();
    }

    private String getDestinationImage(String name) {
        String lower = name.toLowerCase();
        if (lower.contains("manali") || lower.contains("himachal")) return "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?w=800";
        if (lower.contains("ooty") || lower.contains("nilgiri")) return "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800";
        if (lower.contains("kerala") || lower.contains("alleppey") || lower.contains("munnar")) return "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?w=800";
        if (lower.contains("goa")) return "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800";
        if (lower.contains("paris") || lower.contains("eiffel")) return "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800";
        if (lower.contains("taj") || lower.contains("agra")) return "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800";
        if (lower.contains("tokyo") || lower.contains("japan")) return "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=800";
        if (lower.contains("dubai")) return "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800";
        if (lower.contains("bali")) return "https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800";
        return "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800";
    }

    private String capitalize(String str) {
        if (str == null || str.isBlank()) return "Travel Destination";
        String[] words = str.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0))).append(w.substring(1).toLowerCase()).append(" ");
            }
        }
        return sb.toString().trim();
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
