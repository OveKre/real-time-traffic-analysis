@ECHO OFF
SETLOCAL

SET BASE_DIR=%~dp0
SET MAVEN_VERSION=3.9.9
SET MAVEN_HOME=%BASE_DIR%\.mvn\apache-maven-%MAVEN_VERSION%
SET MAVEN_BIN=%MAVEN_HOME%\bin\mvn.cmd
SET ARCHIVE=%BASE_DIR%\.mvn\apache-maven-%MAVEN_VERSION%-bin.zip
SET DOWNLOAD_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip

IF EXIST "%MAVEN_BIN%" GOTO RUN

IF NOT EXIST "%BASE_DIR%\.mvn" mkdir "%BASE_DIR%\.mvn"
powershell -Command "Invoke-WebRequest -Uri '%DOWNLOAD_URL%' -OutFile '%ARCHIVE%'"
powershell -Command "Expand-Archive -Path '%ARCHIVE%' -DestinationPath '%BASE_DIR%\.mvn' -Force"

:RUN
CALL "%MAVEN_BIN%" %*
