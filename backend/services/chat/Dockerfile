# Build Command (Run from backend/ root directory):
# docker build -f services/chat/Dockerfile -t cortexai-chat .
# 
# Meaning of build command flags:
# -f services/chat/Dockerfile -> Specifies path to this Dockerfile
# -t cortexai-chat           -> Assigns tag/name to the output image
# .                          -> Sets build context to root backend/ directory

# Base Node.js environment image (lightweight Alpine Linux with Node 20)
FROM node:20-alpine

# Set container working directory to /app
WORKDIR /app

# Copy root level package files for shared dependencies
COPY package*.json ./
# Install root level dependencies (e.g. ioredis)
RUN npm install

# Copy chat microservice package files
COPY services/chat/package*.json ./services/chat/
# Navigate into chat folder and install service dependencies
RUN cd services/chat && npm install

# Copy chat service source code and shared utilities into container
COPY services/chat/ ./services/chat/
COPY shared/ ./shared

# Change active working directory to chat service directory
WORKDIR /app/services/chat

# Expose port 8002 for Chat service network access
EXPOSE 8002

# Command to start Chat microservice when container launches
CMD ["npm", "start"]
