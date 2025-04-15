from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import time
import bcrypt
import fitz  # PyMuPDF
import spacy
import re
import nltk
from nltk.corpus import stopwords
import random
import tempfile
import openpyxl
import fitz  # PyMuPDF
import hashlib
from bson import ObjectId
import datetime
from audio_transcriber import transcribe_audio_file
from response_analyzer import ResponseAnalyzer

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
SKILLS_DB = {"python", "java", "c", "c++", "javascript", "react", "html", "css", 
             "node.js", "express.js", "mongodb", "sql", "mysql", "django", "flask", 
             "aws", "azure", "docker", "kubernetes", "pandas", "numpy", "tensorflow", 
             "keras", "machine learning", "nlp", "deep learning"}

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
    """Load questions from Excel file with proper error handling"""
    qdict = {}
    try:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"Excel file not found at {os.path.abspath(file_path)}")
            
        wb = openpyxl.load_workbook(file_path)
        sheet = wb.active
        
        for i, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            skill = str(row[0]).lower().strip() if row[0] else None
            question = str(row[1]).strip() if row[1] else None
            
            # Remove numbers and dots/colons at the start of questions
            if question:
                # This regex removes leading numbers followed by punctuation and spaces
                question = re.sub(r'^\d+[.:]\s*', '', question).strip()
            
            if skill and question:
                if skill not in qdict:
                    qdict[skill] = []
                qdict[skill].append(question)
        
        if not qdict:
            raise ValueError("Excel file contains no valid questions")
            
        return qdict
    except Exception as e:
        raise ValueError(f"Could not load questions: {str(e)}")

def generate_questions(skills):
    try:
        all_questions = load_questions_from_excel()
        questions = {}
        
        # Shuffle the skills to randomize their order
        shuffled_skills = random.sample(skills, len(skills))
        
        for skill in shuffled_skills:
            sk = skill.lower()
            if sk in all_questions:
                # Shuffle the questions for each skill
                questions[skill] = random.sample(all_questions[sk], len(all_questions[sk]))
        
        print(f"[DEBUG] Found questions for: {list(questions.keys())}")
        
        if not questions:
            raise ValueError("No questions available for any of your skills")
        
        return questions
    except Exception as e:
        raise ValueError(f"Question generation failed: {str(e)}")

def is_strong_password(password):
    return (
        len(password) >= 8 and
        re.search(r'[A-Za-z]', password) and
        re.search(r'[0-9]', password) and
        re.search(r'[^A-Za-z0-9]', password)
    )

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

    try:
        with tempfile.NamedTemporaryFile(delete=False) as temp_file:
            file.save(temp_file.name)
            skills = process_resume(temp_file.name)
            
        if not skills:
            return jsonify({"error": "No skills found in resume"}), 400

        questions = generate_questions(skills)
        
        session = {
            "skills": list(questions.keys()),
            "questions": questions,
            "status": "started",
            "transcript": [],
            "created_at": datetime.datetime.utcnow()
        }
        
        result = interviews_collection.insert_one(session)
        
        return jsonify({
            "session_id": str(result.inserted_id),
            "skills": list(questions.keys()),
            "questions": questions
        })

    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        return jsonify({"error": f"Server error: {str(e)}"}), 500
    finally:
        if 'temp_file' in locals():
            try:
                os.unlink(temp_file.name)
            except:
                pass

