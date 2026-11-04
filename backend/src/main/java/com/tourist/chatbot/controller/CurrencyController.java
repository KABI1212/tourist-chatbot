package com.tourist.chatbot.controller;

import com.tourist.chatbot.dto.ApiResponse;
import com.tourist.chatbot.service.CurrencyService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Currency Exchange API Controller (Phase 19 & Section 13).
 */
@RestController
@RequestMapping("/api/currency")
@RequiredArgsConstructor
public class CurrencyController {

    private final CurrencyService currencyService;

    @GetMapping("/rates")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getLatestRates(
            @RequestParam(name = "base", defaultValue = "USD") String base
    ) {
        Map<String, Object> rates = currencyService.getLatestRates(base);
        return ResponseEntity.ok(ApiResponse.success(rates));
    }

    @GetMapping("/convert")
    public ResponseEntity<ApiResponse<Map<String, Object>>> convertCurrency(
            @RequestParam(name = "from", defaultValue = "USD") String from,
            @RequestParam(name = "to", defaultValue = "INR") String to,
            @RequestParam(name = "amount", defaultValue = "1") double amount
    ) {
        Map<String, Object> result = currencyService.convertCurrency(from, to, amount);
        return ResponseEntity.ok(ApiResponse.success(result));
    }
}
