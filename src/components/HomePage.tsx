/**
 * HomePage — High-conversion landing page for VocalHireAI.
 *
 * Sections: Navbar, Hero, Trusted-by, Features, How-it-Works,
 * Stats, Testimonials, FAQ, Final CTA, Footer.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="lp">
      {/* ================= NAVBAR ================= */}
      <nav className="lp-nav">
        <div className="lp-nav__inner">
          <a href="#top" className="lp-nav__brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="lp-nav__logo">
              <BoltIcon />
            </div>
            <span className="lp-nav__name">VocalHireAI</span>
          </a>

          <div className="lp-nav__links">
            <a href="#features" className="lp-nav__link">Features</a>
            <a href="#how" className="lp-nav__link">How It Works</a>
            <a href="/pricing" className="lp-nav__link" onClick={(e) => { e.preventDefault(); navigate("/pricing"); }}>Pricing</a>
            <a href="#testimonials" className="lp-nav__link">Testimonials</a>
            <a href="#faq" className="lp-nav__link">FAQ</a>
          </div>

          <div className="lp-nav__actions">
            <button className="lp-nav__login" onClick={() => navigate("/login")}>Log In</button>
            <button className="lp-nav__cta" onClick={() => navigate("/signup")}>Get Started Free</button>
          </div>
        </div>
      </nav>

      {/* ================= HERO ================= */}
      <section className="lp-hero">
        <div className="lp-hero__orb lp-hero__orb--1" />
        <div className="lp-hero__orb lp-hero__orb--2" />
        <div className="lp-hero__orb lp-hero__orb--3" />

        <div className="lp-hero__badge">
          <SparkleIcon /> Every Interview Tailored to Your JD &amp; Resume
        </div>

        <h1 className="lp-hero__title">
          Ace It. Hire Smart.<br />
          <span className="lp-hero__gradient">AI That Interviews For You.</span>
        </h1>

        <p className="lp-hero__sub">
          Every interview is fully customized to the job description and the candidate's resume.
          AI asks personalized questions, evaluates in real-time, and delivers a 20-section report.
          41 pre-built job templates. Aptitude &amp; coding tests. Proctoring built-in.
          Candidates ace interviews. Recruiters hire excellent resources. Colleges place better.
        </p>

        <div className="lp-hero__btns">
          <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={() => navigate("/signup")}>
            Start Free <ArrowIcon />
          </button>
          <a href="#how" className="lp-btn lp-btn--ghost lp-btn--lg">
            See How It Works
          </a>
        </div>

        <p className="lp-hero__note">No credit card required. Set up in 30 seconds.</p>

        {/* Hero visual mockup */}
        <div className="lp-hero__visual">
          <div className="lp-hero__screen">
            <div className="lp-hero__screen-bar">
              <span className="lp-hero__dot" /><span className="lp-hero__dot" /><span className="lp-hero__dot" />
            </div>
            <div className="lp-hero__screen-body">
              <div className="lp-hero__mock-left">
                <div className="lp-hero__mock-orb">
                  <div className="lp-hero__mock-ring" />
                </div>
                <span className="lp-hero__mock-label">AI Interviewer</span>
              </div>
              <div className="lp-hero__mock-right">
                <div className="lp-hero__mock-cam" />
                <span className="lp-hero__mock-label">Candidate</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TRUSTED-BY TICKER ================= */}
      <section className="lp-trust">
        <p className="lp-trust__label">Trusted by professionals preparing for roles at</p>
        <div className="lp-trust__logos">
          {["Google", "Microsoft", "Amazon", "Meta", "Apple", "Netflix", "Stripe", "Salesforce"].map((c) => (
            <span key={c} className="lp-trust__logo">{c}</span>
          ))}
        </div>
      </section>

      {/* ================= FEATURES ================= */}
      <section className="lp-features" id="features">
        <div className="lp-section-header">
          <span className="lp-badge">Features</span>
          <h2 className="lp-section-title">Everything You Need to<br /><span className="lp-highlight">Ace Interviews &amp; Hire Excellent Resources</span></h2>
          <p className="lp-section-sub">One platform — JD-tailored video interviews, resume-based questions, aptitude tests, coding challenges, proctoring, and 20-section evaluation reports.</p>
        </div>

        <div className="lp-features__grid">
          <div className="lp-feature lp-feature--hero">
            <div className="lp-feature__icon lp-feature__icon--indigo"><VideoIcon /></div>
            <h3 className="lp-feature__title">JD + Resume Customized Interviews</h3>
            <p className="lp-feature__desc">
              Every interview is tailored to the job description and candidate's resume. The AI asks personalized questions, probes deeper on weak areas, and evaluates like a real panel.
              Up to 27 minutes with automatic wrap-up.
            </p>
            <ul className="lp-feature__tags">
              <li>JD-Tailored</li><li>Resume-Based</li><li>Live Voice &amp; Video</li>
            </ul>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--purple"><TemplateIcon /></div>
            <h3 className="lp-feature__title">41 Job Templates</h3>
            <p className="lp-feature__desc">
              Pre-built templates for Software, MBA, VLSI, and General roles. Each includes AI behavior rules and job descriptions.
              Or create your own custom template from scratch.
            </p>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--cyan"><ReportIcon /></div>
            <h3 className="lp-feature__title">20-Section Evaluation</h3>
            <p className="lp-feature__desc">
              AI-generated report covering communication, technical depth, problem-solving, cultural fit, and 16 more criteria — each scored 1-10 with actionable feedback.
            </p>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--red"><ShieldIcon /></div>
            <h3 className="lp-feature__title">AI Proctoring</h3>
            <p className="lp-feature__desc">
              Face detection, gaze tracking, and tab-switch monitoring run locally via MediaPipe.
              Risk scoring in real-time. Full privacy — nothing leaves the browser.
            </p>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--green"><BrainIcon /></div>
            <h3 className="lp-feature__title">Aptitude Tests</h3>
            <p className="lp-feature__desc">
              Generate MCQ quizzes on any topic with adjustable difficulty.
              Instant results, detailed explanations, and progress tracking over time.
            </p>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--amber"><CodeIcon /></div>
            <h3 className="lp-feature__title">Coding Challenges</h3>
            <p className="lp-feature__desc">
              AI-generated coding problems with a professional Monaco editor.
              Multi-language support, in-browser execution, and detailed scoring on correctness, efficiency &amp; style.
            </p>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--indigo"><ResumeIcon /></div>
            <h3 className="lp-feature__title">Resume-Based Questions</h3>
            <p className="lp-feature__desc">
              Paste your resume and the AI asks personalized questions based on your experience, skills, and projects — combined with the job description for maximum relevance.
            </p>
          </div>

          <div className="lp-feature">
            <div className="lp-feature__icon lp-feature__icon--cyan"><ChartIcon /></div>
            <h3 className="lp-feature__title">Dashboard &amp; Analytics</h3>
            <p className="lp-feature__desc">
              Track all interviews, aptitude scores, and coding results in one place.
              Role-based views for candidates, hiring managers, colleges, and admins.
            </p>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS ================= */}
      <section className="lp-how" id="how">
        <div className="lp-section-header">
          <span className="lp-badge">How It Works</span>
          <h2 className="lp-section-title">From JD + Resume to Report<br /><span className="lp-highlight">In Three Steps</span></h2>
        </div>

        <div className="lp-how__steps">
          <div className="lp-step">
            <div className="lp-step__num">1</div>
            <div className="lp-step__content">
              <h3 className="lp-step__title">Pick a Template &amp; Paste Resume</h3>
              <p className="lp-step__desc">
                Choose from 41 pre-built job templates or create custom. The AI interviewer behavior, job description, and your resume form the interview context.
              </p>
            </div>
          </div>
          <div className="lp-step__connector" />
          <div className="lp-step">
            <div className="lp-step__num">2</div>
            <div className="lp-step__content">
              <h3 className="lp-step__title">Live Video Interview</h3>
              <p className="lp-step__desc">
                The AI starts by introducing the role and asks tailored questions over up to 27 minutes. Your video is recorded locally. Proctoring runs in the background.
              </p>
            </div>
          </div>
          <div className="lp-step__connector" />
          <div className="lp-step">
            <div className="lp-step__num">3</div>
            <div className="lp-step__content">
              <h3 className="lp-step__title">Get Your 20-Section Report</h3>
              <p className="lp-step__desc">
                Receive a comprehensive evaluation with scores, strengths, improvements, risk flags, and a hire/no-hire recommendation. Download the video for self-review.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= STATS ================= */}
      <section className="lp-stats">
        <div className="lp-stats__grid">
          <div className="lp-stat">
            <span className="lp-stat__number">41</span>
            <span className="lp-stat__label">Job Templates</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__number">20</span>
            <span className="lp-stat__label">Evaluation Sections</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__number">3000+</span>
            <span className="lp-stat__label">Company Interview Asked Questions</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__number">100%</span>
            <span className="lp-stat__label">Privacy-First</span>
          </div>
        </div>
      </section>

      {/* ================= TESTIMONIALS ================= */}
      <section className="lp-testimonials" id="testimonials">
        <div className="lp-section-header">
          <span className="lp-badge">Testimonials</span>
          <h2 className="lp-section-title">Loved by Candidates &amp; Recruiters<br /><span className="lp-highlight">Worldwide</span></h2>
        </div>

        <div className="lp-testimonials__grid">
          {TESTIMONIALS.map((t, i) => (
            <div key={i} className="lp-testimonial">
              <div className="lp-testimonial__stars">{"★★★★★"}</div>
              <p className="lp-testimonial__text">{t.text}</p>
              <div className="lp-testimonial__author">
                <div className="lp-testimonial__avatar">{t.name.charAt(0)}</div>
                <div>
                  <p className="lp-testimonial__name">{t.name}</p>
                  <p className="lp-testimonial__role">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ================= FAQ ================= */}
      <section className="lp-faq" id="faq">
        <div className="lp-section-header">
          <span className="lp-badge">FAQ</span>
          <h2 className="lp-section-title">Got Questions?</h2>
        </div>

        <div className="lp-faq__list">
          {FAQS.map((f, i) => (
            <div key={i} className={`lp-faq__item ${openFaq === i ? "lp-faq__item--open" : ""}`}>
              <button className="lp-faq__q" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{f.q}</span>
                <span className="lp-faq__chevron">{openFaq === i ? "−" : "+"}</span>
              </button>
              {openFaq === i && <p className="lp-faq__a">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* ================= FINAL CTA ================= */}
      <section className="lp-cta-section">
        <div className="lp-cta-section__inner">
          <div className="lp-cta-section__orb" />
          <h2 className="lp-cta-section__title">
            Ready to Ace Your Interview &amp; Hire Smarter?
          </h2>
          <p className="lp-cta-section__sub">
            Candidates: practice with AI customized to your resume &amp; target JD. Recruiters: hire excellent resources with AI that asks the right questions. Start for free — no credit card, no limits.
          </p>
          <button className="lp-btn lp-btn--primary lp-btn--lg" onClick={() => navigate("/signup")}>
            Get Started Free <ArrowIcon />
          </button>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="lp-footer">
        <div className="lp-footer__inner">
          <a href="#top" className="lp-footer__brand" onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
            <div className="lp-nav__logo"><BoltIcon /></div>
            <span className="lp-nav__name">VocalHireAI</span>
          </a>
          <p className="lp-footer__copy">&copy; {new Date().getFullYear()} VocalHireAI. All rights reserved.</p>
          <div className="lp-footer__links">
            <button className="lp-footer__link" onClick={() => navigate("/login")}>Log In</button>
            <button className="lp-footer__link" onClick={() => navigate("/signup")}>Sign Up</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const TESTIMONIALS = [
  { name: "Priya Sharma", role: "Software Engineer at google", text: "VocalHireAI's video interviews feel incredibly real. The 20-section report pinpointed exactly where I needed to improve — I went from nervous to confident in two weeks." },
  { name: "Vikram Singh", role: "Product Manager at stripe", text: "The voice interaction is shockingly natural. The AI asks tough follow-ups based on my resume. My interview skills improved dramatically and I landed my dream PM role." },
  { name: "Aisha Patel", role: "Data Scientist at amazon", text: "The aptitude tests and coding challenges alone are worth it. I practiced 200+ questions and nailed my Amazon assessment. The evaluation reports are incredibly detailed." },
  { name: "Arjun Mehta", role: "Frontend Developer at meta", text: "I recorded every video interview and rewatched them. Seeing my body language improve session over session was incredibly motivating. Landed the offer on my third try." },
  { name: "Ananya Reddy", role: "UX Designer at apple", text: "What surprised me most was the AI's follow-up questions — they felt challenging and personalized to my resume. The proctoring gives it that real interview pressure too." },
  { name: "Dr. Ramesh Iyer", role: "Dean, state university", text: "We deployed VocalHireAI for 500+ students. The 41 templates across Software, MBA, and VLSI cover every department. The college admin dashboard makes tracking effortless." },
];

const FAQS = [
  { q: "What is VocalHireAI?", a: "VocalHireAI is an AI-powered video interview platform. Candidates have real-time voice conversations with an AI interviewer while being video-recorded. The AI asks personalized questions based on the job description and candidate's resume, then generates a comprehensive 20-section evaluation report." },
{ q: "How realistic are the AI interviews?", a: "Very. We use Gemini AI for real-time bidirectional voice conversations. The AI listens, understands context, asks follow-ups, and responds naturally. It asks questions over up to 27 minutes with automatic wrap-up — just like a real interview panel." },
  { q: "What job roles are supported?", a: "We have 41 pre-built templates covering Software Engineering (20 roles), MBA & Management (10 roles), VLSI & Semiconductor (5 roles), General positions (4 templates), and a fully customizable template. You can also create your own from scratch." },
  { q: "Is candidate video data private?", a: "Absolutely. Video recordings happen locally in your browser and are never uploaded to our servers. AI proctoring (face detection, gaze tracking) runs entirely in-browser using MediaPipe. We explicitly tell candidates at the end of each interview that we do not save their video." },
  { q: "Who is this for?", a: "VocalHireAI serves four roles: Candidates practicing for interviews, Hiring Managers screening applicants, College administrators running placement prep, and Admins managing the platform. Each role has a tailored dashboard and permissions." },
  { q: "What's included besides video interviews?", a: "Aptitude tests (AI-generated MCQs on any topic), coding challenges (Monaco editor with multi-language support), AI proctoring, 20-section evaluation reports, video recording & playback, resume-based personalized questions, and a full analytics dashboard." },
];

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function BoltIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg> ); }
function SparkleIcon() { return ( <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" /></svg> ); }
function ArrowIcon() { return ( <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg> ); }
function VideoIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" ry="2" /></svg> ); }
function ReportIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> ); }
function TemplateIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" /></svg> ); }
function BrainIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a4 4 0 0 0-4 4v1a4 4 0 0 0-4 4v1a4 4 0 0 0 4 4h1" /><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1 4 4v1a4 4 0 0 1-4 4h-1" /><path d="M12 22v-6" /><path d="M9 18h6" /></svg> ); }
function ChartIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg> ); }
function ShieldIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></svg> ); }
function CodeIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg> ); }
function ResumeIcon() { return ( <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="M12 11h4" /><path d="M12 16h4" /><path d="M8 11h.01" /><path d="M8 16h.01" /></svg> ); }