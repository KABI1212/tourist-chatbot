package com.tourist.chatbot.repository;

import com.tourist.chatbot.model.Destination;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DestinationRepository extends MongoRepository<Destination, String> {

    Optional<Destination> findByNameIgnoreCase(String name);

    @Query("{ '$or': [ " +
           "{ 'name': { $regex: ?0, $options: 'i' } }, " +
           "{ 'country': { $regex: ?0, $options: 'i' } }, " +
           "{ 'tags': { $regex: ?0, $options: 'i' } }, " +
           "{ 'famousFor': { $regex: ?0, $options: 'i' } } " +
           "] }")
    List<Destination> searchDestinations(String keyword);
}
