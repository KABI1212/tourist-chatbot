package com.tourist.chatbot;

import com.tourist.chatbot.dto.ChatRequest;
import com.tourist.chatbot.dto.ChatResponse;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.ChatMessageRepository;
import com.tourist.chatbot.repository.ChatRepository;
import com.tourist.chatbot.repository.DestinationRepository;
import com.tourist.chatbot.service.ChatService;
import com.tourist.chatbot.service.GeminiService;
import com.tourist.chatbot.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ChatServiceTest {

    @Mock
    private ChatRepository chatRepository;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private DestinationRepository destinationRepository;

    @Mock
    private GeminiService geminiService;

    @Mock
    private UserService userService;

    @InjectMocks
    private ChatService chatService;

    @Test
    void testGuestChatMessageExecution() {
        ChatRequest req = ChatRequest.builder().message("Tell me about visiting Ooty").build();

        Destination ooty = Destination.builder().name("Ooty").description("Queen of Hill stations").build();
        when(destinationRepository.findAll()).thenReturn(List.of(ooty));
        when(geminiService.generateResponse(any(), eq("Tell me about visiting Ooty")))
                .thenReturn("Ooty is a gorgeous hill station with tea gardens and lakes.");

        // Guest user passes null username
        ChatResponse resp = chatService.processMessage(req, null);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.getResponse().contains("Ooty"));
        assertNotNull(resp.getDestination());
        assertEquals("Ooty", resp.getDestination().getName());
        verifyNoInteractions(userService);
    }
}
