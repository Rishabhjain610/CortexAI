# Build Command (Run from backend/ root directory):
# docker build -f services/agent/Dockerfile -t cortexai-agent .
# 
# Meaning of build command flags:
# -f services/agent/Dockerfile -> Specifies path to this Dockerfile
# -t cortexai-agent           -> Assigns tag/name to the output image
# .                           -> Sets build context to root backend/ directory

# Base Node.js environment image (lightweight Alpine Linux with Node 20)
FROM node:20-alpine

# Set container working directory to /app
WORKDIR /app

# Copy root level package files for shared dependencies
COPY package*.json ./
# Install root level dependencies (e.g. ioredis)
RUN npm install

# Copy agent microservice package files
COPY services/agent/package*.json ./services/agent/
# Navigate into agent folder and install service dependencies
RUN cd services/agent && npm install

# Copy agent service source code and shared utilities into container
COPY services/agent/ ./services/agent/
COPY shared/ ./shared

# Change active working directory to agent service directory
WORKDIR /app/services/agent

# Expose port 8003 for Agent service network access
EXPOSE 8003

# Command to start Agent microservice when container launches
CMD ["npm", "start"]
