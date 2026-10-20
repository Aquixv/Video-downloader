# Start with a Node.js base image
FROM node:20-bullseye

# Install ffmpeg and python (required for yt-dlp and gallery-dl)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install both CLI tools globally
RUN pip3 install yt-dlp gallery-dl

# Set up the working directory
WORKDIR /usr/src/app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy your source code AND the exported cookies file
COPY . .
COPY master_cookies.txt ./

# Build the TypeScript code
RUN npm run build

# Expose the port
EXPOSE 1500

# Start the server
CMD [ "npm", "start" ]