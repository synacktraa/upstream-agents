# Codex rules to prevent dangerous git operations
# These rules block commands that rewrite history, push, or manipulate branches
#
# Note: git checkout and git switch are blocked entirely.
# The system prompt tells agents to use "git restore" for file operations.

# Block git commit --amend (history rewriting)
prefix_rule(
    pattern=["git", "commit", "--amend"],
    decision="forbidden",
    justification="git commit --amend rewrites history. Create a new commit instead.",
)

prefix_rule(
    pattern=["git", "commit", "-a", "--amend"],
    decision="forbidden",
    justification="git commit --amend rewrites history. Create a new commit instead.",
)

# Block git rebase (history rewriting)
prefix_rule(
    pattern=["git", "rebase"],
    decision="forbidden",
    justification="git rebase rewrites history and is not allowed.",
)

# Block git reset --hard (history rewriting)
prefix_rule(
    pattern=["git", "reset", "--hard"],
    decision="forbidden",
    justification="git reset --hard rewrites history and is not allowed.",
)

# Block git push (handled automatically)
prefix_rule(
    pattern=["git", "push"],
    decision="forbidden",
    justification="git push is not allowed. Pushing is handled automatically.",
)

# Block git branch -d/-D (branch deletion)
prefix_rule(
    pattern=["git", "branch", "-d"],
    decision="forbidden",
    justification="Deleting branches is not allowed.",
)

prefix_rule(
    pattern=["git", "branch", "-D"],
    decision="forbidden",
    justification="Deleting branches is not allowed.",
)

# Block git branch -m/-M (branch renaming)
prefix_rule(
    pattern=["git", "branch", "-m"],
    decision="forbidden",
    justification="Renaming branches is not allowed.",
)

prefix_rule(
    pattern=["git", "branch", "-M"],
    decision="forbidden",
    justification="Renaming branches is not allowed.",
)

# Block git checkout entirely (use "git restore" for file operations)
prefix_rule(
    pattern=["git", "checkout"],
    decision="forbidden",
    justification="git checkout is not allowed. Use 'git restore' to discard file changes.",
)

# Block git switch entirely
prefix_rule(
    pattern=["git", "switch"],
    decision="forbidden",
    justification="Switching branches is not allowed. Stay on the current branch.",
)
