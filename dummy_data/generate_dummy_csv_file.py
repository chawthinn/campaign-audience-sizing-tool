import csv

# Ask the user for the filename
filename = input("Enter the filename (e.g., eligible_users.csv): ").strip()

# Ensure the filename ends with .csv
if not filename.lower().endswith('.csv'):
    filename += '.csv'

# Ask the user for the total number of records
while True:
    try:
        total_records = int(input("Enter the total number of records to generate: "))
        if total_records > 0:
            break
        print("Please enter a number greater than 0.")
    except ValueError:
        print("Invalid input. Please enter a valid whole number.")

print(f"\nGenerating {total_records:,} records in '{filename}'...")

# Generate the file with both user_id and email columns
with open(filename, mode='w', newline='') as file:
    writer = csv.writer(file)
    
    # Updated header row
    writer.writerow(["user_id", "email"])
    
    # Generator expression creating [user_id, email] pairs on the fly
    writer.writerows(
        [[i, f"user_{i}@example.com"] for i in range(1000001, 1000001 + total_records)]
    )

print(f"Success! '{filename}' has been created with dummy emails.")