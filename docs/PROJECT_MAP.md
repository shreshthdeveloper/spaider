# Project map

Every API route, backend function and frontend file, with one line on what it does. Generated from the
code's docstrings and comments by `python -m scripts.project_map` (run from `backend/`): don't edit this
file by hand. Change the docstring or comment, then run the script again.

## API routes

Every route lives under `/api`. Its handler is in `backend/routes/`.

| Method | Path | Handler | What it does |
|---|---|---|---|
| POST | `/api/chat` | `chat.chat` | {message, session_id}: sends a message (to a new chat when there is no session_id) and returns the AI's reply. |
| GET | `/api/chat/<session_id>` | `chat.chat_history` | every message of one chat, to show it again after a reload. |
| GET | `/api/coding/problems` | `coding.list_problems` | the problems for the setup screen (without their tests). |
| GET | `/api/coding` | `coding.list_sessions` | your recent coding rounds, newest first. |
| POST | `/api/coding` | `coding.start_session` | {problem_id or "surprise", difficulty, mode}: starts a round, and Bella greets you. |
| GET | `/api/coding/<session_id>` | `coding.get_session` | one round: the problem, your code, the conversation, and the report once it is finished. |
| PUT | `/api/coding/<session_id>/code` | `coding.save_code` | {code}: saves your code without asking Bella, so a reload never loses it. |
| POST | `/api/coding/<session_id>/review` | `coding.review_code` | {code, results, reply, hint}: Bella reads your code and test results, and reacts. |
| POST | `/api/coding/<session_id>/finish` | `coding.finish_session` | {code, results}: ends the round and writes the report. |
| POST | `/api/documents` | `documents.upload_document` | (a form with a PDF in "file"): reads, splits and indexes the PDF so you can ask about it. |
| GET | `/api/documents` | `documents.list_documents` | every uploaded document, newest first. |
| GET | `/api/documents/<document_id>` | `documents.get_document` | one document's name, page count and chunk count. |
| GET | `/api/documents/<document_id>/map` | `documents.document_map` | every chunk as a point in 3D, for the Under the hood panel. |
| POST | `/api/documents/<document_id>/ask` | `documents.ask_document` | {question}: an answer from this document only, with page numbers. |
| POST | `/api/documents/<document_id>/ask/live` | `documents.ask_document_live` | {question}: the same answer, word by word (Server-Sent Events): "retrieved" when the search is done, "token" for every few words, then "done" with the sources. |
| DELETE | `/api/documents/<document_id>` | `documents.delete_document` | removes the document, its chunks and its file. |
| GET | `/api/evals` | `evals.list_evals` | what each suite tests, and the latest runs (without their cases). |
| POST | `/api/evals` | `evals.run_eval` | {suite}: runs a suite in the background. It calls the real AI, so it costs a little (see ai_calls in GET /api/evals). |
| GET | `/api/evals/<run_id>` | `evals.get_eval` | one run with every case: what you expected, and what the AI did. |
| GET | `/api/health` | `health.health` | Is the backend up, and can it reach MongoDB? The sidebar checks this every 15 seconds. |
| POST | `/api/interviews` | `interview.start_interview` | {topic, num_questions, difficulty, follow_ups, mode}: plans the questions and returns the first one. |
| GET | `/api/interviews` | `interview.list_interviews` | your recent interviews, newest first. |
| GET | `/api/interviews/<interview_id>` | `interview.get_interview` | the current question while it runs, or the report once it is finished. |
| POST | `/api/interviews/<interview_id>/answer` | `interview.answer_question` | {answer}: grades your answer, and returns the next question (or the report). |
| POST | `/api/interviews/<interview_id>/answer/live` | `interview.answer_question_live` | {answer}: the same as /answer, but as a live stream (Server-Sent Events): "start" and "finish" for each step of the graph as it runs, then "done" with the next question (or the report). |
| GET | `/api/interviews/<interview_id>/xray` | `interview.interview_xray` | every step the interview graph took, with what it decided and why. |
| POST | `/api/interviews/<interview_id>/end` | `interview.end_interview` | stops early and writes the report from what you answered so far. |
| POST | `/api/interviews/<interview_id>/retry` | `interview.retry_interview` | runs the last step again after it failed (for example, the AI was down). |
| GET | `/api/panels/panelists` | `panel.list_panelists` | everyone who can sit on a panel. |
| GET | `/api/panels` | `panel.list_panels` | your recent panel interviews, newest first. |
| POST | `/api/panels` | `panel.start_panel` | (a form, because the JD and resume can be PDFs): role, company, level, jd or jd_file, resume or resume_file, use_resume_grind ("yes" = use the Resume grind's resume and its weak lines), panelists (2 to 4 of them), num_q… |
| GET | `/api/panels/<panel_id>` | `panel.get_panel` | the conversation and the current question, or the report once it's finished. |
| POST | `/api/panels/<panel_id>/answer/live` | `panel.answer_live` | {answer}: grades your answer, lets every panelist write their note, and the moderator picks what comes next. Sent as a live stream (Server-Sent Events) step by step. |
| POST | `/api/panels/<panel_id>/end` | `panel.end_panel` | stops early; the panel decides on what you answered so far. |
| POST | `/api/panels/<panel_id>/retry` | `panel.retry_panel` | runs the last step again after it failed (for example, the AI was down). |
| GET | `/api/question-banks/agents` | `question_bank.list_agents` | the agents you can put on the panel. |
| GET | `/api/question-banks` | `question_bank.list_banks` | your recent banks, newest first. |
| POST | `/api/question-banks` | `question_bank.create_bank` | (a form, not JSON, because the JD and the resume can be PDF files): starts the panel in the background and returns the new bank at once. |
| GET | `/api/question-banks/<bank_id>` | `question_bank.get_bank` | the bank and its live pipeline. The page asks again every second while it runs. |
| POST | `/api/question-banks/<bank_id>/retry` | `question_bank.retry_bank` | runs the whole panel again, with the same inputs. |
| DELETE | `/api/question-banks/<bank_id>` | `question_bank.delete_bank` | deletes a bank (not while its panel is working). |
| POST | `/api/question-banks/<bank_id>/practice` | `question_bank.practise` | {question_ids, voice, coding_mode}: starts a round from the picked questions. |
| POST | `/api/question-banks/<bank_id>/review` | `question_bank.review_bank` | Review mode: your decision where the panel paused (human in the loop). |
| GET | `/api/resume` | `resume_grind.get_resume` | your resume with every claim and its colour, or {"resume": null} before the first upload. |
| POST | `/api/resume` | `resume_grind.upload_resume` | (a form, because it can carry a PDF): file = the resume as a PDF, or text = pasted text. The first upload creates your resume; the next ones are new versions of it. |
| POST | `/api/resume/grind` | `resume_grind.start_grind` | {count, mode}: starts a mock interview about your weakest claims that are due. Returns the interview, so the page can open it. |
| DELETE | `/api/resume` | `resume_grind.delete_resume` | removes your resume and its claims (the grind interviews stay). |
| GET | `/api/stats` | `stats.get_stats` | your streak, your spider's health, and the tasks on your web. |
| GET | `/api/traces` | `traces.list_traces` | (all optional): one page of AI calls, newest first. |
| GET | `/api/traces/<trace_id>` | `traces.get_trace` | one AI call in full: the exact prompt, the answer, the tokens and the time. |
| POST | `/api/voice/speak` | `voice.speak` | {text, voice}: an interviewer saying `text`, as MP3 audio. voice is optional: a panelist's voice (one of voice.PANEL_VOICES); without it, Bella's voice. |
| POST | `/api/voice/transcribe` | `voice.transcribe` | (a form with an "audio" file and a "hint"): the words in your recorded answer. |
| GET | `/api/whiteboard/questions` | `whiteboard.list_questions` | the ready-made design questions. |
| GET | `/api/whiteboard` | `whiteboard.list_sessions` | your recent whiteboard rounds, newest first. |
| POST | `/api/whiteboard` | `whiteboard.start_session` | {question_id} or {question, brief}: starts a round, and Bella greets you. |
| GET | `/api/whiteboard/<session_id>` | `whiteboard.get_session` | one round: the question, your drawing, the conversation, and the report once it is finished. |
| PUT | `/api/whiteboard/<session_id>/scene` | `whiteboard.save_scene` | {scene}: saves your drawing without asking Bella, so a reload never loses it. |
| POST | `/api/whiteboard/<session_id>/review` | `whiteboard.review_board` | {scene, image, reply}: Bella looks at the board (and your reply), and reacts. |
| POST | `/api/whiteboard/<session_id>/finish` | `whiteboard.finish_session` | {scene, image}: ends the round and writes the report. |

## Backend

### Start-up

**`app.py`**

The starting point of the backend. Run it with `python app.py` (it listens on port 5001).

- `create_app()`: Builds the Flask app: its settings, the MongoDB connection, and every group of routes under /api.

**`db.py`**

The connection to MongoDB. The address and database name come from the environment (.env).

- `init_db()`: Connects once, when the app starts. Every model in models/ then uses this connection.
- `is_up()`: True if MongoDB answers a quick "ping" right now (the sidebar shows this).

### Models (MongoEngine documents: one per MongoDB collection)

**`models/chat.py`**

- `utc_now()`: The time now, in UTC: one clock for everything we save. The browser shows it in your own time zone.
- class `Message`: One message inside a chat. "Embedded" means it is saved inside its ChatSession, not on its own.
- class `ChatSession`: One chat. Its messages are stored inside it.
- `find_chat(chat_id)`: Return the chat with this id, or None if there isn't one.

**`models/coding.py`**

- class `CodingSession`: One coding round: the problem, your code, what Bella said, and the report.
- `find_coding(session_id)`: Return the session with this id, or None if there isn't one.

**`models/document.py`**

- class `UploadedDocument`: One uploaded PDF. Its text chunks and their vectors live in Chroma, tagged with this id.
- `find_document(document_id)`: Return the document with this id, or None if there isn't one.

**`models/eval_run.py`**

- class `EvalRun`: One run of an eval suite: its scores, and the result for every case.
- `find_eval_run(run_id)`: Return the run with this id, or None if there isn't one.

**`models/interview.py`**

- class `Interview`: One mock interview: its settings and final score.
- `find_interview(interview_id)`: Return the interview with this id, or None if there isn't one.

**`models/panel.py`**

- class `PanelInterview`: One panel interview: who sat on the panel, its settings and the result.
- `find_panel(panel_id)`: Return the panel interview with this id, or None if there isn't one.

**`models/question_bank.py`**

- class `QuestionBank`: Questions an agent panel wrote for one candidate, and how the panel got there.
- `find_bank(bank_id)`: Return the bank with this id, or None if there isn't one.

**`models/resume.py`**

- class `Resume`: Your resume for the Resume grind: its text, every claim in it, and how well you defend each one.
- `current_resume()`: The resume, or None if none was uploaded yet.

**`models/trace.py`**

- class `LLMTrace`: One call to the LLM: what it was asked, what it answered, and how long it took.
- `find_trace(trace_id)`: Return the trace with this id, or None if there isn't one.

**`models/whiteboard.py`**

- class `WhiteboardSession`: One system design round: the question, your drawing, what the interviewer said, and the report.
- `find_whiteboard(session_id)`: Return the session with this id, or None if there isn't one.

### Routes (HTTP only: check the request, call a service, return JSON)

**`routes/chat.py`**

- `chat()`: POST /api/chat {message, session_id}: sends a message (to a new chat when there is no session_id) and returns the AI's reply.
- `chat_history(session_id)`: GET /api/chat/<id>: every message of one chat, to show it again after a reload.

**`routes/coding.py`**

- class `BadRequest`: Something wrong in the request body. The route turns it into a 400 error with this message.
- `_read_code(data)`: The code from the request body, checked: it must be text, and not too long.
- `_read_results(data)`: The test results from the browser, keeping only the fields we use.
- `_open_session(session_id)`: Returns (session, None) when the round can go on, or (None, error response) when it doesn't exist or is already finished. The route returns that error response as it is.
- `list_problems()`: GET /api/coding/problems: the problems for the setup screen (without their tests).
- `list_sessions()`: GET /api/coding: your recent coding rounds, newest first.
- `start_session()`: POST /api/coding {problem_id or "surprise", difficulty, mode}: starts a round, and Bella greets you.
- `get_session(session_id)`: GET /api/coding/<id>: one round: the problem, your code, the conversation, and the report once it is finished.
- `save_code(session_id)`: PUT /api/coding/<id>/code {code}: saves your code without asking Bella, so a reload never loses it.
- `review_code(session_id)`: POST /api/coding/<id>/review {code, results, reply, hint}: Bella reads your code and test results, and reacts.
- `finish_session(session_id)`: POST /api/coding/<id>/finish {code, results}: ends the round and writes the report.

**`routes/documents.py`**

- `upload_document()`: POST /api/documents (a form with a PDF in "file"): reads, splits and indexes the PDF so you can ask about it.
- `list_documents()`: GET /api/documents: every uploaded document, newest first.
- `get_document(document_id)`: GET /api/documents/<id>: one document's name, page count and chunk count.
- `document_map(document_id)`: GET /api/documents/<id>/map: every chunk as a point in 3D, for the Under the hood panel.
- `_read_question(document_id)`: Returns (document, question, None) when the question can be answered, or (None, None, error response).
- `ask_document(document_id)`: POST /api/documents/<id>/ask {question}: an answer from this document only, with page numbers.
- `ask_document_live(document_id)`: POST /api/documents/<id>/ask/live {question}: the same answer, word by word (Server-Sent Events): "retrieved" when the search is done, "token" for every few words, then "done" with the sources.
- `delete_document(document_id)`: DELETE /api/documents/<id>: removes the document, its chunks and its file.
- `file_too_large(error)`: Flask sends a 413 error when an upload is bigger than MAX_CONTENT_LENGTH (app.py). This turns it into a message the page can show.

**`routes/evals.py`**

- `list_evals()`: GET /api/evals: what each suite tests, and the latest runs (without their cases).
- `run_eval()`: POST /api/evals {suite}: runs a suite in the background. It calls the real AI, so it costs a little (see ai_calls in GET /api/evals).
- `get_eval(run_id)`: GET /api/evals/<id>: one run with every case: what you expected, and what the AI did.

**`routes/health.py`**

- `health()`: Is the backend up, and can it reach MongoDB? The sidebar checks this every 15 seconds.

**`routes/interview.py`**

- `start_interview()`: POST /api/interviews {topic, num_questions, difficulty, follow_ups, mode}: plans the questions and returns the first one.
- `list_interviews()`: GET /api/interviews: your recent interviews, newest first.
- `get_interview(interview_id)`: GET /api/interviews/<id>: the current question while it runs, or the report once it is finished.
- `_read_answer(interview_id)`: Returns (interview, answer text, None) when the answer can be graded, or (None, None, error response).
- `answer_question(interview_id)`: POST /api/interviews/<id>/answer {answer}: grades your answer, and returns the next question (or the report).
- `answer_question_live(interview_id)`: POST /api/interviews/<id>/answer/live {answer}: the same as /answer, but as a live stream (Server-Sent Events): "start" and "finish" for each step of the graph as it runs, then "done" with the next question (or the repo…
- `interview_xray(interview_id)`: GET /api/interviews/<id>/xray: every step the interview graph took, with what it decided and why.
- `end_interview(interview_id)`: POST /api/interviews/<id>/end: stops early and writes the report from what you answered so far.
- `retry_interview(interview_id)`: POST /api/interviews/<id>/retry: runs the last step again after it failed (for example, the AI was down).

**`routes/panel.py`**

- class `BadRequest`: Something wrong in the setup form. The route turns it into a 400 error with this message.
- `list_panelists()`: GET /api/panels/panelists: everyone who can sit on a panel.
- `list_panels()`: GET /api/panels: your recent panel interviews, newest first.
- `start_panel()`: POST /api/panels (a form, because the JD and resume can be PDFs): role, company, level, jd or jd_file, resume or resume_file, use_resume_grind ("yes" = use the Resume grind's resume and its weak lines), panelists (2 to…
- `get_panel(panel_id)`: GET /api/panels/<id>: the conversation and the current question, or the report once it's finished.
- `answer_live(panel_id)`: POST /api/panels/<id>/answer/live {answer}: grades your answer, lets every panelist write their note, and the moderator picks what comes next. Sent as a live stream (Server-Sent Events) step by step.
- `end_panel(panel_id)`: POST /api/panels/<id>/end: stops early; the panel decides on what you answered so far.
- `retry_panel(panel_id)`: POST /api/panels/<id>/retry: runs the last step again after it failed (for example, the AI was down).
- `_open_panel(panel_id)`: Returns (the panel, None) if it exists and isn't finished, or (None, an error response).
- `_read_inputs()`: The role, JD and resume from the form, checked. Contact details are taken out of the resume.
- `_read_panelists()`: The panelists picked on the form: 2 to 4 known ids, no repeats.
- `_field(name, limit)`: A short text field from the form, trimmed, and at most `limit` characters.
- `_text_or_pdf(name)`: A pasted text field, or the PDF uploaded instead of it (<name>_file).

**`routes/question_bank.py`**

- class `BadRequest`: Something wrong in the request. The route turns it into a 400 error with this message.
- `_field(name, limit)`: A short text field from the form, trimmed, and at most `limit` characters.
- `_text_or_pdf(name)`: A pasted text field, or the PDF uploaded instead of it (<name>_file).
- `_read_inputs()`: Everything the panel reads (the role, JD, resume, topics and documents), checked.
- `_read_documents()`: The uploaded documents the agents may search (from the Documents page).
- `_read_agents()`: The chosen agents, in the panel's order.
- `list_agents()`: GET /api/question-banks/agents: the agents you can put on the panel.
- `list_banks()`: GET /api/question-banks: your recent banks, newest first.
- `create_bank()`: POST /api/question-banks (a form, not JSON, because the JD and the resume can be PDF files): starts the panel in the background and returns the new bank at once.
- `get_bank(bank_id)`: GET /api/question-banks/<id>: the bank and its live pipeline. The page asks again every second while it runs.
- `retry_bank(bank_id)`: POST /api/question-banks/<id>/retry: runs the whole panel again, with the same inputs.
- `delete_bank(bank_id)`: DELETE /api/question-banks/<id>: deletes a bank (not while its panel is working).
- `practise(bank_id)`: POST /api/question-banks/<id>/practice {question_ids, voice, coding_mode}: starts a round from the picked questions.
- `review_bank(bank_id)`: Review mode: your decision where the panel paused (human in the loop).
- `_read_plan_decision(data, pending)`: {"agents": [the agents to keep], "briefs": {agent_id: brief}}. Only the panel's own agents count.
- `_read_verdict_decision(data, pending)`: {"allow_send_back": bool, "send_back_note": text, "restore": [dropped question ids to keep]}

**`routes/resume_grind.py`**

- `get_resume()`: GET /api/resume: your resume with every claim and its colour, or {"resume": null} before the first upload.
- `upload_resume()`: POST /api/resume (a form, because it can carry a PDF): file = the resume as a PDF, or text = pasted text. The first upload creates your resume; the next ones are new versions of it.
- `start_grind()`: POST /api/resume/grind {count, mode}: starts a mock interview about your weakest claims that are due. Returns the interview, so the page can open it.
- `delete_resume()`: DELETE /api/resume: removes your resume and its claims (the grind interviews stay).

**`routes/stats.py`**

- `get_stats()`: GET /api/stats?minutes_ahead=330: your streak, your spider's health, and the tasks on your web.

**`routes/traces.py`**

- `list_traces()`: GET /api/traces?page=2&per_page=20&label=coding_review (all optional): one page of AI calls, newest first.
- `get_trace(trace_id)`: GET /api/traces/<id>: one AI call in full: the exact prompt, the answer, the tokens and the time.

**`routes/voice.py`**

- `speak()`: POST /api/voice/speak {text, voice}: an interviewer saying `text`, as MP3 audio. voice is optional: a panelist's voice (one of voice.PANEL_VOICES); without it, Bella's voice.
- `transcribe()`: POST /api/voice/transcribe (a form with an "audio" file and a "hint"): the words in your recorded answer.

**`routes/whiteboard.py`**

- class `BadRequest`: Something wrong in the request body. The route turns it into a 400 error with this message.
- `_read_board(data)`: The drawing and its picture from the request body, checked.
- `_open_session(session_id)`: Returns (session, None) when the round can go on, or (None, error response) when it doesn't exist or is already finished. The route returns that error response as it is.
- `list_questions()`: GET /api/whiteboard/questions: the ready-made design questions.
- `list_sessions()`: GET /api/whiteboard: your recent whiteboard rounds, newest first.
- `start_session()`: POST /api/whiteboard {question_id} or {question, brief}: starts a round, and Bella greets you.
- `get_session(session_id)`: GET /api/whiteboard/<id>: one round: the question, your drawing, the conversation, and the report once it is finished.
- `save_scene(session_id)`: PUT /api/whiteboard/<id>/scene {scene}: saves your drawing without asking Bella, so a reload never loses it.
- `review_board(session_id)`: POST /api/whiteboard/<id>/review {scene, image, reply}: Bella looks at the board (and your reply), and reacts.
- `finish_session(session_id)`: POST /api/whiteboard/<id>/finish {scene, image}: ends the round and writes the report.

### Services (the app's logic)

**`services/chat_service.py`**

- `build_prompt(chat, user_message)`: The messages the model sees: the coach's instructions, the last HISTORY_LIMIT messages, then the new one.
- `reply(user_message, session_id)`: Sends your message to the AI, saves your message and its answer, and returns the answer.
- `get_history(session_id)`: Every message of one chat, or None if there is no such chat.

**`services/coding/problems.py`**

The coding problems. Add one here and it shows up on the setup screen.

- `find_problem(problem_id)`: The problem with this id, or None.

**`services/coding/prompts.py`**

What we tell the AI. The words here decide how Bella behaves, so they are kept in one place.

- `review_prompt(mode)`: Bella's instructions for reviewing code, with the rules of this mode (interview or practice).

**`services/coding/report.py`**

The final report of a coding round.

- `write_report(session, problem, code, results)`: The report: each area's level and points, the overall score, the hint cost, and the AI's summary.
- `_ask_for_grade(session, problem, code, results)`: The AI's judgement of every rubric area (level, quote, comment), plus a summary.
- `_correctness(passed, total)`: The Correctness area, scored from the test results (no AI).
- `_test_level(passed, total)`: The level for a share of passed tests: all = strong, 80%+ = good, 40%+ = basic.
- `_hint_cost(session)`: Points taken off for hints. Practice mode is free.
- `_count_passed(results)`: How many tests passed.

**`services/coding/review.py`**

Bella reads the code and reacts: what to say out loud, and up to 2 notes pinned to lines.

- `review_code(session, problem, code, results, reply, wants_hint)`: Returns {"say": "...", "notes": [{"line": 3, "text": "..."}]}.
- `numbered(code)`: The code with a line number in front of every line, so the AI can point at lines.
- `test_summary(results)`: e.g. '3 of 5 passed. Failed: "empty string": expected 0, got None'

**`services/coding/schemas.py`**

The shapes we ask the AI to answer in (structured output).

- class `LineNote`: A note Bella pins to one line of the code.
- class `CodeReview`: Bella's reaction while you code: what she says out loud, and up to 2 line notes.
- class `AreaCheck`: The AI's judgement of one rubric area: a level, a quote as evidence, and a comment.
- class `CodingGrade`: The final report: one check per area, a summary, strengths, and what to improve.

**`services/coding_service.py`**

What the coding routes call: start a round, save the code, review it, finish with a report.

- `list_problems()`: The problems for the setup screen. The tests stay out of it, so nobody can peek at the answers.
- `pick_problem(difficulty)`: 'Surprise me': a problem you have not finished yet, at this difficulty if one is given.
- `start_coding(problem, mode)`: Creates the round with the problem's starter code, and Bella's greeting.
- `save_code(session, code)`: Saves the code without a review, so a page reload never loses it.
- `review(session, code, results, reply, wants_hint)`: Bella reads the code (and your reply, or your hint request) and reacts.
- `finish(session, code, results)`: Saves the final code, writes the report, and closes the round.
- `build_response(session)`: The JSON the browser gets for a round. The best approach stays hidden until the report.
- `list_recent(limit)`: Your recent rounds, for the Past rounds list.
- `_greeting(problem, mode)`: How Bella opens the round, in each mode.
- `_message(role, text)`: One line of the conversation, with the time it was said.

**`services/document_service.py`**

What the document routes call: upload a PDF, list documents, delete one.

- class `DocumentError`: A problem with the uploaded file itself, shown to the user as it is.
- `upload_document(file)`: Saves the PDF, reads its pages, splits them into chunks and stores their vectors. If any step fails, nothing is kept.
- `_read(path)`: The pages of the PDF, or a DocumentError the user can understand.
- `list_documents()`: Every document, newest first.
- `get_document(document)`: One document's summary.
- `ask_document(document, question)`: An answer from this document only (see services/rag/answer.py).
- `ask_document_live(document, question)`: The same answer, word by word, as a stream of events (see services/rag/answer.py, answer_live).
- `get_document_map(document)`: Every chunk of the document as a point in 3D, for the "Under the hood" panel.
- `delete_document(document)`: Removes the document's chunks from Chroma, its PDF file, and its record.
- `_summary(document)`: What the browser gets for a document.

**`services/eval_service.py`**

What the evals route (and `python -m evals.run`) call: run a suite, save the result, list the runs.

- `list_suites()`: What each suite tests (see evals/suites.py).
- `start_run(suite_id)`: From the Evals page: saves a "running" run and does the work on its own thread (a second line of work inside the server), so the page gets an answer at once and checks back for the result.
- `run_now(suite_id)`: From the terminal: runs the suite and waits for the result.
- `_new_run(suite_id)`: Saves a new "running" run, with the model and the prompt version being tested.
- `_work(run)`: Runs the suite, then saves its scores and cases (or the error) and how long it took.
- `list_runs(limit)`: The latest runs, newest first, without their cases (they can be long).
- `summary(run)`: A run without its cases.
- `build_response(run)`: A run with every case.

**`services/interview/graph.py`**

Draws the interview: which steps (nodes) exist, and which step comes after which (edges).

- `build_interview_graph(checkpointer)`: Draws the interview graph (the picture above), and attaches the checkpointer that saves every step.

**`services/interview/nodes.py`**

The steps (nodes) of the interview.

- `plan_questions(state)`: Runs once, first (START -> plan_questions).
- `ask(state)`: Runs before EVERY answer: each main question and each follow-up.
- `after_ask(state)`: Not a node. graph.py calls it right after ask: an answer goes to grade, "end" goes to the report.
- `grade(state)`: Runs after every answer.
- `check_answer(question, points, answer)`: Grades one answer against its key points. The panel interview uses it too.
- `route(state)`: Not a node. graph.py calls it right after grade, to choose the next node.
- `decide_next(state)`: route()'s choice, and the reason in words: ("follow_up", "The score was 2/5..."). The Interview X-ray (xray.py) shows the reason next to each grade.
- `follow_up(state)`: Runs when route() says: the answer was weak and a follow-up is still allowed.
- `next_question(state)`: Runs when route() says: move on to the next planned question. No LLM call.
- `write_report(state)`: Runs once, last, when route() says there is nothing left to ask.
- `_intro_if_first(state)`: Bella's greeting, but only with the very first question ("" after that, and for older interviews).
- `_numbered(points)`: ["a", "b"] -> "1. a\n2. b\n"
- `_is_covered(check, answer)`: True only if the judge said 'covered' AND its quote really appears in the answer.
- `_average_main_score(results)`: Average score of the main questions. Follow-ups are not counted.
- `_results_as_text(results)`: Every graded answer as plain text, for the report writer.

**`services/interview/prompts.py`**

Every instruction we give the LLM in the interview. Change the interviewer's behaviour here.


**`services/interview/schemas.py`**

The shapes we ask the LLM to answer in (structured output).

- class `PlannedQuestion`: One planned question, with the key points a strong answer must mention.
- class `InterviewPlan`: The planner's answer: the list of questions.
- class `PointCheck`: The grader's call on one key point: covered or not, with a quote from the answer.
- class `Grade`: The grader's answer: one check per key point, and feedback for the candidate.
- class `FollowUp`: The follow-up writer's answer: one short question.
- class `ReportSummary`: The report writer's answer: a summary, strengths, and what to study next.

**`services/interview/state.py`**

- class `InterviewState`: Everything the interview remembers between steps. (TypedDict only lists the keys: it is a normal dict.)

**`services/interview/xray.py`**

The Interview X-ray: every step the interview graph took, in order, with what it decided and why.

- `timeline(graph, config, reveal)`: {"steps": [...], "now": {...}, "taken": {"grade->follow_up": 2, ...}}
- `_describe(node, before, after, reveal)`: One step in plain words: a title, details, and (after a grade) where it went next and why.
- `_describe_plan(step, values, reveal)`: plan_questions: how many questions, and (once finished) which.
- `_describe_ask(step, values, reveal)`: ask: the question and your answer, or that you pressed End.
- `_describe_grade(step, values, reveal)`: grade: the score, the feedback, and where the graph went next and why (the same decide_next() as route()).
- `_now(history)`: Where the interview is right now: waiting for your answer, finished, or between two steps.
- `_paths_taken(steps, now)`: How many times the graph went from one node to the next, e.g. {"grade->follow_up": 2}. The last path leads to where it is now (waiting at ask, or END), which has no step of its own yet.
- `_ms_between(start, end)`: Milliseconds between two checkpoint times (they are saved as text like "2026-11-21T10:00:00+00:00").

**`services/interview_service.py`**

What the interview routes call.

- `get_interview_graph()`: Built once for the whole app. It saves its checkpoints in our MongoDB database.
- `_thread_config(interview)`: Tells LangGraph which interview's checkpoints to load and save.
- `start_interview(topic, num_questions, difficulty, max_follow_ups, mode, questions, source)`: questions: a ready plan ([{"question", "key_points"}], e.g. from a question bank), or None to let the AI plan. source: "resume" for a Resume grind, so its report can link back to your resume.
- `_greeting(topic, num_questions, max_follow_ups, source)`: How Bella opens the interview, before the first question. Fixed words (no AI), so it's instant, like the whiteboard and coding rounds' greetings. A Resume grind gets its own.
- `_count(number, word)`: 1 question, 5 questions.
- `submit_answer(interview, text)`: Resumes the paused interview with your answer.
- `end_interview(interview)`: Resumes the paused interview with "end", so it goes straight to the report.
- `retry_last_step(interview)`: Continue after a step failed (for example, the AI was down). The saved answer is not lost.
- `answer_live(interview, text)`: The same as submit_answer, but step by step (sent to the page as Server-Sent Events, see services/sse.py).
- `xray(interview)`: Every step the graph took so far, with what each one decided and why (services/interview/xray.py). Questions' key points stay hidden until the interview is finished, so the X-ray can't be used to peek.
- `_continue_interview(interview, graph_input)`: Run the graph from where this interview stopped, until it asks the next question or finishes.
- `_after_run(interview)`: After the graph stops: if it is not waiting for an answer, it ran all the way to END, so the interview is finished.
- `build_response(interview)`: The JSON the browser gets for this interview. Never the plan, or key points of questions not answered yet.
- `list_recent_interviews(limit)`: Your recent interviews, for the Past interviews tab.

**`services/llm.py`**

The AI models the app uses: one chat model and one embedding model.

- `get_model()`: The chat model (MODEL in .env). TraceLogger saves every call it makes (see services/tracing.py).
- `get_embeddings()`: The model that turns text into vectors (lists of numbers) for semantic search.

**`services/panel/graph.py`**

Draws the panel interview: which steps exist, and which step comes after which.

- `build_panel_graph(checkpointer)`: Draws the panel graph (the picture above) and attaches the checkpointer that saves every step.

**`services/panel/nodes.py`**

The steps (nodes) of the panel interview, in the order they run. graph.py draws how they connect.

- `brief(state)`: Runs once, first. The panel reads the role, JD and resume and splits the interview: every panelist gets their own questions, on their own focus (one spare each, so the moderator has a choice).
- `ask(state)`: Shows the current question and pauses the whole graph until you answer.
- `after_ask(state)`: Not a node: chooses what runs after ask. Grade your answer, or, if you pressed End, go to the verdicts (or straight to the report when nothing was answered).
- `grade(state)`: The panelist who asked grades your answer against their key points, with the mock interview's judge (the AI quotes your answer, code checks the quotes and sets the score).
- `send_to_listeners(state)`: Not a node: grade -> listen, once per panelist. LangGraph runs them all at the same time, and the moderator starts only when every panelist has written their note.
- `listen(task)`: One panelist reads the latest answer and writes a private note for the others: what they noticed, and a follow-up question if they want to ask one. These notes are how the panelists talk to each other. If one panelist's…
- `moderator(state)`: Decides what happens after every answer. Plain code first works out what is allowed: - a follow-up, if a panelist asked for one and this main question has follow-ups left - a new main question, if the panel has question…
- `after_moderator(state)`: Not a node: the next question, or the verdicts once the moderator wrapped up.
- `_ask_moderator(state, last, wishes, next_speaker)`: The AI moderator's pick between the follow-ups the panelists want and (if any are left) a new main question. If it picks something that isn't allowed, code falls back to the first follow-up.
- `send_to_verdicts(state)`: Not a node: -> verdict, once per panelist, all at the same time. The debrief waits for all of them.
- `verdict(task)`: One panelist's own decision on you, judged on their focus, with reasons.
- `debrief(state)`: Runs once, last. The panel agrees on one decision: code counts the votes ("hire" needs at least half the panel), and the AI writes the summary. The overall score is the average of the main questions, as in the mock inte…
- `_main_question(speaker, plan, asked, reason)`: The turn for this panelist's next planned main question.
- `_next_main_speaker(panel, plan, asked, num_questions)`: Who asks the next main question: the panelist who has asked the fewest so far and still has questions, in panel order. None when the panel has asked all its main questions.
- `_main_asked(asked)`: How many main questions the panel has asked so far.
- `_follow_up_wishes(notes, turn)`: The notes about this answer that ask for a follow-up.
- `_wish_of(wishes, speaker)`: This panelist's follow-up wish, or None.
- `_move_on_reason(wishes)`: Why the panel moves on without asking the AI moderator.
- `_name(state, panelist_id)`: "Priya (Tech Lead)" for a panelist id.
- `_persona(prompt, panelist)`: A prompt with the panelist's name, title and focus filled in.
- `_inputs_text(inputs)`: The role, JD and resume as one block of text for the prompts.
- `_brief_text(state, per_panelist)`: What the brief is given: the panelists, how many questions each, and the inputs.
- `_transcript_text(transcript)`: The conversation so far as plain lines ("Priya: ...", "Candidate: ...").
- `_listen_text(task)`: What a panelist reads before writing their note.
- `_verdict_text(task)`: What a panelist reads before their verdict: every question, answer and score, and their own notes.
- `_debrief_text(state, decision)`: What the debrief writer reads: the decision, every vote with its reasons, and the scores.
- `_average_main_score(results)`: Average score of the main questions. Follow-ups are not counted.

**`services/panel/panelists.py`**

Everyone who can sit on an interview panel. Add one here and it shows up on the setup screen.

- `find_panelist(panelist_id)`: The panelist with this id, or None.

**`services/panel/prompts.py`**

What we tell the AI in the panel interview. Change the panel's behaviour here. {name}, {title} and {focus} are filled in with the panelist's own details (see panelists.py).


**`services/panel/schemas.py`**

The shapes we ask the AI to answer in (structured output).

- class `PanelistQuestions`: One panelist's questions, written in the brief.
- class `PanelBrief`: The brief: every panelist's questions.
- class `PanelNote`: One panelist's private note after an answer (the other panelists read it; the candidate doesn't, live).
- class `ModeratorChoice`: The moderator's pick, when there is a real choice.
- class `PanelVerdict`: One panelist's decision at the end.
- class `PanelDebrief`: The hiring committee's summary (the decision itself is counted by code).

**`services/panel/state.py`**

- class `PanelState`: Everything the panel interview remembers. The comment above each group says which step sets it.
- class `ListenTask`: What each panelist's listen step gets (sent by send_to_listeners).
- class `VerdictTask`: What each panelist's verdict step gets (sent by send_to_verdicts).

**`services/panel_service.py`**

What the panel interview routes call. Like the mock interview, each request only says "carry on panel X": LangGraph loads X's latest checkpoint from MongoDB, runs until the next question (or the end), and saves.

- `get_panel_graph()`: Built once for the whole app. It saves its checkpoints in our MongoDB database.
- `_thread_config(panel)`: Tells LangGraph which panel's checkpoints to load and save.
- `list_panelists()`: Everyone who can sit on a panel: id, name, title, focus.
- `start_panel(inputs, panelist_ids, num_questions, max_follow_ups, mode)`: Saves a new panel interview, runs the brief, and stops at the first question. In a video call (voice), each panelist's planned questions are turned into their voice in the background, so they play at once.
- `_intros(panel, inputs)`: The round of introductions at the start: the first panelist welcomes you, then each one says who they are and what they'll ask about. Fixed words (no AI), so they're instant and their voices can be made early.
- `_prepare_voices(record)`: Makes the introductions and every panelist's planned questions in their own voice, in the background. (The browser asks for the first introduction itself, right away. Follow-ups can't be made early.)
- `answer_live(record, text)`: Your answer, then every step as it runs (sent to the page as Server-Sent Events, see services/sse.py): ("start", {"id", "node", "who"}) when a step begins and ("finish", {"id"}) when it ends. "who" is the panelist the s…
- `end_panel(record)`: Stops early: the panelists give their verdicts on what you answered so far.
- `retry_last_step(record)`: Carries on after a step failed (for example, the AI was down). Your saved answer is not lost.
- `_after_run(record)`: After the graph stops: if it isn't waiting for an answer, it ran to the end, so the panel is finished.
- `_who(task)`: The panelist a step is about: the one writing a note or a verdict, or the one grading. "" otherwise.
- `build_response(record)`: The JSON the page gets. While the panel runs: the conversation and the current question (scores and verdicts stay hidden until the end). The private notes are always sent: the page shows them only if you turn on "Show t…
- `list_recent_panels(limit)`: Your recent panel interviews, for the Past panels tab.
- `_title(inputs)`: "Backend Engineer at Damco", or as much of it as was given.

**`services/question_bank/agents.py`**

The panel: every agent that can write questions. Add one here and it shows up on the setup screen.

- `find_agent(agent_id)`: The agent with this id, or None.

**`services/question_bank/graph.py`**

The panel as a LangGraph graph: a pipeline with a parallel step in the middle.

- `get_bank_graph()`: Draws the panel graph (the picture above), and attaches the checkpointer. Built once.

**`services/question_bank/inputs.py`**

What the candidate gave us: reading their PDFs, writing it all out for the prompts, and checking the agents' "based on" quotes against it.

- class `InputError`: A problem with what the candidate uploaded, shown to them as it is.
- `pdf_text(file)`: The text of an uploaded PDF (a Flask file).
- `describe(inputs)`: Everything the candidate gave us, as one block of text for the prompts.
- `_document_names(inputs)`: The names of the documents the agents may search, for the prompt.
- `source_of(quote, inputs, passages)`: Where an agent's quote really comes from, as (source, detail): ("jd" | "resume" | "topics", ""), or ("docs", "notes.pdf, page 4") for a passage it found. ("", "") if the words are in none of them, so a question is only…

**`services/question_bank/nodes.py`**

The steps of the panel graph (see graph.py). Each step reads the state and returns what it changes. The AI writes and judges the questions; the code checks what it says (ids, quotes, scores, problem ids). In review mode…

- `coordinator(state)`: START -> coordinator. Reads everything and writes each agent a brief, so they split the work.
- `review_plan(state)`: coordinator -> review_plan -> agents. In review mode the graph stops here (interrupt) until you approve the plan: you can edit any brief, or take an agent off the panel. Otherwise it just passes. Your decision (checked…
- `send_to_agents(state)`: review_plan -> agent, once per agent on the panel. LangGraph runs them all at the same time.
- `agent(task)`: One agent searches your documents (if you chose any), then writes its questions. If it fails, only it fails: the others carry on, and the judge works with what it gets.
- `judge(state)`: agent (all of them) -> judge. An LLM judge scores every question on the rubric; the code drops the ones scoring DROP_AT or lower, or repeating an earlier one. It may also send one agent back, once.
- `_read_scores(verdict, drafts)`: The judge's score card for each real question (unknown ids are ignored), every score kept between 1 and 5. Returns (cards, scores), both by question id.
- `_decide_drops(drafts, cards, scores, restored)`: The code, not the AI, decides what to drop: a repeat of an earlier question, or any score of DROP_AT or lower. Questions you chose to keep (restored) are never dropped.
- `review_verdict(state)`: judge -> review_verdict. In review mode the graph stops here until you decide: allow or block the judge's send-back (and edit its note), and keep any question it dropped. Otherwise it just passes. Your decision (checked…
- `after_review(state)`: review_verdict -> revise (if an agent was sent back, only the first time) or -> assemble.
- `revise(state)`: revise -> judge. The agent sent back writes its set again, with the judge's note.
- `assemble(state)`: review_verdict -> assemble -> END. The final bank: every question kept, checked by code.
- `write_set(agent_info, brief, inputs, bank_id, passages, note, previous)`: Asks one agent for its questions: the first time, or again with the judge's note.
- `_finish(draft, agent_info, qid, inputs, passages)`: One draft as a bank question. None for a coding pick that isn't one of our tested problems.
- `_drop_reason(card, score, earlier_ids)`: Why the code drops a question, or "" to keep it.
- `_drop_order(drop)`: Which drops count first when there are too many: repeats, then the lowest total score.
- `_one_to_five(number)`: The score kept between 1 and 5, whatever number the AI sent.
- `_ask(schema, system, text, step, bank_id)`: One AI call whose answer comes back in the shape of `schema`, logged in AI traces under `step`.
- `_with_ids(agent_id, drafts)`: An agent's questions with their ids: [("technical-1", question), ("technical-2", question), ...]
- `_all_drafts(state)`: Every draft on the panel: {question id: (agent id, draft)}, in panel order.
- `_bank_text(state)`: Every draft question, by id, for the judge.
- `_problem_list()`: The tested coding problems, one per line, for the Coding agent's prompt.
- `_list(drafts)`: An agent's first set of questions as lines, for its rewrite prompt.

**`services/question_bank/prompts.py`**

The prompts for the panel lead, the agents and the judge.


**`services/question_bank/research.py`**

The agents' tool: searching the candidate's uploaded documents (the same Chroma store as the Documents page).

- `research(agent, brief, inputs, bank_id)`: Lets one agent search the chosen documents before it writes. Returns the passages it found. Coding agents don't search: they pick from the tested problems.
- `search(documents, query)`: The best passages for the query, across the chosen documents.
- `_score(hit)`: Sort key: a passage's relevance score.
- `as_text(passages)`: The passages for a prompt, each with where it came from: "[notes.pdf p.4] ..."
- `_where(passage)`: Where a passage comes from, like notes.pdf p.4.
- `_unique(passages)`: The passages without repeats (two searches can find the same page).

**`services/question_bank/runner.py`**

Runs a panel in the background, and writes its progress into the bank as it happens. The browser polls GET /question-banks/<id> and draws bank.steps as the pipeline.

- `start_run(bank)`: Saves a fresh pipeline and starts the panel on its own thread, so the request returns at once.
- `resume_run(bank, decision)`: You answered the panel's question: note it on the pipeline, and let the graph carry on.
- `run_panel(bank_id, command)`: Runs the graph (from the start, or on from a pause) and records every step on the pipeline.
- `_record(bank, steps, node, output)`: One finished graph step -> what changes on the pipeline the browser draws.
- `_paused(bank, steps, question)`: The graph stopped at interrupt(): it is your turn.
- `_after_coordinator(bank, steps, output)`: The lead is done: save its plan and keep each agent's brief. (The agents start in _after_review_plan.) The lead is done: save its plan and keep each agent's brief. (The agents start in _after_review_plan.)
- `_after_review_plan(bank, steps, output)`: The plan is approved (by you, or at once): the agents start. Agents you took off are skipped.
- `_after_agent(steps, output)`: An agent is done (or failed). When the last one finishes, the judge starts.
- `_after_judge(bank, steps, output)`: The judge finished a check. If it sends an agent back, that agent starts rewriting (in review mode, only once you allow it).
- `_after_review_verdict(steps, output)`: You allowed or blocked the judge's send-back (nothing to do if there was none).
- `_after_revise(steps, output)`: The agent that was sent back has rewritten its set, and the judge checks again.
- `_record_search(steps, event)`: An agent searched your documents (a "custom" event from research.py).
- `_send_back(steps, send_back)`: The judge's message reaches the agent: it starts rewriting, and the judge waits for it.
- `_decision_note(pending, decision, steps)`: One line on what you decided, for the "You" card.
- `_first_steps(bank)`: The cards of a fresh pipeline: the lead (thinking), the agents and the judge (waiting), and the You cards in review mode.
- `_step(step_id, kind, name, agent)`: One card on the pipeline. status: waiting | thinking | revising | needs_you | done | failed | skipped message: what it was told. note: what it did. runs: each time it worked, for the timeline. searches: the documents it…
- `_start(step, message, status)`: A card starts working: its status, its message, and the time it started.
- `_finish(step, note, message, label)`: A card is done: its note, how long it took, and one more bar on the timeline.
- `_fail(step, error)`: A card failed: the error, and a "failed" bar on the timeline.
- `_ms_since(started_at)`: Milliseconds since a saved start time.
- `_load_steps(bank)`: The bank's steps as plain dicts, by id (in pipeline order).
- `_save(bank, steps)`: Saves the pipeline (every card) into the bank.
- `_agent_steps(steps)`: Just the agents' cards.
- `_run_in_background(bank, command)`: A thread is a second line of work inside the server: the request answers at once, and the panel goes on working. daemon=True means this thread never stops the server from shutting down.
- `_you_step_id(kind)`: The id of the You card for this kind of question.
- `_count(questions)`: For example: 4 questions.
- `_plural(count, word)`: For example: 1 brief, 2 briefs.
- `_name(agent_id)`: An agent's display name.

**`services/question_bank/schemas.py`**

What the panel lead, the agents and the judge must answer with (structured output).

- class `Brief`: The lead's brief for one agent.
- class `PanelPlan`: The lead's answer: the plan, and one brief per agent.
- class `SearchDocuments`: Search the candidate's uploaded documents (study notes, books) for passages about a topic.
- class `DraftQuestion`: One question an agent writes.
- class `QuestionSet`: An agent's answer: its questions.
- class `QuestionScore`: The judge's score card for one question.
- class `Verdict`: The judge's answer: a summary, a score card per question, and an optional send-back.

**`services/question_bank/state.py`**

- `merge(old, new)`: For values that several agents write at the same time: keep everyone's, by agent id.
- class `BankState`: Everything the panel graph remembers. The comment above each group says which step sets it.
- class `AgentTask`: What each parallel agent step gets (sent by send_to_agents).

**`services/question_bank_service.py`**

What the question bank routes call: start a panel, read a bank, and practise from it.

- class `PracticeError`: The picked questions can't make one round. Shown to the user as it is.
- `list_agents()`: Every agent: id, name, what it makes, how many questions, and its focus.
- `create_bank(inputs, agent_ids, review)`: Saves a new bank and starts its panel in the background.
- `resume(bank, decision)`: Review mode: your answer to what the panel asked (bank.pending). The panel carries on from there.
- `run_again(bank)`: Runs the panel again on the same bank, with a fresh pipeline.
- `practise(bank, question_ids, voice, coding_mode)`: Starts a round from the picked questions: Q&A questions -> one mock interview with exactly those questions, one whiteboard question -> a whiteboard round, one coding problem -> a coding round.
- `build_response(bank)`: The JSON the browser gets for a bank. The JD and resume texts stay on the server; it only says whether they were given.
- `list_recent(limit)`: Your recent banks for the Past banks tab, with how many questions of each type.
- `_title(inputs)`: For example: Backend Engineer at Damco.
- `_mark_if_cut_off(bank)`: A bank still "running" with no news for a long time was cut off, e.g. by a server restart. (A bank waiting for you, "needs_you", can wait as long as you like.)

**`services/rag/answer.py`**

Step 5 of RAG: answer a question using ONLY the chunks found in the document.

- class `DocumentAnswer`: The answer writer's answer: the text, whether it was found, and the pages it used.
- `_ms_since(start)`: Milliseconds since `start` (a time.perf_counter() value).
- `answer_question(document_id, question)`: The answer to a question from this document only, with the pages it used and a trace of every step.
- `answer_live(document_id, question)`: The same answer, written word by word (sent as Server-Sent Events, see services/sse.py).
- `_retrieve(document_id, question)`: Embed the question, find the closest chunks, keep the relevant ones. Returns (relevant, trace).
- `_sources_text(relevant)`: The chunks for the prompt, each labelled with its page: "[S1] (page 3) ..."
- `_cited_sources(relevant, pages)`: The chunks the answer really used: only pages we gave the model AND that it cited.
- `_pages_cited(text)`: The page numbers in citations like [p. 3] or [pp. 3, 5].
- `_rounded(vector)`: The question's vector, each number rounded, to keep the trace small.
- `_hits_for_trace(hits)`: Every chunk the search found, with its page and score (for the "Under the hood" panel).

**`services/rag/chunks.py`**

- `split_pages(pages, document_id)`: Cut each page into chunks. Every chunk remembers its document and page, for citations later.

**`services/rag/pdf.py`**

- `read_pdf(path)`: Return (pages, page_count). pages is [(page_number, text), ...] for every page that has text.

**`services/rag/vector_map.py`**

The 3D map of a document's chunks, for the "Under the hood" panel.

- `document_map(document_id)`: Everything the 3D map needs: each chunk's position and group, each group's name, and the recipe to place a question.
- `_positions_3d(vectors)`: PCA: squeeze each vector to 3 numbers. Returns (xyz, mean, axes, scale).
- `_describe_groups(texts, group_of, centres, xyz)`: For each group: its name (most typical words), size, centre on the map, and centre vector.
- `_group_count(chunk_count)`: One group for a tiny document; 2 or 3 for a normal one.
- `_group(unit, k)`: k-means: puts the chunks in k groups of similar meaning. Returns (each chunk's group, each group's centre).
- `_biggest_first(group_of, centres, k)`: Renumbers the groups by size: the biggest becomes group 0 (equal sizes keep their order).
- `_words(text)`: The meaningful words of a text: lower case, 3+ letters, common words like "the" left out.
- `_count_words(texts)`: How often each meaningful word appears in these texts.
- `_label(texts, all_words)`: A group's name: the 3 words most typical of its chunks, compared with the whole document.
- `_rounded(values, digits)`: A list of numbers, rounded (numpy numbers turned into plain ones, so they can be sent as JSON).

**`services/rag/vector_store.py`**

- `get_vector_store()`: One Chroma collection holds the chunks of every document. Each chunk is tagged with its document_id.
- `add_chunks(chunks)`: Embeds every chunk (turns its text into a vector) and stores it in Chroma.
- `delete_chunks(document_id)`: Removes every chunk of one document from Chroma.
- `search(document_id, query, k)`: The k chunks of one document closest in meaning to the query, each with a relevance score from 0 to 1.
- `embed_question(question)`: The question as a vector, made by the same embedding model that made the chunk vectors.
- `search_by_vector(document_id, query_vector, k)`: Like search(), for a question that is already a vector (so the app can also show that vector).
- `get_document_vectors(document_id)`: Every chunk of one document with its vector, page and text (for the 3D map).

**`services/resume_grind/claims.py`**

Finding the claims in a resume, and matching them with the version before.

- `find_claims(text, lines)`: Asks the AI for the claims in the resume. Keeps only those whose words really are in the resume (the AI must copy, not reword), and notes which lines each one is on.
- `find_lines(quote, lines)`: Where the quote is in the resume: (its first line, how many lines), or (None, 0) if not found. One line is tried first, then two lines together, then three.
- `match_with_before(old_claims, new_claims)`: Matches each claim of the new version with the old claim it came from, so your progress carries over: the same words -> "same": keeps its id, score, colour, next day and answers similar words -> "changed": keeps its id,…
- `_same_words(claim, old_claims)`: The old claim with exactly the same words (ignoring case and punctuation), or None.
- `_closest(claim, old_claims)`: The old claim worded most like this one, if it is alike enough (SAME_ENOUGH), or None.

**`services/resume_grind/privacy.py`**

Takes contact details out of a resume before it is saved or sent to the AI.

- `remove_contact_details(text)`: Returns (the text without emails, links and phone numbers, how many were taken out). The name stays: it can't be told apart from other words reliably.
- `_remove_phones(text)`: Replaces every run of 10 or more digits (with spaces, dashes or brackets between them).
- `_count_digits(text)`: How many digits are in the text.

**`services/resume_grind/prompts.py`**

What we tell the AI in the Resume grind. Edit the wording here.


**`services/resume_grind/questions.py`**

Writes a grind's questions: one "prove it" question per claim, and what a convincing answer says.

- `write_questions(claims)`: The plan for a mock interview: [{"question", "key_points"}], one per claim, in the same order.
- `_claims_text(claims)`: The claims as numbered lines for the prompt, with what changed and what was asked last time.
- `_backup_question(claim)`: A question for a claim the AI skipped: the likely question found with the claim.

**`services/resume_grind/schedule.py`**

When each claim comes back, and its colour. Plain rules, no AI:

- `today()`: Today's date as text, like "2026-11-22" (UTC). Dates written this way sort like the days they are.
- `is_due(claim)`: True if the claim should be asked today (or was due earlier).
- `pick_for_grind(claims, count)`: The claims for the next grind: the ones due today first, weakest first. If fewer than `count` are due, the weakest of the others fill it up, so you can always practise.
- `_grind_order(claim)`: Sort key: claims that changed in the new version first, then red, untested, yellow, green, and the longest overdue first.
- `save_answer(claim, attempt)`: Adds one grind answer to its claim, then sets the claim's score, colour and next day.

**`services/resume_grind/schemas.py`**

The shapes we ask the AI to answer in (structured output).

- class `FoundClaim`: One claim the resume makes, copied word for word.
- class `FoundClaims`: The claim finder's answer.
- class `GrindQuestion`: One grind question, about one claim.
- class `GrindQuestions`: The question writer's answer: one question per claim, in the same order.

**`services/resume_grind_service.py`**

What the Resume grind routes call: upload a resume (or a new version), open it, start a grind, delete it.

- class `ResumeError`: A problem with the resume, shown to the user as it is.
- `upload(text, filename)`: A first resume, or a new version of the one you have. Contact details are taken out first, then the AI finds the claims. A new version keeps the progress of every claim that is still there.
- `open_resume(resume)`: The resume as the page shows it, with the scores of any grind that finished since the last look.
- `start_grind(resume, count, mode)`: Starts a mock interview about `count` claims (the weakest that are due). Returns the interview, so the page can open it.
- `delete_resume(resume)`: Deletes the resume and its claims. The grind interviews stay in Past interviews.
- `save_finished_grinds(resume)`: Puts the scores of every grind that finished since the last look onto its claims. It runs whenever the resume is opened, so it works however the grind ended: the last answer, the End button, or Try again.
- `_score_claims(resume, claim_ids, results)`: The grind asked about the claims in order: the first main question was about the first claim, and so on. Each main answer, with its follow-ups, goes to its claim. Claims not reached (you pressed End early) stay as they…
- `_attempts_by_question(results)`: The interview's graded answers, one attempt per main question, with its follow-ups inside it.
- `build_response(resume)`: The JSON the page gets: the resume's lines, every claim, the colour counts and what is due today.
- `_open_grind(resume)`: The id of a grind interview that is still going (to offer "Continue"), or None.
- `_find_claim(claims, claim_id)`: The claim with this id, or None.
- `_lines(text)`: The text's lines, trimmed, without the empty ones.
- `_count_status(claims, status)`: How many claims have this status.
- `_quotes(claims)`: Just the words of each claim.

**`services/rubric.py`**

Scoring a round against a rubric ("no proof, no points"). Used by the coding and whiteboard reports.

- `rubric_text(rubric)`: The rubric as lines for the prompt: "- Approach: explains a plan before coding"
- `candidate_words(messages)`: Everything the candidate said in the round, as one text. (Bella's own words never count as proof.)
- `score_areas(rubric, checks, code, words)`: One result per rubric area, in the rubric's order.
- `_score_area(area, looks_for, check, code, words)`: One area's result: the AI's level only if its quote is real; otherwise missing, with the quote shown as unproven.
- `is_proven(quote, code, words)`: True if the quote really appears in the code, or in the words.
- `_in_code(quote, code)`: Exact match; only spaces and line breaks may differ.
- `_in_words(quote, words)`: Loose match: punctuation and capitals don't matter.
- `average_points(areas)`: The average points over all the areas.

**`services/sse.py`**

Server-Sent Events (SSE): one HTTP response that stays open while the server sends small messages.

- `sse_response(events)`: A streaming HTTP response from a generator of (event name, data) pairs.
- `_stream(events)`: Turns each (name, data) into an SSE message, as the generator produces them.
- `_message(name, data)`: One SSE message: the event's name, its data as JSON, then an empty line.

**`services/stats/activity.py`**

What you did, day by day: finished rounds and quiz chats. It only reads what the other features saved.

- `local_day(moment, minutes_ahead)`: The calendar day of a saved time, in your time zone (minutes_ahead = how far ahead of UTC you are).
- `local_today(minutes_ahead)`: Today's date in your time zone.
- `quiz_days(minutes_ahead)`: The days on which you sent at least QUIZ_MESSAGES messages in the practice chat.
- `bank_days(minutes_ahead)`: The days on which you made a question bank.
- `activity_by_day(minutes_ahead, quizzes)`: {day: how many things you did that day}. Each finished round counts 1, and a quiz day counts 1.
- `round_totals()`: For each kind of round: how many you finished, and your average and best score out of 5.

**`services/stats/health.py`**

How your spider feels: health starts at 100, and every reason she loses points is listed.

- `health(streak, flies)`: Her health score (100 minus every reason), her mood, and the list of reasons.
- `_mood(score)`: The mood for a health score: happy, okay, itchy or angry.
- `_plural(count, word)`: For example: 1 day, 3 days.

**`services/stats/streak.py`**

Your streak (days in a row with practice) and the calendar of the last few weeks.

- `streak(days, today)`: days = {day: how many things you did}. Today isn't over yet, so if you haven't practised today, the streak still counts up to yesterday.
- `calendar(days, today)`: The last few weeks up to today, starting on a Monday: [{"day": "2026-11-21", "count": 2}, ...].
- `_longest_run(days)`: The most days in a row you ever practised.

**`services/stats/web.py`**

The flies on your web: what is waiting for you. Each one links to the page where you deal with it. All of it is worked out from what the rounds already saved; nothing new is stored, so a better next round clears a weak…

- `web_tasks(done_today, bank_done_today)`: The flies on the web, most important first: today, the next bank, unfinished rounds, then weak spots.
- `unfinished_rounds()`: Rounds you started in the last two weeks but never finished, newest first.
- `weak_spots(latest)`: Where your latest round of each kind was weak.
- `next_topic(latest)`: What your next question bank could be about: your weakest recent topic, or Python if there's nothing yet.
- `_today(done)`: The practise-today fly (ticked once you have practised today).
- `_bank(topic, done)`: The make-a-question-bank fly, on your weakest recent topic.
- `_fly(fly_id, kind, title, detail, link, done)`: kind: today | bank | unfinished | weak. link: the page to open, e.g. "coding/<id>".
- `_latest(model)`: Your most recently finished round of this kind, or None.
- `_weak_areas(report)`: The weakest rubric areas of a report (the ones rated missing or basic), at most WEAK_PER_ROUND.
- `_problem_title(problem_id)`: A coding problem's title (or its id, if the problem no longer exists).
- `_short(text, limit)`: The first line of a topic or question, cut to fit on the web.
- `_started_at(pair)`: Sort key: when the round started.
- `_points(area)`: Sort key: a rubric area's points.

**`services/stats_service.py`**

What the stats route calls: your streak, your spider's health and the tasks on your web. It only reads what the other features saved. It never changes anything.

- `get_stats(minutes_ahead)`: Everything the Stats page and the pet spider show, worked out from what the rounds saved.

**`services/text.py`**

Small text helpers used in several places.

- `simplify(text)`: Lower case, letters and digits only (everything else becomes a space), so punctuation and spacing don't matter when we look for a quote: "Hash-map, O(n)!" -> "hash map o n"
- `conversation_text(messages, last)`: The latest messages of a whiteboard or coding round as plain lines, for a prompt: "Interviewer: ..." and "Candidate: ..."

**`services/trace_service.py`**

What the trace routes call: the latest LLM calls, and one call in full.

- `list_traces(page, per_page, label)`: One page of AI calls, newest first, and how many there are in total.
- `_all_labels()`: Every kind of call there is, A to Z, for the filter on the page.
- `get_trace(trace)`: One AI call in full: the summary, plus the exact prompt, the answer and the tokens.
- `_summary(trace)`: What the traces table shows for one call.

**`services/tracing.py`**

Our own trace log: every LLM call is saved to MongoDB, so a bad answer can be explained later.

- class `TraceLogger`: LangChain calls on_chat_model_start when a model call begins, and on_llm_end or on_llm_error when it ends. Each call has its own run_id, so we can match the end to its start. (The method names and arguments are fixed by…
- `_label(metadata, kwargs)`: Which step made the call, for the AI traces page.
- `_model_name(params)`: Different providers put the model's name under different keys.
- `_text(content)`: Message content is usually a string, but can be a list of parts (text and pictures).
- `_output(message)`: Structured-output calls can answer through a tool call instead of plain text.

**`services/voice.py`**

Voice for the mock interview: the interviewer speaks (text to speech) and you answer out loud (speech to text).

- class `VoiceError`: OpenAI voice did not work. The browser then uses its own voice, or you type.
- `_client()`: The OpenAI client, made once. It reads OPENAI_API_KEY from the environment.
- `speak(text, voice_name)`: MP3 audio of the interviewer saying `text`. The same text is only paid for once: it is cached on disk. voice_name: a panelist's voice (one of PANEL_VOICES); empty means Bella's. If it fails, Bella's voice is used.
- `prepare(texts, voice_name)`: Makes the voice for these texts in the background and caches it, so later each one plays at once (speak() finds it in the cache). Used for planned questions: an interview's, or one panelist's.
- `_speak_all(texts, voice_name)`: speak() each text, one after another (this runs in the background thread from prepare()).
- `transcribe(audio, filename, mime_type, hint)`: The words in a recorded answer. `hint` (the question) helps with technical terms.
- `_log(label, model, sent, received, started, error)`: Save the call on the AI traces page. Never let logging break the voice.

**`services/whiteboard/ai.py`**

One way to ask the AI about the board: the text description plus a picture of the board.

- `ask_about_board(schema, system_prompt, text, image, step, session_id)`: Ask with the board's description and its picture, and get the answer in `schema`.

**`services/whiteboard/diagram.py`**

Turns an Excalidraw drawing into plain text the AI can read: the boxes, the arrows between them, and loose text.

- `describe(scene)`: Returns (text, names). names maps a short name like "b1" to the element's real Excalidraw id.
- `_your_elements(scene)`: Every shape that is still on the board and was drawn by you (not the AI's sticky notes).
- `_labels(elements)`: Text written inside a box or on an arrow points to it with containerId: element id -> that text.
- `_boxes_in_reading_order(elements)`: The boxes from top to bottom, and left to right within a row (at most MAX_BOXES).
- `_reading_position(box)`: Sort key: the row first (boxes with tops within ROW_HEIGHT share a row), then left to right.
- `_end_name(binding, short_name, label_of)`: One end of an arrow: the box it is attached to, like b2 "API", or (not attached).
- `_count_freehand(elements)`: How many freehand strokes there are (the AI must look at the picture for those).
- `_section(title, lines)`: "Boxes:\n- b1 ...\n- b2 ..." or "Boxes:\n- none"
- `_by_ai(element)`: True for the AI's own sticky notes (we tag them with customData: {"by": "ai"}).
- `_clean(text)`: One line, at most 200 characters.

**`services/whiteboard/prompts.py`**

What we tell the AI. The words here decide how the interviewer behaves, so they are kept in one place.


**`services/whiteboard/questions.py`**

The system design questions you can pick. Add one here and it shows up on the setup screen.

- `find_question(question_id)`: The ready-made question with this id, or None.

**`services/whiteboard/report.py`**

The final report of a whiteboard round: each rubric area judged by the AI, then checked and scored in code (services/rubric.py: "no proof, no points").

- `write_report(session, scene, image)`: The report: each area's level and points, the overall score, and the AI's summary.

**`services/whiteboard/review.py`**

The interviewer looks at the board and reacts: what to say out loud, and up to 2 sticky notes.

- `review_board(session, scene, image, reply)`: Returns {"say": "...", "notes": [{"target": <Excalidraw element id or "">, "text": "..."}]}.

**`services/whiteboard/schemas.py`**

The shapes we ask the AI to answer in (structured output).

- class `BoardNote`: A sticky note Bella pins on the board, next to a box (or loose).
- class `BoardReview`: Bella's reaction to the board: what she says out loud, and up to 2 sticky notes.
- class `AreaCheck`: The AI's judgement of one rubric area: a level, a quote as evidence, and a comment.
- class `WhiteboardGrade`: The final report: one check per area, a summary, strengths, and what to improve.

**`services/whiteboard_service.py`**

What the whiteboard routes call: start a round, save the drawing, review it, finish with a report.

- `list_questions()`: The ready-made design questions.
- `start_whiteboard(question, brief)`: Creates the round with Bella's greeting.
- `save_scene(session, scene)`: Saves the drawing without a review, so a page reload never loses it.
- `review(session, scene, image, reply)`: The interviewer looks at the board (and your reply, if you said something) and reacts.
- `finish(session, scene, image)`: Saves the final board and its picture, writes the report, and closes the round.
- `build_response(session)`: The JSON the browser gets for a round.
- `list_recent(limit)`: Your recent rounds, for the Past rounds list.
- `_greeting(question, brief)`: How Bella opens the round: who she is, the question, and how to start. Like a real interviewer.
- `_message(role, text)`: One line of the conversation, with the time it was said.

### Evals (measure the AI judges against labelled cases)

**`evals/grader_eval.py`**

Eval 1: the interview grader. Does it agree with you about which key points an answer covers?

- `load_cases()`: The answer key: every case in cases/grader_cases.json.
- `run()`: Grades every case. Returns {"metrics": {...}, "cases": [one result per case]}.
- `grade_case(case)`: One answer through the real grader, side by side with your labels.

**`evals/judge_eval.py`**

Eval 2: the question bank judge. Does it drop the bad questions, and keep the good ones?

- `load_cases()`: The answer key: the role, the briefs and the 16 questions in cases/judge_cases.json.
- `run()`: One judge call on the whole set. Returns {"metrics": {...}, "cases": [one result per question]}.
- `_judge_state(data)`: The state the panel graph would give the judge, built from the case file.

**`evals/metrics.py`**

The maths of an eval: how often the AI agrees with the answer key. Plain counting, no libraries.

- `ratio(part, whole)`: part / whole, rounded (None when there is nothing to divide by).
- `key_point_metrics(cases)`: For the interview grader. Each case has "expected" (your labels) and "got" (the grader's), one True/False per key point: was this point covered by the answer?
- `score_metrics(cases)`: For the interview grader: its 0-5 score next to the score your labels give.
- `drop_metrics(cases)`: For the question bank judge. Each case has "expected_drop" (planted bad question?) and "got_drop".
- `score_from_points(covered)`: The same rule the grader uses (services/interview/nodes.py): 5 x the share of points covered.

**`evals/run.py`**

Run the evals from the terminal (inside backend/, with the virtual environment on):

- `main()`: Runs the suites named on the command line (all of them if none), and prints every case and the scores.
- `print_case(suite, case)`: One line per case: PASS or FAIL, then what you expected next to what the AI did.
- `print_scores(run)`: The run's scores, as percentages (the score gap in points).
- `_marks(points)`: [True, False, True] -> "Y-Y" (Y = covered).

**`evals/suites.py`**

The eval suites: what each one tests, the prompt it tests, and the function that runs it. Add a suite here and it shows up on the Evals page and in `python -m evals.run`.

- `describe()`: The suites for the Evals page: name, what they test, how many cases and AI calls.
- `prompt_version(suite_id)`: A short fingerprint of the prompt under test. It changes whenever the prompt text changes, so the run history shows which prompt version got which score.
- `model_name()`: The AI model being tested (MODEL in .env).

### Scripts (developer tools)

**`scripts/interview_cli.py`**

Run a mock interview in the terminal. From backend/: python -m scripts.interview_cli


**`scripts/project_map.py`**

Writes docs/PROJECT_MAP.md: every API route, every backend module and function, and every frontend file, each with one line on what it does. The lines come from the code's own docstrings and comments, so the map stays t…

- `main()`: Builds the whole map and writes it to docs/PROJECT_MAP.md.
- `_routes()`: Every route in routes/*.py: its method, path, handler and the first line of its docstring.
- `_route_of(decorator)`: ("POST", "/interviews") for @interview_bp.post("/interviews"), or (None, None) for any other decorator.
- `_route_summary(docstring, method, full_path)`: A route's docstring without the "POST /api/..." it starts with.
- `_python_files(folder)`: The .py files of one section, sorted. "" = the files directly in backend/ (app.py, db.py).
- `_module_lines(path)`: The lines for one module: its name and summary, then one line per top-level function or class.
- `_arguments(function)`: "interview, text" for def submit_answer(interview, text).
- `_comments_above(source)`: {line number: the comment on the line just above it}. Schema classes have a comment, not a docstring.
- `_frontend_files(folder)`: The .js, .jsx and .css files in one frontend folder, sorted.
- `_frontend_summary(path)`: The comment just above the file's main export, or else its first comment.
- `_comment_block_above(lines, index)`: The // comment lines right above line `index`, joined, or "" if there are none.
- `_first_paragraph(text)`: The text up to its first empty line, on one line.
- `_one_line(text)`: All the lines of `text` joined by single spaces.
- `_cut(text)`: At most MAX_LINE characters.

**`scripts/search_demo.py`**

See semantic search on an uploaded document. From backend/:


## Frontend

React + Vite in `frontend/src/`. Every backend call goes through `lib/api.js`.

### pages/

- `pages/ChatPage.jsx`: #/chat -> the chat you had open last (or a new one) #/chat/<id> -> that chat, e.g. picked from "Recent chats" in the sidebar #/chat?quiz=<topic> -> a new chat with a quiz request already typed in
- `pages/CodingPage.jsx`: #/coding -> pick a problem and a mode, see past rounds #/coding/<id> -> that round: problem, editor, tests and Bella, then its report
- `pages/DocumentsPage.jsx`: #/docs -> upload PDFs and manage your library #/docs/<id> -> ask questions about one document
- `pages/EvalsPage.jsx`: #/evals -> every suite: latest scores, history, and "Run now" #/evals/<id> -> one run, case by case
- `pages/InterviewPage.jsx`: #/interview -> tab 1: start a new interview #/interview/past -> tab 2: past interviews and your scores #/interview/<id> -> that interview: the questions while it runs, then its report
- `pages/PanelPage.jsx`: #/panel -> tab 1: the role, what the panel reads, and who sits on it #/panel/past -> tab 2: every panel interview so far #/panel/<id> -> that panel interview: the room while it runs, then the decision
- `pages/QuestionBankPage.jsx`: #/bank -> tab 1: the role, what the panel reads, and who is on the panel #/bank/past -> tab 2: every bank made so far #/bank/<id> -> that bank: the panel at work, then its questions
- `pages/ResumePage.jsx`: #/resume: the Resume grind. First visit: upload. Then your resume as a heatmap (each claim coloured by how well you defend it), the grind card, and the claim you clicked. A grind opens as a normal mock interview.
- `pages/StatsPage.jsx`: #/stats: your spider's health, your streak, and the web of tasks waiting for you. It only shows data; everything on it is worked out by GET /api/stats.
- `pages/TracesPage.jsx`: #/traces -> every AI call, a page at a time #/traces/<id> -> the same, with that call opened in a pop-up
- `pages/WhiteboardPage.jsx`: #/whiteboard -> pick a system design question, see past rounds #/whiteboard/<id> -> that round: the board and the interviewer, then its report

### components/

- `components/ChatMessage.jsx`: One message in the chat. The user's text is shown as typed; the coach's reply is rendered as Markdown, with its token count and a copy button underneath.
- `components/CommandPalette.jsx`: ⌘K (Ctrl+K on Windows), or the sidebar's search button: a box to jump anywhere.
- `components/Composer.jsx`: The message box. Enter sends, Shift + Enter adds a new line, and the box grows with the text up to a limit. initialText is already typed in (you still send it).
- `components/ConfirmDialog.jsx`: An "Are you sure?" box, used instead of the browser's confirm(). It is a <dialog>, so the browser keeps focus inside it and Esc closes it.
- `components/ExportReport.jsx`: Two buttons to share a report: a PNG image of it, or a PDF (through the browser's print window, where you pick "Save as PDF"). Anything marked className="no-export" (like these buttons) is left out. target a ref to the…
- `components/Icon.jsx`: One SVG icon set for the whole app. Add a new icon by adding one path here.
- `components/Modal.jsx`: A pop-up window over the page. It is a <dialog>, so the browser keeps focus inside it; Esc, the close button or a click on the dark backdrop closes it. open, onClose whether it shows, and what closing does title, subtit…
- `components/PetSpider.jsx`: Your spider, at the bottom of the sidebar. Her colour is her health (see the Stats page): green = happy, yellow = okay, orange = itchy, red = angry. When you finish something today she climbs her thread to cheer. If you…
- `components/Sidebar.jsx`: collapsed: only icons are shown (the names appear when you point at them). onToggle switches it.
- `components/SpiderLoader.jsx`: label what is loading, shown next to her (optional) size 'small' (beside a line of text) | 'medium' | 'large' (over a whole screen)
- `components/SplashScreen.jsx`: The spider, the name and the tagline, for a moment after each refresh. The app loads underneath at the same time, so the splash never makes anything slower.
- `components/SpokenCaption.jsx`: Bella's words appear as she says them, in step with her real voice: the same timing moves her lips (lib/captions.js). While her voice is still loading, it shows typing dots instead of running ahead. Give it key={text},…
- `components/bank/AgentAvatar.jsx`: A panel member's face: the SpAIder spider in the agent's colour. busy = legs moving (it is thinking). The judge is an old, serious spider with glasses. You (the human in the loop) are a person.
- `components/bank/AgentInspector.jsx`: A side panel with everything about one card of the pipeline: what it was told, what it searched, every question it wrote (kept or dropped, with the judge's scores) and how long each run took. stepId the card to show (nu…
- `components/bank/AgentPipeline.jsx`: The panel at work, drawn from bank.steps (written by services/question_bank/runner.py):
- `components/bank/BankQuestions.jsx`: The questions the judge kept. Q&A questions are picked for one mock interview; a whiteboard or coding question starts its own round.
- `components/bank/BankSetup.jsx`: Tab 1 of the question bank: the role, what the panel reads, and who is on the panel.
- `components/bank/BankTabs.jsx`: The top of the question bank pages: the title, then "New bank | Past banks". current 'new' | 'past' | '' (a bank is open) count how many past banks there are (left out while loading)
- `components/bank/BankView.jsx`: #/bank/<id>: the panel at work (live), your turn in review mode, then the questions it wrote.
- `components/bank/PastBanks.jsx`: Tab 2 of the question bank: every bank the panel made.
- `components/bank/ReviewPanel.jsx`: Review mode (human in the loop): the panel has paused and asks you something (bank.pending). kind "plan": approve the lead's plan; edit any brief, or take an agent off the panel kind "verdict": allow or block the judge'…
- `components/bank/RunTimeline.jsx`: When each member of the panel worked, on one time axis (a small Gantt chart, from each step's runs). The agents' bars overlap because they ran in parallel. A dashed bar is time the panel waited for you.
- `components/coding/CodeEditor.jsx`: Holds the editor's colours, so they can change with the app's theme without rebuilding the editor.
- `components/coding/CodingReport.jsx`: The end of a coding round: the score, the tests, each rubric area with the words that prove it, your final code and the best known approach. Correctness comes from the tests, not from the AI.
- `components/coding/CodingSession.jsx`: #/coding/<id>: a coding round. The problem on the left, your code in the middle, Bella on the right. Your code runs in your browser (lib/python.js); Bella reads it when you pause, speaks, and pins notes to lines. When t…
- `components/coding/CodingSetup.jsx`: #/coding: pick a problem (or let SpAIder pick one you haven't finished), pick a mode, start.
- `components/coding/ProblemPane.jsx`: The left side of the coding round: the problem, its examples, and the tests you can see.
- `components/coding/TestResults.jsx`: The panel under the editor: the latest test run, one row per test. run { results, error } from lib/python.js, or null before the first run status '' | 'loading' (Python is loading) | 'running'
- `components/documents/DocumentChat.jsx`: #/docs/<id>: ask questions about one PDF. Every answer comes only from that PDF and cites its pages. The "Under the hood" panel shows how the selected answer was found, and a 3D map of the chunks.
- `components/documents/IngestPipeline.jsx`: The ingestion pipeline, live. job = null: nothing uploaded yet, so the steps explain what will happen. job = { file, stage: 'uploading' | 'processing' | 'done' | 'error', progress, doc, error, startedAt, finishedAt }
- `components/documents/RetrievalTrace.jsx`: How one answer was found, step by step, from the trace the backend sends with it (see services/rag/answer.py). Nothing here is guessed: every number comes from that request. exchange { question, result, error, trace },…
- `components/documents/UploadBox.jsx`: The upload box: click it (or press Enter) to choose a PDF. Dropping a file works anywhere on the page (DocumentsPage handles that); while a file is dragged over the page, `dragging` makes this box light up.
- `components/documents/VectorMap.jsx`: The 3D map of a document's chunks, grouped by meaning, with the selected question on it. This file (and three.js) is downloaded only when the "Vector map" tab is opened. map from GET /documents/<id>/map trace the select…
- `components/evals/EvalRun.jsx`: #/evals/<id>: one run, case by case: what you expected, what the AI did, and where they differ.
- `components/evals/EvalsOverview.jsx`: #/evals: each suite with its latest scores, its recent history, and a button to run it again.
- `components/evals/metrics.js`: What each eval score means, the target it should reach, and how to show it.
- `components/focus/Cobweb.jsx`: The web your spider spins over the screen while you're away: the longer you were gone, the more web.
- `components/focus/FocusButton.jsx`: The Focus button, in a round's header (see lib/focus.js for what focus mode does). Off: a "Focus" button. On: your spider (crosser after each tab switch), the time focused and the number of switches; a click asks whethe…
- `components/focus/FocusLayer.jsx`: The focus-mode screens over the whole app (App.jsx shows this once). See lib/focus.js. - "Caught you", when you come back from another tab or app - a small bar when you left full screen (Esc) but stayed on the page - ho…
- `components/interview/CallView.jsx`: Voice mode, laid out like a video call: the interviewer fills the screen, with captions, your camera in the corner and call controls at the bottom. Like a real interview, it does not show question numbers. InterviewSess…
- `components/interview/InterviewReport.jsx`: Screen 3: the final report, then every answer with what it covered and missed.
- `components/interview/InterviewSession.jsx`: Screen 2: one question at a time. When the interview is finished, it shows the report instead. Voice on = a full-screen video call with the 3D interviewer (CallView). Voice off = the text screen below.
- `components/interview/InterviewSetup.jsx`: Tab 1 of the mock interview: choose what to practise and how, then start. Wide screens: the form on the left, and a summary with the Start button on the right that stays in view.
- `components/interview/InterviewTabs.jsx`: The top of both mock interview tabs: the title, then "New interview | Past interviews". The tabs are plain links (#/interview and #/interview/past), so the browser's back button works. current 'new' or 'past' count how…
- `components/interview/InterviewXray.jsx`: The X-ray: the interview's graph with the path it really took, and every step in order with what it decided and why. It reads LangGraph's saved checkpoints (backend/services/interview/xray.py). running the step running…
- `components/interview/InterviewerAvatar.jsx`: The human 3D interviewer (lib/avatar.js), filling the call screen. The model takes a few seconds to load, so until then it says "<name> is joining…", like a call that is connecting. If 3D is not possible, a simple anima…
- `components/interview/PastInterviews.jsx`: Tab 2 of the mock interview: your numbers, a score chart and every past interview.
- `components/interview/VoiceOrb.jsx`: The interviewer, drawn as a glowing orb. It grows with the sound while someone is talking.
- `components/interview/steps.js`: The steps (nodes) of the interview graph, in plain words. The real wiring is backend/services/interview/graph.py.
- `components/interview/topics.js`: The topic library on the setup screen. Add a topic or a whole area here; nothing else changes.
- `components/panel/PanelCall.jsx`: The panel interview as a video call, laid out like Google Meet: one tile per panelist and one for you. The panelist who asks speaks in their own voice; their tile lights up while they talk, with captions. You answer wit…
- `components/panel/PanelReport.jsx`: The panel's decision, each panelist's vote and reasons, then the whole interview turn by turn, with the private notes the panel passed after every answer (revealed now).
- `components/panel/PanelRoom.jsx`: The panel interview while it runs: a tile per panelist (the one asking glows), the conversation, the current question and your answer box. PanelSession owns the data and the calls; this only draws. steps the live steps…
- `components/panel/PanelSession.jsx`: #/panel/<id>: loads the panel interview, then shows it while it runs and the report once it's done. Voice on = a video call where each panelist speaks in their own voice (PanelCall); voice off = the text room (PanelRoom…
- `components/panel/PanelSetup.jsx`: Tab 1 of the panel interview: the role, what the panel reads, and who sits on it.
- `components/panel/PanelTabs.jsx`: The top of the panel interview pages: the title, then "New panel | Past panels". current 'new' | 'past' count how many past panels there are (left out while loading)
- `components/panel/PastPanels.jsx`: Tab 2 of the panel interview: every panel so far, newest first, with its decision.
- `components/panel/steps.js`: Words for the panel's live steps (backend/services/panel/nodes.py) and its decisions.
- `components/resume/ClaimDetail.jsx`: One claim, opened from the resume: what it says, what they'll ask, and every answer you gave, newest first. With two answers or more, the newest is compared with the one before (your "ghost").
- `components/resume/GrindCard.jsx`: How ready your resume is, and the button that starts a grind. resume the resume from the backend (counts, ready, due, open_grind) busy true while a grind is starting onStart ({ count, mode })
- `components/resume/ResumeLines.jsx`: Your resume, line by line, as a heatmap: every line with a claim is coloured by how well you defend it. A click on a coloured line opens that claim (onPick). Lines without a claim stay plain.
- `components/resume/ResumeUpload.jsx`: The first visit: drop the resume PDF here, or paste its text. busy true while the backend reads it error the last upload's error, if any onUpload ({ file }) or ({ text })
- `components/resume/levels.js`: Words for a claim's colour, kind and next day. The backend sets them (backend/services/resume_grind/).
- `components/stats/ActivityCalendar.jsx`: The last four weeks, one square per day (Monday first). The darker the square, the more you did.
- `components/stats/SpiderWeb.jsx`: The web on the Stats page: your spider sits in the middle, and each task is a fly caught on a spoke.
- `components/whiteboard/Board.jsx`: The page re-renders every second (for its countdown). memo keeps the board from re-rendering with it.
- `components/whiteboard/InterviewerPanel.jsx`: The right side of the whiteboard and coding rounds: Bella on video, the conversation, and one reply bar. messages [{ role: 'interviewer' | 'candidate', text }] voice everything from useInterviewVoice() looking Bella is…
- `components/whiteboard/WhiteboardReport.jsx`: The end of a whiteboard round: the score, your final board, each rubric area with the words that prove it, and what to study next. Points come from the code, not from a number the AI picked.
- `components/whiteboard/WhiteboardSession.jsx`: #/whiteboard/<id>: a system design round. You draw on the left; Bella, the 3D interviewer, watches on the right, looks at the board when you pause, speaks her feedback and pins notes on the board. When the round is fini…
- `components/whiteboard/WhiteboardSetup.jsx`: #/whiteboard: pick a system design question (or write your own), then start. Past rounds are below.

### lib/

- `lib/agents.js`: How each member of the question bank panel looks: every agent is a little spider in its own colour.
- `lib/api.js`: Every call to the Flask backend goes through this file.
- `lib/avatar.js`: The human 3D interviewer in voice mode: a model that talks with lip-sync and reacts while you answer.
- `lib/captions.js`: When each word of a spoken line is said. The 3D interviewer moves her lips with it, and the captions
- `lib/currentChat.js`: The backend stores every chat in MongoDB. The browser only remembers which chat is open,
- `lib/focus.js`: The current focus session, kept up to date in any component.
- `lib/format.js`: Small display helpers shared by pages.
- `lib/markdown.jsx`: A small, safe Markdown renderer for AI replies: paragraphs, lists, headings,
- `lib/moods.js`: What your spider says in each mood. The backend picks the mood from her health
- `lib/python.js`: Runs your Python code against a problem's tests, in a Web Worker with Pyodide (see pythonWorker.js).
- `lib/pythonWorker.js`: Runs Python in the browser with Pyodide (Python compiled to WebAssembly), inside a Web Worker
- `lib/router.js`: A tiny hash router: #/interview, #/interview/<id>, #/bank, #/docs... (no hash = #/interview).
- `lib/theme.js`: { choice, theme }: what you picked, and what the page shows now. Follows the computer when on 'system'.
- `lib/useIdle.js`: True once you haven't moved the mouse, typed or scrolled for `ms` while this tab is open. It only watches; it never stops or interrupts anything.
- `lib/useInterviewVoice.js`: interviewMode is the mode chosen when the interview was created: 'voice' or 'text'. The Voice on/off button in the header can still change it during the interview. voiceName: who speaks the question. '' = Bella; in a pa…
- `lib/useStats.js`: Loads /api/stats, and loads it again after anything you do (lib/api.js sends "recent-changed" after each chat message, answer and finished round) and when you come back to this tab. stats the data, or null until it firs…
- `lib/vectorScene.js`: The 3D vector map, drawn with three.js (no React here).
- `lib/voice.js`: Low-level voice helpers (no React here):
- `lib/webgl.js`: Can this browser draw 3D (WebGL)? Checked once, then remembered.

### styles/

- `styles/bank.css`: The question bank (pages/QuestionBankPage.jsx and components/bank/). It reuses the interview setup's
- `styles/base.css`: Base elements and small helpers used on every page.
- `styles/chat.css`: The chat page: message list, bubbles, welcome screen and the message box.
- `styles/coding.css`: The coding round: setup, the round itself (problem | editor + tests | Bella) and the report.
- `styles/documents.css`: The Documents page: upload at the top (the drop box and the live pipeline), your documents below.
- `styles/evals.css`: The Evals page (pages/EvalsPage.jsx, components/evals/). Colours are theme tokens only.
- `styles/focus.css`: Focus mode (lib/focus.js and components/focus/): the Focus button, the "caught you" screen with
- `styles/index.css`: All styles, in order: tokens first, then base elements, then each area.
- `styles/interview.css`: The mock interview: setup, the question screen and the report.
- `styles/panel.css`: The panel interview (pages/PanelPage.jsx, components/panel/). Setup reuses the question bank's styles
- `styles/resume.css`: The Resume grind page (pages/ResumePage.jsx, components/resume/).
- `styles/shell.css`: The app frame: sidebar on the left, page content on the right.
- `styles/stats.css`: Your spider (components/PetSpider.jsx) and the Stats page (pages/StatsPage.jsx).
- `styles/tokens.css`: Design tokens: every colour, radius and shadow lives here.
- `styles/traces.css`: The Traces page: a table of AI calls, a page at a time; "View" opens one call in a pop-up.
- `styles/whiteboard.css`: The system design whiteboard: setup, the round itself (board + interviewer) and the report.
