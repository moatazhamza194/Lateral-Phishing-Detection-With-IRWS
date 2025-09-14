# Lateral Phishing Interactive Warning System

A Chrome extension that detects potential lateral phishing emails by analyzing senders, recipients, domains, and keywords. Suspicious messages trigger interactive reflection warnings with contextual questions and blurred previews, helping users recognize risks before acting.

> **Note**:  
> This tool is designed for **organizations** and depends on an organization's historical email data.  
> It will **not work for personal use**.
> That's why we provide you with samples from our "organization's" email history data set.
> Because this extension is designed for organization's, and we are testing it on our imaginary enron organization, some parts of the tool e.g. contacting email senders and security
in the case of phishing doesn't actually work. 

---

## 📖 Project Overview
The current model in this project is trained on a custom dataset created by **injecting the Enron email dataset** with lateral phishing emails. These phishing samples were generated using ChatGPT with different strategies.

We have provided **6 samples from the testing set**, located in:
- `demo/`
- `demo/legit/`

---

## How to Use

1. **Start the backend**  
   ```bash
   python backend/app.py
and wait until the server connects.

2. Open Chrome and go to chrome://extensions/
3. Enable Developer Mode
4. Click Load unpacked
5. Select the lateral-phishing-detector/ folder
6. Navigate to the demo/ directory
7. Open a phishing sample (e.g., demo/inbox_phish_1.html)
8. Or open a legit sample (e.g., demo/legit/inbox_legit_1.html)
9. After opening the inbox sample, click the single email that appears
10. The system will trigger an interactive warning for suspicious emails

## Directory Tree

project/
├── README.md
├── backend/
│   ├── app.py
│   ├── final_emails.csv
│   └── lateral_phishing_model.pkl
├── demo/
│   ├── email_phish_1.html
│   ├── email_phish_2.html
│   ├── email_phish_3.html
│   ├── gmail-screenshot.png
│   ├── inbox-screenshot.png
│   ├── inbox_phish_1.html
│   ├── inbox_phish_2.html
│   ├── inbox_phish_3.html
│   ├── style.css
│   └── legit/
│       ├── email_legit_1.html
│       ├── email_legit_2.html
│       ├── email_legit_3.html
│       ├── gmail-screenshot.png
│       ├── inbox-screenshot.png
│       ├── inbox_legit_1.html
│       ├── inbox_legit_2.html
│       ├── inbox_legit_3.html
│       └── style.css
├── lateral-phishing-detector/
│   ├── content.js
│   ├── icon128.png
│   ├── icon16.png
│   ├── icon48.png
│   ├── manifest.json
│   └── overlay.css
└── notebooks/
    ├── cleaned_emails.csv
    ├── cleaning.ipynb
    ├── emails_features.csv
    ├── extracting.ipynb
    ├── generated_phishing_emails.csv
    ├── injecting.ipynb
    └── model.ipynb
