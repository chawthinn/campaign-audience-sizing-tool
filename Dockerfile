# Use an official lightweight Python image
FROM python:3.11-slim

# Set up a new user named "user" with UID 1000
RUN useradd -m -u 1000 user

# Set the home and path environment variables for the new user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

# Set the working directory inside the container to /app
WORKDIR /app

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

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Start the FastAPI application using Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "7860"]