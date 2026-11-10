package com.tourist.chatbot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourist.chatbot.dto.ExpenseRequest;
import com.tourist.chatbot.dto.TripRequest;
import com.tourist.chatbot.exception.BadRequestException;
import com.tourist.chatbot.model.Trip;
import com.tourist.chatbot.repository.TripRepository;
import com.tourist.chatbot.service.GeminiService;
import com.tourist.chatbot.service.TripService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.io.InputStream;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

public class DestinationImageUniquenessTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private TripRepository tripRepository;
    private GeminiService geminiService;
    private TripService tripService;

    @BeforeEach
    void setUp() {
        tripRepository = Mockito.mock(TripRepository.class);
        geminiService = Mockito.mock(GeminiService.class);
        tripService = new TripService(tripRepository, geminiService);
    }

    @Test
    void testDestinationsJsonHasZeroDuplicatePrimaryImages() throws Exception {
        InputStream is = getClass().getResourceAsStream("/data/destinations.json");
        assertNotNull(is, "destinations.json should exist in classpath resources");

        JsonNode root = objectMapper.readTree(is);
        assertTrue(root.isObject(), "Root should be an object mapping destination names");

        Map<String, String> seenFirstImages = new HashMap<>();
        Iterator<Map.Entry<String, JsonNode>> fields = root.fields();
        int totalDestinations = 0;

        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> field = fields.next();
            totalDestinations++;
            String destinationName = field.getKey();
            JsonNode imagesNode = field.getValue().path("images");

            assertTrue(imagesNode.isArray() && imagesNode.size() > 0,
                    "Destination '" + destinationName + "' must have at least one image");

            String firstImg = imagesNode.get(0).asText();
            assertFalse(firstImg.isBlank(), "First image URL must not be blank for " + destinationName);

            // Assert uniqueness
            assertFalse(seenFirstImages.containsKey(firstImg),
                    String.format("DUPLICATE IMAGE DETECTED! Destination '%s' shares image '%s' with '%s'",
                            destinationName, firstImg, seenFirstImages.get(firstImg)));

            seenFirstImages.put(firstImg, destinationName);
        }

        assertTrue(totalDestinations >= 40, "Should have audited at least 40 destinations");
        assertEquals(totalDestinations, seenFirstImages.size(),
                "All destinations must have 100% unique primary image URLs");
    }

    @Test
    void testSpecificLandmarksHaveDistinctAuthenticImages() throws Exception {
        InputStream is = getClass().getResourceAsStream("/data/destinations.json");
        JsonNode root = objectMapper.readTree(is);

        String ootyImg = root.path("ooty").path("images").get(0).asText();
        String kodaikanalImg = root.path("kodaikanal").path("images").get(0).asText();
        String munnarImg = root.path("munnar").path("images").get(0).asText();
        String parisImg = root.path("paris").path("images").get(0).asText();
        String tokyoImg = root.path("tokyo").path("images").get(0).asText();

        assertNotEquals(ootyImg, kodaikanalImg, "Ooty and Kodaikanal must not share the same image");
        assertNotEquals(ootyImg, munnarImg, "Ooty and Munnar must not share the same image");
        assertNotEquals(kodaikanalImg, munnarImg, "Kodaikanal and Munnar must not share the same image");
        assertNotEquals(parisImg, tokyoImg, "Paris and Tokyo must not share the same image");
        assertNotEquals(parisImg, ootyImg, "Paris and Ooty must not share the same image");
    }

    @Test
    void testUpdateTripModifiesExistingTripWithoutCreatingDuplicates() {
        String tripId = "trip-456";
        String userId = "user-789";

        Trip existingTrip = Trip.builder()
                .id(tripId)
                .userId(userId)
                .title("Trip to Ooty")
                .destination("Ooty")
                .days(3)
                .people(2)
                .estimatedBudget(15000.0)
                .currency("INR")
                .build();

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(existingTrip));
        when(tripRepository.save(any(Trip.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TripRequest updateRequest = TripRequest.builder()
                .title("Updated 4-Day Ooty Getaway")
                .destination("Ooty")
                .days(4)
                .people(2)
                .estimatedBudget(10000.0)
                .currency("INR")
                .build();

        Trip updated = tripService.updateTrip(tripId, updateRequest, userId);

        assertNotNull(updated);
        assertEquals(tripId, updated.getId(), "Must preserve the same trip ID");
        assertEquals(userId, updated.getUserId());
        assertEquals("Updated 4-Day Ooty Getaway", updated.getTitle());
        assertEquals(4, updated.getDays());
        assertEquals(10000.0, updated.getEstimatedBudget());
    }

    @Test
    void testExpenseRejectsNegativeOrZeroAmounts() {
        String tripId = "trip-100";
        String userId = "user-100";

        Trip trip = Trip.builder()
                .id(tripId)
                .userId(userId)
                .estimatedBudget(20000.0)
                .expenses(new ArrayList<>())
                .build();

        when(tripRepository.findById(tripId)).thenReturn(Optional.of(trip));

        // Negative expense must throw BadRequestException
        ExpenseRequest negativeExpense = ExpenseRequest.builder()
                .title("Negative Refund")
                .category("food")
                .amount(-250.0)
                .build();

        assertThrows(BadRequestException.class, () -> tripService.addExpense(tripId, userId, negativeExpense));

        // Zero expense must throw BadRequestException
        ExpenseRequest zeroExpense = ExpenseRequest.builder()
                .title("Free Item")
                .category("other")
                .amount(0.0)
                .build();

        assertThrows(BadRequestException.class, () -> tripService.addExpense(tripId, userId, zeroExpense));

        // Null amount must throw BadRequestException
        ExpenseRequest nullExpense = ExpenseRequest.builder()
                .title("No Amount")
                .category("other")
                .amount(null)
                .build();

        assertThrows(BadRequestException.class, () -> tripService.addExpense(tripId, userId, nullExpense));
    }
}

