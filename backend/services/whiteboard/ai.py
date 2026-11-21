"""One way to ask the AI about the board: the text description plus a picture of the board."""
import logging

from langchain_core.messages import HumanMessage, SystemMessage

from services.llm import get_model

log = logging.getLogger(__name__)


def ask_about_board(schema, system_prompt, text, image, step, session_id):
    """Ask with the board's description and its picture, and get the answer in `schema`.

    If the model cannot take the picture, ask again with the text only: the boxes and arrows are
    in the text, so the review still works. Each call is logged in AI traces under `step`.
    """
    model = get_model().with_structured_output(schema)
    config = {"metadata": {"step": step, "thread_id": session_id}}

    if image:
        with_picture = [{"type": "text", "text": text}, {"type": "image_url", "image_url": {"url": image}}]
        try:
            return model.invoke([SystemMessage(system_prompt), HumanMessage(content=with_picture)], config=config)
        except Exception:
            log.exception("the model could not take the picture; asking again with the text only")

    return model.invoke([SystemMessage(system_prompt), HumanMessage(content=text)], config=config)
