const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Pretty colors for member initials
const PRETTY_COLORS = [
  '#E8533D', // Coral-red
  '#7A8B7A', // Sage green
  '#7E99B3', // Slate blue
  '#D1A153', // Golden ochre
  '#A385B3', // Warm purple
  '#D67B65', // Terracotta
  '#4A8B82'  // Deep teal
];

function getRandomColor() {
  return PRETTY_COLORS[Math.floor(Math.random() * PRETTY_COLORS.length)];
}

// Generate a random 6-character uppercase alphanumeric pod invite code
function generateInviteCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ---- AUTH ENDPOINTS ----

app.post('/api/auth/login-or-signup', (req, res) => {
  const { email, name } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  let user = db.getUserByEmail(email);

  if (user) {
    // Log in existing user
    return res.json({ user, message: 'Logged in successfully.' });
  } else {
    // Sign up new user
    if (!name) {
      return res.status(400).json({ error: 'Name is required for signup.', isSignupRequired: true });
    }
    user = {
      id: uuidv4(),
      email: email.trim().toLowerCase(),
      name: name.trim(),
      color: getRandomColor(),
      created_at: new Date().toISOString()
    };
    db.saveUser(user);
    return res.status(201).json({ user, message: 'Account created successfully.' });
  }
});

// ---- POD ENDPOINTS ----

// Create a new pod
app.post('/api/pods', (req, res) => {
  const { name, userId } = req.body;
  if (!name || !userId) {
    return res.status(400).json({ error: 'Pod name and creator userId are required.' });
  }

  const user = db.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  // Create Pod
  const pod = {
    id: uuidv4(),
    name: name.trim(),
    invite_code: generateInviteCode(),
    created_at: new Date().toISOString()
  };
  db.savePod(pod);

  // Add Creator as member with all categories selected by default
  const member = {
    id: uuidv4(),
    pod_id: pod.id,
    user_id: userId,
    selected_categories: ['relationships', 'finance', 'tech & AI', 'work/career', 'ethics & values', 'general reasoning'],
    joined_at: new Date().toISOString()
  };
  db.savePodMember(member);

  res.status(201).json({ pod, member });
});

// Join a pod via invite code
app.post('/api/pods/join', (req, res) => {
  const { inviteCode, userId } = req.body;
  if (!inviteCode || !userId) {
    return res.status(400).json({ error: 'Invite code and userId are required.' });
  }

  const user = db.getUserById(userId);
  if (!user) {
    return res.status(404).json({ error: 'User not found.' });
  }

  const pod = db.getPodByInviteCode(inviteCode);
  if (!pod) {
    return res.status(404).json({ error: 'Invalid invite code.' });
  }

  // Check if already a member
  const existingMember = db.getPodMemberByPodAndUser(pod.id, userId);
  if (existingMember) {
    return res.json({ pod, member: existingMember, message: 'Already in this pod.' });
  }

  // Check if pod is full (max 8 people)
  const currentMembers = db.getPodMembersByPodId(pod.id);
  if (currentMembers.length >= 8) {
    return res.status(400).json({ error: 'This pod is full (maximum 8 members).' });
  }

  // Join Pod
  const member = {
    id: uuidv4(),
    pod_id: pod.id,
    user_id: userId,
    selected_categories: ['relationships', 'finance', 'tech & AI', 'work/career', 'ethics & values', 'general reasoning'],
    joined_at: new Date().toISOString()
  };
  db.savePodMember(member);

  res.json({ pod, member, message: 'Joined pod successfully.' });
});

// Leave a pod
app.post('/api/pods/leave', (req, res) => {
  const { podId, userId } = req.body;
  if (!podId || !userId) {
    return res.status(400).json({ error: 'podId and userId are required.' });
  }

  const member = db.getPodMemberByPodAndUser(podId, userId);
  if (!member) {
    return res.status(404).json({ error: 'Membership not found.' });
  }

  db.deletePodMember(member.id);
  res.json({ message: 'Left the pod successfully.' });
});

