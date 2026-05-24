import csv
import random

# 1. Configuration for the existing "eligible" range (3 million total)
eligible_start = 1_000_001
eligible_end = 4_000_000
desired_eligible_count = 1_700_000

# 2. Configuration for the new "unmatched" records
new_records_start = 4_000_001
new_records_count = 20_000

print("Generating random sample from eligible users...")
# Memory-efficient sampling without materializing the entire 3 million range
eligible_sample = random.sample(range(eligible_start, eligible_end + 1), desired_eligible_count)

print("Generating new unmatched records...")
new_records = list(range(new_records_start, new_records_start + new_records_count))

# Combine both lists
final_targeting_list = eligible_sample + new_records

# Sort them so the CSV looks clean and organized
final_targeting_list.sort()

# 3. Write to targeting_list.csv
output_filename = "targeting_list.csv"
print(f"Writing to {output_filename}...")

with open(output_filename, mode="w", newline="") as file:
    writer = csv.writer(file)
    # Added "email" to the header
    writer.writerow(["user_id", "email"])  
    
    for user_id in final_targeting_list:
        # Dynamically generate a dummy email for each user ID
        email = f"user_{user_id}@example.com"
        writer.writerow([user_id, email])

print(f"\nSuccess! '{output_filename}' created.")
print(f"-> Total records: {len(final_targeting_list):,}")
print(f"-> Matches inside eligible_users: {desired_eligible_count:,}")
print(f"-> Unmatched records (4,000,001+): {new_records_count:,}")