FROM python:3.12-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       nodejs npm git curl build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

CMD ["sleep", "infinity"]