// Update pod categories for a member
app.post('/api/pods/categories', (req, res) => {
  const { podId, userId, categories } = req.body;
  if (!podId || !userId || !Array.isArray(categories)) {
    return res.status(400).json({ error: 'podId, userId, and categories (array) are required.' });
  }

  const member = db.getPodMemberByPodAndUser(podId, userId);
  if (!member) {
    return res.status(404).json({ error: 'Membership not found.' });
  }

  member.selected_categories = categories;
  db.savePodMember(member);

  res.json({ member, message: 'Categories updated successfully.' });
});

// Get active pod and its members + streaks
app.get('/api/pods/active', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const memberships = db.getPodMembersByUserId(userId);
  if (memberships.length === 0) {
    return res.json({ pod: null, members: [] });
  }

  // For v1, return the first pod they are a member of
  const membership = memberships[0];
  const pod = db.getPodById(membership.pod_id);
  if (!pod) {
    return res.json({ pod: null, members: [] });
  }

  const members = db.getPodMembersByPodId(pod.id);
  const answers = db.getAnswers();
  const dailyQuestions = db.getDailyQuestionsByPodId(pod.id);

  // Calculate streaks: last 30 days
  // Let's create a list of dates representing the last 30 days (excluding today, or including today)
  // Let's go back from today's date for 30 days
  const today = new Date();
  const dates = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const membersWithStreaks = members.map(m => {
    // For each date, see if they answered the question assigned on that date
    const history = dates.map(dateStr => {
      const dq = dailyQuestions.find(q => q.date_str === dateStr);
      if (!dq) return null; // No question assigned on this day

      const ans = answers.find(a => a.daily_question_id === dq.id && a.user_id === m.user_id);
      return !!ans; // true if answered, false if missed
    });

    // Count consecutive answered days going backward from yesterday/today
    let streakCount = 0;
    for (let i = dates.length - 1; i >= 0; i--) {
      const dq = dailyQuestions.find(q => q.date_str === dates[i]);
      if (!dq) continue; // skip days with no questions

      const ans = answers.find(a => a.daily_question_id === dq.id && a.user_id === m.user_id);
      if (ans) {
        streakCount++;
      } else {
        // Break streak only if it's not today (maybe they haven't answered today yet but did yesterday)
        const isToday = dates[i] === today.toISOString().split('T')[0];
        if (!isToday) {
          break;
        }
      }
    }

    return {
      ...m,
      streak_count: streakCount,
      streak_history: history // 30 items: true, false, or null
    };
  });

  res.json({ pod, members: membersWithStreaks });
});

// ---- DAILY QUESTION ENDPOINTS ----

