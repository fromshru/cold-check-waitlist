import React, { useState } from "react";

// ---- Mock data ---------------------------------------------------------

const TODAY_QUESTION = {
  category: "finance",
  text: "Would you rather have $50,000 today, or $5,000 a year for the next 20 years?",
  askedBy: "Priya",
};

const POD = [
  { id: "you", initial: "S", tag: "you", color: "#E8533D" },
  { id: "priya", initial: "P", tag: "always picks the boring safe answer", color: "#7A8B7A" },
  { id: "marcus", initial: "M", tag: "overthinks it then changes his mind", color: "#C9C2B8" },
  { id: "dana", initial: "D", tag: "answers in four words flat", color: "#A8B9C9" },
];

const MOCK_ANSWERS = {
  priya: {
    answer: "The $5,000 a year",
    reasoning:
      "Inflation eats lump sums faster than people expect, and I know myself — I'd spend the $50k within two years on nothing memorable. The drip forces a kind of structure I don't have on my own.",
    confidence: "medium",
  },
  marcus: {
    answer: "The $50,000 now",
    reasoning:
      "Money today is worth more than money later, full stop. If I can't beat a 0% real return by investing $50k over 20 years I have bigger problems than this question.",
    confidence: "high",
  },
  dana: {
    answer: "Depends on my age",
    reasoning: "Twenty years is a different bet at 25 than at 65.",
    confidence: "low",
  },
};

const REACTIONS = ["changed my view", "solid reasoning", "didn't hold up"];

// ---- Shared bits --------------------------------------------------------

function PodMark({ member, size = 36 }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: member.color,
        color: "#1A1A1A",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'DM Serif Display', serif",
        fontSize: size * 0.46,
        flexShrink: 0,
      }}
    >
      {member.initial}
    </div>
  );
}

