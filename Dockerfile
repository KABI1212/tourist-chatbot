# ===================================================================
# Tourist Chatbot Backend - Root Multi-Stage Dockerfile
# Used if Render Web Service Root Directory is set to repository root
# ===================================================================

# ── Stage 1: Build JAR with Maven & Eclipse Temurin JDK 17 ──
FROM maven:3.9.6-eclipse-temurin-17-alpine AS build
WORKDIR /app

# Copy pom.xml and source code from backend directory
COPY backend/pom.xml .
COPY backend/src ./src

# Build executable JAR skipping tests
RUN mvn clean package -DskipTests -B

# ── Stage 2: Lightweight Runtime with Eclipse Temurin JRE 17 ──
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app

# Run as dedicated unprivileged user for security
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

# Copy compiled jar from build stage
COPY --from=build /app/target/*.jar app.jar

# Render automatically provides the PORT environment variable
ENV PORT=8080
EXPOSE ${PORT}

# Container JVM memory flags optimized for Render
ENTRYPOINT ["sh", "-c", "java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 -Dserver.port=${PORT:-8080} -jar app.jar"]
