from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
import os
import pandas as pd
import re
from collections import defaultdict
import tempfile
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
import docx
import bcrypt
import jwt
from datetime import datetime, timedelta

app = Flask(__name__)
CORS(app)

# Load environment variables
load_dotenv()

# Configuration
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'your-secret-key-here')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['ALLOWED_EXTENSIONS'] = {'pdf', 'docx', 'txt'}
app.config['TOKEN_EXPIRATION'] = 3600  # 1 hour in seconds

# MongoDB setup
mongo_uri = os.getenv("MONGO_URI")
client = MongoClient(mongo_uri)
db = client["interview_db"]
users_collection = db["users"]
interviews_collection = db["interviews"]

# Load questions from Excel
questions_df = pd.read_excel('qstns.xlsx', sheet_name='Sheet1', header=None)

# Preprocess questions and answers
questions_db = defaultdict(list)
for _, row in questions_df.iterrows():
    if len(row) >= 3 and pd.notna(row[0]) and pd.notna(row[1]) and pd.notna(row[2]):
        skill = str(row[0]).lower().strip()
        questions_db[skill].append({
            'question': row[1],
            'expected_answer': row[2],
            'keywords': list(set(re.findall(r'\w+', str(row[2]).lower()))  # Simple keyword extraction
        })

# Helper functions
def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in app.config['ALLOWED_EXTENSIONS']

def extract_text_from_pdf(pdf_path):
    text = ""
    with open(pdf_path, 'rb') as file:
        reader = PdfReader(file)
        for page in reader.pages:
            text += page.extract_text()
    return text

def extract_text_from_docx(docx_path):
    doc = docx.Document(docx_path)
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_file(file_path):
    if file_path.endswith('.pdf'):
        return extract_text_from_pdf(file_path)
    elif file_path.endswith('.docx'):
        return extract_text_from_docx(file_path)
    elif file_path.endswith('.txt'):
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    return ""

def process_resume(file_path):
    text = extract_text_from_file(file_path)
    found_skills = []
    text_lower = text.lower()
    
    for skill in questions_db.keys():
        if re.search(r'\b' + re.escape(skill) + r'\b', text_lower):
            found_skills.append(skill)
    
    return list(set(found_skills))

def generate_questions(skills, num_questions=5):
    questions = []
    for skill in skills:
        if skill in questions_db:
            questions.extend(questions_db[skill])
    
    if len(questions) > num_questions:
        import random
        questions = random.sample(questions, num_questions)
    
    return questions

def calculate_score(user_answer, expected_keywords):
    if not user_answer:
        return 0
    user_words = set(re.findall(r'\w+', user_answer.lower()))
    matched = [kw for kw in expected_keywords if kw in user_words]
    return min(100, int((len(matched) / len(expected_keywords)) * 100)) if expected_keywords else 0

# Authentication functions
def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(hashed_password, password):
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def generate_token(user_id):
    payload = {
        'user_id': str(user_id),
        'exp': datetime.utcnow() + timedelta(seconds=app.config['TOKEN_EXPIRATION'])
    }
    return jwt.encode(payload, app.config['SECRET_KEY'], algorithm='HS256')

def verify_token(token):
    try:
        payload = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
        return payload['user_id']
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

# Authentication decorator
def token_required(f):
    def decorated(*args, **kwargs):
        token = None
        if 'Authorization' in request.headers:
            token = request.headers['Authorization'].split(" ")[1]
        
        if not token:
            return jsonify({'message': 'Token is missing!'}), 401
        
        user_id = verify_token(token)
        if not user_id:
            return jsonify({'message': 'Token is invalid or expired!'}), 401
        
        return f(user_id, *args, **kwargs)
    decorated.__name__ = f.__name__
    return decorated

# Routes
@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    name = data.get('name')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    if users_collection.find_one({'email': email}):
        return jsonify({'error': 'Email already exists'}), 400
    
    hashed_password = hash_password(password)
    
    user = {
        'email': email,
        'password': hashed_password,
        'name': name,
        'created_at': datetime.utcnow(),
        'interviews': []
    }
    
    result = users_collection.insert_one(user)
    user_id = str(result.inserted_id)
    
    token = generate_token(user_id)
    
    return jsonify({
        'message': 'User created successfully',
        'token': token,
        'user_id': user_id,
        'name': name
    }), 201

@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    if not email or not password:
        return jsonify({'error': 'Email and password are required'}), 400
    
    user = users_collection.find_one({'email': email})
    if not user:
        return jsonify({'error': 'Invalid credentials'}), 401
    
    if not verify_password(user['password'], password):
        return jsonify({'error': 'Invalid credentials'}), 401
    
    token = generate_token(str(user['_id']))
    
    return jsonify({
        'message': 'Login successful',
        'token': token,
        'user_id': str(user['_id']),
        'name': user.get('name', '')
    })

@app.route('/profile', methods=['GET'])
@token_required
def profile(user_id):
    user = users_collection.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'error': 'User not found'}), 404
    
    return jsonify({
        'email': user['email'],
        'name': user.get('name', ''),
        'created_at': user['created_at']
    })

