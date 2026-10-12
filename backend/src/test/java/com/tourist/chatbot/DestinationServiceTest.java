package com.tourist.chatbot;

import com.tourist.chatbot.dto.PlaceSearchResult;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import com.tourist.chatbot.service.DestinationService;
import com.tourist.chatbot.service.PlacesProviderService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class DestinationServiceTest {

    @Mock
    private DestinationRepository destinationRepository;

    @Mock
    private PlacesProviderService placesProviderService;

    @InjectMocks
    private DestinationService destinationService;

    @Test
    void testAutocompleteReturnsBothLocalAndGlobal() {
        Destination ooty = Destination.builder().id("1").name("Ooty").country("India").build();
        when(destinationRepository.searchDestinations("Oot")).thenReturn(List.of(ooty));

        PlaceSearchResult globalValparai = PlaceSearchResult.builder()
                .name("Valparai")
                .displayName("Valparai, Tamil Nadu, India")
                .country("India")
                .isGlobal(true)
                .build();
        when(placesProviderService.autocomplete("Oot", 8)).thenReturn(List.of(globalValparai));

        List<PlaceSearchResult> results = destinationService.autocomplete("Oot", 8);

        assertNotNull(results);
        assertEquals(2, results.size());
        assertEquals("Ooty", results.get(0).getName());
        assertEquals("Valparai", results.get(1).getName());
    }

    @Test
    void testGetDestinationDetailsDiscoversGlobalPlace() {
        when(destinationRepository.findById("Valparai")).thenReturn(Optional.empty());
        when(destinationRepository.findByNameIgnoreCase("Valparai")).thenReturn(Optional.empty());

        Destination discovered = Destination.builder()
                .name("Valparai")
                .country("India")
                .description("Hill station in Coimbatore district")
                .latitude(10.3275)
                .longitude(76.9552)
                .build();
        when(placesProviderService.getGlobalPlaceDetails("Valparai", 10.3275, 76.9552))
                .thenReturn(discovered);
        when(destinationRepository.save(discovered)).thenReturn(discovered);

        Destination result = destinationService.getDestinationDetails("Valparai", 10.3275, 76.9552);

        assertNotNull(result);
        assertEquals("Valparai", result.getName());
        assertEquals(10.3275, result.getLatitude());
        verify(destinationRepository).save(discovered);
    }
}