@app.route('/get-questions', methods=['POST'])
def get_questions():
    data = request.json
    session_id = data.get("session_id")
    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    try:
        session = interviews_collection.find_one({"_id": ObjectId(session_id)})
        if not session:
            return jsonify({"error": "Session not found"}), 404

        return jsonify({
            "questions": session.get("questions", {}),
            "skills": session.get("skills", [])
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
@app.route('/analyze-text', methods=['POST'])
def analyze_text():
    try:
        data = request.json
        text = data.get("text", "").strip()
        
        if not text:
            return jsonify({"error": "Text is required"}), 400

        print(f"\n=== Analyzing text ===")
        print(f"Text length: {len(text)} characters")
        print(f"First 100 chars: {text[:100]}...\n")

        analyzer = ResponseAnalyzer()
        
        # Create a temporary file path
        temp_path = os.path.join(tempfile.gettempdir(), f"analysis_{int(time.time())}.pdf")
        
        try:
            # Create PDF
            doc = fitz.open()
            page = doc.new_page()
            page.insert_text((50, 50), text)
            doc.save(temp_path)
            doc.close()
            
            print(f"Created temporary PDF at: {temp_path}")
            
            # Analyze
            analysis_results = analyzer.analyze_response(temp_path)
            print(f"Analysis successful: {analysis_results.keys()}")
            
            return jsonify({
                "scores": analysis_results.get("scores", {}),
                "word_count": analysis_results.get("word_count", 0),
                "sentence_count": analysis_results.get("sentence_count", 0),
                "improvement_suggestions": analysis_results.get("improvement_suggestions", [])
            })
            
        finally:
            # Clean up
            if os.path.exists(temp_path):
                os.remove(temp_path)
                print(f"Removed temporary file: {temp_path}")
                
    except Exception as e:
        print(f"\n!!! ERROR in analyze-text !!!")
        print(f"Type: {type(e).__name__}")
        print(f"Message: {str(e)}")
        print("Traceback:")
        import traceback
        traceback.print_exc()
        
        return jsonify({
            "error": "Analysis failed",
            "details": str(e),
            "type": type(e).__name__
        }), 500
@app.route('/analyze-response', methods=['POST'])
def analyze_response():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Empty filename"}), 400

    try:
        # Save the uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
            file.save(temp_file.name)
            
            # Initialize and use the analyzer
            analyzer = ResponseAnalyzer()
            analysis_results = analyzer.analyze_response(temp_file.name)
            
            if "error" in analysis_results:
                return jsonify({"error": analysis_results["error"]}), 400
                
            # Format the results for the frontend
            formatted_results = {
                "grammar_score": analysis_results["scores"]["grammar_score"],
                "stop_word_score": analysis_results["scores"]["stop_word_score"],
                "filler_score": analysis_results["scores"]["filler_score"],
                "tone_score": analysis_results["scores"]["tone_score"],
                "overall_score": analysis_results["scores"]["overall_score"],
                "word_count": analysis_results["word_count"],
                "sentence_count": analysis_results["sentence_count"],
                "improvement_suggestions": analysis_results["improvement_suggestions"],
                "grammar_analysis": {
                    "error_count": analysis_results["grammar_analysis"]["error_count"],
                    "error_rate": analysis_results["grammar_analysis"]["error_rate"],
                    "error_types": analysis_results["grammar_analysis"]["error_types"]
                },
                "stop_word_analysis": {
                    "stop_word_count": analysis_results["stop_word_analysis"]["stop_word_count"],
                    "stop_word_percentage": analysis_results["stop_word_analysis"]["stop_word_percentage"],
                    "most_common_stop_words": analysis_results["stop_word_analysis"]["most_common_stop_words"]
                },
                "filler_word_analysis": {
                    "filler_word_count": analysis_results["filler_word_analysis"]["filler_word_count"],
                    "filler_word_percentage": analysis_results["filler_word_analysis"]["filler_word_percentage"],
                    "most_common_fillers": analysis_results["filler_word_analysis"]["most_common_fillers"]
                },
                "tone_analysis": {
                    "sentiment_score": analysis_results["tone_analysis"]["sentiment_score"],
                    "subjectivity_score": analysis_results["tone_analysis"]["subjectivity_score"],
                    "formality_score": analysis_results["tone_analysis"]["formality_score"],
                    "words_per_sentence": analysis_results["tone_analysis"]["words_per_sentence"],
                    "tone_categories": analysis_results["tone_analysis"]["tone_categories"]
                }
            }
            
            return jsonify(formatted_results)

    except Exception as e:
        return jsonify({"error": f"Analysis failed: {str(e)}"}), 500
        
    finally:
        if 'temp_file' in locals():
            try:
                os.unlink(temp_file.name)
            except:
                pass
@app.route("/transcribe", methods=["POST"])
def transcribe():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files["audio"]
    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400
        
    allowed_extensions = {'.wav', '.mp3', '.ogg', '.webm', '.m4a', '.flac'}
    file_ext = os.path.splitext(audio_file.filename)[1].lower()
    
    if file_ext not in allowed_extensions:
        return jsonify({
            "error": f"Unsupported file type. Allowed types: {', '.join(allowed_extensions)}"
        }), 400

    try:
        result = transcribe_audio_file(audio_file, file_extension=file_ext)
        if "error" in result:
            return jsonify(result), 500
        return jsonify(result)
    except Exception as e:
        return jsonify({
            "error": f"Transcription failed: {str(e)}",
            "pauses": [],
            "segments": [],
            "text": ""
        }), 500
@app.route('/test-analysis', methods=['GET'])
def test_analysis():
    try:
        test_text = "This is a test sentence. It contains some basic English words. The grammar should be correct."
        
        analyzer = ResponseAnalyzer()
        results = analyzer.analyze_grammar(test_text)
        
        return jsonify({
            "success": True,
            "test_text": test_text,
            "results": results
        })
    except Exception as e:
        return jsonify({
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500
@app.route('/test-excel', methods=['GET'])
def test_excel():
    try:
        questions = load_questions_from_excel()
        return jsonify({
            "status": "success",
            "skills": list(questions.keys()),
            "sample_questions": {k: v[:2] for k, v in questions.items()}  # Show first 2 per skill
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "path": os.path.abspath('qstns.xlsx')
        }), 500
@app.route('/complete-interview', methods=['POST'])
def complete_interview():
    data = request.json
    session_id = data.get("session_id")
    messages = data.get("messages", [])
    transcript = data.get("transcript", {})
    response_text = data.get("response_text", "")  # Add this parameter

    if not session_id:
        return jsonify({"error": "Session ID is required"}), 400

    try:
        # Initialize analyzer if we have response text to analyze
        analysis_results = None
        if response_text:
            analyzer = ResponseAnalyzer()
            
            # Save text to a temporary PDF for analysis (the analyzer expects PDF)
            with tempfile.NamedTemporaryFile(delete=False, suffix='.pdf') as temp_file:
                # Create a simple PDF with the response text
                doc = fitz.open()
                page = doc.new_page()
                page.insert_text((50, 50), response_text)
                doc.save(temp_file.name)
                doc.close()
                
                analysis_results = analyzer.analyze_response(temp_file.name)
                
                if "error" in analysis_results:
                    print(f"Analysis error: {analysis_results['error']}")

        # Update the interview record
        update_data = {
            "status": "completed",
            "messages": messages,
            "transcript": transcript,
            "completed": True,
            "completed_at": datetime.datetime.utcnow()
        }
        
        if analysis_results and "error" not in analysis_results:
            update_data["analysis"] = {
                "scores": analysis_results["scores"],
                "word_count": analysis_results["word_count"],
                "sentence_count": analysis_results["sentence_count"],
                "improvement_suggestions": analysis_results["improvement_suggestions"]
            }

        interviews_collection.update_one(
            {"_id": ObjectId(session_id)},
            {"$set": update_data}
        )
        
        return jsonify({
            "message": "Interview marked as complete",
            "analysis": analysis_results["scores"] if analysis_results and "error" not in analysis_results else None
        })
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/clear-session', methods=['POST'])
def clear_session():
    data = request.json
    user_email = data.get("email")
    if not user_email:
        return jsonify({"error": "Email is required"}), 400

    try:
        interviews_collection.delete_many({
            "user_email": user_email,
            "status": {"$ne": "completed"}
        })
        return jsonify({"message": "Previous session data cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)