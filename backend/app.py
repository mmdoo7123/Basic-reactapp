from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Define the root endpoint
@app.route('/', methods=['GET'])
def home():
    return jsonify({'message': 'Welcome to the Market Research API!'})

# Define another API endpoint (example)
@app.route('/api', methods=['GET'])
def api():
    return jsonify({'message': 'API is working!'})

if __name__ == '__main__':
    app.run(debug=True)
