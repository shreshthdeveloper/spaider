from typing import TypedDict

from langgraph.checkpoint.memory import InMemorySaver
from langgraph.graph import END, START, StateGraph
from langgraph.types import Command, interrupt

QUESTIONS = ["What is 2 + 2?", "What is the capital of France?"]
ANSWERS = ["4", "paris"]


# 1. STATE: the data the graph carries from step to step.
class State(TypedDict):
    index: int
    score: int
    last_answer: str


# 2. NODES: plain functions. Each one reads the state and returns only what changes.
def ask(state):
    question = QUESTIONS[state["index"]]
    answer = interrupt(question)  # pause here and wait for a human
    return {"last_answer": answer}


def check(state):
    correct = state["last_answer"].strip().lower() == ANSWERS[state["index"]]
    new_score = state["score"] + 1 if correct else state["score"]
    return {"score": new_score, "index": state["index"] + 1}


# 3. ROUTER: decides where to go next.
def route(state):
    if state["index"] < len(QUESTIONS):
        return "ask"
    return END


# 4. BUILD THE GRAPH: nodes + edges.
builder = StateGraph(State)
builder.add_node("ask", ask)
builder.add_node("check", check)
builder.add_edge(START, "ask")
builder.add_edge("ask", "check")
builder.add_conditional_edges("check", route, ["ask", END])

# 5. CHECKPOINTER: saves the state at every step, so the graph can pause and resume.
graph = builder.compile(checkpointer=InMemorySaver())

# 6. RUN IT. thread_id = which conversation this is.
config = {"configurable": {"thread_id": "quiz-1"}}
result = graph.invoke({"index": 0, "score": 0, "last_answer": ""}, config)

while "__interrupt__" in result:
    question = result["__interrupt__"][0].value
    answer = input(question + " ")
    result = graph.invoke(Command(resume=answer), config)

print(f"Score: {result['score']} / {len(QUESTIONS)}")
print("Saved state:", graph.get_state(config).values)
print(graph.get_graph().draw_mermaid())