app.get('/api/daily-question', (req, res) => {
  const { podId, userId, dateStr } = req.query;
  if (!podId || !userId) {
    return res.status(400).json({ error: 'podId and userId are required.' });
  }

  // Use client's dateStr or fall back to server's dateStr
  const targetDateStr = dateStr || new Date().toISOString().split('T')[0];

  const members = db.getPodMembersByPodId(podId);
  const userMembership = members.find(m => m.user_id === userId);
  if (!userMembership) {
    return res.status(403).json({ error: 'User is not a member of this pod.' });
  }

  // Find daily question for this pod and target date
  let dailyQ = db.getDailyQuestionsByPodId(podId).find(dq => dq.date_str === targetDateStr);

  if (!dailyQ) {
    // A daily question doesn't exist yet for today. Assign one!
    // 1. Get union of categories
    const categoriesSet = new Set();
    members.forEach(m => {
      if (Array.isArray(m.selected_categories)) {
        m.selected_categories.forEach(cat => categoriesSet.add(cat));
      }
    });

    let selectedCategories = Array.from(categoriesSet);
    if (selectedCategories.length === 0) {
      selectedCategories = ['relationships', 'finance', 'tech & AI', 'work/career', 'ethics & values', 'general reasoning'];
    }

    // 2. Fetch all approved questions in those categories
    const allQuestions = db.getQuestions().filter(q => q.is_approved && selectedCategories.includes(q.category));

    if (allQuestions.length === 0) {
      return res.status(404).json({ error: 'No questions available in selected categories.' });
    }

    // 3. Filter out questions already asked in this pod to avoid repeats
    const pastDailyQs = db.getDailyQuestionsByPodId(podId);
    const askedQuestionIds = new Set(pastDailyQs.map(dq => dq.question_id));
    let pool = allQuestions.filter(q => !askedQuestionIds.has(q.id));

    // If all questions have been asked, reset pool to prevent lock
    if (pool.length === 0) {
      pool = allQuestions;
    }

    // Pick random question
    const question = pool[Math.floor(Math.random() * pool.length)];

    // 4. Rotate Askers (Priya asked the pod, Marcus asked, etc.)
    const totalDailyQuestions = pastDailyQs.length;
    const askerIndex = totalDailyQuestions % members.length;
    const asker = members[askerIndex];

    dailyQ = {
      id: uuidv4(),
      pod_id: podId,
      question_id: question.id,
      date_str: targetDateStr,
      asker_id: asker.user_id,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from creation
      created_at: new Date().toISOString()
    };

    db.saveDailyQuestion(dailyQ);
  }

  // Fetch the question details
  const questionDetails = db.getQuestionById(dailyQ.question_id);
  if (!questionDetails) {
    return res.status(500).json({ error: 'Question details not found.' });
  }

  // Get asker details
  const askerUser = db.getUserById(dailyQ.asker_id);

  // Fetch answers submitted so far
  const answers = db.getAnswersByDailyQuestionId(dailyQ.id);
  const myAnswer = answers.find(a => a.user_id === userId);

  // Determine locking states
  const totalMembers = members.length;
  const answeredCount = answers.length;
  const allAnswered = answeredCount === totalMembers;

  const isExpired = new Date() > new Date(dailyQ.expires_at);
  const unlocked = !!(myAnswer && (allAnswered || isExpired));

  // Build members status list
  const answersStatus = members.map(m => {
    const ans = answers.find(a => a.user_id === m.user_id);
    return {
      userId: m.user_id,
      userName: m.user_name,
      userInitial: m.user_initial,
      userColor: m.user_color,
      answered: !!ans
    };
  });

  // Prepare response payload
  const payload = {
    dailyQuestionId: dailyQ.id,
    category: questionDetails.category,
    text: questionDetails.text,
    expiresAt: dailyQ.expires_at,
    asker: {
      name: askerUser ? (askerUser.id === userId ? 'You' : askerUser.name) : 'The Pod',
      initial: askerUser ? askerUser.name.charAt(0).toUpperCase() : '?',
      color: askerUser ? askerUser.color : '#C9C2B8'
    },
    unlocked,
    hasAnswered: !!myAnswer,
    myAnswer: myAnswer || null,
    answersStatus,
    isExpired,
    totalMembers,
    answeredCount
  };

  if (unlocked) {
    // Expose all answers and their reactions
    // Join names and colors to answers
    const answersWithProfiles = answers.map(a => {
      const u = db.getUserById(a.user_id);
      return {
        ...a,
        userName: u ? u.name : 'Unknown Member',
        userColor: u ? u.color : '#C9C2B8',
        userInitial: u ? u.name.charAt(0).toUpperCase() : '?'
      };
    });

    const answerIds = answers.map(a => a.id);
    const reactions = db.getReactionsForAnswers(answerIds);

    // Group reactions by answerId
    const reactionsByAnswer = {};
    reactions.forEach(r => {
      if (!reactionsByAnswer[r.answer_id]) {
        reactionsByAnswer[r.answer_id] = [];
      }
      reactionsByAnswer[r.answer_id].push({
        userId: r.user_id,
        reactionType: r.reaction_type
      });
    });

    payload.answers = answersWithProfiles.map(a => ({
      ...a,
      reactions: reactionsByAnswer[a.id] || []
    }));
  }

  res.json(payload);
});

// ---- ANSWER SUBMISSION ENDPOINT ----

