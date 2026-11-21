"""Turns an Excalidraw drawing into plain text the AI can read: the boxes, the arrows between them, and loose text.

Each box gets a short name (b1, b2, ...) so the AI can say which box a sticky note belongs to.
The notes the AI itself pinned on the board are left out, so it never reviews its own notes.

A drawing is a list of "elements". Each element is a dict with a "type" (rectangle, arrow, text...),
an "id", a position (x, y), and a few links: text inside a box points to the box with "containerId",
and an arrow points to the boxes at its two ends with "startBinding" and "endBinding".
"""

BOX_TYPES = {"rectangle", "ellipse", "diamond"}
LINE_TYPES = {"arrow", "line"}
MAX_BOXES = 150  # a bigger board is cut short, to keep the prompt small
ROW_HEIGHT = 80  # boxes whose tops are this close count as the same row when reading the board


def describe(scene):
    """Returns (text, names). names maps a short name like "b1" to the element's real Excalidraw id."""
    elements = _your_elements(scene)
    label_of = _labels(elements)  # element id -> the text written inside it

    names = {}  # "b1" -> real id (to turn the AI's answer back into the box it means)
    short_name = {}  # real id -> "b1" (to write arrows as "b1 -> b2")
    box_lines = []
    for number, box in enumerate(_boxes_in_reading_order(elements), start=1):
        name = f"b{number}"
        names[name] = box["id"]
        short_name[box["id"]] = name
        label = label_of.get(box["id"]) or "(no label)"
        box_lines.append(f'- {name}: "{label}" ({box["type"]})')

    arrow_lines = []
    for element in elements:
        if element.get("type") in LINE_TYPES:
            start = _end_name(element.get("startBinding"), short_name, label_of)
            end = _end_name(element.get("endBinding"), short_name, label_of)
            line = f"- {start} -> {end}"
            if label_of.get(element["id"]):
                line += f' (label "{label_of[element["id"]]}")'
            arrow_lines.append(line)

    loose_text = []
    for element in elements:
        if element.get("type") == "text" and not element.get("containerId"):
            loose_text.append(f'- "{_clean(element.get("text", ""))}"')

    text = _section("Boxes", box_lines)
    text += "\n\n" + _section("Arrows", arrow_lines)
    text += "\n\n" + _section("Other text on the board", loose_text)
    freehand = _count_freehand(elements)
    if freehand:
        text += f"\n\nFreehand strokes: {freehand} (look at the picture)"
    return text, names


def _your_elements(scene):
    """Every shape that is still on the board and was drawn by you (not the AI's sticky notes)."""
    elements = []
    for element in scene.get("elements", []):
        if not element.get("isDeleted") and not _by_ai(element):
            elements.append(element)
    return elements


def _labels(elements):
    """Text written inside a box or on an arrow points to it with containerId: element id -> that text."""
    label_of = {}
    for element in elements:
        if element.get("type") == "text" and element.get("containerId"):
            label_of[element["containerId"]] = _clean(element.get("text", ""))
    return label_of


def _boxes_in_reading_order(elements):
    """The boxes from top to bottom, and left to right within a row (at most MAX_BOXES)."""
    boxes = []
    for element in elements:
        if element.get("type") in BOX_TYPES:
            boxes.append(element)
    boxes.sort(key=_reading_position)
    return boxes[:MAX_BOXES]


def _reading_position(box):
    """Sort key: the row first (boxes with tops within ROW_HEIGHT share a row), then left to right."""
    row = round(box.get("y", 0) / ROW_HEIGHT)
    return (row, box.get("x", 0))


def _end_name(binding, short_name, label_of):
    """One end of an arrow: the box it is attached to, like  b2 "API", or (not attached)."""
    if not binding:
        return "(not attached)"
    element_id = binding.get("elementId")
    if element_id in short_name:
        return f'{short_name[element_id]} "{label_of.get(element_id, "")}"'
    return "(not attached)"


def _count_freehand(elements):
    """How many freehand strokes there are (the AI must look at the picture for those)."""
    count = 0
    for element in elements:
        if element.get("type") == "freedraw":
            count += 1
    return count


def _section(title, lines):
    """ "Boxes:\\n- b1 ...\\n- b2 ..."  or  "Boxes:\\n- none" """
    if not lines:
        return f"{title}:\n- none"
    return f"{title}:\n" + "\n".join(lines)


def _by_ai(element):
    """True for the AI's own sticky notes (we tag them with customData: {"by": "ai"})."""
    custom = element.get("customData") or {}
    return custom.get("by") == "ai"


def _clean(text):
    """One line, at most 200 characters."""
    return " ".join(str(text).split())[:200]
