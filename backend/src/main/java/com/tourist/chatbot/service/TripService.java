package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.TripRequest;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.Trip;
import com.tourist.chatbot.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TripService {

    private final TripRepository tripRepository;
    private final GeminiService geminiService;

    public com.tourist.chatbot.dto.ItineraryResponse generateItinerary(com.tourist.chatbot.dto.ItineraryGenerateRequest request) {
        return geminiService.generateStructuredItinerary(request);
    }

    public Trip createTrip(TripRequest request, String userId) {
        Trip trip = Trip.builder()
                .userId(userId)
                .title(request.getTitle() != null && !request.getTitle().isEmpty() ? request.getTitle() : "Trip to " + request.getDestination())
                .origin(request.getOrigin())
                .destination(request.getDestination())
                .days(request.getDays() > 0 ? request.getDays() : 3)
                .people(request.getPeople() > 0 ? request.getPeople() : 1)
                .hotelTier(request.getHotelTier() != null ? request.getHotelTier() : "mid")
                .estimatedBudget(request.getEstimatedBudget())
                .currency(request.getCurrency() != null ? request.getCurrency() : "INR")
                .budgetBreakdown(request.getBudgetBreakdown())
                .itinerary(request.getItinerary())
                .travelTips(request.getTravelTips())
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .interests(request.getInterests())
                .status(request.getStatus() != null ? request.getStatus() : "upcoming")
                .imageUrl(request.getImageUrl())
                .daysPlan(request.getDaysPlan())
                .build();

        return tripRepository.save(trip);
    }

    public List<Trip> getUserTrips(String userId) {
        return tripRepository.findByUserId(userId, Sort.by(Sort.Direction.DESC, "createdAt"));
    }

    public Trip getTripById(String id, String userId) {
        return tripRepository.findById(id)
                .filter(t -> t.getUserId().equals(userId))
                .orElseThrow(() -> new ResourceNotFoundException("Trip plan not found with id: " + id));
    }

    public void deleteTrip(String id, String userId) {
        tripRepository.deleteByIdAndUserId(id, userId);
    }
}
