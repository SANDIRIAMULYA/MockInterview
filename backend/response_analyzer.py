# response_analyzer.py
import re
import spacy
import language_tool_python
from textblob import TextBlob
from nltk.corpus import stopwords
import nltk
from nltk.tokenize import sent_tokenize, word_tokenize
import traceback

# Download NLTK resources
nltk.download('punkt')
nltk.download('stopwords')

class ResponseAnalyzer:
    def __init__(self):
        # Initialize NLP tools
        self.nlp = spacy.load('en_core_web_sm')
        self.language_tool = language_tool_python.LanguageTool('en-US')
        self.stop_words = set(stopwords.words('english'))
        
        # Define common filler words
        self.filler_words = {
            'um', 'uh', 'ah', 'er', 'like', 'you know', 'actually', 'basically',
            'literally', 'so', 'anyway', 'honestly', 'right', 'I mean', 'kind of',
            'sort of', 'well', 'just', 'stuff', 'things', 'okay', 'hmm', 'yeah'
        }

    def analyze_text_response(self, text):
        """Main method to analyze text responses"""
        try:
            if not text or not isinstance(text, str):
                raise ValueError("Invalid text input")

            # Clean and preprocess text
            text = self.clean_text(text)
            
            # Check if text is too short
            if len(text.split()) < 5:
                return self.generate_short_response_analysis(text)

            # Perform all analyses
            grammar_results = self.analyze_grammar(text)
            stop_word_results = self.analyze_stop_words(text)
            filler_word_results = self.analyze_filler_words(text)
            tone_results = self.analyze_tone(text)
            
            # Calculate scores
            scores = self.get_overall_score(
                grammar_results,
                stop_word_results,
                filler_word_results,
                tone_results
            )
            
            # Generate suggestions
            suggestions = self.generate_suggestions(
                grammar_results,
                stop_word_results,
                filler_word_results,
                tone_results,
                scores
            )

            # Prepare final response
            return {
                "scores": scores,
                "word_count": len(word_tokenize(text)),
                "sentence_count": len(sent_tokenize(text)),
                "improvement_suggestions": suggestions,
                "grammar_analysis": {
                    "error_count": grammar_results['error_count'],
                    "error_rate": grammar_results['error_rate'],
                    "error_types": grammar_results['error_types']
                },
                "stop_word_analysis": {
                    "stop_word_count": stop_word_results['stop_word_count'],
                    "stop_word_percentage": stop_word_results['stop_word_percentage'],
                    "most_common_stop_words": stop_word_results['most_common_stop_words']
                },
                "filler_word_analysis": {
                    "filler_word_count": filler_word_results['filler_word_count'],
                    "filler_word_percentage": filler_word_results['filler_word_percentage'],
                    "most_common_fillers": filler_word_results['most_common_fillers']
                },
                "tone_analysis": {
                    "sentiment_score": tone_results['sentiment_score'],
                    "subjectivity_score": tone_results['subjectivity_score'],
                    "formality_score": tone_results['formality_score'],
                    "words_per_sentence": tone_results['words_per_sentence'],
                    "tone_categories": tone_results['tone_categories']
                }
            }

        except Exception as e:
            print(f"Error in analyze_text_response: {str(e)}")
            return {
                "error": str(e),
                "traceback": traceback.format_exc()
            }

    def clean_text(self, text):
        """Remove special characters and normalize"""
        # Remove non-ASCII characters
        text = text.encode('ascii', 'ignore').decode('ascii')
        # Normalize whitespace
        return ' '.join(text.split())

    def analyze_grammar(self, text):
        """Analyze grammatical errors in the text."""
        matches = self.language_tool.check(text)

        errors = []
        for match in matches:
            # Filter out style suggestions and focus on grammar errors
            if match.ruleIssueType in ['grammar', 'typos', 'punctuation']:
                errors.append({
                    'message': match.message,
                    'context': match.context,
                    'suggestions': match.replacements if match.replacements else [],
                    'type': match.ruleId
                })

        grammar_analysis = {
            'error_count': len(errors),
            'errors': errors,
            'error_rate': len(errors) / max(1, len(sent_tokenize(text))),  # Errors per sentence
            'error_types': {}
        }

        # Count types of errors
        for error in errors:
            error_type = error['type']
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
                stop_word_freq[word] = stop_word_freq.get(word, 0) + 1

        most_common = sorted(stop_word_freq.items(), key=lambda x: x[1], reverse=True)[:5]

        return {
            'stop_word_count': stop_word_count,
            'stop_word_percentage': (stop_word_count / max(1, total_words)) * 100,
            'most_common_stop_words': most_common,
            'total_words': total_words
        }

    def analyze_filler_words(self, text):
        """Analyze filler words in the text."""
        text_lower = text.lower()
        tokens = word_tokenize(text_lower)
        total_words = len(tokens)

        # Count filler words
        filler_count = 0
        filler_freq = {}

        for filler in self.filler_words:
            # Count occurrences of each filler word/phrase
            count = len(re.findall(r'\b' + re.escape(filler) + r'\b', text_lower))
            if count > 0:
                filler_freq[filler] = count
                filler_count += count

        most_common = sorted(filler_freq.items(), key=lambda x: x[1], reverse=True)[:5]

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

        # Calculate sentence complexity
        sentences = sent_tokenize(text)
        words_per_sentence = sum(len(word_tokenize(s)) for s in sentences) / max(1, len(sentences))

        # Define tone categories based on analysis
        tone_categories = []

        # Sentiment-based categories
        if sentiment.polarity > 0.3:
            tone_categories.append('Positive')
        elif sentiment.polarity < -0.3:
            tone_categories.append('Negative')
        else:
            tone_categories.append('Neutral')

        # Formality assessment
        formality_score = 0
        contractions_count = len(re.findall(r'\b\w+\'[a-z]+\b', text.lower()))
        first_person_count = len(re.findall(r'\b(i|me|my|mine|myself)\b', text.lower()))
        
        formality_score += (1 - sentiment.subjectivity) * 3
        formality_score -= (contractions_count / max(1, len(sentences))) * 2
        formality_score -= (first_person_count / max(1, len(word_tokenize(text)))) * 3

        if formality_score > 2:
            tone_categories.append('Formal')
        elif formality_score < 0:
            tone_categories.append('Casual')
        else:
            tone_categories.append('Moderately formal')

        return {
            'sentiment_score': sentiment.polarity,
            'subjectivity_score': sentiment.subjectivity,
            'formality_score': formality_score,
            'words_per_sentence': words_per_sentence,
            'tone_categories': tone_categories
        }

    def get_overall_score(self, grammar_analysis, stop_word_analysis, filler_analysis, tone_analysis):
        """Calculate an overall score based on all the analyses."""
        # Score components (all from 0-100)
        grammar_score = max(0, 100 - (grammar_analysis['error_rate'] * 20))
        stop_word_score = max(0, 100 - (stop_word_analysis['stop_word_percentage'] * 1.5))
        filler_score = max(0, 100 - (filler_analysis['filler_word_percentage'] * 3))
        
        # Tone score based on interview context
        tone_score = 70  # Base score
        if 'Formal' in tone_analysis['tone_categories']:
            tone_score += 15
        if 'Confident' in tone_analysis['tone_categories']:
            tone_score += 15
        if 'Negative' in tone_analysis['tone_categories']:
            tone_score -= 20

        # Calculate weighted overall score
        overall_score = (
            grammar_score * 0.35 +
            stop_word_score * 0.15 +
            filler_score * 0.20 +
            tone_score * 0.30
        )

        return {
            'grammar_score': min(100, max(0, grammar_score)),
            'stop_word_score': min(100, max(0, stop_word_score)),
            'filler_score': min(100, max(0, filler_score)),
            'tone_score': min(100, max(0, tone_score)),
            'overall_score': min(100, max(0, overall_score))
        }

    def generate_suggestions(self, grammar_analysis, stop_word_analysis, filler_analysis, tone_analysis, scores):
        """Generate personalized suggestions for improvement."""
        suggestions = []

        # Grammar suggestions
        if scores['grammar_score'] < 80:
            if grammar_analysis['error_count'] > 0:
                common_errors = sorted(grammar_analysis['error_types'].items(), key=lambda x: x[1], reverse=True)
                if common_errors:
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

        if 'Negative' in tone_analysis['tone_categories']:
            suggestions.append("Your tone appears somewhat negative. Try to maintain a positive or neutral tone during interviews.")

        if tone_analysis['subjectivity_score'] > 0.7:
            suggestions.append("Your responses are highly subjective. Try to balance with more objective statements and facts when appropriate.")

        return suggestions

    def generate_short_response_analysis(self, text):
        """Handle very short responses"""
        return {
            "scores": {
                "overall_score": 0,
                "grammar_score": 0,
                "stop_word_score": 0,
                "filler_score": 0,
                "tone_score": 0
            },
            "word_count": len(word_tokenize(text)),
            "sentence_count": len(sent_tokenize(text)),
            "improvement_suggestions": [
                "Please provide more detailed responses",
                "Aim for at least 2-3 complete sentences"
            ],
            "grammar_analysis": {
                "error_count": 0,
                "error_rate": 0,
                "error_types": {}
            },
            "stop_word_analysis": {
                "stop_word_count": 0,
                "stop_word_percentage": 0,
                "most_common_stop_words": []
            },
            "filler_word_analysis": {
                "filler_word_count": 0,
                "filler_word_percentage": 0,
                "most_common_fillers": []
            },
            "tone_analysis": {
                "sentiment_score": 0,
                "subjectivity_score": 0,
                "formality_score": 0,
                "words_per_sentence": 0,
                "tone_categories": ["Neutral"]
            }
        }