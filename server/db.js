const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(tableName) {
  return path.join(DATA_DIR, `${tableName}.json`);
}

function readTable(tableName) {
  const filePath = getFilePath(tableName);
  if (!fs.existsSync(filePath)) {
    if (tableName === 'questions') {
      // Seed questions from server/questions.json
      const seedPath = path.join(__dirname, 'questions.json');
      if (fs.existsSync(seedPath)) {
        try {
          const seedData = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
          writeTable('questions', seedData);
          return seedData;
        } catch (err) {
          console.error('Error seeding questions:', err);
        }
      }
    }
    return [];
  }
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || '[]');
  } catch (error) {
    console.error(`Error reading table ${tableName}:`, error);
    return [];
  }
}

function writeTable(tableName, data) {
  const filePath = getFilePath(tableName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error(`Error writing table ${tableName}:`, error);
  }
}

// ---- Data Access Helpers ----

const db = {
  // USERS
  getUsers: () => readTable('users'),
  saveUser: (user) => {
    const users = readTable('users');
    const index = users.findIndex(u => u.id === user.id);
    if (index >= 0) {
      users[index] = { ...users[index], ...user };
    } else {
      users.push(user);
    }
    writeTable('users', users);
    return user;
  },
  getUserById: (id) => readTable('users').find(u => u.id === id),
  getUserByEmail: (email) => {
    const cleanEmail = email.trim().toLowerCase();
    return readTable('users').find(u => u.email.trim().toLowerCase() === cleanEmail);
  },

  // PODS
  getPods: () => readTable('pods'),
  savePod: (pod) => {
    const pods = readTable('pods');
    const index = pods.findIndex(p => p.id === pod.id);
    if (index >= 0) {
      pods[index] = { ...pods[index], ...pod };
    } else {
      pods.push(pod);
    }
    writeTable('pods', pods);
    return pod;
  },
  getPodById: (id) => readTable('pods').find(p => p.id === id),
  getPodByInviteCode: (code) => {
    const cleanCode = code.trim().toUpperCase();
    return readTable('pods').find(p => p.invite_code.trim().toUpperCase() === cleanCode);
  },

  // POD MEMBERS
  getPodMembers: () => readTable('pod_members'),
  savePodMember: (member) => {
    const members = readTable('pod_members');
    const index = members.findIndex(m => m.id === member.id);
    if (index >= 0) {
      members[index] = { ...members[index], ...member };
    } else {
      members.push(member);
    }
    writeTable('pod_members', members);
    return member;
  },
  deletePodMember: (id) => {
    const members = readTable('pod_members');
    const filtered = members.filter(m => m.id !== id);
    writeTable('pod_members', filtered);
  },
  getPodMembersByPodId: (podId) => {
    const members = readTable('pod_members').filter(m => m.pod_id === podId);
    // Join user info
    const users = readTable('users');
    return members.map(m => {
      const user = users.find(u => u.id === m.user_id);
      return {
        ...m,
        user_name: user ? user.name : 'Unknown User',
        user_color: user ? user.color : '#C9C2B8',
        user_initial: user ? user.name.charAt(0).toUpperCase() : '?'
      };
    });
  },
  getPodMemberByPodAndUser: (podId, userId) => {
    return readTable('pod_members').find(m => m.pod_id === podId && m.user_id === userId);
  },
  getPodMembersByUserId: (userId) => {
    return readTable('pod_members').filter(m => m.user_id === userId);
  },

  // QUESTIONS
  getQuestions: () => readTable('questions'),
  saveQuestion: (question) => {
    const questions = readTable('questions');
    const index = questions.findIndex(q => q.id === question.id);
    if (index >= 0) {
      questions[index] = { ...questions[index], ...question };
    } else {
      questions.push(question);
    }
    writeTable('questions', questions);
    return question;
  },
  getQuestionById: (id) => readTable('questions').find(q => q.id === id),

  // DAILY QUESTIONS
  getDailyQuestions: () => readTable('daily_questions'),
  saveDailyQuestion: (dq) => {
    const dqs = readTable('daily_questions');
    const index = dqs.findIndex(d => d.id === dq.id);
    if (index >= 0) {
      dqs[index] = { ...dqs[index], ...dq };
    } else {
      dqs.push(dq);
    }
    writeTable('daily_questions', dqs);
    return dq;
  },
  getDailyQuestionsByPodId: (podId) => {
    return readTable('daily_questions').filter(dq => dq.pod_id === podId);
  },

  // ANSWERS
  getAnswers: () => readTable('answers'),
  saveAnswer: (answer) => {
    const answers = readTable('answers');
    const index = answers.findIndex(a => a.id === answer.id);
    if (index >= 0) {
      answers[index] = { ...answers[index], ...answer };
    } else {
      answers.push(answer);
    }
    writeTable('answers', answers);
    return answer;
  },
  getAnswersByDailyQuestionId: (dailyQuestionId) => {
    return readTable('answers').filter(a => a.daily_question_id === dailyQuestionId);
  },

  // REACTIONS
  getReactions: () => readTable('reactions'),
  saveReaction: (reaction) => {
    const reactions = readTable('reactions');
    // A user can only have one reaction per answer. If they click again, it replaces or toggles.
    const index = reactions.findIndex(r => r.answer_id === reaction.answer_id && r.user_id === reaction.user_id);
    if (index >= 0) {
      if (reaction.reaction_type === null || reactions[index].reaction_type === reaction.reaction_type) {
        // Remove reaction if it's the same (toggle off) or set to null
        reactions.splice(index, 1);
      } else {
        reactions[index].reaction_type = reaction.reaction_type;
      }
    } else if (reaction.reaction_type) {
      reactions.push(reaction);
    }
    writeTable('reactions', reactions);
    return reaction;
  },
  getReactionsForAnswers: (answerIds) => {
    return readTable('reactions').filter(r => answerIds.includes(r.answer_id));
  },

  // WAITLIST
  getWaitlist: () => readTable('waitlist'),
  saveWaitlistEmail: (email) => {
    const list = readTable('waitlist');
    const cleanEmail = email.trim().toLowerCase();
    if (!list.some(item => item.email.trim().toLowerCase() === cleanEmail)) {
      const timestamp = new Date().toISOString();
      list.push({
        email: cleanEmail,
        created_at: timestamp
      });
      writeTable('waitlist', list);

      // Also append to CSV spreadsheet
      try {
        const csvPath = path.join(DATA_DIR, 'waitlist.csv');
        if (!fs.existsSync(csvPath)) {
          fs.writeFileSync(csvPath, 'Email,Timestamp\n', 'utf8');
        }
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const formattedDate = `${day}/${month}/${year}`;

        const escapedEmail = cleanEmail.replace(/"/g, '""');
        fs.appendFileSync(csvPath, `"${escapedEmail}",${formattedDate}\n`, 'utf8');
      } catch (err) {
        console.error('Error writing to waitlist CSV:', err);
      }

      return true; // Added
    }
    return false; // Already exists
  }
};

module.exports = db;
