package com.tourist.chatbot.service;

import com.tourist.chatbot.dto.NearbyPlace;
import com.tourist.chatbot.dto.PlaceSearchResult;
import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class DestinationService {

    private static final Logger log = LoggerFactory.getLogger(DestinationService.class);

    private final DestinationRepository destinationRepository;
    private final PlacesProviderService placesProviderService;

    public List<Destination> getAllDestinations() {
        return destinationRepository.findAll();
    }

    public Destination getDestinationById(String id) {
        return destinationRepository.findById(id)
                .orElseGet(() -> destinationRepository.findByNameIgnoreCase(id)
                        .orElseThrow(() -> new ResourceNotFoundException("Destination not found with id: " + id)));
    }

    /**
     * Search destinations: blends local curated catalog with worldwide global discovery.
     */
    public List<Destination> searchDestinations(String query) {
        if (query == null || query.trim().isEmpty()) {
            return destinationRepository.findAll();
        }

        String clean = query.trim();
        List<Destination> localMatches = destinationRepository.searchDestinations(clean);

        // If local matches exist, check if exact match exists
        boolean hasExact = localMatches.stream().anyMatch(d -> d.getName().equalsIgnoreCase(clean));
        if (hasExact && localMatches.size() >= 3) {
            return localMatches;
        }

        // Search global provider to discover any place worldwide
        try {
            List<PlaceSearchResult> globalResults = placesProviderService.autocomplete(clean, 5);
            List<Destination> combined = new ArrayList<>(localMatches);
            Set<String> seenNames = new HashSet<>();
            for (Destination d : localMatches) {
                seenNames.add(d.getName().toLowerCase());
            }

            for (PlaceSearchResult gr : globalResults) {
                if (!seenNames.contains(gr.getName().toLowerCase())) {
                    // Check if already in DB under this name
                    Optional<Destination> existing = destinationRepository.findByNameIgnoreCase(gr.getName());
                    if (existing.isPresent()) {
                        combined.add(existing.get());
                    } else {
                        // Dynamically resolve and cache
                        Destination discovered = placesProviderService.getGlobalPlaceDetails(
                                gr.getName(), gr.getLatitude(), gr.getLongitude()
                        );
                        if (discovered != null) {
                            try {
                                discovered = destinationRepository.save(discovered);
                            } catch (Exception e) {
                                log.debug("Could not cache discovered destination {}: {}", gr.getName(), e.getMessage());
                            }
                            combined.add(discovered);
                        }
                    }
                    seenNames.add(gr.getName().toLowerCase());
                }
            }
            return combined;
        } catch (Exception e) {
            log.warn("Global place search failed for '{}': {}", clean, e.getMessage());
            return localMatches;
        }
    }

    /**
     * Autocomplete suggestions: instant typeahead for any place in the world.
     */
    public List<PlaceSearchResult> autocomplete(String query, int limit) {
        if (query == null || query.trim().length() < 2) {
            return Collections.emptyList();
        }

        String clean = query.trim();
        int max = limit > 0 ? limit : 8;
        List<PlaceSearchResult> suggestions = new ArrayList<>();
        Set<String> seenNames = new HashSet<>();

        // 1. Check local catalog first
        List<Destination> local = destinationRepository.searchDestinations(clean);
        for (Destination d : local) {
            String nameLower = d.getName().toLowerCase();
            if (!seenNames.contains(nameLower)) {
                suggestions.add(PlaceSearchResult.builder()
                        .id(d.getId())
                        .name(d.getName())
                        .displayName(d.getName() + (d.getCountry() != null ? ", " + d.getCountry() : ""))
                        .country(d.getCountry() != null ? d.getCountry() : "India")
                        .latitude(d.getLatitude())
                        .longitude(d.getLongitude())
                        .category(d.getTags() != null && !d.getTags().isEmpty() ? d.getTags().get(0) : "Featured")
                        .description(d.getFamousFor() != null ? d.getFamousFor() : d.getDescription())
                        .imageUrl(d.getImages() != null && !d.getImages().isEmpty() ? d.getImages().get(0) : null)
                        .isGlobal(false)
                        .build());
                seenNames.add(nameLower);
                if (suggestions.size() >= max) return suggestions;
            }
        }

        // 2. Fetch global results via PlacesProviderService
        try {
            List<PlaceSearchResult> global = placesProviderService.autocomplete(clean, max);
            for (PlaceSearchResult gr : global) {
                String nameLower = gr.getName().toLowerCase();
                if (!seenNames.contains(nameLower)) {
                    suggestions.add(gr);
                    seenNames.add(nameLower);
                    if (suggestions.size() >= max) break;
                }
            }
        } catch (Exception e) {
            log.warn("Global autocomplete error: {}", e.getMessage());
        }

        return suggestions;
    }

    /**
     * Complete destination details: returns cached DB destination or resolves worldwide place dynamically.
     */
    public Destination getDestinationDetails(String nameOrId, Double lat, Double lon) {
        if (nameOrId == null || nameOrId.isBlank()) {
            throw new ResourceNotFoundException("Destination query must not be empty");
        }

        String target = nameOrId.trim();

        // Check if ID in DB
        Optional<Destination> byId = destinationRepository.findById(target);
        if (byId.isPresent()) return byId.get();

        // Check if name in DB
        Optional<Destination> byName = destinationRepository.findByNameIgnoreCase(target);
        if (byName.isPresent()) return byName.get();

        // Discovered place worldwide
        Destination globalDest = placesProviderService.getGlobalPlaceDetails(target, lat, lon);
        if (globalDest != null) {
            try {
                // Save to MongoDB so future queries are instant
                return destinationRepository.save(globalDest);
            } catch (Exception e) {
                log.warn("Could not persist discovered destination: {}", e.getMessage());
                return globalDest;
            }
        }

        throw new ResourceNotFoundException("Could not find or resolve destination for: " + target);
    }

    /**
     * Dynamic nearby attractions discovery around any coordinates.
     */
    public List<NearbyPlace> getNearbyPlaces(Double lat, Double lon, Integer radiusMeters, Integer limit) {
        return placesProviderService.getNearbyAttractions(
                lat, lon,
                radiusMeters != null ? radiusMeters : 10000,
                limit != null ? limit : 6
        );
    }

    /**
     * Live weather for coordinates.
     */
    public Map<String, Object> getWeather(Double lat, Double lon) {
        return placesProviderService.getLiveWeather(lat, lon);
    }

    public Optional<Destination> findByName(String name) {
        return destinationRepository.findByNameIgnoreCase(name.trim());
    }

    public Destination saveDestination(Destination destination) {
        return destinationRepository.save(destination);
    }

    public long count() {
        return destinationRepository.count();
    }
}
