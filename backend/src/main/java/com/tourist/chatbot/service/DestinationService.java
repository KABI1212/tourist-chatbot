package com.tourist.chatbot.service;

import com.tourist.chatbot.exception.ResourceNotFoundException;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.DestinationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class DestinationService {

    private final DestinationRepository destinationRepository;

    public List<Destination> getAllDestinations() {
        return destinationRepository.findAll();
    }

    public Destination getDestinationById(String id) {
        return destinationRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Destination not found with id: " + id));
    }

    public List<Destination> searchDestinations(String query) {
        if (query == null || query.trim().isEmpty()) {
            return destinationRepository.findAll();
        }
        return destinationRepository.searchDestinations(query.trim());
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
