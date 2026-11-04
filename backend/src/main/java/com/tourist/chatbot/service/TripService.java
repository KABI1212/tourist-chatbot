package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.ItineraryGenerateRequest;
import com.tourist.chatbot.dto.ItineraryResponse;
import com.tourist.chatbot.dto.TripRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.Trip;
import com.tourist.chatbot.repository.TripRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class TripService {

    private final TripRepository tripRepository;
    private final GeminiService geminiService;

    public ItineraryResponse generateItinerary(ItineraryGenerateRequest request) {
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
                .expenses(new ArrayList<>())
                .actualExpensesTotal(0.0)
                .isShared(false)
                .shareId(UUID.randomUUID().toString().substring(0, 12))
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

    // ── Expense Management (Section 11) ──

    public Map<String, Object> addExpense(String tripId, String userId, Map<String, Object> expenseData) {
        Trip trip = getTripById(tripId, userId);
        List<Map<String, Object>> expenses = trip.getExpenses() != null ? new ArrayList<>(trip.getExpenses()) : new ArrayList<>();

        String expenseId = UUID.randomUUID().toString().substring(0, 8);
        double amount = 0.0;
        if (expenseData.get("amount") != null) {
            try {
                amount = Double.parseDouble(expenseData.get("amount").toString());
            } catch (NumberFormatException ignored) {}
        }

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", expenseId);
        entry.put("title", expenseData.getOrDefault("title", "Expense"));
        entry.put("category", expenseData.getOrDefault("category", "miscellaneous"));
        entry.put("amount", amount);
        entry.put("date", expenseData.getOrDefault("date", java.time.LocalDate.now().toString()));
        entry.put("paidBy", expenseData.getOrDefault("paidBy", "Me"));
        entry.put("notes", expenseData.getOrDefault("notes", ""));

        expenses.add(entry);
        trip.setExpenses(expenses);

        double total = expenses.stream()
                .mapToDouble(e -> {
                    try { return Double.parseDouble(e.get("amount").toString()); }
                    catch (Exception ex) { return 0.0; }
                })
                .sum();
        trip.setActualExpensesTotal(Math.round(total * 100.0) / 100.0);

        tripRepository.save(trip);
        return getTripExpenses(tripId, userId);
    }

    public Map<String, Object> deleteExpense(String tripId, String userId, String expenseId) {
        Trip trip = getTripById(tripId, userId);
        if (trip.getExpenses() != null) {
            List<Map<String, Object>> updated = trip.getExpenses().stream()
                    .filter(e -> !expenseId.equals(e.get("id")))
                    .toList();
            trip.setExpenses(updated);

            double total = updated.stream()
                    .mapToDouble(e -> {
                        try { return Double.parseDouble(e.get("amount").toString()); }
                        catch (Exception ex) { return 0.0; }
                    })
                    .sum();
            trip.setActualExpensesTotal(Math.round(total * 100.0) / 100.0);
            tripRepository.save(trip);
        }
        return getTripExpenses(tripId, userId);
    }

    public Map<String, Object> getTripExpenses(String tripId, String userId) {
        Trip trip = getTripById(tripId, userId);
        List<Map<String, Object>> expenses = trip.getExpenses() != null ? trip.getExpenses() : List.of();
        double actualTotal = trip.getActualExpensesTotal() != null ? trip.getActualExpensesTotal() : 0.0;
        double budget = trip.getEstimatedBudget() != null ? trip.getEstimatedBudget() : 0.0;
        double remaining = budget - actualTotal;

        // Category breakdown
        Map<String, Double> categoryTotals = new HashMap<>();
        for (Map<String, Object> e : expenses) {
            String cat = (String) e.getOrDefault("category", "other");
            double amt = 0.0;
            try { amt = Double.parseDouble(e.get("amount").toString()); } catch (Exception ignored) {}
            categoryTotals.put(cat, categoryTotals.getOrDefault(cat, 0.0) + amt);
        }

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("tripId", trip.getId());
        summary.put("title", trip.getTitle());
        summary.put("currency", trip.getCurrency() != null ? trip.getCurrency() : "INR");
        summary.put("estimatedBudget", budget);
        summary.put("actualTotal", actualTotal);
        summary.put("remainingBalance", Math.round(remaining * 100.0) / 100.0);
        summary.put("perPersonEstimated", trip.getPeople() > 0 ? Math.round((budget / trip.getPeople()) * 100.0) / 100.0 : budget);
        summary.put("perPersonActual", trip.getPeople() > 0 ? Math.round((actualTotal / trip.getPeople()) * 100.0) / 100.0 : actualTotal);
        summary.put("categoryTotals", categoryTotals);
        summary.put("expenses", expenses);

        return summary;
    }

    // ── Trip Duplication & Reorganization (Section 9) ──

    public Trip duplicateTrip(String tripId, String userId) {
        Trip source = getTripById(tripId, userId);
        Trip copy = Trip.builder()
                .userId(userId)
                .title("Copy of " + source.getTitle())
                .origin(source.getOrigin())
                .destination(source.getDestination())
                .days(source.getDays())
                .people(source.getPeople())
                .hotelTier(source.getHotelTier())
                .estimatedBudget(source.getEstimatedBudget())
                .currency(source.getCurrency())
                .budgetBreakdown(source.getBudgetBreakdown() != null ? new HashMap<>(source.getBudgetBreakdown()) : null)
                .itinerary(source.getItinerary())
                .startDate(source.getStartDate())
                .endDate(source.getEndDate())
                .interests(source.getInterests() != null ? new ArrayList<>(source.getInterests()) : null)
                .status("planning")
                .imageUrl(source.getImageUrl())
                .daysPlan(source.getDaysPlan() != null ? new ArrayList<>(source.getDaysPlan()) : null)
                .travelTips(source.getTravelTips() != null ? new ArrayList<>(source.getTravelTips()) : null)
                .expenses(new ArrayList<>())
                .actualExpensesTotal(0.0)
                .isShared(false)
                .shareId(UUID.randomUUID().toString().substring(0, 12))
                .build();

        return tripRepository.save(copy);
    }

    public Trip updateDaysPlan(String tripId, String userId, List<Map<String, Object>> daysPlan) {
        Trip trip = getTripById(tripId, userId);
        trip.setDaysPlan(daysPlan);
        return tripRepository.save(trip);
    }

    public Trip updatePackingChecklist(String tripId, String userId, List<Map<String, Object>> checklist) {
        Trip trip = getTripById(tripId, userId);
        trip.setPackingChecklist(checklist);
        return tripRepository.save(trip);
    }

    // ── Public Itinerary Sharing (Section 15) ──

    public Map<String, Object> toggleShare(String tripId, String userId, boolean isShared) {
        Trip trip = getTripById(tripId, userId);
        if (trip.getShareId() == null || trip.getShareId().isBlank()) {
            trip.setShareId(UUID.randomUUID().toString().substring(0, 12));
        }
        trip.setIsShared(isShared);
        tripRepository.save(trip);

        return Map.of(
                "isShared", isShared,
                "shareId", trip.getShareId(),
                "shareUrl", "/planner.html?share=" + trip.getShareId()
        );
    }

    public Trip getSharedTrip(String shareId) {
        if (shareId == null || shareId.isBlank()) {
            throw new BadRequestException("Share ID is required");
        }
        Trip trip = tripRepository.findByShareId(shareId.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Shared trip not found"));

        if (trip.getIsShared() == null || !trip.getIsShared()) {
            throw new ResourceNotFoundException("This trip itinerary is private or sharing has been disabled by the owner.");
        }
        return trip;
    }
}
