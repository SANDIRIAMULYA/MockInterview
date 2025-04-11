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
import tempfile
import openpyxl
from bson import ObjectId

# Initialize and load resources
nltk.download('stopwords')
nlp = spacy.load("en_core_web_sm")
load_dotenv()

app = Flask(__name__)
CORS(app)

# MongoDB connection
client = MongoClient(os.getenv("MONGO_URI"))
db = client.mock_interviews
users_collection = db.users
interviews_collection = db.interviews

# ======== SKILLS DB ===========
SKILLS_DB = {"python", "java", "c", "c++", "javascript", "react", "html", "css", "node.js", "express.js", "mongodb", "sql", "mysql", "django", "flask", "aws", "azure", "docker", "kubernetes", "pandas", "numpy", "tensorflow", "keras", "machine learning", "nlp", "deep learning"}

# ======== HELPERS ============

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt())

def verify_password(stored_password, provided_password):
    return bcrypt.checkpw(provided_password.encode('utf-8'), stored_password)

def extract_text_from_pdf(pdf_path):
    doc = fitz.open(pdf_path)
    return " ".join([page.get_text("text") for page in doc])

def preprocess_text(text):
    text = text.lower()
    text = re.sub(r'[^a-z\s]', '', text)
    words = text.split()
    return " ".join([w for w in words if w not in stopwords.words('english')])

def extract_skills(text):
    doc = nlp(text)
    found = set()

    for token in doc:
        if token.text in SKILLS_DB:
            found.add(token.text)

    for chunk in doc.noun_chunks:
        if chunk.text in SKILLS_DB:
            found.add(chunk.text)

    return list(found)

def process_resume(path):
    raw = extract_text_from_pdf(path)
    cleaned = preprocess_text(raw)
    return extract_skills(cleaned)

def load_questions_from_excel(file_path='qstns.xlsx'):
    qdict = {}
    try:
        wb = openpyxl.load_workbook(file_path)
        sheet = wb.active
        for row in sheet.iter_rows(min_row=2, values_only=True):
            skill = str(row[0]).lower().strip() if row[0] else None
            question = str(row[1]).strip() if row[1] else None
            if skill and question:
                qdict.setdefault(skill, []).append(question)
        return qdict
    except Exception as e:
        print("Excel load error:", e)
        return {}

def generate_questions(skills):
    questions = {}
    for skill in skills:
        sk = skill.lower()
        if sk in SKILL_QUESTIONS:
            pool = SKILL_QUESTIONS[sk]
            questions[skill] = random.sample(pool, min(5, len(pool)))
    return questions

# Load questions from Excel at startup
SKILL_QUESTIONS = load_questions_from_excel()

# ========== ROUTES ============

@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get('name', '').strip()
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not name or not email or not password:
        return jsonify({"error": "Name, email, and password are required"}), 400

    if not is_strong_password(password):
        return jsonify({
            "error": "Password must be at least 8 characters long and include at least one letter, one number, and one special character"
        }), 400

    if users_collection.find_one({"email": email}):
        return jsonify({"error": "User already exists"}), 400

    hashed = hash_password(password)
    users_collection.insert_one({"name": name, "email": email, "password": hashed})
    
    return jsonify({"message": "Signup successful", "user": {"email": email, "name": name}}), 201


@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email', '').strip()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400

    user = users_collection.find_one({"email": email})
    if not user or not verify_password(user["password"], password):
        return jsonify({"error": "Invalid credentials"}), 401

    return jsonify({
        "message": "Login successful",
        "user": {"email": email, "name": user.get("name", "")}
    }), 200

@app.route('/upload-resume', methods=['POST'])
def upload_resume():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    with tempfile.TemporaryDirectory() as temp_dir:
        path = os.path.join(temp_dir, file.filename)
        file.save(path)

        try:
            skills = process_resume(path)
            questions = generate_questions(skills)
            session = {
                "skills": skills,
                "questions": questions,
                "status": "started",
                "transcript": []
            }
            result = interviews_collection.insert_one(session)

            return jsonify({
                "session_id": str(result.inserted_id),
                "skills": skills,
                "questions": questions
            })

        except Exception as e:
            return jsonify({"error": str(e)}), 500

@app.route('/get-questions', methods=['POST'])
def get_questions():
    data = request.json
    session_id = data.get("session_id")

    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    session = interviews_collection.find_one({"_id": ObjectId(session_id)})
    if not session:
        return jsonify({"error": "Session not found"}), 404

    return jsonify({
        "questions": session.get("questions", {}),
        "skills": session.get("skills", [])
    })

# ========== MAIN =============
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
