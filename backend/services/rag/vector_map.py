"""The 3D map of a document's chunks, for the "Under the hood" panel.

Every chunk is a vector: a list of 1,536 numbers that captures its meaning. Two things come from them:

1. Groups: chunks with similar meaning go in the same group, using all 1,536 numbers, so the groups are
   real. The method is called k-means (see _group). Each group is named after its most typical words.
2. Positions: 1,536 numbers can't be drawn, so we squeeze each vector to 3 numbers (x, y, z). We keep
   the 3 directions in which this document's chunks differ the most; this method is called PCA.
   The positions are only a picture: closeness on the map is approximate.

The browser places a question on the same map with the same recipe: (vector - mean) · axis / scale,
and compares it with each group's centre to show which group it is closest to.
"""
import math
import re
from collections import Counter

import numpy as np

from services.rag import vector_store

MAX_GROUPS = 3  # the map can show 3 colours that everyone can tell apart, colour-blind people too
ROUNDS = 30  # k-means stops after this many rounds, even if the groups are still moving a little

STOP_WORDS = set(
    "a about above after again all also am an and any are as at be because been before being below between both "
    "but by can could did do does doing down during each few for from further had has have having he her here his "
    "how i if in into is it its itself just may me more most must my no nor not now of off on once one only or "
    "other our out over own page per same she should so some such than that the their them then there these they "
    "this those through to too two under until up use used using very was we were what when where which while who "
    "why will with would you your less least better best good many much well like get make made need often "
    "every instead".split()
)


def document_map(document_id):
    """Everything the 3D map needs: each chunk's position and group, each group's name, and the recipe to
    place a question."""
    data = vector_store.get_document_vectors(document_id)
    if len(data["ids"]) == 0:
        return {"points": [], "groups": [], "mean": [], "axes": [], "scale": 1, "dimensions": 0}

    vectors = np.array(data["embeddings"], dtype=float)  # one row per chunk, 1,536 numbers each
    texts = data["documents"]

    # 1. Groups, from the full vectors. Each vector is first scaled to length 1 ("unit" vectors),
    #    so comparing two of them only compares their direction, which is their meaning.
    unit = vectors / np.linalg.norm(vectors, axis=1, keepdims=True)
    group_of, centres = _group(unit, _group_count(len(unit)))

    # 2. Positions: each chunk as (x, y, z) between -1 and 1.
    xyz, mean, axes, scale = _positions_3d(vectors)

    points = []
    for i, chunk_id in enumerate(data["ids"]):
        points.append({
            "id": chunk_id,
            "page": data["metadatas"][i]["page"],
            "text": texts[i][:300],
            "group": int(group_of[i]),
            "xyz": _rounded(xyz[i], 4),
        })

    return {
        "points": points,
        "groups": _describe_groups(texts, group_of, centres, xyz),
        "mean": _rounded(mean, 6),
        "axes": [_rounded(axes[0], 6), _rounded(axes[1], 6), _rounded(axes[2], 6)],
        "scale": scale,
        "dimensions": int(vectors.shape[1]),
    }


def _positions_3d(vectors):
    """PCA: squeeze each vector to 3 numbers. Returns (xyz, mean, axes, scale).

    mean   the average vector; we measure every chunk from there
    axes   the 3 directions in which the chunks differ the most, strongest first
    scale  a divider, so the whole map fits in a box from -1 to 1
    """
    mean = vectors.mean(axis=0)
    centered = vectors - mean  # each chunk measured from the average

    # svd is the standard way to find those directions: the rows of vt, strongest first
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    axes = np.zeros((3, vectors.shape[1]))
    directions = min(3, len(vt))  # a document with fewer than 3 chunks has fewer directions...
    axes[:directions] = vt[:directions]  # ...and the missing ones stay all zeros

    coordinates = centered @ axes.T  # how far each chunk goes along each of the 3 directions
    scale = float(np.abs(coordinates).max())
    if scale == 0:
        scale = 1.0  # every chunk at the same spot: nothing to scale
    return coordinates / scale, mean, axes, scale


def _describe_groups(texts, group_of, centres, xyz):
    """For each group: its name (most typical words), size, centre on the map, and centre vector."""
    all_words = _count_words(texts)
    groups = []
    for g, centre in enumerate(centres):
        members = []
        for i in range(len(texts)):
            if group_of[i] == g:
                members.append(i)
        member_texts = []
        for i in members:
            member_texts.append(texts[i])
        groups.append({
            "id": g,
            "label": _label(member_texts, all_words),
            "size": len(members),
            "center": _rounded(xyz[members].mean(axis=0), 4),  # the middle of its points on the map
            "centroid": _rounded(centre, 5),  # its centre in the full 1,536 numbers (the browser compares with it)
        })
    return groups


