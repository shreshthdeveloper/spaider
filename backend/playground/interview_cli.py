"""Run a mock interview in the terminal. From backend/:  python -m playground.interview_cli"""
import uuid

from dotenv import load_dotenv
from langgraph.checkpoint.memory import InMemorySaver
from langgraph.types import Command

from services.interview.graph import build_interview_graph

load_dotenv()

# 1. Build the graph. This only draws it; no node runs yet.
#    InMemorySaver is the checkpointer: it keeps each interview's state in memory
#    (so it is lost when this script ends).
graph = build_interview_graph(InMemorySaver())

# 2. One interview = one thread_id. Every invoke() with this config continues the same interview.
config = {"configurable": {"thread_id": uuid.uuid4().hex}}

# 3. Start. This dict becomes the first state. LangGraph runs START -> plan_questions -> ask,
#    and returns as soon as ask() pauses with interrupt().
topic = input("Topic or job description: ")
result = graph.invoke({"topic": topic, "num_questions": 2}, config)

# 4. While the graph is paused, show the question, read the answer and resume.
while "__interrupt__" in result:
    asked = result["__interrupt__"][0].value  # the dict that ask() gave to interrupt()
    label = "Follow-up" if asked["is_follow_up"] else f"Question {asked['number']} of {asked['total']}"
    print(f"\n[{label}] {asked['question']}")
    answer = input("You (or /end to finish): ")
    if answer.strip() == "/end":
        reply = {"action": "end"}
    else:
        reply = {"action": "answer", "text": answer}

    # Resume: ask() returns the reply, then grade -> route() -> ... runs until the next pause or END.
    result = graph.invoke(Command(resume=reply), config)
    if reply["action"] == "answer":
        graded = result["last_grade"]
        print(f"  -> Score {graded['score']}/5. {graded['feedback']}")
        if graded["missed"]:
            print("     Missed:", "; ".join(graded["missed"]))

    

# 5. No more pauses: the graph reached END, and result is the final state, with the report.
report = result["report"]
print(f"\n===== REPORT: {report['overall']}/5 =====")
print(report["summary"])
print("Strengths:", "; ".join(report["strengths"]))
print("Study next:", "; ".join(report["improve"]))