app.post('/api/answers', (req, res) => {
  const { dailyQuestionId, userId, answer, reasoning, confidence } = req.body;

  if (!dailyQuestionId || !userId || !answer || !reasoning || !confidence) {
    return res.status(400).json({ error: 'All fields are required.' });
  }

  // 12-char limit client-side and server-side validation
  if (reasoning.trim().length < 12) {
    return res.status(400).json({ error: 'Reasoning must be at least 12 characters.' });
  }

  const validConfidences = ['low', 'medium', 'high'];
  if (!validConfidences.includes(confidence)) {
    return res.status(400).json({ error: 'Confidence must be low, medium, or high.' });
  }

  // Check if already answered
  const existingAnswers = db.getAnswersByDailyQuestionId(dailyQuestionId);
  if (existingAnswers.some(a => a.user_id === userId)) {
    return res.status(400).json({ error: 'You have already answered today\'s question.' });
  }

  // Save answer
  const answerRecord = {
    id: uuidv4(),
    daily_question_id: dailyQuestionId,
    user_id: userId,
    answer: answer.trim(),
    reasoning: reasoning.trim(),
    confidence,
    created_at: new Date().toISOString()
  };

  db.saveAnswer(answerRecord);

  // Return submitted answer
  res.status(201).json({ answer: answerRecord, message: 'Answer submitted to the pod.' });
});

// ---- REACTIONS ENDPOINT ----

app.post('/api/reactions', (req, res) => {
  const { answerId, userId, reactionType } = req.body;

  if (!answerId || !userId) {
    return res.status(400).json({ error: 'answerId and userId are required.' });
  }

  // Verify they are not reacting to their own answer
  const answers = db.getAnswers();
  const targetAnswer = answers.find(a => a.id === answerId);
  if (!targetAnswer) {
    return res.status(404).json({ error: 'Answer not found.' });
  }

  if (targetAnswer.user_id === userId) {
    return res.status(400).json({ error: 'You cannot react to your own answer.' });
  }

  const validReactions = ['changed my view', 'solid reasoning', 'didn\'t hold up', null];
  if (!validReactions.includes(reactionType)) {
    return res.status(400).json({ error: 'Invalid reaction type.' });
  }

  const reactionRecord = {
    id: uuidv4(),
    answer_id: answerId,
    user_id: userId,
    reaction_type: reactionType,
    created_at: new Date().toISOString()
  };

  db.saveReaction(reactionRecord);

  res.json({ message: 'Reaction updated successfully.' });
});

// ---- STATS / CALIBRATION ENDPOINT ----

