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

import java.util.List;
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
}
