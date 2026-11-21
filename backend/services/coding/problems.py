"""The coding problems. Add one here and it shows up on the setup screen.

Each problem has tests. The browser runs them (in Pyodide), so your code never runs on the server.
A test has either "args" (a list, passed to your function) or "args_code" (Python that builds the
arguments, for big inputs). "hidden" tests run only when you finish. "limit_ms" makes a test fail
if your function is too slow, which is how a brute-force answer to a big input is caught.
"compare" says how answers are compared: "exact", or "any_order" for lists whose order does not matter.
"""

PROBLEMS = [
    {
        "id": "two-sum",
        "title": "Two Sum",
        "difficulty": "easy",
        "topic": "Hash maps",
        "function": "two_sum",
        "starter": "def two_sum(nums, target):\n    # return the indices of the two numbers that add up to target\n    pass\n",
        "statement": (
            "Given a list of integers nums and an integer target, return the indices of the two numbers "
            "that add up to target. There is exactly one answer, and you may not use the same element twice. "
            "Return the two indices in any order."
        ),
        "examples": [
            {"input": "nums = [2, 7, 11, 15], target = 9", "output": "[0, 1]"},
            {"input": "nums = [3, 2, 4], target = 6", "output": "[1, 2]"},
        ],
        "compare": "any_order",
        "best": "O(n) time with a hash map from value to index",
        "tests": [
            {"name": "example 1", "args": [[2, 7, 11, 15], 9], "expected": [0, 1]},
            {"name": "example 2", "args": [[3, 2, 4], 6], "expected": [1, 2]},
            {"name": "same number twice", "args": [[3, 3], 6], "expected": [0, 1]},
            {"name": "negative numbers", "args": [[-1, -2, -3, -4, -5], -8], "expected": [2, 4], "hidden": True},
            {"name": "zeros", "args": [[0, 4, 3, 0], 0], "expected": [0, 3], "hidden": True},
            {
                "name": "big input (50,000 numbers)",
                "args_code": "[list(range(1, 50001)), 99999]",
                "expected": [49998, 49999],
                "hidden": True,
                "limit_ms": 1000,
            },
        ],
    },
    {
        "id": "valid-parentheses",
        "title": "Valid Parentheses",
        "difficulty": "easy",
        "topic": "Stacks",
        "function": "is_valid",
        "starter": "def is_valid(s):\n    # return True if every bracket is closed in the right order\n    pass\n",
        "statement": (
            "Given a string s made of the characters ( ) [ ] { }, return True if it is valid: every opening "
            "bracket is closed by the same type of bracket, and brackets close in the right order. "
            "An empty string is valid."
        ),
        "examples": [
            {"input": 's = "()[]{}"', "output": "True"},
            {"input": 's = "(]"', "output": "False"},
        ],
        "compare": "exact",
        "best": "O(n) time with a stack",
        "tests": [
            {"name": "example 1", "args": ["()"], "expected": True},
            {"name": "example 2", "args": ["()[]{}"], "expected": True},
            {"name": "example 3", "args": ["(]"], "expected": False},
            {"name": "wrong order", "args": ["([)]"], "expected": False, "hidden": True},
            {"name": "nested", "args": ["{[]}"], "expected": True, "hidden": True},
            {"name": "empty string", "args": [""], "expected": True, "hidden": True},
            {"name": "never closed", "args": ["(("], "expected": False, "hidden": True},
            {"name": "closes first", "args": ["]"], "expected": False, "hidden": True},
            {
                "name": "big input (140,000 brackets)",
                "args_code": '["([{}])" * 20000]',
                "expected": True,
                "hidden": True,
                "limit_ms": 1000,
            },
        ],
    },
    {
        "id": "max-subarray",
        "title": "Maximum Subarray",
        "difficulty": "medium",
        "topic": "Dynamic programming",
        "function": "max_subarray",
        "starter": "def max_subarray(nums):\n    # return the largest sum of a non-empty contiguous part of nums\n    pass\n",
        "statement": (
            "Given a non-empty list of integers nums, find the contiguous part of the list (at least one number) "
            "with the largest sum, and return that sum."
        ),
        "examples": [
            {"input": "nums = [-2, 1, -3, 4, -1, 2, 1, -5, 4]", "output": "6  (the part [4, -1, 2, 1])"},
            {"input": "nums = [5, 4, -1, 7, 8]", "output": "23"},
        ],
        "compare": "exact",
        "best": "O(n) time and O(1) space (Kadane's algorithm)",
        "tests": [
            {"name": "example 1", "args": [[-2, 1, -3, 4, -1, 2, 1, -5, 4]], "expected": 6},
            {"name": "one number", "args": [[1]], "expected": 1},
            {"name": "example 2", "args": [[5, 4, -1, 7, 8]], "expected": 23},
            {"name": "all negative", "args": [[-3, -1, -2]], "expected": -1, "hidden": True},
            {"name": "all zero", "args": [[0, 0, 0]], "expected": 0, "hidden": True},
            {
                "name": "big input (100,000 numbers)",
                "args_code": "[[(-1) ** i * i for i in range(100000)]]",
                "expected": 99998,
                "hidden": True,
                "limit_ms": 1000,
            },
        ],
    },
    {
        "id": "merge-intervals",
        "title": "Merge Intervals",
        "difficulty": "medium",
        "topic": "Sorting",
        "function": "merge",
        "starter": "def merge(intervals):\n    # return the merged intervals, sorted by start\n    pass\n",
        "statement": (
            "Given a list of intervals, where each interval is [start, end], merge all overlapping intervals and "
            "return the result sorted by start. Intervals that touch, like [1, 4] and [4, 5], also merge."
        ),
        "examples": [
            {"input": "intervals = [[1, 3], [2, 6], [8, 10], [15, 18]]", "output": "[[1, 6], [8, 10], [15, 18]]"},
            {"input": "intervals = [[1, 4], [4, 5]]", "output": "[[1, 5]]"},
        ],
        "compare": "exact",
        "best": "O(n log n) time: sort by start, then one pass",
        "tests": [
            {"name": "example 1", "args": [[[1, 3], [2, 6], [8, 10], [15, 18]]], "expected": [[1, 6], [8, 10], [15, 18]]},
            {"name": "touching", "args": [[[1, 4], [4, 5]]], "expected": [[1, 5]]},
            {"name": "not sorted", "args": [[[1, 4], [0, 4]]], "expected": [[0, 4]], "hidden": True},
            {"name": "inside another", "args": [[[1, 4], [2, 3]]], "expected": [[1, 4]], "hidden": True},
            {"name": "empty list", "args": [[]], "expected": [], "hidden": True},
            {
                "name": "big input (100,000 intervals)",
                "args_code": "[[[i, i + 2] for i in range(0, 200000, 2)]]",
                "expected": [[0, 200000]],
                "hidden": True,
                "limit_ms": 1500,
            },
        ],
    },
    {
        "id": "longest-unique-substring",
        "title": "Longest Substring Without Repeats",
        "difficulty": "medium",
        "topic": "Sliding window",
        "function": "longest_unique",
        "starter": "def longest_unique(s):\n    # return the length of the longest substring with no repeated character\n    pass\n",
        "statement": (
            "Given a string s, return the length of the longest substring (a contiguous part) in which "
            "no character appears twice."
        ),
        "examples": [
            {"input": 's = "abcabcbb"', "output": '3  ("abc")'},
            {"input": 's = "pwwkew"', "output": '3  ("wke")'},
        ],
        "compare": "exact",
        "best": "O(n) time with a sliding window and a set or map",
        "tests": [
            {"name": "example 1", "args": ["abcabcbb"], "expected": 3},
            {"name": "all the same", "args": ["bbbbb"], "expected": 1},
            {"name": "example 2", "args": ["pwwkew"], "expected": 3},
            {"name": "empty string", "args": [""], "expected": 0, "hidden": True},
            {"name": "one space", "args": [" "], "expected": 1, "hidden": True},
            {"name": "repeat in the middle", "args": ["dvdf"], "expected": 3, "hidden": True},
            {"name": "mirror", "args": ["abba"], "expected": 2, "hidden": True},
            {
                "name": "big input (104,000 letters)",
                "args_code": '["abcdefghijklmnopqrstuvwxyz" * 4000]',
                "expected": 26,
                "hidden": True,
                "limit_ms": 1000,
            },
        ],
    },
    {
        "id": "top-k-frequent",
        "title": "Top K Frequent Numbers",
        "difficulty": "medium",
        "topic": "Heaps and counting",
        "function": "top_k_frequent",
        "starter": "def top_k_frequent(nums, k):\n    # return the k numbers that appear most often, in any order\n    pass\n",
        "statement": (
            "Given a list of integers nums and an integer k, return the k numbers that appear most often. "
            "The answer is unique, and you may return it in any order."
        ),
        "examples": [
            {"input": "nums = [1, 1, 1, 2, 2, 3], k = 2", "output": "[1, 2]"},
            {"input": "nums = [1], k = 1", "output": "[1]"},
        ],
        "compare": "any_order",
        "best": "O(n log k) with a counter and a heap, or O(n) with buckets",
        "tests": [
            {"name": "example 1", "args": [[1, 1, 1, 2, 2, 3], 2], "expected": [1, 2]},
            {"name": "one number", "args": [[1], 1], "expected": [1]},
            {"name": "unsorted input", "args": [[4, 4, 4, 5, 5, 6, 6, 6, 6], 2], "expected": [6, 4], "hidden": True},
            {"name": "negative numbers", "args": [[-1, -1, 2], 1], "expected": [-1], "hidden": True},
            {
                "name": "big input (200,080 numbers)",
                "args_code": "[[i % 1000 for i in range(200000)] + [7] * 50 + [3] * 30, 2]",
                "expected": [7, 3],
                "hidden": True,
                "limit_ms": 1500,
            },
        ],
    },
    {
        "id": "number-of-islands",
        "title": "Number of Islands",
        "difficulty": "medium",
        "topic": "Graphs (BFS / DFS)",
        "function": "num_islands",
        "starter": "def num_islands(grid):\n    # grid is a list of rows; each cell is \"1\" (land) or \"0\" (water)\n    pass\n",
        "statement": (
            "Given a grid of \"1\" (land) and \"0\" (water), return the number of islands. An island is land "
            "connected up, down, left or right (not diagonally) and surrounded by water."
        ),
        "examples": [
            {
                "input": 'grid = [["1","1","0","0","0"], ["1","1","0","0","0"], ["0","0","1","0","0"], ["0","0","0","1","1"]]',
                "output": "3",
            },
        ],
        "compare": "exact",
        "best": "O(rows x cols) time: visit every cell once with BFS or DFS",
        "tests": [
            {
                "name": "example 1",
                "args": [[["1", "1", "0", "0", "0"], ["1", "1", "0", "0", "0"], ["0", "0", "1", "0", "0"], ["0", "0", "0", "1", "1"]]],
                "expected": 3,
            },
            {"name": "one ring", "args": [[["1", "1", "1"], ["0", "1", "0"], ["1", "1", "1"]]], "expected": 1},
            {"name": "only water", "args": [[["0"]]], "expected": 0, "hidden": True},
            {"name": "one cell of land", "args": [[["1"]]], "expected": 1, "hidden": True},
            {"name": "one row", "args": [[["1", "0", "1", "0", "1"]]], "expected": 3, "hidden": True},
            {
                "name": "big input (200 x 200 grid)",
                "args_code": '[[["1" if (r // 2 + c // 2) % 2 == 0 else "0" for c in range(200)] for r in range(200)]]',
                "expected": 5000,
                "hidden": True,
                "limit_ms": 2000,
            },
        ],
    },
    {
        "id": "coin-change",
        "title": "Coin Change",
        "difficulty": "medium",
        "topic": "Dynamic programming",
        "function": "coin_change",
        "starter": "def coin_change(coins, amount):\n    # return the fewest coins that make amount, or -1 if it cannot be made\n    pass\n",
        "statement": (
            "Given a list of coin values and an amount, return the fewest coins needed to make that amount. "
            "You have as many of each coin as you like. If the amount cannot be made, return -1."
        ),
        "examples": [
            {"input": "coins = [1, 2, 5], amount = 11", "output": "3  (5 + 5 + 1)"},
            {"input": "coins = [2], amount = 3", "output": "-1"},
        ],
        "compare": "exact",
        "best": "O(amount x number of coins) time with dynamic programming",
        "tests": [
            {"name": "example 1", "args": [[1, 2, 5], 11], "expected": 3},
            {"name": "impossible", "args": [[2], 3], "expected": -1},
            {"name": "amount zero", "args": [[1], 0], "expected": 0},
            {"name": "greedy fails", "args": [[2, 5, 10, 1], 27], "expected": 4, "hidden": True},
            {"name": "bigger coins", "args": [[186, 419, 83, 408], 6249], "expected": 20, "hidden": True},
            {
                "name": "big input (amount 10,000)",
                "args_code": "[[1, 7, 13, 29, 53], 10000]",
                "expected": 190,
                "hidden": True,
                "limit_ms": 2000,
            },
        ],
    },
]

DIFFICULTIES = ["easy", "medium"]


def find_problem(problem_id):
    """The problem with this id, or None."""
    for problem in PROBLEMS:
        if problem["id"] == problem_id:
            return problem
    return None
