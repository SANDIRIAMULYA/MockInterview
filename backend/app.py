from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import bcrypt
import fitz  # PyMuPDF
import spacy
import re
import nltk
from nltk.corpus import stopwords
import random
import tempfile  # For cross-platform temporary directory handling

# Download stopwords if not already present
nltk.download('stopwords')

# Load the NLP model
nlp = spacy.load("en_core_web_sm")

# Custom list of skills (extend as needed)
SKILLS_DB = {"python", "java", "c", "c++", "c#", "javascript", "typescript", "ruby", "swift", "kotlin",
             "go", "rust", "php", "r", "dart", "scala", "perl", "bash", "matlab", "html", "css", "sass", 
             "bootstrap", "tailwind css", "react", "angular", "vue.js", "next.js", "nuxt.js", "svelte", 
             "jquery", "node.js", "express.js", "flask", "django", "fastapi", "asp.net", "graphql", 
             "rest api", "sql", "mysql", "postgresql", "mongodb", "firebase", "redis", "cassandra", 
             "dynamodb", "oracle", "mariadb", "neo4j", "elasticsearch", "aws", "azure", "google cloud", 
             "docker", "kubernetes", "terraform", "ansible", "jenkins", "ci/cd", "travis ci", 
             "github actions", "circleci", "helm", "prometheus", "grafana", "cloudflare", "serverless", 
             "data analysis", "machine learning", "deep learning", "nlp", "computer vision", "opencv", 
             "tensorflow", "keras", "pytorch", "scikit-learn", "xgboost", "lightgbm", "pandas", "numpy", 
             "scipy", "matplotlib", "seaborn", "streamlit", "mlflow", "huggingface transformers", 
             "penetration testing", "ethical hacking", "network security", "cryptography", "metasploit", 
             "nmap", "burp suite", "wireshark", "owasp", "security compliance", "firewall configuration", 
             "identity and access management (IAM)", "git", "github", "gitlab", "bitbucket", "agile", 
             "scrum", "kanban", "jira", "confluence", "postman", "swagger", "selenium", "cypress", 
             "jest", "pytest", "unittest", "design patterns", "system design", "microservices", 
             "monorepo", "event-driven architecture", "android", "ios", "flutter", "react native", 
             "swift", "kotlin", "dart", "xamarin", "blockchain", "solidity", "ethereum", "smart contracts", 
             "nft", "web3.js", "ethers.js", "hyperledger", "polygon", "binance smart chain", 
             "decentralized finance (DeFi)"}

# Helper function to extract text from PDF
def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text("text") + " "
    return text

# Helper function to preprocess text
def preprocess_text(text):
    text = text.lower()
    text = re.sub(r'[^a-zA-Z\s]', '', text)  # Remove special characters
    words = text.split()
    words = [word for word in words if word not in stopwords.words('english')]  # Remove stopwords
    return " ".join(words)

# Helper function to extract skills
def extract_skills(text):
    skills_found = set()
    doc = nlp(text)

    # Check each word and phrase in the skills database
    for token in doc:
        if token.text in SKILLS_DB:
            skills_found.add(token.text)

    # Also check for multi-word skills
    for chunk in doc.noun_chunks:
        if chunk.text in SKILLS_DB:
            skills_found.add(chunk.text)

    return list(skills_found)

# Helper function to process resume and extract skills
def process_resume(pdf_path):
    text = extract_text_from_pdf(pdf_path)
    clean_text = preprocess_text(text)
    return extract_skills(clean_text)

