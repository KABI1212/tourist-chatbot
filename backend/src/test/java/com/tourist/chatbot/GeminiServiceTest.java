package com.tourist.chatbot;

import com.tourist.chatbot.dto.ItineraryGenerateRequest;
import com.tourist.chatbot.dto.ItineraryResponse;
import com.tourist.chatbot.service.GeminiService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class GeminiServiceTest {

    private final GeminiService geminiService = new GeminiService();

    @Test
    void testStructuredItineraryFallbackGeneration() {
        ItineraryGenerateRequest req = ItineraryGenerateRequest.builder()
                .destination("Manali")
                .days(5)
                .travelers(2)
                .budgetTier("Moderate")
                .currency("INR")
                .interests(List.of("Adventure", "Sightseeing"))
                .startDate("2026-12-10")
                .build();

        ItineraryResponse response = geminiService.generateStructuredItinerary(req);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("Manali", response.getDestination());
        assertEquals(5, response.getDays());
        assertEquals(2, response.getTravelers());
        assertNotNull(response.getDaysPlan());
        assertEquals(5, response.getDaysPlan().size());
        assertNotNull(response.getEstimatedBudget());
        assertNotNull(response.getBudgetBreakdown());
        assertTrue(response.getBudgetBreakdown().containsKey("lodging"));
        assertNotNull(response.getTravelTips());
        assertFalse(response.getTravelTips().isEmpty());
    }

    @Test
    void testLocalFallbackText() {
        String fallback = geminiService.generateResponse("Ooty hill station");
        assertNotNull(fallback);
        assertTrue(fallback.contains("Ooty"));
    }
}
