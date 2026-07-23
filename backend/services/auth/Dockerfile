# Build Command (Run from backend/ root directory):
# docker build -f services/auth/Dockerfile -t cortexai-auth .
# 
# Meaning of build command flags:
# -f services/auth/Dockerfile -> Specifies path to this Dockerfile
# -t cortexai-auth           -> Assigns tag/name to the output image
# .                          -> Sets build context to root backend/ directory

# Base Node.js environment image (lightweight Alpine Linux with Node 20)
FROM node:20-alpine

# Set container working directory to /app
WORKDIR /app

# Copy root level package files for shared dependencies
COPY package*.json ./
# Install root level dependencies (e.g. ioredis)
RUN npm install

# Copy auth microservice package files
COPY services/auth/package*.json ./services/auth/
# Navigate into auth folder and install service dependencies
RUN cd services/auth && npm install

# Copy auth service source code and shared utilities into container
COPY services/auth/ ./services/auth/
COPY shared/ ./shared

# Change active working directory to auth service directory
WORKDIR /app/services/auth

# Expose port 8001 for Auth service network access
EXPOSE 8001

# Command to start Auth microservice when container launches
CMD ["npm", "start"]