app.get('/api/stats/calibration', (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ error: 'userId is required.' });
  }

  const answers = db.getAnswers().filter(a => a.user_id === userId);
  const reactions = db.getReactions();
  const dailyQuestions = db.getDailyQuestions();
  const questions = db.getQuestions();

  const history = answers.map(ans => {
    // Get question details
    const dq = dailyQuestions.find(q => q.id === ans.daily_question_id);
    const qDetails = dq ? questions.find(q => q.id === dq.question_id) : null;

    // Get reactions on this answer
    const ansReactions = reactions.filter(r => r.answer_id === ans.id);

    // Calculate rating
    let positiveCount = 0;
    let negativeCount = 0;
    ansReactions.forEach(r => {
      if (r.reaction_type === 'solid reasoning' || r.reaction_type === 'changed my view') {
        positiveCount++;
      } else if (r.reaction_type === 'didn\'t hold up') {
        negativeCount++;
      }
    });

    return {
      answerId: ans.id,
      dateStr: dq ? dq.date_str : 'Unknown Date',
      category: qDetails ? qDetails.category : 'General',
      questionText: qDetails ? qDetails.text : 'Deleted Question',
      answer: ans.answer,
      reasoning: ans.reasoning,
      confidence: ans.confidence,
      reactions: ansReactions.map(r => ({ type: r.reaction_type })),
      posCount: positiveCount,
      negCount: negativeCount
    };
  });

  // Calculate Brier-Style Calibration Score
  // Stated Confidence Values: High = 0.9, Medium = 0.6, Low = 0.3
  // Stated Probability (f_i):
  //   High -> 0.90
  //   Medium -> 0.60
  //   Low -> 0.30
  // Actual Peer Agreement Outcome (o_i):
  //   If no reactions: We default outcome to match confidence (does not penalize calibration) or treat as neutral (0.5).
  //   Let's treat it as: positive / total_reactions. If total_reactions > 0: o_i = positive / total. Else: skip or o_i = f_i (perfect calibration for this instance).
  // Brier score = 1/N * sum( (f_i - o_i)^2 )
  // A perfect Brier score is 0. A worst is 1.
  let totalBrierDiffSq = 0;
  let evaluatedCount = 0;

  let confidenceDistribution = {
    high: { count: 0, positiveRatioSum: 0 },
    medium: { count: 0, positiveRatioSum: 0 },
    low: { count: 0, positiveRatioSum: 0 }
  };

  history.forEach(item => {
    const f_i = item.confidence === 'high' ? 0.90 : item.confidence === 'medium' ? 0.600 : 0.300;
    const totalRxns = item.posCount + item.negCount;

    if (totalRxns > 0) {
      const o_i = item.posCount / totalRxns;
      const diff = f_i - o_i;
      totalBrierDiffSq += diff * diff;
      evaluatedCount++;

      confidenceDistribution[item.confidence].count++;
      confidenceDistribution[item.confidence].positiveRatioSum += o_i;
    }
  });

  // Scale calibration score so 100% is perfect calibration (Brier = 0) and 0% is worst (Brier = 1)
  const brierScore = evaluatedCount > 0 ? (totalBrierDiffSq / evaluatedCount) : null;
  const calibrationPercent = brierScore !== null ? Math.round((1 - brierScore) * 100) : null;

  // Compute description
  let calibrationStatus = 'Need more reactions to calculate.';
  if (calibrationPercent !== null) {
    if (calibrationPercent >= 85) {
      calibrationStatus = 'Highly calibrated. Your confidence levels perfectly match how your arguments hold up to peers.';
    } else if (calibrationPercent >= 65) {
      calibrationStatus = 'Moderately calibrated. You are generally in tune with how others receive your logic.';
    } else {
      // Determine if overconfident or underconfident
      let overconfidentScore = 0;
      let underconfidentScore = 0;
      history.forEach(item => {
        const f_i = item.confidence === 'high' ? 0.90 : item.confidence === 'medium' ? 0.600 : 0.300;
        const totalRxns = item.posCount + item.negCount;
        if (totalRxns > 0) {
          const o_i = item.posCount / totalRxns;
          if (f_i > o_i) overconfidentScore += (f_i - o_i);
          else if (o_i > f_i) underconfidentScore += (o_i - f_i);
        }
      });

      if (overconfidentScore > underconfidentScore) {
        calibrationStatus = 'Slightly overconfident. You tend to rate your certainty higher than your arguments are evaluated by your pod.';
      } else {
        calibrationStatus = 'Slightly underconfident. Your reasoning is solid, but you tend to rate your own certainty too low.';
      }
    }
  }

  res.json({
    history,
    calibrationScore: brierScore,
    calibrationPercent,
    calibrationStatus,
    evaluatedCount
  });
});

// ---- CUSTOM QUESTIONS MODERATION ENDPOINTS ----

// Submit new question
app.post('/api/questions/submit', (req, res) => {
  const { category, text, userId } = req.body;
  if (!category || !text || !userId) {
    return res.status(400).json({ error: 'category, text, and userId are required.' });
  }

  const validCategories = ['relationships', 'finance', 'tech & AI', 'work/career', 'ethics & values', 'general reasoning'];
  if (!validCategories.includes(category)) {
    return res.status(400).json({ error: 'Invalid category.' });
  }

  const newQuestion = {
    id: 'uq_' + uuidv4().slice(0, 8),
    category,
    text: text.trim(),
    created_by: userId,
    is_approved: false, // Must be approved through votes
    upvotes: 0,
    reports: 0,
    voted_by: [] // track who voted
  };

  db.saveQuestion(newQuestion);
  res.status(201).json({ question: newQuestion, message: 'Question submitted for review.' });
});