# Helper function to generate questions
def generate_questions(skills):
    """Generate random questions based on extracted skills."""
    questions = {}
    SKILL_QUESTIONS = {
        "python": [
            "What are Python's key features?",
            "Explain list vs tuple in Python.",
            "What is the difference between deep copy and shallow copy in Python?",
            "What are Python decorators?",
            "How does memory management work in Python?"
        ],
        "java": [
            "What is the difference between JDK, JRE, and JVM?",
            "What are Java's main OOP principles?",
            "Explain method overloading vs method overriding in Java.",
            "What is the use of the final keyword in Java?",
            "Describe garbage collection in Java."
        ],
        "c++": [
            "What is the difference between C and C++?",
            "What are the four pillars of OOP in C++?",
            "Explain the concept of pointers in C++.",
            "What is operator overloading in C++?",
            "How does dynamic memory allocation work in C++?"
        ],
        "machine learning": [
            "What are the different types of machine learning?",
            "Explain bias-variance tradeoff in ML.",
            "What is the difference between supervised and unsupervised learning?",
            "How do you evaluate a machine learning model?",
            "What is overfitting, and how do you prevent it?"
        ],
        "deep learning": [
            "What is the difference between CNN and RNN?",
            "What is backpropagation in neural networks?",
            "Explain the role of activation functions in deep learning.",
            "How does dropout help prevent overfitting?",
            "What is transfer learning in deep learning?"
        ],
        "sql": [
            "What are the different types of SQL joins?",
            "What is normalization in databases?",
            "Explain the difference between WHERE and HAVING clauses.",
            "What is an index in SQL, and how does it improve performance?",
            "What are stored procedures in SQL?"
        ],
        "react": [
            "What is the virtual DOM in React?",
            "Explain the difference between functional and class components in React.",
            "What are React hooks, and why are they useful?",
            "What is Redux, and how does it help manage state in React?",
            "Explain the lifecycle methods in React."
        ],
        "node.js": [
            "What is Node.js, and how does it work?",
            "What is the event loop in Node.js?",
            "Explain how asynchronous programming works in Node.js.",
            "What are streams in Node.js?",
            "How does middleware work in Express.js?"
        ],
        "tensorflow": [
            "What is TensorFlow, and how is it used?",
            "Explain the difference between a tensor and a numpy array.",
            "What are TensorFlow placeholders and variables?",
            "What is eager execution in TensorFlow?",
            "How does TensorFlow handle GPU acceleration?"
        ],
        "git": [
            "What is the difference between Git and GitHub?",
            "How does branching work in Git?",
            "What is the difference between merge and rebase?",
            "What are Git hooks?",
            "Explain the purpose of the .gitignore file."
        ],
        "aws": [
            "What is the difference between EC2 and Lambda?",
            "Explain the purpose of S3 in AWS.",
            "How does AWS IAM work?",
            "What is an AWS security group?",
            "What is the difference between RDS and DynamoDB?"
        ],
        "docker": [
            "What is the purpose of Docker?",
            "What is the difference between Docker images and containers?",
            "What is Docker Compose used for?",
            "How do you share data between Docker containers?",
            "What is a Dockerfile, and how is it used?"
        ]
    }
    for skill in skills:
        if skill in SKILL_QUESTIONS:
            questions[skill] = random.sample(
                SKILL_QUESTIONS[skill], 
                min(5, len(SKILL_QUESTIONS[skill]))
            )
    return questions

load_dotenv()

app = Flask(__name__)
CORS(app)

client = MongoClient(os.getenv("MONGO_URI"))
db = client.mock_interviews
users_collection = db.users
interviews_collection = db.interviews

# Helper function to hash passwords
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

# Helper function to verify passwords
def verify_password(stored_password, provided_password):
    return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password)

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400

    hashed_password = hash_password(password)
    user = {
        "email": email,
        "password": hashed_password,
    }
    users_collection.insert_one(user)

    return jsonify({"message": "User created successfully", "user": {"email": email}}), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user or not verify_password(user['password'], password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({"message": "Login successful", "user": {"email": email}}), 200

@app.route('/upload-resume', methods=['POST'])
def upload_resume():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    # Use a temporary directory for cross-platform compatibility
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = os.path.join(temp_dir, file.filename)
        file.save(temp_path)

        try:
            # Process the resume and extract skills
            skills = process_resume(temp_path)
            questions = generate_questions(skills)

            # Save the session to MongoDB
            session = {
                "skills": skills,
                "questions": questions,
                "status": "started",
                "transcript": []
            }
            result = interviews_collection.insert_one(session)

            return jsonify({
                "session_id": str(result.inserted_id),
                "skills": skills,  # Include skills in the response
                "questions": questions
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)