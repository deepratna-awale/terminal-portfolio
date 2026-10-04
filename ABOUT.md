---
# Everything on the site comes from this file. Edit it, push, done.
# Frontmatter is simple YAML: key: value, lists (- item), maps (key: value
# indented under a parent) and | for multi-line text. See README, "Make it yours".

name: Deepratna Awale
short_name: Deep
handle: deepratna
initials: DA
title: Senior Software Engineer @ Nasdaq
tagline: Building agentic AI for fraud & AML
location: St. John's, NL, Canada
email: awale.deep@gmail.com
domain: deepratna-awale.dev
# Host name of the SSH edition (terraform ssh_enabled). Leave out if you don't run it.
ssh: ssh.deepratna-awale.dev
github: deepratna-awale
linkedin: deepratna-awale
source: https://github.com/deepratna-awale/terminal-portfolio
resume: /media/Resume-Awale-Deepratna.pdf

# Page metadata for search engines and link previews.
seo:
  description: SSH into the terminal portfolio of Deepratna Awale, Senior Software Engineer at Nasdaq building agentic AI for fraud and AML on AWS.
  share_description: A terminal you can SSH into: projects, experience, research, and an AI assistant that answers questions about my work.
  gui_description: Deepratna Awale, Senior Software Engineer at Nasdaq (Verafin) building agentic AI for fraud and AML on AWS. Experience, projects, research and contact.

# The fake operating system the terminal boots into.
os: DeepOS
os_version: 26.10 LTS

# Extra lines in the login banner, after the title.
motd:
  - Building agentic AI for fraud and AML at Verafin

# neofetch rows after the built-in OS, host, kernel, uptime, shell and theme.
neofetch:
  Role: Senior Software Engineer @ Nasdaq
  Focus: Agentic AI for fraud & AML
  Location: St. John's, NL, Canada
  Cert: AWS ML Engineer, Associate

# Shown by `help` as an example of a question for the assistant.
example_question: what are you working on at Nasdaq?

# Links, icons and shortcuts. Each entry appears wherever `show` lists:
#   dock     the dock at the bottom of the desktop
#   desktop  an icon on the desktop
#   newtab   a shortcut tile on the in-site Chrome's new tab page
# Every entry with an `id` is also a terminal `open <id>` target.
# icon: an image in public/icons/ (or a path starting with /), or short text
#   such as CV for a lettered tile, coloured with `color`.
# tile: true puts the icon on a white dock tile (for logos with transparency).
# Site links (/gui, /media/...) open in the in-site Chrome; others in a new tab.
links:
  - name: Portfolio
    url: /gui
    icon: chrome.svg
    show: [desktop]
  - name: Portfolio
    url: /gui
    icon: /favicon.svg
    show: [newtab]
  - id: github
    name: GitHub
    url: https://github.com/deepratna-awale
    icon: github.svg
    tile: true
    show: [dock, newtab]
  - id: linkedin
    name: LinkedIn
    url: https://www.linkedin.com/in/deepratna-awale
    icon: linkedin.png
    show: [dock, newtab]
  - id: email
    name: Email
    url: mailto:awale.deep@gmail.com
    icon: gmail.svg
    tile: true
    show: [dock]
  - id: resume
    name: Resume
    url: /media/Resume-Awale-Deepratna.pdf
    icon: CV
    color: "#d93025"
    show: [newtab]
  - id: source
    name: Source code
    url: https://github.com/deepratna-awale/terminal-portfolio
    icon: </>
    color: "#188038"
    show: [newtab]
  - id: verafin
    name: Verafin
    url: https://verafin.com/product/agentic-ai-workforce/

# Standard site (/gui) extras.
focus_dirs: [agentic-ai, evals, aws, ml-infra]
contact_heading: Let's build something reliable.
contact_note: Email is the fastest way to reach me.

