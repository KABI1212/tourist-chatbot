package com.tourist.chatbot.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import com.tourist.chatbot.model.User;
import com.tourist.chatbot.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final DestinationRepository destinationRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    public void run(ApplicationArguments args) {
        try {
            seedDemoUser();

            if (destinationRepository.count() > 0) {
                log.info("Destination catalog already initialized with {} destinations.", destinationRepository.count());
                return;
            }

            log.info("Initializing destination catalog from seed data...");
            loadAndSeedDestinations();
        } catch (Exception e) {
            log.warn("MongoDB Atlas connection could not be established on startup (verify your network or MONGODB_URI): {}", e.getMessage());
        }
    }

    private void seedDemoUser() {
        try {
            if (userRepository.findByUsername("demo").isEmpty()) {
                User demoUser = User.builder()
                        .username("demo")
                        .email("demo@touristguide.com")
                        .password(passwordEncoder.encode("demo123"))
                        .fullName("Demo Traveller")
                        .bio("Travel enthusiast discovering worldwide landmarks with AI.")
                        .roles(Set.of("ROLE_USER"))
                        .build();
                userRepository.save(demoUser);
                log.info("Seed demo account created: username='demo', password='demo123'");
            }
        } catch (Exception e) {
            log.warn("Could not seed demo account: {}", e.getMessage());
        }
    }

    private void loadAndSeedDestinations() {

        try {
            ClassPathResource resource = new ClassPathResource("data/destinations.json");
            if (resource.exists()) {
                try (InputStream is = resource.getInputStream()) {
                    JsonNode root = objectMapper.readTree(is);
                    Iterator<Map.Entry<String, JsonNode>> fields = root.fields();

                    while (fields.hasNext()) {
                        Map.Entry<String, JsonNode> entry = fields.next();
                        String placeKey = entry.getKey();
                        JsonNode node = entry.getValue();

                        String formattedName = capitalizeWords(placeKey);
                        List<String> images = new ArrayList<>();
                        if (node.has("images") && node.get("images").isArray()) {
                            node.get("images").forEach(img -> images.add(img.asText()));
                        }

                        Double lat = node.has("lat") ? node.get("lat").asDouble() : null;
                        Double lng = node.has("lng") ? node.get("lng").asDouble() : null;
                        String mapsLink = node.has("maps_link") ? node.get("maps_link").asText() : "";

                        Destination dest = Destination.builder()
                                .name(formattedName)
                                .country(inferCountry(formattedName))
                                .description("Iconic world-renowned travel attraction and cultural landmark.")
                                .famousFor("Spectacular architecture, scenic views and historical significance")
                                .bestTime("October to March")
                                .latitude(lat)
                                .longitude(lng)
                                .mapsLink(mapsLink)
                                .images(images)
                                .tags(List.of("Sightseeing", "Historical", "Iconic Landmark"))
                                .build();

                        destinationRepository.save(dest);
                    }
                }
            }

            // Seed featured destinations like Ooty, Goa, Paris, Taj Mahal with rich details
            seedFeaturedDestinations();

            log.info("Destination catalog initialization complete. Total destinations: {}", destinationRepository.count());
        } catch (Exception e) {
            log.warn("Failed to initialize destinations from JSON: {}", e.getMessage());
            seedFeaturedDestinations();
        }
    }

    private void seedFeaturedDestinations() {
        List<Destination> featured = List.of(
                Destination.builder()
                        .name("Ooty")
                        .country("India")
                        .continent("Asia")
                        .description("Known as the 'Queen of Hill Stations', Ooty features picturesque tea gardens, serene lakes, cool climate, and the Nilgiri Mountain Railway.")
                        .famousFor("Tea Gardens, Ooty Lake, Botanical Gardens, Nilgiri Toy Train, Doddabetta Peak")
                        .bestTime("March to June & September to November")
                        .peakSeason("April - May")
                        .offSeason("July - August (Monsoon)")
                        .weather("Pleasant, 10°C - 25°C")
                        .idealDuration("3 to 4 Days")
                        .unescoStatus("Nilgiri Mountain Railway UNESCO World Heritage")
                        .openingTime("08:30 AM")
                        .closingTime("06:30 PM")
                        .entryFee("₹30 - ₹50 for gardens")
                        .latitude(11.4102)
                        .longitude(76.6950)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=11.4102,76.6950")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800",
                                "https://images.unsplash.com/photo-1544735716-392fe2489ffa?w=800"
                        ))
                        .tags(List.of("Hill Station", "Nature", "Tea Gardens", "Couples", "Family"))
                        .officialWebsite("https://www.tamilnadutourism.tn.gov.in/")
                        .travelTip("Book the Nilgiri toy train tickets weeks in advance. Carry warm clothes for chilly evenings.")
                        .build(),

                Destination.builder()
                        .name("Taj Mahal")
                        .country("India")
                        .continent("Asia")
                        .description("An ivory-white marble mausoleum on the south bank of the Yamuna river in Agra, commissioned in 1632 by the Mughal emperor Shah Jahan.")
                        .famousFor("Mughal Architecture, Symbol of Love, Wonder of the World")
                        .bestTime("October to March")
                        .peakSeason("November - February")
                        .weather("Sunny in winter, 12°C - 26°C")
                        .idealDuration("1 Day")
                        .unescoStatus("UNESCO World Heritage Site")
                        .openingTime("Sunrise (approx 06:00 AM)")
                        .closingTime("Sunset (approx 06:30 PM), Closed Fridays")
                        .entryFee("₹50 (Indian), ₹1100 (Foreigners)")
                        .latitude(27.1751)
                        .longitude(78.0421)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=27.1751,78.0421")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1564507592333-c60657eea523?w=800",
                                "https://images.unsplash.com/photo-1599858769708-7c1ff5b6e47c?w=800"
                        ))
                        .tags(List.of("Monument", "UNESCO", "Architecture", "Romantic"))
                        .officialWebsite("https://www.tajmahal.gov.in/")
                        .travelTip("Visit at sunrise for minimal crowds and spectacular golden reflections on marble.")
                        .build(),

                Destination.builder()
                        .name("Goa")
                        .country("India")
                        .continent("Asia")
                        .description("India's pocket-sized paradise on the southwest coast, famed for golden sandy beaches, vibrant nightlife, Portuguese heritage churches, and fresh seafood.")
                        .famousFor("Beaches, Water Sports, Nightclubs, Seafood, Portuguese Architecture")
                        .bestTime("November to February")
                        .peakSeason("December - January")
                        .weather("Tropical, 22°C - 32°C")
                        .idealDuration("4 to 5 Days")
                        .unescoStatus("Churches and Convents of Goa UNESCO Site")
                        .openingTime("Open 24 Hours (Beaches)")
                        .closingTime("Varies by club & monument")
                        .entryFee("Free for public beaches")
                        .latitude(15.2993)
                        .longitude(74.1240)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=15.2993,74.1240")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800",
                                "https://images.unsplash.com/photo-1614082242765-7c98ca0f3df3?w=800"
                        ))
                        .tags(List.of("Beach", "Party", "Water Sports", "Relaxation", "Seafood"))
                        .officialWebsite("https://goatourism.gov.in/")
                        .travelTip("Rent a scooter to explore the scenic coastal roads of North and South Goa conveniently.")
                        .build(),

                Destination.builder()
                        .name("Paris")
                        .country("France")
                        .continent("Europe")
                        .description("France's capital, is a major European city and a global center for art, fashion, gastronomy and culture with iconic 19th-century cityscapes.")
                        .famousFor("Eiffel Tower, Louvre Museum, Notre-Dame, French Cuisine, Fashion")
                        .bestTime("April to June & September to November")
                        .weather("Mild, 15°C - 25°C")
                        .idealDuration("4 to 5 Days")
                        .latitude(48.8566)
                        .longitude(2.3522)
                        .mapsLink("https://www.google.com/maps/search/?api=1&query=48.8566,2.3522")
                        .images(List.of(
                                "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800",
                                "https://images.unsplash.com/photo-1511739001486-6bfe10cec9e4?w=800"
                        ))
                        .tags(List.of("Romance", "Museums", "Culinary", "Fashion", "Culture"))
                        .officialWebsite("https://en.parisinfo.com/")
                        .travelTip("Purchase a Paris Museum Pass and Navigo Easy metro card for seamless travel.")
                        .build()
        );

        for (Destination d : featured) {
            if (destinationRepository.findByNameIgnoreCase(d.getName()).isEmpty()) {
                destinationRepository.save(d);
            }
        }
    }

    private String capitalizeWords(String input) {
        if (input == null || input.isEmpty()) return input;
        String[] words = input.split("\\s+");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (!w.isEmpty()) {
                sb.append(Character.toUpperCase(w.charAt(0)))
                        .append(w.substring(1).toLowerCase())
                        .append(" ");
            }
        }
        return sb.toString().trim();
    }

    private String inferCountry(String name) {
        String lower = name.toLowerCase();
        if (lower.contains("taj mahal") || lower.contains("ooty") || lower.contains("goa") || lower.contains("kodaikanal") || lower.contains("hampi")) return "India";
        if (lower.contains("eiffel") || lower.contains("louvre") || lower.contains("paris")) return "France";
        if (lower.contains("colosseum") || lower.contains("rome") || lower.contains("venice")) return "Italy";
        if (lower.contains("statue of liberty") || lower.contains("new york") || lower.contains("grand canyon")) return "USA";
        if (lower.contains("machu picchu")) return "Peru";
        if (lower.contains("pyramids") || lower.contains("giza")) return "Egypt";
        if (lower.contains("kyoto") || lower.contains("tokyo") || lower.contains("fuji")) return "Japan";
        return "Worldwide Landmark";
    }
}
