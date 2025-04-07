import requests
import json

def check_grammar_percentage(text):
    url = "https://api.languagetoolplus.com/v2/check"  # For free, use "https://api.languagetool.org/v2/check"
    params = {
        "text": text,
        "language": "en-US"
    }

    try:
        response = requests.post(url, data=params)
        response.raise_for_status()  # Raise an error for bad status codes
        result = response.json()

        total_words = len(text.split())
        errors = 0

        for match in result['matches']:
            if "TYPOS" not in match['rule']['category']['id']:  # Ignore spelling suggestions
                errors += 1

        correct_percentage = ((total_words - errors) / total_words) * 100
        print(f"Grammar and Sentence Formation Accuracy: {correct_percentage:.2f}%")
        print("Grammar Suggestions:")
        for match in result['matches']:
            if "TYPOS" not in match['rule']['category']['id']:  # Ignore spelling suggestions
                print(f"- {match['message']} at position {match['offset']}")
                print(f"  Suggestion: {', '.join([repl['value'] for repl in match['replacements']])}")

    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")

# Example usage:
text = "He go to the market yesterday but dont bought anything."
check_grammar_percentage(text)
