#!/bin/bash
# Hook to prevent git commit --amend operations
# This hook is triggered before any Bash command executes

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

# Check for git commit --amend at the START of a command or after && or ;
# This prevents false positives from commit messages or heredocs that mention --amend
# Patterns matched:
#   - git commit --amend
#   - git commit -a --amend
#   - git commit --amend -m "msg"
#   - cd foo && git commit --amend
#   - something; git commit --amend
if echo "$COMMAND" | grep -qE '(^|&&|;)\s*git\s+commit\s+(--amend|[^|;]*\s--amend)'; then
  echo "Blocked: git commit --amend is not allowed. Please create a new commit instead." >&2
  exit 2
fi

exit 0
