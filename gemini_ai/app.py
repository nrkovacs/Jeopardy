import os
import google.generativeai as genai
from flask import Flask, request, jsonify

app = Flask(__name__)

# Configure the generative AI model
genai.configure(api_key=os.environ["GEMINI_API_KEY"])
model = genai.GenerativeModel('gemini-1.5-flash')

@app.route('/api/narrate', methods=['POST'])
def narrate_clue():
    data = request.get_json()
    clue = data.get('clue')
    if not clue:
        return jsonify({'error': 'Clue is required'}), 400

    prompt = f"Narrate the following Jeopardy clue as if you were the host: '{clue}'"
    response = model.generate_content(prompt)
    return jsonify({'narration': response.text})

@app.route('/api/judge', methods=['POST'])
def judge_answer():
    data = request.get_json()
    user_answer = data.get('userAnswer')
    correct_answer = data.get('correctAnswer')

    if not user_answer or not correct_answer:
        return jsonify({'error': 'Both userAnswer and correctAnswer are required'}), 400

    prompt = f"Is '{user_answer}' a correct answer for the Jeopardy clue whose correct response is '{correct_answer}'? Please answer with 'correct' or 'incorrect' and provide a brief explanation."
    response = model.generate_content(prompt)

    feedback = response.text.strip()
    correct = feedback.lower().startswith('correct')

    return jsonify({'correct': correct, 'feedback': feedback})

if __name__ == '__main__':
    app.run(debug=True)
