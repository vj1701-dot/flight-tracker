# Multi-stage build for production deployment
FROM node:18-alpine AS frontend-builder

# Set working directory
WORKDIR /app

# Copy frontend package files
COPY client/package*.json ./client/
WORKDIR /app/client

# Install frontend dependencies (including dev dependencies for build)
RUN npm install

# Copy frontend source
COPY client/ .

# Build frontend
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Set working directory
WORKDIR /app/server

# Copy backend package files
COPY server/package*.json ./

# Install backend dependencies
RUN npm install --only=production

# Copy backend source
COPY server/ .

# Copy built frontend from builder stage
COPY --from=frontend-builder /app/client/dist ../client/dist

# Create flights.json if it doesn't exist
RUN touch flights.json && echo "[]" > flights.json

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Change ownership of app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 8080, path: '/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
      process.exit(res.statusCode === 200 ? 0 : 1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# Set production environment
ENV NODE_ENV=production

# Start the application
CMD ["node", "index.js"]