FROM node:22-alpine
WORKDIR /app

# Install dependencies first (better Docker layer caching)
COPY package*.json ./
RUN npm install --production

# Copy application code
COPY . .

# Ensure data directory exists and is writable (Gun radisk storage)
RUN mkdir -p data && chmod 777 data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
