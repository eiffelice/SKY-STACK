FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=3000 DATA_FILE=/app/data/sky-stack.json
COPY --from=build /app/package*.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/dist ./dist
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["node", "server/index.js"]

