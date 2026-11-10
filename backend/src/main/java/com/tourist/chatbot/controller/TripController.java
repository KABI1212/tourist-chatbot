package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.dto.ExpenseRequest;
import com.tourist.chatbot.dto.ItineraryGenerateRequest;
import com.tourist.chatbot.dto.ItineraryResponse;
import com.tourist.chatbot.dto.TripRequest;
import com.tourist.chatbot.model.Trip;
import com.tourist.chatbot.model.User;
import com.tourist.chatbot.service.TripService;
import com.tourist.chatbot.service.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/trips")
@RequiredArgsConstructor
public class TripController {

    private final TripService tripService;
    private final UserService userService;

    @PostMapping("/generate")
    public ResponseEntity<ApiResponse<ItineraryResponse>> generateItinerary(
            @Valid @RequestBody ItineraryGenerateRequest request
    ) {
        ItineraryResponse itinerary = tripService.generateItinerary(request);
        return ResponseEntity.ok(ApiResponse.success("Itinerary generated successfully", itinerary));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<Trip>> createTrip(
            @Valid @RequestBody TripRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Trip trip = tripService.createTrip(request, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Trip plan created successfully", trip));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<Trip>>> getUserTrips(
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        List<Trip> trips = tripService.getUserTrips(user.getId());
        return ResponseEntity.ok(ApiResponse.success(trips));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Trip>> getTripById(
            @PathVariable("id") String id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Trip trip = tripService.getTripById(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success(trip));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<Trip>> updateTrip(
            @PathVariable("id") String id,
            @Valid @RequestBody TripRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Trip updated = tripService.updateTrip(id, request, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Trip updated successfully", updated));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Map<String, String>>> deleteTrip(
            @PathVariable("id") String id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        tripService.deleteTrip(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Trip plan removed", Map.of("id", id)));
    }

    // ── Expense Tracking Endpoints (Section 11) ──

    @GetMapping("/{id}/expenses")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getTripExpenses(
            @PathVariable("id") String id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Map<String, Object> summary = tripService.getTripExpenses(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success(summary));
    }

    @PostMapping("/{id}/expenses")
    public ResponseEntity<ApiResponse<Map<String, Object>>> addExpense(
            @PathVariable("id") String id,
            @Valid @RequestBody ExpenseRequest request,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Map<String, Object> summary = tripService.addExpense(id, user.getId(), request);
        return ResponseEntity.ok(ApiResponse.success("Expense recorded successfully", summary));
    }

    @DeleteMapping("/{id}/expenses/{expenseId}")
    public ResponseEntity<ApiResponse<Map<String, Object>>> deleteExpense(
            @PathVariable("id") String id,
            @PathVariable("expenseId") String expenseId,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Map<String, Object> summary = tripService.deleteExpense(id, user.getId(), expenseId);
        return ResponseEntity.ok(ApiResponse.success("Expense removed", summary));
    }

    // ── Trip Duplication & Reorganization (Section 9) ──

    @PostMapping("/{id}/duplicate")
    public ResponseEntity<ApiResponse<Trip>> duplicateTrip(
            @PathVariable("id") String id,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Trip copy = tripService.duplicateTrip(id, user.getId());
        return ResponseEntity.ok(ApiResponse.success("Trip plan duplicated", copy));
    }

    @PutMapping("/{id}/itinerary")
    public ResponseEntity<ApiResponse<Trip>> updateDaysPlan(
            @PathVariable("id") String id,
            @RequestBody List<Map<String, Object>> daysPlan,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Trip updated = tripService.updateDaysPlan(id, user.getId(), daysPlan);
        return ResponseEntity.ok(ApiResponse.success("Itinerary activities updated", updated));
    }

    @PutMapping("/{id}/packing")
    public ResponseEntity<ApiResponse<Trip>> updatePackingChecklist(
            @PathVariable("id") String id,
            @RequestBody List<Map<String, Object>> checklist,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        Trip updated = tripService.updatePackingChecklist(id, user.getId(), checklist);
        return ResponseEntity.ok(ApiResponse.success("Packing checklist saved", updated));
    }

    // ── Public Itinerary Sharing (Section 15) ──

    @PostMapping("/{id}/share")
    public ResponseEntity<ApiResponse<Map<String, Object>>> toggleShare(
            @PathVariable("id") String id,
            @RequestBody Map<String, Boolean> body,
            @AuthenticationPrincipal UserDetails userDetails
    ) {
        User user = userService.getUserByUsername(userDetails.getUsername());
        boolean isShared = body != null && Boolean.TRUE.equals(body.get("isShared"));
        Map<String, Object> shareResult = tripService.toggleShare(id, user.getId(), isShared);
        return ResponseEntity.ok(ApiResponse.success("Sharing preferences updated", shareResult));
    }

    @GetMapping("/shared/{shareId}")
    public ResponseEntity<ApiResponse<Trip>> getSharedTrip(
            @PathVariable("shareId") String shareId
    ) {
        Trip trip = tripService.getSharedTrip(shareId);
        return ResponseEntity.ok(ApiResponse.success("Shared itinerary loaded", trip));
    }
}
