# Product requirements: SpAIder

## 1. Problem

Interview practice tools are good at asking questions and bad at everything that makes a real interview hard:

- They ask generic questions, not ones built from the job description and the candidate's own resume.
- They rarely follow up. A real interviewer notices what an answer left out and asks about exactly that.
- Their scores can't be explained. "7/10" with no reason teaches nothing, and an AI grader can be generous.
- Nobody tests the resume. Candidates write "cut latency by 40%" and can't say how it was measured.
- Panels, whiteboards and live coding are practised alone, if at all.
- Practice happens in a browser full of distractions, and habits fade after a few days.

## 2. Who it is for

A candidate preparing for technical and AI engineering interviews, practising alone. One person uses one
deployment; there are no accounts.

## 3. Goals

| # | Goal | How we know |
|---|---|---|
| G1 | Practice that feels like the real thing: voice, follow-ups, panels, whiteboard, coding | A full round can be done by voice, without touching the keyboard |
| G2 | Grounded in the candidate's own material: JD, resume, notes | Questions show where they came from; document answers cite pages |
| G3 | Scores you can trust and explain | Every point awarded has a quote from the answer that code has checked |
| G4 | A practice habit | Streak and spider health; weak resume lines come back on a schedule |
| G5 | The AI is never a black box | X-ray of every interview step, private panel notes, a trace of every AI call, evals with targets |

## 4. Non-goals

- Accounts, teams or recruiter features. A single site password protects a deployment.
- Native mobile apps (the web app works at phone width).
- Recording or storing the candidate's audio or video. The camera never leaves the browser.
- Replacing human feedback. The coach prepares the candidate; it doesn't certify them.

## 5. Features

### 5.1 Mock interview
- Topic or pasted JD, 1 to 20 questions, difficulty, 0 to 2 follow-ups per question, text or voice.
- Bella introduces herself, then asks one question at a time.
- After each answer: a grade against the question's key points, then a follow-up only if points were missed and
  follow-ups are left.
- Report: overall score (main questions only), strengths, what to study, every answer with covered and missed
  points. Export as image or PDF.
- Voice mode: a video-call layout with a 3D interviewer, lip-sync, captions in step with the voice, push-to-talk
  (Space), camera self-view.
- X-ray: every step the graph took and why, including each routing decision. Key points stay hidden until the end.
- If an AI step fails, the answer is kept and "Try again" continues from that step.

### 5.2 Panel interview
- Role, company, level, JD and resume (or the Resume grind resume and its weak lines); 2 to 4 panelists; 4, 6 or
  8 main questions; 0 to 2 follow-ups after each; video call or text.
- Each panelist has a focus (technical depth, impact and ownership, system design, the resume, people and
  motivation), a name, a voice, and a fixed introduction.
- Turns: main questions rotate to the panelist who has asked the fewest. After each answer every panelist writes
  a private note and may ask for a follow-up; a moderator picks one (or moves on) and says why.
- End: every panelist votes with reasons; the panel's decision is counted (hire needs at least half); a summary
  shows what they agreed on and where they disagreed.
- The candidate can show or hide the private notes during the interview; the report always shows them.

### 5.3 Resume grind
- Upload a PDF or paste text. Emails, phone numbers and links are removed before anything is stored or sent to
  the AI.
- Claims are copied word for word from the resume; anything the AI invents is dropped.
- Each claim gets two likely questions, a colour (defended, shaky, can't back it up, not asked) and a next date:
  red tomorrow, yellow in 3 days, green in 7.
- A grind is a mock interview about the weakest due lines, one "prove it" question each. Scores flow back to
  the lines, and a line asked twice shows its previous score beside the new one.
- A new resume version keeps the progress of unchanged lines, asks new lines first, and asks changed lines
  first of all, quoting the old wording.

### 5.4 Question bank
- From role, JD, resume, topics and up to 3 uploaded documents, a coordinator splits the work between agents
  (technical, Python, system design, coding, resume, recruiter) that write in parallel and may search the documents.
- A judge scores every question and drops weak ones (at most 40%), and may send one agent back once.
- Review mode pauses for the candidate twice: to edit the plan, and to accept or overrule the judge.
- Any picked questions start a mock interview, whiteboard or coding round.

### 5.5 Whiteboard and coding rounds
- Whiteboard: a system design question on an Excalidraw board. Bella looks at the board when asked, or by
  herself after a pause, and leaves at most two notes on it. The report rates requirements, components, data
  flow, storage, scaling, reliability and trade-offs.
- Coding: a tested problem, Python running in the browser, visible and hidden tests. Interview mode (each hint
  costs points) or practice mode (Bella coaches). Bella reads the code and the test results.

### 5.6 Documents
- Upload PDFs (text-based, up to 10 MB). Ask questions; answers come only from the document, word by word,
  with page numbers. If the document doesn't cover it, say so instead of guessing.
- "Under the hood": the retrieved chunks with scores, and a 3D map of the document's chunks.

### 5.7 Habit and focus
- Stats: streak, activity calendar, finished rounds, and a web of open tasks (unfinished rounds, weak spots).
- The pet spider in the sidebar shows health: its colour and mood drop with missed days and open tasks.
- Focus mode: one click makes a round full screen; leaving for another tab or app is noticed (tab title, icon,
  sound) and greeted with a cobweb when the candidate returns; a summary at the end.

### 5.8 Quality tools
- Evals: labelled cases for the interview grader and the question bank judge, run from the UI or the terminal.
- AI traces: every model call with its prompt, output, tokens, time and errors.

## 6. Cross-cutting requirements

- **Privacy:** contact details removed from resumes; no audio or video stored; secrets only in the server's `.env`.
- **Cost:** voice is cached per sentence; fixed introductions and planned questions are voiced ahead of time;
  a single model setting controls every chat call.
- **Reliability:** every interview is a saved graph; a failed step can be retried without losing the answer.
- **Speed:** live progress for every AI step (no silent spinners); voice for upcoming questions is prepared in
  the background.
- **Accessibility and look:** keyboard-friendly, captions in voice mode, reduced motion respected, light and dark
  themes, works at phone width.

## 7. Success measures

| Measure | Target |
|---|---|
| Grader agrees with human labels on key points | ≥ 90% |
| Grader never gives credit the labels don't (precision) | ≥ 90% |
| Grader doesn't miss credit the labels give (recall) | ≥ 85% |
| Grader's score vs. the human score | within 0.5 points |
| Question bank judge catches planted bad questions | ≥ 83% |
| Judge's drops are right | ≥ 83% |
| Resume lines that turn green within two weeks of practice | most of them |

## 8. Later

- Panel: trap questions (a panelist states something wrong to see if the candidate pushes back) and an
  "Objection!" round where the candidate can challenge the panel's reasons.
- A browser extension that closes distracting tabs during focus mode.
- Uploaded PDFs in S3, vectors in Atlas Vector Search, background work on a queue (SQS).
- Accounts, if more than one person needs to use a deployment.
