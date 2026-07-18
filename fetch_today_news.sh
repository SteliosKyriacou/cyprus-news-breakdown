#!/bin/bash
# Fetch news from the last 1 day and append to the existing data
source .venv/bin/activate
python scripts/fetch_news.py --days 1 --append
