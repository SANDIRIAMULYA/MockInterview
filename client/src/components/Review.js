import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, CircularProgress, Box, Typography, Paper, Alert } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import './Review.css';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const getScoreColor = (score) => {
    if (score >= 80) return '#4CAF50';
    if (score >= 60) return '#FFC107';
    if (score >= 40) return '#FF9800';
    return '#F44336';
};

const defaultAnalysis = {
    scores: {
        overall_score: 72,
        grammar_score: 78,
        stop_word_score: 65,
        filler_score: 68,
        tone_score: 82
    },
    improvement_suggestions: [
        "Try to reduce filler words like 'um' and 'uh'",
        "Practice speaking more concisely",
        "Maintain a confident tone throughout your responses",
        "Review common grammar rules for technical interviews"
    ],
    grammar_analysis: {
        error_count: 4,
        error_types: { "Subject-Verb Agreement": 2, "Article Usage": 1, "Preposition": 1 }
    },
    stop_word_analysis: {
        stop_word_count: 18,
        stop_word_percentage: 14.2,
        most_common_stop_words: [["the", 6], ["and", 5], ["that", 3]]
    },
    filler_word_analysis: {
        filler_word_count: 9,
        filler_word_percentage: 7.1,
        most_common_fillers: [["um", 4], ["like", 3], ["you know", 2]]
    },
    tone_analysis: {
        tone_categories: ["Neutral", "Moderately formal", "Confident"],
        sentiment_score: 0.25,
        formality_score: 2.1
    }
};

const defaultStats = {
    totalQuestions: 6,
    answeredQuestions: 5,
    answerRate: 83.3,
    pausePercentage: "18.50",
    skillStats: {
        "JavaScript": { questions: 2, answered: 2, percentage: 100 },
        "React": { questions: 2, answered: 1, percentage: 50 },
        "Node.js": { questions: 1, answered: 1, percentage: 100 },
        "CSS": { questions: 1, answered: 1, percentage: 100 }
    },
    transcript: "Interviewer: Can you explain how React's virtual DOM works?\n\nCandidate: Sure! The virtual DOM is a lightweight copy of the actual DOM. When changes occur, React compares the virtual DOM with a previous version to determine the most efficient way to update the browser's DOM. This reconciliation process helps improve performance by minimizing direct DOM manipulations.\n\nInterviewer: That's correct. How would you optimize a React application?\n\nCandidate: Well... um... I would use techniques like code splitting, memoization, and avoiding unnecessary re-renders. Also, using the React DevTools helps identify performance bottlenecks."
};

