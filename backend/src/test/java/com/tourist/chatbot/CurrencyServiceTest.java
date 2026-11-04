package com.tourist.chatbot;

import com.tourist.chatbot.service.CurrencyService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CurrencyServiceTest {

    private CurrencyService currencyService;

    @BeforeEach
    void setUp() {
        currencyService = new CurrencyService();
    }

    @Test
    void testGetLatestRates() {
        Map<String, Object> result = currencyService.getLatestRates("USD");
        assertNotNull(result);
        assertEquals("USD", result.get("base"));
        assertTrue(result.containsKey("rates"));

        @SuppressWarnings("unchecked")
        Map<String, Double> rates = (Map<String, Double>) result.get("rates");
        assertTrue(rates.containsKey("INR"));
        assertTrue(rates.get("INR") > 50.0);
    }

    @Test
    void testConvertCurrency() {
        Map<String, Object> result = currencyService.convertCurrency("USD", "INR", 100.0);
        assertNotNull(result);
        assertEquals("USD", result.get("from"));
        assertEquals("INR", result.get("to"));
        double converted = (double) result.get("convertedAmount");
        assertTrue(converted > 5000.0);
    }
}
