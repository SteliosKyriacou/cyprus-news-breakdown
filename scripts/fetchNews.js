import Parser from 'rss-parser';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const NEWS_SOURCES = [
  { name: 'Cyprus Mail', url: 'https://cyprus-mail.com/feed/', community: 'English', bias: 'Center-Right' },
  { name: 'Phileleftheros', url: 'https://www.philenews.com/feed/', community: 'Greek', bias: 'Center-Right' },
  { name: 'Politis', url: 'https://politis.com.cy/feed', community: 'Greek', bias: 'Center-Left' },
  { name: 'Haravgi', url: 'https://dialogos.com.cy/feed/', community: 'Greek', bias: 'Left' },
  { name: 'Alithia', url: 'https://alithia.com.cy/feed/', community: 'Greek', bias: 'Right' },
  // { name: 'Kibris', url: 'https://www.kibrisgazetesi.com/rss', community: 'Turkish', bias: 'Center-Right' }, // some RSS are hit and miss, we can adjust
  { name: 'Yeniduzen', url: 'https://www.yeniduzen.com/rss.xml', community: 'Turkish', bias: 'Left' }
];

async function fetchAllFeeds() {
  const parser = new Parser();
  const allArticles = [];

  for (const source of NEWS_SOURCES) {
    try {
      console.log(`Fetching from ${source.name}...`);
      const feed = await parser.parseURL(source.url);
      
      // Get top 5 articles per source to avoid overwhelming the API
      const topItems = feed.items.slice(0, 5);
      
      topItems.forEach(item => {
        allArticles.push({
          source: source.name,
          community: source.community,
          bias: source.bias,
          title: item.title,
          link: item.link,
          pubDate: item.pubDate,
          content: item.contentSnippet || item.content || ''
        });
      });
    } catch (error) {
      console.error(`Failed to fetch ${source.name}:`, error.message);
    }
  }

  return allArticles;
}

async function analyzeWithGemini(articles) {
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use appropriate fast/cheap model

  const prompt = `
  You are an expert political analyst in Cyprus. 
  I will provide you with a list of recent news articles from various Cypriot news sources.
  Group them into "Stories" (clusters of articles talking about the exact same event or topic).
  
  For each Story, provide:
  1. A neutral 'headline'
  2. A 'summary' (2-3 sentences)
  3. A 'biasDistribution' object counting how many sources from each bias covered it (Left, Center-Left, Center, Center-Right, Right)
  4. A 'communityCoverage' object counting how many sources from each community covered it (Greek, Turkish, English)
  5. The list of 'articles' (including source, title, link, bias, community) that belong to this story.
  
  Return the output as a clean JSON array of story objects. Do not include markdown formatting like \`\`\`json.
  
  Articles:
  ${JSON.stringify(articles)}
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Clean up markdown if model still included it
    text = text.replace(/^```json/m, '').replace(/```$/m, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Failed to analyze with Gemini:", error);
    return [];
  }
}

async function main() {
  if (!process.env.GEMINI_API_KEY) {
    console.error("Error: GEMINI_API_KEY not found in .env");
    process.exit(1);
  }

  console.log("Fetching news feeds...");
  const articles = await fetchAllFeeds();
  console.log(`Fetched ${articles.length} total articles.`);

  console.log("Analyzing and clustering stories with Gemini...");
  const analyzedStories = await analyzeWithGemini(articles);

  const dataDir = path.join(__dirname, '../public/data');
  await fs.mkdir(dataDir, { recursive: true });

  const outputFile = path.join(dataDir, 'news.json');
  
  const finalData = {
    lastUpdated: new Date().toISOString(),
    stories: analyzedStories
  };

  await fs.writeFile(outputFile, JSON.stringify(finalData, null, 2));
  console.log(`Saved analyzed stories to ${outputFile}`);
}

main();
