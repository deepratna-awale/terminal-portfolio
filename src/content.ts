// Static portfolio content. Projects come live from GitHub via /api/projects.

export const profile = {
  name: 'Deepratna Awale',
  handle: 'deepratna',
  host: 'deepratna-awale.dev',
  title: 'Senior Software Engineer @ Nasdaq',
  location: "St. John's, NL, Canada",
  email: 'awale.deep@gmail.com',
  github: 'https://github.com/deepratna-awale',
  linkedin: 'https://www.linkedin.com/in/deepratna-awale',
  website: 'https://deepratna-awale.dev',
  source: 'https://github.com/deepratna-awale/terminal-portfolio',
  product: 'https://verafin.com/product/agentic-ai-workforce/',
  resume: '/media/Resume-Awale-Deepratna.pdf',
}

export const sections: Record<string, string[]> = {
  about: [
    `# ${profile.name}`,
    '',
    `**${profile.title}** building production agentic AI that helps bank BSA analysts spend their time on real fraud and money laundering, not noise.`,
    '',
    'I like turning research-grade models into reliable, fast, observable systems: data pipelines, prompt engineering, evaluation, and the cloud infrastructure that lets other engineers ship agents safely.',
    '',
    '**Certification:** AWS Certified Machine Learning Engineer, Associate',
    '**Education:** MASc Computer Engineering, Memorial University of Newfoundland',
    '',
    'Try [`projects`](cmd:projects), [`experience`](cmd:experience), or just ask me something in plain English.',
  ],
  experience: [
    '## Senior Software Engineer',
    `**Nasdaq** (Verafin) [May 2026 to Present] | ${profile.location}`,
    `Product: [Verafin Agentic AI Workforce](${profile.product})`,
    '',
    '- Building an end to end, production ready agent creation pipeline and process: data preprocessing, prompt engineering, and infrastructure that lets other developers easily deploy agents with tools and skills.',
    '- Optimized an agent to increase specificity and recall while cutting its response time in half.',
    '- Developing agents on AWS Bedrock AgentCore that autonomously work BSA/AML cases and recommend Acknowledge or Investigate dispositions, cutting false positives so analysts spend their attention on real fraud.',
    '',
    '## Generative AI Associate',
    '**Innodata Inc.** [August 2025 to May 2026] | Toronto, ON',
    '',
    '- Evaluated and rated AI model outputs for quality, relevance, and accuracy for Meta.',
    '- Contributed to open-source tooling like Redlite for toxicity testing and benchmark metrics.',
    '- Supported dataset development through data collection and augmentation to reduce overfitting.',
    '',
    '## Generative AI Engineer',
    '**Tapestry Video AI** [Oct 2024 to Dec 2024] | Mountain View, CA',
    '',
    '- Optimized ComfyUI inpainting workflows for TikTok style video by 40%.',
    '- Fine-tuned open-source diffusion models on UGC data; built LangChain agents for Shopify product analysis.',
    '',
    '## Machine Learning Engineer',
    '**Axiom Softech** [Oct 2021 to Sep 2022] | Nagpur, India',
    '',
    '- Cut ETL time 35% with PySpark over 4M+ records; deployed AI on AWS (EMR, Kinesis, Lambda, SageMaker).',
    '',
    'Earlier: Team Lead at IIT Bombay (Udaan OCR correction tool), Junior Data Analyst at Axiom Softech.',
  ],
  skills: [
    '**Agentic AI**     Bedrock AgentCore  LangChain  prompt engineering  evals  RAG',
    '**ML / DL**        PyTorch  TensorFlow  scikit-learn  OpenCV  diffusion models',
    '**Cloud / Infra**  AWS  Terraform  Docker  CI/CD  Lightsail  SageMaker',
    '**Data**           PySpark  pandas  ETL pipelines  Neo4j  SQL',
    '**Languages**      Python  TypeScript  Java  C++  SQL',
  ],
  publications: [
    '## Semantic Analysis of Long Answers',
    'IRJCS, 2021. Evaluates long-form exam answers by encoding sentences with a Deep Averaging Network and comparing them to an answer key.',
    '[academia.edu](https://www.academia.edu/48840919/SEMANTIC_ANALYSIS_OF_LONG_ANSWERS)  [ResearchGate](https://www.researchgate.net/publication/358861646_SEMANTIC_ANALYSIS_OF_LONG_ANSWERS)',
    '',
    '## Theoretical Answer Evaluation System [T.A.E.S]',
    'IJSRP, 2022. NLP system for automated scoring of theory answers with plagiarism detection and grammar penalties.',
    '[academia.edu](https://www.academia.edu/81925526/Theoretical_Answer_Evaluation_System_T_A_E_S_)',
  ],
  contact: [
    `email     [${profile.email}](mailto:${profile.email})`,
    `linkedin  [linkedin.com/in/deepratna-awale](${profile.linkedin})`,
    `github    [github.com/deepratna-awale](${profile.github})`,
    `web       [deepratna-awale.dev](${profile.website})`,
    '',
    'Email is the fastest route. Run [`email`](cmd:email) to open your mail client, or [`resume`](cmd:resume) for the PDF.',
  ],
  education: [
    '**MASc, Computer Engineering**  Memorial University of Newfoundland, 2024',
    '  Thesis work: hybrid CNN + MLP to estimate ocean wave height from Wamos II radar images.',
    '**BEng, Information Technology**  RGCER, Nagpur, 2021',
    '',
    'Certifications',
    '  AWS Certified Machine Learning Engineer, Associate (2025)',
    '  IBM Data Science Professional Specialization (2019)',
    '  IIT Madras Programming and DSA Using Python (2019)',
  ],
}

export const mediaFiles: Record<string, { src: string; alt: string }> = {
  'profile.svg': { src: '/media/profile.svg', alt: 'Abstract profile illustration for Deepratna Awale' },
  'architecture.svg': { src: '/media/architecture.svg', alt: 'Architecture diagram of this portfolio: browser, Lightsail container, Bedrock and GitHub' },
}

export const asciiLogo = `██████╗ ███████╗███████╗██████╗ ██████╗  █████╗ ████████╗███╗   ██╗ █████╗
██╔══██╗██╔════╝██╔════╝██╔══██╗██╔══██╗██╔══██╗╚══██╔══╝████╗  ██║██╔══██╗
██║  ██║█████╗  █████╗  ██████╔╝██████╔╝███████║   ██║   ██╔██╗ ██║███████║
██║  ██║██╔══╝  ██╔══╝  ██╔═══╝ ██╔══██╗██╔══██║   ██║   ██║╚██╗██║██╔══██║
██████╔╝███████╗███████╗██║     ██║  ██║██║  ██║   ██║   ██║ ╚████║██║  ██║
╚═════╝ ╚══════╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝`
