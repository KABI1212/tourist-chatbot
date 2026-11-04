package com.tourist.chatbot.repository;

import com.tourist.chatbot.model.Trip;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface TripRepository extends MongoRepository<Trip, String> {

    List<Trip> findByUserId(String userId, Sort sort);

    void deleteByIdAndUserId(String id, String userId);

    void deleteAllByUserId(String userId);

    Optional<Trip> findByShareId(String shareId);
}
