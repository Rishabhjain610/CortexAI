# Build Command (Run from backend/ root directory):
# docker build -f gateway/Dockerfile -t cortexai-gateway .
# 
# Meaning of build command flags:
# -f gateway/Dockerfile -> Specifies path to this Dockerfile
# -t cortexai-gateway   -> Assigns tag/name to the output image
# .                     -> Sets build context to root backend/ directory

# Base Node.js environment image (lightweight Alpine Linux with Node 20)
FROM node:20-alpine

# Set container working directory to /app
WORKDIR /app

# Copy root level package files for shared dependencies
COPY package*.json ./
# Install root level dependencies (e.g. ioredis)
RUN npm install

# Copy Gateway microservice package files
COPY gateway/package*.json ./gateway/
# Navigate into gateway folder and install service dependencies
RUN cd gateway && npm install

# Copy Gateway service source code and shared utilities into container
COPY gateway/ ./gateway
COPY shared/ ./shared

# Change active working directory to gateway service directory
WORKDIR /app/gateway

# Expose port 8000 for Gateway network access
EXPOSE 8000

# Command to start Gateway microservice when container launches
CMD ["npm", "start"]
