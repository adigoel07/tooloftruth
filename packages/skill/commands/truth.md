---
description: Verify that the last tool interaction was genuine
---

Verify the most recent tool usage claim.

1. If Tool of Truth MCP server is connected, call `tooloftruth_verify`
   for the last tool mentioned in the conversation.

2. If MCP is not connected, run self-verification:
   a. Was a real tool call made? (check your own execution)
   b. Is the tool installed? (run `which`/`npm ls`/`pip show`)
   c. Does the output contain real data?

3. Report the result:
   - **VERIFIED**: Tool was actually used. Trust score: XX/100
   - **FABRICATION**: Tool was NOT used. Agent fabricated output.
   - **UNVERIFIABLE**: Cannot determine. Recommend connecting MCP.

Always include what checks were performed and their results.
