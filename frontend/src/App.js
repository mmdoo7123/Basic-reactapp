import React, { useState, useEffect, useCallback } from 'react';
import './App.css';
import axios from 'axios';

function App() {
    const [tweets, setTweets] = useState([]);
    const [keyword, setKeyword] = useState('technology'); // Default keyword
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [lastRequestTime, setLastRequestTime] = useState(null); // To track the last request time
    const [cooldown, setCooldown] = useState(0);

    useEffect(() => {
        if (lastRequestTime) {
            const interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - lastRequestTime) / 1000); // Seconds since last request
                const remainingCooldown = Math.max(15 * 60 - elapsed, 0); // Cooldown is 15 minutes
                setCooldown(remainingCooldown);

                // Stop the timer when cooldown reaches 0
                if (remainingCooldown === 0) {
                    clearInterval(interval);
                }
            }, 1000); // Update every second
            return () => clearInterval(interval); // Cleanup on component unmount or re-render
        }
    }, [lastRequestTime]);

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
                setLoading(false);
                setLastRequestTime(Date.now()); // Update last successful request time
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
                </div>
                {loading && <p>Loading tweets...</p>}
                {error && <p style={{ color: 'red' }}>{error}</p>}
                <ul>
                    {tweets.map((tweet) => (
                        <li key={tweet.id}>
                            <p><strong>{tweet.user}</strong>: {tweet.text}</p>
                            <p><small>{new Date(tweet.created_at).toLocaleString()}</small></p>
                        </li>
                    ))}
                </ul>
            </header>
        </div>
    );
}

export default App;
