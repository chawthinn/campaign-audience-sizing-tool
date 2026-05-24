import csv
import os
import random

# Hardcoded configurations
target_dir = "./public/dummy_data"
filename = "eligible_base_users.csv"
total_records = 3000000

full_path = os.path.join(target_dir, filename)

# Predefined list of locations to pull from randomly
locations = [
    "New York, USA",
    "London, UK",
    "Toronto, Canada",
    "Sydney, Australia",
    "Berlin, Germany",
    "Paris, France",
    "Tokyo, Japan",
    "Mumbai, India",
    "Singapore, Singapore",
    "São Paulo, Brazil",
]

# Ensure the target directory exists
os.makedirs(target_dir, exist_ok=True)

# Generate the file with user_id, email, and location columns
with open(full_path, mode="w", newline="") as file:
    writer = csv.writer(file)

    # Updated header row
    writer.writerow(["user_id", "email", "location"])

    # Batch process to memory-efficiently write 3 million rows
    batch_size = 100000
    batch = []

    for i in range(1000001, 1000001 + total_records):
        loc = random.choice(locations)
        batch.append([i, f"user_{i}@example.com", loc])

        if len(batch) == batch_size:
            writer.writerows(batch)
            batch = []

    if batch:
        writer.writerows(batch)