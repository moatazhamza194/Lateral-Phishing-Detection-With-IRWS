from flask import Flask, request, jsonify
import joblib
import numpy as np
from flask_cors import CORS
import pandas as pd
import ast
from collections import defaultdict
from datetime import datetime, timedelta
import re
from urllib.parse import urlparse
from bs4 import BeautifulSoup

# === Load & Prepare History Data ===

file_path = 'final_emails.csv'
df = pd.read_csv(file_path)

df['Date'] = pd.to_datetime(df['Date'], errors='raise')

df['Recipients'] = df['Recipients'].apply(
    lambda x: set(email.strip().lower() for email in ast.literal_eval(x)) if pd.notnull(x) else set()
)

df['Domains'] = df['Domains'].apply(
    lambda x: set(domain.strip().lower() for domain in ast.literal_eval(x)) if pd.notnull(x) else set()
)


# Load top domains
url = "http://s3-us-west-1.amazonaws.com/umbrella-static/top-1m.csv.zip"
df_umbrella = pd.read_csv(url, compression='zip', header=None, names=['Rank', 'Domain'])
domain_rank = dict(zip(df_umbrella['Domain'], df_umbrella['Rank']))

# === Build History Indexes ===
domain_history = defaultdict(set)
recipient_history = defaultdict(list)

df = df.sort_values('Date').reset_index(drop=True)

for i, row in df.iterrows():
    current_date = row['Date'].date()
    sender = row['From']
    recipients = row['Recipients']
    domains = row['Domains']

    recipient_history[sender].append((current_date, recipients))
    domain_history[current_date].update(domains)

# === Feature Engineering Functions ===


def get_global_url_rank(domains, domain_rank, default_rank=10_000_000):
    if not domains:
        return default_rank
    ranks = [domain_rank.get(domain, default_rank) for domain in domains]
    return min(ranks)

def compute_local_url_freq(email_date, domains, domain_history):
    current_date = email_date.date()
    count = 0
    for delta in range(1, 31):
        prev_date = current_date - timedelta(days=delta)
        if domains & domain_history.get(prev_date, set()):
            count += 1
    return count

def compute_recipient_likelihood(current_date, sender, recipients, recipient_history):
    max_jaccard = 0.0
    for past_date, past_recipients in recipient_history.get(sender, []):
        days_diff = (current_date - past_date).days
        if 0 < days_diff <= 30:
            union = recipients | past_recipients
            if union:
                jaccard = len(recipients & past_recipients) / len(union)
                max_jaccard = max(max_jaccard, jaccard)
    return max_jaccard

def count_recipients(to_field):
    if not to_field:
        return 0
    recipients = [r.strip().lower() for r in to_field.split(",") if r.strip()]
    return len(set(recipients))


# === Load Model ===
model = joblib.load('lateral_phishing_model.pkl')

# === Setup Flask App ===
app = Flask(__name__)
CORS(app)

@app.route("/predict", methods=["POST"])
def predict():
    data = request.get_json()

    has_phishy_keywords = int(bool(data.get("has_phishy_keywords", 0)))
    domains = set(data.get("domains",""))
    sender = data.get("from", "")
    to_field = data.get("to", "")
    date_str = data.get("date", "")

    try:
        email_date = datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return jsonify({"error": "Invalid date format"}), 400

    recipients = set([r.strip().lower() for r in to_field.split(",") if r.strip()])
    domain = list(domains)[0]

    # === Final Feature Vector (5 total, in order) ===
    num_recipients = len(recipients)
    global_url_rank = get_global_url_rank(domains, domain_rank)
    local_url_freq = compute_local_url_freq(email_date, domains, domain_history)
    recipient_likelihood = compute_recipient_likelihood(email_date.date(), sender, recipients, recipient_history)

    features = [
        has_phishy_keywords,
        num_recipients,
        global_url_rank,
        local_url_freq,
        recipient_likelihood
    ]

    X = np.array(features).reshape(1, -1)
    proba = model.predict_proba(X)[0][1]
    label = int(proba >= 0.83)

    return jsonify({
        "label": label,
        "features_used": {
            "HasPhishyKeywords": has_phishy_keywords,
            "NumRecipients": num_recipients,
            "GlobalURLRank": global_url_rank,
            "LocalURLFreq": local_url_freq,
            "RecipientLikelihood": round(recipient_likelihood, 4)
        },
        "domain": domain
    })

if __name__ == "__main__":
    app.run(debug=True)
    