@app.route('/upload-resume', methods=['POST'])
@token_required
def upload_resume(user_id):
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": "File type not allowed. Only PDF, DOCX, and TXT files are accepted."}), 400

    with tempfile.TemporaryDirectory() as temp_dir:
        filename = secure_filename(file.filename)
        temp_path = os.path.join(temp_dir, filename)
        file.save(temp_path)

        try:
            skills = process_resume(temp_path)
            if not skills:
                return jsonify({"error": "No relevant skills detected in resume"}), 400

            questions = generate_questions(skills)
            if not questions:
                return jsonify({"error": "No questions available for detected skills"}), 400

            session = {
                "user_id": user_id,
                "skills": skills,
                "questions": questions,
                "transcript": [],
                "current_question": 0,
                "total_score": 0,
                "completed": False,
                "created_at": datetime.utcnow()
            }
            result = interviews_collection.insert_one(session)
            
            # Add interview reference to user
            users_collection.update_one(
                {'_id': ObjectId(user_id)},
                {'$push': {'interviews': result.inserted_id}}
            )

            return jsonify({
                "session_id": str(result.inserted_id),
                "skills": skills,
                "total_questions": len(questions)
            })
        except Exception as e:
            app.logger.error(f"Error processing resume: {str(e)}")
            return jsonify({"error": "Failed to process resume"}), 500

@app.route('/next-question', methods=['GET'])
@token_required
def next_question(user_id):
    session_id = request.args.get('session_id')
    if not session_id:
        return jsonify({"error": "session_id parameter is required"}), 400
    
    try:
        session = interviews_collection.find_one({"_id": ObjectId(session_id), "user_id": user_id})
    except:
        return jsonify({"error": "Invalid session_id"}), 400
    
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    if session['current_question'] >= len(session['questions']):
        return jsonify({"message": "Interview completed"}), 200
    
    current_q = session['questions'][session['current_question']]
    return jsonify({
        "question": current_q['question'],
        "question_number": session['current_question'] + 1,
        "total_questions": len(session['questions'])
    })

@app.route('/submit-answer', methods=['POST'])
@token_required
def submit_answer(user_id):
    data = request.json
    session_id = data.get('session_id')
    answer_text = data.get('answer')
    
    if not session_id or not answer_text:
        return jsonify({"error": "session_id and answer are required"}), 400
    
    try:
        session = interviews_collection.find_one({"_id": ObjectId(session_id), "user_id": user_id})
    except:
        return jsonify({"error": "Invalid session_id"}), 400
    
    if not session:
        return jsonify({"error": "Session not found"}), 404
    
    if session['current_question'] >= len(session['questions']):
        return jsonify({"message": "Interview completed"}), 200
    
    current_q = session['questions'][session['current_question']]
    score = calculate_score(answer_text, current_q['keywords'])
    
    updates = {
        "$push": {"transcript": {
            "question": current_q['question'],
            "answer": answer_text,
            "score": score
        }},
        "$inc": {
            "current_question": 1,
            "total_score": score
        }
    }
    
    interviews_collection.update_one({"_id": ObjectId(session_id)}, updates)
    
    return jsonify({
        "score": score,
        "is_complete": session['current_question'] + 1 >= len(session['questions'])
    })

@app.route('/interview-history', methods=['GET'])
@token_required
def interview_history(user_id):
    interviews = list(interviews_collection.find(
        {"user_id": user_id},
        {"skills": 1, "created_at": 1, "completed": 1, "total_score": 1}
    ).sort("created_at", -1))
    
    for interview in interviews:
        interview['_id'] = str(interview['_id'])
        interview['created_at'] = interview['created_at'].isoformat()
    
    return jsonify(interviews))

if __name__ == '__main__':
    if not os.path.exists(app.config['UPLOAD_FOLDER']):
        os.makedirs(app.config['UPLOAD_FOLDER'])
    app.run(host='0.0.0.0', port=5000)