# GitHub repositories shown under Projects, in order. Each needs a share image
# at public/media/projects/<name>.jpg (the repository's social preview).
featured:
  - open-wallpaper-engine-mac
  - AutoExpress
  - 3t-chatbot
  - sd-parsers
  - TAES2
  - Polar-Image-Inspector

# Files in public/media/ that `view` can show, with their alt text.
media:
  profile.svg: Abstract profile illustration for Deepratna Awale
  architecture.svg: Architecture diagram of this portfolio: browser, Lightsail container, Bedrock and GitHub

ascii_logo: |
  ██████╗ ███████╗███████╗██████╗ ██████╗  █████╗ ████████╗███╗   ██╗ █████╗
  ██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝████╗  ██║██╔══██╗
  ██║  ██║█████╗  █████╗  ██████╔╝██████╔╝███████║   ██║   ██╔██╗ ██║███████║
  ██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██╔══██╗██╔══██║   ██║   ██║╚██╗██║██╔══██║
  ██████╔╝███████╗███████╗██║     ██║  ██║██║  ██║   ██║   ██║ ╚████║██║  ██║
  ╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝
---

# About
<!-- help: who I am -->

**Senior Software Engineer @ Nasdaq** building production agentic AI that helps bank BSA analysts spend their time on real fraud and money laundering, not noise.

I like turning research-grade models into reliable, fast, observable systems: data pipelines, prompt engineering, evaluation, and the cloud infrastructure that lets other engineers ship agents safely.

