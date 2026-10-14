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
    void testStructuredItineraryWithCustomBudgetOriginTransitAndInterests() {
        ItineraryGenerateRequest req = ItineraryGenerateRequest.builder()
                .destination("Goa")
                .originCity("Bangalore")
                .transitMode("Train")
                .days(3)
                .travelers(2)
                .budgetTier("Custom")
                .customBudget(25000.0)
                .budgetType("total")
                .currency("INR")
                .interests(List.of("Beaches", "Food and dining", "Relaxation"))
                .startDate("2026-11-01")
                .endDate("2026-11-03")
                .build();

        ItineraryResponse response = geminiService.generateStructuredItinerary(req);

        assertNotNull(response);
        assertTrue(response.isSuccess());
        assertEquals("Goa", response.getDestination());
        assertEquals(3, response.getDays());
        assertEquals(2, response.getTravelers());
        assertEquals("Bangalore", response.getOriginCity());
        assertEquals("Train", response.getTransitMode());
        assertEquals(25000.0, response.getCustomBudget());
        assertEquals("total", response.getBudgetType());
        assertNotNull(response.getDaysPlan());
        assertEquals(3, response.getDaysPlan().size());
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
        assertFalse(fallback.isBlank());
        assertTrue(fallback.contains("Ooty") || fallback.contains("Travel") || fallback.contains("சுற்றுலா") || fallback.contains("यात्रा"));
    }
}
