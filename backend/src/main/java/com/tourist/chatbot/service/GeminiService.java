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
    private static final String GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";

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
            You are TouristAI, a world-class Conversational AI Travel Concierge inspired by ChatGPT's natural, empathetic, and context-aware dialogue style.
            You help travellers discover destinations, plan custom trips, compare transportation routes, budget expenses, find regional cuisine, and navigate the world safely.

            CORE CONVERSATIONAL PRINCIPLES:
            1. NATURAL, CONTEXTUAL CONVERSATION:
               - Speak naturally, warmly, and helpfully like a knowledgeable local guide and travel expert.
               - Adapt response length and style to what the user asks:
                 * For casual openings (e.g., "Hi", "I want to visit Ooty"), give a welcoming, concise response highlighting what makes the destination special and ask what kind of assistance they prefer (itinerary, top spots, transit directions, or budget breakdown).
                 * For specific factual questions (e.g., "What is the best time to visit Japan?", "Is it safe to travel solo in Iceland?"), answer directly, concisely, and insightfully.
                 * For transit queries (e.g., "How to reach Ooty from Chennai?"), provide clear, realistic step-by-step route options (trains with names/classes, buses, driving routes).
                 * For live weather queries, use the factual weather provided in context and state it clearly.
                 * For itinerary requests (e.g., "Plan for 3 days"), ask for essential missing parameters (origin city, budget, travel style) if needed, or provide a well-structured starter plan with common defaults.
            2. FULL CONVERSATION MEMORY:
               - You MUST maintain context from all prior messages in the conversation.
               - Remember the active destination, starting location, dates, budget, number of travellers, and preferences.
               - Understand references seamlessly: "there", "that place", "the second option", "make it cheaper", "how do I get there?", "change day two", "what about food?".
               - When the user asks to modify an existing plan ("make it cheaper", "reduce budget to ₹8,000", "remove museums", "add 1 more day"), adapt the previous plan specifically rather than generating an unrelated new plan.
               - NEVER ask the user to repeat details they already gave in earlier messages.
            3. REALISTIC TRAVEL DATA & TRANSPARENCY:
               - Incorporate any external factual context (coordinates, verified weather, landmarks, nearby places) injected by the system seamlessly.
               - Clearly mark estimated prices, train durations, and fares as realistic estimates.
               - Avoid inventing fictitious train numbers, flight prices, or unverified claims. If specific live information is unknown, acknowledge it honestly.
            4. CLEAN STRUCTURE & READABILITY:
               - Organize complex responses using clean Markdown (##, ### headers, bold key points, bullet lists, and comparison tables for budgets and itineraries).
               - Keep the text readable, inviting, and free of excessive emoji clutter.
            """;    private String buildSystemInstruction(String language) {
        StringBuilder sb = new StringBuilder(SYSTEM_INSTRUCTION);
        sb.append("\n6. MULTILINGUAL & SCRIPT DIRECTIVES:\n");
        sb.append("   - You are a native-fluent multilingual travel guide supporting Indian languages (Tamil தமிழ், Hindi हिन्दी, Malayalam മലയാളം, Telugu తెలుగు, Kannada ಕನ್ನಡ, Bengali বাংলা, Marathi मराठी, Gujarati ગુજરાતી, Punjabi ਪੰਜਾਬੀ, Urdu اردو, Odia ଓଡ଼ିଆ, Assamese অসমীয়া, English) and International languages (French Français, Spanish Español, German Deutsch, Italian Italiano, Portuguese Português, Arabic العربية, Chinese 简体中文, Japanese 日本語, Korean 한국어, Russian Русский, Indonesian Bahasa Indonesia, Thai ไทย, Vietnamese Tiếng Việt).\n");

        String languageLabel = resolveLanguageLabel(language);
        if (languageLabel != null) {
            sb.append(String.format("   - ACTIVE LANGUAGE DIRECTIVE: The user's preferred response language is %s. You MUST write your complete answer in this language unless the user asks for a different language.\n", languageLabel));
            sb.append("   - If the user writes in code-switched dialect (e.g. Tamil-English / Tanglish or Hindi-English / Hinglish), reply in natural, friendly conversational style matching their preference.\n");
        } else {
            sb.append("   - INTELLIGENT AUTOMATIC LANGUAGE DETECTION: You must automatically detect the user's language, script, or dialect (e.g. Tamil script தமிழ், Tanglish, Hindi script हिन्दी, Hinglish, Telugu తెలుగు, Malayalam മലയാളം, Kannada ಕನ್ನಡ, Bengali বাংলা, French, Spanish, German, Arabic, Chinese, Japanese, etc.) and respond DIRECTLY in that exact language and native script.\n");
            sb.append("   - If the user writes in Tanglish (e.g. 'Ooty pathi sollunga bro', 'Chennai la irundhu Ooty ku 3 days trip plan pannu', 'Budget konjam kammi pannu'), understand their intent fully and reply in warm, natural conversational Tamil or Tanglish.\n");
            sb.append("   - If the user writes in Hinglish (e.g. 'Ooty kaise jaa sakte hain?', 'Manali ghumne ka plan batao'), reply in natural Hindi.\n");
            sb.append("   - If the user requests an explicit language change like 'Reply in Tamil', 'Answer in Hindi', 'Speak in French', 'Switch to Spanish', IMMEDIATELY switch to that requested language for this and all follow-up turns.\n");
            sb.append("   - Maintain the active language throughout the conversation until the user changes it or speaks in another language.\n");
            sb.append("   - NEVER default to English when the user communicates in another language.\n");
        }
        sb.append("   - CRITICAL TRAVEL ACCURACY: NEVER mistranslate proper names of places, temples, monuments, bus terminals, railway stations, flight codes, hotels, distances, and prices. Preserve proper place names accurately (with English phonetic transliteration in brackets where helpful for navigation).\n");
        return sb.toString();
    }

    private String resolveLanguageLabel(String code) {
        if (code == null || code.isBlank() || "auto".equalsIgnoreCase(code)) return null;
        switch (code.toLowerCase().trim()) {
            case "ta":
            case "tamil":
                return "Tamil (தமிழ்) - Write your complete response fluently in native Tamil script (தமிழ் எழுத்துக்கள்). For Tanglish queries, you may use conversational Tamil with English landmark names in brackets where helpful for navigation.";
            case "hi":
            case "hindi":
                return "Hindi (हिन्दी) - Write your complete response fluently in Hindi using Devanagari script (देवनागरी लिपि).";
            case "te":
            case "telugu":
                return "Telugu (తెలుగు) - Write your complete response fluently in Telugu script (తెలుగు లిపి).";
            case "ml":
            case "malayalam":
                return "Malayalam (മലയാളം) - Write your complete response fluently in Malayalam script (മലയാള ലിപി).";
            case "kn":
            case "kannada":
                return "Kannada (ಕನ್ನಡ) - Write your complete response fluently in Kannada script (ಕನ್ನಡ ಲಿపి).";
            case "bn":
            case "bengali":
                return "Bengali (বাংলা) - Write your complete response fluently in Bengali script (বাংলা লিপি).";
            case "mr":
            case "marathi":
                return "Marathi (मराठी) - Write your complete response fluently in Marathi using Devanagari script.";
            case "gu":
            case "gujarati":
                return "Gujarati (ગુજરાતી) - Write your complete response fluently in Gujarati script (ગુજરાતી લિપિ).";
            case "pa":
            case "punjabi":
                return "Punjabi (ਪੰਜਾਬੀ) - Write your complete response fluently in Gurmukhi script (ਗੁਰਮੁਖੀ).";
            case "ur":
            case "urdu":
                return "Urdu (اردو) - Write your complete response fluently in Urdu (اردو رسم الخط).";
            case "or":
            case "odia":
                return "Odia (ଓଡ଼ିଆ) - Write your complete response fluently in Odia script.";
            case "as":
            case "assamese":
                return "Assamese (অসমীয়া) - Write your complete response fluently in Assamese script.";
            case "fr":
            case "french":
                return "French (Français) - Write your complete response fluently in French.";
            case "es":
            case "spanish":
                return "Spanish (Español) - Write your complete response fluently in Spanish.";
            case "de":
            case "german":
                return "German (Deutsch) - Write your complete response fluently in German.";
            case "it":
            case "italian":
                return "Italian (Italiano) - Write your complete response fluently in Italian.";
            case "pt":
            case "portuguese":
                return "Portuguese (Português) - Write your complete response fluently in Portuguese.";
            case "ar":
            case "arabic":
                return "Arabic (العربية) - Write your complete response fluently in Arabic script.";
            case "zh":
            case "chinese":
                return "Chinese (Simplified 简体中文) - Write your complete response fluently in Simplified Chinese.";
            case "ja":
            case "japanese":
                return "Japanese (日本語) - Write your complete response fluently in Japanese.";
            case "ko":
            case "korean":
                return "Korean (한국어) - Write your complete response fluently in Korean Hangul.";
            case "ru":
            case "russian":
                return "Russian (Русский) - Write your complete response fluently in Russian Cyrillic.";
            case "id":
            case "indonesian":
                return "Indonesian (Bahasa Indonesia) - Write your complete response fluently in Indonesian.";
            case "th":
            case "thai":
                return "Thai (ไทย) - Write your complete response fluently in Thai script.";
            case "vi":
            case "vietnamese":
                return "Vietnamese (Tiếng Việt) - Write your complete response fluently in Vietnamese.";
            case "en":
            case "english":
                return "English - Write your complete response in clear, inviting English.";
            default:
                return code + " - Write your complete response fluently in this language.";
        }
    }

    /**
     * Generate content with conversation history
     */
    public String generateResponse(List<ChatMessage> history, String userPrompt) {
        return generateResponse(history, userPrompt, null);
    }

    public String generateResponse(List<ChatMessage> history, String userPrompt, String language) {
        String activeKey = resolveApiKey();
        if (activeKey == null || activeKey.trim().isEmpty()) {
            log.warn("Gemini API key is not configured.");
            return generateLocalFallback(userPrompt, language);
        }

        List<Map<String, Object>> contents = buildContentsList(history, userPrompt);
        String primaryModel = (modelName != null && !modelName.isEmpty()) ? modelName : "gemini-2.5-flash";
        String instruction = buildSystemInstruction(language);

        List<String> modelCandidates = new ArrayList<>();
        if (primaryModel != null && !primaryModel.isBlank()) {
            modelCandidates.add(primaryModel);
        }
        for (String m : List.of("gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-flash-latest", "gemini-flash-lite-latest")) {
            if (!modelCandidates.contains(m)) {
                modelCandidates.add(m);
            }
        }

        Exception lastException = null;
        for (String model : modelCandidates) {
            try {
                return callGeminiApiWithContents(model, contents, activeKey, instruction);
            } catch (Exception ex) {
                lastException = ex;
                log.warn("Gemini API attempt with model {} failed: {}", model, ex.getMessage());
            }
        }

        log.error("All Gemini API model attempts failed: {}", lastException != null ? lastException.getMessage() : "unknown");
        return generateLocalFallback(userPrompt, language);
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

    private String callGeminiApiWithContents(String model, List<Map<String, Object>> contents, String activeKey, String systemInstruction) throws Exception {
        // Key goes in the header, never in the URL, so it cannot leak into logged exception messages.
        String endpoint = String.format(GEMINI_BASE_URL, model);

        Map<String, Object> requestBody = new HashMap<>();

        // System instruction
        String sysText = (systemInstruction != null && !systemInstruction.isBlank()) ? systemInstruction : SYSTEM_INSTRUCTION;
        Map<String, Object> systemPart = Map.of("text", sysText);
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
                .header("x-goog-api-key", activeKey.trim())
                .timeout(Duration.ofSeconds(30))
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString(java.nio.charset.StandardCharsets.UTF_8));

        if (response.statusCode() != 200) {
            throw new RuntimeException("Gemini API (" + model + ") returned status " + response.statusCode());
        }

        JsonNode root = objectMapper.readTree(response.body());
        JsonNode candidates = root.path("candidates");
        if (candidates.isArray() && !candidates.isEmpty()) {
            JsonNode candidate = candidates.get(0);
            JsonNode parts = candidate.path("content").path("parts");
            if (parts.isArray() && !parts.isEmpty()) {
                String text = parts.get(0).path("text").asText();
                // Detect truncated responses and prompt the user to continue
                String finishReason = candidate.path("finishReason").asText("");
                if ("MAX_TOKENS".equals(finishReason)) {
                    text += "\n\n_(The response was cut short due to length. Reply \"continue\" to get the rest.)_";
                }
                return text;
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

        String langDirective = (request.getLanguage() != null && !request.getLanguage().isBlank() && !"en".equalsIgnoreCase(request.getLanguage()) && !"auto".equalsIgnoreCase(request.getLanguage()))
                ? "- Language: Write all summaries, titles, descriptions, activities, and tips fluently in " + request.getLanguage() + " while retaining proper landmark names.\n"
                : "";

        String activeKey = resolveApiKey();
        if (activeKey != null && !activeKey.trim().isEmpty()) {
            String prompt = String.format("""
                    Generate a detailed, realistic travel itinerary for %s for %d days.
                    Details:
                    - Travelers: %d
                    - Budget Tier: %s (Currency: %s)
                    - Interests: %s
                    - Start Date: %s
                    %s
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
                    request.getStartDate() != null ? request.getStartDate() : "Upcoming", langDirective,
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

    private String generateLocalFallback(String query) {
        return generateLocalFallback(query, null);
    }

    private String generateLocalFallback(String query, String language) {
        if ("ta".equalsIgnoreCase(language)) {
            return """
                    ### 🌍 சுற்றுலா வழிகாட்டி

                    தற்போது AI வழிகாட்டி பிஸியாக உள்ளது. சில முக்கிய பயணக் குறிப்புகள்:

                    * **பயணத்திற்கு சிறந்த நேரம்:** பருவமழை மற்றும் உள்ளூர் நிகழ்வுகளை சரிபார்த்து திட்டமிடுங்கள்.
                    * **போக்குவரத்து:** விரைவு ரயில்கள் அல்லது பேருந்துகள் பட்ஜெட்டுக்கு மிகவும் ஏற்றவை.
                    * **தங்குமிடம்:** சுற்றுலா இடங்கள் மற்றும் பேருந்து நிலையங்களுக்கு அருகில் முன்பதிவு செய்யுங்கள்.
                    * **பட்ஜெட் திட்டம்:** 35% தங்குமிடம், 25% போக்குவரத்து, 25% உணவு மற்றும் 15% இதர செலவுகளுக்கு ஒதுக்குங்கள்.

                    *(AI சேவை விரைவில் செயல்படும். சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்.)*
                    """;
        }
        if ("hi".equalsIgnoreCase(language)) {
            return """
                    ### 🌍 यात्रा सहायक

                    इस समय AI गाइड व्यस्त है। कुछ आवश्यक यात्रा सुझाव:

                    * **सर्वोत्तम समय:** मौसम और स्थानीय त्योहारों की जांच करके ही टिकट बुक करें।
                    * **परिवहन:** बजट यात्रा के लिए नियमित एक्सप्रेस ट्रेनें या सरकारी बसें सर्वोत्तम हैं।
                    * **आवास:** प्रमुख दर्शनीय स्थलों या रेलवे स्टेशन के पास रुकें।
                    * **बजट योजना:** 35% आवास, 25% परिवहन, 25% भोजन व दर्शनीय स्थल और 15% अन्य खर्चों के लिए रखें।

                    *(AI सेवा शीघ्र उपलब्ध होगी। कृपया कुछ क्षणों बाद पुनः प्रयास करें।)*
                    """;
        }
        if ("fr".equalsIgnoreCase(language)) {
            return """
                    ### 🌍 Assistant de Voyage

                    Notre guide IA est temporairement indisponible. Conseils essentiels de voyage :

                    * **Meilleure période :** Vérifiez la météo et les événements locaux avant de réserver.
                    * **Transport :** Privilégiez les trains express et les transports régionaux pour économiser.
                    * **Hébergement :** Choisissez des hôtels proches des gares ou du centre historique.

                    *(Veuillez réessayer dans un instant.)*
                    """;
        }
        if ("es".equalsIgnoreCase(language)) {
            return """
                    ### 🌍 Asistente de Viajes

                    Nuestro guía de IA está temporalmente ocupado. Consejos clave de viaje:

                    * **Mejor época:** Consulta el clima local y festividades antes de viajar.
                    * **Transporte:** Compara trenes y autobuses interurbanos para ahorrar presupuesto.
                    * **Alojamiento:** Elige ubicaciones céntricas cerca del transporte público.

                    *(Por favor intenta de nuevo en unos momentos.)*
                    """;
        }

        return """
                ### 🌍 Travel Assistant Offline

                Our AI guide is temporarily unavailable. Here are general travel planning essentials you can rely on:

                * **Best Time to Visit:** Check seasonal weather patterns and local festival dates before booking.
                * **Transportation:** Compare direct express trains, flights, or intercity state buses for the most cost-effective transit.
                * **Accommodation:** Choose central locations near transit hubs for convenience, or nature resorts on the outskirts for quiet stays.
                * **Budgeting Tip:** Allocate roughly 35% for accommodation, 25% for transit, 25% for dining & activities, and 15% for miscellaneous expenses.

                *(The AI service will be back shortly. Please try again in a moment.)*
                """;
    }
}
