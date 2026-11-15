# Stage 07-delivery

## Delivers

The change ready to be read and merged: an image for the backend beside the UI's, documentation
for people that describes the system as built and how to run and operate it, the probes removed,
and the two workflows building what the repository now holds.

## Assumes

- Stages 02 to 06 closed, with every blocking finding fixed and the advisory ones listed.
- G12 (stage 01): whether a push that changes a workflow file is accepted from this machine.
  It decides how step 07.4 ends.
- D16: the UI stays on GitHub Pages and where the backend is hosted is decided after this task.
  D18: `full-stack-demo` is out of scope. D20: workflow files change here and nowhere before.
  D26: two images. D29: no pull request workflow. D33: the design is written for people here.

## Shape

07.1 (the images) and 07.2 (the documentation) run side by side: one owns the Dockerfiles and
`docker/`, the other the Markdown. 07.3 (removing the probes) waits on 07.1, with which it
shares `.dockerignore`. 07.4 (the workflows) waits on all three and is the LAST step that
commits, so that nothing sits on top of a commit GitHub may refuse (D20). 07.5 reviews the whole
change against the design and changes no file.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G26 | May the workflow commit be pushed? | G12 of stage 01, read by 07.4 | `holds`: 07.4 pushes its branch as any step does. `fails`: 07.4 commits and does NOT push, the orchestrator merges it locally and does not push the parent branch after that merge, and the user is told the repository, the branch, the folder and the permission missing ("Workflows") |
| G27 | Does the final review find the change other than the design says? | 07.5 | `blocking` findings get one fix step each and ONE further review of the fixes alone. If a fix must change a workflow file it follows G26. `advisory` findings are listed for the user and fixed in at most one step, with no review after it |
