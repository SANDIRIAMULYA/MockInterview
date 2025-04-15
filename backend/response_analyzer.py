# response_analyzer.py
import pandas as pd
import numpy as np
import re
import spacy
import language_tool_python
import fitz  # PyMuPDF
from textblob import TextBlob
from nltk.corpus import stopwords
import nltk
from sklearn.feature_extraction.text import CountVectorizer
from nltk.tokenize import sent_tokenize, word_tokenize

# Download NLTK resources
nltk.download('punkt')
nltk.download('punkt_tab')
nltk.download('stopwords')

class ResponseAnalyzer:
    def __init__(self):
        # Initialize NLP tools
        self.nlp = spacy.load('en_core_web_md')
        # Change this in your ResponseAnalyzer
        self.language_tool = language_tool_python.LanguageTool('en-US', remote_server='https://api.languagetool.org')
        self.stop_words = set(stopwords.words('english'))

        # Define common filler words
        self.filler_words = {
            'um', 'uh', 'ah', 'er', 'like', 'you know', 'actually', 'basically',
            'literally', 'so', 'anyway', 'honestly', 'right', 'I mean', 'kind of',
            'sort of', 'well', 'just', 'stuff', 'things', 'okay', 'hmm', 'yeah'
        }

    def extract_text_from_pdf(self, pdf_path):
        """Extract text content from a PDF file."""
        text = ""
        try:
            doc = fitz.open(pdf_path)
            for page in doc:
                text += page.get_text()
            return text
        except Exception as e:
            print(f"Error extracting text from PDF: {e}")
            return None

    def preprocess_text(self, text):
        """Clean and preprocess the text."""
        # Remove extra whitespaces and newlines
        text = re.sub(r'\s+', ' ', text).strip()
        # Remove special characters except punctuation needed for grammar check
        text = re.sub(r'[^\w\s\.,;:!?\'"-]', '', text)
        return text

    def analyze_grammar(self, text):
        """Analyze grammatical errors in the text."""
        matches = self.language_tool.check(text)

        errors = []
        for match in matches:
            # Filter out style suggestions and focus on grammar errors
            if match.ruleIssueType in ['grammar', 'typos', 'punctuation']:
                error = {
                    'message': match.message,
                    'context': match.context,
                    'suggestions': match.replacements if match.replacements else [],
                    'position': (match.offset, match.offset + match.errorLength)
                }
                errors.append(error)

        grammar_analysis = {
            'error_count': len(errors),
            'errors': errors,
            'error_rate': len(errors) / max(1, len(sent_tokenize(text))),  # Errors per sentence
            'error_types': {}
        }

        # Count types of errors
        for error in errors:
            error_type = error['message'].split(':')[0] if ':' in error['message'] else 'Other'
            if error_type in grammar_analysis['error_types']:
                grammar_analysis['error_types'][error_type] += 1
            else:
                grammar_analysis['error_types'][error_type] = 1

        return grammar_analysis

    def analyze_stop_words(self, text):
        """Analyze stop words in the text."""
        tokens = word_tokenize(text.lower())
        total_words = len(tokens)

        # Count stop words
        stop_word_count = sum(1 for word in tokens if word in self.stop_words)

        # Get most common stop words
        stop_word_freq = {}
        for word in tokens:
            if word in self.stop_words:
                if word in stop_word_freq:
                    stop_word_freq[word] += 1
                else:
                    stop_word_freq[word] = 1

        most_common = sorted(stop_word_freq.items(), key=lambda x: x[1], reverse=True)[:10]

        return {
            'stop_word_count': stop_word_count,
            'stop_word_percentage': (stop_word_count / max(1, total_words)) * 100,
            'most_common_stop_words': most_common,
            'total_words': total_words
        }

    def analyze_filler_words(self, text):
        """Analyze filler words in the text."""
        text_lower = text.lower()
        total_words = len(word_tokenize(text))

        # Count filler words
        filler_count = 0
        filler_freq = {}

        for filler in self.filler_words:
            # Count occurrences of each filler word/phrase
            count = len(re.findall(r'\b' + re.escape(filler) + r'\b', text_lower))
            if count > 0:
                filler_freq[filler] = count
                filler_count += count

        most_common = sorted(filler_freq.items(), key=lambda x: x[1], reverse=True)

        return {
            'filler_word_count': filler_count,
            'filler_word_percentage': (filler_count / max(1, total_words)) * 100,
            'most_common_fillers': most_common,
            'total_words': total_words
        }

    def analyze_tone(self, text):
        """Analyze the tone of the text."""
        # Use TextBlob for sentiment and subjectivity analysis
        blob = TextBlob(text)
        sentiment = blob.sentiment

        # Use spaCy for deeper NLP analysis
        doc = self.nlp(text)

        # Count specific parts of speech that can indicate tone
        pos_counts = {}
        for token in doc:
            if token.pos_ in pos_counts:
                pos_counts[token.pos_] += 1
            else:
                pos_counts[token.pos_] = 1

        # Calculate sentence complexity
        sentences = sent_tokenize(text)
        words_per_sentence = sum(len(word_tokenize(s)) for s in sentences) / max(1, len(sentences))

        # Analyze formality using features like contractions, first-person pronouns
        contractions_count = len(re.findall(r'\b\w+\'[a-z]+\b', text.lower()))
        first_person_count = len(re.findall(r'\b(i|me|my|mine|myself)\b', text.lower()))

        # Named entity recognition can help identify professional terminology
        entities = [(ent.text, ent.label_) for ent in doc.ents]
        technical_terms = [ent[0] for ent in entities if ent[1] in ['ORG', 'PRODUCT', 'EVENT', 'WORK_OF_ART']]

        # Define tone categories based on analysis
        tone_categories = []

        # Sentiment-based categories
        if sentiment.polarity > 0.3:
            tone_categories.append('Positive')
        elif sentiment.polarity < -0.3:
            tone_categories.append('Negative')
        else:
            tone_categories.append('Neutral')

        # Confidence categories based on language patterns
        if sentiment.subjectivity < 0.4 and first_person_count / max(1, len(word_tokenize(text))) < 0.05:
            tone_categories.append('Confident')

        # Formality assessment
        formality_score = 0
        formality_score += (1 - sentiment.subjectivity) * 3
        formality_score -= (contractions_count / max(1, len(sentences))) * 2
        formality_score -= (first_person_count / max(1, len(word_tokenize(text)))) * 3
        formality_score += (len(technical_terms) / max(1, len(sentences)))

        if formality_score > 2:
            tone_categories.append('Formal')
        elif formality_score < 0:
            tone_categories.append('Casual')
        else:
            tone_categories.append('Moderately formal')

        # Detail level based on sentence complexity
        if words_per_sentence > 20:
            tone_categories.append('Verbose')
        elif words_per_sentence < 10:
            tone_categories.append('Concise')

        return {
            'sentiment_score': sentiment.polarity,
            'subjectivity_score': sentiment.subjectivity,
            'formality_score': formality_score,
            'words_per_sentence': words_per_sentence,
            'tone_categories': tone_categories,
            'pos_distribution': pos_counts,
            'technical_terms': technical_terms
        }

    def get_overall_score(self, grammar_analysis, stop_word_analysis, filler_analysis, tone_analysis):
        """Calculate an overall score based on all the analyses."""
        # Score components (all from 0-100)
        grammar_score = max(0, 100 - (grammar_analysis['error_rate'] * 20))

        stop_word_score = 100
        if stop_word_analysis['stop_word_percentage'] > 50:  # Too many stop words
            stop_word_score = max(0, 100 - (stop_word_analysis['stop_word_percentage'] - 50))

        filler_score = max(0, 100 - (filler_analysis['filler_word_percentage'] * 5))

        # Tone score based on interview context
        tone_score = 70  # Base score
        if 'Formal' in tone_analysis['tone_categories']:
            tone_score += 15
        if 'Confident' in tone_analysis['tone_categories']:
            tone_score += 15
        if 'Negative' in tone_analysis['tone_categories']:
            tone_score -= 20
        if 'Verbose' in tone_analysis['tone_categories']:
            tone_score -= 10

        # Calculate weighted overall score
        overall_score = (
            grammar_score * 0.35 +
            stop_word_score * 0.15 +
            filler_score * 0.20 +
            tone_score * 0.30
        )

        return {
            'grammar_score': grammar_score,
            'stop_word_score': stop_word_score,
            'filler_score': filler_score,
            'tone_score': tone_score,
            'overall_score': overall_score
        }

    def generate_improvement_suggestions(self, grammar_analysis, stop_word_analysis, filler_analysis, tone_analysis, scores):
        """Generate personalized suggestions for improvement."""
        suggestions = []

        # Grammar suggestions
        if scores['grammar_score'] < 80:
            if grammar_analysis['error_count'] > 0:
                common_errors = sorted(grammar_analysis['error_types'].items(), key=lambda x: x[1], reverse=True)
                suggestions.append(f"Focus on improving your {common_errors[0][0].lower()} errors, which appeared {common_errors[0][1]} times.")
            suggestions.append("Consider using grammar checking tools before important interviews.")

        # Stop word suggestions
        if scores['stop_word_score'] < 80:
            most_common = stop_word_analysis['most_common_stop_words']
            if most_common:
                suggestions.append(f"Try to reduce the use of common stop words like '{most_common[0][0]}' which appeared {most_common[0][1]} times.")

        # Filler word suggestions
        if scores['filler_score'] < 80:
            most_common = filler_analysis['most_common_fillers']
            if most_common:
                suggestions.append(f"Work on reducing filler words like '{most_common[0][0]}' which appeared {most_common[0][1]} times.")
            suggestions.append("Practice pausing instead of using filler words to gather your thoughts.")

        # Tone suggestions
        if 'Casual' in tone_analysis['tone_categories']:
            suggestions.append("Your tone is casual. For interviews, consider adopting a more formal tone while remaining authentic.")

        if 'Verbose' in tone_analysis['tone_categories']:
            suggestions.append("Your responses tend to be lengthy. Try to be more concise while still thoroughly answering questions.")

        if 'Negative' in tone_analysis['tone_categories']:
            suggestions.append("Your tone appears somewhat negative. Try to maintain a positive or neutral tone during interviews.")

        if tone_analysis['subjectivity_score'] > 0.7:
            suggestions.append("Your responses are highly subjective. Try to balance with more objective statements and facts when appropriate.")

        return suggestions

    def analyze_response(self, pdf_path):
        """Main function to analyze a response from PDF."""
        # Extract and preprocess text
        text = self.extract_text_from_pdf(pdf_path)
        if not text:
            return {"error": "Failed to extract text from PDF"}

        text = self.preprocess_text(text)

        # Perform analyses
        grammar_analysis = self.analyze_grammar(text)
        stop_word_analysis = self.analyze_stop_words(text)
        filler_analysis = self.analyze_filler_words(text)
        tone_analysis = self.analyze_tone(text)

        # Calculate scores
        scores = self.get_overall_score(grammar_analysis, stop_word_analysis, filler_analysis, tone_analysis)

        # Generate improvement suggestions
        suggestions = self.generate_improvement_suggestions(grammar_analysis, stop_word_analysis, filler_analysis, tone_analysis, scores)

        # Compile results
        results = {
            "original_text": text,
            "word_count": len(word_tokenize(text)),
            "sentence_count": len(sent_tokenize(text)),
            "grammar_analysis": grammar_analysis,
            "stop_word_analysis": stop_word_analysis,
            "filler_word_analysis": filler_analysis,
            "tone_analysis": tone_analysis,
            "scores": scores,
            "improvement_suggestions": suggestions
        }

        return results