function ScreenFrame({ children }) {
  return (
    <div
      style={{
        width: 390,
        height: 760,
        background: "#1A1A1A",
        borderRadius: 36,
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 30px 60px rgba(0,0,0,0.4)",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          height: 28,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 100,
            height: 5,
            borderRadius: 3,
            background: "rgba(250,246,240,0.18)",
          }}
        />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

// ---- Screen 1: the question, as if a friend just sent it ---------------

function QuestionScreen({ onSubmit }) {
  const [answer, setAnswer] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [confidence, setConfidence] = useState(null);

  const canSubmit = answer.trim().length > 0 && reasoning.trim().length > 12 && confidence;

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: "0 28px 28px",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginTop: 6,
          marginBottom: 28,
        }}
      >
        <PodMark member={{ initial: "P", color: "#7A8B7A" }} size={30} />
        <div>
          <div style={{ color: "#FAF6F0", fontSize: 13, fontWeight: 600 }}>
            Priya asked the pod
          </div>
          <div style={{ color: "#8A8A8A", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.6 }}>
            {TODAY_QUESTION.category} · today
          </div>
        </div>
      </div>

      <div
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 28,
          lineHeight: 1.32,
          color: "#FAF6F0",
          marginBottom: 32,
        }}
      >
        {TODAY_QUESTION.text}
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#C9C2B8", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Your answer
        </div>
        <input
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Short answer, no overthinking the wording"
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            borderBottom: "1px solid rgba(250,246,240,0.25)",
            color: "#FAF6F0",
            fontSize: 17,
            fontFamily: "inherit",
            padding: "6px 0",
            outline: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 18 }}>
        <div style={{ color: "#C9C2B8", fontSize: 11, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Why
        </div>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="The reasoning is the part that counts. A sentence or two."
          rows={3}
          style={{
            width: "100%",
            background: "rgba(250,246,240,0.04)",
            border: "1px solid rgba(250,246,240,0.12)",
            borderRadius: 12,
            color: "#FAF6F0",
            fontSize: 15,
            lineHeight: 1.5,
            fontFamily: "inherit",
            padding: 14,
            outline: "none",
            resize: "none",
          }}
        />
      </div>

      <div style={{ marginBottom: 28 }}>
        <div style={{ color: "#C9C2B8", fontSize: 11, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>
          How sure are you
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {["low", "medium", "high"].map((level) => (
            <button
              key={level}
              onClick={() => setConfidence(level)}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 10,
                border:
                  confidence === level
                    ? "1px solid #E8533D"
                    : "1px solid rgba(250,246,240,0.15)",
                background: confidence === level ? "rgba(232,83,61,0.14)" : "transparent",
                color: confidence === level ? "#E8533D" : "#C9C2B8",
                fontSize: 13,
                fontFamily: "inherit",
                textTransform: "capitalize",
                cursor: "pointer",
              }}
            >
              {level}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={() => canSubmit && onSubmit({ answer, reasoning, confidence })}
        disabled={!canSubmit}
        style={{
          marginTop: "auto",
          padding: "16px 0",
          borderRadius: 14,
          border: "none",
          background: canSubmit ? "#E8533D" : "rgba(250,246,240,0.08)",
          color: canSubmit ? "#1A1A1A" : "#6A6A6A",
          fontSize: 15,
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: canSubmit ? "pointer" : "default",
        }}
      >
        Send to the pod
      </button>
      <div style={{ textAlign: "center", color: "#6A6A6A", fontSize: 11, marginTop: 10 }}>
        You'll see everyone else's once you've answered
      </div>
    </div>
  );
}

// ---- Screen 2: waiting, framed as a friend's reply, not a loading state -

function WaitingScreen({ onReveal }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 36px",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", marginBottom: 22 }}>
        {POD.filter((m) => m.id !== "you").map((m, i) => (
          <div key={m.id} style={{ marginLeft: i === 0 ? 0 : -10 }}>
            <PodMark member={m} size={40} />
          </div>
        ))}
      </div>
      <div style={{ color: "#FAF6F0", fontSize: 17, fontFamily: "'DM Serif Display', serif", marginBottom: 10 }}>
        Sent. Two more to go.
      </div>
      <div style={{ color: "#8A8A8A", fontSize: 13, lineHeight: 1.5, marginBottom: 36 }}>
        Marcus and Dana haven't answered yet. Everyone's reasoning unlocks
        once the whole pod is in.
      </div>
      <button
        onClick={onReveal}
        style={{
          padding: "12px 22px",
          borderRadius: 12,
          border: "1px solid rgba(250,246,240,0.2)",
          background: "transparent",
          color: "#C9C2B8",
          fontSize: 13,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        (Prototype: skip ahead to reveal)
      </button>
    </div>
  );
}

// ---- Screen 3: the reveal, framed like messages landing one after another

function RevealScreen({ yourAnswer }) {
  const [reactions, setReactions] = useState({});

  const setReaction = (memberId, reaction) => {
    setReactions((r) => ({ ...r, [memberId]: r[memberId] === reaction ? null : reaction }));
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "10px 28px 14px", borderBottom: "1px solid rgba(250,246,240,0.08)" }}>
        <div style={{ color: "#FAF6F0", fontSize: 13, fontWeight: 600 }}>Everyone answered</div>
        <div style={{ color: "#8A8A8A", fontSize: 11, marginTop: 2 }}>{TODAY_QUESTION.text}</div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px 28px" }}>
        {/* your own answer, quiet, no reactions on yourself */}
        <div style={{ display: "flex", gap: 12, marginBottom: 26, opacity: 0.75 }}>
          <PodMark member={POD[0]} size={34} />
          <div style={{ flex: 1 }}>
            <div style={{ color: "#FAF6F0", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
              You · {yourAnswer.answer}
            </div>
            <div style={{ color: "#C9C2B8", fontSize: 13.5, lineHeight: 1.5 }}>
              {yourAnswer.reasoning}
            </div>
          </div>
        </div>

        {POD.filter((m) => m.id !== "you").map((member) => {
          const data = MOCK_ANSWERS[member.id];
          return (
            <div key={member.id} style={{ display: "flex", gap: 12, marginBottom: 26 }}>
              <PodMark member={member} size={34} />
              <div style={{ flex: 1 }}>
                <div style={{ color: "#FAF6F0", fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                  {member.id.charAt(0).toUpperCase() + member.id.slice(1)} · {data.answer}
                </div>
                <div style={{ color: "#C9C2B8", fontSize: 13.5, lineHeight: 1.5, marginBottom: 10 }}>
                  {data.reasoning}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {REACTIONS.map((r) => {
                    const active = reactions[member.id] === r;
                    return (
                      <button
                        key={r}
                        onClick={() => setReaction(member.id, r)}
                        style={{
                          padding: "6px 11px",
                          borderRadius: 20,
                          border: active
                            ? r === "didn't hold up"
                              ? "1px solid #E8533D"
                              : "1px solid #7A8B7A"
                            : "1px solid rgba(250,246,240,0.14)",
                          background: active
                            ? r === "didn't hold up"
                              ? "rgba(232,83,61,0.12)"
                              : "rgba(122,139,122,0.16)"
                            : "transparent",
                          color: active
                            ? r === "didn't hold up"
                              ? "#E8533D"
                              : "#9CB89C"
                            : "#8A8A8A",
                          fontSize: 11.5,
                          fontFamily: "inherit",
                          cursor: "pointer",
                        }}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---- App shell ------------------------------------------------------

export default function ColdCheckPrototype() {
  const [stage, setStage] = useState("question");
  const [yourAnswer, setYourAnswer] = useState(null);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0E0E0E",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 40,
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Inter:wght@400;500;600&display=swap"
        rel="stylesheet"
      />

      <ScreenFrame>
        {stage === "question" && (
          <QuestionScreen
            onSubmit={(data) => {
              setYourAnswer(data);
              setStage("waiting");
            }}
          />
        )}
        {stage === "waiting" && <WaitingScreen onReveal={() => setStage("reveal")} />}
        {stage === "reveal" && <RevealScreen yourAnswer={yourAnswer} />}
      </ScreenFrame>

      <div style={{ display: "flex", gap: 10 }}>
        {["question", "waiting", "reveal"].map((s) => (
          <button
            key={s}
            onClick={() => setStage(s)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: stage === s ? "1px solid #E8533D" : "1px solid #333",
              background: stage === s ? "rgba(232,83,61,0.12)" : "transparent",
              color: stage === s ? "#E8533D" : "#888",
              fontSize: 12,
              fontFamily: "'Inter', sans-serif",
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
