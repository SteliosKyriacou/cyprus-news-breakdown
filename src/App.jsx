import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Newspaper, BarChart2, Globe, ArrowUpRight, Clock } from 'lucide-react';
import './index.css';

// Using dummy data if the fetch script hasn't run or JSON is unavailable
const dummyData = {
  lastUpdated: new Date().toISOString(),
  stories: [
    {
      headline: "UN Envoy Continues Talks with Cypriot Leaders",
      summary: "The United Nations personal envoy for Cyprus has concluded a new round of meetings with Greek Cypriot and Turkish Cypriot leaders, seeking common ground for resuming peace negotiations.",
      biasDistribution: { "Left": 2, "Center-Left": 1, "Center": 0, "Center-Right": 2, "Right": 1 },
      communityCoverage: { "Greek": 4, "Turkish": 2, "English": 1 },
      articles: [
        { source: "Haravgi", title: "UN Envoy pushes for immediate resumption of talks", link: "#", bias: "Left", community: "Greek" },
        { source: "Phileleftheros", title: "Stalemate remains after latest UN meetings", link: "#", bias: "Center-Right", community: "Greek" },
        { source: "Yeniduzen", title: "Hope for new negotiations as UN envoy meets leaders", link: "#", bias: "Left", community: "Turkish" },
        { source: "Cyprus Mail", title: "Leaders hold their ground in UN talks", link: "#", bias: "Center-Right", community: "English" }
      ]
    },
    {
      headline: "New Solar Energy Park Inaugurated in Nicosia District",
      summary: "A massive new solar energy facility has opened, promising to provide electricity to over 10,000 homes. Government officials hailed it as a major step towards green energy goals.",
      biasDistribution: { "Left": 0, "Center-Left": 1, "Center": 0, "Center-Right": 1, "Right": 0 },
      communityCoverage: { "Greek": 2, "Turkish": 0, "English": 1 },
      articles: [
        { source: "Politis", title: "Green transition accelerates with new solar park", link: "#", bias: "Center-Left", community: "Greek" },
        { source: "Alithia", title: "Government inaugurates flagship energy project", link: "#", bias: "Right", community: "Greek" }
      ]
    }
  ]
};

const BiasBar = ({ dist }) => {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="bar-chart"><div className="bar-segment" style={{width: '100%', background: '#333'}}></div></div>;

  return (
    <div>
      <div className="bar-chart">
        {dist["Left"] > 0 && <div className="bar-segment bias-left" style={{ width: `${(dist["Left"] / total) * 100}%` }} title={`Left: ${dist["Left"]}`}></div>}
        {dist["Center-Left"] > 0 && <div className="bar-segment bias-center-left" style={{ width: `${(dist["Center-Left"] / total) * 100}%` }} title={`Center-Left: ${dist["Center-Left"]}`}></div>}
        {dist["Center"] > 0 && <div className="bar-segment bias-center" style={{ width: `${(dist["Center"] / total) * 100}%` }} title={`Center: ${dist["Center"]}`}></div>}
        {dist["Center-Right"] > 0 && <div className="bar-segment bias-center-right" style={{ width: `${(dist["Center-Right"] / total) * 100}%` }} title={`Center-Right: ${dist["Center-Right"]}`}></div>}
        {dist["Right"] > 0 && <div className="bar-segment bias-right" style={{ width: `${(dist["Right"] / total) * 100}%` }} title={`Right: ${dist["Right"]}`}></div>}
      </div>
      <div className="bar-legend">
        <div className="legend-item"><div className="legend-dot bias-left"></div> Left</div>
        <div className="legend-item"><div className="legend-dot bias-center"></div> Center</div>
        <div className="legend-item"><div className="legend-dot bias-right"></div> Right</div>
      </div>
    </div>
  );
};

const CommunityBar = ({ dist }) => {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (total === 0) return <div className="bar-chart"><div className="bar-segment" style={{width: '100%', background: '#333'}}></div></div>;

  return (
    <div>
      <div className="bar-chart">
        {dist["Greek"] > 0 && <div className="bar-segment comm-greek" style={{ width: `${(dist["Greek"] / total) * 100}%` }} title={`Greek: ${dist["Greek"]}`}></div>}
        {dist["Turkish"] > 0 && <div className="bar-segment comm-turkish" style={{ width: `${(dist["Turkish"] / total) * 100}%` }} title={`Turkish: ${dist["Turkish"]}`}></div>}
        {dist["English"] > 0 && <div className="bar-segment comm-english" style={{ width: `${(dist["English"] / total) * 100}%` }} title={`English: ${dist["English"]}`}></div>}
      </div>
      <div className="bar-legend">
        <div className="legend-item"><div className="legend-dot comm-greek"></div> Greek</div>
        <div className="legend-item"><div className="legend-dot comm-turkish"></div> Turkish</div>
        <div className="legend-item"><div className="legend-dot comm-english"></div> English</div>
      </div>
    </div>
  );
};

