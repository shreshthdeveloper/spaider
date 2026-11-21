"""The panel: every agent that can write questions. Add one here and it shows up on the setup screen.

makes: the kind of question it writes, which decides where you practise it:
  "qa"          a mock interview
  "whiteboard"  a whiteboard round
  "coding"      a coding round (picked from our tested problems, never invented)
count: how many questions it writes.
"""

AGENTS = [
    {
        "id": "technical",
        "name": "Technical",
        "makes": "qa",
        "count": 4,
        "focus": "the core technical skills the job needs: concepts, tools, trade-offs and debugging",
    },
    {
        "id": "python",
        "name": "Python basics",
        "makes": "qa",
        "count": 4,
        "focus": "Python fundamentals: data types, functions, classes, errors, generators and the standard library",
    },
    {
        "id": "system_design",
        "name": "System design",
        "makes": "whiteboard",
        "count": 2,
        "focus": "system design problems that fit the role, to be drawn on a whiteboard",
    },
    {
        "id": "coding",
        "name": "Coding",
        "makes": "coding",
        "count": 2,
        "focus": "coding problems that fit the role, picked from the tested problem list",
    },
    {
        "id": "resume",
        "name": "Resume grill",
        "makes": "qa",
        "count": 4,
        "focus": "the candidate's own projects and claims: what they built, why, the numbers, and what went wrong",
    },
    {
        "id": "recruiter",
        "name": "Recruiter",
        "makes": "qa",
        "count": 3,
        "focus": "behavioural and fit questions: motivation, teamwork, conflict, and why this company and role",
    },
]


def find_agent(agent_id):
    """The agent with this id, or None."""
    for agent in AGENTS:
        if agent["id"] == agent_id:
            return agent
    return None
