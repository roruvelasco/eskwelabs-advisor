import { randomUUID } from 'node:crypto';

import bcrypt from 'bcryptjs';
import postgres from 'postgres';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

const sql = postgres(databaseUrl, { max: 5 });

const ADMIN_EMAIL = 'admin@example.com';
const INTERN_EMAIL = 'intern@example.com';
const PASSWORD = 'password123';

const EIF_USERS: { email: string; fullName: string }[] = [
  { email: 'juan.delacruz@example.com', fullName: 'Juan dela Cruz' },
  { email: 'maria.santos@example.com', fullName: 'Maria Santos' },
  { email: 'pedro.reyes@example.com', fullName: 'Pedro Reyes' },
  { email: 'ana.garcia@example.com', fullName: 'Ana Garcia' },
  { email: 'carlos.tan@example.com', fullName: 'Carlos Tan' },
  { email: 'sofia.lim@example.com', fullName: 'Sofia Lim' },
  { email: 'miguel.fernandez@example.com', fullName: 'Miguel Fernandez' },
  { email: 'angela.villanueva@example.com', fullName: 'Angela Villanueva' },
  { email: 'rico.gonzales@example.com', fullName: 'Rico Gonzales' },
  { email: 'diana.mendoza@example.com', fullName: 'Diana Mendoza' },
  { email: 'paolo.aquino@example.com', fullName: 'Paolo Aquino' },
  { email: 'jasmine.cruz@example.com', fullName: 'Jasmine Cruz' },
  { email: 'victor.soriano@example.com', fullName: 'Victor Soriano' },
  { email: 'raquel.dimasac@example.com', fullName: 'Raquel Dimasac' },
  { email: 'mark.alvarez@example.com', fullName: 'Mark Alvarez' },
  { email: 'liza.bautista@example.com', fullName: 'Liza Bautista' },
  { email: 'daniel.martinez@example.com', fullName: 'Daniel Martinez' },
  { email: 'kayla.rivera@example.com', fullName: 'Kayla Rivera' },
  { email: 'joshua.mercado@example.com', fullName: 'Joshua Mercado' },
  { email: 'nicole.castillo@example.com', fullName: 'Nicole Castillo' }
];

type Turn = { user: string; assistant: string };

