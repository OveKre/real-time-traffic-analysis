#!/bin/sh
set -eu

BASE_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
MAVEN_VERSION=3.9.9
MAVEN_HOME="$BASE_DIR/.mvn/apache-maven-$MAVEN_VERSION"
MAVEN_BIN="$MAVEN_HOME/bin/mvn"
ARCHIVE="$BASE_DIR/.mvn/apache-maven-$MAVEN_VERSION-bin.tar.gz"
DOWNLOAD_URL="https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$MAVEN_VERSION/apache-maven-$MAVEN_VERSION-bin.tar.gz"

download() {
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "$DOWNLOAD_URL" -o "$ARCHIVE"
    return
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "$ARCHIVE"
    return
  fi
  echo "Neither curl nor wget is available." >&2
  exit 1
}

extract() {
  mkdir -p "$BASE_DIR/.mvn"
  tar -xzf "$ARCHIVE" -C "$BASE_DIR/.mvn"
}

if [ ! -x "$MAVEN_BIN" ]; then
  download
  extract
fi

exec "$MAVEN_BIN" "$@"
