from flask import Flask, jsonify, request
from flask_cors import CORS
from tweepy import Client
from time import sleep
from newsapi import NewsApiClient  
from time import time, sleep

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
# Twitter API Credentials
BEARER_TOKEN = "AAAAAAAAAAAAAAAAAAAAAKu6xgEAAAAApmMHjQb29AU61lztGI7wCjUSpYo%3DmDWgGTrkEfliqWrOMxD8KGXyfAil9g282XmtOd4fpSrz8i3Rcs"
# Authenticate with Tweepy
client = Client(bearer_token=BEARER_TOKEN)
# Google News API Credentials
NEWS_API_KEY = "c9020c306e834cb89981972f90e320c7"
news_client = NewsApiClient(api_key=NEWS_API_KEY)


@app.route('/tweets', methods=['GET'])
def get_tweets():
    keyword = request.args.get('keyword', 'technology')
    count = int(request.args.get('count', 10))

    try:
        # Fetch recent tweets using Twitter API v2
        response = client.search_recent_tweets(
            query=keyword,  # Search query
            max_results=min(count, 100),  # API v2 allows max 100 tweets per request
            tweet_fields=["created_at", "text", "author_id"]  # Fields to include in the response
        )

        # Extract tweet data
        if response.data:
            tweet_data = [
                {
                    "id": tweet.id,
                    "text": tweet.text,
                    "author_id": tweet.author_id,
                    "created_at": tweet.created_at
                }
                for tweet in response.data
            ]
            return jsonify(tweet_data)
        else:
            return jsonify([])  # Return an empty list if no tweets are found
    
    except Exception as e:

        if hasattr(e, "response") and e.response.status_code == 429:
                headers = e.response.headers
                reset_time = int(headers.get("x-rate-limit-reset", int(time())))
                wait_time = max(reset_time - int(time()), 0)

                return jsonify({
                    "error": "Rate limit exceeded",
                    "wait_time": wait_time
                }), 429
        return jsonify({"error": str(e)}), 500
        
@app.route('/news', methods=['GET'])
def get_news():
    keyword = request.args.get('keyword', 'technology')
    count = int(request.args.get('count', 10))

    try:
        # Fetch articles using Google News API
        response = news_client.get_everything(
            q=keyword,
            language='en',
            sort_by='relevancy',
            page_size=min(count, 100)  # API allows max 100 articles per request
        )

        # Extract article data
        if response['articles']:
            news_data = [
                {
                    "source": article['source']['name'],
                    "author": article['author'],
                    "title": article['title'],
                    "description": article['description'],
                    "url": article['url'],
                    "published_at": article['publishedAt']
                }
                for article in response['articles']
            ]
            return jsonify(news_data)
        else:
            return jsonify([])  # Return an empty list if no articles are found

    except Exception as e:
        print(f"Error fetching news: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/', methods=['GET'])
def home():
    return jsonify({'message': 'Welcome to the Market Research API!'})

# Define another API endpoint (example)
@app.route('/api', methods=['GET'])
def api():
    return jsonify({'message': 'API is working!'})

if __name__ == '__main__':
    app.run(debug=True)
