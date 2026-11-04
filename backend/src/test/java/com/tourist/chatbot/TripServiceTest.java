package com.tourist.chatbot;

import com.tourist.chatbot.dto.ItineraryGenerateRequest;
import com.tourist.chatbot.dto.ItineraryResponse;
import com.tourist.chatbot.dto.TripRequest;
import com.tourist.chatbot.model.Trip;
import com.tourist.chatbot.repository.TripRepository;
import com.tourist.chatbot.service.GeminiService;
import com.tourist.chatbot.service.TripService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Sort;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class TripServiceTest {

    @Mock
    private TripRepository tripRepository;

    @Mock
    private GeminiService geminiService;

    @InjectMocks
    private TripService tripService;

    @Test
    void testCreateTrip() {
        TripRequest req = TripRequest.builder()
                .title("Trip to Manali")
                .destination("Manali")
                .days(5)
                .people(2)
                .estimatedBudget(25000.0)
                .currency("INR")
                .build();

        Trip saved = Trip.builder()
                .id("trip-1")
                .userId("u1")
                .title("Trip to Manali")
                .destination("Manali")
                .days(5)
                .people(2)
                .estimatedBudget(25000.0)
                .currency("INR")
                .build();

        when(tripRepository.save(any(Trip.class))).thenReturn(saved);

        Trip result = tripService.createTrip(req, "u1");

        assertNotNull(result);
        assertEquals("Trip to Manali", result.getTitle());
        assertEquals("Manali", result.getDestination());
        verify(tripRepository).save(any(Trip.class));
    }

    @Test
    void testGetUserTrips() {
        Trip trip = Trip.builder().id("trip-1").userId("u1").destination("Ooty").build();
        when(tripRepository.findByUserId(eq("u1"), any(Sort.class))).thenReturn(List.of(trip));

        List<Trip> trips = tripService.getUserTrips("u1");

        assertNotNull(trips);
        assertEquals(1, trips.size());
        assertEquals("Ooty", trips.get(0).getDestination());
    }

    @Test
    void testGenerateItineraryDelegatesToGeminiService() {
        ItineraryGenerateRequest req = ItineraryGenerateRequest.builder().destination("Ooty").days(3).build();
        ItineraryResponse mockResp = ItineraryResponse.builder().success(true).title("Your 3 Days Ooty Itinerary").build();

        when(geminiService.generateStructuredItinerary(req)).thenReturn(mockResp);

        ItineraryResponse resp = tripService.generateItinerary(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        verify(geminiService).generateStructuredItinerary(req);
    }

    @Test
    void testAddAndDeleteExpense() {
        Trip trip = Trip.builder()
                .id("trip-1")
                .userId("u1")
                .estimatedBudget(10000.0)
                .people(2)
                .expenses(new ArrayList<>())
                .actualExpensesTotal(0.0)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> summary = tripService.addExpense("trip-1", "u1", Map.of(
                "title", "Train tickets",
                "category", "transportation",
                "amount", 2400.0
        ));

        assertNotNull(summary);
        assertEquals(2400.0, summary.get("actualTotal"));
        assertEquals(7600.0, summary.get("remainingBalance"));

        List<Map<String, Object>> expenses = (List<Map<String, Object>>) summary.get("expenses");
        assertEquals(1, expenses.size());
        String expenseId = (String) expenses.get(0).get("id");

        Map<String, Object> afterDelete = tripService.deleteExpense("trip-1", "u1", expenseId);
        assertEquals(0.0, afterDelete.get("actualTotal"));
        assertEquals(10000.0, afterDelete.get("remainingBalance"));
    }

    @Test
    void testDuplicateTrip() {
        Trip trip = Trip.builder()
                .id("trip-1")
                .userId("u1")
                .title("Trip to Goa")
                .destination("Goa")
                .days(3)
                .people(2)
                .estimatedBudget(15000.0)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Trip duplicate = tripService.duplicateTrip("trip-1", "u1");

        assertNotNull(duplicate);
        assertEquals("Copy of Trip to Goa", duplicate.getTitle());
        assertEquals("Goa", duplicate.getDestination());
        assertEquals("planning", duplicate.getStatus());
    }

    @Test
    void testToggleShare() {
        Trip trip = Trip.builder()
                .id("trip-1")
                .userId("u1")
                .isShared(false)
                .build();

        when(tripRepository.findById("trip-1")).thenReturn(Optional.of(trip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Map<String, Object> shareResult = tripService.toggleShare("trip-1", "u1", true);

        assertNotNull(shareResult);
        assertEquals(true, shareResult.get("isShared"));
        assertNotNull(shareResult.get("shareUrl"));
        assertTrue(shareResult.get("shareUrl").toString().contains("/planner.html?share="));
    }
}
