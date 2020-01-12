use std::convert::TryInto;
use std::path::{Path, PathBuf};

use crate::data::award::{
    Award, AwardDomain, AwardMaterial, AwardName, BadgeAwardDomain, Score, ScoreAwardDomain,
    ScoreRange,
};
use crate::data::content::{FileName, FileVariant, MediaType, Text, TextVariant, VariantAttribute};
use crate::data::evaluation::record::Key;
use crate::data::feedback::table::{
    AwardReferenceCellContent, AwardReferenceColContent, Cell, CellContent, Col, ColContent,
    MemoryUsageCellContent, MemoryUsageColContent, MessageCellContent, MessageColContent, Row,
    RowNumberCellContent, RowNumberColContent, ScoreCellContent, ScoreColContent, TableSection,
    TimeUsageCellContent, TimeUsageColContent,
};
use crate::data::feedback::Section;
use crate::data::file::FileContent;
use crate::data::problem::material::{Attachment, Material};
use crate::data::rusage::{MemoryUsage, TimeUsage};
use crate::data::submission::{Field, FieldId, FileType, FileTypeExtension, FileTypeId, Form};
use task_maker_format::ioi;

fn subtasks_of(task: &ioi::Task) -> Vec<&ioi::SubtaskInfo> {
    let mut subtasks: Vec<_> = task.subtasks.values().collect();
    subtasks.sort_by(|a, b| a.id.cmp(&b.id));
    subtasks
}

fn testcases_of(subtask: &ioi::SubtaskInfo) -> Vec<&ioi::TestcaseInfo> {
    let mut testcases: Vec<_> = subtask.testcases.values().collect();
    testcases.sort_by(|a, b| a.id.cmp(&b.id));
    testcases
}

fn submission_form() -> Form {
    Form {
        fields: vec![Field {
            id: FieldId("solution".into()),
            title: vec![TextVariant {
                attributes: vec![],
                value: "Solution".into(),
            }],
            types: vec![FileType {
                id: FileTypeId("cpp".into()),
                title: vec![TextVariant {
                    attributes: vec![],
                    value: "C++".into(),
                }],
                extensions: vec![
                    FileTypeExtension(".cpp".into()),
                    FileTypeExtension(".cc".into()),
                ],
                primary_extension: FileTypeExtension(".cpp".into()),
            }],
        }],
    }
}

fn award_of(subtask: &ioi::SubtaskInfo) -> Award {
    let has_positive_score = subtask.max_score > 0.0;
    Award {
        name: AwardName(format!(
            "subtask.{}.{}",
            subtask.id,
            if has_positive_score { "score" } else { "badge" }
        )),
        material: AwardMaterial {
            title: vec![
                TextVariant {
                    attributes: vec![],
                    value: format!("Subtask {}", subtask.id),
                },
                TextVariant {
                    attributes: vec![VariantAttribute {
                        key: "style".to_owned(),
                        value: "short".to_owned(),
                    }],
                    value: format!("ST {}", subtask.id),
                },
            ],
            domain: if has_positive_score {
                AwardDomain::Score(ScoreAwardDomain {
                    range: ScoreRange {
                        // TODO: determine actual precision (may depend on the task)
                        precision: 0,
                        max: Score(subtask.max_score),
                        // TODO: determine whether partial scores are allowed (may depend on the task)
                        allow_partial: true,
                    },
                })
            } else {
                AwardDomain::Badge(BadgeAwardDomain)
            },
        },
    }
}

fn cols() -> Vec<Col> {
    vec![
        Col {
            title: vec![TextVariant {
                attributes: vec![],
                value: "Subtask".to_owned(),
            }],
            content: ColContent::AwardReference(AwardReferenceColContent),
        },
        Col {
            title: vec![TextVariant {
                attributes: vec![],
                value: "Case".to_owned(),
            }],
            content: ColContent::RowNumber(RowNumberColContent),
        },
        Col {
            title: vec![TextVariant {
                attributes: vec![],
                value: "Time usage".to_owned(),
            }],
            content: ColContent::TimeUsage(TimeUsageColContent),
        },
        Col {
            title: vec![TextVariant {
                attributes: vec![],
                value: "Memory usage".to_owned(),
            }],
            content: ColContent::MemoryUsage(MemoryUsageColContent),
        },
        Col {
            title: vec![TextVariant {
                attributes: vec![],
                value: "Message".to_owned(),
            }],
            content: ColContent::Message(MessageColContent),
        },
        Col {
            title: vec![TextVariant {
                attributes: vec![],
                value: "Score".to_owned(),
            }],
            content: ColContent::Score(ScoreColContent {
                range: ScoreRange {
                    // TODO: determine actual precision
                    precision: 2,
                    max: Score(1.),
                    // TODO: determine if partial scores are actually allowed
                    allow_partial: true,
                },
            }),
        },
    ]
}

fn caption() -> Text {
    vec![TextVariant {
        attributes: vec![],
        value: "Test case results".to_owned(),
    }]
}

