use std::default::Default;
use std::env::temp_dir;
use std::path::{Path, PathBuf};

use chrono::{DateTime, Local};
use diesel::{Connection, ConnectionResult, RunQueryDsl, SqliteConnection};
use juniper::{FieldError, FieldResult};
use structopt::StructOpt;

use auth::JwtData;
use contest::{ContestView, UserToken};
use contest_problem::Problem;
use formats::{import, ImportInput};
use problem::ProblemName;
use user::UserId;
use user::UserInput;

use crate::contest::contest::{current_contest, ContestDataInput, ContestUpdateInput};
use crate::contest::contest_problem::ProblemInput;
use crate::contest::user::User;

use super::*;

embed_migrations!();

pub struct MutationOk;

#[juniper::object]
impl MutationOk {
    fn ok() -> bool {
        true
    }
}

pub type RootNode<'a> = juniper::RootNode<'static, Query<'a>, Mutation<'a>>;

#[derive(StructOpt, Debug)]
pub struct ContestArgs {
    /// url of the database
    #[structopt(long, env = "DATABASE_URL", default_value = "./database.sqlite3")]
    pub database_url: PathBuf,
}

#[derive(Debug, Clone)]
pub struct ApiConfig {
    /// Skip all authentication
    skip_auth: bool,

    /// Secret code to use for authenticating a JWT token.
    pub secret: Option<Vec<u8>>,

    /// Path of the database on the filesystem
    pub database_url: PathBuf,
}

pub struct ApiContext<'a> {
    pub config: &'a ApiConfig,
    /// JWT data of the token submitted to the server (if any)
    pub jwt_data: Option<JwtData>,
    pub database: SqliteConnection,
    pub workspace_path: PathBuf,
}

impl Default for ApiConfig {
    fn default() -> ApiConfig {
        ApiConfig {
            skip_auth: false,
            secret: None,
            database_url: PathBuf::default(),
        }
    }
}

impl ApiConfig {
    pub fn create_context(&self, jwt_data: Option<JwtData>) -> ApiContext {
        // FIXME: should not create directory here
        let workspace_path = temp_dir().join("turingarena");
        std::fs::create_dir_all(&workspace_path).expect("Unable to create workspace dir");

        ApiContext {
            config: &self,
            database: self.connect_db(),
            jwt_data,
            workspace_path,
        }
    }

    fn connect_db(&self) -> SqliteConnection {
        let conn = SqliteConnection::establish(self.database_url.to_str().unwrap())
            .expect("Unable to establish connection");
        conn.execute("PRAGMA busy_timeout = 5000;")
            .expect("Unable to set `busy_timeout`");
        conn
    }

    pub fn with_args(self, args: ContestArgs) -> ApiConfig {
        self.with_database_url(args.database_url)
    }

    /// Set the database URL
    pub fn with_database_url(self, database_url: PathBuf) -> ApiConfig {
        ApiConfig {
            database_url,
            ..self
        }
    }

    /// Sets a secret
    pub fn with_secret(self, secret: Option<Vec<u8>>) -> ApiConfig {
        ApiConfig { secret, ..self }
    }

    /// Sets if to skip authentication
    pub fn with_skip_auth(self, skip_auth: bool) -> ApiConfig {
        ApiConfig { skip_auth, ..self }
    }
}

impl ApiContext<'_> {
    pub fn root_node(&self) -> RootNode {
        RootNode::new(Query { context: &self }, Mutation { context: &self })
    }

    pub fn workspace_path(&self) -> &Path {
        &self.workspace_path
    }

    pub fn unpack_archive<T: AsRef<[u8]>>(&self, content: T, prefix: &str) -> PathBuf {
        let workspace_path = &self.workspace_path().to_owned();

        archive::unpack_archive(workspace_path, content, prefix)
    }

    /// Authorize admin operations
    #[must_use = "Error means forbidden"]
    pub fn authorize_admin(&self) -> juniper::FieldResult<()> {
        if self.config.skip_auth {
            return Ok(());
        }
        return Err(juniper::FieldError::from("Forbidden"));
    }

    /// Authenticate user
    #[must_use = "Error means forbidden"]
    pub fn authorize_user(&self, user_id: &Option<UserId>) -> juniper::FieldResult<()> {
        if self.config.skip_auth {
            return Ok(());
        }

        if let Some(id) = user_id {
            if self.config.secret != None {
                if let Some(data) = &self.jwt_data {
                    if data.user != id.0 {
                        return Err(juniper::FieldError::from("Forbidden for the given user id"));
                    }
                } else {
                    return Err(juniper::FieldError::from("Authentication required"));
                }
            }
        }
        Ok(())
    }
}

pub struct Query<'a> {
    pub context: &'a ApiContext<'a>,
}

