package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

/**
 * Health check controller for cloud platform liveness probes (e.g. Render, Railway, K8s).
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public ResponseEntity<ApiResponse<Map<String, Object>>> healthCheck() {
        return ResponseEntity.ok(ApiResponse.success("Service is healthy and operational", Map.of(
                "status", "UP",
                "service", "tourist-chatbot-api",
                "timestamp", Instant.now().toString()
        )));
    }

    @GetMapping("/")
    public ResponseEntity<ApiResponse<Map<String, Object>>> rootStatus() {
        return ResponseEntity.ok(ApiResponse.success("Tourist Chatbot Backend API is running", Map.of(
                "status", "UP",
                "version", "1.0.0",
                "documentation", "Check /api/destinations or /api/health"
        )));
    }
}