**Certification:** [AWS Certified Machine Learning Engineer, Associate](https://www.credly.com/badges/6fd9a8eb-59ac-4c84-82d1-410b573d7611)
**Education:** MASc Computer Engineering, Memorial University of Newfoundland

Try [`projects`](cmd:projects), [`experience`](cmd:experience), or just ask me something in plain English.

# Experience
<!-- help: work history, including Nasdaq -->

## Senior Software Engineer
**Nasdaq** (Verafin) [May 2026 to Present] | St. John's, NL, Canada

- Building the end-to-end agent pipeline (data, prompts, infra) for Agentic AI Workforce.
- Developing Bedrock AgentCore agents that autonomously work BSA/AML cases.
- Agents recommend Acknowledge or Investigate, cutting false positives for analysts.
- Optimized an agent for higher specificity and recall at half the response time.

## Generative AI Associate
**Innodata Inc.** [August 2025 to May 2026] | Toronto, ON

- Evaluated and rated AI model outputs for quality, relevance and accuracy for Meta.
- Contributed to open-source tooling like Redlite for toxicity testing and benchmarks.
- Supported dataset collection and augmentation to reduce model overfitting.

# Projects
<!-- help: live from my public GitHub -->

Pulled live from GitHub. Each card links to the code and, where there is one, a live demo.

# Skills
<!-- help: tools and stacks -->

**Agentic AI**     Bedrock AgentCore  LangChain  prompt engineering  evals  RAG
**ML / DL**        PyTorch  TensorFlow  scikit-learn  OpenCV  diffusion models
**Cloud / Infra**  AWS  Terraform  Docker  CI/CD  Lightsail  SageMaker
**Data**           PySpark  pandas  ETL pipelines  Neo4j  SQL
**Languages**      Python  TypeScript  Java  C++  SQL

# Publications
<!-- nav: Research | help: research papers -->

## Semantic Analysis of Long Answers
IRJCS, 2021. Evaluates long-form exam answers by encoding sentences with a Deep Averaging Network and comparing them to an answer key.
[academia.edu](https://www.academia.edu/48840919/SEMANTIC_ANALYSIS_OF_LONG_ANSWERS)  [ResearchGate](https://www.researchgate.net/publication/358861646_SEMANTIC_ANALYSIS_OF_LONG_ANSWERS)

## Theoretical Answer Evaluation System [T.A.E.S]
IJSRP, 2022. NLP system for automated scoring of theory answers with plagiarism detection and grammar penalties.
[academia.edu](https://www.academia.edu/81925526/Theoretical_Answer_Evaluation_System_T_A_E_S_)

# Education & certifications
<!-- command: education | nav: Education | help: degrees and certifications -->

**MASc, Computer Engineering**  Memorial University of Newfoundland, 2024
  Capstone Project: Hybrid CNN + MLP to estimate ocean wave height from WaMoS II radar images.
**BEng, Information Technology**  RGCER, Nagpur, 2021
  Thesis: [Theoretical Answer Evaluation System (T.A.E.S)](https://github.com/deepratna-awale/TAES2), automated scoring of theory answers.

Certifications
  [AWS Certified Machine Learning Engineer, Associate](https://www.credly.com/badges/6fd9a8eb-59ac-4c84-82d1-410b573d7611) (2025)
  [IBM Data Science Professional Specialization](https://www.credly.com/badges/a3630bd3-b2cd-4e08-b5cb-bd8701a9792f) (2019)
  [IIT Madras Programming and DSA Using Python](https://nptel.ac.in/noc/E_Certificate/noc19-cs08/NPTEL19CS08S11620060191025941.jpg) (2019)

# Now
<!-- help: what I'm up to right now -->

Updated: October 2026

- Building agents on AWS Bedrock AgentCore at Nasdaq (Verafin) that work BSA/AML cases and cut false positives.
- Building the pipeline that lets other engineers ship agents with tools and skills safely.
- Running this portfolio in the open: Terraform, Lightsail and Bedrock. Source: [GitHub](https://github.com/deepratna-awale/terminal-portfolio).

# Guestbook
<!-- help: read or sign the guestbook -->

# Contact
<!-- help: ways to reach me -->

email     [awale.deep@gmail.com](mailto:awale.deep@gmail.com)
linkedin  [linkedin.com/in/deepratna-awale](https://www.linkedin.com/in/deepratna-awale)
github    [github.com/deepratna-awale](https://github.com/deepratna-awale)
web       [deepratna-awale.dev](https://deepratna-awale.dev)
ssh       `ssh ssh.deepratna-awale.dev`

Email is the fastest route. Run [`email`](cmd:email) to open your mail client, or [`resume`](cmd:resume) for the PDF.

# Assistant
<!-- Never shown on the site. Extra rules and facts for the AI assistant, on top of every section above. -->

## Rules
- Work experience: only discuss Deep's Canadian roles, Nasdaq (Verafin) and Innodata. If asked about other or earlier employers, say this portfolio covers his Canadian experience and point to `resume` or LinkedIn, without naming or describing other roles.
- Never discuss confidential Nasdaq or Verafin matters such as detection rules, thresholds, customers or how to evade AML controls. Only describe the public product.

## More about Deep
Deepratna Awale goes by Deep.

Verafin's Agentic AI Workforce (https://verafin.com/product/agentic-ai-workforce/): the agents Deep builds autonomously work BSA/AML cases and recommend Acknowledge or Investigate dispositions, reducing false positives that should have been acknowledged and surfacing cases that should definitely be investigated, so bank BSA analysts focus on real fraud.

Notable side projects: AutoExpress (Stable Diffusion character expressions, 28 expressions with YOLOv8-guided inpainting), sd-parsers (TypeScript npm package to read AI image generation metadata), 3T Chat (Next.js personal LLM chat), a fraud detection pipeline (PySpark + Neo4j graph features, 89% precision / 84% recall on synthetic data), Open Wallpaper Engine for macOS (actively maintained), AgentCore-TF (Terraform module for multi-agent A2A on Bedrock AgentCore).

Resume: /media/Resume-Awale-Deepratna.pdf (the `resume` command opens it).
Contact: email awale.deep@gmail.com, LinkedIn linkedin.com/in/deepratna-awale, GitHub github.com/deepratna-awale. Do not share a phone number.

This website: a terminal-style portfolio (React + Vite) served from a Node container on AWS Lightsail, provisioned with Terraform, deployed by GitHub Actions over OIDC. You are the assistant behind it, running on Amazon Bedrock.
