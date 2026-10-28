FROM amazonlinux:2023

RUN dnf install nodejs20 -y

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package-lock.json ./
COPY package.json ./
RUN npm cache verify
RUN npm install

# Add app source
COPY . .

# Remove any unneeded files
RUN rm -rf /usr/src/app/.DS_Store
RUN rm -rf /usr/src/app/.git
RUN rm -rf /usr/src/app/.gitignore
