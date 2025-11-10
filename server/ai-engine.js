// Implementing a simple Neural Network from foundation
class NeuralNetwork {
    constructor(inputSize, hiddenSize, outputSize) {
        // Initialize weights and biases
        this.weightsInputHidden = this.randomMatrix(inputSize, hiddenSize);
        this.weightsHiddenOutput = this.randomMatrix(hiddenSize, outputSize);
        this.biasHidden = this.randomArray(hiddenSize);
        this.biasOutput = this.randomArray(outputSize);
    }

    randomMatrix(rows, cols) {
        return Array.from({ length: rows }, () =>
            Array.from({ length: cols }, () => Math.random() * 2 - 1)
        );
    }

    randomArray(size) {
        return Array.from({ length: size }, () => Math.random() * 2 - 1);
    }

    sigmoid(x) {
        return 1 / (1 + Math.exp(-x));
    }

    forward(input) {
        // Hidden Layer
        const hidden = this.biasHidden.map((bias, i) =>
            this.sigmoid(
                input.reduce((sum, val, j) => sum + val * this.weightsInputHidden[j][i], 0) + bias
            )
        );

        // Output Layer
        const output = this.biasOutput.map((bias, i) =>
            this.sigmoid(
                hidden.reduce((sum, val, j) => sum + val * this.weightsHiddenOutput[j][i], 0) + bias
            )
        );

        return output;
    }
}

// Text similarity using Cosine Similarity
function cosineSimilarity(text1, text2) {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);

    const allWords = [...new Set([...words1, ...words2])];

    const vector1 = allWords.map(word => words1.filter(w => w === word).length);
    const vector2 = allWords.map(word => words2.filter(w => w === word).length);

    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));

    return magnitude1 && magnitude2 ? dotProduct / (magnitude1 * magnitude2) : 0;
}

// AI Engine
class AIEngine {
    constructor() {
        this.trainingData = [];
        this.neuralNet = new NeuralNetwork(10, 5, 1);
        this.loadTrainingData();
    }

    loadTrainingData() {
        // Example: Should be replaced with actual DB logic
        if (typeof dbOperations !== "undefined" && dbOperations.getAllTrainingData) {
            this.trainingData = dbOperations.getAllTrainingData();
            console.log(`Loaded ${this.trainingData.length} training examples`);
        } else {
            console.warn("dbOperations not defined; using empty training data.");
            this.trainingData = [];
        }
    }

    // Identify best answer
    findBestMatch(question) {
        let bestMatch = null;
        let highestScore = 0;

        for (const data of this.trainingData) {
            const score = cosineSimilarity(question, data.question);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = data;
            }
        }

        // Threshold for confidence
        if (highestScore > 0.3) {
            return {
                answer: bestMatch.answer,
                confidence: highestScore,
                category: bestMatch.category
            };
        }

        return null;
    }

    // Generate response
    generateResponse(question, context = {}) {
        const match = this.findBestMatch(question);

        if (match && match.confidence > 0.5) {
            return {
                answer: match.answer,
                confidence: match.confidence,
                category: match.category,
                source: 'knowledge-base'
            };
        }

        // Fallback to contextual generation
        return this.generateContextualResponse(question, context);
    }

    generateContextualResponse(question, context) {
        const questionLower = question.toLowerCase();

        // Programming help
        if (questionLower.includes('code') || questionLower.includes('program')) {
            return {
                answer: "I'd be happy to help with your programming question. Please provide more details about what you're trying to accomplish — include any code snippets or errors.",
                confidence: 0.7,
                category: 'programming',
                source: 'generated'
            };
        }

        // Assignment help
        if (questionLower.includes('assignment') || questionLower.includes('homework')) {
            return {
                answer: "For assignment help: 1) Review requirements carefully, 2) Break it into small parts, 3) Start early, 4) Ask questions if stuck. Which part are you working on?",
                confidence: 0.7,
                category: 'study-tips',
                source: 'generated'
            };
        }

        // Grade inquiry
        if (questionLower.includes('grade') || questionLower.includes('score')) {
            return {
                answer: "You can view your grades in the dashboard under the 'Grades' section. Would you like help understanding a specific grade?",
                confidence: 0.8,
                category: 'platform',
                source: 'generated'
            };
        }

        // Study tips
        if (questionLower.includes('study') || questionLower.includes('learn')) {
            return {
                answer: "Effective study strategies: use active recall, spaced repetition, teach others, and study in focused 25–30 minute sessions. What subject are you studying?",
                confidence: 0.75,
                category: 'study-tips',
                source: 'generated'
            };
        }

        // Default response
        return {
            answer: "I'm here to help! I can assist with programming, study strategies, assignments, or platform navigation. Could you rephrase your question or give more details?",
            confidence: 0.5,
            category: 'general',
            source: 'default'
        };
    }

    // Learning from user interaction
    learnFromInteraction(question, answer, helpful) {
        if (helpful) {
            const category = this.categorizeQuestion(question);
            if (typeof dbOperations !== "undefined" && dbOperations.addTrainingData) {
                dbOperations.addTrainingData(question, answer, category);
                this.loadTrainingData();
            }
        }
    }

    categorizeQuestion(question) {
        const lower = question.toLowerCase();
        if (lower.includes('code') || lower.includes('program')) return 'programming';
        if (lower.includes('study') || lower.includes('learn')) return 'study-tips';
        if (lower.includes('grade') || lower.includes('assignment')) return 'platform';
        return 'general';
    }

    // Get AI statistics
    getStats() {
        const total = this.trainingData.length;
        const categories = [...new Set(this.trainingData.map(d => d.category))];
        const avgConfidence =
            total > 0
                ? this.trainingData.reduce((sum, d) => sum + (d.confidence_score || 0), 0) / total
                : 0;

        return { trainingExamples: total, categories, averageConfidence: avgConfidence };
    }
}

// Creating a singleton instance
const aiEngine = new AIEngine();
module.exports = aiEngine;


