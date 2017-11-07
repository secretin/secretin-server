FROM node:8.6.0

# PID 1 needs to handle process reaping and signals
# https://engineeringblog.yelp.com/2016/01/dumb-init-an-init-for-docker.html
RUN curl -L https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64 > /usr/local/bin/dumb-init && chmod +x /usr/local/bin/dumb-init

RUN mkdir -p /secretin-server
WORKDIR /secretin-server

COPY package.json /secretin-server
RUN yarn install

COPY . /secretin-server

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/dumb-init", "--"]

COPY ./setup-system-tables.sh /

RUN chmod 755 /setup-system-tables.sh

CMD [ "/setup-system-tables.sh" ]