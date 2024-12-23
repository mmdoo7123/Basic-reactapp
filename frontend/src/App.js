import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

function App() {
    const [message, setMessage] = useState('Loading...');

    useEffect(() => {
        // Fetch data from the Flask backend
        axios.get('http://127.0.0.1:5000/api') // Adjust URL if needed
            .then((response) => {
                setMessage(response.data.message); // Set the message from the API
            })
            .catch((error) => {
                console.error('Error fetching data:', error);
                setMessage('Error fetching data');
            });
    }, []);

    return (
        <div className="App">
            <header className="App-header">
                <h1>Market Research Assistant</h1>
                <p>{message}</p> {/* Display the message */}
            </header>
        </div>
    );
}

export default App;
