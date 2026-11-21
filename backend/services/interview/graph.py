"""Draws the interview: which steps (nodes) exist, and which step comes after which (edges).

    START -> plan_questions -> ask -> after_ask() chooses one:
                                ^        "grade"        -> grade -> route() chooses one:
                                |                                   "follow_up"     -> follow_up     -> ask
                                |                                   "next_question" -> next_question -> ask
                                |                                   "write_report"  -> write_report  -> END
                                |        "write_report" (the candidate pressed End) -> write_report  -> END
                                |
                     ask pauses here with interrupt() until the reply arrives

Building the graph runs nothing. Nodes only run when someone calls graph.invoke().
"""
from langgraph.graph import END, START, StateGraph

from services.interview import nodes
from services.interview.state import InterviewState


def build_interview_graph(checkpointer):
    """Draws the interview graph (the picture above), and attaches the checkpointer that saves every step."""
    builder = StateGraph(InterviewState)

    # Nodes: a name -> the function that runs for that step.
    builder.add_node("plan_questions", nodes.plan_questions)
    builder.add_node("ask", nodes.ask)
    builder.add_node("grade", nodes.grade)
    builder.add_node("follow_up", nodes.follow_up)
    builder.add_node("next_question", nodes.next_question)
    builder.add_node("write_report", nodes.write_report)

    # Edges: "after this node, go to that node".
    builder.add_edge(START, "plan_questions")   # a new graph.invoke({...}) starts here
    builder.add_edge("plan_questions", "ask")
    builder.add_conditional_edges(              # after ask (on resume), after_ask() picks: grade, or end early
        "ask", nodes.after_ask, ["grade", "write_report"]
    )
    builder.add_conditional_edges(              # after grade, route() returns the name of the next node
        "grade", nodes.route, ["follow_up", "next_question", "write_report"]
    )
    builder.add_edge("follow_up", "ask")
    builder.add_edge("next_question", "ask")
    builder.add_edge("write_report", END)       # graph.invoke() returns the final state

    # compile() checks the drawing and attaches the checkpointer. The checkpointer saves the
    # state after every node, under the interview's thread_id, so the graph can pause and resume.
    return builder.compile(checkpointer=checkpointer)
