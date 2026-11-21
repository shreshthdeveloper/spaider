"""The agents' tool: searching the candidate's uploaded documents (the same Chroma store as the Documents page).

The agent decides what to search for (tool calls); our code runs each search and sends it to the live
pipeline, so the page shows "searched 'Kafka consumer groups' -> notes.pdf p.4" while the agent works."""
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from langgraph.config import get_stream_writer

from services.llm import get_model
from services.question_bank.inputs import describe
from services.question_bank.prompts import RESEARCH_PROMPT
from services.question_bank.schemas import SearchDocuments
from services.rag import vector_store
from services.rag.answer import MIN_RELEVANCE

MAX_ROUNDS = 2  # the agent may search at most twice...
MAX_CALLS = 2  # ...with at most this many searches each time
HITS = 3  # passages kept per search


def research(agent, brief, inputs, bank_id):
    """Lets one agent search the chosen documents before it writes. Returns the passages it found.
    Coding agents don't search: they pick from the tested problems."""
    documents = inputs.get("documents") or []
    if not documents or agent["makes"] == "coding":
        return []

    # bind_tools: the model may now answer "please run SearchDocuments with this query" (a "tool call")
    # instead of plain text. We run the search ourselves and send the result back as a ToolMessage.
    model = get_model().bind_tools([SearchDocuments])
    messages = [
        SystemMessage(RESEARCH_PROMPT.format(name=agent["name"], focus=agent["focus"])),
        HumanMessage(f"Brief from the panel lead: {brief}\n\n{describe(inputs)}"),
    ]
    config = {"metadata": {"step": f"bank_agent_{agent['id']}", "thread_id": bank_id}}
    passages = []

    for _ in range(MAX_ROUNDS):
        reply = model.invoke(messages, config=config)
        if not reply.tool_calls:
            break  # the agent has what it needs
        messages.append(reply)
        for number, call in enumerate(reply.tool_calls):
            # every tool call needs an answer, even the ones we don't run
            if number >= MAX_CALLS:
                messages.append(ToolMessage("Skipped: at most two searches at a time.", tool_call_id=call["id"]))
                continue
            query = str(call["args"].get("query", ""))[:200]
            found = search(documents, query)
            passages += found
            # tell the live pipeline (runner.py) what this agent searched for, and where it found it.
            # get_stream_writer() sends a message out of the graph while this step is still running.
            places = []
            for hit in found:
                places.append(_where(hit))
            get_stream_writer()({"agent": agent["id"], "query": query, "found": places})
            messages.append(ToolMessage(as_text(found) or "Nothing relevant found.", tool_call_id=call["id"]))

    return _unique(passages)


def search(documents, query):
    """The best passages for the query, across the chosen documents."""
    hits = []
    for document in documents:
        for chunk, score in vector_store.search(document["id"], query, k=HITS):
            if score >= MIN_RELEVANCE:
                hits.append({
                    "doc": document["filename"],
                    "page": chunk.metadata.get("page"),
                    "text": chunk.page_content[:700],
                    "score": round(score, 3),
                })
    hits.sort(key=_score, reverse=True)  # best first
    return hits[:HITS]


def _score(hit):
    """Sort key: a passage's relevance score."""
    return hit["score"]


def as_text(passages):
    """The passages for a prompt, each with where it came from:  "[notes.pdf p.4] ..." """
    blocks = []
    for passage in passages:
        blocks.append(f"[{_where(passage)}] {passage['text']}")
    return "\n\n".join(blocks)


def _where(passage):
    """Where a passage comes from, like notes.pdf p.4."""
    return f"{passage['doc']} p.{passage['page']}"


def _unique(passages):
    """The passages without repeats (two searches can find the same page)."""
    seen, unique = set(), []
    for passage in passages:
        key = (passage["doc"], passage["page"], passage["text"][:80])
        if key not in seen:
            seen.add(key)
            unique.append(passage)
    return unique
