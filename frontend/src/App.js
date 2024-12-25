import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import axios from 'axios';
import Sentiment from 'sentiment';
import { Pie } from 'react-chartjs-2';
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
} from 'chart.js';

// Register the required components
ChartJS.register(
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement
);

function App() {
    const [tweets, setTweets] = useState([]);
    const [keyword, setKeyword] = useState('technology'); // Default keyword
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastRequestTime, setLastRequestTime] = useState(null); // To track the last request time
    const [cooldown, setCooldown] = useState(0);
    const [filter, setFilter] = useState('All'); // All, Positive, Negative, Neutral
    const sentiment = new Sentiment();

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

    // Fetch Tweets
    const fetchTweets = useCallback(() => {
        if (cooldown > 0) {
            setError(`Please wait ${cooldown} seconds before searching again.`);
            return;
        }

        setLoading(true);
        setError('');

        axios.get('http://127.0.0.1:5000/tweets', { params: { keyword, count: 10 } })
            .then((response) => {
                setTweets(response.data); // Set tweets data
                setLastRequestTime(Date.now()); // Update last successful request time
                setLoading(false);
            })
            .catch((error) => {
                console.error('Error fetching tweets:', error);
                if (error.response?.status === 429) {
                    setError('Rate limit exceeded. Please wait 15 minutes.');
                    setLastRequestTime(lastRequestTime || Date.now()); // Start cooldown if rate limit exceeded
                } else {
                    setError('Error fetching tweets. Please try again later.');
                }
                setLoading(false);
            });
    }, [keyword, cooldown, lastRequestTime]);

    // Export to CSV
    const exportToCSV = () => {
        const csvData = tweets.map((tweet) => {
            const analysis = sentiment.analyze(tweet.text);
            const sentimentText = analysis.score > 0
                ? 'Positive'
                : analysis.score < 0
                ? 'Negative'
                : 'Neutral';

            return {
                User: tweet.user,
                Text: tweet.text,
                Sentiment: sentimentText,
                Date: new Date(tweet.created_at).toLocaleString(),
            };
        });

        const csv = Papa.unparse(csvData);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        saveAs(blob, 'tweets_sentiment.csv');
    };

    // Filtered Tweets
    const filteredTweets = tweets.filter((tweet) => {
        const analysis = sentiment.analyze(tweet.text);
        const sentimentText = analysis.score > 0
            ? 'Positive'
            : analysis.score < 0
            ? 'Negative'
            : 'Neutral';

        return filter === 'All' || sentimentText === filter;
    });

    // Sentiment Distribution for Pie Chart
    const sentimentCounts = tweets.reduce(
        (acc, tweet) => {
            const analysis = sentiment.analyze(tweet.text);
            if (analysis.score > 0) acc.positive++;
            else if (analysis.score < 0) acc.negative++;
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
                        disabled={cooldown > 0 || loading} // Disable input during cooldown or loading
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
                </div>
                {loading && <p>Loading tweets...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <ul>
                    {filteredTweets.map((tweet) => {
                        const analysis = sentiment.analyze(tweet.text);
                        const sentimentText = analysis.score > 0
                            ? 'Positive'
                            : analysis.score < 0
                            ? 'Negative'
                            : 'Neutral';

                        return (
                            <li key={tweet.id}>
                                <p><strong>{tweet.user}</strong>: {tweet.text}</p>
                                <p>Sentiment: <strong>{sentimentText}</strong></p>
                                <p><small>{new Date(tweet.created_at).toLocaleString()}</small></p>
                            </li>
                        );
                    })}
                </ul>
                <Pie data={data} />
            </header>
        </div>
    );
}

export default App;
