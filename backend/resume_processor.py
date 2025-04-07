# Keep all your existing functions, add these modifications:

def process_resume(pdf_path):
    text = extract_text_from_pdf(pdf_path)
    clean_text = preprocess_text(text)
    return extract_skills(clean_text)

def generate_questions(skills):
    """Generate random questions based on extracted skills."""
    questions = {
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