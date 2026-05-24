import csv
import os
import random

# Configuration
target_dir = "./public/dummy_data"
output_filename = "targeting_list.csv"
full_path = os.path.join(target_dir, output_filename)

# 1. Configuration for the existing "eligible" range (3 million total)
eligible_start = 1_000_001
eligible_end = 4_000_000
desired_eligible_count = 1_700_000

# 2. Configuration for the new "unmatched" records
new_records_start = 4_000_001
new_records_count = 20_000

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

# Memory-efficient sampling without materializing the entire 3 million range
eligible_sample = random.sample(
    range(eligible_start, eligible_end + 1), desired_eligible_count
)
new_records = list(
    range(new_records_start, new_records_start + new_records_count)
)

# Combine and sort both lists
final_targeting_list = eligible_sample + new_records
final_targeting_list.sort()

# Write directly to the target path
with open(full_path, mode="w", newline="") as file:
    writer = csv.writer(file)
    writer.writerow(["user_id", "email", "location"])

    # Batch process writing to keep it fast
    batch_size = 100000
    batch = []

    for user_id in final_targeting_list:
        loc = random.choice(locations)
        batch.append([user_id, f"user_{user_id}@example.com", loc])

        if len(batch) == batch_size:
            writer.writerows(batch)
            batch = []

    if batch:
        writer.writerows(batch)