#[juniper_ext::graphql]
impl Query<'_> {
    /// Get the view of a contest
    fn contest_view(&self, user_id: Option<UserId>) -> FieldResult<ContestView> {
        self.context.authorize_user(&user_id)?;

        Ok(ContestView {
            context: self.context,
            data: current_contest(&self.context.database)?,
            user_id,
        })
    }

    fn users(&self) -> FieldResult<Vec<User>> {
        self.context.authorize_admin()?;

        Ok(user::list(&self.context.database)?)
    }

    /// Get the submission with the specified id
    fn submission(&self, submission_id: String) -> FieldResult<contest_submission::Submission> {
        // TODO: check privilage
        let data = contest_submission::query(&self.context.database, &submission_id)?;
        Ok(contest_submission::Submission {
            context: self.context,
            data,
        })
    }

    /// Current time on the server as RFC3339 date
    fn server_time(&self) -> String {
        chrono::Local::now().to_rfc3339()
    }
}

pub struct Mutation<'a> {
    pub context: &'a ApiContext<'a>,
}

#[juniper_ext::graphql]
impl Mutation<'_> {
    /// Reset database
    fn init_db(&self) -> FieldResult<MutationOk> {
        self.context.authorize_admin()?;

        embedded_migrations::run_with_output(&self.context.database, &mut std::io::stdout())?;
        let now = chrono::Local::now();
        let configuration = ContestDataInput {
            archive_content: include_bytes!(concat!(env!("OUT_DIR"), "/initial-contest.tar.xz")),
            start_time: &now.to_rfc3339(),
            end_time: &(now + chrono::Duration::hours(4)).to_rfc3339(),
        };
        diesel::insert_into(schema::contest::table)
            .values(configuration)
            .execute(&self.context.database)?;

        Ok(MutationOk)
    }

    /// Authenticate a user, generating a JWT authentication token
    fn auth(&self, token: String) -> FieldResult<Option<UserToken>> {
        Ok(auth::auth(
            &self.context.database,
            &token,
            self.context
                .config
                .secret
                .as_ref()
                .ok_or_else(|| FieldError::from("Authentication disabled"))?,
        )?)
    }

    /// Current time on the server as RFC3339 date
    fn server_time() -> String {
        chrono::Local::now().to_rfc3339()
    }

    /// Add a user to the current contest
    pub fn update_contest(&self, input: ContestUpdateInput) -> FieldResult<MutationOk> {
        use diesel::ExpressionMethods;
        self.context.authorize_admin()?;

        match input.archive_content {
            Some(content) => {
                diesel::update(schema::contest::table)
                    .set(schema::contest::dsl::archive_content.eq(&content.decode()?))
                    .execute(&self.context.database)?;
            }
            None => {}
        }

        match input.start_time {
            Some(time) => {
                diesel::update(schema::contest::table)
                    .set(
                        schema::contest::dsl::start_time
                            .eq(&chrono::DateTime::parse_from_rfc3339(&time)?.to_rfc3339()),
                    )
                    .execute(&self.context.database)?;
            }
            None => {}
        }

        match input.end_time {
            Some(time) => {
                diesel::update(schema::contest::table)
                    .set(
                        schema::contest::dsl::end_time
                            .eq(&chrono::DateTime::parse_from_rfc3339(&time)?.to_rfc3339()),
                    )
                    .execute(&self.context.database)?;
            }
            None => {}
        }

        Ok(MutationOk)
    }

    /// Add a user to the current contest
    pub fn add_users(&self, inputs: Vec<UserInput>) -> FieldResult<MutationOk> {
        self.context.authorize_admin()?;

        user::insert(&self.context.database, inputs)?;

        Ok(MutationOk)
    }

    /// Delete a user from the current contest
    pub fn delete_users(&self, ids: Vec<String>) -> FieldResult<MutationOk> {
        self.context.authorize_admin()?;

        user::delete(&self.context.database, ids)?;

        Ok(MutationOk)
    }

    /// Add a problem to the current contest
    pub fn add_problems(&self, inputs: Vec<ProblemInput>) -> FieldResult<MutationOk> {
        contest_problem::insert(&self.context.database, inputs)?;
        Ok(MutationOk)
    }

    /// Delete a problem from the current contest
    pub fn delete_problem(&self, name: String) -> FieldResult<MutationOk> {
        contest_problem::delete(&self.context.database, ProblemName(name))?;
        Ok(MutationOk)
    }

    /// Import a file
    pub fn import(&self, input: ImportInput) -> FieldResult<MutationOk> {
        import(&self.context, &input)?;
        Ok(MutationOk)
    }

    /// Submit a solution to the problem
    fn submit(
        &self,
        user_id: UserId,
        problem_name: ProblemName,
        files: Vec<contest_submission::FileInput>,
    ) -> FieldResult<contest_submission::Submission> {
        let conn = &self.context.database;
        let data = contest_submission::insert(&conn, &user_id.0, &problem_name.0, files)?;
        let problem = Problem {
            data: contest_problem::by_name(&conn, problem_name)?,
            contest_view: &ContestView {
                context: self.context,
                data: current_contest(&self.context.database)?,
                user_id: Some(user_id),
            },
        };
        let submission = contest_submission::Submission {
            context: self.context,
            data: data.clone(),
        };
        contest_evaluation::evaluate(problem.unpack(), &data, &self.context.config)?;
        Ok(submission)
    }
}