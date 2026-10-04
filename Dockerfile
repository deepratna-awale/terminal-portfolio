FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fortune-mod \
	&& rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY server ./server
ENV PORT=80
EXPOSE 80
CMD ["node", "server/index.mjs"]
