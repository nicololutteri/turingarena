import gql from 'graphql-tag';

import { ProblemMaterialFragment } from './__generated__/ProblemMaterialFragment';
import { textFragment } from './text';
import { scoreRangeFragment } from './score';

export const problemMaterialFragment = gql`
  fragment ProblemMaterialFragment on Problem {
    material {
      title {
        ...TextFragment
      }
      statement {
        name
        type
        content {
          base64
        }
      }
      attachments {
        title {
          ...TextFragment
        }
        file {
          name
          type
          content {
            base64
          }
        }
      }
      submissionForm {
        fields {
          id
          title {
            ...TextFragment
          }
          types {
            id
            title {
              ...TextFragment
            }
            extensions
          }
        }
      }
      awards {
        name
        title {
          ...TextFragment
        }
        content {
          __typename
          ... on ScoreAwardContent {
            range {
              ...ScoreRangeFragment
            }
          }
        }
      }
      feedback {
        __typename
        ... on TableSection {
          caption {
            ...TextFragment
          }
          cols {
            title {
              ...TextFragment
            }
            content {
              __typename
              ... on ScoreColContent {
                range {
                  ...ScoreRangeFragment
                }
              }
            }
          }
          rowGroups {
            title {
              ...TextFragment
            }
            rows {
              content
              cells {
                content {
                  __typename
                  ... on RowNumberCellContent {
                    number
                  }
                  ... on RowTitleCellContent {
                    title {
                      ...TextFragment
                    }
                  }
                  ... on ScoreCellContent {
                    key
                    range {
                      ...ScoreRangeFragment
                    }
                  }
                  ... on MessageCellContent {
                    key
                    valenceKey
                  }
                  ... on TimeUsageCellContent {
                    timeUsageMaxRelevant: maxRelevant
                    timeUsagePrimaryWatermark: primaryWatermark
                    key
                    valenceKey
                  }
                  ... on MemoryUsageCellContent {
                    memoryUsageMaxRelevant: maxRelevant
                    memoryUsagePrimaryWatermark: primaryWatermark
                    key
                    valenceKey
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  ${textFragment}
  ${scoreRangeFragment}
`;

export const scoreRanges = (problem: ProblemMaterialFragment) => problem.material.awards.map(({ name, content }) => {
  if (content.__typename === 'ScoreAwardContent') {
    return { name, range: content.range };
  } else {
    return { name, range: { precision: 0, max: 0 } };
  }
});
