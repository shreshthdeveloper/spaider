from langchain_core.messages import AIMessage, HumanMessage, SystemMessage

from models.chat import ChatSession, Message, find_chat, utc_now
from services.llm import get_model

SYSTEM_PROMPT = "You are a friendly interview coach. Keep answers short and clear."
HISTORY_LIMIT = 20  # how many past messages the model sees on each call


def build_prompt(chat, user_message):
    """The messages the model sees: the coach's instructions, the last HISTORY_LIMIT messages, then the new
    one."""
    prompt = [SystemMessage(SYSTEM_PROMPT)]

    for message in chat.messages[-HISTORY_LIMIT:]:
        if message.role == "user":
            prompt.append(HumanMessage(message.content))
        else:
            prompt.append(AIMessage(message.content))

    prompt.append(HumanMessage(user_message))
    return prompt


def reply(user_message, session_id=None):
    """Sends your message to the AI, saves your message and its answer, and returns the answer."""
    chat = find_chat(session_id)
    if chat is None:
        chat = ChatSession()  # a new chat; it is saved only after the AI answers

    prompt = build_prompt(chat, user_message)
    answer = get_model().invoke(prompt, config={"metadata": {"step": "chat"}})

    chat.messages.append(Message(role="user", content=user_message))
    chat.messages.append(Message(role="ai", content=answer.content, tokens=answer.usage_metadata or {}))
    chat.updated_at = utc_now()
    chat.save()  # the first save creates the chat, later saves update it

    return {"session_id": str(chat.id), "reply": answer.content, "tokens": answer.usage_metadata}


def get_history(session_id):
    """Every message of one chat, or None if there is no such chat."""
    chat = find_chat(session_id)
    if chat is None:
        return None

    history = []
    for message in chat.messages:
        history.append({"role": message.role, "content": message.content, "tokens": message.tokens or None})
    return history
