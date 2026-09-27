package com.tourist.chatbot.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "favorites")
@CompoundIndex(name = "user_dest_idx", def = "{'userId': 1, 'destinationName': 1}", unique = true)
public class Favorite {

    @Id
    private String id;

    @Indexed
    private String userId;

    private String destinationId;

    private String destinationName;

    private String country;

    private String notes;

    @CreatedDate
    private Instant savedAt;
}
