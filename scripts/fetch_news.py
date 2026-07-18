import feedparser
import json
import os
import time
import argparse
from datetime import datetime, timedelta
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# Initialize Gemini client using Vertex AI
client = genai.Client(vertexai=True, project="ai-pipeline-461818", location="us-central1")

NEWS_SOURCES = [
    { "name": 'Cyprus Mail', "url": 'https://cyprus-mail.com/feed/', "community": 'English', "bias": 'Center-Right' },
    { "name": 'Phileleftheros', "url": 'https://www.philenews.com/feed/', "community": 'Greek', "bias": 'Center-Right' },
    { "name": 'Politis', "url": 'https://politis.com.cy/feed', "community": 'Greek', "bias": 'Center-Left' },
    { "name": 'Haravgi', "url": 'https://dialogos.com.cy/feed/', "community": 'Greek', "bias": 'Left' },
    { "name": 'Alithia', "url": 'https://alithia.com.cy/feed/', "community": 'Greek', "bias": 'Right' },
    { "name": 'Yeni Duzen', "url": 'https://www.yeniduzen.com/rss', "community": 'Turkish', "bias": 'Left' },
    { "name": 'Kibris Postasi', "url": 'https://www.kibrispostasi.com/rss', "community": 'Turkish', "bias": 'Center-Right' }
]

def fetch_all_feeds(days=7):
    all_articles = []
    
    # Calculate timestamp for X days ago
    days_ago = datetime.now() - timedelta(days=days)
    
    for source in NEWS_SOURCES:
        try:
            print(f"Fetching from {source['name']}...")
            feed = feedparser.parse(source['url'])
            
            # Check for errors in feed
            if hasattr(feed, 'status') and feed.status >= 400:
                print(f"Failed to fetch {source['name']}: Status code {feed.status}")
                continue

            # Loop through all entries and filter by the last X days
            valid_items = 0
            for item in feed.entries:
                try:
                    if hasattr(item, 'published_parsed') and item.published_parsed:
                        pub_date = datetime.fromtimestamp(time.mktime(item.published_parsed))
                        if pub_date < days_ago:
                            continue # Skip items older than X days
                except Exception:
                    pass # If date parsing fails, keep it to be safe
                
                content = getattr(item, 'summary', '')
                if hasattr(item, 'content'):
                    content = item.content[0].value
                
                all_articles.append({
                    "source": source["name"],
                    "community": source["community"],
                    "bias": source["bias"],
                    "title": item.get('title', ''),
                    "link": item.get('link', ''),
                    "pubDate": item.get('published', ''),
                    "content": content
                })
                valid_items += 1
                
            print(f" -> Found {valid_items} articles from the last {days} days.")
        except Exception as e:
            print(f"Failed to fetch {source['name']}: {str(e)}")
            
    return all_articles

def analyze_with_gemini(articles, days=7):
    # Pass all articles to the model since we are using the enterprise Vertex AI
    prompt = f"""
  You are an expert political analyst in Cyprus. 
  I will provide you with a massive list of news articles published in the last {days} days from various Cypriot news sources across Greek, Turkish, and English communities.
  Your task is to translate and aggressively correlate these articles, grouping them into "Stories" (clusters of articles talking about the exact same event, topic, or overarching issue).
  
  CRITICAL: You are equipped with a Google Search tool. You MUST use it to search for related events in Cyprus this week to fill in gaps. For example, if a Greek article talks about an event, search the web to see how the Turkish or English press covered it this week, and intelligently link them together into the same Story!
  Pay special attention to linking Turkish, Greek, and English articles together if they discuss the same political event, policy, or regional issue.
  
  For each Story, provide:
  1. A neutral 'headline'
  2. A 'summary' (2-3 sentences)
  3. A 'shortAnalysis' (string) providing a short analysis commenting on differences between reportings from the different political views and communities. Look for agreements and disagreements.
  4. A 'factualityStatement' (string) providing a factuality statement summarizing the core verified facts of the event based on your search and the articles.
  5. A 'biasDistribution' object counting how many sources from each bias covered it (Left, Center-Left, Center, Center-Right, Right)
  6. A 'communityCoverage' object counting how many sources from each community covered it (Greek, Turkish, English)
  7. The list of 'articles' (including source, title, link, bias, community) that belong to this story.
  
  Return the output as a clean JSON array of story objects. Do not include markdown formatting like ```json.
  
  Articles:
  {json.dumps(articles)}
  """

    attempt = 0
    max_attempts = 5
    while attempt < max_attempts:
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[{"google_search": {}}],
                    temperature=0.2
                )
            )
            text = response.text
            
            # Clean up markdown if model still included it
            text = text.replace('```json', '').replace('```', '').strip()
            
            return json.loads(text)
        except Exception as e:
            error_msg = str(e)
            if '429' in error_msg or 'Quota' in error_msg or '503' in error_msg or 'UNAVAILABLE' in error_msg:
                print(f"[Attempt {attempt + 1}] Transient error or rate limit hit: {error_msg}")
                print("Waiting 60 seconds before retrying...")
                time.sleep(60)
                attempt += 1
            else:
                print(f"Failed to analyze with Gemini: {error_msg}")
                return []
                
    print("Failed to analyze after maximum retries due to rate limit.")
    return []

def main():
    parser = argparse.ArgumentParser(description="Fetch and analyze Cyprus news.")
    parser.add_argument('--days', type=int, default=7, help='Number of days to look back.')
    parser.add_argument('--append', action='store_true', help='Append to existing news instead of overwriting.')
    args = parser.parse_args()

    print(f"Fetching news feeds for the past {args.days} days...")
    articles = fetch_all_feeds(args.days)
    print(f"Fetched {len(articles)} total articles.")
    
    if not articles:
        print("No articles found in the given timeframe.")
        return

    print("Analyzing and clustering stories with Gemini (with Google Search Grounding)...")
    # Cap articles to 15 to prevent massive payloads from hanging the Gemini API
    if len(articles) > 15:
        print(f"Capping articles from {len(articles)} to 15 to ensure API stability.")
        # Try to keep a mix from different communities
        # For simplicity, we just take the first 15, but since they are appended by source, 
        # let's distribute them by taking every Nth article or just slicing.
        # We can just take the first 15 for now, or better, evenly sample.
        step = len(articles) / 15
        sampled_articles = [articles[int(i * step)] for i in range(15)]
        articles_to_analyze = sampled_articles
    else:
        articles_to_analyze = articles

    analyzed_stories = analyze_with_gemini(articles_to_analyze, args.days)

    data_dir = Path(__file__).parent.parent / 'public' / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)

    output_file = data_dir / 'news.json'
    
    final_stories = analyzed_stories
    
    if args.append and output_file.exists():
        try:
            with open(output_file, 'r', encoding='utf-8') as f:
                existing_data = json.load(f)
                existing_stories = existing_data.get("stories", [])
                # Prepend new stories so they appear first
                final_stories = analyzed_stories + existing_stories
        except Exception as e:
            print(f"Error loading existing news: {e}")

    final_data = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "stories": final_stories
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)
        
    print(f"Saved analyzed stories to {output_file}")

if __name__ == "__main__":
    main()
