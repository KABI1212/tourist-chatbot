package com.tourist.chatbot.repository;

import com.tourist.chatbot.model.ChatMessage;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatMessageRepository extends MongoRepository<ChatMessage, String> {

    List<ChatMessage> findByChatId(String chatId, Sort sort);

    List<ChatMessage> findByUserId(String userId, Sort sort);

    void deleteByChatId(String chatId);

    void deleteByUserId(String userId);

    long countByUserId(String userId);
}