function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [communityFilter, setCommunityFilter] = useState('All');

  useEffect(() => {
    // In production, this fetches from the static JSON file generated by GitHub Actions
    // If it fails (e.g. local dev before first action run), we fallback to dummy data
    fetch(`${import.meta.env.BASE_URL}data/news.json?t=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error("JSON not found");
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.log("Using fallback dummy data:", err);
        setData(dummyData);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="loader-container">
        <div className="loader"></div>
        <p className="subtitle">Analyzing across the spectrum...</p>
      </div>
    );
  }

  const filteredStories = data.stories.filter(story => {
    const matchesSearch = story.headline.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          story.summary.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCommunity = communityFilter === 'All' || 
                             (story.communityCoverage && story.communityCoverage[communityFilter] > 0);
    return matchesSearch && matchesCommunity;
  });

  return (
    <div className="container">
      <header>
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <h1>Cyprus News Breakdown</h1>
          <p className="subtitle">Breaking out of echo chambers. See the full spectrum of Cypriot media.</p>
          {data.lastUpdated && (
            <p style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              <Clock size={16} /> Last updated: {new Date(data.lastUpdated).toLocaleString()}
            </p>
          )}
        </motion.div>
      </header>

      <div className="controls-bar glass" style={{ padding: '1rem 1.5rem', borderRadius: '12px', display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input 
          type="text" 
          placeholder="Search news..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--card-border)', background: '#121212', color: 'var(--text-main)', outline: 'none', minWidth: '200px' }}
        />
        <select 
          value={communityFilter}
          onChange={(e) => setCommunityFilter(e.target.value)}
          style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--card-border)', background: '#121212', color: 'var(--text-main)', outline: 'none', cursor: 'pointer' }}
        >
          <option value="All">All Communities</option>
          <option value="Greek">Greek Cypriot</option>
          <option value="Turkish">Turkish Cypriot</option>
          <option value="English">English Media</option>
        </select>
      </div>

      <main>
        <AnimatePresence>
          {filteredStories.length === 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <h3>No stories match your filters.</h3>
            </motion.div>
          ) : (
            filteredStories.map((story, idx) => (
              <motion.div 
                key={idx}
                className="story-card glass"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: idx * 0.1 }}
              >
              <div className="story-header">
                <h2 className="story-title">{story.headline}</h2>
                <p className="story-summary">{story.summary}</p>
                {story.factualityStatement && (
                  <div className="story-factuality" style={{ marginTop: '1rem', padding: '1rem', background: '#121212', borderRadius: '8px', borderLeft: '4px solid #3b82f6' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6' }}>Verified Facts</h4>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>{story.factualityStatement}</p>
                  </div>
                )}
                {story.shortAnalysis && (
                  <div className="story-analysis" style={{ marginTop: '1rem', padding: '1rem', background: '#121212', borderRadius: '8px', borderLeft: '4px solid #a855f7' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a855f7' }}>Media Analysis</h4>
                    <p style={{ margin: 0, fontSize: '0.95rem' }}>{story.shortAnalysis}</p>
                  </div>
                )}
              </div>

              <div className="metrics-container">
                <div className="metric-box">
                  <h3 className="metric-title"><BarChart2 size={18} /> Political Bias</h3>
                  <BiasBar dist={story.biasDistribution || {}} />
                </div>
                <div className="metric-box">
                  <h3 className="metric-title"><Globe size={18} /> Community Coverage</h3>
                  <CommunityBar dist={story.communityCoverage || {}} />
                </div>
              </div>

              <div>
                <h3 className="metric-title" style={{ marginBottom: '1rem' }}><Newspaper size={18} /> Source Articles</h3>
                <div className="articles-list">
                  {story.articles.map((article, aIdx) => (
                    <a href={article.link} target="_blank" rel="noopener noreferrer" className="article-item" key={aIdx}>
                      <div className="article-source">{article.source}</div>
                      <div className="article-title">{article.title} <ArrowUpRight size={14} style={{display:'inline', opacity: 0.5}} /></div>
                      <div className="article-tags">
                        <span className="tag tag-bias">Bias: {article.bias}</span>
                        <span className="tag tag-comm">Comm: {article.community}</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            </motion.div>
          )))}
        </AnimatePresence>
      </main>
    </div>
  );
}

export default App;