def _group_count(chunk_count):
    """One group for a tiny document; 2 or 3 for a normal one."""
    if chunk_count < 6:
        return 1
    count = round(math.sqrt(chunk_count / 4))  # grows slowly with the size of the document
    count = max(count, 2)
    count = min(count, MAX_GROUPS)
    return count


def _group(unit, k):
    """k-means: puts the chunks in k groups of similar meaning. Returns (each chunk's group, each group's centre).

    How it works:
      1. Pick k chunks that are far apart, as the first centres.
      2. Every chunk joins the group whose centre it is most similar to.
      3. Each centre moves to the average of its group.
      4. Repeat 2 and 3 until the centres stop moving.
    "Similar" is cosine similarity: for vectors of length 1, it is just a @ b (1 = same meaning).
    The biggest group comes first, and the same document always gives the same groups (no randomness).
    """
    # 1. The first start is the chunk least like the average; each next start is the chunk least like
    #    every start picked so far.
    starts = [int(np.argmin(unit @ unit.mean(axis=0)))]
    while len(starts) < k:
        closest = np.max(unit @ unit[starts].T, axis=1)  # each chunk's similarity to its nearest start
        starts.append(int(np.argmin(closest)))
    centres = unit[starts]

    for _ in range(ROUNDS):
        # 2. similarity of every chunk to every centre; each chunk takes the most similar one
        group_of = np.argmax(unit @ centres.T, axis=1)

        # 3. each centre moves to the average of its members (scaled back to length 1)
        new_centres = []
        for g in range(k):
            members = unit[group_of == g]
            if len(members) > 0:
                centre = members.mean(axis=0)
            else:
                centre = centres[g]  # an empty group keeps its old centre
            new_centres.append(centre / np.linalg.norm(centre))
        new_centres = np.array(new_centres)

        # 4. stop when nothing moved
        if np.allclose(new_centres, centres):
            break
        centres = new_centres

    return _biggest_first(group_of, centres, k)


def _biggest_first(group_of, centres, k):
    """Renumbers the groups by size: the biggest becomes group 0 (equal sizes keep their order)."""
    by_size = []
    for g in range(k):
        size = int(np.sum(group_of == g))
        by_size.append((-size, g))  # minus: sorting puts the biggest first
    by_size.sort()

    order = []
    new_number = {}
    for new, (_, old) in enumerate(by_size):
        order.append(old)
        new_number[old] = new

    renumbered = []
    for g in group_of:
        renumbered.append(new_number[int(g)])
    return np.array(renumbered), centres[order]


def _words(text):
    """The meaningful words of a text: lower case, 3+ letters, common words like "the" left out."""
    words = []
    for word in re.findall(r"[a-z][a-z-]{2,}", text.lower()):
        if word not in STOP_WORDS:
            words.append(word)
    return words


def _count_words(texts):
    """How often each meaningful word appears in these texts."""
    counts = Counter()
    for text in texts:
        counts.update(_words(text))
    return counts


def _label(texts, all_words):
    """A group's name: the 3 words most typical of its chunks, compared with the whole document."""
    words = _count_words(texts)
    total = sum(words.values()) or 1
    total_all = sum(all_words.values()) or 1

    candidates = []
    for word, count in words.items():
        if count >= 2:  # a word used once is not typical of anything
            candidates.append(word)
    if not candidates:
        candidates = list(words)

    # A word is typical if it is more common here than in the whole document. Ties (when the group is the
    # whole document) go to the word used most, then to the word seen first.
    scored = []
    for position, word in enumerate(candidates):
        share_here = words[word] / total
        share_everywhere = all_words[word] / total_all
        scored.append((share_here - share_everywhere, words[word], -position, word))
    scored.sort(reverse=True)

    best = []
    for item in scored[:3]:
        best.append(item[3])
    if not best:
        return "other"
    return " · ".join(best)


def _rounded(values, digits):
    """A list of numbers, rounded (numpy numbers turned into plain ones, so they can be sent as JSON)."""
    numbers = []
    for value in values:
        numbers.append(round(float(value), digits))
    return numbers