const SEEDS: { title: string; turns: Turn[] }[] = [
  {
    title: 'How do I interpret the cohort progress dashboard?',
    turns: [
      {
        user: `I've been looking at the cohort progress dashboard and I'm a bit overwhelmed by all the metrics. What should I actually focus on as an EIF? I see completion rates, engagement scores, assessment results, and a bunch of filters.`,
        assistant: `Great question. Here's what matters most as an EIF:

**Sprint completion rate** — this is the single strongest predictor of capstone success. If you're below 80% by mid-program, reassess your weekly schedule.

**Assessment score trends** — look at the 3-sprint moving average, not individual quiz scores. Plateauing usually means revisit foundational concepts.

**Peer engagement** — fellows who actively review cohortmates' notebooks consistently perform better on capstones. It builds critical thinking.

Set the time range to "last 30 days" and ignore the rest until your mentor flags something specific.`
      },
      {
        user: `That helps narrow things down. My sprint completion is at 75% — what's a concrete step I can take this week to bring it up?`,
        assistant: `Three things that work:

1. **Block your async work first** — put 2-hour deep work slots on your calendar before the live sessions, not after. Energy is higher, and you won't get derailed by the session running long.

2. **Submit imperfect work** — the biggest drag on completion is perfectionism. Push your notebook with a "WIP" note if needed. You can always revise before the checkpoint.

3. **Use the 15-minute rule** — if you're stuck on a concept for more than 15 minutes, drop a message in the cohort Slack channel and move to the next section. Chances are someone else is stuck on the same thing.

Try those for one sprint and check your completion rate again. A 10-point bump in two weeks is very doable.`
      }
    ]
  },
  {
    title: 'Feedback on my capstone project memo',
    turns: [
      {
        user: `I just submitted my capstone project memo and I'm nervous about the structure. It covers problem statement, methodology, expected outcomes, and timeline. I'm predicting customer churn using random forest on a telecom dataset. Does that sound reasonable?`,
        assistant: `Solid topic — churn prediction on telecom data is well-scoped and lets you demonstrate all core DS skills. A few things to tighten:

**Problem statement** — frame it as "identify the top 3 drivers of churn in Q2 with enough lead time to intervene" rather than just "predict churn."

**Methodology** — mention how you'll handle class imbalance (churn is ~15-20%), feature engineering (tenure buckets, ticket frequency, payment changes), and time-based validation instead of random splits.

**Expected outcomes** — be concrete: "precision >0.7 at recall 0.5, delivered as a ranked list of intervention triggers the retention team can act on."

**Timeline** — block by week: 1-2 EDA + features, 3 modeling, 4 evaluation + write-up.`
      },
      {
        user: `Good call on the time-based validation — I hadn't thought of that. For class imbalance, would SMOTE be overkill for this scope?`,
        assistant: `SMOTE is not overkill, but I'd start simpler. Try these in order:

1. **Class weight adjustment** in the model itself — random forest has a \`class_weight='balanced'\` parameter. One line of code, often sufficient.

2. **Stratified cross-validation** — ensures each fold preserves the churn ratio. You should do this regardless of whether you use SMOTE.

3. **SMOTE only if needed** — if your recall on the minority class is below 0.4 after steps 1 and 2, then add SMOTE.

The capstone reviewers want to see that you understand *why* you chose each technique, not that you used the most complex one. Documenting this decision chain in your memo will earn you points.`
      }
    ]
  },
  {
    title: 'Career shift from engineering to data science',
    turns: [
      {
        user: `I've been a software engineer for 4 years and I'm considering shifting into data science. I enrolled to test the waters but I'm not sure if I should go all in. Job postings ask for statistics background that I don't really have.`,
        assistant: `Your engineering background is more valuable than you think.

**What you already have over pure stats grads:**
- Production mindset — code that runs reliably and handles edge cases
- System thinking — data pipelines, APIs, model deployment context
- Debugging discipline — translates directly to diagnosing model underperformance

**What you need to build:**
- Experimental design — A/B testing, confounding variables, statistical significance (this is the biggest gap)
- EDA habits — engineers tend to jump to modeling before understanding data shape
- Non-technical communication — DS outputs are consumed by stakeholders more often

**My advice:** Don't go all in immediately. Spend 6 months treating Eskwelabs as "DS-flavored engineering" exploration. Focus on feature engineering, MLOps, and experiment design rather than competing on pure theory.

The market values hybrid profiles more every year. A senior engineer who can ship a production model is worth more than a pure statistician who can't deploy.`
      },
      {
        user: `That's reassuring. What specific projects should I prioritize in my portfolio to signal this hybrid profile to employers?`,
        assistant: `Three projects that will showcase the engineer-plus-DS profile:

1. **End-to-end ML pipeline** — build a model, containerize it with Docker, deploy it as a FastAPI endpoint with monitoring. This single project signals more than three Kaggle notebooks.

2. **Feature store demo** — create a simple feature engineering pipeline that runs on a schedule (Airflow or even cron) and serves features via an API. It shows you understand the production data side.

3. **A/B testing framework** — simulate an experiment with synthetic data and build a dashboard that visualizes significance, power, and sample size. This bridges the stats gap without requiring theoretical depth.

Put these on GitHub with proper READMEs and architecture diagrams. For a hiring manager looking at a SWE→DS transition, these projects answer the question "can this person build things that work?" better than any certification.`
      }
    ]
  },
  {
    title: 'Python pandas groupby explained',
    turns: [
      {
        user: `I keep getting confused with pandas groupby operations. I understand the concept but every time I need to aggregate multiple columns with different functions I have to look up the syntax. Any mental model that sticks?`,
        assistant: `The mental model that clicked for me: **split-apply-combine**.

**Split** — \`df.groupby('col')\` splits your DataFrame into groups, one per unique value. Nothing has been computed yet — you've just defined the groups.

**Apply** — you tell pandas what to do with each group. This is where \`.agg()\`, \`.transform()\`, and \`.filter()\` live.

**Combine** — pandas stitches the results back together.

For the syntax confusion, memorize this pattern:

\`\`\`python
df.groupby('category').agg(
    total=('price', 'sum'),
    average=('price', 'mean'),
    count=('id', 'count'),
    first_date=('date', 'min')
)
\`\`\`

The named agg syntax (\`new_col=('source_col', 'function')\`) is the most readable. Bookmark it — you'll use it daily.`
      },
      {
        user: `What about when I need to group by multiple columns and apply different aggregations to different columns based on those groups?`,
        assistant: `Same pattern, just pass a list to \`groupby\`:

\`\`\`python
df.groupby(['region', 'quarter'], as_index=False).agg(
    total_revenue=('revenue', 'sum'),
    avg_discount=('discount', 'mean'),
    deal_count=('deal_id', 'nunique'),
    first_close=('close_date', 'min')
)
\`\`\`

The \`as_index=False\` is important — it keeps your group columns as regular columns instead of turning them into the index.

For more complex cases where you need different functions per column:

\`\`\`python
df.groupby('region').agg({
    'revenue': ['sum', 'mean'],
    'quantity': 'sum',
    'date': ['min', 'max']
})
\`\`\`

This returns a MultiIndex column though, which is annoying to work with. I stick with the named agg syntax 90% of the time and only use the dict form when I genuinely need it.`
      }
    ]
  },
  {
    title: 'SQL window functions deep dive',
    turns: [
      {
        user: `I can write basic SQL but window functions still trip me up. I understand ROW_NUMBER() but PARTITION BY and frame clauses are confusing. Can you explain when I'd actually use these?`,
        assistant: `Think of window functions as **calculations across rows that are related to the current row**. The key difference from GROUP BY: you don't collapse rows.

**PARTITION BY** defines the groups (like GROUP BY but without collapsing). Rows in different partitions don't affect each other.

Real-world examples:

\`\`\`sql
-- Running total of sales per month
SELECT date, revenue,
  SUM(revenue) OVER (ORDER BY date) AS running_total
FROM sales;

-- Rank employees by salary within each department
SELECT name, dept, salary,
  RANK() OVER (PARTITION BY dept ORDER BY salary DESC) AS dept_rank
FROM employees;

-- Compare each sale to the department average
SELECT date, dept, amount,
  AVG(amount) OVER (PARTITION BY dept) AS dept_avg,
  amount - AVG(amount) OVER (PARTITION BY dept) AS vs_avg
FROM sales;
\`\`\`

The frame clause (\`ROWS BETWEEN ... AND ...\`) only matters when you need to control exactly which rows are included — typically for moving averages or year-to-date calculations. 90% of use cases don't need it.`
      },
      {
        user: `That frame clause example helps. How would I calculate a 7-day moving average? I always get the syntax wrong.`,
        assistant: `The 7-day moving average pattern:

\`\`\`sql
SELECT date, revenue,
  AVG(revenue) OVER (
    ORDER BY date
    ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
  ) AS ma_7
FROM daily_sales;
\`\`\`

**6 PRECEDING** means "look back 6 rows" which plus the current row = 7 total. Common gotcha: if you have gaps in dates, \`ROWS\` counts physical rows, not calendar days. If you need calendar-accurate windows, use \`RANGE BETWEEN INTERVAL '6 days' PRECEDING AND CURRENT ROW\` — but that requires a date-aware data type.

For most dashboard work, the \`ROWS\` version is fine. Just make sure your data doesn't have unexpected gaps or the window will include fewer rows than you expect.`
      }
    ]
  },
  {
    title: 'Resume review for data roles',
    turns: [
      {
        user: `I'm applying for junior data analyst roles and my resume isn't getting callbacks. I have a BS in Math and did a data bootcamp. My resume lists coursework and tools but maybe it's too generic?`,
        assistant: `The #1 problem with entry-level DS resumes: **they list what you studied, not what you accomplished**. Recruiters scan for impact, not topics.

Fix these three things:

1. **Replace coursework with projects** — instead of "Coursework: Regression, Classification, NLP," write "Built a churn prediction model that identified 3 key drivers, enabling targeted retention campaigns."

2. **Quantify everything** — "Cleaned data" → "Cleaned 50K+ records, reducing processing time by 40%." "Built dashboard" → "Built Tableau dashboard tracking 12 KPIs, used by 3 stakeholders weekly."

3. **Remove the "Tools" section** — listing Python, SQL, Tableau as a bullet list is table stakes. Instead, weave tools into your experience descriptions: "Used Python (pandas, sklearn) to build a classification model..."

Also: if you're not getting callbacks, the issue might be your portfolio link isn't prominent enough. Put it right under your name.`
      },
      {
        user: `Should I include my bootcamp on the resume or leave it off? Some people say employers don't value them.`,
        assistant: `Absolutely include it — but frame it strategically.

**Do:** List it under "Education" or a "Relevant Training" section with the actual skills and projects. "Eskwelabs Data Science Fellowship — 15-week intensive covering ML, SQL, statistics, and deployment. Delivered capstone on customer churn prediction with 85% precision."

**Don't:** Lead with it instead of your degree, and don't let it overshadow your math background. Your BS in Math is your strongest credential for analyst roles — it signals quantitative rigor that bootcamps alone don't.

The stigma around bootcamps is fading fast, especially for analyst roles. What matters is what you can demonstrate. If your portfolio projects are solid and you can talk through them in an interview, the bootcamp becomes a positive signal that you invested in applied skills on top of your theoretical foundation.`
      }
    ]
  },
  {
    title: 'Bootcamp capstone project ideas',
    turns: [
      {
        user: `I need to pick my capstone topic by next week and I'm stuck between a few ideas: customer churn, sentiment analysis on reviews, or a recommendation system. Which one would look best to employers?`,
        assistant: `Between those three, **customer churn** will give you the strongest signal for the widest range of roles. Here's why:

**Churn prediction** hits all the boxes employers care about:
- Classification with class imbalance (a realistic ML challenge)
- Feature engineering from raw data (tenure, usage patterns, support interactions)
- Business impact is easy to articulate ("if we catch at-risk customers early, we save $X in retention cost")
- Works for both analyst and DS roles

**Sentiment analysis** is fine but saturated — every bootcamp grad has one. Hard to stand out.

**Recommendation systems** are impressive but harder to scope well. Simple collaborative filtering is too basic, and building a production-grade recommender is too much for a capstone.

If you do churn, make sure you go beyond random forest. Try XGBoost, do proper hyperparameter tuning, and most importantly — build a simple "what to do about it" layer (e.g., a ranked list of intervention triggers). That's what separates a good capstone from a great one.`
      },
      {
        user: `If I do churn, what dataset would you recommend? I don't have access to company data.`,
        assistant: `Three solid public datasets for churn:

1. **Telco Customer Churn (Kaggle)** — the classic. Clean, well-documented, and feature-rich. ~7K rows, 21 features. The downside: it's been done to death, so you need to differentiate with your approach, not the data.

2. **Bank Churn (Kaggle)** — larger (~100K rows), more features, and imbalanced (churn rate ~20%). Better for showing you can handle scale and imbalance.

3. **E-commerce behavior data** — you'd need to define churn yourself (e.g., no purchase in 90 days), which is actually a good skill to demonstrate. The [Online Retail II dataset](https://archive.ics.uci.edu/dataset/502/online+retail+ii) from UCI is great for this.

I'd go with Telco for a clean capstone or Bank Churn if you want to show more advanced techniques. Either way, the key is your narrative around *how the business should use the model*, not the dataset choice.`
      }
    ]
  },
  {
    title: 'How to negotiate my first tech offer',
    turns: [
      {
        user: `I just got my first data analyst offer and I'm honestly just excited to have one. The salary seems okay but I feel like I should negotiate. I don't want to lose the offer though. Any advice?`,
        assistant: `**You will not lose the offer by negotiating.** This is the most researched finding in offer negotiation — employers almost never retract an offer because someone asked for more. The worst case is they say no.

Here's a simple script:

"Thank you so much for the offer. I'm really excited about the role and the team. Based on my research and the market for this level of role in this city, I was hoping for something in the range of $X-$Y. Is there flexibility on the base salary?"

If they can't move on salary, negotiate **non-salary items**:
- Signing bonus (many companies have a separate budget for this)
- Start date flexibility
- Professional development budget
- Remote work days (if not already specified)
- Equipment budget

One trick that works: ask for a "performance review at 6 months with potential for adjustment." It costs them nothing now and gets you a formal check-in point.`
      },
      {
        user: `How do I figure out what range to ask for? I don't know what's reasonable for my level.`,
        assistant: `Three sources that work without connections:

1. **levels.fyi** — best for tech company data. Filter by YOE and location. The "Expected" range is usually accurate.

2. **Glassdoor** — less precise but broader coverage. Look at the "Software Engineer" or "Data Analyst" bucket for the specific company.

3. **Blind** — anonymous posts from people at specific companies. Take individual posts with a grain of salt, but if you see a pattern (5 people reporting similar ranges), that's reliable.

For your first role, target the 50th-60th percentile for your city and YOE. That's a realistic ask that shows you did your homework without being aggressive.

Also: total compensation matters more than base salary. A $5K lower base with $20K in RSUs and a 10% bonus is actually a better deal. Make sure you're comparing total comp.`
      }
    ]
  },
  {
    title: 'Data storytelling with Tableau',
    turns: [
      {
        user: `My dashboards get ignored. I spend hours building them in Tableau and then stakeholders say they're "confusing" or "too busy." What am I doing wrong?`,
        assistant: `The #1 mistake: **you're designing for yourself, not for the decision-maker**.

Fix with these principles:

**1. One question per dashboard** — if a stakeholder has to ask "what am I looking at?" your dashboard failed. A dashboard should answer exactly one question: "Are we on track this quarter?" or "Which accounts are at risk?"

**2. Pre-attentive attributes** — use color, size, and position to guide the eye. The most important number should be the biggest and most colorful. Everything else supports it.

**3. Remove the legend** — label data points directly. Forcing someone's eyes to go back and forth between a legend and the chart is cognitive friction.

**4. Add context** — a number alone means nothing. "12% growth" is noise. "12% growth (above our 8% target, driven by the APAC region)" is insight.

Before you publish a dashboard, show it to someone who knows nothing about the project. If they can tell you the main takeaway in 5 seconds, it's ready.`
      },
      {
        user: `What's the best chart type for showing trends over time with multiple categories without it turning into spaghetti?`,
        assistant: `For multi-category time series, the best options in order:

**1. Small multiples** — split into separate mini-charts per category, same y-axis scale. Lets viewers compare shapes without line spaghetti. Tableau: put category on Rows, date on Columns.

**2. Highlight table** — a heatmap where rows are categories, columns are time periods, and color intensity shows value. Great for spotting patterns across many categories at once.

**3. Slope chart** — shows only two time points (start and end) with lines connecting them. Perfect for "before and after" comparisons. Dramatically simpler than a full time series.

**4. If you must use a line chart** — limit to 5 lines max, use gray for all but the most important category (highlighted in color), and label line endings directly instead of using a legend.

The urge to show everything in one chart is the enemy. If you have 20 categories, don't make one chart — make 4 charts with 5 categories each or use small multiples. Your stakeholders will thank you.`
      }
    ]
  },
  {
    title: 'Understanding the EIF program requirements',
    turns: [
      {
        user: `I'm a bit lost on the graduation requirements. The handbook mentions sprints, checkpoints, and a capstone but I'm not clear on what's mandatory vs optional. Can you clarify?`,
        assistant: `Here's the clear breakdown:

**Mandatory to graduate:**
- Complete all 8 sprints (submit the sprint notebook, even if incomplete)
- Pass the capstone (your mentor signs off on the deliverable and presentation)
- Attend at least 6 of 8 Friday checkpoints

**Not mandatory but strongly recommended:**
- Live session attendance (recordings are available, but in-person participation correlates strongly with capstone quality)
- Peer reviews (you should do at least 4 throughout the program)
- Office hours visits (the fellows who attend office hours consistently finish their capstones 2-3 weeks earlier)

**Optional:**
- Slack participation
- Study groups
- Supplementary workshops

The most common reason fellows don't graduate isn't failing the capstone — it's falling behind on sprint submissions and not catching up. If you ever skip one sprint, the next one feels harder because concepts build. Stay current and you'll be fine.`
      },
      {
        user: `What happens if I fail the capstone? Do I get kicked out or is there a retake?`,
        assistant: `You don't get kicked out. The capstone has a revision process:

1. Your mentor reviews your deliverable and gives feedback.
2. If it doesn't pass, you get **2 weeks to revise and resubmit**.
3. If the second submission still doesn't pass, you're invited to the next cohort's capstone period for a third attempt — at no extra cost.

The failure rate is low (~5-8%) and almost always due to one of three things:
- Scoping too broadly (trying to solve world hunger in 4 weeks)
- Not starting early enough (capstone work should begin by sprint 5 at the latest)
- Poor documentation (the model works but nobody can follow your reasoning)

Start your capstone memo early, get feedback from your mentor at the outline stage, and keep a log of your decisions. If you do those three things, passing is almost certain.`
      }
    ]
  },
  {
    title: 'Feature engineering tips for tabular data',
    turns: [
      {
        user: `I'm working on a tabular dataset for my sprint project and I feel like I'm leaving performance on the table with just raw features. What are your go-to feature engineering techniques?`,
        assistant: `Here are the highest-leverage techniques, ordered by impact:

**1. Date decomposition** — never feed raw dates to a model. Extract: day_of_week, is_weekend, month, quarter, days_since_last_event, day_of_year.

**2. Aggregated features** — group by a key (user, product, region) and compute count, mean, std, min, max, trend. A single "average order value per customer" feature often lifts model performance by 5-10%.

**3. Interaction features** — multiply or add pairs of features that might have combined effects. Only do this for features where you have a domain reason to expect interaction (e.g., price × discount_rate).

**4. Target encoding** — for high-cardinality categorical features (like zip code), replace the category with the mean target value from training data. Use cross-validation to avoid leakage.

**5. Binning** — for features like age or income, create buckets. Sometimes a model doesn't need the exact value, just the range.

Don't do all of these at once. Add one at a time and measure if it actually improves validation performance. Feature engineering can easily introduce noise if you're not careful.`
      },
      {
        user: `How do I know if my feature engineering is actually helping vs just adding complexity? I'm worried about overfitting.`,
        assistant: `**The litmus test: does it improve cross-validation score?**

Here's the workflow:

1. Establish a baseline with raw features only — get your CV score (e.g., 5-fold ROC-AUC).
2. Add one feature engineering technique at a time.
3. If the CV score improves by more than 0.5%, keep it. If not, drop it.
4. Check that train and test scores stay close — if train goes up but test doesn't, you're overfitting.

**Specific red flags for overfitting:**
- Target encoding on rare categories (fewer than 100 samples per category)
- High-degree polynomial features (x², x³) without regularization
- Features that use the target in any way without cross-validation (leakage)

A good rule of thumb: you should be able to explain why each engineered feature should theoretically help. "Because it improved my score" is not sufficient — you need a domain reason. Features that pass both the domain-reason test and the CV test are keepers.`
      }
    ]
  },
  {
    title: 'Best resources for learning machine learning?',
    turns: [
      {
        user: 'What are the best resources you recommend for someone starting with ML? I have basic Python but no ML background.',
        assistant:
          '**Hands-on:** Kaggle Learn (free, interactive) and "Hands-On ML" by Géron (code-first, skips math you can learn later). **Theory:** StatQuest YouTube channel for intuition, then "Introduction to Statistical Learning" (ISLR) when you need depth. **Structure:** Andrew Ng\'s Coursera course is still the gold standard for foundations. Do them in that order — hands-on first, theory when you hit limits.'
      }
    ]
  },
  {
    title: 'How to handle missing data in my dataset?',
    turns: [
      {
        user: "About 30% of my dataset has missing values in different columns. I don't want to drop that many rows. What's the right approach?",
        assistant:
          '**First**, understand WHY it\'s missing — MCAR, MAR, or MNAR determines your strategy. **For <5%**: drop rows or mean/median impute. **For 5-30%** (your case): use column mean/median grouped by a related feature, or KNN imputation. **For >30%**: create a "missing" indicator column and keep the original as-is — the model can learn patterns from missingness itself. Never use the target variable to inform imputation (data leakage).'
      }
    ]
  },
  {
    title: 'Difference between bagging and boosting?',
    turns: [
      {
        user: 'Can you explain the difference between bagging and boosting in simple terms? I keep mixing them up.',
        assistant:
          'Think of it as **voting vs learning from mistakes**. **Bagging** (Random Forest): train many models in parallel on random subsets of data, average their predictions. Each model is independent. **Boosting** (XGBoost, LightGBM): train models sequentially — each new model focuses on the mistakes the previous ones made. Bagging reduces variance (overfitting), boosting reduces bias (underfitting). Boosting usually performs better but is more prone to overfitting if you use too many rounds.'
      }
    ]
  },
  {
    title: 'Tips for data cleaning workflows?',
    turns: [
      {
        user: 'I spend 80% of my project time cleaning data. Any tips to make this faster?',
        assistant:
          "**1. Profile first** — run pandas-profiling or ydata-profiling before writing any cleaning code. It surfaces nulls, outliers, cardinality, and correlations in one command. **2. Build a pipeline** — use sklearn's ColumnTransformer + Pipeline so cleaning steps are reproducible and you don't accidentally apply train transforms to test data. **3. Automate the boring stuff** — write helper functions for common patterns (rename columns, standardize date formats, cap outliers at 99th percentile). After 3 projects, your library will cut cleaning time by half."
      }
    ]
  },
  {
    title: 'How to deal with imbalanced classes?',
    turns: [
      {
        user: 'My dataset has 95% negative class and 5% positive. Every model just predicts "negative" and gets 95% accuracy. How do I fix this?',
        assistant:
          '**Step 1: Stop using accuracy.** Use precision, recall, F1, and AUC-ROC instead. **Step 2: Try these in order:** (a) class_weight="balanced" in your model — often sufficient. (b) Resample — SMOTE for oversampling or RandomUnderSampler for undersampling. (c) Use anomaly detection algorithms (Isolation Forest, LOF) instead of classification. **Step 3:** If the problem is fundamentally rare-event detection, consider cost-sensitive learning where false negatives cost more than false positives.'
      }
    ]
  },
  {
    title: 'Exploratory Data Analysis checklist',
    turns: [
      {
        user: 'When I start a new dataset I just jump to modeling. My mentor said my EDA is weak. What should I actually look at?',
        assistant:
          "A solid EDA checklist: **1. Structure** — shape, dtypes, missing %, unique counts. **2. Distribution** — histograms for all numerical columns, value counts for categoricals. **3. Outliers** — boxplots or IQR-based detection. **4. Relationships** — correlation matrix (heatmap) + pairplots for top 5-10 features. **5. Target analysis** — how does each feature relate to the target? Group means, stacked bar charts. **6. Time** — if there's a date column, plot trends and seasonality. Do this as a reproducible notebook so you can rerun it on new data in 5 minutes."
      }
    ]
  },
  {
    title: 'Model deployment options for beginners?',
    turns: [
      {
        user: "I've built a model in a notebook. How do I actually put it somewhere people can use it?",
        assistant:
          "Start with the simplest option that works: **1. Streamlit/Gradio** — write a Python script, deploy to Streamlit Community Cloud for free. Takes 2 hours. **2. FastAPI + Docker** — wrap your model in a prediction endpoint, containerize, deploy on Render or Railway. **3. Flask + Heroku** — older stack but tons of tutorials. **Don't** start with Kubernetes, SageMaker, or MLflow. Those solve scaling problems you don't have yet. Ship something usable first, then learn infrastructure when you hit its limits."
      }
    ]
  },
  {
    title: 'Python vs R for data science?',
    turns: [
      {
        user: 'I know some R from college but everyone at Eskwelabs uses Python. Should I switch?',
        assistant:
          "For the Eskwelabs program and most industry roles: **yes, switch to Python now**. R is still strong in academia, biostats, and niche visualization (ggplot2 is unmatched), but Python dominates everywhere else. **Transition path:** Start with pandas (it's data.frame-like, so R users find it familiar), use plotnine (a ggplot2 clone in Python) to ease the viz transition, and keep R in your toolkit for statistical analysis (lme4, brms) if you go into research-heavy roles. The syntax switching is painful for ~2 weeks, then it clicks."
      }
    ]
  },
  {
    title: 'How to structure a data science project?',
    turns: [
      {
        user: 'My projects are always a mess of notebooks with no clear structure. How should I organize them?',
        assistant:
          'Cookiecutter Data Science is the standard template: \n```\ndata/\n  raw/       (read-only, never modify)\n  processed/  (cleaned, feature-engineered)\n  interim/    (in-progress, can be deleted)\nnotebooks/    (1-探索, 2-preprocessing, 3-modeling, 4-reporting)\nsrc/          (reusable .py modules)\nmodels/       (serialized pickles/onnx)\nreports/      (figures, dashboards)\n```\nKey rule: notebooks are for exploration, .py files are for production. When you find yourself copying the same cell across notebooks, refactor it into src/.'
      }
    ]
  },
  {
    title: 'Cross-validation strategies explained',
    turns: [
      {
        user: "I always use 5-fold cross-validation because that's what everyone does. Is that always the right choice?",
        assistant:
          "5-fold is the default for a reason — it balances bias and variance well for medium datasets (1K-100K rows). But it's not universal: **Small data (<1K rows):** use leave-one-out (LOOCV) or 10-fold. **Large data (>100K rows):** 3-fold or even a single validation set is fine — CV becomes expensive and you have enough data for a representative holdout. **Time series:** NEVER use random folds. Use TimeSeriesSplit or expanding window. **Grouped data:** Use GroupKFold so all rows from one user/patient stay in the same fold. The right strategy depends on your data structure, not convention."
      }
    ]
  },
  {
    title: 'Understanding p-values and confidence intervals',
    turns: [
      {
        user: "I use p-values but I don't really understand what they mean. My mentor asked me to explain a p-value of 0.03 and I froze.",
        assistant:
          'A p-value is NOT the probability that the null hypothesis is true. Here\'s what it actually is: **"If the null hypothesis were true, how likely would I be to see data this extreme?"** p=0.03 means there\'s a 3% chance of observing your result (or more extreme) if there\'s actually no effect. **Key misconception:** it does NOT mean "97% chance there\'s an effect." For that, you need Bayesian methods. **What to report alongside it:** effect size (how big is the difference?) and confidence interval (range of plausible values). A tiny p-value with a trivial effect size (e.g., p<0.001 but 0.1% improvement) is still practically meaningless.'
      }
    ]
  },
  {
    title: 'How to read academic ML papers?',
    turns: [
      {
        user: 'I try to read ML papers but I get lost in the math by page 2. How do I actually extract value from them?',
        assistant:
          "Don't read papers linearly. Do this: **1. Title + abstract** — does this solve a problem you care about? If no, skip. **2. Figures** — look at every figure first. They tell the story. If the results vis doesn't impress you, the math won't change your mind. **3. Introduction + Related Work** — situates the contribution. **4. Experiments** — is the evaluation fair? Do they compare against strong baselines? **5. Method** — only after you understand what they did and why it matters. Most practitioners never read the math carefully — they implement from blog posts and open-source code. That's fine. Papers are for ideas, implementations are for understanding."
      }
    ]
  },
  {
    title: 'Building a data science portfolio',
    turns: [
      {
        user: 'I have 3 Kaggle notebooks but no real projects. How do I build a portfolio that actually gets interviews?',
        assistant:
          'Replace Kaggle with end-to-end projects. **The formula:** pick a domain you care about (sports, climate, music), find a real dataset (not a Kaggle competition), and answer a specific question. **Example:** "Which weather patterns cause the most delays at Manila airport?" — scrape weather data, build a predictor, deploy a simple Streamlit dashboard showing delay risk by day. **Why this works:** it shows you can scope a problem, find data, build something, and communicate results. Kaggle gives you the data and the question — that\'s the easy part. Employers want to see you do the hard part yourself. Aim for 3-4 projects with this structure.'
      }
    ]
  },
  {
    title: 'Common Python mistakes beginners make',
    turns: [
      {
        user: 'I keep running into bugs in my Python code. What are the most common things I should watch out for?',
        assistant:
          "Top 5 that trip up beginners: **1. Mutable default arguments** — `def f(lst=[])` reuses the same list across calls. Use `None` and initialize inside. **2. Modifying while iterating** — never delete from a list while looping over it. Build a new list instead. **3. Shallow copies** — `new_list = old_list` creates a reference, not a copy. Use `.copy()` or `deepcopy()`. **4. Equality vs identity** — `==` checks value, `is` checks memory location. Use `is None` for None checks, `==` for everything else. **5. Ignoring pandas SettingWithCopyWarning** — that warning is telling you you're modifying a slice, not the original. Use `.loc` explicitly. These account for ~80% of Python bugs in data work."
      }
    ]
  }
] as const;

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)];
}

