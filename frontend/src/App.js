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
    const [lastRequestTime, setLastRequestTime] = useState(null); // To track the last request time
    const [cooldown, setCooldown] = useState(0);
    const [filter, setFilter] = useState('All'); // All, Positive, Negative, Neutral
    const sentiment = new Sentiment();
    const [positiveThemes, setPositiveThemes] = useState([]);
    const [negativeIssues, setNegativeIssues] = useState([]);
    const [neutralOpportunities, setNeutralOpportunities] = useState([]);
    
    // Cooldown Timer Logic
    useEffect(() => {
        if (lastRequestTime) {
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - lastRequestTime) / 1000); // Seconds since last request
                const remainingCooldown = Math.max(15 * 60 - elapsed, 0); // Cooldown is 15 minutes
                setCooldown(remainingCooldown);

                if (remainingCooldown === 0) {
                    clearInterval(interval);
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [lastRequestTime]);

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
    
    // Fetch Tweets
    const fetchTweets = useCallback(() => {
        if (cooldown > 0) {
            setError(`Please wait ${cooldown} seconds before searching again.`);
            return;
        }
        setLoading(true);
        setError('');
    
        axios.get('http://127.0.0.1:5000/tweets', { params: { keyword, count } })
            .then((response) => {
                setTweets(response.data); // Set tweets data
                setLastRequestTime(Date.now()); // Update last successful request time
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching tweets:', error);
                setError('Error fetching tweets. Please try again later.');
                setLoading(false);
            });
    }, [keyword, count, cooldown]);
    
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
            const words = tweet.text.toLowerCase().split(/\W+/);
            words.forEach(word => {
                if (!wordCounts[word]) {
                    wordCounts[word] = 0;
                }
                wordCounts[word]++;
            });
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
        const words = tweet.text.toLowerCase().split(/\W+/);
        words.forEach(word => {
            if (!wordCounts[word]) {
                wordCounts[word] = 0;
            }
            wordCounts[word]++;
        });
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
        const words = tweet.text.toLowerCase().split(/\W+/);
        words.forEach(word => {
            if (!wordCounts[word]) {
                wordCounts[word] = 0;
            }
            wordCounts[word]++;
        });
    });

    const sortedWords = Object.entries(wordCounts).sort((a, b) => b[1] - a[1]);
    sortedWords.slice(0, 5).forEach(([word]) => {
        opportunities.push(word);
    });

    return opportunities.length > 0 ? opportunities : ['No engagement opportunities found'];
};
useEffect(() => {
    if (tweets.length > 0) {
        setPositiveThemes(analyzePositiveThemes(analyzedTweets));
        setNegativeIssues(analyzeNegativeIssues(analyzedTweets));
        setNeutralOpportunities(analyzeNeutralEngagement(analyzedTweets));
    }
}, [analyzedTweets]);

        
    return (
        <div className="App">
            <header className="App-header">
                <h1>Market Research Assistant</h1>
                <div>
                    <input
                        type="text"
                        value={keyword}
                        onChange={(e) => setKeyword(e.target.value)}
                        placeholder="Enter keyword"
                        disabled={cooldown > 0 || loading}
                    />
                    <input
                        type="number"
                        value={count}
                        onChange={(e) => setCount(Number(e.target.value))}
                        placeholder="Number of Tweets"
                        min="1"
                    />
                    <button onClick={fetchTweets} disabled={cooldown > 0 || loading}>
                        {cooldown > 0 ? `Wait ${cooldown} seconds` : 'Search Tweets'}
                    </button>
                    <button onClick={exportToCSV}>Export as CSV</button>
                    <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                        <option value="All">All</option>
                        <option value="Positive">Positive</option>
                        <option value="Neutral">Neutral</option>
                        <option value="Negative">Negative</option>
                    </select>        
                    <h3>High Positive Sentiment</h3>
                    <ul>
                        {positiveThemes.map((theme, index) => (
                            <li key={index}>{theme}</li>
                        ))}
                    </ul>

                    <h3>High Negative Sentiment</h3>
                    <ul>
                        {negativeIssues.map((issue, index) => (
                            <li key={index}>{issue}</li>
                        ))}
                    </ul>

                    <h3>Neutral Sentiment Dominance</h3>
                    <ul>
                        {neutralOpportunities.map((opportunity, index) => (
                            <li key={index}>{opportunity}</li>
                        ))}
                    </ul>
                </div>

                {loading && <p>Loading tweets...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <ul>
                    {filteredTweets.map((tweet) => (
                        <li key={tweet.id}>
                            <p><strong>{tweet.user}</strong>: {tweet.text}</p>
                            <p>Sentiment: <strong>{tweet.sentiment}</strong></p>
                            <p><small>{new Date(tweet.created_at).toLocaleString()}</small></p>
                        </li>
                    ))}
                </ul>
                <Pie data={data} />
                <Bar data={keywordsData} />
            </header>
        </div>
    );
}

export default App;
