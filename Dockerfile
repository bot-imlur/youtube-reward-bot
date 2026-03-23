FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer — faster rebuilds)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source
COPY . .

# data/ and logs/ are mounted as volumes — not baked in
# --prod flag sets NODE_ENV=production, loads .env, uses data/ directory
CMD ["node", "index.js", "--prod"]
