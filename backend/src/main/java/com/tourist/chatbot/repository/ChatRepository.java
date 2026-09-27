package com.tourist.chatbot.repository;

import com.tourist.chatbot.model.Chat;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatRepository extends MongoRepository<Chat, String> {

    List<Chat> findByUserId(String userId, Sort sort);

    void deleteByUserId(String userId);
}
