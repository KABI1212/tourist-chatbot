package com.tourist.chatbot;

import com.tourist.chatbot.dto.ChatRequest;
import com.tourist.chatbot.dto.ChatResponse;
import com.tourist.chatbot.model.Destination;
import com.tourist.chatbot.repository.ChatMessageRepository;
import com.tourist.chatbot.repository.ChatRepository;
import com.tourist.chatbot.service.ChatService;
import com.tourist.chatbot.service.DestinationMatcher;
import com.tourist.chatbot.service.GeminiService;
import com.tourist.chatbot.service.PlacesProviderService;
import com.tourist.chatbot.service.UserService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
public class ChatServiceTest {

    @Mock
    private ChatRepository chatRepository;

    @Mock
    private ChatMessageRepository chatMessageRepository;

    @Mock
    private GeminiService geminiService;

    @Mock
    private UserService userService;

    @Mock
    private DestinationMatcher destinationMatcher;

    @Mock
    private PlacesProviderService placesProviderService;

    @InjectMocks
    private ChatService chatService;

    @Test
    void testGuestChatMessageExecution() {
        ChatRequest req = ChatRequest.builder().message("Tell me about visiting Ooty").build();

        Destination ooty = Destination.builder().name("Ooty").description("Queen of Hill stations").build();

        when(destinationMatcher.find(anyString())).thenReturn(Optional.of(ooty));
        lenient().when(geminiService.generateResponse(any(), anyString()))
                .thenReturn("Ooty is a gorgeous hill station with tea gardens and lakes.");
        lenient().when(geminiService.generateResponse(any(), anyString(), anyString()))
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

    @Test
    void testMultilingualLanguageDetection() {
        // Tamil Script
        assertEquals("ta", chatService.determineEffectiveLanguage("ஊட்டியைப் பற்றி சொல்லு", null, null));

        // Tanglish
        assertEquals("ta", chatService.determineEffectiveLanguage("Ooty pathi sollunga bro", null, null));
        assertEquals("ta", chatService.determineEffectiveLanguage("Chennai la irundhu Ooty ku 3 days trip plan pannu", null, null));

        // Hindi Script
        assertEquals("hi", chatService.determineEffectiveLanguage("मुझे ऊटी के बारे में बताओ", null, null));

        // Hinglish
        assertEquals("hi", chatService.determineEffectiveLanguage("Ooty kaise jaa sakte hain?", null, null));

        // Explicit command
        assertEquals("fr", chatService.determineEffectiveLanguage("Reply in French", null, null));
        assertEquals("de", chatService.determineEffectiveLanguage("Speak in German", null, null));
        assertEquals("ta", chatService.determineEffectiveLanguage("தமிழில் பதில் சொல்லு", null, null));

        // English default
        assertEquals("en", chatService.determineEffectiveLanguage("Tell me about Ooty", null, null));
    }
}
