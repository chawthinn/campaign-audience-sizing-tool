# Use an official lightweight Python image
FROM python:3.11-slim

# Set up a new user named "user" with UID 1000
RUN useradd -m -u 1000 user

# Set the home and path environment variables for the new user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set the working directory inside the container to /app
WORKDIR /app

# Make /app writable by 'user' so the app can mkdir /app/tmp at startup.
# (Without this, /app stays root-owned and Cloud Run fails with PermissionError.)
RUN chown user:user /app

# COPY FROM THE BACKEND FOLDER:
# Copy requirements first from the backend directory, ensuring the new user owns it
COPY --chown=user:user ./backend/requirements.txt /app/requirements.txt

# Switch to the non-root user before installing dependencies
USER user

# Install dependencies safely into the user's local space
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt

# COPY FROM THE BACKEND FOLDER:
# Copy only your backend application code into the container
COPY --chown=user:user ./backend /app

# Expose port (HF Spaces uses 7860; Cloud Run injects its own via $PORT)
EXPOSE 7860

# Start uvicorn. ${PORT:-7860} = use $PORT if set (Cloud Run), else 7860 (HF Spaces).
# --proxy-headers + --forwarded-allow-ips='*' make url_for() return https:// behind
# Cloud Run / any reverse proxy (otherwise download URLs come back as http:// and
# the browser blocks them as mixed content on HTTPS frontends).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]