// Get pending questions for moderation
app.get('/api/questions/pending', (req, res) => {
  const pending = db.getQuestions().filter(q => !q.is_approved && q.reports < 2);
  res.json({ pending });
});

// Vote/moderate a question
app.post('/api/questions/vote', (req, res) => {
  const { questionId, userId, voteType } = req.body; // voteType: 'upvote' or 'report'

  if (!questionId || !userId || !voteType) {
    return res.status(400).json({ error: 'questionId, userId, and voteType are required.' });
  }

  const question = db.getQuestionById(questionId);
  if (!question) {
    return res.status(404).json({ error: 'Question not found.' });
  }

  if (question.is_approved) {
    return res.status(400).json({ error: 'Question is already approved.' });
  }

  // Initialize vote trackers if not present
  if (!question.voted_by) question.voted_by = [];
  if (question.voted_by.includes(userId)) {
    return res.status(400).json({ error: 'You have already voted on this question.' });
  }

  question.voted_by.push(userId);

  if (voteType === 'upvote') {
    question.upvotes = (question.upvotes || 0) + 1;
    // Approves question if it gets 2 upvotes
    if (question.upvotes >= 2) {
      question.is_approved = true;
    }
  } else if (voteType === 'report') {
    question.reports = (question.reports || 0) + 1;
  } else {
    return res.status(400).json({ error: 'Invalid voteType.' });
  }

  db.saveQuestion(question);
  res.json({ question, message: 'Vote registered.' });
});

// ---- WAITLIST ENDPOINT ----

app.post('/api/waitlist', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const added = db.saveWaitlistEmail(email);
  if (added) {
    res.status(201).json({ success: true, message: 'Successfully joined waitlist.' });
  } else {
    res.status(200).json({ success: true, message: 'Already registered on the waitlist.' });
  }
});

// ---- DEVELOPER / SIMULATION ENDPOINT ----

app.post('/api/dev/simulate-answers', (req, res) => {
  const { podId, dailyQuestionId } = req.body;
  if (!podId || !dailyQuestionId) {
    return res.status(400).json({ error: 'podId and dailyQuestionId are required.' });
  }

  const members = db.getPodMembersByPodId(podId);
  const answers = db.getAnswersByDailyQuestionId(dailyQuestionId);

  const mockReasonings = [
    "Inflation eats lump sums faster than people expect, and I know myself — I'd spend the $50k within two years on nothing memorable. The drip forces structure.",
    "Money today is worth more than money later, full stop. If I can't beat a 0% real return by investing $50k over 20 years I have bigger problems.",
    "Twenty years is a different bet at 25 than at 65. The utility of money peaks in mid-adulthood; I'd take the cash now to build a business.",
    "I'd choose the path of least resistance. Human connection and peace of mind are worth more than any optimization strategy.",
    "This is a classic time-value-of-money question, but it ignores the psychological freedom of having zero debt or instant security today."
  ];

  const mockAnswersText = [
    "The $5,000 annuity",
    "The $50,000 now",
    "Depends on current age",
    "Take the cash immediately",
    "Choose the yearly payout"
  ];

  const confidences = ['low', 'medium', 'high'];
  let simulatedCount = 0;

  members.forEach(m => {
    // Check if member already answered
    const alreadyAnswered = answers.some(a => a.user_id === m.user_id);
    if (!alreadyAnswered) {
      const randomIdx = Math.floor(Math.random() * mockReasonings.length);
      const answerRecord = {
        id: uuidv4(),
        daily_question_id: dailyQuestionId,
        user_id: m.user_id,
        answer: mockAnswersText[randomIdx],
        reasoning: mockReasonings[randomIdx],
        confidence: confidences[Math.floor(Math.random() * confidences.length)],
        created_at: new Date().toISOString()
      };
      db.saveAnswer(answerRecord);
      simulatedCount++;
    }
  });

  res.json({ message: `Successfully simulated answers for ${simulatedCount} pod members.` });
});

// Start backend server
app.listen(PORT, () => {
  console.log(`ColdCheck Backend Server is running on port ${PORT}`);
});
