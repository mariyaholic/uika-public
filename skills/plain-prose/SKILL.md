---
name: plain-prose
description: Use whenever you write text a person will read — a chat reply, a report, documentation, a code comment, a commit message, a pull request body, an interface string, an error message, copy, narration, or a brief for another agent. Lists the ten prose patterns banned in every estate repo, with an example of each and the plain sentence to write in its place.
---

# Plain prose (ADR-0062)

Ten writing patterns are banned in every estate repo, across every harness and model, and for every kind of text: replies in a session, files in a repository, and text that ships in a product.

## The ten patterns

Each row quotes one example from the reference table, explains what the pattern does, and gives the replacement. The standard name for the pattern is in the last column so that reviews can cite it.

| Do not write | What the sentence does | Write this | Name |
|---|---|---|---|
| "It is not a wrong answer. It is a non-answer." | Denies a claim nobody made in order to stage the real claim as a reveal. | State the claim once: "The reply does not address the question that was asked." | Negation-first reveal |
| "It is the leg that answers the actual question." | Announces that something matters and omits what it is or why. | Give the content: "Leg 4 measures latency at the 8k context the question asked about." | Significance designation |
| "Median hides it." / "The table shows it." | Makes a statistic or a document the actor, with a vague object, so no measurement is stated. | Give the measurement: "The median is 41 ms in both runs. Row 6 of the table is 900 ms." | Abstraction agency |
| "Five of those six rows are one cluster. The sixth is not." | Holds back the identity of the thing so the reader waits for it. | Name it at first mention: "Rows 1 to 5 ran on GPU A. Row 6 ran on GPU B." | Deferred noun |
| Headers such as `What "exhausted" means` or `The one gap that does clear the bar` | Uses a header to tease or to argue. | Use a noun phrase that names the section's contents: `Definition of exhausted`, `Latency gap at 8k context`. | Coy or thesis-shaped header |
| "It is the kind of number that looks like evidence and is not." | Ends a paragraph on a quotable line that adds no fact. | End on the last fact or the next action. Delete the line. | Aphoristic closer |
| "'It thinks twice as long' is the obvious reading, and it is wrong." | Invents a mistaken reader and corrects them. | State the finding. Mention another reading only when a named person or document holds it, and cite it. | Straw-man knockdown |
| "Six legs. One GPU, one server build, one sampler, one question set." | Breaks one sentence into verbless fragments for rhythm. | Write the sentence: "All six legs ran on one GPU with the same server build, sampler and question set." | Fragment cadence |
| "That is information loss wearing the costume of a style fix." | Replaces the literal statement with a figure of speech. | Write the literal statement: "The change is described as a style fix, and it removes the per-row values." | Dressed metaphor |
| A coined label presented before, or in place of, the thing it labels. | Gives the reader a name to decode before any content. | Describe the thing first. Add a name only when you will use it again, and put it after the description. | Label-first framing |

## Where the ban applies

- Replies to the team, including progress notes and final reports.
- Files in a repository: documentation, ADRs, WORKSTACK and LEARNINGS entries, code comments, commit messages, pull request titles and bodies.
- Text in a product: interface strings, error messages, marketing copy, video narration and on-screen text, generated data that a person will read.
- Briefs and prompts written for other agents.

Quoting a pattern to identify it is allowed. Text you did not write (vendored skills, third-party documents) stays as it is unless requested otherwise.

## Check before you send or commit

Reread the text once with these questions.

1. Does any sentence say what something is not before saying what it is? Keep only the second half, restated as a full claim.
2. Does any sentence say that something is important, key, real or actual without stating the fact? Replace it with the fact.
3. Does every sentence that reports a result contain the number, file, row or name it is about?
4. Is every header a noun phrase that would make sense in a table of contents?
5. Does every paragraph end on a fact or an action?
6. Does every sentence have a subject and a verb? Lists, table cells and labels in an interface are exempt.
7. Is there a metaphor? Replace it with the literal statement.
8. Did you coin a name for something? Check that the description comes first and that the name is used again later.

A reviewing agent reports a banned pattern in a diff as a finding and cites the name from the table.

## Related skills

`skills/copy-craft` governs voice and whether a claim is supported. This skill governs sentence shape and applies whether or not the text is product copy.