function tokenCost(promptTokens: number, completionTokens: number): string {
  const micros =
    Math.round((promptTokens * 0.15 + completionTokens * 0.6) * 100) * 10000;
  return (micros / 1_000_000).toString();
}

function daysAgoDate(daysAgo: number, hourOffset = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hourOffset, 0, 0, 0);
  return d;
}

async function main() {
  console.log('Seeding database...\n');

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Users ────────────────────────────────────────────────────────────
  const userRows = await sql`
    INSERT INTO users ${sql(
      [
        {
          email: ADMIN_EMAIL,
          password_hash: passwordHash,
          role: 'admin',
          is_active: true
        },
        {
          email: INTERN_EMAIL,
          password_hash: passwordHash,
          role: 'eif',
          is_active: true
        },
        ...EIF_USERS.map((u) => ({
          email: u.email,
          password_hash: passwordHash,
          role: 'eif',
          is_active: true
        }))
      ].map((r) => ({
        email: r.email as string,
        password_hash: r.password_hash as string,
        role: r.role as string,
        is_active: true as boolean
      }))
    )}
    ON CONFLICT (email) DO UPDATE SET
      password_hash = COALESCE(EXCLUDED.password_hash, users.password_hash),
      role = EXCLUDED.role,
      is_active = true
    RETURNING id, email, role
  `;
  console.log(`Users: ${userRows.length} upserted`);
  for (const u of userRows) console.log(`  ${u.email} (${u.role}) [${u.id}]`);

  const intern = userRows.find((u) => u.email === INTERN_EMAIL);
  if (!intern) throw new Error('Intern user not found after upsert');
  const eifRows = userRows.filter((u) => u.role === 'eif');

  // ── Advisors ─────────────────────────────────────────────────────────
  const advisors =
    await sql`SELECT id, name FROM advisors WHERE is_active = true`;
  console.log(`\nAdvisors: ${advisors.length} found`);
  for (const a of advisors) console.log(`  ${a.id} — ${a.name}`);

  // ── Model configs ────────────────────────────────────────────────────
  console.log('\nUpserting model configs...');
  for (const a of advisors) {
    await sql`
      INSERT INTO model_config (advisor_id, provider, model, is_enabled)
      VALUES (${a.id}, 'groq', 'llama-3.3-70b-versatile', true)
      ON CONFLICT (advisor_id) DO UPDATE SET
        provider = EXCLUDED.provider,
        model = EXCLUDED.model,
        is_enabled = true,
        updated_at = NOW()
    `;
  }
  console.log(`  ${advisors.length} model configs upserted\n`);

  // ── Clean slate: conversations + messages ────────────────────────────
  console.log('Deleting existing conversations and messages...');
  const eifIds = eifRows.map((u) => u.id);
  await sql`DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE user_id = ANY(${eifIds}))`;
  await sql`DELETE FROM conversations WHERE user_id = ANY(${eifIds})`;
  console.log('  Done — clean slate.\n');

  // ── Conversations + Messages with metadata ───────────────────────────
  let conversationsCreated = 0;
  let messagesCreated = 0;
  const allMessages: Array<{
    conversationId: string;
    userId: string;
    role: string;
    content: string;
    promptTokens: number;
    completionTokens: number;
    estimatedCostUsd: string;
    latencyMs: number;
    createdAt: Date;
  }> = [];

  console.log('Creating conversations and messages...');
  const providers = ['groq', 'gemini', 'gpt'];
  const models = ['llama-3.3-70b-versatile', 'gemini-2.0-flash', 'gpt-4o-mini'];

  for (const [ei, eifUser] of eifRows.entries()) {
    const numConvos = ei === 0 ? SEEDS.length : rand(6, 15);
    const sources =
      ei === 0
        ? SEEDS.map((s) => ({ ...s, advisorIdx: null, dayOffset: null }))
        : null;

    for (let ci = 0; ci < numConvos; ci++) {
      const advisor =
        sources && sources[ci]
          ? advisors[ci % advisors.length]
          : pick(advisors);
      const daysAgo =
        sources && sources[ci]
          ? rand(28, 30) - Math.floor(ci / 4)
          : rand(0, 60);

      const title =
        sources && sources[ci]
          ? sources[ci].title
          : [
              'EDA on sales data',
              'Building a dashboard',
              'Cleaning messy CSV',
              'Statistics help needed',
              'Capstone question',
              'SQL query optimization',
              'Model deployment',
              'Data visualization tips',
              'A/B testing setup',
              'Feature engineering',
              'Time series analysis',
              'ML pipeline question',
              'Data warehousing',
              'Web scraping help',
              'Python performance'
            ][rand(0, 14)];
      const turns: Turn[] = sources && sources[ci] ? sources[ci].turns : [];
      if (turns.length === 0) {
        const numTurns = rand(3, 10);
        for (let ti = 0; ti < numTurns; ti++) {
          if (ti % 2 === 0) {
            turns.push({
              user: [
                'What approach would you recommend for this?',
                'Can you give me an example?',
                'How do I implement this in Python?',
                'What tools should I use?',
                'Is there a simpler way to do this?',
                'Can you explain this further?',
                'What are the key considerations here?',
                'How do I avoid common mistakes?',
                'What should I read to learn more?',
                'Does this approach scale well?'
              ][rand(0, 9)],
              assistant:
                'Here are some practical steps to consider. First, start by understanding your data quality. Then, choose an appropriate method based on your specific context. The key is to iterate quickly and validate your assumptions early.'
            });
          } else {
            turns.push({
              user: 'That makes sense. What about handling edge cases?',
              assistant:
                'Good question. Edge cases are exactly where the real learning happens. I recommend writing unit tests for your edge cases first, then building your solution around them. This is called test-driven development and it works particularly well for data pipelines.'
            });
          }
        }
      }

      const convoId = randomUUID();
      const convoCreatedAt = daysAgoDate(daysAgo, rand(8, 20));
      await sql`
        INSERT INTO conversations (id, user_id, advisor_id, title, status, created_at)
        VALUES (${convoId}, ${eifUser.id}, ${advisor.id}, ${title}, 'active', ${convoCreatedAt})
      `;
      conversationsCreated++;

      for (const [ti, turn] of turns.entries()) {
        const promptTokens = rand(200, 3000);
        const completionTokens = rand(100, 2000);
        const minutesOffset = ti * 3 + rand(0, 2);
        const msgTime = new Date(
          convoCreatedAt.getTime() + minutesOffset * 60000
        );

        const userRow = {
          conversationId: convoId,
          userId: eifUser.id,
          role: 'user',
          content: turn.user,
          promptTokens: 0,
          completionTokens: 0,
          estimatedCostUsd: '0',
          latencyMs: 0,
          createdAt: new Date(msgTime.getTime() - 30000)
        };
        const assistantRow = {
          conversationId: convoId,
          userId: eifUser.id,
          role: 'assistant',
          content: turn.assistant,
          promptTokens,
          completionTokens,
          estimatedCostUsd: tokenCost(promptTokens, completionTokens),
          latencyMs: rand(500, 8000),
          createdAt: msgTime
        };

        await sql`
          INSERT INTO messages ${sql(
            [userRow, assistantRow].map((r) => ({
              conversation_id: r.conversationId,
              user_id: r.userId,
              role: r.role,
              content: r.content,
              provider: r.role === 'assistant' ? pick(providers) : null,
              model: r.role === 'assistant' ? pick(models) : null,
              prompt_tokens: r.promptTokens,
              completion_tokens: r.completionTokens,
              estimated_cost_usd: r.estimatedCostUsd,
              latency_ms: r.latencyMs,
              status: 'ok',
              created_at: r.createdAt
            }))
          )}
        `;
        allMessages.push(userRow, assistantRow);
        messagesCreated += 2;
      }

      if (conversationsCreated % 10 === 0) {
        console.log(`  ${conversationsCreated} conversations created...`);
      }
    }
  }
  console.log(
    `  ${conversationsCreated} conversations, ${messagesCreated} messages`
  );

  // ── Usage counters (aggregated from messages) ────────────────────────
  console.log('\nBuilding usage counters from messages...');
  const counterMap = new Map<
    string,
    { messages: number; tokens: number; spend: string }
  >();
  for (const msg of allMessages) {
    if (msg.role !== 'assistant') continue;
    const dp = msg.createdAt.toISOString().slice(0, 10);
    const key = `${msg.userId}:${dp}`;
    const cur = counterMap.get(key) ?? { messages: 0, tokens: 0, spend: '0' };
    cur.messages++;
    cur.tokens += msg.promptTokens + msg.completionTokens;
    const curSpend = parseFloat(cur.spend);
    const msgSpend = parseFloat(msg.estimatedCostUsd);
    cur.spend = (curSpend + msgSpend).toFixed(8);
    counterMap.set(key, cur);
  }
  if (counterMap.size > 0) {
    const counterRows = [...counterMap.entries()].map(([key, val]) => {
      const [userId, dp] = key.split(':');
      return {
        user_id: userId!,
        day_ph: dp!,
        messages_today: val.messages,
        tokens_today: val.tokens,
        estimated_spend_today_usd: val.spend
      };
    });
    await sql`
      INSERT INTO usage_counters ${sql(counterRows)}
      ON CONFLICT (user_id, day_ph) DO UPDATE SET
        messages_today = EXCLUDED.messages_today,
        tokens_today = EXCLUDED.tokens_today,
        estimated_spend_today_usd = EXCLUDED.estimated_spend_today_usd,
        updated_at = NOW()
    `;
  }
  console.log(`  ${counterMap.size} usage counter rows`);

  // ── Telemetry events ─────────────────────────────────────────────────
  console.log('\nCreating telemetry events...');
  const eventNames = [
    'login_success',
    'login_denied',
    'advisor_selected',
    'conversation_resumed',
    'message_sent',
    'llm_call_started',
    'llm_call_completed',
    'request_blocked',
    'prompt_cache_hit',
    'prompt_cache_miss',
    'admin_cache_refresh',
    'admin_cache_refresh_failed',
    'rate_limit_hit',
    'budget_limit_hit'
  ];
  const telemetryRows: Array<{
    id: string;
    event_name: string;
    actor_id: string | null;
    severity: string;
    payload: Record<string, unknown>;
    created_at: Date;
  }> = [];

  for (let i = 0; i < 500; i++) {
    const eventName = pick(eventNames);
    const isError =
      eventName.includes('denied') ||
      eventName.includes('failed') ||
      eventName.includes('limit');
    const severity =
      isError && Math.random() < 0.5
        ? 'error'
        : isError && Math.random() < 0.5
          ? 'warning'
          : 'info';
    const actor = Math.random() < 0.8 ? pick(eifRows) : pick(userRows);
    const daysAgo = rand(0, 60);
    const payload: Record<string, unknown> = {
      source: 'seed',
      iteration: i,
      duration_ms:
        eventName === 'llm_call_completed' ? rand(200, 8000) : undefined,
      model: eventName === 'llm_call_completed' ? pick(models) : undefined,
      provider:
        eventName === 'llm_call_completed' ? pick(providers) : undefined,
      tokens_used:
        eventName === 'llm_call_completed' ? rand(100, 4000) : undefined,
      reason: eventName === 'rate_limit_hit' ? 'exceeded quota' : undefined
    };
    Object.keys(payload).forEach(
      (k) => payload[k] === undefined && delete payload[k]
    );
    telemetryRows.push({
      id: randomUUID(),
      event_name: eventName,
      actor_id: actor.id,
      severity,
      payload,
      created_at: daysAgoDate(daysAgo, rand(0, 23))
    });
  }
  if (telemetryRows.length > 0) {
    await sql`
      INSERT INTO telemetry_events ${sql(telemetryRows)}
    `;
  }
  console.log(`  ${telemetryRows.length} telemetry events`);

  // ── Knowledge sources and units ──────────────────────────────────────
  console.log('\nCreating knowledge sources and units...');
  const knowledgeSources = [
    {
      source_type: 'google_doc',
      external_id: '1abc123',
      title: 'EIF Mentor Handbook',
      status: 'published',
      advisor_scope: 'global',
      content_type: 'mentor_guide'
    },
    {
      source_type: 'manual',
      external_id: 'manual-faq',
      title: 'Frequently Asked Questions',
      status: 'published',
      advisor_scope: 'global',
      content_type: 'faq'
    },
    {
      source_type: 'google_doc',
      external_id: '1def456',
      title: 'Data Modeling Best Practices',
      status: 'published',
      advisor_scope: 'global',
      content_type: 'curriculum_guide'
    },
    {
      source_type: 'google_doc',
      external_id: '1ghi789',
      title: 'Capstone Project Guidelines',
      status: 'published',
      advisor_scope: 'global',
      content_type: 'project_guide'
    },
    {
      source_type: 'manual',
      external_id: 'manual-onboarding',
      title: 'EIF Onboarding Checklist',
      status: 'published',
      advisor_scope: 'global',
      content_type: 'onboarding'
    },
    {
      source_type: 'google_doc',
      external_id: '1jkl012',
      title: 'SQL Reference for EIFs',
      status: 'published',
      advisor_scope: 'global',
      content_type: 'reference'
    }
  ];
  const sourceRows = knowledgeSources.map(() => ({ id: randomUUID() }));
  for (const [i, src] of knowledgeSources.entries()) {
    await sql`
      INSERT INTO knowledge_sources ${sql({
        id: sourceRows[i].id,
        source_type: src.source_type,
        external_id: src.external_id,
        title: src.title,
        status: src.status,
        advisor_scope: src.advisor_scope,
        content_type: src.content_type
      })}
      ON CONFLICT (id) DO NOTHING
    `;
  }
  let unitsCreated = 0;
  for (const src of sourceRows) {
    const numUnits = rand(2, 4);
    for (let ui = 0; ui < numUnits; ui++) {
      await sql`
        INSERT INTO knowledge_units ${sql({
          id: randomUUID(),
          source_id: src.id,
          source_revision: 'v1',
          section_path: `/section-${ui + 1}`,
          content_type: 'advisor_reference',
          status: 'published',
          text: `Content for unit ${ui + 1} of source ${src.id}: practical guidance for Eskwelabs learners.`,
          summary: `Unit ${ui + 1} summary`,
          content_hash: `hash-${src.id}-${ui}`
        })}
        ON CONFLICT (id) DO NOTHING
      `;
      unitsCreated++;
    }
  }
  console.log(`  ${knowledgeSources.length} sources, ${unitsCreated} units`);

  // ── Prompt snapshots ─────────────────────────────────────────────────
  console.log('\nCreating prompt snapshots...');
  for (const a of advisors) {
    await sql`
      INSERT INTO prompt_snapshots ${sql({
        id: randomUUID(),
        advisor_id: a.id,
        doc_id: `seed-doc-${a.id}`,
        revision: 'seed-v1',
        content_text: `System prompt for ${a.name}. You are a helpful advisor.`,
        hash: `${a.id}-seed-hash`,
        is_active: true
      })}
      ON CONFLICT DO NOTHING
    `;
  }
  console.log(`  ${advisors.length} snapshots`);

  // ── DNA digest ───────────────────────────────────────────────────────
  console.log('\nCreating DNA digest...');
  const digestId = randomUUID();
  await sql`
    INSERT INTO dna_digests ${sql({
      id: digestId,
      doc_id: 'seed-dna-doc',
      revision: 'seed-v1',
      digest_text: 'DNA: This platform helps data science learners.',
      hash: 'dna-seed-hash',
      is_active: true
    })}
    ON CONFLICT DO NOTHING
  `;
  console.log('  1 DNA digest');

  // ── Usage limits ─────────────────────────────────────────────────────
  console.log('\nCreating usage limits...');
  await sql`
    INSERT INTO usage_limits ${sql({
      id: 'default',
      max_messages_per_user_per_day: 25,
      max_tokens_per_user_per_day: 100000,
      daily_budget_usd: '10',
      monthly_budget_usd: '300',
      rate_limit_window_seconds: 60,
      rate_limit_max_requests: 100
    })}
    ON CONFLICT (id) DO NOTHING
  `;
  console.log('  1 limits row');

  // ── Usage budget counters ────────────────────────────────────────────
  console.log('\nCreating budget counters...');
  const now = new Date();
  const budgetRows = [];
  for (let m = 0; m < 6; m++) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    const monthlyKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    budgetRows.push({
      period_kind: 'monthly',
      period_key: monthlyKey,
      estimated_spend_usd: (Math.random() * 250 + 10).toFixed(6)
    });
    for (let wd = 0; wd < 4; wd++) {
      const dd = new Date(d);
      dd.setDate(dd.getDate() - wd * 7);
      budgetRows.push({
        period_kind: 'daily',
        period_key: dd.toISOString().slice(0, 10),
        estimated_spend_usd: (Math.random() * 8 + 1).toFixed(6)
      });
    }
  }
  if (budgetRows.length > 0) {
    await sql`
      INSERT INTO usage_budget_counters ${sql(budgetRows)}
      ON CONFLICT (period_kind, period_key) DO UPDATE SET
        estimated_spend_usd = EXCLUDED.estimated_spend_usd,
        updated_at = NOW()
    `;
  }
  console.log(`  ${budgetRows.length} budget counter rows`);

  // ── Usage limit audit events ─────────────────────────────────────────
  console.log('\nCreating usage limit audit events...');
  const auditRows = [
    {
      changed_by: userRows.find((u) => u.role === 'admin')?.id,
      previous_config: null,
      next_config: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerUserPerDay: 100000,
        dailyBudgetUsd: '10',
        monthlyBudgetUsd: '300',
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100
      },
      created_at: daysAgoDate(30)
    },
    {
      changed_by: userRows.find((u) => u.role === 'admin')?.id,
      previous_config: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerUserPerDay: 100000,
        dailyBudgetUsd: '10',
        monthlyBudgetUsd: '300',
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100
      },
      next_config: {
        maxMessagesPerUserPerDay: 50,
        maxTokensPerUserPerDay: 150000,
        dailyBudgetUsd: '15',
        monthlyBudgetUsd: '300',
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100
      },
      created_at: daysAgoDate(15)
    },
    {
      changed_by: userRows.find((u) => u.role === 'admin')?.id,
      previous_config: {
        maxMessagesPerUserPerDay: 50,
        maxTokensPerUserPerDay: 150000,
        dailyBudgetUsd: '15',
        monthlyBudgetUsd: '300',
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100
      },
      next_config: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerUserPerDay: 100000,
        dailyBudgetUsd: '10',
        monthlyBudgetUsd: '300',
        rateLimitWindowSeconds: 60,
        rateLimitMaxRequests: 100
      },
      created_at: daysAgoDate(3)
    },
    {
      changed_by: userRows.find((u) => u.role === 'admin')?.id,
      previous_config: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerUserPerDay: 100000,
        dailyBudgetUsd: '10',
        monthlyBudgetUsd: '300'
      },
      next_config: {
        maxMessagesPerUserPerDay: 30,
        maxTokensPerUserPerDay: 120000,
        dailyBudgetUsd: '12',
        monthlyBudgetUsd: '360'
      },
      created_at: daysAgoDate(60)
    },
    {
      changed_by: userRows.find((u) => u.role === 'admin')?.id,
      previous_config: {
        maxMessagesPerUserPerDay: 30,
        maxTokensPerUserPerDay: 120000,
        dailyBudgetUsd: '12',
        monthlyBudgetUsd: '360'
      },
      next_config: {
        maxMessagesPerUserPerDay: 25,
        maxTokensPerUserPerDay: 100000,
        dailyBudgetUsd: '10',
        monthlyBudgetUsd: '300'
      },
      created_at: daysAgoDate(45)
    }
  ];
  await sql`
    INSERT INTO usage_limit_audit_events ${sql(auditRows)}
  `;
  console.log(`  ${auditRows.length} audit events`);

  // ── Summary ──────────────────────────────────────────────────────────
  console.log(`\n--- Summary ---`);
  console.log(`Users             : ${userRows.length}`);
  console.log(`Advisors found    : ${advisors.length}`);
  console.log(`Conversations     : ${conversationsCreated}`);
  console.log(`Messages          : ${messagesCreated}`);
  console.log(`Usage counters    : ${counterMap.size}`);
  console.log(`Telemetry events  : ${telemetryRows.length}`);
  console.log(`Knowledge sources : ${knowledgeSources.length}`);
  console.log(`Knowledge units   : ${unitsCreated}`);
  console.log(`Budget counters   : ${budgetRows.length}`);
  console.log(`Audit events      : ${auditRows.length}`);
  console.log(`\nSeeding complete.`);
}

try {
  await main();
} catch (error) {
  console.error('Seed failed:', error);
  process.exit(1);
} finally {
  await sql.end();
}
