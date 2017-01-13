FROM node:6.9.1

# PID 1 needs to handle process reaping and signals
# https://engineeringblog.yelp.com/2016/01/dumb-init-an-init-for-docker.html
RUN curl -L https://github.com/Yelp/dumb-init/releases/download/v1.1.3/dumb-init_1.1.3_amd64 > /usr/local/bin/dumb-init && chmod +x /usr/local/bin/dumb-init

RUN mkdir -p /secretin-server
WORKDIR /secretin-server

COPY package.json /secretin-server
RUN npm install

COPY . /secretin-server

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]

CMD [ "npm", "start"]