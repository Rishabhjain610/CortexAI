# Build Command (Run from backend/ root directory):
# docker build -f services/billing/Dockerfile -t cortexai-billing .
# 
# Meaning of build command flags:
# -f services/billing/Dockerfile -> Specifies path to this Dockerfile
# -t cortexai-billing           -> Assigns tag/name to the output image
# .                             -> Sets build context to root backend/ directory

# Base Node.js environment image (lightweight Alpine Linux with Node 20)
FROM node:20-alpine

# Set container working directory to /app
WORKDIR /app

# Copy root level package files for shared dependencies
COPY package*.json ./
# Install root level dependencies (e.g. ioredis)
RUN npm install

# Copy billing microservice package files
COPY services/billing/package*.json ./services/billing/
# Navigate into billing folder and install service dependencies
RUN cd services/billing && npm install

# Copy billing service source code and shared utilities into container
COPY services/billing/ ./services/billing/
COPY shared/ ./shared

# Change active working directory to billing service directory
WORKDIR /app/services/billing

# Expose port 8004 for Billing service network access
EXPOSE 8004

# Command to start Billing microservice when container launches
CMD ["npm", "start"]
