# Stage 07-delivery

## Delivers

The change ready to be read and merged: an image for the backend beside the UI's, documentation
for people that describes the system as built and how to run and operate it, and the list of
what is left for the user to do by hand.

## Assumes

- Stages 02 to 06 closed, with every blocking finding fixed and the advisory ones listed.
- D16: the UI stays on GitHub Pages and where the backend is hosted is decided after this task.
  D18: `full-stack-demo` is out of scope. D26: two images. D29: no pull request workflow.
  D33: the design is written for people here. D35: no file under `.github/workflows` is
  changed, and what the workflows need is listed for the user.

## Shape

07.1 (the images) and 07.2 (the documentation) run side by side: one owns the Dockerfiles and
`docker/`, the other the Markdown. 07.3 waits on both, reviews the whole change against the
design and changes no file.

## Gates

| Gate | Question | Answered by | Outcome and fallback |
| --- | --- | --- | --- |
| G27 | Does the final review find the change other than the design says? | 07.3 | `blocking` findings get one fix step each and ONE further review of the fixes alone. A fix never changes a workflow file (D35): what it would need joins the list below. `advisory` findings are listed for the user and fixed in at most one step, with no review after it |

## Left for the user

The orchestrator's closing report of this stage gives the user this list, corrected by what
step 07.3 reports against it. The stage check prints it. No step does any of it (D35).

- `.github/workflows/pages-deploy.yml`, job `build`: the site is built into `packages/ui/dist`.
  The copy of `index.html` to `404.html` and the path of the uploaded artifact, both `dist`
  today, become `packages/ui/dist`. Until then the first release tag after the merge fails to
  deploy the site.
- The same job: the build needs `VITE_EXPLORER_BACKEND_URL`, for example from a repository
  variable `EXPLORER_BACKEND_URL`. Built with the variable unset, the site says that no backend
  is configured (D30). Where the backend is hosted is not decided (D16).
- `.github/workflows/docker-publish.yml`: it publishes the UI's image from the root
  `Dockerfile`. The backend's image (D26) is built from `packages/backend/Dockerfile` with the
  repository root as its context, and is to be published as `ghcr.io/sig-net/explorer-backend`
  for `linux/amd64` and `linux/arm64` with the same tags.
- The two entries that go with `agent-work/` when the pull request opens: the `agent-work`
  line of `.dockerignore` with its comment, and `agent-work` in the `ignorePatterns` of
  `.oxfmtrc.json`.
