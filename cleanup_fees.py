import re

with open('src/pages/dashboard/FeesPortal.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# I will write a regex or just manual replace to remove the unnecessary tabs and dummy data.
# It's easier to just use write_to_file with a totally new file that imports the components.
