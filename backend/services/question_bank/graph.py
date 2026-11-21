"""The panel as a LangGraph graph: a pipeline with a parallel step in the middle.

    START -> coordinator -> review_plan -> agent x N (all at the same time) -> judge -> review_verdict
    review_verdict -> revise -> judge -> review_verdict     only if an agent is sent back (at most once)
    review_verdict -> assemble -> END

review_plan and review_verdict pause for you in review mode (human in the loop), and pass straight
through otherwise. A pause needs saved state to come back to, so the graph has a checkpointer, like the
mock interview: every step is saved in MongoDB under the run's thread id (see runner.py).
"""
from functools import lru_cache

from langgraph.checkpoint.mongodb import MongoDBSaver
from langgraph.graph import END, START, StateGraph
from mongoengine.connection import get_connection, get_db

from services.question_bank import nodes
from services.question_bank.state import BankState


@lru_cache
def get_bank_graph():
    """Draws the panel graph (the picture above), and attaches the checkpointer. Built once."""
    builder = StateGraph(BankState)

    builder.add_node("coordinator", nodes.coordinator)
    builder.add_node("review_plan", nodes.review_plan)
    builder.add_node("agent", nodes.agent)
    builder.add_node("judge", nodes.judge)
    builder.add_node("review_verdict", nodes.review_verdict)
    builder.add_node("revise", nodes.revise)
    builder.add_node("assemble", nodes.assemble)

    builder.add_edge(START, "coordinator")
    builder.add_edge("coordinator", "review_plan")
    # send_to_agents returns one Send("agent", ...) per agent: they run in parallel,
    # and the judge starts only when all of them are done
    builder.add_conditional_edges("review_plan", nodes.send_to_agents, ["agent"])
    builder.add_edge("agent", "judge")
    builder.add_edge("judge", "review_verdict")
    builder.add_conditional_edges("review_verdict", nodes.after_review, ["revise", "assemble"])
    builder.add_edge("revise", "judge")
    builder.add_edge("assemble", END)

    checkpointer = MongoDBSaver(get_connection(), db_name=get_db().name)
    return builder.compile(checkpointer=checkpointer)
