"""Draws the panel interview: which steps exist, and which step comes after which.

    START -> brief -> ask -> after_ask() chooses one:
                       ^       "grade" -> grade -> listen x every panelist (at the same time) -> moderator
                       |                                                                           |
                       +------------- after_moderator(): "ask" (a follow-up or the next question) -+
                                      or, once every question is asked: verdict x every panelist
             End pressed (or every question asked): verdict x every panelist -> debrief -> END

ask pauses with interrupt() until your answer arrives, like the mock interview. Every step is saved in
MongoDB (the checkpointer) under thread_id = the panel's id, so each answer is a new request that carries on
from where the panel stopped.
"""
from langgraph.graph import END, START, StateGraph

from services.panel import nodes
from services.panel.state import PanelState


def build_panel_graph(checkpointer):
    """Draws the panel graph (the picture above) and attaches the checkpointer that saves every step."""
    builder = StateGraph(PanelState)

    builder.add_node("brief", nodes.brief)
    builder.add_node("ask", nodes.ask)
    builder.add_node("grade", nodes.grade)
    builder.add_node("listen", nodes.listen)
    builder.add_node("moderator", nodes.moderator)
    builder.add_node("verdict", nodes.verdict)
    builder.add_node("debrief", nodes.debrief)

    builder.add_edge(START, "brief")
    builder.add_edge("brief", "ask")
    builder.add_conditional_edges("ask", nodes.after_ask, ["grade", "verdict", "debrief"])
    # send_to_listeners returns one Send("listen", ...) per panelist: they run in parallel,
    # and the moderator starts only when all of them are done
    builder.add_conditional_edges("grade", nodes.send_to_listeners, ["listen"])
    builder.add_edge("listen", "moderator")
    builder.add_conditional_edges("moderator", nodes.after_moderator, ["ask", "verdict"])
    builder.add_edge("verdict", "debrief")
    builder.add_edge("debrief", END)

    return builder.compile(checkpointer=checkpointer)
