package com.tourist.chatbot.repository;

import com.tourist.chatbot.model.Trip;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface TripRepository extends MongoRepository<Trip, String> {

    List<Trip> findByUserId(String userId, Sort sort);

    void deleteByIdAndUserId(String id, String userId);
}
