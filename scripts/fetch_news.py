import feedparser
import json
import os
import time
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv
from google import genai
from google.genai import types

# Load environment variables
load_dotenv()

# Initialize Gemini client using Vertex AI with Application Default Credentials
# This completely bypasses the AI Studio free tier limits by routing through their paid GCP project.
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

def fetch_all_feeds():
    all_articles = []
    
    for source in NEWS_SOURCES:
        try:
            print(f"Fetching from {source['name']}...")
            feed = feedparser.parse(source['url'])
            
            # Check for errors in feed
            if hasattr(feed, 'status') and feed.status >= 400:
                print(f"Failed to fetch {source['name']}: Status code {feed.status}")
                continue

            top_items = feed.entries[:5]
            
            for item in top_items:
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
        except Exception as e:
            print(f"Failed to fetch {source['name']}: {str(e)}")
            
    return all_articles

def analyze_with_gemini(articles):
    # To avoid hitting API free limits, cap the articles sent for analysis to 30.
    articles_to_analyze = articles[:30]

    prompt = f"""
  You are an expert political analyst in Cyprus. 
  I will provide you with a list of recent news articles from various Cypriot news sources.
  Group them into "Stories" (clusters of articles talking about the exact same event or topic).
  
  For each Story, provide:
  1. A neutral 'headline'
  2. A 'summary' (2-3 sentences)
  3. A 'biasDistribution' object counting how many sources from each bias covered it (Left, Center-Left, Center, Center-Right, Right)
  4. A 'communityCoverage' object counting how many sources from each community covered it (Greek, Turkish, English)
  5. The list of 'articles' (including source, title, link, bias, community) that belong to this story.
  
  Return the output as a clean JSON array of story objects. Do not include markdown formatting like ```json.
  
  Articles:
  {json.dumps(articles_to_analyze)}
  """

    attempt = 0
    max_attempts = 5
    while attempt < max_attempts:
        try:
            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            text = response.text
            
            # Clean up markdown if model still included it
            text = text.replace('```json', '').replace('```', '').strip()
            
            return json.loads(text)
        except Exception as e:
            error_msg = str(e)
            if '429' in error_msg or 'Quota' in error_msg:
                print(f"[Attempt {attempt + 1}] Rate limit hit: {error_msg}")
                print("Waiting 60 seconds before retrying...")
                time.sleep(60)
                attempt += 1
            else:
                print(f"Failed to analyze with Gemini: {error_msg}")
                return []
                
    print("Failed to analyze after maximum retries due to rate limit.")
    return []

def main():
    print("Fetching news feeds...")
    articles = fetch_all_feeds()
    print(f"Fetched {len(articles)} total articles.")

    print("Analyzing and clustering stories with Gemini...")
    analyzed_stories = analyze_with_gemini(articles)

    data_dir = Path(__file__).parent.parent / 'public' / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)

    output_file = data_dir / 'news.json'
    
    final_data = {
        "lastUpdated": datetime.utcnow().isoformat() + "Z",
        "stories": analyzed_stories
    }

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(final_data, f, indent=2, ensure_ascii=False)
        
    print(f"Saved analyzed stories to {output_file}")

if __name__ == "__main__":
    main()