fn row_of(task: &ioi::Task, subtask: &ioi::SubtaskInfo, testcase: &ioi::TestcaseInfo) -> Row {
    Row {
        cells: vec![
            Cell {
                content: CellContent::AwardReference(AwardReferenceCellContent {
                    award_name: award_of(subtask).name,
                }),
            },
            Cell {
                content: CellContent::RowNumber(RowNumberCellContent {
                    number: testcase.id.try_into().expect("Testcase ID too large"),
                }),
            },
            Cell {
                content: CellContent::TimeUsage(TimeUsageCellContent {
                    max_relevant: TimeUsage(task.time_limit.unwrap_or(10.0)),
                    primary_watermark: task.time_limit.map(TimeUsage),
                    key: Key(format!("testcase.{}.time_usage", testcase.id)),
                    valence_key: Some(Key(format!("testcase.{}.time_usage_valence", testcase.id))),
                }),
            },
            Cell {
                content: CellContent::MemoryUsage(MemoryUsageCellContent {
                    max_relevant: MemoryUsage(
                        (task.memory_limit.unwrap_or(1024) * 1024 * 1024 * 2) as i32,
                    ),
                    primary_watermark: task
                        .memory_limit
                        .map(|l| MemoryUsage((l * 1024 * 1024) as i32)),
                    key: Key(format!("testcase.{}.memory_usage", testcase.id)),
                    valence_key: Some(Key(format!(
                        "testcase.{}.memory_usage_valence",
                        testcase.id
                    ))),
                }),
            },
            Cell {
                content: CellContent::Message(MessageCellContent {
                    key: Key(format!("testcase.{}.message", testcase.id)),
                    valence_key: Some(Key(format!("testcase.{}.valence", testcase.id))),
                }),
            },
            Cell {
                content: CellContent::Score(ScoreCellContent {
                    range: ScoreRange {
                        precision: 2,
                        max: Score(1.),
                        allow_partial: true,
                    },
                    key: Key(format!("testcase.{}.score", testcase.id)),
                }),
            },
        ],
    }
}

fn files_in_dir(dir_path: &std::path::PathBuf) -> impl Iterator<Item = std::path::PathBuf> {
    std::fs::read_dir(dir_path)
        .expect("unable to read_dir")
        .map(|entry| entry.expect("unable to read_dir").path())
}

fn attachment_at_path(file_path: std::path::PathBuf) -> Attachment {
    Attachment {
        title: vec![TextVariant {
            attributes: vec![],
            value: file_path
                .file_name()
                .unwrap()
                .to_string_lossy()
                .into_owned(),
        }],
        file: vec![FileVariant {
            attributes: vec![],
            name: Some(FileName(
                file_path
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .into_owned(),
            )),
            r#type: mime_guess::from_path(&file_path)
                .first_raw()
                .map(|t| MediaType(t.to_owned())),
            content: FileContent(std::fs::read(&file_path.to_string_lossy().as_ref()).unwrap()),
        }],
    }
}

/// Find the statements directory, as in the italy_yaml task format
/// Searches the paths $task_dir/statement and $task_dir/testo
fn statements_dir(task_dir: &Path) -> Option<PathBuf> {
    for dir in &["statement", "testo"] {
        let dir = task_dir.join(dir);
        if dir.exists() && dir.is_dir() {
            return Some(dir);
        }
    }
    None
}

/// find all the statements in the directory
fn statements_of(task_dir: &Path) -> Vec<FileVariant> {
    let mut result = Vec::new();

    if let Some(dir) = statements_dir(task_dir) {
        for entry in dir.read_dir().unwrap() {
            let path = entry.unwrap().path();
            let ext = path.extension().unwrap().to_str().unwrap();
            let name = path.file_name().unwrap().to_str().unwrap();
            let stem = path.file_stem().unwrap().to_str().unwrap();

            if let "statement" | "testo" = stem {
                let mime_type = match ext {
                    "pdf" => Some("application/pdf"),
                    "html" => Some("text/html"),
                    "md" => Some("application/markdown"),
                    _ => None,
                };

                if let Some(mime_type) = mime_type {
                    result.push(FileVariant {
                        attributes: vec![],
                        name: Some(FileName(name.to_owned())),
                        r#type: Some(MediaType(mime_type.to_owned())),
                        content: FileContent(
                            std::fs::read(path).expect("Unable to read statement file"),
                        ),
                    });
                }
            }
        }
    }
    result
}

pub fn generate_material(task: &ioi::Task) -> Material {
    Material {
        title: vec![
            TextVariant {
                attributes: vec![],
                value: task.title.clone(),
            },
            TextVariant {
                attributes: vec![VariantAttribute {
                    key: "style".to_owned(),
                    value: "short".to_owned(),
                }],
                value: task.name.clone(),
            },
        ],
        statement: statements_of(&task.path),
        attachments: files_in_dir(&task.path.join("att"))
            .map(attachment_at_path)
            .collect(),
        submission_form: submission_form(),
        awards: { subtasks_of(task).into_iter().map(award_of).collect() },
        feedback: vec![Section::Table(TableSection {
            caption: caption(),
            cols: cols(),
            rows: subtasks_of(task)
                .into_iter()
                .flat_map(|subtask| {
                    testcases_of(subtask)
                        .into_iter()
                        .map(|testcase| row_of(task, subtask, testcase))
                        .collect::<Vec<_>>()
                })
                .collect(),
        })],
    }
}
