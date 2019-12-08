use std::error::Error;
use std::thread;

use diesel::prelude::*;
use diesel::sql_types::{Bool, Double, Text};
use juniper::FieldResult;

use super::*;
use crate::contest::api::{ApiConfig, ApiContext};
use crate::contest::contest_problem::ProblemData;
use crate::contest::contest_submission::{submission_files, SubmissionData};
use award::{AwardName, Score};
use contest_submission::{self, Submission, SubmissionStatus};
use evaluation::{Evaluation, Event};
use problem::driver::ProblemDriver;
use schema::{awards, evaluation_events};
use std::path::{Path, PathBuf};

/// An evaluation event
#[derive(Queryable, Serialize, Deserialize, Clone, Debug)]
pub struct EvaluationEvent {
    /// id of the submission
    submission_id: String,

    /// serial number of the event
    serial: i32,

    /// value of the event, serialized
    event_json: String,
}

#[juniper::object]
impl EvaluationEvent {
    /// serial number of the event
    fn serial(&self) -> i32 {
        self.serial
    }

    /// value of this evaluation event
    fn event(&self) -> FieldResult<Event> {
        Ok(serde_json::from_str(&self.event_json)?)
    }

    /// events as JSON format
    /// This is currently provided only as a woraround the fact that
    /// events doesn't work, and should be removed in the future!
    fn event_json(&self) -> &String {
        &self.event_json
    }
}

#[derive(Insertable)]
#[table_name = "evaluation_events"]
struct EvaluationEventInput<'a> {
    submission_id: &'a str,
    serial: i32,
    event_json: String,
}

#[derive(Insertable)]
#[table_name = "awards"]
struct AwardInput<'a> {
    kind: &'a str,
    submission_id: &'a str,
    award_name: &'a str,
    value: f64,
}

#[derive(Queryable)]
pub struct AwardData {
    #[allow(dead_code)]
    kind: String,

    /// Id of the submission
    #[allow(dead_code)]
    submission_id: String,

    /// Name of the award
    award_name: String,

    value: f64,
}

pub struct ScoreAward {
    pub data: AwardData,
}

pub struct BadgeAward {
    pub data: AwardData,
}

#[juniper::object]
impl ScoreAward {
    /// The score
    fn score(&self) -> Score {
        Score(self.data.value)
    }

    /// Name of the award
    fn award_name(&self) -> AwardName {
        AwardName(self.data.award_name.clone())
    }
}

#[juniper::object]
impl BadgeAward {
    /// The badge
    fn badge(&self) -> bool {
        self.data.value == 1f64
    }

    /// Name of the award
    fn award_name(&self) -> AwardName {
        AwardName(self.data.award_name.clone())
    }
}

#[derive(QueryableByName)]
pub struct MaxAwardData {
    #[sql_type = "Text"]
    award_name: String,

    #[sql_type = "Double"]
    value: f64,

    #[sql_type = "Text"]
    submission_id: String,
}

pub struct MaxScoreAward {
    pub data: MaxAwardData,
}

/// Maximum score award
#[juniper::object]
impl MaxScoreAward {
    /// Id of the most recent submission that made the max score
    fn submission_id(&self) -> &String {
        &self.data.submission_id
    }

    /// The score
    fn score(&self) -> Score {
        Score(self.data.value)
    }

    /// Name of the award
    fn award_name(&self) -> &String {
        &self.data.award_name
    }
}

pub struct BestBadgeAward {
    pub data: MaxAwardData,
}

/// Beste badge award
#[juniper::object]
impl BestBadgeAward {
    /// Id of the most recent submission that made the max score
    fn submission_id(&self) -> &String {
        &self.data.submission_id
    }

    /// The score
    fn badge(&self) -> bool {
        self.data.value == 1f64
    }

    /// Name of the award
    fn award_name(&self) -> &String {
        &self.data.award_name
    }
}