const Review = () => {
    const navigate = useNavigate();
    const [interviewData, setInterviewData] = useState(null);
    const [stats, setStats] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(true);
    const [analysisLoading, setAnalysisLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showDefault, setShowDefault] = useState(false);

    const renderStatCard = (title, value, subtitle) => (
        <div className="stat-card">
            <Typography variant="h6">{title}</Typography>
            <Typography variant="h3">{value}</Typography>
            <Typography variant="subtitle1">{subtitle}</Typography>
        </div>
    );

    const renderScoreCards = (analysisData) => {
        // Add null checks for analysis data
        if (!analysisData || !analysisData.scores || !analysisData.grammar_analysis || 
            !analysisData.stop_word_analysis || !analysisData.filler_word_analysis || 
            !analysisData.tone_analysis) {
            return null;
        }

        return [
            { 
                key: 'overall', 
                label: 'Overall', 
                value: analysisData.scores.overall_score || 0,
                detail: null
            },
            { 
                key: 'grammar', 
                label: 'Grammar', 
                value: analysisData.scores.grammar_score || 0,
                detail: analysisData.grammar_analysis ? `${analysisData.grammar_analysis.error_count || 0} errors` : '0 errors'
            },
            { 
                key: 'stop_words', 
                label: 'Stop Words', 
                value: analysisData.scores.stop_word_score || 0,
                detail: analysisData.stop_word_analysis ? `${analysisData.stop_word_analysis.stop_word_count || 0} found` : '0 found'
            },
            { 
                key: 'filler', 
                label: 'Filler Words', 
                value: analysisData.scores.filler_score || 0,
                detail: analysisData.filler_word_analysis ? `${analysisData.filler_word_analysis.filler_word_count || 0} found` : '0 found'
            },
            { 
                key: 'tone', 
                label: 'Tone', 
                value: analysisData.scores.tone_score || 0,
                detail: analysisData.tone_analysis ? 
                    (analysisData.tone_analysis.tone_categories || ['Neutral']).join(', ') : 
                    'Neutral'
            }
        ].map((item) => (
            <Box key={item.key} sx={{ 
                position: 'relative',
                width: 120,
                height: 120,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <CircularProgress 
                    variant="determinate" 
                    value={item.value} 
                    size={120}
                    thickness={4}
                    sx={{
                        color: getScoreColor(item.value),
                        position: 'absolute',
                        top: 0,
                        left: 0
                    }}
                />
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center'
                }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                        {item.value.toFixed(0)}
                    </Typography>
                    <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                        {item.label}
                    </Typography>
                    {item.detail && (
                        <Typography variant="caption" sx={{ fontSize: '0.6rem', mt: 0.5 }}>
                            {item.detail}
                        </Typography>
                    )}
                </Box>
            </Box>
        ));
    };

    const renderSkillChart = (statsData) => {
        if (!statsData?.skillStats) return null;
        
        return (
            <div className="chart-container">
                <Typography variant="h6" align="center">Answer Rate by Skill</Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={Object.entries(statsData.skillStats).map(([skill, data]) => ({
                        name: skill,
                        value: data.percentage,
                        questions: data.questions,
                        answered: data.answered
                    }))}>
                        <XAxis dataKey="name" />
                        <YAxis unit="%" />
                        <Tooltip 
                            formatter={(value, name, props) => [
                                `${value}% (${props.payload.answered}/${props.payload.questions})`,
                                name
                            ]}
                        />
                        <Bar dataKey="value" fill="#8884d8">
                            {Object.entries(statsData.skillStats).map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const renderPauseChart = (statsData) => {
        if (!statsData?.pausePercentage) return null;
        
        return (
            <div className="chart-container">
                <Typography variant="h6" align="center">Speaking vs Pauses</Typography>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={[
                                { name: 'Speaking', value: 100 - parseFloat(statsData.pausePercentage) || 0 },
                                { name: 'Pauses', value: parseFloat(statsData.pausePercentage) || 0 }
                            ]}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                            label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(1)}%`}
                        >
                            <Cell key="cell-speaking" fill={COLORS[0]} />
                            <Cell key="cell-pauses" fill={COLORS[1]} />
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}%`, 'Percentage']} />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        );
    };

    const renderDefaultView = () => (
        <div className="review-container">
            <Typography variant="h4" gutterBottom>Interview Review</Typography>
            
            <Alert severity="info" sx={{ mb: 3 }}>
                No recent interview responses found. Here's a sample analysis to demonstrate what you'll see after completing a mock interview.
            </Alert>

            {/* Stats Overview */}
            <div className="stats-overview">
                {renderStatCard("Questions Answered", `${defaultStats.answeredQuestions}/${defaultStats.totalQuestions}`, `(${defaultStats.answerRate.toFixed(1)}%)`)}
                {renderStatCard("Pause Percentage", `${defaultStats.pausePercentage}%`, "of total interview time")}
                {renderStatCard("Overall Score", `${defaultAnalysis.scores.overall_score.toFixed(1)}/100`, "Response Quality")}
            </div>

            {/* Analysis Section */}
            <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                <Typography variant="h5" gutterBottom>Sample Response Analysis</Typography>
                
                {/* Score Cards */}
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4, justifyContent: 'center' }}>
                    {renderScoreCards(defaultAnalysis)}
                </Box>

                {/* Radar Chart */}
                <Box sx={{ height: 300, mb: 4 }}>
                    <Typography variant="h6" align="center" gutterBottom>
                        Response Quality Breakdown
                    </Typography>
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                            { subject: 'Grammar', A: defaultAnalysis.scores.grammar_score, fullMark: 100 },
                            { subject: 'Stop Words', A: defaultAnalysis.scores.stop_word_score, fullMark: 100 },
                            { subject: 'Filler Words', A: defaultAnalysis.scores.filler_score, fullMark: 100 },
                            { subject: 'Tone', A: defaultAnalysis.scores.tone_score, fullMark: 100 },
                            { subject: 'Overall', A: defaultAnalysis.scores.overall_score, fullMark: 100 },
                        ]}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" />
                            <PolarRadiusAxis angle={30} domain={[0, 100]} />
                            <Radar 
                                name="Score" 
                                dataKey="A" 
                                stroke="#8884d8" 
                                fill="#8884d8" 
                                fillOpacity={0.6} 
                            />
                            <Tooltip formatter={(value) => [`${value}/100`, 'Score']} />
                        </RadarChart>
                    </ResponsiveContainer>
                </Box>

                {/* Improvement Suggestions */}
                <Box>
                    <Typography variant="h6" gutterBottom>Sample Improvement Suggestions</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {defaultAnalysis.improvement_suggestions.map((suggestion, index) => (
                            <Paper 
                                key={index} 
                                elevation={2}
                                sx={{
                                    p: 2,
                                    borderLeft: '4px solid',
                                    borderColor: 'primary.main',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: 2
                                }}
                            >
                                <Box sx={{
                                    width: 24,
                                    height: 24,
                                    borderRadius: '50%',
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    mt: '2px'
                                }}>
                                    {index + 1}
                                </Box>
                                <Typography variant="body1">{suggestion}</Typography>
                            </Paper>
                        ))}
                    </Box>
                </Box>
            </Paper>

            {/* Charts Section */}
            <div className="charts-section">
                {renderSkillChart(defaultStats)}
                {renderPauseChart(defaultStats)}
            </div>

            {/* Transcript Section */}
            <div className="transcript-section">
                <Typography variant="h6">Sample Transcript</Typography>
                <div className="transcript-content">
                    {defaultStats.transcript.split('\n').map((para, i) => (
                        <Typography key={i} paragraph>{para}</Typography>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/upload')}
                    size="large"
                    sx={{ mt: 3 }}
                >
                    Start Your First Interview
                </Button>
            </div>
        </div>
    );

    useEffect(() => {
        const fetchResults = async () => {
            try {
                setLoading(true);
                setError(null);
                
                const results = localStorage.getItem('interviewResults');
                if (!results) {
                    setShowDefault(true);
                    setLoading(false);
                    return;
                }

                const data = JSON.parse(results);
                
                const hasResponses = data.messages?.some(msg => msg.type === 'user');
                
                if (!hasResponses) {
                    setShowDefault(true);
                    setLoading(false);
                    return;
                }

                setInterviewData(data);
                calculateStats(data);

                if (data.analysis) {
                    setAnalysis(data.analysis);
                } else {
                    await performAnalysis(data);
                }
            } catch (err) {
                setError('Failed to load interview results');
                console.error('Error loading results:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchResults();
    }, [navigate]);

    const performAnalysis = async (data) => {
        setAnalysisLoading(true);
        setError(null);
        
        try {
            const responseText = data.messages
                .filter(msg => msg.type === 'user')
                .map(msg => msg.text)
                .join(' ')
                .trim();

            if (!responseText) {
                throw new Error('No responses to analyze');
            }

            const response = await fetch('http://localhost:5000/analyze-text', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text: responseText }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Analysis failed');
            }

            const result = await response.json();
            
            const updatedResults = {
                ...data,
                analysis: result,
                analyzedAt: new Date().toISOString()
            };
            
            localStorage.setItem('interviewResults', JSON.stringify(updatedResults));
            setInterviewData(updatedResults);
            setAnalysis(result);
            
            return result;
        } catch (err) {
            setError(err.message || 'Failed to analyze responses');
            console.error('Analysis error:', err);
            return null;
        } finally {
            setAnalysisLoading(false);
        }
    };

    const calculateStats = (data) => {
        if (!data) return;

        const userMessages = data.messages?.filter(msg => msg.type === 'user') || [];
        const questionsAsked = data.messages?.filter(msg => msg.type === 'bot' && msg.skill) || [];
        
        let totalPauseTime = 0;
        let totalAudioTime = 0;
        
        if (data.transcript?.pauses) {
            data.transcript.pauses.forEach(pause => {
                totalPauseTime += (pause.end - pause.start);
            });
            
            if (data.transcript.segments?.length > 0) {
                totalAudioTime = data.transcript.segments[data.transcript.segments.length - 1].end;
            }
        }
        
        const pausePercentage = totalAudioTime > 0 ? (totalPauseTime / totalAudioTime) * 100 : 0;

        const skillStats = {};
        data.skills?.forEach(skill => {
            const skillQuestions = questionsAsked.filter(q => q.skill === skill).length;
            const skillAnswers = userMessages.filter((msg, i) => {
                return i > 0 && data.messages[i-1].skill === skill;
            }).length;
            
            skillStats[skill] = {
                questions: skillQuestions,
                answered: skillAnswers,
                percentage: skillQuestions > 0 ? (skillAnswers / skillQuestions) * 100 : 0
            };
        });

        setStats({
            totalQuestions: questionsAsked.length,
            answeredQuestions: userMessages.length,
            answerRate: questionsAsked.length > 0 ? (userMessages.length / questionsAsked.length) * 100 : 0,
            pausePercentage: pausePercentage.toFixed(2),
            skillStats,
            pauses: data.transcript?.pauses || [],
            transcript: data.transcript?.text || "No transcript available"
        });
    };

    const handleNewInterview = () => {
        localStorage.removeItem('interviewResults');
        navigate('/upload');
    };

    const handleRetryAnalysis = async () => {
        if (interviewData) {
            await performAnalysis(interviewData);
        }
    };

    if (loading || analysisLoading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh" flexDirection="column">
                <CircularProgress size={60} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    {analysisLoading ? 'Analyzing your responses...' : 'Loading your interview results...'}
                </Typography>
            </Box>
        );
    }

    if (showDefault) {
        return renderDefaultView();
    }

    if (error || !interviewData || !stats) {
        return (
            <Box textAlign="center" mt={4}>
                <Typography variant="h5" gutterBottom>
                    {error || 'No interview data available'}
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={() => navigate('/')}
                    sx={{ mt: 2 }}
                >
                    Back to Home
                </Button>
            </Box>
        );
    }

    return (
        <div className="review-container">
            <Typography variant="h4" gutterBottom>Interview Review</Typography>
            
            {/* Stats Overview */}
            <div className="stats-overview">
                {renderStatCard("Questions Answered", `${stats.answeredQuestions}/${stats.totalQuestions}`, `(${stats.answerRate.toFixed(1)}%)`)}
                {renderStatCard("Pause Percentage", `${stats.pausePercentage}%`, "of total interview time")}
                {analysis?.scores && renderStatCard("Overall Score", `${analysis.scores.overall_score.toFixed(1)}/100`, "Response Quality")}
            </div>

            {/* Analysis Section */}
            {analysis && (
                <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
                    <Typography variant="h5" gutterBottom>Response Analysis</Typography>
                    
                    {/* Score Cards */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, mb: 4, justifyContent: 'center' }}>
                        {renderScoreCards(analysis)}
                    </Box>

                    {/* Radar Chart */}
                    <Box sx={{ height: 300, mb: 4 }}>
                        <Typography variant="h6" align="center" gutterBottom>
                            Response Quality Breakdown
                        </Typography>
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={[
                                { subject: 'Grammar', A: analysis.scores.grammar_score || 0, fullMark: 100 },
                                { subject: 'Stop Words', A: analysis.scores.stop_word_score || 0, fullMark: 100 },
                                { subject: 'Filler Words', A: analysis.scores.filler_score || 0, fullMark: 100 },
                                { subject: 'Tone', A: analysis.scores.tone_score || 0, fullMark: 100 },
                                { subject: 'Overall', A: analysis.scores.overall_score || 0, fullMark: 100 },
                            ]}>
                                <PolarGrid />
                                <PolarAngleAxis dataKey="subject" />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                                <Radar 
                                    name="Score" 
                                    dataKey="A" 
                                    stroke="#8884d8" 
                                    fill="#8884d8" 
                                    fillOpacity={0.6} 
                                />
                                <Tooltip formatter={(value) => [`${value}/100`, 'Score']} />
                            </RadarChart>
                        </ResponsiveContainer>
                    </Box>

                    {/* Improvement Suggestions */}
                    {analysis.improvement_suggestions?.length > 0 && (
                        <Box>
                            <Typography variant="h6" gutterBottom>Improvement Suggestions</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                {analysis.improvement_suggestions.map((suggestion, index) => (
                                    <Paper 
                                        key={index} 
                                        elevation={2}
                                        sx={{
                                            p: 2,
                                            borderLeft: '4px solid',
                                            borderColor: 'primary.main',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 2
                                        }}
                                    >
                                        <Box sx={{
                                            width: 24,
                                            height: 24,
                                            borderRadius: '50%',
                                            bgcolor: 'primary.main',
                                            color: 'white',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            flexShrink: 0,
                                            mt: '2px'
                                        }}>
                                            {index + 1}
                                        </Box>
                                        <Typography variant="body1">{suggestion}</Typography>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    )}
                </Paper>
            )}

            {/* Charts Section */}
            <div className="charts-section">
                {renderSkillChart(stats)}
                {renderPauseChart(stats)}
            </div>

            {/* Transcript Section */}
            <div className="transcript-section">
                <Typography variant="h6">Full Transcript</Typography>
                <div className="transcript-content">
                    {stats.transcript.split('\n').map((para, i) => (
                        <Typography key={i} paragraph>{para}</Typography>
                    ))}
                </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
                <Button 
                    variant="contained" 
                    color="primary" 
                    onClick={handleNewInterview}
                    size="large"
                    sx={{ mt: 3 }}
                >
                    Start New Interview
                </Button>
                {error && (
                    <Button 
                        variant="outlined" 
                        color="error" 
                        onClick={handleRetryAnalysis}
                        size="large"
                        sx={{ mt: 3, ml: 2 }}
                    >
                        Retry Analysis
                    </Button>
                )}
            </div>
        </div>
    );
};

export default Review;