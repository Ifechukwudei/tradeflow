# Use Node.js 20 Alpine for smaller image size
FROM node:20-alpine

# Install netcat for database health check
RUN apk add --no-cache netcat-openbsd

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production

# Copy application code
COPY . .

# Copy and set permissions for startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose port
EXPOSE 3000

# Run the startup script
CMD ["/app/start.sh"]
