package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.dto.NearbyPlace;
import com.tourist.chatbot.dto.PlaceSearchResult;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.service.DestinationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/destinations")
@RequiredArgsConstructor
public class DestinationController {

    private final DestinationService destinationService;

    @GetMapping
    public ResponseEntity<ApiResponse<List<Destination>>> getAllDestinations(
            @RequestParam(name = "q", required = false) String query
    ) {
        List<Destination> list;
        if (query != null && !query.trim().isEmpty()) {
            list = destinationService.searchDestinations(query.trim());
        } else {
            list = destinationService.getAllDestinations();
        }
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/autocomplete")
    public ResponseEntity<ApiResponse<List<PlaceSearchResult>>> autocomplete(
            @RequestParam("q") String query,
            @RequestParam(name = "limit", defaultValue = "8") int limit
    ) {
        List<PlaceSearchResult> suggestions = destinationService.autocomplete(query, limit);
        return ResponseEntity.ok(ApiResponse.success(suggestions));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<Destination>>> searchDestinations(
            @RequestParam("query") String query
    ) {
        List<Destination> list = destinationService.searchDestinations(query);
        return ResponseEntity.ok(ApiResponse.success(list));
    }

    @GetMapping("/details")
    public ResponseEntity<ApiResponse<Destination>> getDestinationDetails(
            @RequestParam("name") String name,
            @RequestParam(name = "lat", required = false) Double lat,
            @RequestParam(name = "lon", required = false) Double lon
    ) {
        Destination destination = destinationService.getDestinationDetails(name, lat, lon);
        return ResponseEntity.ok(ApiResponse.success(destination));
    }

    @GetMapping("/nearby")
    public ResponseEntity<ApiResponse<List<NearbyPlace>>> getNearbyPlaces(
            @RequestParam("lat") Double lat,
            @RequestParam("lon") Double lon,
            @RequestParam(name = "radius", required = false) Integer radius,
            @RequestParam(name = "limit", required = false) Integer limit
    ) {
        List<NearbyPlace> nearby = destinationService.getNearbyPlaces(lat, lon, radius, limit);
        return ResponseEntity.ok(ApiResponse.success(nearby));
    }

    @GetMapping("/weather")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getWeather(
            @RequestParam("lat") Double lat,
            @RequestParam("lon") Double lon
    ) {
        Map<String, Object> weather = destinationService.getWeather(lat, lon);
        return ResponseEntity.ok(ApiResponse.success(weather));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Destination>> getDestinationById(@PathVariable("id") String id) {
        Destination destination = destinationService.getDestinationById(id);
        return ResponseEntity.ok(ApiResponse.success(destination));
    }
}