fn insert_event(
    conn: &SqliteConnection,
    serial: i32,
    submission_id: &str,
    event: &Event,
) -> Result<()> {
    if let Event::Score(score_event) = event {
        let score_award_input = AwardInput {
            kind: "SCORE",
            award_name: &score_event.award_name.0,
            value: score_event.score.0,
            submission_id,
        };
        diesel::insert_into(awards::table)
            .values(&score_award_input)
            .execute(conn)?;
    }
    if let Event::Badge(badge_event) = event {
        let badge_award_input = AwardInput {
            kind: "BADGE",
            award_name: &badge_event.award_name.0,
            value: if badge_event.badge { 1f64 } else { 0f64 },
            submission_id,
        };
        diesel::insert_into(awards::table)
            .values(&badge_award_input)
            .execute(conn)?;
    }
    let event_input = EvaluationEventInput {
        serial,
        submission_id,
        event_json: serde_json::to_string(event)?,
    };
    diesel::insert_into(evaluation_events::table)
        .values(&event_input)
        .execute(conn)?;
    Ok(())
}

/// return a list of evaluation events for the specified evaluation
pub fn query_events(
    conn: &SqliteConnection,
    submission_id: &str,
) -> QueryResult<Vec<EvaluationEvent>> {
    evaluation_events::table
        .filter(evaluation_events::dsl::submission_id.eq(submission_id))
        .load(conn)
}

/// Get the best score award for (user, problem)
pub fn query_awards_of_user_and_problem(
    conn: &SqliteConnection,
    kind: &str,
    user_id: &str,
    problem_name: &str,
) -> QueryResult<Vec<MaxAwardData>> {
    diesel::sql_query(
        "
        SELECT sc.award_name, MAX(sc.value) as value, (
            SELECT s.id
            FROM submissions s JOIN awards sci ON s.id = sci.submission_id
            WHERE sci.value = value AND sci.kind = sc.kind AND sci.award_name = sc.award_name
            ORDER BY s.created_at DESC
            LIMIT 1
        ) as submission_id
        FROM awards sc JOIN submissions s ON sc.submission_id = s.id
        WHERE sc.kind = ? AND s.problem_name = ? AND s.user_id = ?
        GROUP BY sc.award_name
    ",
    )
    .bind::<Text, _>(kind)
    .bind::<Text, _>(problem_name)
    .bind::<Text, _>(user_id)
    .load::<MaxAwardData>(conn)
}

/// Get the awards of (user, problem, submission)
pub fn query_awards(
    conn: &SqliteConnection,
    kind: &str,
    submission_id: &str,
) -> QueryResult<Vec<AwardData>> {
    awards::table
        .filter(awards::dsl::kind.eq(kind))
        .filter(awards::dsl::submission_id.eq(submission_id))
        .load(conn)
}

/// start the evaluation thread
pub fn evaluate<P: AsRef<Path>>(
    problem_path: P,
    submission_data: &SubmissionData,
    config: &ApiConfig,
) -> QueryResult<()> {
    let config = config.clone();
    let submission_data = submission_data.clone();
    let problem_path = problem_path.as_ref().to_owned();
    thread::spawn(move || {
        let context = config.create_context(None);

        let mut field_values = Vec::new();
        let files = submission_files(&context.database, &submission_data.id)
            .expect("Unable to load submission files");
        for file in files {
            field_values.push(submission::FieldValue {
                field: submission::FieldId(file.field_id.clone()),
                file: submission::File {
                    name: submission::FileName(file.name.clone()),
                    content: file.content.clone(),
                },
            })
        }

        let submission = submission::Submission { field_values };

        let Evaluation(receiver) = do_evaluate(problem_path, submission);
        for (serial, event) in receiver.into_iter().enumerate() {
            insert_event(
                &context.database,
                serial as i32,
                &submission_data.id,
                &event,
            )
            .unwrap();
        }
        contest_submission::set_status(
            &context.database,
            &submission_data.id,
            SubmissionStatus::Success,
        )
        .unwrap();
    });
    Ok(())
}

#[cfg(feature = "task-maker")]
fn do_evaluate<P: AsRef<Path>>(
    problem_path: P,
    submission: submission::Submission,
) -> evaluation::Evaluation {
    use task_maker::driver::IoiProblemDriver;
    IoiProblemDriver::evaluate(problem_path, submission)
}

#[cfg(not(feature = "task-maker"))]
fn do_evaluate<P: AsRef<Path>>(
    problem_path: P,
    submission: submission::Submission,
) -> evaluation::Evaluation {
    unreachable!("Enable feature 'task-maker' to evaluate solutions")
}
