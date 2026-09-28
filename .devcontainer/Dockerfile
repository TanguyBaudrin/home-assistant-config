# Home Assistant YAML Configuration Devcontainer
FROM python:3.12-slim

# Utilitaires de base + Home Assistant CLI.
# La ligne RUN est volontairement unique : une continuation "&&" en fin de ligne
# ne se poursuit pas dans un Dockerfile, ce qui rendait l'image inutilisable.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        openssh-client \
        curl \
        jq \
        yamllint \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir homeassistant-cli

SHELL ["/bin/bash", "-c"]

CMD ["bash"]
