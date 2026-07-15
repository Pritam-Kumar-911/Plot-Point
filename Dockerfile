FROM nginx:alpine

WORKDIR /usr/share/nginx/html

RUN rm -rf ./*

COPY components/ ./components/
COPY index.html ./
COPY results.html ./
COPY dashboard.html ./
COPY mylist.html ./
COPY explore.html ./
COPY detail.html ./

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
