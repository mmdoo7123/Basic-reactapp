import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import axios from 'axios';
import Sentiment from 'sentiment';
import { Pie, Bar } from 'react-chartjs-2';
import Papa from 'papaparse';
import { saveAs } from 'file-saver';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
} from 'chart.js';

// Register the required components
ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement 
);

function App() {
    const [tweets, setTweets] = useState([]);
    const [keyword, setKeyword] = useState('technology'); // Default keyword
    const [count, setCount] = useState(10); // Number of tweets to fetch
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [filter, setFilter] = useState('All'); // All, Positive, Negative, Neutral
    const sentiment = new Sentiment();
    const [source, setSource] = useState('Twitter'); // Default to Twitter
    const [lastRequestTimeTwitter, setLastRequestTimeTwitter] = useState(null); // Cooldown for Twitter
    const [lastRequestTimeNews, setLastRequestTimeNews] = useState(null); // Cooldown for Google News
    const [cooldownTwitter, setCooldownTwitter] = useState(0);
    const [cooldownNews, setCooldownNews] = useState(0);
    const TWITTER_COOLDOWN = 105 * 60; // 105 minutes in seconds
    const NEWS_COOLDOWN = 60; // 1 minute in seconds (free tier)

       // Fetch News Data
    const fetchGoogleNews = useCallback(() => {
        if (cooldownNews > 0) {
            setError(`Please wait ${cooldownNews} seconds before searching Google News again.`);
            return;
        }
        setLoading(true);
        setError('');

        axios.get('http://127.0.0.1:5000/news', { params: { keyword, count } })
            .then((response) => {
                setTweets(response.data.map(article => ({
                    id: article.url,
                    text: article.title,
                    description: article.description,
                    source: article.source,
                    publishedAt: article.published_at,
                })));
                setLastRequestTimeNews(Date.now());
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching news:', error);
                setError('Error fetching news. Please try again later.');
                setLoading(false);
            });
    }, [keyword, count, cooldownNews]);

    const handleSearch = () => {
        if (source === 'Twitter') {
            fetchTweets();
        } else if (source === 'GoogleNews') {
            fetchGoogleNews();
        }
    };

    // Twitter Cooldown Logic
    useEffect(() => {
        if (lastRequestTimeTwitter) {
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - lastRequestTimeTwitter) / 1000);
                const remainingCooldown = Math.max(TWITTER_COOLDOWN - elapsed, 0);
                setCooldownTwitter(remainingCooldown);

                if (remainingCooldown === 0) {
                    clearInterval(interval);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [lastRequestTimeTwitter]);

    // News Cooldown Logic
    useEffect(() => {
        if (lastRequestTimeNews) {
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - lastRequestTimeNews) / 1000);
                const remainingCooldown = Math.max(NEWS_COOLDOWN - elapsed, 0);
                setCooldownNews(remainingCooldown);

                if (remainingCooldown === 0) {
                    clearInterval(interval);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [lastRequestTimeNews]);

    // Analyze Tweets and Cache Results
    const analyzedTweets = useMemo(() => {
        return tweets.map((tweet) => {
            const analysis = sentiment.analyze(tweet.text);
            return {
                ...tweet,
                sentiment: analysis.score > 0 ? 'Positive' : analysis.score < 0 ? 'Negative' : 'Neutral',
                analysis,
            };
        });
    }, [tweets, sentiment]);
    
    const extractFrequentKeywords = (tweets, sentimentFilter, keyword) => {
        const filteredTweets =
            sentimentFilter === 'All'
                ? tweets // Include all tweets when "All" is selected
                : tweets.filter(tweet => tweet.sentiment === sentimentFilter);
    
        const wordCounts = {};
        const searchKeyword = keyword.toLowerCase();
        const stopwords = ['the', 'is', 'and', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by'];
    
        filteredTweets.forEach(tweet => {
            if (tweet.text) { // Ensure text exists
                const words = tweet.text.toLowerCase().split(/\W+/); // Split by non-word characters
                words.forEach(word => {
                    // Include words related to the search keyword and exclude stopwords
                    if (
                        !stopwords.includes(word) &&
                        (word.includes(searchKeyword) || searchKeyword.includes(word))
                    ) {
                        if (!wordCounts[word]) {
                            wordCounts[word] = 0;
                        }
                        wordCounts[word]++;
                    }
                });
            }
        });
    
        const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
        return sortedWords.slice(0, 10); // Return top 10 frequent keywords
    };
    
    const frequentKeywords = useMemo(() => {
        if (analyzedTweets.length > 0) {
            if (filter === 'All') {
                return extractFrequentKeywords(analyzedTweets, 'All', keyword);
            } else if (filter === 'Positive') {
                return extractFrequentKeywords(analyzedTweets, 'Positive', keyword);
            } else if (filter === 'Neutral') {
                return extractFrequentKeywords(analyzedTweets, 'Neutral', keyword);
            } else if (filter === 'Negative') {
                return extractFrequentKeywords(analyzedTweets, 'Negative', keyword);
            }
        }
        return [];
    }, [analyzedTweets, filter, keyword]);
    
    // Fetch Twitter Data
    const fetchTweets = useCallback(() => {
        if (cooldownTwitter > 0) {
            setError(`Please wait ${cooldownTwitter} seconds before searching Twitter again.`);
            return;
        }
        setLoading(true);
        setError('');

        axios.get('http://127.0.0.1:5000/tweets', { params: { keyword, count } })
            .then((response) => {
                setTweets(response.data);
                setLastRequestTimeTwitter(Date.now());
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching tweets:', error);
                setError('Error fetching tweets. Please try again later.');
                setLoading(false);
            });
    }, [keyword, count, cooldownTwitter]);

    // Export to CSV
    const exportToCSV = () => {
        const csvData = analyzedTweets.map((tweet) => ({
            User: tweet.user || "Unknown User",
            Text: tweet.text || "No Text",
            Sentiment: tweet.sentiment,
            Date: tweet.created_at
                ? new Date(tweet.created_at).toLocaleString()
                : "Unknown Date",
        }));
        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'tweets_sentiment.csv');
    };

    // Filtered Tweets
    const filteredTweets = analyzedTweets.filter((tweet) =>
        filter === 'All' || tweet.sentiment === filter
    );

    // Sentiment Distribution for Pie Chart
    const sentimentCounts = analyzedTweets.reduce(
        (acc, tweet) => {
            if (tweet.sentiment === 'Positive') acc.positive++;
            else if (tweet.sentiment === 'Negative') acc.negative++;
            else acc.neutral++;
            return acc;
        },
        { positive: 0, negative: 0, neutral: 0 }
    );

    const data = {
        labels: ['Positive', 'Neutral', 'Negative'],
        datasets: [
            {
                data: [sentimentCounts.positive, sentimentCounts.neutral, sentimentCounts.negative],
                backgroundColor: ['#4caf50', '#ffeb3b', '#f44336'],
            },
        ],
    };

    const keywordsData = {
        labels: frequentKeywords.length > 0 ? frequentKeywords.map(item => item[0]) : ['No Data'],
        datasets: [
            {
                label: `Frequent Keywords in ${filter} Tweets`,
                data: frequentKeywords.length > 0 ? frequentKeywords.map(item => item[1]) : [0],
                backgroundColor:
                    filter === 'Positive'
                        ? ['#4caf50']
                        : filter === 'Neutral'
                        ? ['#ffeb3b']
                        : filter === 'Negative'
                        ? ['#f44336']
                        : ['#2196f3'], // Use a distinct color for "All"
            },
        ],
    };
    const analyzePositiveThemes = (tweets) => {
        const positiveTweets = tweets.filter(tweet => tweet.sentiment === 'Positive');
        const wordCounts = {};
        const themes = [];
    
        positiveTweets.forEach(tweet => {
            if (tweet.text) { // Ensure text exists
                const words = tweet.text.toLowerCase().split(/\W+/);
                words.forEach(word => {
                    if (!wordCounts[word]) {
                        wordCounts[word] = 0;
                    }
                    wordCounts[word]++;
                });
            }
        });
    
        const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
        sortedWords.slice(0, 5).forEach(([word]) => {
            themes.push(word);
        });
    
        return themes.length > 0 ? themes : ['No recurring themes found'];
    };
    
    const analyzeNegativeIssues = (tweets) => {
        const negativeTweets = tweets.filter(tweet => tweet.sentiment === 'Negative');
        const wordCounts = {};
        const issues = [];
    
        negativeTweets.forEach(tweet => {
            if (tweet.text) { // Ensure text exists
                const words = tweet.text.toLowerCase().split(/\W+/);
                words.forEach(word => {
                    if (!wordCounts[word]) {
                        wordCounts[word] = 0;
                    }
                    wordCounts[word]++;
                });
            }
        });
    
        const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
        sortedWords.slice(0, 5).forEach(([word]) => {
            issues.push(word);
        });
    
        return issues.length > 0 ? issues : ['No recurring issues found'];
    };

    const analyzeNeutralEngagement = (tweets) => {
        const neutralTweets = tweets.filter(tweet => tweet.sentiment === 'Neutral');
        const wordCounts = {};
        const opportunities = [];
    
        neutralTweets.forEach(tweet => {
            if (tweet.text) { // Ensure text exists
                const words = tweet.text.toLowerCase().split(/\W+/);
                words.forEach(word => {
                    if (!wordCounts[word]) {
                        wordCounts[word] = 0;
                    }
                    wordCounts[word]++;
                });
            }
        });
    
        const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
        sortedWords.slice(0, 5).forEach(([word]) => {
            opportunities.push(word);
        });
    
        return opportunities.length > 0 ? opportunities : ['No engagement opportunities found'];
    };

    const positiveThemes = useMemo(() => {
        if (tweets.length > 0) {
            return analyzePositiveThemes(analyzedTweets);
        }
        return [];
    }, [analyzedTweets]);
    
    const negativeIssues = useMemo(() => {
        if (tweets.length > 0) {
            return analyzeNegativeIssues(analyzedTweets);
        }
        return [];
    }, [analyzedTweets]);
    
    const neutralOpportunities = useMemo(() => {
        if (tweets.length > 0) {
            return analyzeNeutralEngagement(analyzedTweets);
        }
        return [];
    }, [analyzedTweets]);
    
        
    return (
        <div className="App">
            <header className="App-header">
                <h1>Market Research Assistant</h1>
                <div className="source-selector">
                    <button
                        onClick={() => setSource('Twitter')}
                        className={source === 'Twitter' ? 'active' : ''}
                    >
                        Twitter
                    </button>
                    <button
                        onClick={() => setSource('GoogleNews')}
                        className={source === 'GoogleNews' ? 'active' : ''}
                    >
                        Google News
                    </button>
                </div>

                <div className="search-section">
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Enter keyword"
                        disabled={loading}
                    />
                    <input
                        type="number"
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        placeholder="Number of Results"
                        min="1"
                        disabled={loading}
                    />
                    <button onClick={handleSearch} disabled={loading}>
                        {loading ? 'Loading...' : `Search ${source}`}
                    </button>
                </div>

                {error && <p style={{ color: 'red' }}>{error}</p>}

                {/* Display Results */}
                <ul>
                    {tweets.map((item, index) => (
                        <li key={index}>
                            <h3>{item.text}</h3>
                            {item.description && <p>{item.description}</p>}
                            <p>
                                Source: {item.source} | Published: {new Date(item.publishedAt).toLocaleString()}
                            </p>
                            <p>Sentiment: {item.sentiment}</p>
                        </li>
                    ))}
                </ul>
            </header>
        </div>
    );
}
export default App;