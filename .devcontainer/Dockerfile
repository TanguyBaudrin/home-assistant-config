# Home Assistant YAML Configuration Devcontainer
FROM python:3.12-slim

# Basic utilities & Home Assistant CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    git openssh-client curl jq yamllint && \
     pip install homeassistant-cli && \

    rm -rf /var/lib/apt/lists/*

# Optionally install bash completions etc (optional)
SHELL ["/bin/bash", "-c"]

CMD ["bash"]
