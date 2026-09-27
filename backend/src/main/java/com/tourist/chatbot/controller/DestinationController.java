package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.service.DestinationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

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

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<Destination>> getDestinationById(@PathVariable("id") String id) {
        Destination destination = destinationService.getDestinationById(id);
        return ResponseEntity.ok(ApiResponse.success(destination));
    }

    @GetMapping("/search")
    public ResponseEntity<ApiResponse<List<Destination>>> searchDestinations(
            @RequestParam("query") String query
    ) {
        List<Destination> list = destinationService.searchDestinations(query);
        return ResponseEntity.ok(ApiResponse.success(list));
    }
}
